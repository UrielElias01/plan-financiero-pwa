import { useRef, useState } from "react";
import { Check, FileText, Plus, ShieldCheck, Trash2, Upload, X } from "lucide-react";
import { BBVA_CSV_TEMPLATE, emptyBBVAStatement, readBBVAFile, sameStatement, statementFromDraft } from "./lib/bbva";
import type { BankStatement, BBVAInstallmentDraft, BBVAStatementDraft } from "./lib/bbva-types";
import { formatMoney } from "./lib/calculations";
import { downloadText } from "./lib/files";
import { dateInputValue } from "./lib/seed";
import type { AppState } from "./lib/types";

const summaryAmounts = [
  ["paymentToAvoidInterest", "Pago para no generar intereses"], ["minimumPayment", "Pago mínimo"],
  ["totalDebt", "Deuda total al corte"], ["installmentBalance", "Saldo MSI después del corte"],
] as const;
const itemAmounts = [
  ["originalAmount", "Importe original"], ["monthlyAmount", "Mensualidad incluida en el corte"],
  ["billedInstallment", "Número de cuota de este corte"], ["totalInstallments", "Meses totales"],
  ["remainingBalance", "Saldo diferido después de esta cuota"],
] as const;
const sumCents = (values: Array<number | undefined>) => values.reduce<number>((sum, value) => sum + Math.round((value || 0) * 100), 0) / 100;

export function BBVAImport({ state, onImport }: { state: AppState; onImport: (statement: BankStatement) => Promise<boolean> }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<BBVAStatementDraft | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [replaceReviewed, setReplaceReviewed] = useState(false);
  const today = dateInputValue();
  const statements = [...(state.statements || [])].sort((a, b) => b.cutoffDate.localeCompare(a.cutoffDate));
  let candidate: BankStatement | undefined;
  let validationError = "";
  if (draft) {
    try {
      const validated = statementFromDraft(draft);
      if (validated.cutoffDate > today) throw new Error("La fecha de corte está en el futuro. Importa un estado que el banco ya haya emitido; las cuotas siguientes se estiman automáticamente.");
      candidate = validated;
    }
    catch (error) { validationError = error instanceof Error ? error.message : "Revisa los datos del estado."; }
  }
  const existing = candidate && statements.find((statement) => statement.id === candidate?.id);
  const duplicate = Boolean(existing && candidate && sameStatement(existing, candidate));
  const replacement = Boolean(existing && !duplicate);
  function edit(next: BBVAStatementDraft) { setDraft(next); setReviewed(false); setReplaceReviewed(false); setMessage(""); }
  function editItem(index: number, patch: Partial<BBVAInstallmentDraft>) {
    if (draft) edit({ ...draft, installments: draft.installments.map((item, row) => row === index ? { ...item, ...patch } : item) });
  }
  async function loadFile(file: File) {
    setBusy(true); setMessage(""); setDraft(null); setReviewed(false); setReplaceReviewed(false);
    try {
      const parsed = await readBBVAFile(file);
      setDraft(parsed.draft); setWarnings(parsed.warnings);
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo leer el archivo. Captura el estado manualmente."); }
    finally { setBusy(false); if (fileInput.current) fileInput.current.value = ""; }
  }
  async function confirm() {
    if (!candidate || !reviewed || duplicate || (replacement && !replaceReviewed)) return;
    setBusy(true); setMessage("");
    try {
      if (await onImport(candidate)) {
        setDraft(null); setWarnings([]); setReviewed(false); setReplaceReviewed(false);
        setMessage("Estado confirmado. Revisa el calendario de tarjeta: el pago sigue pendiente hasta registrar un pago real.");
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo guardar el estado. Conserva los datos y vuelve a intentar."); }
    finally { setBusy(false); }
  }
  return <section className="panel grid gap-5" aria-labelledby="bbva-title">
    <div className="section-heading"><div><p className="eyebrow">BBVA · Estados de cuenta</p><h3 id="bbva-title" className="text-2xl font-black text-navy">Del corte a tu plan</h3><p className="mt-2 max-w-3xl text-sm text-slate-500">Importa el resumen de tu tarjeta y sus compras a meses. Revisa los datos antes de actualizar las estimaciones. Este registro admite una tarjeta BBVA.</p></div><FileText className="text-teal" size={28} aria-hidden="true" /></div>
    <p className="flex items-start gap-2 rounded-lg border border-blue-100 p-3 text-sm text-slate-500"><ShieldCheck size={20} className="shrink-0 text-teal" aria-hidden="true" /><span>El archivo se procesa en este dispositivo. Solo se guardan los campos que confirmas; el PDF y su texto completo no se conservan. Si activaste sincronización, los datos confirmados siguen la configuración de tu plan.</span></p>
    <div className="flex flex-wrap gap-2">
      <button type="button" className="button-primary" disabled={busy} onClick={() => fileInput.current?.click()}><Upload size={17} />{busy ? "Procesando…" : "Abrir estado de cuenta"}</button>
      <button type="button" className="button-ghost" disabled={busy} onClick={() => { edit(emptyBBVAStatement()); setWarnings([]); }}><Plus size={17} />Captura manual</button>
      <button type="button" className="button-ghost" disabled={busy} onClick={() => downloadText("plantilla-estado-bbva.csv", BBVA_CSV_TEMPLATE, "text/csv;charset=utf-8")}>Descargar plantilla CSV</button>
      <input ref={fileInput} className="hidden" type="file" accept=".pdf,.json,.csv,.txt" aria-label="Archivo de estado de cuenta BBVA" onChange={(event) => { const file = event.target.files?.[0]; if (file) void loadFile(file); }} />
    </div>
    <p className="text-xs text-slate-500">PDF con texto seleccionable, JSON, CSV de la plantilla o TXT · Hasta 20 MB. Los PDF escaneados requieren captura manual. La detección del PDF propone campos del resumen; revisa y completa el detalle de MSI.</p>
    {message && <p role="status" className="rounded-lg border border-blue-100 p-3 text-sm">{message}</p>}
    {draft && <div className="grid gap-5 border-t border-blue-100 pt-5">
      <div className="flex items-center justify-between gap-3"><div><p className="eyebrow">Paso 1 · Revisión editable</p><h4 className="mt-1 text-xl font-bold">Confirma lo que dice tu estado</h4></div><button className="button-ghost" type="button" aria-label="Descartar borrador de estado" disabled={busy} onClick={() => { setDraft(null); setWarnings([]); }}><X size={18} /></button></div>
      {warnings.length > 0 && <ul className="grid list-disc gap-1 pl-5 text-sm text-slate-500">{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}
      <div className="grid gap-3 sm:grid-cols-3">{([["periodStart", "Inicio del periodo"], ["cutoffDate", "Fecha de corte"], ["dueDate", "Fecha límite de pago"]] as const).map(([key, label]) => <label className="label" key={key}>{label}<input className="input" type="date" min="1900-01-01" max={key === "dueDate" ? "2200-12-31" : today} value={draft[key]} disabled={busy} onChange={(event) => edit({ ...draft, [key]: event.target.value })} /></label>)}</div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{summaryAmounts.map(([key, label]) => <label className="label" key={key}>{label}<input className="input" type="number" inputMode="decimal" step="0.01" min="0" max="1000000000" placeholder="Completar" value={draft[key] ?? ""} disabled={busy} onChange={(event) => edit({ ...draft, [key]: event.target.value === "" ? undefined : Number(event.target.value) })} /></label>)}</div>
      <div className="section-heading"><div><p className="eyebrow">Detalle de MSI</p><p className="mt-2 max-w-3xl text-sm text-slate-500">La cuota que aparece en este corte ya está incluida en el pago para no generar intereses. «Saldo diferido» es lo que queda después de esa cuota. No indica que el pago se haya ejecutado. Conserva el saldo exacto del banco para ajustar la última cuota.</p></div><button type="button" className="button-ghost" disabled={busy || draft.installments.length >= 1000} onClick={() => edit({ ...draft, installments: [...draft.installments, { merchant: "" }] })}><Plus size={16} />Agregar MSI</button></div>
      <div className="grid gap-3">{draft.installments.map((item, index) => <article className="installment-card" key={index}>
        <div className="mb-3 flex items-end gap-3"><label className="label grow">Comercio · Compra {index + 1}<input className="input" value={item.merchant} maxLength={160} placeholder="Nombre del comercio" disabled={busy} onChange={(event) => editItem(index, { merchant: event.target.value })} /></label><button type="button" className="button-ghost shrink-0" aria-label={`Quitar MSI ${index + 1}`} disabled={busy} onClick={() => edit({ ...draft, installments: draft.installments.filter((_, row) => row !== index) })}><Trash2 size={17} /></button></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{itemAmounts.map(([key, label]) => <label className="label" key={key}>{label}<input className="input" type="number" inputMode={key === "billedInstallment" || key === "totalInstallments" ? "numeric" : "decimal"} min={key === "billedInstallment" || key === "totalInstallments" ? 1 : 0} step={key === "billedInstallment" || key === "totalInstallments" ? 1 : "0.01"} placeholder="Completar" value={item[key] ?? ""} disabled={busy} onChange={(event) => editItem(index, { [key]: event.target.value === "" ? undefined : Number(event.target.value) })} /></label>)}</div>
      </article>)}</div>
      {!draft.installments.length && <p className="rounded-lg border border-dashed border-blue-100 p-4 text-sm text-slate-500">No hay compras MSI detalladas. Si el saldo diferido es mayor que cero, agrega todas las compras para que concilie.</p>}
      <div className="rounded-lg border border-blue-100 p-4"><p className="eyebrow">Paso 2 · Conciliación</p><div className="mt-3 grid gap-2 text-sm sm:grid-cols-2"><p>Pago requerido + saldo MSI: <strong>{formatMoney(sumCents([draft.paymentToAvoidInterest, draft.installmentBalance]))}</strong></p><p>Deuda del estado: <strong>{draft.totalDebt === undefined ? "Por completar" : formatMoney(draft.totalDebt)}</strong></p><p>Suma del detalle MSI: <strong>{formatMoney(sumCents(draft.installments.map((item) => item.remainingBalance)))}</strong></p><p>Saldo MSI del estado: <strong>{draft.installmentBalance === undefined ? "Por completar" : formatMoney(draft.installmentBalance)}</strong></p></div>{validationError ? <p className="mt-3 text-sm text-amber-300" role="status">{validationError}</p> : <p className="mt-3 flex items-center gap-2 text-sm text-teal"><Check size={16} />Los importes concilian al centavo.</p>}</div>
      {candidate && <div className="grid gap-3">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["Requerido por el estado", candidate.paymentToAvoidInterest], ["Programado al vencimiento", candidate.paymentToAvoidInterest], ["Pagos creados al importar", 0], ["Pendiente antes de abonos reales", candidate.paymentToAvoidInterest]].map(([label, value]) => <div className="rounded-lg border border-blue-100 p-3" key={String(label)}><p className="text-xs text-slate-500">{label}</p><strong className="mt-1 block">{formatMoney(value)}</strong></div>)}</div>
        <p className="text-sm text-slate-500">El corte más reciente es la base del calendario. Las compras anteriores ya incluidas en ese corte no se suman otra vez. Los abonos reales que hayas registrado se aplican por separado; importar este resumen no descuenta dinero de tu ahorro.</p>
        {duplicate ? <p className="rounded-lg border border-blue-100 p-3 text-sm" role="status">Este estado ya está registrado con los mismos importes y MSI. No se volverá a agregar.</p> : <>
          {replacement && existing && <div className="rounded-lg border border-amber-300 p-4"><p className="font-semibold">Ya existe el corte {existing.cutoffDate}. Esta importación lo reemplazará.</p><p className="mt-2 text-sm">Pago requerido: {formatMoney(existing.paymentToAvoidInterest)} → {formatMoney(candidate.paymentToAvoidInterest)}. Deuda: {formatMoney(existing.totalDebt)} → {formatMoney(candidate.totalDebt)}. Compras MSI: {existing.installments.length} → {candidate.installments.length}.</p><p className="mt-2 text-sm text-slate-500">Revisa también fechas, saldos y detalle de cuotas arriba. El historial de este corte se actualizará y el calendario se recalculará.</p><label className="mt-3 flex items-start gap-2 text-sm"><input type="checkbox" checked={replaceReviewed} disabled={busy} onChange={(event) => setReplaceReviewed(event.target.checked)} />Acepto reemplazar los datos de este corte con el resumen revisado.</label></div>}
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={reviewed} disabled={busy} onChange={(event) => setReviewed(event.target.checked)} />Revisé las fechas, los importes y cada MSI contra mi estado. Entiendo que debo registrar un pago real cuando lo efectúe.</label>
        </>}
      </div>}
      <div className="flex flex-wrap gap-2"><button className="button-primary" type="button" disabled={busy || !candidate || !reviewed || duplicate || (replacement && !replaceReviewed)} onClick={() => void confirm()}><Check size={17} />{busy ? "Guardando…" : replacement ? "Confirmar reemplazo del corte" : "Confirmar estado de cuenta"}</button><button className="button-ghost" type="button" disabled={busy} onClick={() => { setDraft(null); setWarnings([]); }}>Cancelar</button></div>
    </div>}
    {statements.length > 0 && <details className="border-t border-blue-100 pt-4"><summary className="cursor-pointer text-sm font-semibold text-teal">Estados confirmados ({statements.length})</summary><div className="mt-3 grid gap-3">{statements.map((statement, index) => <article className="installment-card" key={statement.id}><div className="flex flex-wrap justify-between gap-2"><strong>Corte {statement.cutoffDate}</strong>{index === 0 && <span className="pill">Corte más reciente</span>}</div><p className="mt-2 text-sm text-slate-500">Límite {statement.dueDate} · Requerido al corte {formatMoney(statement.paymentToAvoidInterest)} · MSI futuros {formatMoney(statement.installmentBalance)} · Deuda al corte {formatMoney(statement.totalDebt)}</p><p className="mt-2 text-xs text-slate-500">Estos son los importes originales del estado. Consulta los pagos posteriores y el saldo pendiente en el calendario de tarjeta.</p><details className="mt-3 text-sm"><summary className="cursor-pointer text-teal">Ver {statement.installments.length} compras MSI</summary><div className="mt-2 grid gap-2">{statement.installments.map((item) => <p key={item.id}>{item.merchant} · Cuota del corte {item.billedInstallment}/{item.totalInstallments} · {formatMoney(item.monthlyAmount)} · Diferido {formatMoney(item.remainingBalance)}</p>)}</div></details></article>)}</div></details>}
  </section>;
}
