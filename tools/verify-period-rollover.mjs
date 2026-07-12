import assert from "node:assert/strict";
import {
  applyTransactionToState,
  buildPaymentScheduleFor,
  calculatePeriodsFor,
  closePeriodFor,
  duePeriodsFor,
  materializeDueRecurringTransactions,
  normalizeState,
  periodIdForDate,
  reconcileRecurringTransactions,
  reopenPeriodFor,
} from "../pwa-finanzas/src/lib/calculations.ts";
import { cloneSeed } from "../pwa-finanzas/src/lib/seed.ts";

const state = cloneSeed();
state.settings.currentSavings = 1000;
state.settings.rentReserve = 0;
state.settings.salary = 5587;
state.settings.monthlyRent = 3500;
state.settings.usedCreditBalance = 1000;
state.periods = [
  {
    ...state.periods[1],
    id: "2026-07-h1",
    month: "Julio",
    label: "1a julio",
    note: "1 al 15",
  },
  {
    ...state.periods[2],
    id: "2026-07-h2",
    month: "Julio",
    label: "2a julio",
    note: "16 al 31",
  },
  {
    ...state.periods[2],
    id: "2026-08-h2",
    month: "Agosto",
    label: "2a agosto",
    note: "16 al 31",
  },
];

assert.equal(periodIdForDate(state, "2026-07-11"), "2026-07-h1");
assert.equal(periodIdForDate(state, "2026-07-25"), "2026-07-h2");

const projectedPeriods = calculatePeriodsFor(state);
assert.equal(projectedPeriods[0].income, 0);
assert.equal(projectedPeriods[1].salary, 5587);
assert.equal(projectedPeriods[1].income, 5587);
assert.equal(projectedPeriods[1].salaryProjected, true);
assert.equal(projectedPeriods[1].rent, -1750);
assert.equal(projectedPeriods[1].flow, 3837);

const payroll = {
  id: "payroll",
  date: "2026-07-11",
  description: "Nomina",
  amount: 8000,
  category: "Nomina",
  method: "income",
  periodId: "2026-07-h1",
  shared: false,
  installments: 1,
  affectsSavings: true,
  rentReserveAmount: 1750,
};
const withPayroll = applyTransactionToState({ ...state, transactions: [payroll] }, payroll, 1);
assert.equal(withPayroll.settings.currentSavings, 7250);
assert.equal(withPayroll.settings.rentReserve, 1750);
assert.equal(calculatePeriodsFor(withPayroll)[0].income, 8000);

const futurePayroll = {
  ...payroll,
  id: "future-payroll",
  date: "2026-07-25",
  periodId: "2026-07-h2",
};
const withFuturePayroll = calculatePeriodsFor({ ...state, transactions: [futurePayroll] });
assert.equal(withFuturePayroll[1].salary, 8000);
assert.equal(withFuturePayroll[1].income, 8000);
assert.equal(withFuturePayroll[1].salaryProjected, false);
assert.equal(withFuturePayroll[1].rent, -1750);
assert.equal(withFuturePayroll[1].flow, 6250);

const futureExtraIncome = {
  ...futurePayroll,
  id: "future-extra",
  description: "Venta",
  amount: 400,
  category: "Ingreso extra",
};
const withFutureExtra = calculatePeriodsFor({ ...state, transactions: [futureExtraIncome] });
assert.equal(withFutureExtra[1].salary, 5587);
assert.equal(withFutureExtra[1].extraIncome, 400);
assert.equal(withFutureExtra[1].income, 5987);
assert.equal(withFutureExtra[1].rent, -1750);
assert.equal(withFutureExtra[1].flow, 4237);

const withoutPayroll = applyTransactionToState({ ...withPayroll, transactions: [] }, payroll, -1);
assert.equal(withoutPayroll.settings.currentSavings, 1000);
assert.equal(withoutPayroll.settings.rentReserve, 0);

const cashExpense = {
  id: "cash",
  date: "2026-07-11",
  description: "Super",
  amount: 200,
  category: "Comida",
  method: "cash",
  periodId: "2026-07-h1",
  shared: false,
  installments: 1,
  affectsSavings: true,
  rentReserveAmount: 0,
};
const withCash = applyTransactionToState({ ...state, transactions: [cashExpense] }, cashExpense, 1);
assert.equal(withCash.settings.currentSavings, 800);
assert.equal(calculatePeriodsFor(withCash)[0].cashExpenses, -200);

const creditPurchase = {
  id: "credit",
  date: "2026-07-01",
  description: "Compra",
  amount: 450,
  category: "Hogar",
  method: "credit",
  periodId: "2026-07-h1",
  shared: false,
  installments: 1,
  affectsSavings: false,
  rentReserveAmount: 0,
};
creditPurchase.paymentSchedule = buildPaymentScheduleFor(state, creditPurchase);
const withCredit = applyTransactionToState({ ...state, transactions: [creditPurchase] }, creditPurchase, 1);
assert.equal(withCredit.settings.currentSavings, 1000);
assert.equal(withCredit.settings.usedCreditBalance, 1450);
assert.equal(calculatePeriodsFor(withCredit)[0].creditCharges, 450);
assert.equal(calculatePeriodsFor(withCredit)[1].cardPayment, -450);

const afterCutoffPurchase = {
  ...creditPurchase,
  id: "after-cutoff",
  date: "2026-07-11",
};
assert.equal(buildPaymentScheduleFor(state, afterCutoffPurchase)[0]?.periodId, "2026-08-h2");

const cardPayment = {
  id: "card-payment",
  date: "2026-07-25",
  description: "Pago TDC",
  amount: 450,
  category: "Pago TDC",
  method: "card_payment",
  periodId: "2026-07-h2",
  shared: false,
  installments: 1,
  affectsSavings: true,
  rentReserveAmount: 0,
};
const afterCardPayment = applyTransactionToState(
  { ...withCredit, transactions: [...withCredit.transactions, cardPayment] },
  cardPayment,
  1,
);
assert.equal(afterCardPayment.settings.currentSavings, 550);
assert.equal(afterCardPayment.settings.usedCreditBalance, 1000);

const due = duePeriodsFor(state, "2026-07-15");
assert.equal(due[0].id, "2026-07-h1");
const closed = closePeriodFor(state, "2026-07-h1", "2026-07-15");
assert.equal(closed.state.settings.currentSavings, 1000);
assert.equal(closed.state.periods[0].closingSavings, 1000);
assert.equal(reopenPeriodFor(closed.state, "2026-07-h1").settings.currentSavings, 1000);

const recurringState = {
  ...withPayroll,
  recurringLastAppliedDate: "2026-07-01",
  recurring: [
    {
      id: "google-one",
      name: "Google One",
      amount: 250,
      day: 2,
      method: "debit",
      active: true,
    },
  ],
};
const charged = materializeDueRecurringTransactions(recurringState, "2026-07-02");
assert.equal(charged.added.length, 1);
assert.equal(charged.state.settings.currentSavings, 7000);

const movedToTomorrow = reconcileRecurringTransactions(
  { ...charged.state, recurring: [{ ...charged.state.recurring[0], day: 3 }] },
  "2026-07-02",
  ["google-one"],
);
assert.equal(movedToTomorrow.removed.length, 1);
assert.equal(movedToTomorrow.added.length, 0);
assert.equal(movedToTomorrow.state.settings.currentSavings, 7250);
assert.equal(calculatePeriodsFor(movedToTomorrow.state)[0].cashExpenses, -1750);

const chargedTomorrow = materializeDueRecurringTransactions(movedToTomorrow.state, "2026-07-03");
assert.equal(chargedTomorrow.added.length, 1);
assert.equal(chargedTomorrow.added[0].date, "2026-07-03");
assert.equal(chargedTomorrow.state.settings.currentSavings, 7000);

const legacy = normalizeState({
  ...state,
  version: 1,
  periods: [{ ...state.periods[0], salary: 8000, partnerIncome: 900, foodCredit: 3400, debitServices: -500 }],
  transactions: [{ ...cardPayment, affectsSavings: undefined }],
});
assert.equal(legacy.version, 2);
assert.equal(legacy.periods[0].salary, 0);
assert.equal(legacy.periods[0].partnerIncome, 0);
assert.equal(legacy.periods[0].foodCredit, 0);
assert.equal(legacy.periods[0].debitServices, 0);
assert.equal(legacy.transactions[0].affectsSavings, false);

console.log("Manual ledger and recurring verification OK");
