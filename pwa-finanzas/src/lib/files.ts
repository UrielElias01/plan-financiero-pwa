import type { AppState, Transaction } from "./types";
import { validateBackup } from "./validation";

export function downloadText(filename: string, text: string, type = "application/json"): void {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function readJsonFile(file: File): Promise<Partial<AppState>> {
  if (file.size > 20 * 1024 * 1024) throw new Error("El respaldo supera el límite de 20 MB. No se modificaron tus datos.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error("No se pudo leer el archivo JSON. Elige un respaldo válido; tus datos siguen intactos.");
  }
  return validateBackup(parsed);
}

export function toCsv(rows: unknown[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const text = String(cell ?? "");
          return text.includes(",") || text.includes("\n") || text.includes('"')
            ? `"${text.replaceAll('"', '""')}"`
            : text;
        })
        .join(","),
    )
    .join("\n");
}

export function exportStateJson(state: AppState, today: string): void {
  downloadText(`plan-financiero-respaldo-${today}.json`, JSON.stringify(state, null, 2));
}

const METHOD_LABELS: Record<Transaction["method"], string> = { income: "Ingreso", credit: "Tarjeta", cash: "Débito/efectivo", card_payment: "Pago de tarjeta" };

/** One row per movement, ready for a spreadsheet. Signed: income positive, spending and payments negative. */
export function exportMovementsCsv(transactions: Transaction[], today: string): void {
  const rows: unknown[][] = [["Fecha", "Descripción", "Categoría", "Tipo", "Monto", "Mi parte", "Meses", "Estado"]];
  for (const row of [...transactions].sort((a, b) => a.date.localeCompare(b.date))) {
    const sign = row.method === "income" ? 1 : -1;
    rows.push([row.date, row.description, row.category, METHOD_LABELS[row.method], (sign * row.amount).toFixed(2), row.shared && typeof row.userAmount === "number" ? (sign * row.userAmount).toFixed(2) : "", (row.totalInstallments || 1) > 1 ? row.totalInstallments : "", row.status === "planned" ? "Programado" : "Realizado"]);
  }
  // The BOM lets Excel open accented text correctly.
  downloadText(`movimientos-${today}.csv`, `﻿${toCsv(rows)}`, "text/csv;charset=utf-8");
}
