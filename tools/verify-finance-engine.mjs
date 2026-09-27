import assert from "node:assert/strict";
import test from "node:test";
import {
  applyTransactionToState, buildCardCalendarFor, buildPaymentScheduleFor, calculateCardDebtFor,
  calculatePeriodsFor, calculateMonthlyFor, closePeriodFor, materializeDueRecurringTransactions,
  normalizeState, reconcileCashBalanceFor, reconcileRecurringTransactions, recurringOccurrencesFor,
  reopenPeriodFor, toCents, transactionUserAmount,
} from "../pwa-finanzas/src/lib/calculations.ts";
import { cloneSeed } from "../pwa-finanzas/src/lib/seed.ts";

const AS_OF = "2027-02-10";
const state = () => ({ ...cloneSeed(AS_OF), updatedAt: AS_OF + "T12:00:00Z" });
const tx = (patch = {}) => ({ id: "purchase", date: AS_OF, description: "Fictional purchase", amount: 600, category: "Hogar", method: "credit", periodId: "2027-02-h1", shared: false, installments: 6, monthlyAmount: 100, totalInstallments: 6, currentInstallment: 0, nextPaymentMonth: "2027-03", ...patch });
const payment = (patch = {}) => tx({ id: "payment", method: "card_payment", amount: 40, installments: 1, totalInstallments: 1, monthlyAmount: undefined, nextPaymentMonth: undefined, affectsSavings: true, ...patch });
const sum = (items, field) => items.reduce((total, item) => total + toCents(item[field]), 0) / 100;
const add = (input, transaction, asOf = AS_OF) => applyTransactionToState({ ...input, transactions: [...input.transactions, transaction] }, transaction, 1, asOf);

// These are invented regression fixtures. Personal amounts and backups do not belong in the repository.
test("fixed monthly installments end exactly once and debt is a snapshot, not a sum", () => {
  const input = state();
  input.transactions = [tx({ currentInstallment: 3 })];
  const schedule = buildPaymentScheduleFor(input, input.transactions[0]);
  assert.deepEqual(schedule.map((item) => [item.monthKey, item.installment, item.amount]), [["2027-03", 4, 100], ["2027-04", 5, 100], ["2027-05", 6, 100]]);
  const calendar = buildCardCalendarFor(input, AS_OF);
  assert.deepEqual(calendar.filter((item) => item.total).map((item) => [item.total, item.debt]), [[100, 200], [100, 100], [100, 0]]);
  assert.equal(sum(calendar, "userPart"), 300);
  assert.equal(calculateCardDebtFor(input, undefined, AS_OF).totalDebt, 300);
});

test("visible horizon never compresses a 24 month obligation into its last visible month", () => {
  const input = state(); input.periods = input.periods.slice(0, 1);
  const purchase = tx({ amount: 720, monthlyAmount: 30, totalInstallments: 24 });
  const schedule = buildPaymentScheduleFor(input, purchase);
  assert.equal(schedule.length, 24); assert.equal(schedule.at(-1).monthKey, "2029-02");
  assert.ok(schedule.every((item) => item.amount === 30)); assert.equal(sum(schedule, "amount"), 720);
});

test("cent remainders belong to the true final installment only", () => {
  const input = state(); input.periods = input.periods.slice(0, 1);
  const schedule = buildPaymentScheduleFor(input, tx({ amount: 100, monthlyAmount: undefined, totalInstallments: 3 }));
  assert.deepEqual(schedule.map((item) => item.amount), [33.33, 33.33, 33.34]);
  assert.equal(sum(schedule, "amount"), 100);
  assert.equal(toCents(1.005), 101);
});

test("cut-off and payment day respect year rollover, first-half due dates and leap February", () => {
  const input = state(); input.settings.cutoffDay = 20; input.settings.dueDay = 5;
  assert.equal(buildPaymentScheduleFor(input, tx({ date: "2027-12-20", nextPaymentMonth: undefined }))[0].periodId, "2028-01-h1");
  assert.equal(buildPaymentScheduleFor(input, tx({ date: "2027-12-21", nextPaymentMonth: undefined }))[0].periodId, "2028-02-h1");
  input.settings.cutoffDay = 3; input.settings.dueDay = 31;
  assert.equal(buildPaymentScheduleFor(input, tx({ nextPaymentMonth: "2028-02" }))[0].dueDate, "2028-02-29");
});

test("fully paid MSI contributes zero now and in every later month", () => {
  const input = state(); input.transactions = [tx({ currentInstallment: 6 })];
  assert.deepEqual(buildPaymentScheduleFor(input, input.transactions[0]), []);
  assert.equal(calculateCardDebtFor(input, undefined, AS_OF).totalDebt, 0);
  assert.equal(sum(buildCardCalendarFor(input, AS_OF), "total"), 0);
});

test("stored calendars, period payment caches and legacy used-credit totals cannot multiply debt", () => {
  const input = state(); input.transactions = [tx({ currentInstallment: 3 })];
  input.cardCalendar = [{ month: "March", total: 9999, userPart: 9999, debt: 9999 }];
  input.periods.forEach((period) => { period.cardPayment = -9999; });
  input.settings.usedCreditBalance = 9999;
  const normalized = normalizeState(input, AS_OF);
  assert.equal(calculateCardDebtFor(normalized, undefined, AS_OF).totalDebt, 300);
  assert.equal(sum(calculatePeriodsFor(normalized, AS_OF), "pendingCardPayment"), 300);
  assert.equal(sum(normalized.cardCalendar, "total"), 300);
  assert.deepEqual(normalizeState(normalized, AS_OF), normalized);
});

test("partial, target-month and excess card payments allocate once; deleting them reverses exactly", () => {
  let input = reconcileCashBalanceFor(state(), 1000, 0, AS_OF); input = add(input, tx());
  input = add(input, payment({ paymentForPeriodId: "2027-04-h2" }));
  assert.equal(input.settings.currentSavings, 960);
  assert.equal(calculateCardDebtFor(input, undefined, AS_OF).totalDebt, 560);
  const calendar = buildCardCalendarFor(input, AS_OF);
  assert.equal(calendar.find((item) => item.monthKey === "2027-03").remaining, 100);
  assert.equal(calendar.find((item) => item.monthKey === "2027-04").remaining, 60);
  assert.equal(sum(calculatePeriodsFor(input, AS_OF), "pendingCardPayment"), 560);
  const oversized = payment({ id: "overpayment", amount: 700 });
  input = add(input, oversized);
  assert.equal(input.settings.currentSavings, 260);
  assert.equal(calculateCardDebtFor(input, undefined, AS_OF).totalDebt, 0);
  assert.equal(calculateCardDebtFor(input, undefined, AS_OF).creditBalance, 140);
  input = applyTransactionToState({ ...input, transactions: input.transactions.filter((entry) => entry.id !== oversized.id) }, oversized, -1, AS_OF);
  assert.equal(input.settings.currentSavings, 960); assert.equal(input.settings.usedCreditBalance, 560);
  assert.deepEqual(applyTransactionToState(input, oversized, -1, AS_OF), input, "applying an unchanged ledger is idempotent");
});

test("expense add/edit/delete and payroll reserve conserve actual money without rounding drift", () => {
  let input = reconcileCashBalanceFor(state(), 1000, 0, AS_OF);
  const expense = tx({ method: "cash", amount: 41.27, affectsSavings: true });
  input = add(input, expense); assert.equal(input.settings.currentSavings, 958.73);
  const edited = { ...expense, amount: 52.83 };
  input = applyTransactionToState({ ...input, transactions: [edited] }, edited, 1, AS_OF);
  assert.equal(input.settings.currentSavings, 947.17);
  input = applyTransactionToState({ ...input, transactions: [] }, edited, -1, AS_OF);
  assert.equal(input.settings.currentSavings, 1000);
  input = add(input, tx({ id: "salary", method: "income", amount: 300, category: "Nómina", affectsSavings: true, rentReserveAmount: 80 }));
  assert.equal(input.settings.currentSavings, 1220); assert.equal(input.settings.rentReserve, 80);
});

test("current period includes unreceived salary, extra incomes and recurring projections without readding actuals", () => {
  let input = reconcileCashBalanceFor(state(), 100, 0, AS_OF);
  input.settings.salary = 400; input.settings.monthlyRent = 100;
  input.recurring = [{ id: "music", name: "Music", amount: 10, day: 12, method: "debit", active: true, startsOn: AS_OF }];
  let current = calculatePeriodsFor(input, AS_OF)[0];
  assert.equal(current.salary, 400); assert.equal(current.projectedFlow, 340); assert.equal(current.savings, 440);
  input = add(input, tx({ id: "salary", method: "income", amount: 450, category: "Nómina", affectsSavings: true, rentReserveAmount: 50 }));
  input = add(input, tx({ id: "extra", method: "income", amount: 20, category: "Ingreso extra", affectsSavings: true }));
  current = calculatePeriodsFor(input, AS_OF)[0];
  assert.equal(input.settings.currentSavings, 520); assert.equal(current.salary, 450);
  assert.equal(current.salaryProjected, false); assert.equal(current.projectedFlow, -10); assert.equal(current.savings, 510);
});

test("recurring charges stay estimated until confirmed and confirmation is idempotent", () => {
  let input = reconcileCashBalanceFor(state(), 100, 0, "2027-02-01");
  input.recurring = [{ id: "music", name: "Music", amount: 10, day: 9, method: "debit", active: true, startsOn: "2027-02-01" }];
  assert.equal(recurringOccurrencesFor(input, AS_OF).length, 1);
  assert.equal(input.settings.currentSavings, 100);
  assert.equal(calculatePeriodsFor(input, AS_OF)[0].projectedFlow, -10);
  const confirmed = materializeDueRecurringTransactions(input, AS_OF); input = confirmed.state;
  assert.equal(confirmed.added.length, 1); assert.equal(input.settings.currentSavings, 90);
  assert.equal(recurringOccurrencesFor(input, AS_OF).length, 0);
  assert.equal(calculatePeriodsFor(input, AS_OF)[0].projectedFlow, 0);
  assert.equal(materializeDueRecurringTransactions(input, AS_OF).added.length, 0);
  input.recurring[0].amount = 15; input.recurring[0].day = 12;
  input = reconcileRecurringTransactions(input, AS_OF).state;
  assert.equal(input.transactions[0].amount, 10); assert.equal(input.settings.currentSavings, 90);
  assert.equal(calculatePeriodsFor(input, AS_OF)[0].projectedFlow, 0, "changing a monthly subscription must not produce a second charge in an already confirmed month");
  assert.equal(calculatePeriodsFor(input, AS_OF).find((item) => item.id === "2027-03-h1").projectedFlow, -15);
});

test("credit subscription confirmation replaces forecast exactly and changes actual debt only once", () => {
  let input = state(); input.settings.balanceAsOf = "2027-02-01"; input.recurring = [{ id: "hosting", name: "Hosting", amount: 12, day: 9, method: "credit", active: true, startsOn: "2027-02-01" }];
  const before = sum(calculatePeriodsFor(input, AS_OF), "pendingCardPayment");
  assert.equal(calculateCardDebtFor(input, undefined, AS_OF).totalDebt, 0);
  input = materializeDueRecurringTransactions(input, AS_OF).state;
  assert.equal(sum(calculatePeriodsFor(input, AS_OF), "pendingCardPayment"), before);
  assert.equal(calculateCardDebtFor(input, undefined, AS_OF).totalDebt, 12);
  assert.equal(input.settings.currentSavings, 0);
});

test("planned future payment reduces later obligation once and does not change actual balance yet", () => {
  let input = reconcileCashBalanceFor(state(), 1000, 0, AS_OF);
  input = add(input, tx({ amount: 100, monthlyAmount: 100, totalInstallments: 1 }));
  input = add(input, payment({ date: "2027-02-20", periodId: "2027-02-h2", amount: 40 }));
  const periods = calculatePeriodsFor(input, AS_OF);
  assert.equal(input.settings.currentSavings, 1000); assert.equal(input.settings.usedCreditBalance, 100);
  assert.equal(periods.find((item) => item.id === "2027-02-h2").pendingCardPayment, 40);
  assert.equal(periods.find((item) => item.id === "2027-03-h2").pendingCardPayment, 60);
  assert.equal(sum(periods, "pendingCardPayment"), 100);
  const afterDate = normalizeState(input, "2027-02-21");
  assert.equal(afterDate.settings.currentSavings, 1000); assert.equal(afterDate.settings.usedCreditBalance, 100);
  assert.equal(afterDate.transactions.find((item) => item.id === "payment").status, "planned");
});

test("shared expenses require explicit amount and bank debt stays gross until reimbursement arrives", () => {
  let input = reconcileCashBalanceFor(state(), 1000, 0, AS_OF);
  const purchase = tx({ shared: true, userAmount: 180 }); input = add(input, purchase);
  assert.equal(calculateCardDebtFor(input, undefined, AS_OF).totalDebt, 600);
  assert.equal(sum(buildCardCalendarFor(input, AS_OF), "userPart"), 180);
  assert.equal(sum(calculatePeriodsFor(input, AS_OF), "pendingCardPayment"), 600);
  assert.equal(transactionUserAmount(tx({ shared: true })), 600, "there is no inferred 50% split");
  input = add(input, tx({ id: "cash", method: "cash", amount: 100, shared: true, userAmount: 35, affectsSavings: true }));
  assert.equal(input.settings.currentSavings, 965);
  input = add(input, tx({ id: "reimbursement", method: "income", amount: 65, affectsSavings: true }));
  assert.equal(input.settings.currentSavings, 1030);
});

test("legacy migration preserves actual savings and warns instead of inventing MSI repayments or shared percentages", () => {
  const input = state(); input.version = 2;
  delete input.settings.openingSavings; delete input.settings.openingRentReserve; delete input.settings.openingCardDebt;
  input.settings.currentSavings = 777; input.settings.usedCreditBalance = 400;
  input.transactions = [tx({ id: "cash", method: "cash", amount: 23, affectsSavings: true }), tx({ currentInstallment: undefined, shared: true })];
  input.cardCalendar = [{ month: "Julio", total: 999, userPart: 999, debt: 999 }];
  const result = normalizeState(input, AS_OF);
  assert.equal(result.settings.currentSavings, 777);
  assert.equal(result.settings.openingSavings, 800);
  assert.equal(result.migrationWarnings.length, 3);
  assert.equal(result.legacySnapshot.cardCalendar[0].debt, 999);
  assert.equal(result.settings.usedCreditBalance, 600);
});

test("a fresh plan spans current/future months, holds zero balances, and monthly reporting separates years", () => {
  const input = cloneSeed("2027-12-20");
  assert.equal(input.periods[0].id, "2027-12-h2"); assert.equal(input.periods.at(-1).id, "2028-11-h2");
  assert.equal(input.transactions.length, 0); assert.equal(input.recurring.length, 0);
  assert.equal(input.settings.currentSavings, 0);
  const monthly = calculateMonthlyFor(input, calculatePeriodsFor(input, "2027-12-20"));
  assert.equal(monthly.length, 12); assert.equal(monthly[0].month, "Diciembre 2027"); assert.equal(monthly[1].month, "Enero 2028");
});

test("closing/reopening a period neither invents salary nor forgives unpaid debt", () => {
  let input = reconcileCashBalanceFor(state(), 1000, 0, AS_OF); input.settings.salary = 300;
  input = add(input, tx({ totalInstallments: 1, monthlyAmount: 100, amount: 100, nextPaymentMonth: "2027-02" }));
  input = closePeriodFor(input, "2027-02-h1", AS_OF).state;
  assert.equal(input.settings.currentSavings, 1000); assert.equal(input.transactions.length, 1);
  input = reopenPeriodFor(input, "2027-02-h1");
  assert.equal(input.settings.currentSavings, 1000); assert.equal(input.settings.usedCreditBalance, 100);
});

test("duplicate IDs and a confirmed recurring occurrence cannot affect the balance twice", () => {
  let input = reconcileCashBalanceFor(state(), 100, 0, AS_OF);
  const expense = tx({ method: "cash", amount: 10, affectsSavings: true, sourceRecurringId: "subscription", recurringDate: AS_OF });
  input.transactions = [expense, { ...expense }, { ...expense, id: "duplicate-import", recurringDate: "2027-02-11" }];
  input = applyTransactionToState(input, expense, 1, AS_OF);
  assert.equal(input.settings.currentSavings, 90);
});

test("untracked opening card debt is counted once and payments consume it before later installments", () => {
  let input = state(); input.settings.openingCardDebt = 70; input.settings.openingCardPaymentMonth = "2027-02";
  input = add(input, tx({ currentInstallment: 5 })); input = add(input, payment({ amount: 90 }));
  assert.equal(input.settings.usedCreditBalance, 80);
  assert.equal(sum(buildCardCalendarFor(input, AS_OF), "remaining"), 80);
});
