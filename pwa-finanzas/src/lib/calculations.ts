import { seedState } from "./seed";
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

function localId(prefix: string, index: number): string {
  return globalThis.crypto?.randomUUID?.() || `${prefix}-${Date.now()}-${index}`;
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

export function normalizeState(input?: Partial<AppState> | null): AppState {
  return {
    ...structuredClone(seedState),
    ...input,
    settings: { ...seedState.settings, ...(input?.settings || {}) },
    periods: Array.isArray(input?.periods) ? input.periods : structuredClone(seedState.periods),
    recurring: normalizeRecurringItems(input?.recurring),
    transactions: Array.isArray(input?.transactions) ? input.transactions : [],
    cardCalendar: Array.isArray(input?.cardCalendar)
      ? input.cardCalendar
      : structuredClone(seedState.cardCalendar),
    sync: { ...seedState.sync, ...(input?.sync || {}) },
  } as AppState;
}

export function calculatePeriodsFor(inputState: AppState): CalculatedPeriod[] {
  let running = inputState.settings.currentSavings;
  return inputState.periods.map((period, index) => {
    const income = period.salary + period.extraIncome + period.partnerIncome;
    const cashExpenses = period.rent + period.debitServices;
    const cardPayment = period.cardPayment;
    const flow = index === 0 ? 0 : income + cashExpenses + cardPayment;
    running = index === 0 ? inputState.settings.currentSavings : running + flow;
    const creditCharges = period.foodCredit + period.chatGptCredit;
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

function positiveAmount(value: unknown): number {
  return Math.max(0, asNumber(value));
}

function scheduledAmountFor(transaction: Transaction): number {
  return sum(transaction.paymentSchedule || [], (payment) => positiveAmount(payment.amount));
}

export function calculateCardDebtFor(
  inputState: AppState,
  periods: CalculatedPeriod[] = calculatePeriodsFor(inputState),
): CardDebtSummary {
  const creditTransactions = inputState.transactions.filter((transaction) => transaction.method === "credit");
  const scheduledPayments = sum(periods, (period) => positiveAmount(-period.cardPayment));
  const creditPurchases = sum(creditTransactions, (transaction) =>
    Math.max(positiveAmount(transaction.amount), scheduledAmountFor(transaction)),
  );
  const calendarBalance = sum(inputState.cardCalendar, (entry) => positiveAmount(entry.total || entry.userPart));
  const settingsBalance = positiveAmount(
    inputState.settings.previousCardDebt -
      inputState.settings.previousCardPayment -
      inputState.settings.pointsPayment +
      inputState.settings.newJulyPurchases,
  );
  const nonRecurringBalance = positiveAmount(inputState.settings.nonRecurringBalance);
  const totalDebt = Math.max(scheduledPayments, calendarBalance, settingsBalance, nonRecurringBalance);
  const nextPayment = positiveAmount(-(periods.find((period) => period.cardPayment < 0)?.cardPayment || 0));

  return {
    nextPayment,
    installmentBalance: positiveAmount(totalDebt - nextPayment),
    scheduledPayments,
    calendarBalance,
    settingsBalance: Math.max(settingsBalance, nonRecurringBalance),
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
  const next = periods.map((period) => ({ ...period }));
  const period = next.find((entry) => entry.id === transaction.periodId);
  if (!period) return next;

  const amount = asNumber(transaction.amount);
  const sharedIncome = transaction.shared ? amount / 2 : 0;
  const creditPayment = transaction.method === "credit" ? 0 : -amount;

  if (transaction.method === "credit") {
    period.foodCredit += direction * amount;
    const schedule = transaction.paymentSchedule || [];
    for (const payment of schedule) {
      const paymentPeriod = next.find((entry) => entry.id === payment.periodId);
      if (paymentPeriod) paymentPeriod.cardPayment -= direction * payment.amount;
    }
  } else {
    period.debitServices += direction * creditPayment;
  }

  period.partnerIncome += direction * sharedIncome;
  return next;
}

export function applyTransactionToState(inputState: AppState, transaction: Transaction, direction = 1): AppState {
  const selectedIndex = inputState.periods.findIndex((period) => period.id === transaction.periodId);
  const settings = { ...inputState.settings };

  if (transaction.method === "cash" && selectedIndex === 0) {
    const amount = asNumber(transaction.amount);
    const userShare = transaction.shared ? amount / 2 : amount;
    settings.currentSavings -= direction * userShare;
  }

  return {
    ...inputState,
    settings,
    periods: applyTransactionToPeriods(inputState.periods, transaction, direction),
  };
}
