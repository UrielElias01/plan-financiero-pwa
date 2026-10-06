import {
  budgetDateFor, cardPaymentObligationsFor, dateForDay, isConfirmedTransaction, latestStatementFor, liquidityTimelineFor, monthAfter, monthLabel,
  normalizeCategory, paydayForPeriod, recurringOccurrencesFor, toCents, transactionUserAmount,
} from "./calculations";
import { today as defaultToday } from "./seed";
import type { AppState, Transaction } from "./types";

/** Answers "can I pay my card on its due date?" from the same forecast the rest of the app uses. */

export const EXPENSE_CATEGORIES = ["Mandado", "Comida fuera", "Transporte", "Suscripciones", "Compras", "Salud", "Hogar", "Servicios", "Entretenimiento", "Mascotas", "Renta", "Otro"];
export const INCOME_CATEGORIES = ["Ingreso extra", "Reembolso", "Venta", "Otro ingreso"];

const RULES: Array<[RegExp, string]> = [
  [/uber ?eats|rappi|didi ?food|restaurant|starbucks|burger|domino|mcdonald|little caesars|sushi|pizza/i, "Comida fuera"],
  [/spotify|netflix|hbo|openai|chatgpt|anthropic|claude|google|apple\.com|icloud|youtube|disney|prime video|amazon prime|f1 ?tv|crunchyroll|paramount|vix|xbox|playstation|steam/i, "Suscripciones"],
  [/uber|didi|cabify|autobus|gasolin|pemex|estacionamiento|caseta/i, "Transporte"],
  [/chedraui|soriana|walmart|aurrera|fresko|la comer|sams|costco|\bheb\b|superama|city market|oxxo|7-eleven|abarrot/i, "Mandado"],
  [/farmacia|similares|benavides|hospital|laboratorio|dental|medic/i, "Salud"],
  [/\bcfe\b|telmex|izzi|totalplay|megacable|telcel|at&t|movistar/i, "Servicios"],
  [/coppel|liverpool|amazon|mercado ?libre|miniso|shein|elektra|sears|palacio de hierro|best buy|home depot/i, "Compras"],
  [/cinepolis|cinemex|ticketmaster/i, "Entretenimiento"],
];
/** Best-effort category from a bank description. The user can always change it. */
export function categorize(description: string): string {
  return RULES.find(([pattern]) => pattern.test(description))?.[1] || "Otro";
}

const pesos = (cents: number) => cents / 100;
const sumCents = <T,>(items: T[], selector: (item: T) => number) => items.reduce((total, item) => total + toCents(selector(item)), 0);

export type OutlookLine = { date: string; label: string; amount: number; estimated: boolean };
export type DueItemKind = "statement" | "installments" | "subscriptions" | "budgets" | "purchases" | "carried" | "interest";
export type DueItem = { kind: DueItemKind; label: string; amount: number; estimated: boolean; count: number };
export type DueOutlook = {
  dueDate: string;
  /** Amount comes from an imported statement (not an estimate). */
  isStatement: boolean;
  /** The bank's due date already passed and something is still unpaid. */
  overdue: boolean;
  required: number;
  estimated: boolean;
  items: DueItem[];
  minimum?: number;
  minimumPlusInstallments?: number;
  paidSoFar?: number;
  startCash: number;
  inflows: OutlookLine[];
  outflows: OutlookLine[];
  /** Money available right before paying (can be negative if expenses alone exceed it). */
  available: number;
  payable: number;
  shortfall: number;
  leftover: number;
  /** Interest estimated on the shortfall for the next cycle, when the statement has a rate. */
  interestOnShortfall?: number;
};

const ITEM_LABELS: Record<DueItemKind, string> = {
  statement: "Pago para no generar intereses", installments: "Mensualidades a meses", subscriptions: "Suscripciones",
  budgets: "Gasto con tarjeta (presupuesto)", purchases: "Compras ya registradas", carried: "Lo que no se cubrió el pago anterior", interest: "Intereses estimados",
};

function itemKind(id: string, statementId?: string): DueItemKind {
  if (statementId && id === `statement:${statementId}:1`) return "statement";
  if (id.startsWith("opening-card-debt")) return "statement";
  if (id.startsWith("statement:")) return "installments";
  if (id.startsWith("recurring:")) return "subscriptions";
  if (id.startsWith("budget:")) return "budgets";
  return "purchases";
}

/** Monthly interest estimate: annual rate/360 × 30 days, plus 16% VAT. Informative only. */
export function estimateInterest(unpaid: number, annualRate?: number): number | undefined {
  if (!annualRate || unpaid <= 0) return annualRate ? 0 : undefined;
  return pesos(Math.round(toCents(unpaid) * (annualRate / 100) * (30 / 360) * 1.16));
}

/**
 * Walks the cash forecast due date by due date. On each date it pays what it can; the unpaid rest
 * (plus estimated interest) moves to the next due date, the way a card balance rolls over.
 */
export function cardOutlookFor(state: AppState, asOf = defaultToday, limit = 4): DueOutlook[] {
  const statement = latestStatementFor(state, asOf);
  const obligations = cardPaymentObligationsFor(state, asOf).map((item) => ({ ...item, due: item.date < asOf ? asOf : item.date }));
  const lastOpen = state.periods.filter((period) => !period.closedAt).at(-1);
  const horizon = (lastOpen && paydayForPeriod(lastOpen)) || asOf;
  const dueDates = [...new Set(obligations.map((item) => item.due))].sort().filter((date, index) => index === 0 || date <= horizon).slice(0, limit);
  const timeline = liquidityTimelineFor(state, asOf).filter((event) => event.kind !== "card_payment");
  const rentOnly = !((state.settings.monthlyFood || 0) > 0);
  let cash = toCents(state.settings.currentSavings);
  let carried = 0; let interest = 0;
  let previous = "";
  return dueDates.map((due) => {
    const startCash = cash;
    const window = timeline.filter((event) => event.date <= due && (!previous || event.date > previous));
    const inflows: OutlookLine[] = []; const outflows: OutlookLine[] = [];
    for (const event of window) {
      if (event.kind === "salary" || event.kind === "income") {
        inflows.push({ date: event.date, label: event.label, amount: event.gross, estimated: event.estimated });
        if (event.reserved > 0) outflows.push({ date: event.date, label: rentOnly ? "Se aparta para la renta" : "Se aparta para renta y comida", amount: event.reserved, estimated: event.estimated });
      } else outflows.push({ date: event.date, label: event.label, amount: -event.amount, estimated: event.estimated });
      cash += toCents(event.amount);
    }
    const dueItems = obligations.filter((item) => item.due === due);
    const groups = new Map<DueItemKind, DueItem>();
    for (const item of dueItems) {
      const kind = itemKind(item.id, statement?.id);
      const group = groups.get(kind) || { kind, label: kind === "purchases" && dueItems.filter((entry) => itemKind(entry.id, statement?.id) === "purchases").length === 1 ? item.description : ITEM_LABELS[kind], amount: 0, estimated: false, count: 0 };
      group.amount = pesos(toCents(group.amount) + toCents(item.amount)); group.estimated ||= item.estimated; group.count += 1;
      groups.set(kind, group);
    }
    if (carried) groups.set("carried", { kind: "carried", label: ITEM_LABELS.carried, amount: pesos(carried), estimated: true, count: 1 });
    if (interest) groups.set("interest", { kind: "interest", label: ITEM_LABELS.interest, amount: pesos(interest), estimated: true, count: 1 });
    const order: DueItemKind[] = ["carried", "interest", "statement", "installments", "purchases", "subscriptions", "budgets"];
    const items = order.map((kind) => groups.get(kind)).filter((item): item is DueItem => Boolean(item));
    const required = sumCents(dueItems, (item) => item.amount) + carried + interest;
    const payable = Math.max(0, Math.min(cash, required));
    const shortfall = required - payable;
    const available = cash;
    cash -= payable;
    const isStatement = Boolean(statement && (due === statement.dueDate || (statement.dueDate < asOf && due === asOf)) && groups.has("statement"));
    const statementRemaining = statement ? toCents(dueItems.find((item) => item.id === `statement:${statement.id}:1`)?.amount || 0) : 0;
    const paidSoFar = statement && isStatement ? toCents(statement.paymentToAvoidInterest) - statementRemaining : 0;
    const nextInterest = estimateInterest(pesos(shortfall), statement?.annualInterestRate);
    const result: DueOutlook = {
      dueDate: due, isStatement, overdue: Boolean(statement && isStatement && statement.dueDate < asOf),
      required: pesos(required), estimated: items.some((item) => item.estimated), items,
      startCash: pesos(startCash), inflows, outflows, available: pesos(available), payable: pesos(payable), shortfall: pesos(shortfall), leftover: pesos(cash),
      ...(statement && isStatement ? {
        paidSoFar: pesos(paidSoFar),
        minimum: pesos(Math.max(0, toCents(statement.minimumPayment) - paidSoFar)),
        ...(statement.minimumPlusInstallments !== undefined ? { minimumPlusInstallments: pesos(Math.max(0, toCents(statement.minimumPlusInstallments) - paidSoFar)) } : {}),
      } : {}),
      ...(nextInterest !== undefined ? { interestOnShortfall: nextInterest } : {}),
    };
    carried = shortfall; interest = toCents(nextInterest || 0);
    previous = due;
    return result;
  });
}

export type CategorySpend = { category: string; spent: number; budget: number; card: number; debit: number };
export type MonthSummary = {
  month: string;
  label: string;
  income: { received: number; expected: number };
  spending: { total: number; card: number; debit: number; byCategory: CategorySpend[] };
  cardPayments: number;
  budgetTotal: number;
};

function isPayrollCategory(category: string): boolean { return normalizeCategory(category) === "nomina"; }
/** Spending of a month by the month it counts for (`budgetMonth`), so the summary matches the budgets. */
function spendingTransactions(state: AppState, month: string, asOf: string): Transaction[] {
  return state.transactions.filter((transaction) => budgetDateFor(state, transaction).slice(0, 7) === month && isConfirmedTransaction(transaction, asOf) && (transaction.method === "credit" || (transaction.method === "cash" && transaction.affectsSavings !== false)));
}

/** What came in and what went out in a calendar month, by category and against each budget. */
export function monthSummaryFor(state: AppState, month = defaultToday.slice(0, 7), asOf = defaultToday): MonthSummary {
  const confirmed = state.transactions.filter((transaction) => transaction.date.slice(0, 7) === month && isConfirmedTransaction(transaction, asOf));
  const received = sumCents(confirmed.filter((transaction) => transaction.method === "income"), transactionUserAmount);
  const expected = month >= asOf.slice(0, 7) ? sumCents(liquidityTimelineFor(state, asOf).filter((event) => (event.kind === "salary" || event.kind === "income") && event.date.slice(0, 7) === month), (event) => event.gross) : 0;
  const spent = spendingTransactions(state, month, asOf);
  const categories = new Map<string, CategorySpend>();
  const key = (category: string) => { const normalized = normalizeCategory(category || "Otro"); return normalized === "comida" ? "mandado" : normalized; };
  for (const budget of state.settings.budgets || []) categories.set(key(budget.category), { category: budget.category, spent: 0, budget: budget.monthlyAmount, card: 0, debit: 0 });
  for (const transaction of spent) {
    const entry = categories.get(key(transaction.category)) || { category: transaction.category || "Otro", spent: 0, budget: 0, card: 0, debit: 0 };
    const cents = toCents(transactionUserAmount(transaction));
    entry.spent = pesos(toCents(entry.spent) + cents);
    if (transaction.method === "credit") entry.card = pesos(toCents(entry.card) + cents); else entry.debit = pesos(toCents(entry.debit) + cents);
    categories.set(key(transaction.category), entry);
  }
  const byCategory = [...categories.values()].sort((a, b) => b.spent - a.spent || b.budget - a.budget);
  return {
    month, label: monthLabel(month),
    income: { received: pesos(received), expected: pesos(expected) },
    spending: { total: pesos(sumCents(spent, transactionUserAmount)), card: pesos(sumCents(spent.filter((item) => item.method === "credit"), transactionUserAmount)), debit: pesos(sumCents(spent.filter((item) => item.method === "cash"), transactionUserAmount)), byCategory },
    cardPayments: pesos(sumCents(confirmed.filter((transaction) => transaction.method === "card_payment"), transactionUserAmount)),
    budgetTotal: pesos(sumCents(state.settings.budgets || [], (budget) => budget.monthlyAmount)),
  };
}

export type PendingTask =
  | { kind: "payroll"; id: string; date: string; amount: number; label: string }
  | { kind: "subscription"; id: string; date: string; amount: number; label: string; transaction: Transaction }
  | { kind: "planned"; id: string; date: string; amount: number; label: string; transaction: Transaction }
  | { kind: "statement"; id: string; date: string; label: string }
  | { kind: "card-payment"; id: string; date: string; amount: number; label: string };

/** Things only the user can confirm. Nothing here changes data until they act on it. */
export function pendingTasksFor(state: AppState, asOf = defaultToday): PendingTask[] {
  const tasks: PendingTask[] = [];
  const { settings } = state;
  if (settings.salary > 0) for (const period of state.periods) {
    const payday = paydayForPeriod(period);
    if (!payday || period.closedAt || payday > asOf || payday < (settings.nextPayday || asOf) || payday < (settings.balanceAsOf || asOf)) continue;
    if (state.transactions.some((entry) => entry.periodId === period.id && entry.method === "income" && isPayrollCategory(entry.category))) continue;
    tasks.push({ kind: "payroll", id: `payroll:${period.id}`, date: payday, amount: settings.salary, label: `¿Ya recibiste tu nómina del ${payday}?` });
  }
  for (const item of recurringOccurrencesFor(state, asOf)) if (item.recurring.method === "debit") tasks.push({ kind: "subscription", id: item.transaction.id, date: item.date, amount: item.transaction.amount, label: `¿Ya se cobró ${item.recurring.name}?`, transaction: item.transaction });
  for (const transaction of state.transactions) if (transaction.status === "planned" && transaction.date <= asOf) tasks.push({ kind: "planned", id: transaction.id, date: transaction.date, amount: transaction.amount, label: `¿Ya se realizó «${transaction.description}»?`, transaction });
  const statement = latestStatementFor(state, asOf);
  const thisCut = dateForDay(asOf.slice(0, 7), settings.cutoffDay);
  const lastCut = thisCut <= asOf ? thisCut : dateForDay(monthAfter(asOf.slice(0, 7), -1), settings.cutoffDay);
  // The bank usually publishes the statement a day after the cut-off.
  if (statement && statement.cutoffDate < lastCut && asOf > lastCut) tasks.push({ kind: "statement", id: `statement:${lastCut}`, date: lastCut, label: `Tu tarjeta cortó el ${lastCut}. Importa el estado de cuenta para actualizar el pago.` });
  if (statement) {
    const pending = cardPaymentObligationsFor(state, asOf).find((item) => item.id === `statement:${statement.id}:1`);
    const days = (Date.parse(`${statement.dueDate}T12:00:00Z`) - Date.parse(`${asOf}T12:00:00Z`)) / 86_400_000;
    if (pending && days <= 5) tasks.push({ kind: "card-payment", id: `pay:${statement.id}`, date: statement.dueDate, amount: pending.amount, label: days < 0 ? `El pago de tu tarjeta venció el ${statement.dueDate}. Si ya pagaste, regístralo.` : `Tu tarjeta vence el ${statement.dueDate}. Cuando pagues, regístralo aquí.` });
  }
  return tasks.sort((a, b) => a.date.localeCompare(b.date));
}
