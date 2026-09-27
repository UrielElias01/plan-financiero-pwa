import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCardCalendarFor, buildPaymentScheduleFor, calculateCardDebtFor, calculatePeriodsFor, cardPaymentObligationsFor,
  latestStatementFor, liquidityTimelineFor, normalizeState, statementInstallmentSchedulesFor, toCents,
} from "../pwa-finanzas/src/lib/calculations.ts";
import { validateStatement } from "../pwa-finanzas/src/lib/bbva.ts";
import { cloneSeed } from "../pwa-finanzas/src/lib/seed.ts";

// Fictional statements only: amounts are chosen to expose rounding and duplicate allocation.
const AS_OF = "2032-03-10";
const statement = (patch = {}) => validateStatement({
  issuer: "BBVA", periodStart: "2032-02-04", cutoffDate: "2032-03-03", dueDate: "2032-03-23",
  paymentToAvoidInterest: 100, minimumPayment: 10, totalDebt: 245.5, installmentBalance: 145.5,
  importedAt: "2032-03-04T12:00:00.000Z",
  installments: [
    { merchant: "Compra de prueba A", originalAmount: 100, monthlyAmount: 25, billedInstallment: 2, totalInstallments: 4, remainingBalance: 50 },
    { merchant: "Compra de prueba B", originalAmount: 191, monthlyAmount: 48, billedInstallment: 2, totalInstallments: 4, remainingBalance: 95.5 },
  ], ...patch,
});
const state = (asOf = AS_OF) => {
  const input = cloneSeed(asOf);
  input.updatedAt = `${asOf}T12:00:00.000Z`;
  Object.assign(input.settings, { openingSavings: 1000, currentSavings: 1000, salary: 0, monthlyRent: 0, monthlyFood: 0 });
  input.statements = [statement()];
  return input;
};
const transaction = (patch = {}) => ({
  id: "payment", date: AS_OF, periodId: "2032-03-h1", description: "Movimiento de prueba",
  category: "Prueba", method: "card_payment", amount: 40, installments: 1, totalInstallments: 1,
  shared: false, status: "confirmed", affectsSavings: true, ...patch,
});
const sum = (items, field) => items.reduce((total, item) => total + toCents(item[field]), 0) / 100;
const debt = (input, asOf = AS_OF) => calculateCardDebtFor(input, undefined, asOf);

test("el corte aporta requerido más MSI futuro exactamente una vez", () => {
  const input = normalizeState(state(), AS_OF);
  const calendar = buildCardCalendarFor(input, AS_OF);
  assert.equal(debt(input).totalDebt, 245.5);
  assert.equal(debt(input).knownNextPayment, 100);
  assert.deepEqual(calendar.filter((item) => item.total).map((item) => [item.monthKey, item.total, item.debt]), [
    ["2032-03", 100, 145.5], ["2032-04", 73, 72.5], ["2032-05", 72.5, 0],
  ]);
  assert.equal(sum(calendar, "total"), 245.5);
  assert.equal(sum(calendar, "userPart"), 245.5);
  assert.equal(sum(calendar, "remaining"), 245.5);
  assert.equal(sum(calculatePeriodsFor(input, AS_OF), "pendingCardPayment"), 245.5);
  assert.equal(sum(liquidityTimelineFor(input, AS_OF), "amount"), -245.5);
  assert.equal(input.settings.currentSavings, 1000, "importar no ejecuta pagos");
});

test("solo pagos reales posteriores al corte disminuyen el estado y lo hacen una vez", () => {
  const input = state();
  input.transactions = [
    transaction({ id: "before", date: "2032-03-02", amount: 10 }),
    transaction({ id: "on-cutoff", date: "2032-03-03", amount: 20 }),
    transaction({ id: "after", amount: 40 }),
    transaction({ id: "planned", amount: 15, status: "planned" }),
  ];
  const refreshed = normalizeState(input, AS_OF);
  assert.equal(refreshed.settings.currentSavings, 960);
  assert.equal(debt(refreshed).totalDebt, 205.5);
  assert.equal(debt(refreshed).knownNextPayment, 60);
  assert.equal(sum(buildCardCalendarFor(refreshed, AS_OF), "paid"), 40);
  assert.equal(sum(calculatePeriodsFor(refreshed, AS_OF), "pendingCardPayment"), 205.5, "un plan de pago sustituye parte del vencimiento; no se agrega encima");
  assert.deepEqual(normalizeState(refreshed, AS_OF), refreshed);
  const removed = normalizeState({ ...refreshed, transactions: refreshed.transactions.filter((item) => item.id !== "after") }, AS_OF);
  assert.equal(removed.settings.currentSavings, 1000);
  assert.equal(debt(removed).totalDebt, 245.5);
});

test("el último corte sustituye al anterior, saldo inicial y compras ya incluidas", () => {
  const later = "2032-04-10";
  const input = state(later);
  input.settings.openingCardDebt = 777;
  const newer = statement({
    periodStart: "2032-03-04", cutoffDate: "2032-04-03", dueDate: "2032-04-23",
    paymentToAvoidInterest: 110, minimumPayment: 10, installmentBalance: 70, totalDebt: 180,
    installments: [{ merchant: "Compra futura ficticia", originalAmount: 140, monthlyAmount: 35, billedInstallment: 2, totalInstallments: 4, remainingBalance: 70 }],
  });
  input.statements.push(newer);
  input.transactions = [
    transaction({ id: "old-credit", date: "2032-02-15", method: "credit", amount: 900 }),
    transaction({ id: "old-payment", date: "2032-03-23", amount: 30 }),
    transaction({ id: "included-credit", date: "2032-03-19", method: "credit", amount: 15 }),
    transaction({ id: "new-credit", date: "2032-04-08", method: "credit", amount: 7 }),
    transaction({ id: "new-payment", date: later, amount: 12 }),
  ];
  const refreshed = normalizeState(input, later);
  assert.equal(latestStatementFor(refreshed, later).id, newer.id);
  assert.equal(debt(refreshed, later).totalDebt, 175);
  assert.equal(debt(refreshed, later).knownNextPayment, 98);
  assert.equal(sum(buildCardCalendarFor(refreshed, later), "total"), 187);
  assert.equal(sum(buildCardCalendarFor(refreshed, later), "paid"), 12);
  assert.equal(sum(calculatePeriodsFor(refreshed, later), "pendingCardPayment"), 175);
  assert.equal(latestStatementFor(refreshed, "2032-03-31").id, input.statements[0].id, "consultar antes del corte nuevo usa el anterior");
});

test("última cuota conserva el saldo exacto tanto si es menor como si es mayor al pago regular", () => {
  const input = state();
  let schedule = statementInstallmentSchedulesFor(input, AS_OF)[1].payments;
  assert.deepEqual(schedule.map((item) => item.amount), [48, 47.5]);
  input.statements = [statement({ totalDebt: 246.5, installmentBalance: 146.5,
    installments: statement().installments.map((item, index) => index === 1 ? { ...item, remainingBalance: 96.5 } : item),
  })];
  schedule = statementInstallmentSchedulesFor(input, AS_OF)[1].payments;
  assert.deepEqual(schedule.map((item) => item.amount), [48, 48.5]);
  assert.equal(sum(statementInstallmentSchedulesFor(input, AS_OF).flatMap((item) => item.payments), "amount"), 146.5);
  assert.equal(debt(input).unallocatedDebt, 0);
  assert.equal(debt(input).reconciliationWarning, undefined);
});

test("un pago planeado jamás se vuelve real al vencer y tampoco aplaza la fecha bancaria", () => {
  const input = state();
  input.transactions = [transaction({ date: "2032-03-30", periodId: "2032-03-h2", amount: 100, status: "planned" })];
  const events = liquidityTimelineFor(input, AS_OF).filter((item) => item.kind === "card_payment");
  assert.equal(events[0].date, "2032-03-23");
  assert.equal(events[0].amount, -100);
  const after = normalizeState(input, "2032-04-05");
  assert.equal(after.settings.currentSavings, 1000);
  assert.equal(after.transactions[0].status, "planned");
  assert.equal(debt(after, "2032-04-05").totalDebt, 245.5);
  assert.equal(debt(after, "2032-04-05").overdue, 100);
  assert.equal(sum(calculatePeriodsFor(after, "2032-04-05"), "pendingCardPayment"), 245.5);
});

test("pago anticipado parcial reparte el egreso sin duplicar el pendiente futuro", () => {
  const input = state();
  input.transactions = [transaction({ date: "2032-03-15", status: "planned", amount: 40 })];
  const events = liquidityTimelineFor(input, AS_OF).filter((item) => item.kind === "card_payment");
  assert.deepEqual(events.slice(0, 2).map((item) => [item.date, item.amount]), [["2032-03-15", -40], ["2032-03-23", -60]]);
  assert.equal(sum(events, "amount"), -245.5);
  assert.equal(sum(calculatePeriodsFor(input, AS_OF), "pendingCardPayment"), 245.5);
});

test("exceso de pago deja saldo a favor y financia estimaciones sin convertirlas en deuda real", () => {
  const input = state();
  input.transactions = [transaction({ amount: 260 }), transaction({ id: "future-credit", method: "credit", amount: 20, date: "2032-03-20", periodId: "2032-03-h2", status: "planned" })];
  const refreshed = normalizeState(input, AS_OF);
  assert.equal(refreshed.settings.currentSavings, 740);
  assert.equal(debt(refreshed).totalDebt, 0);
  assert.equal(debt(refreshed).creditBalance, 14.5);
  assert.equal(sum(buildCardCalendarFor(refreshed, AS_OF), "remaining"), 5.5);
  assert.equal(sum(calculatePeriodsFor(refreshed, AS_OF), "pendingCardPayment"), 5.5);
});

function reserveScenario(status) {
  const input = state(); input.statements = [];
  Object.assign(input.settings, { openingSavings: 10, currentSavings: 10 });
  const day = "2032-03-15";
  input.transactions = [
    transaction({ id: "food", date: day, method: "cash", amount: 40, fundingSource: "food_reserve", status }),
    transaction({ id: "rent", date: day, method: "cash", amount: 20, fundingSource: "rent_reserve", status }),
    transaction({ id: "card", date: day, amount: 20, status }),
    transaction({ id: "payroll", date: day, method: "income", category: "Nómina", amount: 100, rentReserveAmount: 20, foodReserveAmount: 30, status }),
  ];
  return input;
}

test("ingreso del mismo día precede egresos y gastar apartados no descuenta ahorro dos veces", () => {
  const input = reserveScenario("planned");
  const events = liquidityTimelineFor(input, AS_OF);
  assert.equal(events[0].kind, "salary");
  assert.equal(events[0].balance, 60);
  assert.equal(events.at(-1).balance, 30);
  const period = calculatePeriodsFor(input, AS_OF).find((item) => item.id === "2032-03-h1");
  assert.equal(period.projectedFlow, 20);
  assert.equal(period.savings, 30);
  assert.equal(period.reserveUsed, 50);
  assert.equal(period.income + period.cashExpenses + period.cardPayment + period.reserveUsed, period.flow);
});

test("las mismas operaciones confirmadas dan el mismo cierre que la proyección y la tabla concilia", () => {
  const input = normalizeState(reserveScenario("confirmed"), "2032-03-15");
  assert.equal(input.settings.currentSavings, 30);
  assert.equal(input.settings.foodReserve, 0);
  assert.equal(input.settings.rentReserve, 0);
  const period = calculatePeriodsFor(input, "2032-03-15").find((item) => item.id === "2032-03-h1");
  assert.equal(period.projectedFlow, 0);
  assert.equal(period.actualFlow, 20);
  assert.equal(period.savings, 30);
  assert.equal(period.income + period.cashExpenses + period.cardPayment + period.reserveUsed, period.flow);
});

test("calendario publica la fecha real del estado aunque difiera del día predeterminado", () => {
  const input = state(); input.settings.dueDay = 25;
  assert.equal(cardPaymentObligationsFor(input, AS_OF)[0].date, "2032-03-23");
  assert.equal(buildCardCalendarFor(input, AS_OF).find((item) => item.monthKey === "2032-03").dueDate, "2032-03-23");
  assert.equal(buildCardCalendarFor(input, AS_OF).find((item) => item.monthKey === "2032-04").dueDate, "2032-04-23");
});

test("compromisos fuera del horizonte de ingresos siguen visibles sin generar sueldos o recurrencias indefinidos", () => {
  const input = state(); input.statements = [];
  input.settings.salary = 100;
  input.recurring = [{ id: "synthetic-subscription", name: "Suscripción ficticia", amount: 7, day: 20, method: "credit", active: true, startsOn: AS_OF }];
  const normalized = normalizeState(input, AS_OF);
  const lastIncomePeriod = normalized.periods.at(-1).id;
  const calendar = buildCardCalendarFor(normalized, AS_OF);
  const periods = calculatePeriodsFor(normalized, AS_OF);
  assert.equal(sum(calendar, "remaining"), 84, "se proyectan doce ocurrencias mensuales");
  assert.equal(sum(periods, "pendingCardPayment"), 84, "incluye el pago del cargo de la última quincena");
  const outside = periods.filter((item) => item.id > lastIncomePeriod);
  assert.ok(outside.length > 0);
  assert.equal(sum(outside, "income"), 0);
  assert.equal(sum(outside, "pendingCardPayment"), 7);
  assert.ok(outside.every((item) => /fuera del horizonte de ingresos/i.test(item.note)));
  assert.deepEqual(normalizeState(normalized, AS_OF), normalized, "las filas derivadas no amplían el horizonte guardado");
});

test("compras planeadas no ejecutadas sobreviven un nuevo corte sin convertirse en deuda real", () => {
  const input = state();
  input.transactions = [transaction({ id: "unexecuted", method: "credit", date: "2032-03-02", periodId: "2032-03-h1", amount: 50, status: "planned" })];
  const normalized = normalizeState(input, AS_OF);
  assert.equal(debt(normalized).totalDebt, 245.5);
  assert.equal(normalized.transactions[0].status, "planned");
  assert.equal(sum(buildCardCalendarFor(normalized, AS_OF), "remaining"), 295.5, "el nuevo corte no contiene una compra que el usuario aún no ejecutó");
  assert.equal(sum(calculatePeriodsFor(normalized, AS_OF), "pendingCardPayment"), 295.5);
});

test("mensualidad fija y reparto explícito conservan también los centavos de mi parte", () => {
  const input = state(); input.statements = [];
  const purchase = transaction({ method: "credit", amount: 100, monthlyAmount: 33.33, totalInstallments: 3,
    currentInstallment: 0, nextPaymentMonth: "2032-04", shared: true, userAmount: 50,
  });
  input.transactions = [purchase];
  const schedule = buildPaymentScheduleFor(input, purchase);
  assert.equal(sum(schedule, "amount"), 100);
  assert.equal(sum(schedule, "userAmount"), 50, "redondear mi parte por fila no puede producir un centavo extra");
  assert.equal(sum(buildCardCalendarFor(input, AS_OF), "userPart"), 50);
  assert.equal(sum(calculatePeriodsFor(input, AS_OF), "pendingCardPayment"), 100, "la obligación bancaria sigue siendo el importe completo");
  const afterOne = buildPaymentScheduleFor(input, { ...purchase, currentInstallment: 1, nextPaymentMonth: "2032-05" });
  assert.equal(sum(afterOne, "amount"), 66.67);
  assert.equal(toCents(sum(afterOne, "userAmount")) + toCents(schedule[0].userAmount), 5000, "las cuotas restantes más mi primera cuota conservan mi importe original");
});
