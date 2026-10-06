import { datePeriodId, toCents } from "./calculations";
import { categorize } from "./outlook";
import type { BankStatement, StatementMovement } from "./bbva-types";
import type { AppState, Transaction } from "./types";

/**
 * Purchases that come from outside the manual form: rows of a bank statement or tickets from the
 * Mandado app. Each one has a stable externalId so importing the same file twice adds nothing.
 */
export type ImportCandidate = {
  externalId: string;
  source: "statement" | "mandado";
  date: string;
  description: string;
  amount: number;
  category: string;
  method: "credit" | "cash";
};

const DAY = 86_400_000;
const daysApart = (a: string, b: string) => Math.abs(Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / DAY;

/**
 * The same purchase recorded elsewhere: by hand, or by the other import source, with the same amount
 * at most 2 days apart. Rows of one source never match each other: two equal tickets are two purchases.
 */
export function findMatchingPurchase(transactions: Transaction[], candidate: ImportCandidate, used = new Set<string>()): Transaction | undefined {
  return transactions.find((entry) => entry.externalId === candidate.externalId)
    || transactions.find((entry) => !used.has(entry.id) && entry.source !== candidate.source && (entry.method === "credit" || entry.method === "cash") && toCents(entry.amount) === toCents(candidate.amount) && daysApart(entry.date, candidate.date) <= 2);
}

export function candidateTransaction(candidate: ImportCandidate): Transaction {
  return {
    id: `${candidate.source}:${candidate.externalId}`, externalId: candidate.externalId, source: candidate.source,
    date: candidate.date, description: candidate.description, amount: candidate.amount, category: candidate.category,
    method: candidate.method, periodId: datePeriodId(candidate.date), shared: false, installments: 1, totalInstallments: 1,
    currentInstallment: 0, status: "confirmed", affectsSavings: candidate.method === "cash", fundingSource: "savings",
  };
}

/** Splits candidates into new purchases and ones that are already recorded (also within the same file). */
export function planImport(state: AppState, candidates: ImportCandidate[]): { add: Transaction[]; duplicates: ImportCandidate[] } {
  const add: Transaction[] = []; const duplicates: ImportCandidate[] = [];
  // Each existing purchase can absorb only one imported row.
  const used = new Set<string>();
  for (const candidate of candidates) {
    const match = findMatchingPurchase(state.transactions, candidate, used) || add.find((entry) => entry.externalId === candidate.externalId);
    if (match) { used.add(match.id); duplicates.push(candidate); continue; }
    add.push(candidateTransaction(candidate));
  }
  return { add, duplicates };
}

/**
 * Statement purchases are history: they are dated on or before the cut-off, so the card ledger
 * (which starts from the statement balance) never counts them as new debt.
 */
export function statementCandidates(statement: Pick<BankStatement, "cutoffDate">, movements: StatementMovement[]): ImportCandidate[] {
  return movements.filter((movement) => movement.date <= statement.cutoffDate && movement.amount > 0).map((movement, index) => ({
    externalId: `bbva:${statement.cutoffDate}:${index + 1}:${toCents(movement.amount)}`, source: "statement", date: movement.date,
    description: movement.description, amount: movement.amount, category: categorize(movement.description), method: "credit",
  }));
}

export const MANDADO_FORMAT = "mandado-gastos";

/**
 * Contract for the Mandado app export (docs/INTEGRACION_MANDADO.md):
 * { formato: "mandado-gastos", version: 1, compras: [{ id, fecha: "AAAA-MM-DD", tienda, totalCentavos, metodo? }] }
 * metodo is "tarjeta" | "debito" | "efectivo"; when missing, `defaultMethod` is used.
 */
export function parseMandadoExport(input: unknown, defaultMethod: "credit" | "cash" = "credit"): ImportCandidate[] {
  const source = input && typeof input === "object" ? input as Record<string, unknown> : {};
  if (source.formato !== MANDADO_FORMAT) throw new Error("El archivo no es una exportación de gastos de Mandado.");
  if (source.version !== 1) throw new Error("Esta versión de la exportación de Mandado no es compatible. Actualiza ambas apps.");
  if (!Array.isArray(source.compras) || source.compras.length > 10_000) throw new Error("La exportación de Mandado no contiene una lista de compras válida.");
  return source.compras.map((row, index) => {
    const item = row && typeof row === "object" ? row as Record<string, unknown> : {};
    const label = `Compra ${index + 1}`;
    const id = typeof item.id === "string" || typeof item.id === "number" ? String(item.id) : "";
    const date = typeof item.fecha === "string" ? item.fecha.slice(0, 10) : "";
    const cents = item.totalCentavos;
    if (!id) throw new Error(`${label}: falta el identificador del ticket.`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) !== date) throw new Error(`${label}: la fecha no es válida.`);
    if (typeof cents !== "number" || !Number.isInteger(cents) || cents <= 0 || cents > 100_000_000_00) throw new Error(`${label}: el total debe ser un número de centavos mayor que cero.`);
    const store = typeof item.tienda === "string" && item.tienda.trim() ? item.tienda.trim().slice(0, 80) : "Súper";
    const method = item.metodo === "tarjeta" ? "credit" : item.metodo === "debito" || item.metodo === "efectivo" ? "cash" : defaultMethod;
    return { externalId: `mandado:${id}`, source: "mandado" as const, date, description: `Mandado · ${store}`, amount: cents / 100, category: "Mandado", method };
  });
}
