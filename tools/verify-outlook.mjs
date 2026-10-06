import assert from "node:assert/strict";
import test from "node:test";
import { cardPaymentObligationsFor, liquidityTimelineFor, normalizeState, projectedBudgetTransactions } from "../pwa-finanzas/src/lib/calculations.ts";
import { categorize, cardOutlookFor, monthSummaryFor, pendingTasksFor } from "../pwa-finanzas/src/lib/outlook.ts";
import { parseMandadoExport, planImport, statementCandidates } from "../pwa-finanzas/src/lib/imports.ts";
import { validateStatement } from "../pwa-finanzas/src/lib/bbva.ts";
import { cloneSeed } from "../pwa-finanzas/src/lib/seed.ts";

// Invented amounts only. Personal data never belongs in the repository.
const AS_OF = "2032-03-04";
const statement = (patch = {}) => validateStatement({
  issuer: "BBVA", periodStart: "2032-02-04", cutoffDate: "2032-03-03", dueDate: "2032-03-23",
  paymentToAvoidInterest: 1500, minimumPayment: 120, minimumPlusInstallments: 300, annualInterestRate: 60,
  totalDebt: 1950.5, installmentBalance: 450.5, importedAt: "2032-03-04T12:00:00.000Z",
  installments: [
    { merchant: "Tienda A", originalAmount: 600, monthlyAmount: 150, billedInstallment: 2, totalInstallments: 4, remainingBalance: 300 },
    { merchant: "Tienda B", originalAmount: 301, monthlyAmount: 150.5, billedInstallment: 1, totalInstallments: 2, remainingBalance: 150.5 },
  ], ...patch,
});
const plan = ({ savings = 500, asOf = AS_OF, budgets = [], transactions = [], nextPayday = "2032-03-15" } = {}) => {
  const input = cloneSeed("2032-03-04");
  input.updatedAt = `${asOf}T12:00:00.000Z`;
  Object.assign(input.settings, { openingSavings: savings, currentSavings: savings, salary: 800, monthlyRent: 400, monthlyFood: 0, nextPayday, cutoffDay: 3, dueDay: 23, balanceAsOf: "2032-03-04", budgets });
  input.statements = [statement()];
  input.transactions = transactions;
  return normalizeState(input, asOf);
};
const tx = (patch) => ({ id: "tx", date: AS_OF, description: "Movimiento ficticio", amount: 100, category: "Otro", method: "credit", periodId: "2032-03-h1", shared: false, installments: 1, totalInstallments: 1, currentInstallment: 0, status: "confirmed", affectsSavings: false, ...patch });

test("antes del vencimiento cuenta la nómina menos la renta; el faltante pasa al siguiente pago con intereses", () => {
  const [first, second] = cardOutlookFor(plan(), AS_OF);
  assert.equal(first.dueDate, "2032-03-23");
  assert.equal(first.isStatement, true);
  assert.deepEqual(first.inflows.map((line) => [line.date, line.amount]), [["2032-03-15", 800]]);
  assert.deepEqual(first.outflows.map((line) => [line.label, line.amount]), [["Se aparta para la renta", 200]]);
  assert.deepEqual([first.available, first.required, first.payable, first.shortfall, first.leftover], [1100, 1500, 1100, 400, 0]);
  assert.deepEqual([first.minimum, first.minimumPlusInstallments, first.paidSoFar], [120, 300, 0]);
  // 400 × 60% × 30/360 × 1.16 (IVA)
  assert.equal(first.interestOnShortfall, 23.2);
  assert.equal(second.dueDate, "2032-04-23");
  assert.deepEqual(second.items.map((item) => [item.kind, item.amount]), [["carried", 400], ["interest", 23.2], ["installments", 300.5]]);
  assert.deepEqual([second.startCash, second.available, second.required, second.leftover], [0, 1200, 723.7, 476.3]);
});

test("un pago real posterior al corte reduce pendiente, mínimo y mínimo + MSI una sola vez", () => {
  const input = plan({ savings: 2000, transactions: [tx({ id: "pay", method: "card_payment", amount: 1000, affectsSavings: true, category: "Pago TDC" })] });
  assert.equal(input.settings.currentSavings, 1000);
  const [first] = cardOutlookFor(input, AS_OF);
  assert.deepEqual([first.required, first.paidSoFar, first.minimum, first.minimumPlusInstallments], [500, 1000, 0, 0]);
  assert.equal(first.available, 1600);
  assert.equal(first.leftover, 1100);
});

test("presupuestos: lo registrado consume el presupuesto; tarjeta por corte y débito por quincena", () => {
  const input = plan({
    budgets: [{ id: "m", category: "Mandado", monthlyAmount: 600, method: "credit" }, { id: "t", category: "Transporte", monthlyAmount: 300, method: "debit" }],
    transactions: [tx({ id: "super", category: "Mandado", amount: 100 }), tx({ id: "bus", date: "2032-03-02", category: "Transporte", method: "cash", amount: 50, affectsSavings: true })],
  });
  const budgets = projectedBudgetTransactions(input, AS_OF);
  assert.deepEqual(budgets.filter((item) => item.method === "credit").slice(0, 2).map((item) => [item.date, item.amount, item.nextPaymentMonth]), [["2032-04-03", 500, "2032-04"], ["2032-05-03", 600, "2032-05"]]);
  assert.deepEqual(budgets.filter((item) => item.method === "cash").slice(0, 2).map((item) => [item.date, item.amount]), [["2032-03-04", 100], ["2032-03-16", 150]]);
  const april = cardPaymentObligationsFor(input, AS_OF).filter((item) => item.date === "2032-04-23" && item.id.startsWith("budget:"));
  assert.deepEqual(april.map((item) => item.amount), [500]);
  // Recording more grocery spending lowers the projection by exactly that amount.
  const more = plan({ budgets: input.settings.budgets, transactions: [...input.transactions, tx({ id: "super-2", category: "Comida", amount: 120 })] });
  assert.equal(projectedBudgetTransactions(more, AS_OF).find((item) => item.date === "2032-04-03").amount, 380);
});

test("una nómina vencida sin registrar sigue en la proyección y se pide confirmarla", () => {
  const asOf = "2032-03-17";
  const pending = plan({ asOf });
  const salary = liquidityTimelineFor(pending, asOf).filter((event) => event.kind === "salary");
  assert.deepEqual(salary.slice(0, 2).map((event) => [event.date, event.label]), [["2032-03-17", "Nómina del 2032-03-15 sin registrar"], ["2032-03-31", "Nómina estimada"]]);
  assert.deepEqual(pendingTasksFor(pending, asOf).filter((task) => task.kind === "payroll").map((task) => task.date), ["2032-03-15"]);
  // Confirmed a day late but dated on its payday: it keeps its half-month and the next estimate stays.
  const received = plan({ asOf, transactions: [tx({ id: "payroll", date: "2032-03-15", method: "income", category: "Nómina", amount: 800, affectsSavings: true, rentReserveAmount: 200 })] });
  const after = liquidityTimelineFor(received, asOf).filter((event) => event.kind === "salary");
  assert.deepEqual(after.slice(0, 1).map((event) => event.date), ["2032-03-31"]);
  assert.equal(pendingTasksFor(received, asOf).filter((task) => task.kind === "payroll").length, 0);
  assert.equal(received.settings.currentSavings, 1100);
});

test("resumen del mes: ingresos y gastos por categoría contra presupuesto; «Comida» cuenta como mandado", () => {
  const input = plan({
    asOf: "2032-03-20",
    budgets: [{ id: "m", category: "Mandado", monthlyAmount: 600, method: "credit" }],
    transactions: [
      tx({ id: "payroll", date: "2032-03-15", method: "income", category: "Nómina", amount: 800, affectsSavings: true }),
      tx({ id: "super", date: "2032-03-10", category: "Mandado", amount: 100 }),
      tx({ id: "legacy", date: "2032-03-11", category: "Comida", method: "cash", amount: 50, affectsSavings: true }),
      tx({ id: "uber", date: "2032-03-12", category: "Transporte", amount: 40 }),
      tx({ id: "pay", date: "2032-03-12", method: "card_payment", category: "Pago TDC", amount: 300, affectsSavings: true }),
      tx({ id: "future", date: "2032-03-28", category: "Transporte", amount: 999, status: "planned" }),
    ],
  });
  const summary = monthSummaryFor(input, "2032-03", "2032-03-20");
  assert.deepEqual(summary.income, { received: 800, expected: 800 });
  assert.deepEqual([summary.spending.total, summary.spending.card, summary.spending.debit, summary.cardPayments], [190, 140, 50, 300]);
  assert.deepEqual(summary.spending.byCategory.map((item) => [item.category, item.spent, item.budget]), [["Mandado", 150, 600], ["Transporte", 40, 0]]);
});

test("un plan anterior convierte su apartado de comida en presupuesto «Mandado» una sola vez", () => {
  const legacy = cloneSeed(AS_OF);
  delete legacy.settings.budgets;
  legacy.settings.monthlyFood = 400;
  const migrated = normalizeState(legacy, AS_OF);
  assert.deepEqual(migrated.settings.budgets, [{ id: "mandado", category: "Mandado", monthlyAmount: 400, method: "debit" }]);
  assert.equal(migrated.settings.monthlyFood, 0);
  assert.equal(migrated.migrationWarnings.length, 1);
  assert.deepEqual(normalizeState(migrated, AS_OF).settings.budgets, migrated.settings.budgets);
});

test("importar compras del estado y de Mandado no duplica lo ya registrado", () => {
  const movements = [
    { date: "2032-02-10", description: "DLO*UBER RIDE", amount: 50 },
    { date: "2032-02-10", description: "DLO*UBER RIDE", amount: 50 },
    { date: "2032-02-20", description: "SORIANA PRUEBA", amount: 320.5 },
    { date: "2032-03-05", description: "Después del corte", amount: 10 },
  ];
  const manual = tx({ id: "manual", date: "2032-02-21", category: "Mandado", amount: 320.5 });
  const input = plan({ transactions: [manual] });
  const candidates = statementCandidates(statement(), movements);
  assert.equal(candidates.length, 3, "after the cut-off belongs to the next statement");
  const first = planImport(input, candidates);
  assert.deepEqual(first.add.map((item) => [item.description, item.category, item.method, item.status]), [["DLO*UBER RIDE", "Transporte", "credit", "confirmed"], ["DLO*UBER RIDE", "Transporte", "credit", "confirmed"]]);
  assert.equal(first.duplicates[0].description, "SORIANA PRUEBA");
  const imported = normalizeState({ ...input, transactions: [...input.transactions, ...first.add] }, AS_OF);
  assert.equal(planImport(imported, candidates).add.length, 0, "re-importing the same statement adds nothing");
  assert.equal(imported.settings.usedCreditBalance, input.settings.usedCreditBalance, "statement purchases are history, not new debt");

  const mandado = parseMandadoExport({ formato: "mandado-gastos", version: 1, compras: [
    { id: 7, fecha: "2032-02-11", tienda: "Chedraui", totalCentavos: 5000, metodo: "tarjeta" },
    { id: 8, fecha: "2032-03-04", tienda: "Soriana", totalCentavos: 12345 },
    { id: 9, fecha: "2032-03-04", tienda: "Soriana", totalCentavos: 12345, metodo: "efectivo" },
  ] });
  assert.deepEqual(mandado.map((item) => [item.externalId, item.amount, item.method, item.category]), [["mandado:7", 50, "credit", "Mandado"], ["mandado:8", 123.45, "credit", "Mandado"], ["mandado:9", 123.45, "cash", "Mandado"]]);
  const fromMandado = planImport(imported, mandado);
  assert.equal(fromMandado.duplicates.length, 1, "the statement already has that card purchase");
  assert.equal(fromMandado.add.length, 2, "two equal tickets are two purchases");
  assert.throws(() => parseMandadoExport({ formato: "otro", version: 1, compras: [] }), /no es una exportación/);
  assert.throws(() => parseMandadoExport({ formato: "mandado-gastos", version: 1, compras: [{ id: 1, fecha: "2032-02-30", totalCentavos: 10 }] }), /fecha/);
  assert.throws(() => parseMandadoExport({ formato: "mandado-gastos", version: 1, compras: [{ id: 1, fecha: "2032-02-03", totalCentavos: 10.5 }] }), /centavos/);
});

test("categorías sugeridas para descripciones bancarias frecuentes", () => {
  assert.deepEqual(["DLO*SERV UBER EATS", "DLO*UBER RIDE", "CHEDRAUI PRUEBA", "Google F1 TV", "COPPEL PRUEBA", "NETFLIX COM", "FARMACIA SIMILARES", "MERPAGO*XYZ"].map(categorize),
    ["Comida fuera", "Transporte", "Mandado", "Suscripciones", "Compras", "Suscripciones", "Salud", "Otro"]);
});
