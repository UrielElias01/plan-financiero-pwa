import { cloneSeed, createPeriod, monthNames, today as defaultToday } from "./seed";
import type { AppState, CalculatedPeriod, CardCalendarEntry, CardDebtSummary, MonthlyReport, PaymentScheduleItem, Period, RecurringItem, Transaction } from "./types";
import type { BankStatement } from "./bbva-types";
import { validateStatement } from "./bbva";

const currency = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 });
export function asNumber(value: unknown, fallback = 0): number { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }
/** Every arithmetic operation uses integer cents; conversion happens only at boundaries. */
export function toCents(value: unknown): number { return Math.round((asNumber(value) + Math.sign(asNumber(value)) * Number.EPSILON) * 100); }
const pesos = (value: number) => value / 100;
const positiveCents = (value: unknown) => Math.max(0, toCents(value));
export function isConfirmedTransaction(transaction: Transaction, asOf = defaultToday): boolean { return transaction.status !== "planned" && transaction.date <= asOf; }
export function sum<T>(items: T[], selector: (item: T) => number): number { return pesos(items.reduce((total, item) => total + toCents(selector(item)), 0)); }
export function formatMoney(value: unknown): string { return currency.format(asNumber(value) || 0); }
export function signedTone(value: unknown): "positive" | "negative" { return asNumber(value) < 0 ? "negative" : "positive"; }
const pad = (value: number) => String(value).padStart(2, "0");
const validMonth = (value: unknown): value is string => typeof value === "string" && /^(19\d{2}|20\d{2}|21\d{2}|2200)-(0[1-9]|1[0-2])$/.test(value);
export function monthAfter(month: string, offset: number): string {
  const [year, number] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, number - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}`;
}
export function dateForDay(month: string, day: number): string {
  const [year, number] = month.split("-").map(Number);
  return `${month}-${pad(Math.min(new Date(Date.UTC(year, number, 0)).getUTCDate(), Math.max(1, Math.trunc(day))))}`;
}
export function monthLabel(month: string): string { return `${monthNames[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`; }
export function datePeriodId(date: string): string { return `${date.slice(0, 7)}-h${Number(date.slice(8, 10)) <= 15 ? 1 : 2}`; }
function periodMonth(period: Period): string { return period.id.slice(0, 7); }
function periodStart(period: Period): string { return `${periodMonth(period)}-${period.id.endsWith("h1") ? "01" : "16"}`; }
export function paydayForPeriod(period: Period): string | null { return validMonth(periodMonth(period)) ? dateForDay(periodMonth(period), period.id.endsWith("h1") ? 15 : 31) : null; }
export function periodIdForDate(_state: AppState, date: string): string { return /^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(date) ? datePeriodId(date) : ""; }
export function buildNextPeriodFor(state: AppState): Period | null {
  const last = state.periods.at(-1); if (!last || !validMonth(periodMonth(last))) return null;
  const month = last.id.endsWith("h1") ? periodMonth(last) : monthAfter(periodMonth(last), 1);
  return createPeriod(Number(month.slice(0, 4)), Number(month.slice(5)), last.id.endsWith("h1") ? 2 : 1);
}
export function duePeriodsFor(state: AppState, asOf = defaultToday): Period[] { return state.periods.filter((period) => !period.closedAt && (paydayForPeriod(period) || "9999") <= asOf); }

/** shared is only a label. A user's monetary responsibility must be an explicit amount. */
export function transactionUserAmount(transaction: Pick<Transaction, "amount" | "shared" | "userAmount">): number {
  return pesos(transaction.shared && typeof transaction.userAmount === "number" ? Math.min(positiveCents(transaction.amount), positiveCents(transaction.userAmount)) : positiveCents(transaction.amount));
}

export function nextPaymentMonthFor(state: AppState, date: string): string {
  const chargeMonth = date.slice(0, 7);
  const cutoff = dateForDay(chargeMonth, state.settings.cutoffDay);
  const statementMonth = date <= cutoff ? chargeMonth : monthAfter(chargeMonth, 1);
  // A payment date on/before the cut-off belongs to the next month.
  const sameMonthDue = dateForDay(statementMonth, state.settings.dueDay);
  return sameMonthDue > dateForDay(statementMonth, state.settings.cutoffDay) ? statementMonth : monthAfter(statementMonth, 1);
}

/** Each outstanding installment has exactly one due month, even outside the visible table. */
export function buildPaymentScheduleFor(state: AppState, transaction: Transaction): PaymentScheduleItem[] {
  if (transaction.method !== "credit") return [];
  const count = Math.min(120, Math.max(1, Math.trunc(asNumber(transaction.totalInstallments ?? transaction.installments, 1))));
  const paid = Math.min(count, Math.max(0, Math.trunc(asNumber(transaction.currentInstallment))));
  const first = validMonth(transaction.nextPaymentMonth) ? transaction.nextPaymentMonth : monthAfter(nextPaymentMonthFor(state, transaction.date), paid);
  const total = positiveCents(transaction.amount);
  const own = toCents(transactionUserAmount(transaction));
  const fixed = typeof transaction.monthlyAmount === "number" ? positiveCents(transaction.monthlyAmount) : undefined;
  const grossThrough = (installment: number) => fixed !== undefined ? fixed * installment : Math.floor(total / count) * installment + (installment === count ? total % count : 0);
  let remaining = transaction.remainingPrincipalAmount !== undefined ? positiveCents(transaction.remainingPrincipalAmount) : Math.max(0, total - grossThrough(paid));
  return Array.from({ length: count - paid }, (_, offset) => {
    const installment = paid + offset + 1;
    const monthKey = monthAfter(first, offset);
    const dueDate = dateForDay(monthKey, state.settings.dueDay);
    const scheduled = grossThrough(installment) - grossThrough(installment - 1);
    const cents = installment === count ? remaining : Math.min(remaining, scheduled);
    const priorPrincipal = total - remaining;
    remaining -= cents;
    const amount = pesos(cents);
    const userCents = transaction.shared && total > 0 ? Math.round((priorPrincipal + cents) * own / total) - Math.round(priorPrincipal * own / total) : cents;
    return { periodId: datePeriodId(dueDate), amount, total: amount, userAmount: pesos(userCents), dueDate, monthKey, installment, totalInstallments: count };
  }).filter((item) => item.amount > 0);
}

function occurrenceKey(transaction: Transaction): string { return `${transaction.sourceRecurringId}:${(transaction.recurringDate || transaction.date).slice(0, 7)}`; }
function uniqueTransactions(state: AppState): Transaction[] {
  const ids = new Set<string>(); const occurrences = new Set<string>();
  return state.transactions.filter((transaction) => {
    const key = occurrenceKey(transaction);
    if (ids.has(transaction.id) || (transaction.sourceRecurringId && occurrences.has(key))) return false;
    ids.add(transaction.id); if (transaction.sourceRecurringId) occurrences.add(key); return true;
  });
}
function recurringTransaction(item: RecurringItem, date: string): Transaction {
  return { id: `recurring:${item.id}:${date}`, date, description: item.name, amount: item.amount, userAmount: item.userAmount, shared: Boolean(item.shared), category: "Suscripción", method: item.method === "credit" ? "credit" : "cash", periodId: datePeriodId(date), installments: 1, totalInstallments: 1, currentInstallment: 0, sourceRecurringId: item.id, recurringDate: date, affectsSavings: item.method === "debit", status: "planned" };
}
function projectedRecurringTransactions(state: AppState, asOf = defaultToday): Transaction[] {
  const materialized = new Set(uniqueTransactions(state).filter((transaction) => transaction.sourceRecurringId).map(occurrenceKey));
  const transactions: Transaction[] = [];
  for (const period of state.periods) {
    if (period.closedAt) continue;
    for (const item of state.recurring) {
      if (!item.active || positiveCents(item.amount) === 0) continue;
      const date = dateForDay(periodMonth(period), item.day);
      if (item.method === "credit" && latestStatementFor(state, asOf) && date <= latestStatementFor(state, asOf)!.cutoffDate) continue;
      if (date < (state.settings.balanceAsOf || "1900-01-01")) continue;
      if (datePeriodId(date) !== period.id || (item.startsOn && date < item.startsOn) || (item.endsOn && date > item.endsOn)) continue;
      if (materialized.has(`${item.id}:${date.slice(0, 7)}`)) continue;
      transactions.push(recurringTransaction(item, date));
    }
  }
  return transactions;
}
export function normalizeCategory(value: string): string { return value.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLocaleLowerCase("es-MX"); }
/** Earlier versions called groceries "Comida"; both names count against the same budget. */
function budgetKey(value: string): string { const key = normalizeCategory(value); return key === "comida" ? "mandado" : key; }
function previousDay(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10);
}
/**
 * The date a purchase counts at for budgets and monthly spending. Normally its own date; with
 * `budgetMonth` (e.g. groceries bought before the cut-off for next month) it is the first day of
 * that month's card cycle, the day after its cut-off. Debt and cash always use the real date.
 */
export function budgetDateFor(state: AppState, transaction: Pick<Transaction, "date" | "budgetMonth">): string {
  const month = transaction.budgetMonth;
  if (!validMonth(month) || month === transaction.date.slice(0, 7)) return transaction.date;
  const cut = dateForDay(month, state.settings.cutoffDay);
  const [year, number, day] = cut.split("-").map(Number);
  const next = new Date(Date.UTC(year, number - 1, day + 1)).toISOString().slice(0, 10);
  return next.slice(0, 7) === month ? next : `${month}-01`;
}
/** Spending already recorded against a budget, by any payment method, in (start, end]. */
export function budgetSpentFor(state: AppState, category: string, start: string, end: string): number {
  const key = budgetKey(category);
  return pesos(uniqueTransactions(state).filter((transaction) => {
    if ((transaction.method !== "credit" && transaction.method !== "cash") || budgetKey(transaction.category) !== key) return false;
    const date = budgetDateFor(state, transaction);
    return date > start && date <= end;
  }).reduce((total, transaction) => total + toCents(transactionUserAmount(transaction)), 0));
}
/** Card cycles (previous cut-off, cut-off] whose cut-off is today or later, within the income horizon. */
export function cardCyclesFor(state: AppState, asOf = defaultToday): Array<{ start: string; end: string }> {
  const last = state.periods.filter((period) => !period.closedAt).at(-1);
  const horizon = last ? paydayForPeriod(last) : null;
  if (!horizon) return [];
  const cycles: Array<{ start: string; end: string }> = [];
  for (let offset = -1, previous = ""; offset < 240; offset += 1) {
    const cut = dateForDay(monthAfter(asOf.slice(0, 7), offset), state.settings.cutoffDay);
    if (previous && cut >= asOf) {
      if (cut > horizon) break;
      cycles.push({ start: previous, end: cut });
    }
    previous = cut;
  }
  return cycles;
}
/**
 * Budgets stand in for spending that has not happened yet. Recorded spending of the same category
 * consumes the budget, so a purchase and its budget are never projected twice.
 */
export function projectedBudgetTransactions(state: AppState, asOf = defaultToday): Transaction[] {
  const budgets = (state.settings.budgets || []).filter((budget) => positiveCents(budget.monthlyAmount) > 0 && budget.category.trim());
  if (!budgets.length) return [];
  const currentId = datePeriodId(asOf);
  const transactions: Transaction[] = [];
  const base = (budget: typeof budgets[number], date: string, cents: number, method: Transaction["method"]): Transaction => ({ id: `budget:${budget.id}:${date}`, date, description: `${budget.category} · presupuesto`, amount: pesos(cents), category: budget.category, method, periodId: datePeriodId(date), shared: false, installments: 1, totalInstallments: 1, currentInstallment: 0, status: "planned", affectsSavings: method !== "credit" });
  for (const budget of budgets) {
    const monthly = positiveCents(budget.monthlyAmount);
    if (budget.method === "credit") {
      for (const cycle of cardCyclesFor(state, asOf)) {
        const remaining = monthly - toCents(budgetSpentFor(state, budget.category, cycle.start, cycle.end));
        if (remaining > 0) transactions.push({ ...base(budget, cycle.end, remaining, "credit"), nextPaymentMonth: nextPaymentMonthFor(state, cycle.end) });
      }
      continue;
    }
    for (const period of state.periods) {
      const end = paydayForPeriod(period);
      if (period.closedAt || period.id < currentId || !end) continue;
      const half = period.id.endsWith("h1") ? Math.floor(monthly / 2) : monthly - Math.floor(monthly / 2);
      const remaining = half - toCents(budgetSpentFor(state, budget.category, previousDay(periodStart(period)), end));
      const start = periodStart(period);
      if (remaining > 0) transactions.push(base(budget, start < asOf ? asOf : start, remaining, "cash"));
    }
  }
  return transactions;
}

export function recurringOccurrencesFor(state: AppState, asOf = defaultToday): Array<{ recurring: RecurringItem; date: string; transaction: Transaction }> {
  const items = new Map(state.recurring.map((item) => [item.id, item]));
  return projectedRecurringTransactions(state, asOf).filter((transaction) => transaction.date <= asOf).map((transaction) => ({ recurring: items.get(transaction.sourceRecurringId!)!, date: transaction.date, transaction })).sort((a, b) => a.date.localeCompare(b.date));
}

type CashBalances = { savings: number; reserve: number; food: number };
function reserveEffect(transaction: Transaction): number { return transaction.method === "income" && transaction.affectsSavings !== false ? Math.min(toCents(transactionUserAmount(transaction)), positiveCents(transaction.rentReserveAmount)) : 0; }
function foodReserveEffect(transaction: Transaction): number { return transaction.method === "income" && transaction.affectsSavings !== false ? Math.min(Math.max(0, toCents(transactionUserAmount(transaction)) - reserveEffect(transaction)), positiveCents(transaction.foodReserveAmount)) : 0; }
function applyCashEffect(balances: CashBalances, transaction: Transaction): CashBalances {
  if (transaction.affectsSavings === false) return balances;
  const amount = toCents(transactionUserAmount(transaction));
  if (transaction.method === "income") {
    const rent = reserveEffect(transaction); const food = foodReserveEffect(transaction);
    return { savings: balances.savings + amount - rent - food, reserve: balances.reserve + rent, food: balances.food + food };
  }
  if (transaction.method !== "cash" && transaction.method !== "card_payment") return balances;
  const bucket = transaction.fundingSource === "food_reserve" ? "food" : transaction.fundingSource === "rent_reserve" ? "reserve" : null;
  const covered = bucket ? Math.min(amount, Math.max(0, balances[bucket])) : 0;
  return { ...balances, ...(bucket ? { [bucket]: balances[bucket] - covered } : {}), savings: balances.savings - amount + covered };
}
function cashTransactions(state: AppState, asOf: string): Transaction[] {
  const included = new Set(state.settings.balanceIncludedTransactionIds || []);
  // With day-level records, funds received that day are available before its outflows.
  return uniqueTransactions(state).filter((transaction) => isConfirmedTransaction(transaction, asOf) && transaction.date >= (state.settings.balanceAsOf || "1900-01-01") && !(included.has(transaction.id) && transaction.date <= (state.settings.balanceAsOf || "9999"))).sort((left, right) => left.date.localeCompare(right.date) || Number(right.method === "income") - Number(left.method === "income"));
}
function cashEffects(state: AppState, asOf: string): CashBalances {
  return cashTransactions(state, asOf).reduce(applyCashEffect, { savings: 0, reserve: 0, food: 0 });
}
function actualBalances(state: AppState, asOf: string): CashBalances {
  const effects = cashEffects(state, asOf);
  const opening = { savings: toCents(state.settings.openingSavings ?? pesos(toCents(state.settings.currentSavings) - effects.savings)), reserve: toCents(state.settings.openingRentReserve ?? pesos(toCents(state.settings.rentReserve) - effects.reserve)), food: toCents(state.settings.openingFoodReserve ?? pesos(toCents(state.settings.foodReserve) - effects.food)) };
  return cashTransactions(state, asOf).reduce(applyCashEffect, opening);
}
export function reconcileCashBalanceFor(state: AppState, currentSavings: number, rentReserve = state.settings.rentReserve, asOf = defaultToday, foodReserve = state.settings.foodReserve || 0): AppState {
  return refreshDerived({ ...state, settings: { ...state.settings, balanceAsOf: asOf, balanceIncludedTransactionIds: uniqueTransactions(state).filter((transaction) => isConfirmedTransaction(transaction, asOf)).map((transaction) => transaction.id), openingSavings: currentSavings, openingRentReserve: rentReserve, openingFoodReserve: foodReserve } }, asOf);
}

type Obligation = { transactionId: string; description: string; periodId: string; dueDate: string; monthKey: string; amount: number; total: number; userAmount: number; remaining: number; paid: number; installment: number; totalInstallments: number; projected: boolean };
type CardLedger = { obligations: Obligation[]; knownPrincipal: number; knownRemaining: number; creditBalance: number; payments: number; unallocatedDebt: number; reconciliationWarning?: string };
export function latestStatementFor(state: AppState, asOf = defaultToday): BankStatement | undefined { return (state.statements || []).filter((entry) => entry.cutoffDate <= asOf).sort((a, b) => b.cutoffDate.localeCompare(a.cutoffDate) || b.importedAt.localeCompare(a.importedAt))[0]; }

/** Statement balance is AFTER the installment billed in this statement; that billed amount is already inside its required payment. */
export function statementInstallmentSchedulesFor(state: AppState, asOf = defaultToday): Array<{ installmentId: string; merchant: string; payments: PaymentScheduleItem[] }> {
  const statement = latestStatementFor(state, asOf); if (!statement) return [];
  return statement.installments.map((item) => {
    let balance = positiveCents(item.remainingBalance);
    const payments: PaymentScheduleItem[] = [];
    for (let installment = item.billedInstallment + 1; installment <= item.totalInstallments && balance > 0; installment++) {
      const amount = installment === item.totalInstallments ? balance : Math.min(balance, positiveCents(item.monthlyAmount)); balance -= amount;
      const monthKey = monthAfter(statement.dueDate.slice(0, 7), installment - item.billedInstallment);
      const dueDate = dateForDay(monthKey, Number(statement.dueDate.slice(8)));
      payments.push({ periodId: datePeriodId(dueDate), amount: pesos(amount), total: pesos(amount), userAmount: pesos(amount), dueDate, monthKey, installment, totalInstallments: item.totalInstallments });
    }
    return { installmentId: item.id, merchant: item.merchant, payments };
  });
}
function cardLedger(state: AppState, asOf: string, includeForecast = true): CardLedger {
  const transactions = uniqueTransactions(state);
  const statement = latestStatementFor(state, asOf);
  const obligations: Obligation[] = [];
  let unallocatedDebt = 0; let reconciliationWarning: string | undefined;
  // These buckets are already settled by the imported paid counter. They are
  // not debt. Matching historical payment records consume them before touching
  // remaining principal, so importing/rebasing a paid counter cannot pay twice.
  const historical: Array<Obligation & { paymentIds: Set<string>; snapshotDate: string }> = [];
  const add = (transaction: Transaction, projected: boolean) => {
    for (const payment of buildPaymentScheduleFor(state, transaction)) obligations.push({ transactionId: transaction.id, description: transaction.description, periodId: payment.periodId, dueDate: payment.dueDate!, monthKey: payment.monthKey!, amount: toCents(payment.amount), total: toCents(payment.total ?? payment.amount), userAmount: toCents(payment.userAmount ?? payment.amount), remaining: toCents(payment.amount), paid: 0, installment: payment.installment!, totalInstallments: payment.totalInstallments!, projected });
    const paid = Math.max(0, Math.trunc(asNumber(transaction.currentInstallment)));
    if (!projected && paid > 0) {
      const firstRemaining = validMonth(transaction.nextPaymentMonth) ? transaction.nextPaymentMonth : monthAfter(nextPaymentMonthFor(state, transaction.date), paid);
      const fullSchedule = buildPaymentScheduleFor(state, { ...transaction, currentInstallment: 0, nextPaymentMonth: monthAfter(firstRemaining, -paid) });
      const snapshotDate = transaction.installmentsAsOf || transaction.date;
      const paymentIds = new Set(transaction.installmentPaymentIds || transactions.filter((entry) => entry.method === "card_payment" && entry.date < snapshotDate).map((entry) => entry.id));
      for (const payment of fullSchedule.slice(0, paid)) historical.push({ transactionId: transaction.id, description: transaction.description, periodId: payment.periodId, dueDate: payment.dueDate!, monthKey: payment.monthKey!, amount: toCents(payment.amount), total: toCents(payment.amount), userAmount: toCents(payment.userAmount ?? payment.amount), remaining: toCents(payment.amount), paid: 0, installment: payment.installment!, totalInstallments: payment.totalInstallments!, projected: false, paymentIds, snapshotDate });
    }
  };
  const opening = statement ? 0 : positiveCents(state.settings.openingCardDebt);
  if (opening) {
    const month = validMonth(state.settings.openingCardPaymentMonth) ? state.settings.openingCardPaymentMonth : nextPaymentMonthFor(state, asOf);
    add({ id: "opening-card-debt", description: "Saldo inicial sin compras registradas", date: asOf, amount: pesos(opening), category: "Saldo inicial", method: "credit", periodId: datePeriodId(asOf), shared: false, installments: 1, nextPaymentMonth: month }, false);
  }
  if (statement) {
    const insert = (id: string, description: string, payment: PaymentScheduleItem) => obligations.push({ transactionId: id, description, periodId: payment.periodId, dueDate: payment.dueDate!, monthKey: payment.monthKey!, amount: toCents(payment.amount), total: toCents(payment.amount), userAmount: toCents(payment.userAmount ?? payment.amount), remaining: toCents(payment.amount), paid: 0, installment: payment.installment || 1, totalInstallments: payment.totalInstallments || 1, projected: false });
    insert(`statement:${statement.id}`, "BBVA · pago para no generar intereses", { periodId: datePeriodId(statement.dueDate), dueDate: statement.dueDate, monthKey: statement.dueDate.slice(0, 7), amount: statement.paymentToAvoidInterest });
    for (const schedule of statementInstallmentSchedulesFor(state, asOf)) for (const payment of schedule.payments) insert(`statement:${statement.id}:${schedule.installmentId}`, schedule.merchant, payment);
    const scheduled = obligations.reduce((total, item) => total + item.amount, 0);
    const discrepancy = positiveCents(statement.totalDebt) - scheduled;
    unallocatedDebt = Math.max(0, discrepancy);
    if (discrepancy !== 0 || positiveCents(statement.installmentBalance) !== statement.installments.reduce((total, item) => total + positiveCents(item.remainingBalance), 0)) reconciliationWarning = "El detalle de mensualidades no concilia con el saldo del estado. Revisa los importes antes de confiar en las fechas de esa diferencia.";
    if (unallocatedDebt > 0) insert(`statement:${statement.id}:unallocated`, "BBVA · saldo por conciliar (fecha estimada)", { periodId: datePeriodId(statement.dueDate), dueDate: statement.dueDate, monthKey: statement.dueDate.slice(0, 7), amount: pesos(unallocatedDebt) });
  }
  for (const transaction of transactions) {
    if (transaction.method !== "credit") continue;
    const confirmed = isConfirmedTransaction(transaction, asOf);
    if (confirmed) {
      if (!statement || transaction.date > statement.cutoffDate) add(transaction, false);
    } else if (includeForecast) {
      // A planned purchase is never inside an actual bank statement merely because its date passed.
      const date = transaction.date < asOf ? asOf : transaction.date;
      const earliestMonth = nextPaymentMonthFor(state, date);
      const nextPaymentMonth = transaction.nextPaymentMonth && transaction.nextPaymentMonth >= earliestMonth ? transaction.nextPaymentMonth : earliestMonth;
      add({ ...transaction, date, nextPaymentMonth }, true);
    }
  }
  if (includeForecast) for (const transaction of [...projectedRecurringTransactions(state, asOf), ...projectedBudgetTransactions(state, asOf)]) if (transaction.method === "credit") add(transaction, true);
  obligations.sort((left, right) => left.dueDate.localeCompare(right.dueDate) || left.transactionId.localeCompare(right.transactionId));
  const knownPrincipal = obligations.filter((item) => !item.projected).reduce((total, item) => total + item.amount, 0);
  const payments = transactions.filter((transaction) => transaction.method === "card_payment" && isConfirmedTransaction(transaction, asOf) && (!statement || transaction.date > statement.cutoffDate)).sort((left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id));
  let credit = 0;
  const allocate = (items: Obligation[], available: number) => {
    for (const item of items) { const applied = Math.min(item.remaining, available); item.remaining -= applied; item.paid += applied; available -= applied; if (!available) break; }
    return available;
  };
  for (const payment of payments) {
    let available = toCents(transactionUserAmount(payment));
    const known = [...obligations.filter((item) => !item.projected), ...historical.filter((item) => item.paymentIds.has(payment.id))].sort((left, right) => left.dueDate.localeCompare(right.dueDate) || left.transactionId.localeCompare(right.transactionId));
    if (payment.paymentForPeriodId) available = allocate(known.filter((item) => item.periodId === payment.paymentForPeriodId), available);
    credit += allocate(known, available);
  }
  const knownRemaining = obligations.filter((item) => !item.projected).reduce((total, item) => total + item.remaining, 0);
  const creditBalance = credit;
  // A balance in favour can fund future charges, but does not turn those charges into actual debt.
  if (includeForecast) credit = allocate(obligations.filter((item) => item.projected), credit);
  return { obligations, knownPrincipal, knownRemaining, creditBalance, payments: payments.reduce((total, transaction) => total + toCents(transactionUserAmount(transaction)), 0), unallocatedDebt, reconciliationWarning };
}

export function cardPaymentObligationsFor(state: AppState, asOf = defaultToday): Array<{ id: string; date: string; periodId: string; description: string; amount: number; estimated: boolean }> {
  return cardLedger(state, asOf).obligations.filter((item) => item.remaining > 0).map((item) => ({ id: `${item.transactionId}:${item.installment}`, date: item.dueDate, periodId: item.periodId, description: item.description, amount: pesos(item.remaining), estimated: item.projected }));
}

export function buildCardCalendarFor(state: AppState, asOf = defaultToday): CardCalendarEntry[] {
  const ledger = cardLedger(state, asOf);
  const months = new Set(state.periods.map(periodMonth));
  for (const item of ledger.obligations) months.add(item.monthKey);
  const sorted = [...months].filter(validMonth).sort();
  if (!sorted.length) return [];
  // Include zero months between payments and the last displayed month.
  const all: string[] = []; for (let month = sorted[0]; month <= sorted.at(-1)! && validMonth(month) && all.length < 3612; month = monthAfter(month, 1)) all.push(month);
  return all.map((monthKey) => {
    const items = ledger.obligations.filter((item) => item.monthKey === monthKey);
    const cents = (selector: (item: Obligation) => number) => pesos(items.reduce((total, item) => total + selector(item), 0));
    return { month: monthLabel(monthKey), monthKey, dueDate: items.find((item) => item.remaining > 0)?.dueDate || items[0]?.dueDate || dateForDay(monthKey, state.settings.dueDay), total: cents((item) => item.total), userPart: cents((item) => item.userAmount), paid: cents((item) => item.paid), remaining: cents((item) => item.remaining), projected: cents((item) => item.projected ? item.amount : 0), debt: pesos(ledger.obligations.filter((item) => !item.projected && item.monthKey > monthKey).reduce((total, item) => total + item.remaining, 0)), installments: items.filter((item) => item.totalInstallments > 1).map((item) => ({ transactionId: item.transactionId, description: item.description, installment: item.installment, totalInstallments: item.totalInstallments, amount: pesos(item.amount), remaining: pesos(item.remaining) })) };
  });
}

export function calculateCardDebtFor(state: AppState, _periods?: CalculatedPeriod[], asOf = defaultToday): CardDebtSummary {
  const ledger = cardLedger(state, asOf, false);
  const first = ledger.obligations.find((item) => item.remaining > 0);
  const knownNextPayment = first ? ledger.obligations.filter((item) => item.monthKey === first.monthKey).reduce((total, item) => total + item.remaining, 0) : 0;
  const forecast = cardLedger(state, asOf);
  const next = forecast.obligations.find((item) => item.remaining > 0);
  const nextItems = next ? forecast.obligations.filter((item) => item.monthKey === next.monthKey) : [];
  const nextPayment = nextItems.reduce((total, item) => total + item.remaining, 0);
  const opening = latestStatementFor(state, asOf) ? 0 : positiveCents(state.settings.openingCardDebt);
  return { nextPayment: pesos(nextPayment), knownNextPayment: pesos(knownNextPayment), nextPaymentIsEstimate: nextItems.some((item) => item.projected && item.remaining > 0), installmentBalance: pesos(Math.max(0, ledger.knownRemaining - knownNextPayment)), scheduledPayments: pesos(ledger.knownRemaining), calendarBalance: pesos(ledger.knownRemaining), settingsBalance: pesos(opening), creditPurchases: pesos(ledger.knownPrincipal - opening), totalDebt: pesos(ledger.knownRemaining), creditBalance: pesos(ledger.creditBalance), overdue: pesos(ledger.obligations.filter((item) => item.dueDate < asOf).reduce((total, item) => total + item.remaining, 0)), unallocatedDebt: pesos(ledger.unallocatedDebt), reconciliationWarning: ledger.reconciliationWarning };
}

function isPayroll(transaction: Transaction): boolean { return transaction.method === "income" && transaction.category.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("es-MX") === "nomina"; }
type ForecastEvent = { date: string; periodId: string; kind: "salary" | "income" | "expense" | "card_payment"; label: string; transaction: Transaction; estimated: boolean; salaryEstimated?: boolean };
function forecastEventsFor(state: AppState, asOf: string): ForecastEvent[] {
  const transactions = uniqueTransactions(state);
  const ledger = cardLedger(state, asOf);
  const currentId = datePeriodId(asOf);
  const firstOpen = state.periods.find((period) => period.id >= currentId && !period.closedAt);
  const events: ForecastEvent[] = [];
  const insert = (transaction: Transaction, kind: ForecastEvent["kind"], estimated = true, salaryEstimated = false) => {
    let date = transaction.date < asOf ? asOf : transaction.date;
    let periodId = datePeriodId(date);
    if (state.periods.find((entry) => entry.id === periodId)?.closedAt) {
      const open = state.periods.find((entry) => entry.id >= periodId && !entry.closedAt) || firstOpen;
      if (!open) return;
      periodId = open.id; date = date > periodStart(open) ? date : periodStart(open);
    }
    events.push({ date, periodId, kind, label: transaction.description, transaction: { ...transaction, date, periodId }, estimated, salaryEstimated });
  };
  for (const transaction of transactions) if (!isConfirmedTransaction(transaction, asOf) && transaction.method !== "card_payment" && transaction.method !== "credit") insert(transaction, isPayroll(transaction) ? "salary" : transaction.method === "income" ? "income" : "expense");
  for (const period of state.periods) {
    const payday = paydayForPeriod(period);
    // A payday between nextPayday and today without a recorded payroll stays pending (dated today) until
    // it is confirmed, instead of silently disappearing from the forecast once its half-month ends.
    if (period.closedAt || !payday || payday < (state.settings.nextPayday || asOf) || payday < (state.settings.balanceAsOf || asOf) || transactions.some((entry) => entry.periodId === period.id && isPayroll(entry))) continue;
    const overdue = payday < asOf;
    if (positiveCents(state.settings.salary)) insert({ id: `forecast:salary:${period.id}`, date: payday, periodId: period.id, description: overdue ? `Nómina del ${payday} sin registrar` : "Nómina estimada", method: "income", category: "Nómina", amount: state.settings.salary, installments: 1, shared: false, status: "planned", rentReserveAmount: pesos(Math.round(positiveCents(state.settings.monthlyRent) / 2)), foodReserveAmount: pesos(Math.round(positiveCents(state.settings.monthlyFood) / 2)) }, "salary", true, true);
    const gap = Math.max(0, Math.round(positiveCents(state.settings.monthlyRent) / 2) + Math.round(positiveCents(state.settings.monthlyFood) / 2) - positiveCents(state.settings.salary));
    if (gap) insert({ id: `forecast:essentials-gap:${period.id}`, date: payday, periodId: period.id, description: "Presupuesto básico sin cubrir con la nómina", method: "cash", category: "Renta y comida", amount: pesos(gap), installments: 1, shared: false, status: "planned" }, "expense");
  }
  for (const transaction of [...projectedRecurringTransactions(state, asOf), ...projectedBudgetTransactions(state, asOf)]) if (transaction.method === "cash") insert(transaction, "expense");
  for (const transaction of transactions.filter((entry) => entry.method === "card_payment" && !isConfirmedTransaction(entry, asOf)).sort((a, b) => a.date.localeCompare(b.date))) {
    let available = toCents(transactionUserAmount(transaction));
    const target = transaction.paymentForPeriodId;
    const ordered = target ? [...ledger.obligations.filter((entry) => entry.periodId === target), ...ledger.obligations.filter((entry) => entry.periodId !== target)] : ledger.obligations;
    for (const obligation of ordered) {
      const applied = Math.min(available, obligation.remaining); if (!applied) continue;
      available -= applied; obligation.remaining -= applied;
      // A plan dated after its deadline cannot move the bank's deadline or hide a shortfall.
      insert({ ...transaction, id: `${transaction.id}:${obligation.transactionId}:${obligation.installment}`, date: transaction.date < obligation.dueDate ? transaction.date : obligation.dueDate, amount: pesos(applied), shared: false, userAmount: undefined }, "card_payment", obligation.projected);
      if (!available) break;
    }
    if (available) insert({ ...transaction, amount: pesos(available), shared: false, userAmount: undefined }, "card_payment");
  }
  for (const obligation of ledger.obligations) if (obligation.remaining > 0) insert({ id: `forecast:${obligation.transactionId}:${obligation.installment}`, date: obligation.dueDate, periodId: obligation.periodId, description: obligation.description, method: "card_payment", category: "Pago TDC", amount: pesos(obligation.remaining), installments: 1, shared: false, status: "planned" }, "card_payment", obligation.projected);
  return events.sort((a, b) => a.date.localeCompare(b.date) || Number(b.transaction.method === "income") - Number(a.transaction.method === "income"));
}

export type LiquidityEvent = {
  date: string; kind: ForecastEvent["kind"]; label: string; amount: number; balance: number; estimated: boolean; periodId: string;
  /** Source movement: gross amount, category and the part reserved for rent or food (income only). */
  transactionId: string; category: string; gross: number; reserved: number;
};
/** Both the half-month table and deadline alerts consume this same chronological cash projection. */
export function liquidityTimelineFor(state: AppState, asOf = defaultToday): LiquidityEvent[] {
  let balances = actualBalances(state, asOf);
  return forecastEventsFor(state, asOf).map((event) => {
    const previous = balances.savings; balances = applyCashEffect(balances, event.transaction);
    const reserved = event.transaction.affectsSavings === false ? 0 : reserveEffect(event.transaction) + foodReserveEffect(event.transaction);
    return { date: event.date, kind: event.kind, label: event.label, amount: pesos(balances.savings - previous), balance: pesos(balances.savings), estimated: event.estimated, periodId: event.periodId, transactionId: event.transaction.id, category: event.transaction.category, gross: transactionUserAmount(event.transaction), reserved: pesos(reserved) };
  });
}

export function calculatePeriodsFor(state: AppState, asOf = defaultToday): CalculatedPeriod[] {
  const transactions = uniqueTransactions(state);
  const recurring = projectedRecurringTransactions(state, asOf);
  const actual = actualBalances(state, asOf);
  let actualRunning = { savings: toCents(state.settings.openingSavings), reserve: toCents(state.settings.openingRentReserve), food: toCents(state.settings.openingFoodReserve) };
  const actualResults = cashTransactions(state, asOf).map((transaction) => {
    const before = actualRunning; actualRunning = applyCashEffect(actualRunning, transaction);
    return { transaction, flow: actualRunning.savings - before.savings };
  });
  const events = forecastEventsFor(state, asOf);
  let projected = actual;
  const eventResults = events.map((event) => {
    const before = projected; projected = applyCashEffect(projected, event.transaction);
    return { ...event, flow: projected.savings - before.savings, closing: projected.savings };
  });
  const currentId = datePeriodId(asOf);
  const displayedPeriods = new Map(state.periods.map((period) => [period.id, period]));
  for (const event of events) if (!displayedPeriods.has(event.periodId)) {
    const period = createPeriod(Number(event.date.slice(0, 4)), Number(event.date.slice(5, 7)), event.periodId.endsWith("h1") ? 1 : 2);
    displayedPeriods.set(period.id, { ...period, note: "Solo compromisos fuera del horizonte de ingresos." });
  }
  return [...displayedPeriods.values()].sort((a, b) => a.id.localeCompare(b.id)).map((period) => {
    const own = transactions.filter((transaction) => transaction.periodId === period.id);
    const confirmed = own.filter((transaction) => isConfirmedTransaction(transaction, asOf));
    const forecast = !period.closedAt && period.id >= currentId;
    const periodEvents = eventResults.filter((event) => event.periodId === period.id);
    const total = (items: Transaction[], filter: (transaction: Transaction) => boolean, selector = transactionUserAmount) => items.filter(filter).reduce((value, transaction) => value + toCents(selector(transaction)), 0);
    const estimatedSalary = periodEvents.filter((event) => event.salaryEstimated).reduce((value, event) => value + toCents(event.transaction.amount), 0);
    const planned = periodEvents.map((event) => event.transaction);
    const salary = total(confirmed, isPayroll) + total(planned, isPayroll);
    const extraIncome = total(confirmed, (entry) => entry.method === "income" && !isPayroll(entry)) + total(planned, (entry) => entry.method === "income" && !isPayroll(entry));
    const rent = [...confirmed, ...planned].reduce((value, entry) => value + reserveEffect(entry), 0);
    const food = [...confirmed, ...planned].reduce((value, entry) => value + foodReserveEffect(entry), 0);
    const paid = total(confirmed, (entry) => entry.method === "card_payment");
    const pendingPayment = total(planned, (entry) => entry.method === "card_payment");
    const projectedFlow = periodEvents.reduce((value, event) => value + event.flow, 0);
    const cutoff = paydayForPeriod(period) || asOf;
    const historicalSavings = cutoff < (state.settings.balanceAsOf || "1900-01-01") ? toCents(state.settings.openingSavings) : actualBalances(state, cutoff < asOf ? cutoff : asOf).savings;
    const beforeDate = periodStart(period);
    const [year, month, day] = beforeDate.split("-").map(Number); const prior = new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10);
    const actualFlow = historicalSavings - actualBalances(state, prior).savings;
    const lastEvent = eventResults.filter((event) => event.periodId <= period.id).at(-1);
    const outgoingResults = [...actualResults.filter((entry) => entry.transaction.periodId === period.id), ...periodEvents].filter((entry) => ["cash", "card_payment"].includes(entry.transaction.method) && entry.transaction.affectsSavings !== false);
    const reserveUsed = outgoingResults.reduce((value, entry) => value + entry.flow + toCents(transactionUserAmount(entry.transaction)), 0);
    const cashExpenses = -total([...confirmed, ...planned], (entry) => entry.method === "cash" && entry.affectsSavings !== false) - rent - food;
    return { ...period, salary: pesos(salary), extraIncome: pesos(extraIncome), rent: pesos(-rent), foodReserve: pesos(-food), reserveUsed: pesos(reserveUsed), debitServices: pesos(-total(planned, (entry) => entry.method === "cash" && Boolean(entry.sourceRecurringId))), income: pesos(salary + extraIncome), cashExpenses: pesos(cashExpenses), cardPayment: pesos(-paid - pendingPayment), flow: pesos(actualFlow + projectedFlow), creditCharges: pesos(total(own, (entry) => entry.method === "credit") + (forecast ? total(recurring.filter((entry) => entry.periodId === period.id), (entry) => entry.method === "credit") : 0)), savings: pesos(forecast ? lastEvent?.closing ?? actual.savings : historicalSavings), salaryProjected: estimatedSalary > 0, actualFlow: pesos(actualFlow), projectedFlow: pesos(projectedFlow), actualCardPayment: pesos(paid), pendingCardPayment: pesos(pendingPayment), actualSavings: pesos(actual.savings) };
  });
}
export function calculateMonthlyFor(state: AppState, periods = calculatePeriodsFor(state)): MonthlyReport[] {
  const calendar = new Map(buildCardCalendarFor(state).map((entry) => [entry.monthKey, entry]));
  return [...new Set(periods.map(periodMonth))].map((month) => {
    const items = periods.filter((period) => periodMonth(period) === month);
    return { month: monthLabel(month), income: sum(items, (period) => period.income), cashExpenses: sum(items, (period) => period.cashExpenses), reserveUsed: sum(items, (period) => period.reserveUsed || 0), cardPayment: sum(items, (period) => period.cardPayment), flow: sum(items, (period) => period.flow), savings: items.at(-1)?.savings ?? state.settings.currentSavings, creditCharges: sum(items, (period) => period.creditCharges), cardTotal: calendar.get(month)?.total ?? 0 };
  });
}

function refreshDerived(state: AppState, asOf: string): AppState {
  const balances = actualBalances(state, asOf);
  const next = { ...state, transactions: state.transactions.map((entry): Transaction => ({ ...entry, status: entry.status || (entry.date > asOf ? "planned" : "confirmed") })), settings: { ...state.settings, currentSavings: pesos(balances.savings), rentReserve: pesos(balances.reserve), foodReserve: pesos(balances.food), usedCreditBalance: calculateCardDebtFor(state, undefined, asOf).totalDebt }, periods: state.periods.map((period) => ({ ...period, cardPayment: 0 })) };
  next.cardCalendar = buildCardCalendarFor(next, asOf);
  return next;
}

/** Compatibility entry point: caller supplies the final ledger; direction is intentionally irrelevant. */
export function applyTransactionToState(state: AppState, _transaction: Transaction, _direction = 1, asOf = defaultToday): AppState { return refreshDerived(state, asOf); }
export function applyTransactionToPeriods(periods: Period[], _transaction: Transaction, _direction = 1): Period[] { return periods.map((period) => ({ ...period, cardPayment: 0 })); }

export function closePeriodFor(state: AppState, periodId: string, closedAt = defaultToday): { state: AppState; closed?: Period; nextPeriod?: Period } {
  const period = state.periods.find((entry) => entry.id === periodId);
  if (!period || period.closedAt) return { state };
  const closed = { ...period, closedAt, closingSavings: pesos(actualBalances(state, closedAt).savings) };
  const periods = state.periods.map((entry) => entry.id === periodId ? closed : entry);
  const nextPeriod = buildNextPeriodFor({ ...state, periods });
  if (nextPeriod && !periods.some((entry) => entry.id === nextPeriod.id)) periods.push(nextPeriod);
  return { state: refreshDerived({ ...state, periods }, closedAt), closed, nextPeriod: nextPeriod || undefined };
}
export function reopenPeriodFor(state: AppState, periodId: string): AppState { return { ...state, periods: state.periods.map((period) => period.id === periodId ? { ...period, closedAt: undefined, closingSavings: undefined } : period) }; }

type MaterializeRecurringOptions = { since?: string; recurringIds?: Set<string> };
/** Explicit confirmation only. Merely opening the app or editing a subscription must never mark it paid. */
export function materializeDueRecurringTransactions(state: AppState, asOf = defaultToday, options: MaterializeRecurringOptions = {}): { state: AppState; added: Transaction[] } {
  const added = recurringOccurrencesFor(state, asOf).filter((item) => (!options.since || item.date > options.since) && (!options.recurringIds || options.recurringIds.has(item.recurring.id))).map((item): Transaction => ({ ...item.transaction, status: "confirmed" }));
  return { state: refreshDerived({ ...state, transactions: [...state.transactions, ...added] }, asOf), added };
}
/** Recurring edits affect projections. Confirmed ledger history remains unchanged. */
export function reconcileRecurringTransactions(state: AppState, asOf = defaultToday, _recurringIds?: string[]): { state: AppState; added: Transaction[]; removed: Transaction[] } { return { state: refreshDerived(state, asOf), added: [], removed: [] }; }

export function normalizeState(input?: Partial<AppState> | null, asOf = defaultToday): AppState {
  const seed = cloneSeed(asOf);
  if (!input) return refreshDerived(seed, asOf);
  const legacy = asNumber(input.version, 1) < 3;
  const settings = { ...seed.settings, ...input.settings };
  if (!input.settings?.balanceAsOf) settings.balanceAsOf = (input.transactions || []).reduce((date, entry) => entry.date < date ? entry.date : date, asOf);
  const transactions = (Array.isArray(input.transactions) ? input.transactions : []).map((value, index): Transaction => {
    const method = ["income", "credit", "card_payment"].includes(value.method) ? value.method : "cash";
    return { ...value, id: value.id || `imported-${index}`, date: value.date || asOf, description: value.description || "Movimiento", category: value.category || "Otro", method: method as Transaction["method"], amount: pesos(positiveCents(value.amount)), periodId: datePeriodId(value.date || asOf), shared: Boolean(value.shared), installments: Math.min(120, Math.max(1, Math.trunc(asNumber(value.totalInstallments ?? value.installments, 1)))), totalInstallments: Math.min(120, Math.max(1, Math.trunc(asNumber(value.totalInstallments ?? value.installments, 1)))), currentInstallment: Math.max(0, Math.trunc(asNumber(value.currentInstallment))), affectsSavings: typeof value.affectsSavings === "boolean" ? value.affectsSavings : asNumber(input.version, 1) < 2 ? method === "cash" && !value.skipPlanImpact : method !== "credit", rentReserveAmount: pesos(positiveCents(value.rentReserveAmount)) };
  });
  const periodsById = new Map((Array.isArray(input.periods) && input.periods.length ? input.periods : seed.periods).map((period) => [period.id, { ...period, cardPayment: 0 }]));
  for (const period of seed.periods) if (!periodsById.has(period.id)) periodsById.set(period.id, period);
  for (const transaction of transactions) if (!periodsById.has(transaction.periodId)) {
    const month = transaction.date.slice(0, 7);
    if (validMonth(month)) periodsById.set(transaction.periodId, createPeriod(Number(month.slice(0, 4)), Number(month.slice(5)), transaction.periodId.endsWith("h1") ? 1 : 2));
  }
  const periods = [...periodsById.values()].sort((a, b) => a.id.localeCompare(b.id));
  const warnings = new Set(input.migrationWarnings || []);
  if (!Array.isArray(input.settings?.budgets)) {
    // Plans saved before budgets existed reserved food from each payroll. The same money is now a
    // "Mandado" budget: recorded grocery spending consumes it instead of a separate reserve.
    settings.budgets = [];
    if (positiveCents(settings.monthlyFood) > 0) {
      settings.budgets.push({ id: "mandado", category: "Mandado", monthlyAmount: pesos(positiveCents(settings.monthlyFood)), method: "debit" });
      warnings.add(`Tu presupuesto de comida (${formatMoney(settings.monthlyFood)} al mes) ahora es el presupuesto «Mandado». Las nóminas nuevas ya no lo apartan: la proyección descuenta lo que aún no gastas de él. Revísalo en Más → Presupuestos.`);
      settings.monthlyFood = 0;
    }
  } else settings.budgets = input.settings!.budgets!.map((budget, index) => ({ id: budget.id || `budget-${index}`, category: String(budget.category || "Otro").trim(), monthlyAmount: pesos(positiveCents(budget.monthlyAmount)), method: budget.method === "credit" ? "credit" : "debit" }));
  for (const transaction of transactions) transaction.status ||= transaction.date > (input.updatedAt?.slice(0, 10) || asOf) || transaction.date > asOf ? "planned" : "confirmed";
  const state: AppState = { ...seed, ...input, version: 4, settings, periods, transactions, statements: (input.statements || []).map(validateStatement), recurring: (input.recurring || []).map((item, index) => ({ ...item, id: item.id || `recurring-${index}`, amount: pesos(positiveCents(item.amount)), day: Math.min(31, Math.max(1, Math.trunc(asNumber(item.day, 1)))), active: item.active !== false, method: item.method === "credit" ? "credit" : "debit" })), sync: { ...seed.sync, ...input.sync }, cardCalendar: [] };
  const lastObligationMonth = [...transactions.filter((entry) => entry.method === "credit").flatMap((entry) => buildPaymentScheduleFor(state, entry)), ...statementInstallmentSchedulesFor(state, asOf).flatMap((entry) => entry.payments)].map((entry) => entry.monthKey!).filter(validMonth).sort().at(-1);
  if (lastObligationMonth) {
    for (let month = asOf.slice(0, 7); month <= lastObligationMonth && validMonth(month); month = monthAfter(month, 1)) {
      for (const half of [1, 2] as const) {
        const period = createPeriod(Number(month.slice(0, 4)), Number(month.slice(5)), half);
        if (period.id >= datePeriodId(asOf) && !periodsById.has(period.id)) periodsById.set(period.id, period);
      }
    }
    state.periods = [...periodsById.values()].sort((a, b) => a.id.localeCompare(b.id));
  }
  for (const transaction of state.transactions) if (transaction.method === "credit" && asNumber(transaction.currentInstallment) > 0 && !Array.isArray(transaction.installmentPaymentIds)) {
    transaction.installmentPaymentIds = state.transactions.filter((entry) => entry.method === "card_payment" && (transaction.installmentsAsOf ? entry.date <= transaction.installmentsAsOf : entry.date < transaction.date)).map((entry) => entry.id);
  }
  const effects = cashEffects(state, asOf);
  if (typeof input.settings?.openingSavings !== "number") settings.openingSavings = pesos(toCents(settings.currentSavings) - effects.savings);
  if (typeof input.settings?.openingRentReserve !== "number") settings.openingRentReserve = pesos(toCents(settings.rentReserve) - effects.reserve);
  if (typeof input.settings?.openingFoodReserve !== "number") settings.openingFoodReserve = pesos(toCents(settings.foodReserve) - effects.food);
  if (legacy) {
    const hasLegacyDebt = [settings.previousCardDebt, settings.previousCardPayment, settings.pointsPayment, settings.newJulyPurchases, settings.nonRecurringBalance, settings.usedCreditBalance].some((value) => positiveCents(value) > 0);
    if (hasLegacyDebt || input.cardCalendar?.some((entry) => entry.total || entry.debt || entry.userPart) || input.periods?.some((period) => period.cardPayment)) {
      warnings.add("Respaldo anterior: los saldos y pagos de tarjeta acumulados se conservaron como referencia, pero no se suman. Revisa las cuotas ya pagadas y captura únicamente deuda inicial que no esté en tus compras registradas.");
      state.legacySnapshot = input.legacySnapshot || { cardCalendar: structuredClone(input.cardCalendar || []), periodPayments: (input.periods || []).filter((period) => period.cardPayment).map((period) => ({ periodId: period.id, amount: period.cardPayment })) };
    }
    if (transactions.some((transaction) => transaction.method === "credit" && transaction.installments > 1 && input.transactions?.find((entry) => entry.id === transaction.id)?.currentInstallment === undefined)) warnings.add("Hay compras antiguas a meses sin contador de cuotas pagadas. Se conservan con cero cuotas pagadas; confirma ese dato y el próximo mes de pago antes de usar la proyección.");
    if (transactions.some((transaction) => transaction.shared && typeof transaction.userAmount !== "number")) warnings.add("Hay gastos compartidos sin importe personal explícito. Se muestra el total hasta que captures tu parte; no se aplica un porcentaje automático.");
  }
  state.migrationWarnings = [...warnings];
  return refreshDerived(state, asOf);
}
