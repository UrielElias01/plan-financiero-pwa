import assert from "node:assert/strict";
import {
  applyTransactionToState,
  buildPaymentScheduleFor,
  calculatePeriodsFor,
  closePeriodFor,
  duePayrollPeriodsFor,
  normalizeState,
  reopenPeriodFor,
} from "../pwa-finanzas/src/lib/calculations.ts";
import { cloneSeed } from "../pwa-finanzas/src/lib/seed.ts";

const state = cloneSeed();
state.settings.currentSavings = 100;
state.settings.rentReserve = 0;
state.settings.salary = 8000;
state.settings.monthlyRent = 3500;
state.settings.defaultFood = 1200;
state.periods = [
  {
    ...state.periods[0],
    id: "2026-06-h2",
    salary: 0,
    extraIncome: 0,
    rent: 0,
    lockedBase: true,
  },
  {
    id: "2026-07-h1",
    month: "Julio",
    label: "1a julio",
    note: "Sueldo del 15.",
    salary: 8000,
    extraIncome: 0,
    partnerIncome: 0,
    rent: -1750,
    debitServices: 0,
    foodCredit: 1200,
    otherCredit: 0,
    chatGptCredit: 0,
    cardPayment: 0,
  },
  {
    id: "2026-07-h2",
    month: "Julio",
    label: "2a julio",
    note: "Sueldo del 15.",
    salary: 8000,
    extraIncome: 0,
    partnerIncome: 0,
    rent: -1750,
    debitServices: 0,
    foodCredit: 1200,
    otherCredit: 0,
    chatGptCredit: 0,
    cardPayment: 0,
  },
];

const due = duePayrollPeriodsFor(state, "2026-06-30");
assert.equal(due.length, 1);
assert.equal(due[0].id, "2026-06-h2");

const result = closePeriodFor(state, "2026-06-h2", "2026-06-30");
assert.equal(result.state.settings.currentSavings, 6350);
assert.equal(result.state.settings.rentReserve, 1750);
assert.equal(result.state.periods.find((period) => period.id === "2026-06-h2")?.salary, 0);
assert.equal(result.state.periods.find((period) => period.id === "2026-06-h2")?.closedAt, "2026-06-30");
assert.equal(result.state.periods.find((period) => period.id === "2026-06-h2")?.appliedIncome, 8000);
assert.equal(result.state.periods.at(-1)?.id, "2026-08-h1");
assert.equal(result.state.periods.at(-1)?.salary, 8000);

const calculated = calculatePeriodsFor(result.state);
assert.equal(calculated.find((period) => period.id === "2026-06-h2")?.savings, 100);
assert.equal(calculated.find((period) => period.id === "2026-07-h1")?.savings, 6350);

const foodTransaction = {
  id: "food-tx",
  date: "2026-07-01",
  description: "Mandado",
  amount: 300,
  category: "Comida",
  method: "credit",
  periodId: "2026-07-h1",
  shared: false,
  installments: 1,
};
const foodState = applyTransactionToState(result.state, foodTransaction, 1);
const foodPeriod = foodState.periods.find((period) => period.id === "2026-07-h1");
assert.equal(foodPeriod?.foodCredit, 1500);
assert.equal(foodPeriod?.otherCredit, 0);

const otherTransaction = {
  ...foodTransaction,
  id: "other-tx",
  description: "Compra nueva",
  amount: 450,
  category: "Electronica",
};
const otherState = applyTransactionToState(foodState, otherTransaction, 1);
const otherPeriod = otherState.periods.find((period) => period.id === "2026-07-h1");
assert.equal(otherPeriod?.foodCredit, 1500);
assert.equal(otherPeriod?.otherCredit, 450);
assert.equal(calculatePeriodsFor(otherState).find((period) => period.id === "2026-07-h1")?.creditCharges, 1950);

const cashTransaction = {
  id: "cash-tx",
  date: "2026-07-01",
  description: "Gasto debito",
  amount: 200,
  category: "Prueba",
  method: "cash",
  periodId: "2026-07-h1",
  shared: false,
  installments: 1,
};
const cashState = applyTransactionToState(result.state, cashTransaction, 1);
assert.equal(cashState.settings.currentSavings, 6150);
const cashDeletedState = applyTransactionToState(cashState, cashTransaction, -1);
assert.equal(cashDeletedState.settings.currentSavings, 6350);

const manualCardState = {
  ...result.state,
  settings: { ...result.state.settings, usedCreditBalance: 1000 },
};
const manualCreditState = applyTransactionToState(manualCardState, otherTransaction, 1);
assert.equal(manualCreditState.settings.usedCreditBalance, 1450);
const manualCreditDeletedState = applyTransactionToState(manualCreditState, otherTransaction, -1);
assert.equal(manualCreditDeletedState.settings.usedCreditBalance, 1000);

const legacyPeriod = { ...state.periods[1], foodCredit: 5055 };
delete legacyPeriod.otherCredit;
const migrated = normalizeState({
  ...state,
  settings: { ...state.settings, defaultFood: 1700 },
  periods: [legacyPeriod],
});
assert.equal(migrated.periods[0].foodCredit, 1700);
assert.equal(migrated.periods[0].otherCredit, 3355);
assert.equal(calculatePeriodsFor(migrated)[0].creditCharges, 5055);

const closedTransaction = {
  id: "closed-tx",
  date: "2026-06-30",
  description: "No debe tocar cerrada",
  amount: 500,
  category: "Prueba",
  method: "credit",
  periodId: "2026-06-h2",
  shared: false,
  installments: 1,
};
assert.equal(buildPaymentScheduleFor(result.state, closedTransaction).length, 0);
assert.equal(applyTransactionToState(result.state, closedTransaction, 1), result.state);

const reopened = reopenPeriodFor(result.state, "2026-06-h2");
assert.equal(reopened.settings.currentSavings, 100);
assert.equal(reopened.settings.rentReserve, 0);
assert.equal(reopened.periods.find((period) => period.id === "2026-06-h2")?.closedAt, undefined);
assert.equal(reopened.periods.find((period) => period.id === "2026-06-h2")?.salary, 8000);
assert.equal(reopened.periods.find((period) => period.id === "2026-06-h2")?.rent, -1750);

const nextDue = duePayrollPeriodsFor(result.state, "2026-07-15");
assert.equal(nextDue[0].id, "2026-07-h1");

const second = closePeriodFor(result.state, "2026-06-h2", "2026-06-30");
assert.equal(second.state.settings.currentSavings, 6350);
assert.equal(second.state.periods.length, result.state.periods.length);

console.log("Period rollover verification OK");
