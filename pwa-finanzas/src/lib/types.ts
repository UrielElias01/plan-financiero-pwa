export type Settings = {
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
  chatGptCredit: number;
  cardPayment: number;
  lockedBase?: boolean;
  closedAt?: string;
  appliedIncome?: number;
  appliedRentReserve?: number;
};

export type RecurringItem = {
  id: string;
  name: string;
  amount: number;
  day: number;
  method: "debit" | "credit";
  active: boolean;
};

export type PaymentScheduleItem = {
  periodId: string;
  amount: number;
};

export type Transaction = {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  method: "credit" | "cash" | "card_payment";
  periodId: string;
  shared: boolean;
  installments: number;
  paymentSchedule?: PaymentScheduleItem[];
  sourceRecurringId?: string;
  recurringDate?: string;
  skipPlanImpact?: boolean;
};

export type CardCalendarEntry = {
  month: string;
  total: number;
  userPart: number;
  debt: number;
};

export type CardDebtSummary = {
  nextPayment: number;
  installmentBalance: number;
  scheduledPayments: number;
  calendarBalance: number;
  settingsBalance: number;
  creditPurchases: number;
  totalDebt: number;
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
  cardCalendar: CardCalendarEntry[];
  sync: SyncSettings;
  recurringLastAppliedDate?: string;
};

export type CalculatedPeriod = Period & {
  income: number;
  cashExpenses: number;
  flow: number;
  creditCharges: number;
  savings: number;
};

export type MonthlyReport = {
  month: string;
  income: number;
  cashExpenses: number;
  cardPayment: number;
  flow: number;
  savings: number;
  creditCharges: number;
  cardTotal: number;
};

export type ViewId = "dashboard" | "periods" | "transactions" | "recurring" | "card" | "reports" | "settings" | "guide";
