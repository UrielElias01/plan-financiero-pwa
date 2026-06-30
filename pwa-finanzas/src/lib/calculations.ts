import { seedState, today as defaultToday } from "./seed";
import type {
  AppState,
  CalculatedPeriod,
  CardDebtSummary,
  MonthlyReport,
  PaymentScheduleItem,
  Period,
  Transaction,
} from "./types";

const money = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
});

export function asNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function formatMoney(value: unknown): string {
  return money.format(asNumber(value));
}

export function signedTone(value: unknown): "positive" | "negative" {
  return asNumber(value) < 0 ? "negative" : "positive";
}

export function sum<T>(items: T[], selector: (item: T) => number): number {
  return items.reduce((total, item) => total + selector(item), 0);
}

function positiveAmount(value: unknown): number {
  return Math.max(0, asNumber(value));
}

function almostEqual(left: number, right: number): boolean {
  return Math.abs(left - right) < 0.01;
}

function openingCardBalance(settings: AppState["settings"]): number {
  return positiveAmount(settings.previousCardDebt - settings.previousCardPayment - settings.pointsPayment);
}

function baseSettingsBalance(settings: AppState["settings"]): number {
  return Math.max(
    openingCardBalance(settings) + positiveAmount(settings.newJulyPurchases),
    positiveAmount(settings.nonRecurringBalance),
  );
}

function duplicatedLegacyBalance(settings: AppState["settings"]): number {
  return positiveAmount(openingCardBalance(settings) + settings.newJulyPurchases + settings.nonRecurringBalance);
}

function legacyPurchaseCoverage(settings: AppState["settings"]): number {
  return positiveAmount(baseSettingsBalance(settings) - openingCardBalance(settings));
}

function isStaleSeededUsedBalance(
  settings: AppState["settings"],
  currentUsedBalance: number,
  autoUsedBalance: number,
): boolean {
  if (currentUsedBalance <= 0 || autoUsedBalance <= currentUsedBalance) return false;
  return (
    almostEqual(currentUsedBalance, baseSettingsBalance(settings)) ||
    almostEqual(currentUsedBalance, duplicatedLegacyBalance(settings)) ||
    almostEqual(currentUsedBalance, positiveAmount(settings.nonRecurringBalance))
  );
}

function localId(prefix: string, index: number): string {
  return globalThis.crypto?.randomUUID?.() || `${prefix}-${Date.now()}-${index}`;
}

type PeriodDateParts = {
  year: number;
  month: number;
  half: 1 | 2;
};

type RecurringEffects = {
  debitServices: number;
  creditCharges: number;
  cardPayment: number;
};

type RecurringPeriodTotals = {
  debit: number;
  credit: number;
  firstCreditDate: string | null;
};

const monthByName: Record<string, number> = {
  Enero: 1,
  Febrero: 2,
  Marzo: 3,
  Abril: 4,
  Mayo: 5,
  Junio: 6,
  Julio: 7,
  Agosto: 8,
  Septiembre: 9,
  Octubre: 10,
  Noviembre: 11,
  Diciembre: 12,
};

const monthNames = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

function periodDateParts(period: Period): PeriodDateParts | null {
  const idMatch = /^(\d{4})-(\d{2})-h([12])$/.exec(period.id);
  if (idMatch) {
    return {
      year: asNumber(idMatch[1]),
      month: asNumber(idMatch[2]),
      half: idMatch[3] === "1" ? 1 : 2,
    };
  }

  const normalizedLabel = period.label.toLowerCase();
  const half = normalizedLabel.startsWith("1a") ? 1 : normalizedLabel.startsWith("2a") ? 2 : null;
  const month = monthByName[period.month];
  const yearMatch = /(\d{4})/.exec(period.id);
  const year = yearMatch ? asNumber(yearMatch[1]) : asNumber(defaultToday.slice(0, 4));

  return month && half ? { year, month, half } : null;
}

function padDatePart(value: number): string {
  return String(value).padStart(2, "0");
}

function dateForDay(year: number, month: number, day: number): string {
  const lastDay = new Date(year, month, 0).getDate();
  const safeDay = Math.min(Math.max(1, Math.trunc(day)), lastDay);
  return `${year}-${padDatePart(month)}-${padDatePart(safeDay)}`;
}

function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map((part) => asNumber(part));
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return `${next.getUTCFullYear()}-${padDatePart(next.getUTCMonth() + 1)}-${padDatePart(next.getUTCDate())}`;
}

function nextPeriodParts(parts: PeriodDateParts): PeriodDateParts {
  if (parts.half === 1) return { ...parts, half: 2 };
  const nextMonth = parts.month === 12 ? 1 : parts.month + 1;
  const nextYear = parts.month === 12 ? parts.year + 1 : parts.year;
  return { year: nextYear, month: nextMonth, half: 1 };
}

function periodIdFor(parts: PeriodDateParts): string {
  return `${parts.year}-${padDatePart(parts.month)}-h${parts.half}`;
}

function periodLabelFor(parts: PeriodDateParts): string {
  return `${parts.half === 1 ? "1a" : "2a"} ${monthNames[parts.month - 1].toLowerCase()}`;
}

function estimatedPeriodFor(inputState: AppState, parts: PeriodDateParts): Period {
  return {
    id: periodIdFor(parts),
    month: monthNames[parts.month - 1],
    label: periodLabelFor(parts),
    note:
      parts.half === 1
        ? "Quincena financiada con el sueldo del ultimo dia del mes anterior."
        : "Quincena financiada con el sueldo del 15. Aqui suele caer el pago de tarjeta.",
    salary: inputState.settings.salary,
    extraIncome: 0,
    partnerIncome: inputState.settings.defaultFood / 2,
    rent: -(inputState.settings.monthlyRent / 2),
    debitServices: 0,
    foodCredit: inputState.settings.defaultFood,
    chatGptCredit: 0,
    cardPayment: 0,
  };
}

export function buildNextPeriodFor(inputState: AppState): Period | null {
  const last = inputState.periods.at(-1);
  const parts = last ? periodDateParts(last) : null;
  return parts ? estimatedPeriodFor(inputState, nextPeriodParts(parts)) : null;
}

export function paydayForPeriod(period: Period): string | null {
  const parts = periodDateParts(period);
  if (!parts) return null;
  return parts.half === 1 ? addDays(dateForDay(parts.year, parts.month, 1), -1) : dateForDay(parts.year, parts.month, 15);
}

function closingIncomeFor(period: Period): number {
  return asNumber(period.salary) + asNumber(period.extraIncome) + asNumber(period.partnerIncome);
}

function closingRentReserveFor(period: Period): number {
  return positiveAmount(-period.rent);
}

export function duePayrollPeriodsFor(inputState: AppState, asOf = defaultToday): Period[] {
  return inputState.periods.filter((period) => {
    const payday = paydayForPeriod(period);
    if (!payday || payday > asOf || period.closedAt || period.lockedBase) return false;
    return closingIncomeFor(period) !== 0 || closingRentReserveFor(period) > 0;
  });
}

export function closePeriodFor(
  inputState: AppState,
  periodId: string,
  closedAt = defaultToday,
): { state: AppState; closed?: Period; nextPeriod?: Period } {
  const period = inputState.periods.find((entry) => entry.id === periodId);
  if (!period || period.closedAt) return { state: inputState };

  const income = closingIncomeFor(period);
  const rentReserve = closingRentReserveFor(period);
  const closed: Period = {
    ...period,
    salary: 0,
    extraIncome: 0,
    partnerIncome: 0,
    rent: 0,
    closedAt,
    appliedIncome: income,
    appliedRentReserve: rentReserve,
  };
  let periods = inputState.periods.map((entry) => (entry.id === period.id ? closed : entry));
  const nextPeriod = buildNextPeriodFor({ ...inputState, periods });
  const shouldAppendNextPeriod = Boolean(nextPeriod && !periods.some((entry) => entry.id === nextPeriod.id));
  if (nextPeriod && shouldAppendNextPeriod) {
    periods = [...periods, nextPeriod];
  }

  return {
    state: {
      ...inputState,
      settings: {
        ...inputState.settings,
        currentSavings: inputState.settings.currentSavings + income - rentReserve,
        rentReserve: inputState.settings.rentReserve + rentReserve,
      },
      periods,
    },
    closed,
    nextPeriod: shouldAppendNextPeriod ? nextPeriod || undefined : undefined,
  };
}

function recurringHalf(day: number): 1 | 2 {
  return day <= 15 ? 1 : 2;
}

function recurringDateForPeriod(period: Period, item: AppState["recurring"][number]): string | null {
  const parts = periodDateParts(period);
  if (!parts || !item.active || positiveAmount(item.amount) <= 0) return null;
  if (parts.half !== recurringHalf(item.day)) return null;
  return dateForDay(parts.year, parts.month, item.day);
}

function emptyRecurringEffects(): RecurringEffects {
  return {
    debitServices: 0,
    creditCharges: 0,
    cardPayment: 0,
  };
}

function recurringEffectsFor(effects: Map<string, RecurringEffects>, periodId: string): RecurringEffects {
  const existing = effects.get(periodId);
  if (existing) return existing;
  const next = emptyRecurringEffects();
  effects.set(periodId, next);
  return next;
}

function recurringTransactionFor(period: Period, amount: number, date: string): Transaction {
  return {
    id: `recurring-${period.id}`,
    date,
    description: "Recurrentes TDC",
    amount: positiveAmount(amount),
    category: "Recurrente",
    method: "credit",
    periodId: period.id,
    shared: false,
    installments: 1,
    paymentSchedule: [],
  };
}

function recurringTotalsForPeriod(inputState: AppState, period: Period): RecurringPeriodTotals {
  return inputState.recurring.reduce<RecurringPeriodTotals>(
    (totals, item) => {
      const chargeDate = recurringDateForPeriod(period, item);
      if (!chargeDate) return totals;

      const amount = positiveAmount(item.amount);
      if (item.method === "credit") {
        totals.credit += amount;
        totals.firstCreditDate ||= chargeDate;
      } else {
        totals.debit += amount;
      }

      return totals;
    },
    { debit: 0, credit: 0, firstCreditDate: null },
  );
}

function buildRecurringEffects(inputState: AppState): Map<string, RecurringEffects> {
  const effects = new Map<string, RecurringEffects>();

  for (const period of inputState.periods) {
    const totals = recurringTotalsForPeriod(inputState, period);
    const missingDebit = positiveAmount(totals.debit - positiveAmount(-period.debitServices));
    const missingCredit = positiveAmount(totals.credit - positiveAmount(period.chatGptCredit));

    if (missingDebit > 0) {
      recurringEffectsFor(effects, period.id).debitServices -= missingDebit;
    }

    if (missingCredit > 0 && totals.firstCreditDate) {
      recurringEffectsFor(effects, period.id).creditCharges += missingCredit;
      const schedule = buildPaymentScheduleFor(inputState, recurringTransactionFor(period, missingCredit, totals.firstCreditDate));
      for (const payment of schedule) {
        recurringEffectsFor(effects, payment.periodId).cardPayment -= payment.amount;
      }
    }
  }

  return effects;
}

function periodStartDate(period: Period): string | null {
  const parts = periodDateParts(period);
  if (!parts) return null;
  return dateForDay(parts.year, parts.month, parts.half === 1 ? 1 : 16);
}

function creditTransactionsThrough(inputState: AppState, asOf = defaultToday): Transaction[] {
  return inputState.transactions.filter(
    (transaction) => transaction.method === "credit" && (!transaction.date || transaction.date <= asOf),
  );
}

function cardPaymentTransactionsThrough(inputState: AppState, asOf = defaultToday): Transaction[] {
  return inputState.transactions.filter(
    (transaction) => transaction.method === "card_payment" && (!transaction.date || transaction.date <= asOf),
  );
}

function cardPaymentsByPeriod(inputState: AppState, asOf = defaultToday): Map<string, number> {
  const paid = new Map<string, number>();
  for (const transaction of cardPaymentTransactionsThrough(inputState, asOf)) {
    paid.set(transaction.periodId, (paid.get(transaction.periodId) || 0) + positiveAmount(transaction.amount));
  }
  return paid;
}

function creditActivityThrough(
  inputState: AppState,
  periods: Array<Period | CalculatedPeriod>,
  asOf = defaultToday,
): number {
  const transactions = creditTransactionsThrough(inputState, asOf);
  const transactionTotal = sum(transactions, (transaction) => positiveAmount(transaction.amount));
  const transactionsByPeriod = new Map<string, number>();
  for (const transaction of transactions) {
    transactionsByPeriod.set(
      transaction.periodId,
      (transactionsByPeriod.get(transaction.periodId) || 0) + positiveAmount(transaction.amount),
    );
  }

  const unrecordedPeriodCharges = sum(periods, (period) => {
    const startDate = periodStartDate(period);
    if (!startDate || startDate > asOf) return 0;
    const periodCreditCharges =
      "creditCharges" in period
        ? positiveAmount(period.creditCharges)
        : positiveAmount(period.foodCredit) + positiveAmount(period.chatGptCredit);
    return positiveAmount(periodCreditCharges - (transactionsByPeriod.get(period.id) || 0));
  });

  return transactionTotal + unrecordedPeriodCharges;
}

function calculatedUsedCreditBalance(
  inputState: AppState,
  periods: Array<Period | CalculatedPeriod> = inputState.periods,
  asOf = defaultToday,
): number {
  const settingsBase = baseSettingsBalance(inputState.settings);
  const activity = creditActivityThrough(inputState, periods, asOf);
  const uncoveredActivity = positiveAmount(activity - legacyPurchaseCoverage(inputState.settings));
  const cardPayments = sum(cardPaymentTransactionsThrough(inputState, asOf), (transaction) =>
    positiveAmount(transaction.amount),
  );
  return positiveAmount(settingsBase + uncoveredActivity - cardPayments);
}

function normalizeRecurringItems(input: unknown): AppState["recurring"] {
  if (!Array.isArray(input)) return [];

  return input.map((item, index) => {
    const recurring = item as Partial<AppState["recurring"][number]>;
    return {
      id: typeof recurring.id === "string" && recurring.id.trim() ? recurring.id : localId("recurring", index),
      name: String(recurring.name || `Recurrente ${index + 1}`),
      amount: asNumber(recurring.amount),
      day: Math.min(31, Math.max(1, asNumber(recurring.day, 1))),
      method: recurring.method === "credit" ? "credit" : "debit",
      active: typeof recurring.active === "boolean" ? recurring.active : true,
    };
  });
}

export function materializeDueRecurringTransactions(
  inputState: AppState,
  asOf = defaultToday,
): { state: AppState; added: Transaction[] } {
  const since = inputState.recurringLastAppliedDate || addDays(asOf, -1);
  const added: Transaction[] = [];
  let nextState: AppState = {
    ...inputState,
    transactions: [...inputState.transactions],
    recurringLastAppliedDate: asOf,
  };
  const existingKeys = new Set(
    inputState.transactions
      .filter((transaction) => transaction.sourceRecurringId && transaction.recurringDate)
      .map((transaction) => `${transaction.sourceRecurringId}:${transaction.recurringDate}`),
  );

  for (const item of inputState.recurring) {
    if (!item.active || positiveAmount(item.amount) <= 0) continue;

    for (const period of inputState.periods) {
      const recurringDate = recurringDateForPeriod(period, item);
      if (!recurringDate || recurringDate <= since || recurringDate > asOf) continue;

      const key = `${item.id}:${recurringDate}`;
      if (existingKeys.has(key)) continue;

      const transactionBase: Transaction = {
        id: localId("recurring-transaction", added.length),
        date: recurringDate,
        description: item.name,
        amount: positiveAmount(item.amount),
        category: "Recurrente",
        method: item.method === "credit" ? "credit" : "cash",
        periodId: period.id,
        shared: false,
        installments: 1,
        sourceRecurringId: item.id,
        recurringDate,
        skipPlanImpact: true,
      };
      const transaction = {
        ...transactionBase,
        paymentSchedule: buildPaymentScheduleFor(nextState, transactionBase),
      };

      nextState = applyTransactionToState(
        {
          ...nextState,
          transactions: [...nextState.transactions, transaction],
        },
        transaction,
        1,
      );
      existingKeys.add(key);
      added.push(transaction);
    }
  }

  return { state: nextState, added };
}

export function normalizeState(input?: Partial<AppState> | null): AppState {
  const inputSettings = input?.settings || {};
  const settings = { ...seedState.settings, ...inputSettings };
  const normalized = {
    ...structuredClone(seedState),
    ...input,
    settings,
    periods: Array.isArray(input?.periods) ? input.periods : structuredClone(seedState.periods),
    recurring: normalizeRecurringItems(input?.recurring),
    transactions: Array.isArray(input?.transactions) ? input.transactions : [],
    cardCalendar: Array.isArray(input?.cardCalendar)
      ? input.cardCalendar
      : structuredClone(seedState.cardCalendar),
    sync: { ...seedState.sync, ...(input?.sync || {}) },
  } as AppState;

  const autoUsedBalance = calculatedUsedCreditBalance(normalized, calculatePeriodsFor(normalized));
  const currentUsedBalance = positiveAmount(settings.usedCreditBalance);
  const shouldSeedUsedBalance =
    !("usedCreditBalance" in inputSettings) ||
    (currentUsedBalance === 0 && autoUsedBalance > 0) ||
    isStaleSeededUsedBalance(settings, currentUsedBalance, autoUsedBalance);

  if (shouldSeedUsedBalance) {
    normalized.settings.usedCreditBalance = autoUsedBalance;
  }

  return normalized;
}

export function calculatePeriodsFor(inputState: AppState): CalculatedPeriod[] {
  let running = inputState.settings.currentSavings;
  const recurringEffects = buildRecurringEffects(inputState);
  return inputState.periods.map((period, index) => {
    const recurring = recurringEffects.get(period.id) || emptyRecurringEffects();
    const income = period.salary + period.extraIncome + period.partnerIncome;
    const cashExpenses = period.rent + period.debitServices + recurring.debitServices;
    const cardPayment = period.cardPayment + recurring.cardPayment;
    const flow = index === 0 ? 0 : income + cashExpenses + cardPayment;
    running = index === 0 ? inputState.settings.currentSavings : running + flow;
    const creditCharges = period.foodCredit + period.chatGptCredit + recurring.creditCharges;
    return {
      ...period,
      income,
      cashExpenses,
      cardPayment,
      flow,
      creditCharges,
      savings: running,
    };
  });
}

export function calculateMonthlyFor(
  inputState: AppState,
  periods: CalculatedPeriod[] = calculatePeriodsFor(inputState),
): MonthlyReport[] {
  const order = ["Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre"];
  return order.map((month) => {
    const monthPeriods = periods.filter((period) => period.month === month);
    const card = inputState.cardCalendar.find((entry) => entry.month === month);
    return {
      month,
      income: sum(monthPeriods, (period) => period.income),
      cashExpenses: sum(monthPeriods, (period) => period.cashExpenses),
      cardPayment:
        month === "Junio"
          ? -inputState.settings.previousCardPayment
          : sum(monthPeriods, (period) => period.cardPayment),
      flow: sum(monthPeriods, (period) => period.flow),
      savings: monthPeriods.at(-1)?.savings ?? inputState.settings.currentSavings,
      creditCharges:
        sum(monthPeriods, (period) => period.creditCharges) +
        (month === "Junio" ? inputState.settings.newJulyPurchases : 0),
      cardTotal: card?.total ?? Math.abs(sum(monthPeriods, (period) => period.cardPayment)),
    };
  });
}

function scheduledAmountFor(transaction: Transaction): number {
  return sum(transaction.paymentSchedule || [], (payment) => positiveAmount(payment.amount));
}

export function calculateCardDebtFor(
  inputState: AppState,
  periods: CalculatedPeriod[] = calculatePeriodsFor(inputState),
): CardDebtSummary {
  const creditTransactions = inputState.transactions.filter((transaction) => transaction.method === "credit");
  const paidByPeriod = cardPaymentsByPeriod(inputState);
  const unpaidCardPaymentFor = (period: CalculatedPeriod) =>
    positiveAmount(positiveAmount(-period.cardPayment) - (paidByPeriod.get(period.id) || 0));
  const scheduledPayments = sum(periods, unpaidCardPaymentFor);
  const scheduledFromTransactions = sum(creditTransactions, scheduledAmountFor);
  const creditPurchases = sum(creditTransactions, (transaction) => positiveAmount(transaction.amount));
  const calendarBalance = sum(inputState.cardCalendar, (entry) => positiveAmount(entry.debt));
  const settingsBalance = baseSettingsBalance(inputState.settings);
  const usedCreditBalance = positiveAmount(inputState.settings.usedCreditBalance);
  const nextPayment = periods.map(unpaidCardPaymentFor).find((payment) => payment > 0) || 0;
  const calculatedBalance = calculatedUsedCreditBalance(inputState, periods);
  const trackedBalance = isStaleSeededUsedBalance(inputState.settings, usedCreditBalance, calculatedBalance)
    ? calculatedBalance
    : usedCreditBalance || calculatedBalance;
  const totalDebt =
    trackedBalance ||
    Math.max(scheduledFromTransactions, calendarBalance, nextPayment);

  return {
    nextPayment,
    installmentBalance: positiveAmount(totalDebt - nextPayment),
    scheduledPayments,
    calendarBalance,
    settingsBalance: trackedBalance || settingsBalance,
    creditPurchases,
    totalDebt,
  };
}

function isCardPaymentPeriod(period: Period): boolean {
  return period.label.toLowerCase().startsWith("2a ");
}

export function buildPaymentScheduleFor(inputState: AppState, transaction: Transaction): PaymentScheduleItem[] {
  if (transaction.method !== "credit") return [];
  const selectedIndex = inputState.periods.findIndex((period) => period.id === transaction.periodId);
  if (selectedIndex < 0) return [];
  const paymentPeriods = inputState.periods.slice(selectedIndex + 1).filter(isCardPaymentPeriod);
  const installmentCount = Math.max(1, asNumber(transaction.installments, 1));
  const usablePeriods = paymentPeriods.slice(0, installmentCount);
  if (!usablePeriods.length) return [];

  const amount = asNumber(transaction.amount);
  const baseInstallment = Math.floor((amount / installmentCount) * 100) / 100;
  let assigned = 0;
  return usablePeriods.map((period, index) => {
    const isLastScheduled = index === usablePeriods.length - 1;
    const installmentAmount = isLastScheduled ? Math.round((amount - assigned) * 100) / 100 : baseInstallment;
    assigned += installmentAmount;
    return {
      periodId: period.id,
      amount: installmentAmount,
    };
  });
}

export function applyTransactionToPeriods(periods: Period[], transaction: Transaction, direction = 1): Period[] {
  if (transaction.skipPlanImpact) return periods;

  const next = periods.map((period) => ({ ...period }));
  const period = next.find((entry) => entry.id === transaction.periodId);
  if (!period) return next;

  const amount = asNumber(transaction.amount);
  const sharedIncome = transaction.method !== "card_payment" && transaction.shared ? amount / 2 : 0;
  const creditPayment = transaction.method === "credit" ? 0 : -amount;

  if (transaction.method === "credit") {
    period.foodCredit += direction * amount;
    const schedule = transaction.paymentSchedule || [];
    for (const payment of schedule) {
      const paymentPeriod = next.find((entry) => entry.id === payment.periodId);
      if (paymentPeriod) paymentPeriod.cardPayment -= direction * payment.amount;
    }
  } else if (transaction.method === "cash") {
    period.debitServices += direction * creditPayment;
  }

  period.partnerIncome += direction * sharedIncome;
  return next;
}

export function applyTransactionToState(inputState: AppState, transaction: Transaction, direction = 1): AppState {
  const selectedIndex = inputState.periods.findIndex((period) => period.id === transaction.periodId);
  const settings = { ...inputState.settings };
  const amount = positiveAmount(transaction.amount);

  if (transaction.method === "credit") {
    const autoBalance = calculatedUsedCreditBalance(inputState);
    const storedBalance = positiveAmount(settings.usedCreditBalance);
    const currentBalance = isStaleSeededUsedBalance(settings, storedBalance, autoBalance)
      ? autoBalance
      : storedBalance || autoBalance || baseSettingsBalance(settings);
    settings.usedCreditBalance = positiveAmount(currentBalance + direction * amount);
  }

  if (transaction.method === "card_payment") {
    const autoBalance = calculatedUsedCreditBalance(inputState);
    const storedBalance = positiveAmount(settings.usedCreditBalance);
    const currentBalance = isStaleSeededUsedBalance(settings, storedBalance, autoBalance)
      ? autoBalance
      : storedBalance || autoBalance;
    settings.usedCreditBalance = positiveAmount(currentBalance - direction * amount);
  }

  if (transaction.method === "cash" && !transaction.skipPlanImpact && selectedIndex === 0) {
    const userShare = transaction.shared ? amount / 2 : amount;
    settings.currentSavings -= direction * userShare;
  }

  return {
    ...inputState,
    settings,
    periods: applyTransactionToPeriods(inputState.periods, transaction, direction),
  };
}
