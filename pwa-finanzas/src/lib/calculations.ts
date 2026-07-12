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

type PeriodMovementTotals = {
  salaryIncome: number;
  extraIncome: number;
  rentReserve: number;
  cashExpenses: number;
  creditCharges: number;
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
        ? "Movimientos del dia 1 al 15."
        : "Movimientos del dia 16 al ultimo dia del mes.",
    salary: 0,
    extraIncome: 0,
    partnerIncome: 0,
    rent: 0,
    debitServices: 0,
    foodCredit: 0,
    otherCredit: 0,
    chatGptCredit: 0,
    cardPayment: 0,
  };
}

export function buildNextPeriodFor(inputState: AppState): Period | null {
  const last = inputState.periods.at(-1);
  const parts = last ? periodDateParts(last) : null;
  return parts ? estimatedPeriodFor(inputState, nextPeriodParts(parts)) : null;
}

function currentOpenPeriodIndex(periods: Period[]): number {
  const todayMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(defaultToday);
  if (todayMatch) {
    const currentId = `${todayMatch[1]}-${todayMatch[2]}-h${asNumber(todayMatch[3]) <= 15 ? 1 : 2}`;
    const datedIndex = periods.findIndex((period) => period.id === currentId && !period.closedAt);
    if (datedIndex >= 0) return datedIndex;
  }
  const firstOpenIndex = periods.findIndex((period) => !period.closedAt);
  return firstOpenIndex === -1 ? periods.length : firstOpenIndex;
}

export function paydayForPeriod(period: Period): string | null {
  const parts = periodDateParts(period);
  if (!parts) return null;
  return parts.half === 1 ? dateForDay(parts.year, parts.month, 15) : dateForDay(parts.year, parts.month, 31);
}

export function duePeriodsFor(inputState: AppState, asOf = defaultToday): Period[] {
  return inputState.periods.filter((period) => {
    const payday = paydayForPeriod(period);
    return Boolean(payday && payday <= asOf && !period.closedAt);
  });
}

export function closePeriodFor(
  inputState: AppState,
  periodId: string,
  closedAt = defaultToday,
): { state: AppState; closed?: Period; nextPeriod?: Period } {
  const period = inputState.periods.find((entry) => entry.id === periodId);
  if (!period || period.closedAt) return { state: inputState };

  const closed: Period = {
    ...period,
    closedAt,
    appliedIncome: undefined,
    appliedRentReserve: undefined,
    closingSavings: inputState.settings.currentSavings,
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
      periods,
    },
    closed,
    nextPeriod: shouldAppendNextPeriod ? nextPeriod || undefined : undefined,
  };
}

export function reopenPeriodFor(inputState: AppState, periodId: string): AppState {
  const period = inputState.periods.find((entry) => entry.id === periodId);
  if (!period?.closedAt) return inputState;

  const reopened: Period = {
    ...period,
    closedAt: undefined,
    closingSavings: undefined,
  };

  return {
    ...inputState,
    periods: inputState.periods.map((entry) => (entry.id === period.id ? reopened : entry)),
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

function buildRecurringEffects(inputState: AppState): Map<string, RecurringEffects> {
  const effects = new Map<string, RecurringEffects>();
  const materialized = new Set(
    inputState.transactions
      .filter((transaction) => transaction.sourceRecurringId && transaction.recurringDate)
      .map((transaction) => `${transaction.sourceRecurringId}:${transaction.recurringDate}`),
  );

  for (const period of inputState.periods) {
    if (period.closedAt) continue;
    for (const item of inputState.recurring) {
      const chargeDate = recurringDateForPeriod(period, item);
      if (!chargeDate || materialized.has(`${item.id}:${chargeDate}`)) continue;
      const amount = positiveAmount(item.amount);

      if (item.method === "debit") {
        recurringEffectsFor(effects, period.id).debitServices -= amount;
      } else {
        recurringEffectsFor(effects, period.id).creditCharges += amount;
        const schedule = buildPaymentScheduleFor(inputState, recurringTransactionFor(period, amount, chargeDate));
        for (const payment of schedule) {
          recurringEffectsFor(effects, payment.periodId).cardPayment -= payment.amount;
        }
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

function creditActivityThrough(inputState: AppState, asOf = defaultToday): number {
  return sum(creditTransactionsThrough(inputState, asOf), (transaction) => positiveAmount(transaction.amount));
}

function calculatedUsedCreditBalance(
  inputState: AppState,
  periods: Array<Period | CalculatedPeriod> = inputState.periods,
  asOf = defaultToday,
): number {
  const settingsBase = baseSettingsBalance(inputState.settings);
  const activity = creditActivityThrough(inputState, asOf);
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

function normalizePeriods(input: unknown): Period[] {
  const source = Array.isArray(input) ? input : structuredClone(seedState.periods);
  return source.map((item) => {
    const period = item as Period;
    return {
      ...period,
      salary: 0,
      extraIncome: 0,
      partnerIncome: 0,
      rent: 0,
      debitServices: 0,
      foodCredit: 0,
      otherCredit: 0,
      chatGptCredit: 0,
      cardPayment: asNumber(period.cardPayment),
    };
  });
}

function normalizeTransactions(input: unknown, legacyState: boolean): Transaction[] {
  if (!Array.isArray(input)) return [];
  return input.map((item, index) => {
    const transaction = item as Partial<Transaction>;
    const method: Transaction["method"] =
      transaction.method === "income" ||
      transaction.method === "credit" ||
      transaction.method === "card_payment"
        ? transaction.method
        : "cash";
    return {
      ...transaction,
      id: typeof transaction.id === "string" && transaction.id ? transaction.id : localId("transaction", index),
      date: String(transaction.date || defaultToday),
      description: String(transaction.description || "Movimiento"),
      amount: positiveAmount(transaction.amount),
      category: String(transaction.category || "Otro"),
      method,
      periodId: String(transaction.periodId || ""),
      shared: Boolean(transaction.shared),
      installments: Math.max(1, asNumber(transaction.installments, 1)),
      affectsSavings:
        typeof transaction.affectsSavings === "boolean"
          ? transaction.affectsSavings
          : legacyState
            ? method === "cash"
            : method === "income" || method === "cash" || method === "card_payment",
      rentReserveAmount: positiveAmount(transaction.rentReserveAmount),
    } as Transaction;
  });
}

function migrateLegacyDebitRecurringImpacts(inputState: AppState): AppState {
  let migrated = inputState;

  for (const transaction of inputState.transactions) {
    if (transaction.method !== "cash" || !transaction.sourceRecurringId || transaction.skipPlanImpact !== true) {
      continue;
    }

    const appliedTransaction: Transaction = { ...transaction, skipPlanImpact: false };
    migrated = applyTransactionToState(
      {
        ...migrated,
        transactions: migrated.transactions.map((entry) =>
          entry.id === transaction.id ? appliedTransaction : entry,
        ),
      },
      appliedTransaction,
      1,
    );
  }

  return migrated;
}

function migrateLegacyCreditRecurringSchedules(inputState: AppState): AppState {
  let migrated = inputState;

  for (const transaction of inputState.transactions) {
    if (transaction.method !== "credit" || !transaction.sourceRecurringId || transaction.skipPlanImpact !== true) {
      continue;
    }
    const appliedTransaction: Transaction = { ...transaction, skipPlanImpact: false };
    migrated = {
      ...migrated,
      transactions: migrated.transactions.map((entry) =>
        entry.id === transaction.id ? appliedTransaction : entry,
      ),
      periods: applyTransactionToPeriods(migrated.periods, appliedTransaction, 1),
    };
  }

  return migrated;
}

type MaterializeRecurringOptions = {
  since?: string;
  recurringIds?: Set<string>;
};

export function materializeDueRecurringTransactions(
  inputState: AppState,
  asOf = defaultToday,
  options: MaterializeRecurringOptions = {},
): { state: AppState; added: Transaction[] } {
  const since = options.since ?? inputState.recurringLastAppliedDate ?? addDays(asOf, -1);
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
    if (options.recurringIds && !options.recurringIds.has(item.id)) continue;
    if (!item.active || positiveAmount(item.amount) <= 0) continue;

    for (const period of inputState.periods) {
      if (period.closedAt) continue;
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
        skipPlanImpact: false,
        affectsSavings: item.method === "debit",
        rentReserveAmount: 0,
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

export function reconcileRecurringTransactions(
  inputState: AppState,
  asOf = defaultToday,
  recurringIds?: string[],
): { state: AppState; added: Transaction[]; removed: Transaction[] } {
  const selectedIds = recurringIds ? new Set(recurringIds) : undefined;
  const recurringById = new Map(inputState.recurring.map((item) => [item.id, item]));
  const removed: Transaction[] = [];
  let nextState = inputState;

  for (const transaction of inputState.transactions) {
    if (!transaction.sourceRecurringId || (selectedIds && !selectedIds.has(transaction.sourceRecurringId))) continue;
    const period = nextState.periods.find((entry) => entry.id === transaction.periodId);
    if (period?.closedAt) continue;
    const item = recurringById.get(transaction.sourceRecurringId);
    const expectedDate = item && period ? recurringDateForPeriod(period, item) : null;
    const expectedMethod = item?.method === "credit" ? "credit" : "cash";
    const matches = Boolean(
      item &&
      expectedDate &&
      transaction.recurringDate === expectedDate &&
      transaction.date === expectedDate &&
      transaction.method === expectedMethod &&
      almostEqual(positiveAmount(transaction.amount), positiveAmount(item.amount)) &&
      transaction.description === item.name,
    );
    if (matches) continue;

    nextState = applyTransactionToState(
      {
        ...nextState,
        transactions: nextState.transactions.filter((entry) => entry.id !== transaction.id),
      },
      transaction,
      -1,
    );
    removed.push(transaction);
  }

  const materialized = materializeDueRecurringTransactions(nextState, asOf, {
    since: selectedIds ? "0000-00-00" : undefined,
    recurringIds: selectedIds,
  });
  return { ...materialized, removed };
}

export function normalizeState(input?: Partial<AppState> | null, asOf = defaultToday): AppState {
  const inputSettings = input?.settings || {};
  const settings = { ...seedState.settings, ...inputSettings };
  const legacyState = asNumber(input?.version, 1) < 2;
  const normalized = {
    ...structuredClone(seedState),
    ...input,
    version: 2,
    settings,
    periods: normalizePeriods(input?.periods),
    recurring: normalizeRecurringItems(input?.recurring),
    transactions: normalizeTransactions(input?.transactions, legacyState),
    cardCalendar: Array.isArray(input?.cardCalendar)
      ? input.cardCalendar
      : structuredClone(seedState.cardCalendar),
    sync: { ...seedState.sync, ...(input?.sync || {}) },
  } as AppState;

  const autoUsedBalance = calculatedUsedCreditBalance(normalized, calculatePeriodsFor(normalized), asOf);
  const currentUsedBalance = positiveAmount(settings.usedCreditBalance);
  const shouldSeedUsedBalance =
    !("usedCreditBalance" in inputSettings) ||
    (currentUsedBalance === 0 && autoUsedBalance > 0) ||
    isStaleSeededUsedBalance(settings, currentUsedBalance, autoUsedBalance);

  if (shouldSeedUsedBalance) {
    normalized.settings.usedCreditBalance = autoUsedBalance;
  }

  return migrateLegacyCreditRecurringSchedules(migrateLegacyDebitRecurringImpacts(normalized));
}

function movementTotalsByPeriod(inputState: AppState): Map<string, PeriodMovementTotals> {
  const totals = new Map<string, PeriodMovementTotals>();
  for (const transaction of inputState.transactions) {
    const current = totals.get(transaction.periodId) || {
      salaryIncome: 0,
      extraIncome: 0,
      rentReserve: 0,
      cashExpenses: 0,
      creditCharges: 0,
    };
    const amount = positiveAmount(transaction.amount);
    if (transaction.method === "income" && transaction.category.trim().toLocaleLowerCase("es-MX") === "nomina") {
      current.salaryIncome += amount;
      current.rentReserve += positiveAmount(transaction.rentReserveAmount);
    } else if (transaction.method === "income") {
      current.extraIncome += amount;
    }
    if (transaction.method === "cash") current.cashExpenses -= amount;
    if (transaction.method === "credit") current.creditCharges += amount;
    totals.set(transaction.periodId, current);
  }
  return totals;
}

export function calculatePeriodsFor(inputState: AppState): CalculatedPeriod[] {
  const currentIndex = currentOpenPeriodIndex(inputState.periods);
  const closedPrefixNet = sum(inputState.periods.slice(0, currentIndex), (period) =>
    asNumber(period.appliedIncome) - asNumber(period.appliedRentReserve),
  );
  let historical = inputState.settings.currentSavings - closedPrefixNet;
  let running = inputState.settings.currentSavings;
  const recurringEffects = buildRecurringEffects(inputState);
  const movementTotals = movementTotalsByPeriod(inputState);
  return inputState.periods.map((period, index) => {
    const recurring = recurringEffects.get(period.id) || emptyRecurringEffects();
    const movements = movementTotals.get(period.id) || {
      salaryIncome: 0,
      extraIncome: 0,
      rentReserve: 0,
      cashExpenses: 0,
      creditCharges: 0,
    };
    const includeRecurringProjection = index > currentIndex && !period.closedAt;
    const projectedSalary = includeRecurringProjection ? positiveAmount(inputState.settings.salary) : 0;
    const salary = movements.salaryIncome || projectedSalary;
    const extraIncome = movements.extraIncome;
    const rent =
      movements.salaryIncome > 0
        ? -Math.min(movements.salaryIncome, movements.rentReserve)
        : projectedSalary > 0
          ? -Math.min(projectedSalary, positiveAmount(inputState.settings.monthlyRent) / 2)
          : 0;
    const recordedOrProjectedIncome = salary + extraIncome;
    const income = recordedOrProjectedIncome || (period.closedAt ? asNumber(period.appliedIncome) : 0);
    const cashExpenses = movements.cashExpenses + rent + (includeRecurringProjection ? recurring.debitServices : 0);
    const cardPayment = period.cardPayment + recurring.cardPayment;
    const flow = index <= currentIndex || period.closedAt ? 0 : income + cashExpenses + cardPayment;
    const savings =
      period.closedAt && typeof period.closingSavings === "number"
        ? period.closingSavings
        : index < currentIndex
          ? historical
          : index === currentIndex
            ? running
            : running + flow;
    if (index < currentIndex) {
      historical += asNumber(period.appliedIncome) - asNumber(period.appliedRentReserve);
    } else {
      running = savings;
    }
    const creditCharges = movements.creditCharges + (includeRecurringProjection ? recurring.creditCharges : 0);
    return {
      ...period,
      salary,
      extraIncome,
      rent,
      salaryProjected: projectedSalary > 0 && movements.salaryIncome <= 0,
      income,
      cashExpenses,
      cardPayment,
      flow,
      creditCharges,
      savings,
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
  asOf = defaultToday,
): CardDebtSummary {
  const creditTransactions = inputState.transactions.filter((transaction) => transaction.method === "credit");
  const paidByPeriod = cardPaymentsByPeriod(inputState, asOf);
  const unpaidCardPaymentFor = (period: CalculatedPeriod) =>
    positiveAmount(positiveAmount(-period.cardPayment) - (paidByPeriod.get(period.id) || 0));
  const scheduledPayments = sum(periods, unpaidCardPaymentFor);
  const scheduledFromTransactions = sum(creditTransactions, scheduledAmountFor);
  const creditPurchases = sum(creditTransactions, (transaction) => positiveAmount(transaction.amount));
  const calendarBalance = sum(inputState.cardCalendar, (entry) => positiveAmount(entry.debt));
  const settingsBalance = baseSettingsBalance(inputState.settings);
  const usedCreditBalance = positiveAmount(inputState.settings.usedCreditBalance);
  const nextPayment = periods.map(unpaidCardPaymentFor).find((payment) => payment > 0) || 0;
  const calculatedBalance = calculatedUsedCreditBalance(inputState, periods, asOf);
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
  return !period.closedAt && period.label.toLowerCase().startsWith("2a ");
}

export function buildPaymentScheduleFor(inputState: AppState, transaction: Transaction): PaymentScheduleItem[] {
  if (transaction.method !== "credit") return [];
  const selectedIndex = inputState.periods.findIndex((period) => period.id === transaction.periodId);
  if (selectedIndex < 0) return [];
  if (inputState.periods[selectedIndex].closedAt) return [];
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(transaction.date || "");
  let paymentStartIndex = selectedIndex + 1;
  if (dateMatch) {
    let paymentYear = asNumber(dateMatch[1]);
    let paymentMonth = asNumber(dateMatch[2]);
    if (asNumber(dateMatch[3]) > Math.min(31, Math.max(1, asNumber(inputState.settings.cutoffDay, 1)))) {
      paymentMonth += 1;
      if (paymentMonth > 12) {
        paymentMonth = 1;
        paymentYear += 1;
      }
    }
    const paymentPeriodId = `${paymentYear}-${padDatePart(paymentMonth)}-h2`;
    const datedIndex = inputState.periods.findIndex((period) => period.id === paymentPeriodId);
    if (datedIndex >= 0) paymentStartIndex = datedIndex;
  }
  const paymentPeriods = inputState.periods.slice(paymentStartIndex).filter(isCardPaymentPeriod);
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

export function periodIdForDate(inputState: AppState, date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return "";
  const half = asNumber(match[3]) <= 15 ? 1 : 2;
  const periodId = `${match[1]}-${match[2]}-h${half}`;
  return inputState.periods.some((period) => period.id === periodId) ? periodId : "";
}

export function applyTransactionToPeriods(periods: Period[], transaction: Transaction, direction = 1): Period[] {
  if (transaction.skipPlanImpact) return periods;

  const next = periods.map((period) => ({ ...period }));
  const period = next.find((entry) => entry.id === transaction.periodId);
  if (!period || period.closedAt) return next;

  if (transaction.method === "credit") {
    const schedule = transaction.paymentSchedule || [];
    for (const payment of schedule) {
      const paymentPeriod = next.find((entry) => entry.id === payment.periodId);
      if (paymentPeriod && !paymentPeriod.closedAt) paymentPeriod.cardPayment -= direction * payment.amount;
    }
  }
  return next;
}

export function applyTransactionToState(inputState: AppState, transaction: Transaction, direction = 1): AppState {
  const selectedIndex = inputState.periods.findIndex((period) => period.id === transaction.periodId);
  if (inputState.periods[selectedIndex]?.closedAt) return inputState;
  const settings = { ...inputState.settings };
  const amount = positiveAmount(transaction.amount);
  const stateBeforeTransaction = {
    ...inputState,
    transactions: inputState.transactions.filter((entry) => entry.id !== transaction.id),
  };

  if (transaction.method === "credit") {
    const autoBalance = calculatedUsedCreditBalance(stateBeforeTransaction);
    const storedBalance = positiveAmount(settings.usedCreditBalance);
    const currentBalance = isStaleSeededUsedBalance(settings, storedBalance, autoBalance)
      ? autoBalance
      : storedBalance || autoBalance || baseSettingsBalance(settings);
    settings.usedCreditBalance = positiveAmount(currentBalance + direction * amount);
  }

  if (transaction.method === "card_payment") {
    const autoBalance = calculatedUsedCreditBalance(stateBeforeTransaction);
    const storedBalance = positiveAmount(settings.usedCreditBalance);
    const currentBalance = isStaleSeededUsedBalance(settings, storedBalance, autoBalance)
      ? autoBalance
      : storedBalance || autoBalance;
    settings.usedCreditBalance = positiveAmount(currentBalance - direction * amount);
  }

  if (transaction.method === "income" && transaction.affectsSavings !== false) {
    const rentReserve = Math.min(amount, positiveAmount(transaction.rentReserveAmount));
    settings.currentSavings += direction * (amount - rentReserve);
    settings.rentReserve = positiveAmount(settings.rentReserve + direction * rentReserve);
  }

  if (transaction.method === "cash" && !transaction.skipPlanImpact && transaction.affectsSavings !== false) {
    const userShare = transaction.shared ? amount / 2 : amount;
    settings.currentSavings -= direction * userShare;
  }

  if (transaction.method === "card_payment" && transaction.affectsSavings !== false) {
    settings.currentSavings -= direction * amount;
  }

  return {
    ...inputState,
    settings,
    periods: applyTransactionToPeriods(inputState.periods, transaction, direction),
  };
}
