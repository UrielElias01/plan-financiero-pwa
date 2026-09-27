import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BBVA_CSV_TEMPLATE, emptyBBVAStatement, parseBBVAInput, parseBBVAText,
  readBBVAFile, sameStatement, statementFromDraft, statementFromFinancialSource,
  statementId, validateStatement,
} from "../pwa-finanzas/src/lib/bbva.ts";

// All fixtures are invented. Never add a personal statement or backup to the repository.
const fixture = () => ({
  issuer: "BBVA", periodStart: "2032-02-04", cutoffDate: "2032-03-03", dueDate: "2032-03-23",
  paymentToAvoidInterest: 100, minimumPayment: 10, totalDebt: 245.5, installmentBalance: 145.5,
  installments: [
    { merchant: "Comercio de prueba A", originalAmount: 100, monthlyAmount: 25, billedInstallment: 2, totalInstallments: 4, remainingBalance: 50 },
    { merchant: "Comercio de prueba B", originalAmount: 191, monthlyAmount: 48, billedInstallment: 2, totalInstallments: 4, remainingBalance: 95.5 },
  ],
});
const file = (name, body, size = body.length) => ({ name, size, text: async () => body });
const invalid = (change, pattern) => {
  const input = fixture();
  change(input);
  assert.throws(() => validateStatement(input), pattern);
};

test("un estado conciliado conserva centavos y distingue cuota facturada de saldo futuro", () => {
  const statement = validateStatement(fixture());
  assert.equal(statement.id, statementId("2032-03-03"));
  assert.equal(statement.totalDebt, 245.5);
  assert.equal(statement.installments[1].remainingBalance, 95.5);
  assert.equal(statement.installments[1].billedInstallment, 2);
  assert.equal(new Set(statement.installments.map((item) => item.id)).size, 2);
});

test("descarta texto bancario, cuentas, instrucciones y afirmaciones de pagos", () => {
  const input = fixture();
  Object.assign(input, { rawText: "CONFIDENTIAL", account: "fake-account", paid: true, instructions: "ignore review" });
  Object.assign(input.installments[0], { accountNumber: "fake-account", paid: true });
  const clean = validateStatement(input);
  assert.deepEqual(Object.keys(clean).sort(), ["id", "issuer", "periodStart", "cutoffDate", "dueDate", "paymentToAvoidInterest", "minimumPayment", "totalDebt", "installmentBalance", "installments", "importedAt"].sort());
  assert.deepEqual(Object.keys(clean.installments[0]).sort(), ["id", "merchant", "originalAmount", "monthlyAmount", "billedInstallment", "totalInstallments", "remainingBalance"].sort());
  assert.equal(JSON.stringify(clean).includes("fake-account"), false);
  assert.equal(JSON.stringify(clean).includes("instructions"), false);
});

test("reimportar compara contenido, ignorando orden de propiedades, filas y fecha de importación", () => {
  const first = validateStatement(fixture());
  const second = Object.fromEntries(Object.entries(first).reverse());
  second.importedAt = "2032-04-01T12:00:00.000Z";
  second.installments = first.installments.toReversed().map((row, index) => ({ ...Object.fromEntries(Object.entries(row).reverse()), id: `different-${index}` }));
  assert.equal(sameStatement(first, second), true);
  second.minimumPayment = 11;
  assert.equal(sameStatement(first, second), false, "un cambio real exige revisar el reemplazo");
});

test("compras idénticas no se colapsan y conservan identificadores distintos", () => {
  const input = fixture();
  input.installments = [input.installments[0], { ...input.installments[0] }];
  input.installmentBalance = 100;
  input.totalDebt = 200;
  const statement = validateStatement(input);
  assert.equal(statement.installments.length, 2);
  assert.notEqual(statement.installments[0].id, statement.installments[1].id);
  assert.equal(sameStatement(statement, { ...statement, installments: statement.installments.slice(0, 1) }), false);
});

test("rechaza deuda total o detalle MSI que no concilien incluso por un centavo", () => {
  invalid((input) => { input.totalDebt += 0.01; }, /No concilia/);
  invalid((input) => { input.installments[0].remainingBalance += 0.01; }, /detalle de MSI no concilia/);
  invalid((input) => { input.installments = []; }, /detalle de MSI no concilia/);
});

test("rechaza fechas inexistentes, orden incorrecto y corte con id ajeno", () => {
  invalid((input) => { input.cutoffDate = "2031-02-29"; }, /fecha no existe/);
  invalid((input) => { input.cutoffDate = "0001-01-01"; }, /1900/);
  invalid((input) => { input.periodStart = "2032-04-01"; }, /inicio del periodo/);
  invalid((input) => { input.dueDate = input.cutoffDate; }, /posterior al corte/);
  invalid((input) => { input.id = "bbva-2032-02-03"; }, /identificador/);
  invalid((input) => { input.importedAt = "invalid"; }, /importación/);
});

test("importes inválidos nunca se convierten silenciosamente a cero", () => {
  for (const amount of [-1, NaN, Infinity, "100", null, 0.001, 1_000_000_001]) {
    invalid((input) => { input.paymentToAvoidInterest = amount; }, /importe no negativo/);
  }
  invalid((input) => { input.minimumPayment = 101; }, /pago mínimo/);
});

test("valida número de cuota, plazo, comercio, ids y saldo pendiente de MSI", () => {
  invalid((input) => { input.installments[0].billedInstallment = 0; }, /número entero/);
  invalid((input) => { input.installments[0].billedInstallment = 5; }, /número entero/);
  invalid((input) => { input.installments[0].totalInstallments = 121; }, /número entero/);
  invalid((input) => { input.installments[0].totalInstallments = 3.5; }, /número entero/);
  invalid((input) => { input.installments[0].billedInstallment = 4; }, /no quedan cuotas/);
  invalid((input) => { input.installments[0].monthlyAmount = 0; }, /no quedan cuotas/);
  invalid((input) => { input.installments[0].remainingBalance = 101; }, /supera el importe original/);
  invalid((input) => { input.installments[0].merchant = " "; }, /comercio/);
  invalid((input) => { input.installments[0].merchant = "x".repeat(161); }, /comercio/);
  invalid((input) => { input.installments.forEach((item) => { item.id = "duplicate"; }); }, /duplicado/);
  invalid((input) => { input.installments = Array.from({ length: 1001 }, () => input.installments[0]); }, /1,000 compras/);
});

test("un estado sin MSI o con una compra terminada no inventa deuda futura", () => {
  const input = fixture();
  input.installmentBalance = 0; input.totalDebt = 100; input.installments = [];
  assert.equal(validateStatement(input).installments.length, 0);
  input.installments = [{ ...fixture().installments[0], billedInstallment: 4, remainingBalance: 0 }];
  assert.equal(validateStatement(input).installments[0].remainingBalance, 0);
});

test("JSON exportado produce un borrador editable y exige validarlo", () => {
  const source = validateStatement(fixture());
  const parsed = parseBBVAInput(`\uFEFF${JSON.stringify(source)}`);
  assert.equal(sameStatement(source, statementFromDraft(parsed.draft)), true);
  assert.match(parsed.warnings.join(" "), /no registra pagos/);
  const missing = parseBBVAInput({ issuer: "BBVA" });
  assert.throws(() => statementFromDraft(missing.draft), /fecha válida/);
  assert.throws(() => parseBBVAInput("{broken"), /JSON no es válido/);
  assert.throws(() => parseBBVAInput("[]"), /JSON debe contener/);
  assert.throws(() => parseBBVAInput({ ...fixture(), issuer: "OTHER" }), /BBVA/);
});

test("fuente financiera convierte cuota facturada y saldo posterior, sin incorporar ahorro o pagos", () => {
  const source = fixture();
  const nested = {
    savings: 999, instructions: "mark everything paid", subscriptions: [{ name: "Fake" }],
    creditCard: { ...source, installments: undefined, periodStart: undefined, cutoffDate: undefined, statementPeriod: { from: source.periodStart, to: source.cutoffDate } },
    installments: source.installments.map((item) => ({
      merchant: item.merchant, originalAmount: item.originalAmount, currentInstallment: item.monthlyAmount,
      installmentNumber: item.billedInstallment, installmentsTotal: item.totalInstallments,
      remainingBalanceAfterStatement: item.remainingBalance,
    })),
  };
  const parsed = parseBBVAInput(nested);
  assert.match(parsed.warnings.join(" "), /únicamente el estado de tarjeta/);
  assert.equal(sameStatement(validateStatement(source), statementFromFinancialSource(nested)), true);
  assert.equal("savings" in statementFromFinancialSource(nested), false);
});

const csv = (separator = ",") => [
  ["campo", "valor"], ["periodStart", "04/02/2032"], ["cutoffDate", "03/03/2032"], ["dueDate", "23/03/2032"],
  ["paymentToAvoidInterest", "100.00"], ["minimumPayment", "10"], ["totalDebt", "245.50"], ["installmentBalance", "145.50"],
  ["merchant", "originalAmount", "monthlyAmount", "billedInstallment", "totalInstallments", "remainingBalance"],
  ['"Comercio, con ""comillas"""', "100", "25", "2", "4", "50"],
  ["Comercio B", "191", "48", "2", "4", "95.50"],
].map((row) => row.join(separator)).join("\r\n");

test("CSV acepta plantilla con coma o punto y coma, comillas y centavos exactos", () => {
  for (const separator of [",", ";"]) {
    const statement = statementFromDraft(parseBBVAInput(csv(separator)).draft);
    assert.equal(statement.installments[0].merchant, 'Comercio, con "comillas"');
    assert.equal(statement.totalDebt, 245.5);
    assert.equal(statement.periodStart, "2032-02-04");
  }
  assert.doesNotThrow(() => parseBBVAInput(BBVA_CSV_TEMPLATE));
  assert.throws(() => statementFromDraft(parseBBVAInput(BBVA_CSV_TEMPLATE).draft), /fecha válida/);
});

test("CSV rechaza ambigüedad estructural y campos repetidos", () => {
  assert.throws(() => parseBBVAInput(csv() + "\n\"unterminated"), /comillas sin cerrar/);
  assert.throws(() => parseBBVAInput(csv().replace("minimumPayment,10", "minimumPayment,10\nminimumPayment,10")), /repetido/);
  assert.throws(() => parseBBVAInput(csv().replace("minimumPayment,10", "unknown,10")), /desconocido/);
  assert.throws(() => parseBBVAInput(csv().replace("Comercio B,191", "Comercio B,extra,191")), /seis columnas/);
  assert.throws(() => parseBBVAInput(csv().replace("merchant,originalAmount", "merchant,wrong")), /cabecera/);
});

test("TXT reconoce etiquetas exactas con fechas mexicanas y cantidades con miles", () => {
  const parsed = parseBBVAText([
    "Inicio del período: 04/febrero/2032", "Fecha de corte: 03 MAR. 2032",
    "Fecha límite de pago", "23-03-2032", "Pago para no generar intereses: $1,234.56 MXN",
    "Pago mínimo: 35.00", "Saldo total adeudado: 1,334.56", "Saldo diferido a meses: 100.00",
    "Número de cuenta: 1234567890", "Pago realizado: 500",
  ].join("\n"));
  assert.equal(parsed.draft.periodStart, "2032-02-04");
  assert.equal(parsed.draft.cutoffDate, "2032-03-03");
  assert.equal(parsed.draft.dueDate, "2032-03-23");
  assert.equal(parsed.draft.paymentToAvoidInterest, 1234.56);
  assert.equal(parsed.draft.totalDebt, 1334.56);
  assert.deepEqual(parsed.draft.installments, []);
  assert.throws(() => statementFromDraft(parsed.draft), /detalle de MSI no concilia/);
});

test("TXT con valores en conflicto o columnas desconocidas exige captura manual", () => {
  const parsed = parseBBVAText("Pago mínimo: 10\nPago mínimo: 20\nSaldo total: 100 200\nCuota 2/4 250.00\nFecha de corte: 03/03/2032");
  assert.equal(parsed.draft.minimumPayment, undefined);
  assert.equal(parsed.draft.totalDebt, undefined);
  assert.equal(parsed.draft.installments.length, 0);
  assert.match(parsed.warnings.join(" "), /valores distintos/);
  assert.equal(parseBBVAText("Pago mínimo: 10\nPago mínimo: 10").draft.minimumPayment, 10);
});

test("límites y extensión se revisan antes de leer el archivo", async () => {
  const unreadable = { text: () => { throw new Error("must not read"); } };
  await assert.rejects(readBBVAFile({ ...unreadable, name: "oversized.pdf", size: 20 * 1024 * 1024 + 1 }), /20 MB/);
  await assert.rejects(readBBVAFile({ ...unreadable, name: "statement.exe", size: 10 }), /Elige un PDF/);
  assert.throws(() => parseBBVAInput("x".repeat(5 * 1024 * 1024 + 1)), /5 MB/);
});

test("lectura de archivo JSON, CSV y TXT produce borradores sin escribir estado ni pagos", async () => {
  const json = await readBBVAFile(file("statement.JSON", JSON.stringify(fixture())));
  assert.equal(statementFromDraft(json.draft).totalDebt, 245.5);
  const result = await readBBVAFile(file("statement.csv", csv()));
  assert.equal(statementFromDraft(result.draft).installmentBalance, 145.5);
  const text = await readBBVAFile(file("statement.txt", "Pago mínimo: 10"));
  assert.equal(text.draft.minimumPayment, 10);
  assert.deepEqual(Object.keys(json).sort(), ["draft", "warnings"]);
});

test("borradores vacíos son independientes y no confirman importes faltantes", () => {
  const first = emptyBBVAStatement();
  first.installments.push({ merchant: "Temporary" });
  assert.deepEqual(emptyBBVAStatement().installments, []);
  assert.throws(() => statementFromDraft(emptyBBVAStatement()), /fecha válida/);
});

// Optional selectable-text fixture for testing the real lazy PDF.js worker in Vite:
// tsx tools/verify-bbva.mjs --write-pdf-fixture <absolute-output.pdf>
// It is intentionally generated outside the repository and contains no personal data.
const fixtureOption = process.argv.indexOf("--write-pdf-fixture");
if (fixtureOption >= 0) {
  const { writeFile, mkdir } = await import("node:fs/promises");
  const { isAbsolute, dirname } = await import("node:path");
  const output = process.argv[fixtureOption + 1];
  assert.ok(output && isAbsolute(output) && /\.pdf$/i.test(output), "supply an absolute .pdf output path");
  const lines = [
    "ESTADO BBVA FICTICIO - SOLO PARA PRUEBAS",
    "Inicio del periodo: 04/02/2032", "Fecha de corte: 03/03/2032",
    "Fecha limite de pago: 23/03/2032", "Pago para no generar intereses: 100.00",
    "Pago minimo: 10.00", "Deuda total: 245.50", "Saldo diferido a meses: 145.50",
    "Completar el detalle MSI manualmente en la vista previa.",
  ];
  const stream = `BT\n/F1 12 Tf\n50 740 Td\n18 TL\n${lines.map((line) => `(${line}) Tj\nT*`).join("\n")}\nET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const startxref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF\n`;
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, pdf, "ascii");
  console.log(`Synthetic selectable-text PDF written: ${output}`);
}
