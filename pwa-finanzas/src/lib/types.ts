import type { BankStatement } from "./bbva-types";

/** Monthly spending limit for a category. The forecast only projects what is still unspent. */
export type Budget = {
  id: string;
  category: string;
  monthlyAmount: number;
  /** "credit": the remainder is billed in each card cycle. "debit": half is spent each half-month. */
  method: "credit" | "debit";
};

export type Settings = {
  budgets?: Budget[];
  balanceAsOf?: string;
  balanceIncludedTransactionIds?: string[];
  nextPayday?: string;
  monthlyFood?: number;
  foodReserve?: number;
  openingFoodReserve?: number;
  openingSavings?: number;
  openingRentReserve?: number;
  openingCardDebt?: number;
  openingCardPaymentMonth?: string;
  currentSavings: number;
  rentReserve: number;
  salary: number;
  monthlyRent: number;
  defaultFood: number;
  chatGpt: number;
  cutoffDay: number;
  dueDay: number;
  previousCardDebt: number;
  previousCardPayment: number;
  pointsPayment: number;
  newJulyPurchases: number;
  nonRecurringBalance: number;
  usedCreditBalance: number;
};

export type Period = {
  id: string;
  month: string;
  label: string;
  note: string;
  salary: number;
  extraIncome: number;
  partnerIncome: number;
  rent: number;
  debitServices: number;
  foodCredit: number;
  otherCredit: number;
  chatGptCredit: number;
  cardPayment: number;
  lockedBase?: boolean;
  closedAt?: string;
  appliedIncome?: number;
  appliedRentReserve?: number;
  closingSavings?: number;
};

export type RecurringItem = {
  id: string;
  name: string;
  amount: number;
  day: number;
  method: "debit" | "credit";
  active: boolean;
  startsOn?: string;
  endsOn?: string;
  shared?: boolean;
  userAmount?: number;
};

export type PaymentScheduleItem = {
  periodId: string;
  amount: number;
  total?: number;
  userAmount?: number;
  dueDate?: string;
  monthKey?: string;
  installment?: number;
  totalInstallments?: number;
};

export type Transaction = {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  method: "income" | "credit" | "cash" | "card_payment";
  periodId: string;
  shared: boolean;
  installments: number;
  monthlyAmount?: number;
  totalInstallments?: number;
  currentInstallment?: number;
  installmentsAsOf?: string;
  installmentPaymentIds?: string[];
  nextPaymentMonth?: string;
  userAmount?: number;
  paymentForPeriodId?: string;
  paymentSchedule?: PaymentScheduleItem[];
  sourceRecurringId?: string;
  recurringDate?: string;
  skipPlanImpact?: boolean;
  affectsSavings?: boolean;
  rentReserveAmount?: number;
  foodReserveAmount?: number;
  fundingSource?: "savings" | "rent_reserve" | "food_reserve";
  status?: "planned" | "confirmed";
  remainingPrincipalAmount?: number;
  /** Stable identity of an imported row (statement movement or Mandado ticket) to avoid importing it twice. */
  externalId?: string;
  source?: "manual" | "statement" | "mandado";
  /** "AAAA-MM" whose budget this spending counts against, when it differs from the purchase month. */
  budgetMonth?: string;
};

export type CardCalendarEntry = {
  month: string;
  total: number;
  userPart: number;
  debt: number;
  monthKey?: string;
  dueDate?: string;
  paid?: number;
  remaining?: number;
  projected?: number;
  installments?: Array<{ transactionId: string; description: string; installment: number; totalInstallments: number; amount: number; remaining: number }>;
};

export type CardDebtSummary = {
  nextPayment: number;
  installmentBalance: number;
  scheduledPayments: number;
  calendarBalance: number;
  settingsBalance: number;
  creditPurchases: number;
  totalDebt: number;
  creditBalance?: number;
  overdue?: number;
  knownNextPayment?: number;
  nextPaymentIsEstimate?: boolean;
  unallocatedDebt?: number;
  reconciliationWarning?: string;
};

export type SyncSettings = {
  endpoint: string;
  syncId: string;
};

export type AppState = {
  version: number;
  updatedAt: string;
  settings: Settings;
  periods: Period[];
  recurring: RecurringItem[];
  transactions: Transaction[];
  statements?: BankStatement[];
  cardCalendar: CardCalendarEntry[];
  sync: SyncSettings;
  recurringLastAppliedDate?: string;
  migrationWarnings?: string[];
  legacySnapshot?: { cardCalendar: CardCalendarEntry[]; periodPayments: Array<{ periodId: string; amount: number }> };
};

export type CalculatedPeriod = Period & {
  income: number;
  cashExpenses: number;
  flow: number;
  creditCharges: number;
  savings: number;
  salaryProjected?: boolean;
  reserveUsed?: number;
  actualFlow: number;
  projectedFlow: number;
  actualCardPayment: number;
  pendingCardPayment: number;
  actualSavings: number;
  foodReserve?: number;
};

export type MonthlyReport = {
  reserveUsed?: number;
  month: string;
  income: number;
  cashExpenses: number;
  cardPayment: number;
  flow: number;
  savings: number;
  creditCharges: number;
  cardTotal: number;
};

export type ViewId = "home" | "movements" | "card" | "more" | "subscriptions" | "budgets" | "statements" | "mandado" | "settings" | "backup";
