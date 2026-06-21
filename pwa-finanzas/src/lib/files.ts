import type { AppState, MonthlyReport } from "./types";

export function downloadText(filename: string, text: string, type = "application/json"): void {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function readJsonFile(file: File): Promise<unknown> {
  return JSON.parse(await file.text());
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
  const rows: unknown[][] = [["Mes", "Ingresos", "Gastos efectivo", "Pago TDC", "Flujo", "Ahorro cierre"]];
  for (const row of monthly) {
    rows.push([row.month, row.income, row.cashExpenses, row.cardPayment, row.flow, row.savings]);
  }
  downloadText(`reporte-mensual-${today}.csv`, toCsv(rows), "text/csv");
}
