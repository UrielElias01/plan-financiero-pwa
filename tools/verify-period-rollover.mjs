import assert from "node:assert/strict";
import {
  applyTransactionToState,
  buildPaymentScheduleFor,
  calculatePeriodsFor,
  closePeriodFor,
  duePayrollPeriodsFor,
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
