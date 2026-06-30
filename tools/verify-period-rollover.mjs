import assert from "node:assert/strict";
import { closePeriodFor, duePayrollPeriodsFor } from "../pwa-finanzas/src/lib/calculations.ts";
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
    salary: 8000,
    extraIncome: 250,
    rent: -1750,
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
assert.equal(result.state.settings.currentSavings, 6600);
assert.equal(result.state.settings.rentReserve, 1750);
assert.equal(result.state.periods.find((period) => period.id === "2026-06-h2")?.salary, 0);
assert.equal(result.state.periods.find((period) => period.id === "2026-06-h2")?.closedAt, "2026-06-30");
assert.equal(result.state.periods.at(-1)?.id, "2026-08-h1");
assert.equal(result.state.periods.at(-1)?.salary, 8000);

const nextDue = duePayrollPeriodsFor(result.state, "2026-07-15");
assert.equal(nextDue[0].id, "2026-07-h1");

const second = closePeriodFor(result.state, "2026-06-h2", "2026-06-30");
assert.equal(second.state.settings.currentSavings, 6600);
assert.equal(second.state.periods.length, result.state.periods.length);

console.log("Period rollover verification OK");
