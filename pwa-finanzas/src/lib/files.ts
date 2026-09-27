import type { AppState, MonthlyReport } from "./types";
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

export function exportMonthlyCsv(monthly: MonthlyReport[], today: string): void {
  const rows: unknown[][] = [["Mes", "Ingresos", "Gastos y apartados", "Pago TDC", "Desde apartados", "Flujo", "Ahorro libre al cierre"]];
  for (const row of monthly) {
    rows.push([row.month, row.income, row.cashExpenses, row.cardPayment, row.reserveUsed || 0, row.flow, row.savings]);
  }
  downloadText(`reporte-mensual-${today}.csv`, toCsv(rows), "text/csv");
}
