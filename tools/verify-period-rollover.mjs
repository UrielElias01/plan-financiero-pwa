import assert from "node:assert/strict";
import test from "node:test";
import {
  applyTransactionToState,
  calculateCardDebtFor,
  calculatePeriodsFor,
  closePeriodFor,
  duePeriodsFor,
  materializeDueRecurringTransactions,
  normalizeState,
  periodIdForDate,
  reconcileCashBalanceFor,
  reconcileRecurringTransactions,
  reopenPeriodFor,
} from "../pwa-finanzas/src/lib/calculations.ts";
import { cloneSeed, createPeriod } from "../pwa-finanzas/src/lib/seed.ts";

// Deterministic fictional fixtures: these tests never depend on today's date or a private backup.
const AS_OF = "2032-02-10";
const state = () => reconcileCashBalanceFor(cloneSeed(AS_OF), 250, 0, AS_OF, 0);
const transaction = (patch = {}) => ({
  id: "expense", date: AS_OF, description: "Movimiento de prueba", amount: 80,
  category: "Prueba", method: "cash", periodId: "2032-02-h1", shared: false,
  installments: 1, affectsSavings: true, status: "confirmed", ...patch,
});
const refresh = (input, asOf = AS_OF) => applyTransactionToState(input, input.transactions[0], 1, asOf);
const findPeriod = (input, id, asOf = AS_OF) => calculatePeriodsFor(input, asOf).find((period) => period.id === id);

test("period identities and due dates cross leap February and year boundaries", () => {
  const input = state();
  input.periods = [createPeriod(2031, 12, 2), createPeriod(2032, 2, 1), createPeriod(2032, 2, 2), createPeriod(2032, 3, 1)];
  assert.equal(periodIdForDate(input, "2032-02-15"), "2032-02-h1");
  assert.equal(periodIdForDate(input, "2032-02-16"), "2032-02-h2");
  assert.equal(periodIdForDate(input, "2032-02-29"), "2032-02-h2");
  assert.equal(periodIdForDate(input, "2032-03-01"), "2032-03-h1");
  assert.deepEqual(duePeriodsFor(input, "2032-02-28").map((period) => period.id), ["2031-12-h2", "2032-02-h1"]);
  assert.deepEqual(duePeriodsFor(input, "2032-02-29").map((period) => period.id), ["2031-12-h2", "2032-02-h1", "2032-02-h2"]);
});

test("a balance snapshot never receives the salary of an already consumed half-month again", () => {
  const input = state();
  Object.assign(input.settings, { salary: 400, monthlyRent: 100, monthlyFood: 80, nextPayday: "2032-02-15" });
  input.transactions = [transaction({ id: "old-payroll", date: "2032-01-31", periodId: "2032-01-h2", method: "income", category: "Nómina", amount: 400 })];
  const normalized = normalizeState(input, AS_OF);
  assert.equal(normalized.version, 4);
  assert.equal(normalized.settings.currentSavings, 250);
  assert.equal(findPeriod(normalized, "2032-01-h2").projectedFlow, 0);
  const current = findPeriod(normalized, "2032-02-h1");
  assert.equal(current.salary, 400);
  assert.equal(current.rent, -50);
  assert.equal(current.foodReserve, -40);
  assert.equal(current.projectedFlow, 310);
  assert.equal(current.savings, 560);
  assert.equal(normalizeState(normalized, "2032-02-11").settings.currentSavings, 250);
});

test("nextPayday skips a received payroll and projects only the first pending one", () => {
  const input = state();
  Object.assign(input.settings, { salary: 400, monthlyRent: 100, monthlyFood: 80, nextPayday: "2032-02-29" });
  assert.equal(findPeriod(input, "2032-02-h1").salary, 0);
  assert.equal(findPeriod(input, "2032-02-h1").savings, 250);
  const next = findPeriod(input, "2032-02-h2");
  assert.equal(next.salary, 400);
  assert.equal(next.projectedFlow, 310);
  assert.equal(next.savings, 560);
});

test("reopening the app after a planned expense's date does not confirm it", () => {
  const input = state();
  input.transactions = [transaction({ date: "2032-02-20", periodId: "2032-02-h2", status: "planned" })];
  const before = normalizeState(input, AS_OF);
  const after = normalizeState(before, "2032-02-25");
  assert.equal(before.settings.currentSavings, 250);
  assert.equal(after.settings.currentSavings, 250);
  assert.equal(after.transactions[0].status, "planned");
  assert.equal(findPeriod(after, "2032-02-h2", "2032-02-25").projectedFlow, -80);
  assert.equal(findPeriod(after, "2032-02-h2", "2032-02-25").savings, 170);
  const confirmed = refresh({ ...after, transactions: [{ ...after.transactions[0], status: "confirmed" }] }, "2032-02-25");
  assert.equal(confirmed.settings.currentSavings, 170);
  assert.equal(findPeriod(confirmed, "2032-02-h2", "2032-02-25").projectedFlow, 0);
  assert.equal(findPeriod(confirmed, "2032-02-h2", "2032-02-25").savings, 170);
});

test("closing and reopening archive balances without receiving salary or paying a card", () => {
  const input = state();
  input.settings.salary = 400;
  input.transactions = [transaction({ id: "purchase", method: "credit", amount: 600, affectsSavings: false,
    monthlyAmount: 100, totalInstallments: 6, currentInstallment: 0, nextPaymentMonth: "2032-02" })];
  const actual = refresh(input);
  const closed = closePeriodFor(actual, "2032-02-h1", "2032-02-15");
  assert.equal(closed.closed.closingSavings, 250);
  assert.equal(closed.state.settings.currentSavings, 250);
  assert.equal(closed.state.settings.usedCreditBalance, 600);
  assert.deepEqual(closed.state.transactions, actual.transactions);
  assert.equal(duePeriodsFor(closed.state, "2032-02-15").length, 0);
  assert.deepEqual(closePeriodFor(closed.state, "2032-02-h1", "2032-02-15").state, closed.state, "repeated closing must not extend the horizon twice");
  const reopened = reopenPeriodFor(closed.state, "2032-02-h1");
  assert.equal(reopened.periods.find((period) => period.id === "2032-02-h1").closedAt, undefined);
  assert.equal(reopened.settings.currentSavings, 250);
  assert.equal(calculateCardDebtFor(reopened, undefined, "2032-02-15").totalDebt, 600);
});

test("an unpaid obligation survives closure and rolls to the next open half-month once", () => {
  const input = state();
  input.transactions = [transaction({ id: "purchase", method: "credit", amount: 100, affectsSavings: false,
    monthlyAmount: 100, totalInstallments: 1, currentInstallment: 0, nextPaymentMonth: "2032-02" })];
  let closed = closePeriodFor(refresh(input), "2032-02-h1", "2032-02-15").state;
  closed = closePeriodFor(closed, "2032-02-h2", "2032-02-29").state;
  const rolled = normalizeState(closed, "2032-03-01");
  assert.equal(rolled.settings.currentSavings, 250);
  assert.equal(rolled.settings.usedCreditBalance, 100);
  const periods = calculatePeriodsFor(rolled, "2032-03-01");
  assert.equal(periods.find((period) => period.id === "2032-03-h1").pendingCardPayment, 100);
  assert.equal(periods.reduce((sum, period) => sum + period.pendingCardPayment, 0), 100);
  assert.equal(periods.find((period) => period.id === "2032-03-h1").savings, 150);
});

test("monthly recurrence remains confirmed after an edit and only the following month receives another charge", () => {
  let input = reconcileCashBalanceFor(cloneSeed("2032-02-01"), 250, 0, "2032-02-01", 0);
  input.recurring = [{ id: "subscription", name: "Suscripción de prueba", amount: 10, day: 9, method: "debit", active: true, startsOn: "2032-02-01" }];
  const first = materializeDueRecurringTransactions(input, AS_OF);
  assert.equal(first.added.length, 1);
  assert.equal(first.added[0].status, "confirmed");
  assert.equal(first.state.settings.currentSavings, 240);
  input = { ...first.state, recurring: [{ ...input.recurring[0], day: 12, amount: 15 }] };
  const edited = reconcileRecurringTransactions(input, "2032-02-13");
  assert.equal(edited.removed.length, 0);
  assert.equal(edited.added.length, 0);
  assert.equal(edited.state.settings.currentSavings, 240);
  assert.equal(materializeDueRecurringTransactions(edited.state, "2032-02-13").added.length, 0);
  const march = materializeDueRecurringTransactions(edited.state, "2032-03-12");
  assert.deepEqual(march.added.map((item) => [item.date, item.amount]), [["2032-03-12", 15]]);
  assert.equal(march.state.settings.currentSavings, 225);
  assert.equal(materializeDueRecurringTransactions(march.state, "2032-03-13").added.length, 0);
});

test("normalization keeps a continuous future horizon without reopening closed historical periods", () => {
  let input = cloneSeed("2031-12-20");
  input = closePeriodFor(input, "2031-12-h2", "2031-12-31").state;
  const next = normalizeState(input, "2032-01-01");
  assert.equal(next.periods.find((period) => period.id === "2031-12-h2").closedAt, "2031-12-31");
  assert.ok(next.periods.some((period) => period.id === "2032-12-h2"));
  assert.equal(new Set(next.periods.map((period) => period.id)).size, next.periods.length);
  assert.deepEqual(normalizeState(next, "2032-01-01"), next);
});
