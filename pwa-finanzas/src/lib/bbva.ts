import type { BankStatement, BankStatementInstallment, BBVAParseResult, BBVAStatementDraft, StatementMovement } from "./bbva-types";

type RecordValue = Record<string, unknown>;
const MAX_AMOUNT = 1_000_000_000;
const centavos = (value: number) => Math.round(value * 100);
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const object = (value: unknown): RecordValue => value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : {};
const string = (value: unknown) => typeof value === "string" ? value : "";
const numeric = (value: unknown) => typeof value === "number" ? value : undefined;

export const emptyBBVAStatement = (): BBVAStatementDraft => ({ periodStart: "", cutoffDate: "", dueDate: "", installments: [] });
export const statementId = (cutoffDate: string) => `bbva-${cutoffDate}`;

/** Small stable identifier, not a security hash; includes occurrence so equal purchases remain distinct. */
function installmentId(item: Omit<BankStatementInstallment, "id">, index: number): string {
  let hash = 2166136261;
  for (const char of JSON.stringify(item)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return `msi-${(hash >>> 0).toString(36)}-${index + 1}`;
}

function fail(message: string): never { throw new Error(message); }
function validDate(value: unknown, label: string): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fail(`Completa ${label} con una fecha válida.`);
  const date = new Date(`${value}T12:00:00Z`);
  if (Number(value.slice(0, 4)) < 1900 || Number(value.slice(0, 4)) > 2200 || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return fail(`${label}: la fecha no existe o está fuera del rango 1900–2200.`);
  return value;
}
function amount(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > MAX_AMOUNT || Math.abs(value * 100 - centavos(value)) > 0.00001) return fail(`${label}: escribe un importe no negativo con hasta dos decimales.`);
  return centavos(value) / 100;
}
function integer(value: unknown, label: string, max = 120): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > max) return fail(`${label}: escribe un número entero entre 1 y ${max}.`);
  return value;
}

/** Strict whitelist: raw statement text, account IDs, payment claims and source instructions are discarded. */
export function validateStatement(input: unknown): BankStatement {
  const source = object(input);
  if (source.issuer !== "BBVA") return fail("Este importador admite una tarjeta BBVA. Revisa el banco del archivo.");
  const periodStart = validDate(source.periodStart, "Inicio del periodo");
  const cutoffDate = validDate(source.cutoffDate, "Fecha de corte");
  const dueDate = validDate(source.dueDate, "Fecha límite de pago");
  if (periodStart > cutoffDate) return fail("El inicio del periodo debe ser anterior o igual al corte.");
  if (dueDate <= cutoffDate) return fail("La fecha límite debe ser posterior al corte.");
  const paymentToAvoidInterest = amount(source.paymentToAvoidInterest, "Pago para no generar intereses");
  const minimumPayment = amount(source.minimumPayment, "Pago mínimo");
  const totalDebt = amount(source.totalDebt, "Deuda total");
  const installmentBalance = amount(source.installmentBalance, "Saldo MSI después del corte");
  if (minimumPayment > paymentToAvoidInterest) return fail("El pago mínimo no puede superar el pago para no generar intereses en este modelo. Revisa el estado antes de importar.");
  if (!Array.isArray(source.installments) || source.installments.length > 1000) return fail("La lista de MSI es inválida o supera 1,000 compras.");
  const ids = new Set<string>();
  const installments = source.installments.map((row, index): BankStatementInstallment => {
    const item = object(row);
    const label = `MSI ${index + 1}`;
    const merchant = string(item.merchant).trim();
    if (!merchant || merchant.length > 160) return fail(`${label}: completa el comercio (hasta 160 caracteres).`);
    const totalInstallments = integer(item.totalInstallments, `${label}, meses totales`);
    const billedInstallment = integer(item.billedInstallment, `${label}, cuota incluida en el corte`, totalInstallments);
    const originalAmount = amount(item.originalAmount, `${label}, importe original`);
    const monthlyAmount = amount(item.monthlyAmount, `${label}, mensualidad`);
    const remainingBalance = amount(item.remainingBalance, `${label}, saldo diferido`);
    if (remainingBalance > originalAmount) return fail(`${label}: el saldo diferido supera el importe original.`);
    if (remainingBalance > 0 && (billedInstallment === totalInstallments || monthlyAmount === 0)) return fail(`${label}: tiene saldo diferido pero no quedan cuotas futuras válidas.`);
    const sanitized = { merchant, originalAmount, monthlyAmount, billedInstallment, totalInstallments, remainingBalance };
    const id = string(item.id) || installmentId(sanitized, index);
    if (id.length > 200 || ids.has(id)) return fail(`${label}: identificador duplicado o inválido.`);
    ids.add(id);
    return { id, ...sanitized };
  });
  if (centavos(totalDebt) !== centavos(paymentToAvoidInterest) + centavos(installmentBalance)) return fail("No concilia la deuda total con el pago para no generar intereses más el saldo MSI. Corrige los importes antes de confirmar.");
  if (installments.reduce((sum, item) => sum + centavos(item.remainingBalance), 0) !== centavos(installmentBalance)) return fail("El detalle de MSI no concilia con el saldo MSI del estado. Completa o corrige las compras pendientes antes de confirmar.");
  const id = statementId(cutoffDate);
  if (source.id !== undefined && source.id !== id) return fail("El identificador del estado no coincide con BBVA y su fecha de corte.");
  const importedAt = source.importedAt === undefined ? new Date().toISOString() : string(source.importedAt);
  if (!importedAt || !Number.isFinite(Date.parse(importedAt))) return fail("La fecha de importación es inválida.");
  const optionalAmount = (value: unknown, label: string) => value === undefined || value === null ? undefined : amount(value, label);
  const minimumPlusInstallments = optionalAmount(source.minimumPlusInstallments, "Pago mínimo + mensualidades");
  if (minimumPlusInstallments !== undefined && (minimumPlusInstallments < minimumPayment || minimumPlusInstallments > paymentToAvoidInterest)) return fail("El pago mínimo + mensualidades debe estar entre el pago mínimo y el pago para no generar intereses.");
  const creditLimit = optionalAmount(source.creditLimit, "Límite de crédito");
  const annualInterestRate = optionalAmount(source.annualInterestRate, "Tasa de interés anual");
  if (annualInterestRate !== undefined && annualInterestRate > 500) return fail("Tasa de interés anual: escribe el porcentaje anual, por ejemplo 58.52.");
  return {
    id, issuer: "BBVA", periodStart, cutoffDate, dueDate, paymentToAvoidInterest, minimumPayment, totalDebt, installmentBalance, installments, importedAt,
    ...(minimumPlusInstallments !== undefined ? { minimumPlusInstallments } : {}),
    ...(creditLimit !== undefined ? { creditLimit } : {}),
    ...(annualInterestRate !== undefined ? { annualInterestRate } : {}),
  };
}

export function statementFromDraft(draft: BBVAStatementDraft): BankStatement {
  return validateStatement({ ...draft, issuer: "BBVA" });
}

export function sameStatement(a: BankStatement, b: BankStatement): boolean {
  // Compare financial content, independent of JSON property order, import time or row IDs.
  // Repeated identical purchases stay repeated: they can represent separate real purchases.
  const canonical = (statement: BankStatement) => JSON.stringify([
    statement.issuer, statement.periodStart, statement.cutoffDate, statement.dueDate,
    statement.paymentToAvoidInterest, statement.minimumPayment, statement.totalDebt,
    statement.installmentBalance, statement.minimumPlusInstallments ?? null, statement.creditLimit ?? null, statement.annualInterestRate ?? null,
    statement.installments.map((item) => JSON.stringify([
      item.merchant, item.originalAmount, item.monthlyAmount, item.billedInstallment,
      item.totalInstallments, item.remainingBalance,
    ])).sort(),
  ]);
  return canonical(a) === canonical(b);
}

function parseObject(input: unknown): BBVAParseResult {
  const source = object(input);
  const nested = Object.keys(object(source.creditCard)).length > 0;
  const card = nested ? object(source.creditCard) : source;
  if (card.issuer !== "BBVA") return fail("El JSON debe contener un estado BBVA o una fuente financiera con creditCard.issuer igual a BBVA.");
  const period = object(card.statementPeriod);
  const rows = nested ? source.installments : card.installments;
  if (rows !== undefined && (!Array.isArray(rows) || rows.length > 1000)) return fail("El detalle MSI debe ser una lista de hasta 1,000 compras.");
  const draft: BBVAStatementDraft = {
    periodStart: string(card.periodStart ?? period.from), cutoffDate: string(card.cutoffDate ?? period.to), dueDate: string(card.dueDate),
    paymentToAvoidInterest: numeric(card.paymentToAvoidInterest), minimumPayment: numeric(card.minimumPayment), totalDebt: numeric(card.totalDebt), installmentBalance: numeric(card.installmentBalance),
    minimumPlusInstallments: numeric(card.minimumPlusInstallments), creditLimit: numeric(card.creditLimit), annualInterestRate: numeric(card.annualInterestRate),
    installments: (Array.isArray(rows) ? rows : []).map((row) => {
      const item = object(row);
      return { merchant: string(item.merchant), originalAmount: numeric(item.originalAmount), monthlyAmount: numeric(nested ? item.currentInstallment : item.monthlyAmount), billedInstallment: numeric(nested ? item.installmentNumber : item.billedInstallment), totalInstallments: numeric(nested ? item.installmentsTotal : item.totalInstallments), remainingBalance: numeric(nested ? item.remainingBalanceAfterStatement : item.remainingBalance) };
    }),
  };
  return { draft, warnings: ["Revisa las fechas, los importes y cada MSI. Importar un estado no registra pagos ejecutados.", ...(nested ? ["De esta fuente se lee únicamente el estado de tarjeta y sus MSI. El ahorro, sueldo y suscripciones se gestionan en el plan o mediante su respaldo compatible."] : [])] };
}

function parseMoney(value: string): number | undefined {
  const cleaned = value.replace(/MXN/gi, "").replace(/\$/g, "").trim();
  if (!/^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?$/.test(cleaned)) return undefined;
  return Number(cleaned.replace(/,/g, ""));
}
function parseDate(value: string): string {
  const text = normalize(value).replace(/\./g, "");
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const match = text.match(/^(\d{1,2})[\s/-]+([a-z]+|\d{1,2})[\s/-]+(\d{4})$/);
  if (!match) return "";
  const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const month = /^\d+$/.test(match[2]) ? Number(match[2]) : months.indexOf(match[2].slice(0, 3)) + 1;
  return month ? `${match[3]}-${String(month).padStart(2, "0")}-${match[1].padStart(2, "0")}` : "";
}

const MONEY = "\\$\\s?((?:\\d{1,3}(?:,\\d{3})+|\\d+)\\.\\d{2})";
const DAY = "(\\d{1,2}-[a-z]{3}-\\d{4})";
/** Footnote markers ("Pago mínimo: 4 $120.00") sit between labels and amounts in BBVA statements. */
const NOTE = "(?:\\s*\\d{1,2})?";
function money(text: string, label: string): number | undefined {
  const match = text.match(new RegExp(`${label}:?${NOTE}\\s*${MONEY}`));
  return match ? Number(match[1].replace(/,/g, "")) : undefined;
}
function cleanMerchant(value: string): string { return value.replace(/\s*;\s*tarjeta digital.*$/i, "").replace(/\s+/g, " ").trim(); }

/**
 * Reads the layout of a BBVA credit card statement (summary, MSI table and regular purchases).
 * Every value is proposed for review; the statement must still reconcile before it is accepted.
 */
export function parseBBVAStatementText(text: string): BBVAParseResult | null {
  const original = text.split(/\r?\n/).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
  const lines = original.map(normalize);
  const flat = lines.join("\n");
  if (!/bbva/.test(flat) || !/pago para no generar intereses/.test(flat)) return null;
  const draft = emptyBBVAStatement();
  const warnings = ["Revisa que los importes coincidan con tu estado de cuenta antes de confirmar. Importar no registra pagos."];
  const period = flat.match(new RegExp(`periodo:?\\s+${DAY}\\s+al\\s+${DAY}`));
  if (period) { draft.periodStart = parseDate(period[1]); draft.cutoffDate = parseDate(period[2]); }
  const cutoff = flat.match(new RegExp(`fecha de corte:?\\s+${DAY}`));
  if (cutoff) draft.cutoffDate = parseDate(cutoff[1]);
  const due = flat.match(new RegExp(`fecha limite de pago:?${NOTE}\\s*(?:[a-z]+,?\\s+)?${DAY}`));
  if (due) draft.dueDate = parseDate(due[1]);
  draft.paymentToAvoidInterest = money(flat, "pago para no generar intereses");
  draft.minimumPlusInstallments = money(flat, "pago minimo \\+ compras y cargos? diferidos a meses");
  draft.minimumPayment = money(flat, "pago minimo");
  draft.installmentBalance = money(flat, "saldo cargos? a meses");
  draft.totalDebt = money(flat, "saldo deudor total");
  draft.creditLimit = money(flat, "limite de credito");
  const rate = flat.match(/tasa de interes anual(?: variable)?[\s\S]{0,40}?sin iva\s+(\d{1,3}(?:\.\d{1,2})?)\s?%/);
  if (rate) draft.annualInterestRate = Number(rate[1]);

  // Rows: date, merchant, original amount, pending balance, required payment, "N de M", rate.
  const msiRow = new RegExp(`^${DAY}\\s+(.+?)\\s+${MONEY}\\s+${MONEY}\\s+${MONEY}\\s+(\\d{1,3})\\s+de\\s+(\\d{1,3})(?:\\s+[\\d.]+\\s?%)?$`);
  const purchaseRow = new RegExp(`^${DAY}\\s+${DAY}\\s+(.+?)\\s+([+-])\\s?${MONEY}$`);
  let section: "msi" | "msi-interest" | "regular" | null = null;
  const movements: StatementMovement[] = [];
  let interestBearing = 0;
  lines.forEach((line, index) => {
    if (line.startsWith("compras y cargos diferidos a meses sin intereses")) { section = "msi"; return; }
    if (line.startsWith("compras y cargos diferidos a meses con intereses")) { section = "msi-interest"; return; }
    if (/^cargos,? ?compras y abonos regulares/.test(line)) { section = "regular"; return; }
    if (/^total cargos|^atencion de quejas|^notas aclaratorias/.test(line)) { section = null; return; }
    if (section === "msi" || section === "msi-interest") {
      const row = line.match(msiRow);
      if (!row) return;
      if (section === "msi-interest") { interestBearing += 1; return; }
      const merchant = cleanMerchant(original[index].slice(row[1].length).trim().split(/\s+\$/)[0]);
      draft.installments.push({ merchant, originalAmount: Number(row[3].replace(/,/g, "")), remainingBalance: Number(row[4].replace(/,/g, "")), monthlyAmount: Number(row[5].replace(/,/g, "")), billedInstallment: Number(row[6]), totalInstallments: Number(row[7]) });
      return;
    }
    if (section === "regular") {
      const row = line.match(purchaseRow);
      if (!row || row[4] !== "+") return;
      const description = cleanMerchant(original[index].replace(/^\S+\s+\S+\s+/, "").replace(/\s+[+-]\s?\$\s?[\d,]+\.\d{2}$/, ""));
      // "05 DE 06 COMERCIO" rows are installments of older purchases, not new spending.
      if (/^\d{1,3} de \d{1,3} /i.test(description)) return;
      movements.push({ date: parseDate(row[1]), description, amount: Number(row[5].replace(/,/g, "")) });
    }
  });
  if (draft.installmentBalance === undefined && draft.installments.length) draft.installmentBalance = draft.installments.reduce((total, item) => total + centavos(item.remainingBalance || 0), 0) / 100;
  if (draft.totalDebt === undefined && draft.paymentToAvoidInterest !== undefined && draft.installmentBalance !== undefined) draft.totalDebt = (centavos(draft.paymentToAvoidInterest) + centavos(draft.installmentBalance)) / 100;
  if (interestBearing) warnings.push(`El estado tiene ${interestBearing} compra(s) a meses CON intereses. Este plan solo modela meses sin intereses: revisa esos cargos manualmente.`);
  if (draft.installmentBalance && !draft.installments.length) warnings.push("No se encontró el detalle de compras a meses. Agrégalas manualmente para que concilie.");
  const missing = [["fecha de corte", draft.cutoffDate], ["fecha límite", draft.dueDate], ["pago para no generar intereses", draft.paymentToAvoidInterest], ["pago mínimo", draft.minimumPayment]].filter(([, value]) => value === undefined || value === "").map(([label]) => label);
  if (missing.length) warnings.push(`No se reconoció: ${missing.join(", ")}. Complétalo manualmente.`);
  return { draft, warnings, movements };
}

/** Label-only extraction: no guessing which numeric columns contain debt or payments. */
export function parseBBVAText(text: string): BBVAParseResult {
  const statement = parseBBVAStatementText(text);
  if (statement) return statement;
  const draft = emptyBBVAStatement();
  const lines = text.split(/\r?\n/).map(normalize).filter(Boolean);
  const warnings = ["El formato del PDF puede variar. Solo se proponen campos con etiquetas reconocidas; completa lo que falte y revisa los MSI manualmente. No se importan movimientos ni pagos desde el texto."];
  const labels: Record<"periodStart" | "cutoffDate" | "dueDate" | "paymentToAvoidInterest" | "minimumPayment" | "totalDebt" | "installmentBalance", string[]> = {
    periodStart: ["inicio del periodo", "fecha inicial del periodo"], cutoffDate: ["fecha de corte", "corte"], dueDate: ["fecha limite de pago", "fecha limite"],
    paymentToAvoidInterest: ["pago para no generar intereses"], minimumPayment: ["pago minimo"], totalDebt: ["deuda total", "saldo total adeudado", "saldo total"], installmentBalance: ["saldo msi despues del corte", "saldo diferido a meses", "saldo pendiente a meses", "saldo de compras a meses sin intereses"],
  };
  for (const [key, alternatives] of Object.entries(labels)) {
    const values = new Set<string>();
    for (let index = 0; index < lines.length; index += 1) for (const label of alternatives) {
      const match = lines[index].match(new RegExp(`^${label}(?:\\s*[:=]\\s*|\\s+|$)(.*)$`));
      if (!match) continue;
      const raw = match[1] || lines[index + 1] || "";
      const value = ["periodStart", "cutoffDate", "dueDate"].includes(key) ? parseDate(raw) : parseMoney(raw);
      if (value !== undefined && value !== "") values.add(String(value));
    }
    if (values.size === 1) {
      const value = [...values][0];
      if (key === "periodStart" || key === "cutoffDate" || key === "dueDate") draft[key] = value;
      else draft[key as "paymentToAvoidInterest" | "minimumPayment" | "totalDebt" | "installmentBalance"] = Number(value);
    } else if (values.size > 1) warnings.push(`Se encontraron valores distintos para ${alternatives[0]}. Escríbelo manualmente.`);
  }
  return { draft, warnings };
}

export const BBVA_CSV_TEMPLATE = "campo,valor\nperiodStart,\ncutoffDate,\ndueDate,\npaymentToAvoidInterest,\nminimumPayment,\ntotalDebt,\ninstallmentBalance,\n\nmerchant,originalAmount,monthlyAmount,billedInstallment,totalInstallments,remainingBalance\n";

function csvRows(text: string): string[][] {
  const firstLine = text.split(/\r?\n/)[0];
  const separator = firstLine.includes(";") ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') { cell += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === separator && !quoted) { row.push(cell.trim()); cell = ""; }
    else if (char === "\n" && !quoted) { row.push(cell.trim()); rows.push(row); row = []; cell = ""; }
    else cell += char;
  }
  if (quoted) return fail("El CSV tiene comillas sin cerrar. Revisa el archivo.");
  row.push(cell.trim()); rows.push(row);
  return rows.filter((items) => items.some(Boolean));
}
function parseCsv(text: string): BBVAParseResult {
  const rows = csvRows(text);
  if (normalize(rows[0]?.[0] || "") !== "campo" || normalize(rows[0]?.[1] || "") !== "valor") return fail("Usa la plantilla CSV del importador: resumen campo,valor y después la tabla de MSI.");
  const card: RecordValue = { issuer: "BBVA", installments: [] };
  const allowed = ["periodStart", "cutoffDate", "dueDate", "paymentToAvoidInterest", "minimumPayment", "totalDebt", "installmentBalance"];
  const header = ["merchant", "originalAmount", "monthlyAmount", "billedInstallment", "totalInstallments", "remainingBalance"];
  const seen = new Set<string>();
  let inTable = false;
  for (const row of rows.slice(1)) {
    if (row[0] === "merchant") {
      if (inTable || row.join("|") !== header.join("|")) return fail("La cabecera de MSI no coincide con la plantilla CSV.");
      inTable = true; continue;
    }
    if (inTable) {
      if (row.length !== header.length) return fail("Cada fila MSI del CSV debe tener las seis columnas de la plantilla.");
      const item: RecordValue = {};
      header.forEach((key, index) => { item[key] = index === 0 ? row[index] : parseMoney(row[index]); });
      (card.installments as unknown[]).push(item);
    } else {
      if (!allowed.includes(row[0]) || row.length !== 2 || seen.has(row[0])) return fail("El resumen CSV contiene un campo desconocido, repetido o columnas adicionales.");
      seen.add(row[0]);
      card[row[0]] = ["periodStart", "cutoffDate", "dueDate"].includes(row[0]) ? parseDate(row[1]) : parseMoney(row[1]);
    }
  }
  return parseObject(card);
}

export function parseBBVAInput(input: unknown): BBVAParseResult {
  if (typeof input !== "string") return parseObject(input);
  const text = input.replace(/^\uFEFF/, "").trim();
  if (text.length > 5 * 1024 * 1024) return fail("El texto supera el límite de 5 MB.");
  if (text.startsWith("{") || text.startsWith("[")) {
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { return fail("El JSON no es válido. Revisa el archivo antes de continuar."); }
    return parseObject(parsed);
  }
  if (/^campo\s*[,;]/i.test(text)) return parseCsv(text);
  return parseBBVAText(text);
}

export function statementFromFinancialSource(input: unknown): BankStatement {
  return statementFromDraft(parseBBVAInput(input).draft);
}

/** Browser-only lazy PDF extraction keeps the engine and JSON validator independent of PDF.js. */
export async function readBBVAFile(file: File): Promise<BBVAParseResult> {
  if (file.size > 20 * 1024 * 1024) return fail("El archivo supera 20 MB. Usa un archivo más pequeño.");
  if (!/\.(pdf|json|csv|txt)$/i.test(file.name)) return fail("Elige un PDF con texto seleccionable, JSON, CSV de la plantilla o TXT.");
  if (!/\.pdf$/i.test(file.name)) return parseBBVAInput(await file.text());
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), useSystemFonts: false, enableXfa: false });
  try {
    const pdf = await task.promise;
    if (pdf.numPages > 80) return fail("El PDF supera 80 páginas. Usa únicamente el estado de cuenta.");
    const lines: string[] = [];
    let characters = 0;
    for (let index = 1; index <= pdf.numPages; index += 1) {
      const page = await pdf.getPage(index);
      const content = await page.getTextContent();
      let line = "", y: number | undefined;
      for (const item of content.items) {
        if (!("str" in item)) continue;
        const nextY = item.transform[5];
        if (y !== undefined && Math.abs(nextY - y) > 3) { lines.push(line); line = ""; }
        line += `${item.str} `;
        y = nextY;
        characters += item.str.length;
        if (characters > 5 * 1024 * 1024) return fail("El PDF contiene demasiado texto para procesarlo.");
        if (item.hasEOL) { lines.push(line); line = ""; y = undefined; }
      }
      if (line) lines.push(line);
      page.cleanup();
    }
    if (lines.join("").trim().length < 30) return fail("No se encontró texto seleccionable. Captura el estado manualmente o usa la plantilla CSV. Esta función no realiza OCR.");
    return parseBBVAText(lines.join("\n"));
  } catch (error) {
    if (error instanceof Error && error.name === "PasswordException") return fail("El PDF está protegido con contraseña. Usa una copia desbloqueada localmente o captura los datos manualmente.");
    if (error instanceof Error && error.name === "InvalidPDFException") return fail("El archivo no contiene un PDF válido. Vuelve a exportarlo o captura el estado manualmente.");
    throw error;
  } finally { await task.destroy(); }
}
