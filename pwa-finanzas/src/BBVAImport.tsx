import { useMemo, useRef, useState } from "react";
import { Check, FileText, Plus, ShieldCheck, Trash2, TriangleAlert, Upload } from "lucide-react";
import { BBVA_CSV_TEMPLATE, emptyBBVAStatement, readBBVAFile, sameStatement, statementFromDraft } from "./lib/bbva";
import type { BankStatement, BBVAInstallmentDraft, BBVAStatementDraft, StatementMovement } from "./lib/bbva-types";
import { downloadText } from "./lib/files";
import { planImport, statementCandidates } from "./lib/imports";
import type { AppState } from "./lib/types";
import { Field, formatMoney, fullDate, shortDate } from "./ui";

const summaryFields = [
  ["paymentToAvoidInterest", "Pago para no generar intereses"], ["minimumPlusInstallments", "Pago mínimo + mensualidades"], ["minimumPayment", "Pago mínimo"],
  ["installmentBalance", "Saldo a meses después del corte"], ["totalDebt", "Saldo deudor total"], ["creditLimit", "Límite de crédito"], ["annualInterestRate", "Tasa anual (%)"],
] as const;
const itemFields = [
  ["originalAmount", "Monto original"], ["monthlyAmount", "Pago requerido (mensualidad)"], ["billedInstallment", "Núm. de pago"],
  ["totalInstallments", "De (meses)"], ["remainingBalance", "Saldo pendiente"],
] as const;
const required = new Set(["paymentToAvoidInterest", "minimumPayment", "totalDebt", "installmentBalance"]);
const sumCents = (values: Array<number | undefined>) => values.reduce<number>((sum, value) => sum + Math.round((value || 0) * 100), 0) / 100;

export function BBVAImport({ state, today, onImport }: { state: AppState; today: string; onImport: (statement: BankStatement, movements: StatementMovement[]) => Promise<boolean> }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<BBVAStatementDraft | null>(null);
  const [movements, setMovements] = useState<StatementMovement[]>([]);
  const [addMovements, setAddMovements] = useState(true);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [replaceOk, setReplaceOk] = useState(false);
  const statements = [...(state.statements || [])].sort((a, b) => b.cutoffDate.localeCompare(a.cutoffDate));
  let candidate: BankStatement | undefined;
  let validationError = "";
  if (draft) {
    try {
      const parsed = statementFromDraft(draft);
      if (parsed.cutoffDate > today) throw new Error("La fecha de corte está en el futuro. Importa un estado que el banco ya haya emitido.");
      candidate = parsed;
    } catch (error) { validationError = error instanceof Error ? error.message : "Revisa los datos del estado."; }
  }
  const existing = candidate && statements.find((statement) => statement.id === candidate?.id);
  const duplicate = Boolean(existing && candidate && sameStatement(existing, candidate));
  const replacement = Boolean(existing && !duplicate);
  const cutoff = candidate?.cutoffDate;
  const movementPlan = useMemo(() => cutoff && movements.length ? planImport(state, statementCandidates({ cutoffDate: cutoff }, movements)) : null, [cutoff, movements, state]);
  const newMovements = addMovements ? movementPlan?.add.length || 0 : 0;
  const byCategory = movementPlan ? [...movementPlan.add.reduce((map, item) => map.set(item.category, (map.get(item.category) || 0) + Math.round(item.amount * 100)), new Map<string, number>())].sort((a, b) => b[1] - a[1]) : [];
  const canConfirm = Boolean(candidate) && !busy && (!duplicate || newMovements > 0) && (!replacement || replaceOk);

  function edit(next: BBVAStatementDraft) { setDraft(next); setReplaceOk(false); setMessage(""); }
  function editItem(index: number, patch: Partial<BBVAInstallmentDraft>) { if (draft) edit({ ...draft, installments: draft.installments.map((item, row) => row === index ? { ...item, ...patch } : item) }); }
  function reset() { setDraft(null); setMovements([]); setWarnings([]); setReplaceOk(false); }
  async function loadFile(file: File) {
    setBusy(true); setMessage(""); reset();
    try {
      const parsed = await readBBVAFile(file);
      setDraft(parsed.draft); setWarnings(parsed.warnings); setMovements(parsed.movements || []); setAddMovements(true);
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo leer el archivo. Captura el estado manualmente."); }
    finally { setBusy(false); }
  }
  async function confirm() {
    if (!candidate || !canConfirm) return;
    setBusy(true); setMessage("");
    try {
      if (await onImport(candidate, addMovements ? movements : [])) { reset(); setMessage("Listo. En Inicio ves si te alcanza para el pago."); }
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo guardar. Vuelve a intentar."); }
    finally { setBusy(false); }
  }

  return <>
    <section className="card stack">
      <div className="row" style={{ alignItems: "flex-start" }}><FileText size={22} className="info" style={{ flexShrink: 0 }} /><p className="small">Sube el PDF de tu estado de cuenta BBVA. La app lee el pago, el mínimo, tus compras a meses y lo que compraste en el periodo. Tú revisas y confirmas.</p></div>
      <div className="actions">
        <button type="button" className="btn primary" disabled={busy} onClick={() => fileInput.current?.click()}><Upload size={17} />{busy ? "Leyendo…" : "Abrir estado de cuenta (PDF)"}</button>
        <button type="button" className="btn" disabled={busy} onClick={() => { reset(); setDraft(emptyBBVAStatement()); }}><Plus size={17} />Capturar a mano</button>
      </div>
      <input ref={fileInput} hidden type="file" accept=".pdf,.json,.csv,.txt" aria-label="Archivo de estado de cuenta" onChange={(event) => { const file = event.target.files?.[0]; if (file) void loadFile(file); event.target.value = ""; }} />
      <p className="tiny muted row"><ShieldCheck size={14} />El archivo se lee en tu dispositivo; no se sube a ningún lado ni se guarda el PDF.</p>
      {message ? <p className="notice small" role="status">{message}</p> : null}
    </section>

    {draft ? <section className="card stack" aria-label="Revisión del estado de cuenta">
      {candidate ? <>
        <div><p className="eyebrow">Corte del {fullDate(candidate.cutoffDate)}</p><p className="small muted" style={{ marginTop: "0.25rem" }}>Paga antes del {fullDate(candidate.dueDate)}</p></div>
        <div className="lines">
          <div className="line"><span>Pago para no generar intereses</span><b>{formatMoney(candidate.paymentToAvoidInterest)}</b></div>
          {candidate.minimumPlusInstallments !== undefined ? <div className="line"><span>Mínimo + mensualidades</span><span>{formatMoney(candidate.minimumPlusInstallments)}</span></div> : null}
          <div className="line"><span>Pago mínimo</span><span>{formatMoney(candidate.minimumPayment)}</span></div>
          <div className="line"><span>Saldo a meses ({candidate.installments.length} compras)</span><span>{formatMoney(candidate.installmentBalance)}</span></div>
          <div className="line total"><span>Saldo deudor total</span><span>{formatMoney(candidate.totalDebt)}</span></div>
        </div>
        <p className="row small pos"><Check size={16} />Los importes cuadran al centavo.</p>
        {candidate.installments.length ? <div className="list">{candidate.installments.map((item) => <div className="item" key={item.id}><div className="grow"><p className="title">{item.merchant}</p><p className="meta">Pago {item.billedInstallment} de {item.totalInstallments} · {formatMoney(item.monthlyAmount)} al mes</p></div><span className="amount">Resta {formatMoney(item.remainingBalance)}</span></div>)}</div> : null}
      </> : <div className="verdict bad"><TriangleAlert size={20} /><div><strong>Falta completar o corregir</strong><p className="small">{validationError}</p></div></div>}

      {warnings.length ? <ul className="tiny muted" style={{ margin: 0, paddingLeft: "1.1rem" }}>{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul> : null}

      {candidate && movementPlan ? <div className="notice stack-sm">
        <label className="check"><input type="checkbox" checked={addMovements} onChange={(event) => setAddMovements(event.target.checked)} /><span>Agregar <b>{movementPlan.add.length}</b> compras del periodo a mis movimientos ({formatMoney(movementPlan.add.reduce((sum, item) => sum + item.amount, 0))}) para ver en qué gasté.{movementPlan.duplicates.length ? ` ${movementPlan.duplicates.length} ya estaban registradas y no se duplican.` : ""}</span></label>
        {byCategory.length ? <p className="tiny muted">{byCategory.slice(0, 6).map(([category, cents]) => `${category} ${formatMoney(cents / 100)}`).join(" · ")}</p> : null}
        <p className="tiny muted">Son historial: no suben tu deuda (ya están en el pago del estado). Puedes cambiar su categoría después.</p>
      </div> : null}

      <details open={!candidate}>
        <summary className="disclosure">{candidate ? "Corregir datos" : "Completar datos"}</summary>
        <div className="stack" style={{ marginTop: "0.75rem" }}>
          <div className="grid-2">{([["periodStart", "Inicio del periodo"], ["cutoffDate", "Fecha de corte"], ["dueDate", "Fecha límite de pago"]] as const).map(([key, label]) => <Field key={key} label={label}><input className="input" type="date" value={draft[key]} onChange={(event) => edit({ ...draft, [key]: event.target.value })} /></Field>)}</div>
          <div className="grid-2">{summaryFields.map(([key, label]) => <Field key={key} label={label}><input className="input" type="number" inputMode="decimal" step="0.01" min="0" placeholder={required.has(key) ? "Obligatorio" : "Opcional"} value={draft[key] ?? ""} onChange={(event) => edit({ ...draft, [key]: event.target.value === "" ? undefined : Number(event.target.value) })} /></Field>)}</div>
          <p className="tiny muted">Pago + saldo a meses = {formatMoney(sumCents([draft.paymentToAvoidInterest, draft.installmentBalance]))} · suma del detalle a meses = {formatMoney(sumCents(draft.installments.map((item) => item.remainingBalance)))}</p>
          {draft.installments.map((item, index) => <div className="card stack-sm" key={index} style={{ background: "var(--surface-2)" }}>
            <div className="row"><input className="input grow" value={item.merchant} placeholder="Comercio" maxLength={160} onChange={(event) => editItem(index, { merchant: event.target.value })} aria-label={`Comercio ${index + 1}`} /><button className="icon-btn" type="button" aria-label={`Quitar compra ${index + 1}`} onClick={() => edit({ ...draft, installments: draft.installments.filter((_, row) => row !== index) })}><Trash2 size={16} /></button></div>
            <div className="grid-2">{itemFields.map(([key, label]) => <Field key={key} label={label}><input className="input" type="number" step={key === "billedInstallment" || key === "totalInstallments" ? 1 : 0.01} min="0" value={item[key] ?? ""} onChange={(event) => editItem(index, { [key]: event.target.value === "" ? undefined : Number(event.target.value) })} /></Field>)}</div>
          </div>)}
          <button type="button" className="btn small" onClick={() => edit({ ...draft, installments: [...draft.installments, { merchant: "" }] })}><Plus size={15} />Agregar compra a meses</button>
          <button type="button" className="btn ghost small" onClick={() => downloadText("plantilla-estado-bbva.csv", BBVA_CSV_TEMPLATE, "text/csv;charset=utf-8")}>Descargar plantilla CSV</button>
        </div>
      </details>

      {duplicate ? <p className="notice small">Este estado ya está registrado; el saldo no cambia.{newMovements ? " Puedes agregar sus compras a tus movimientos." : ""}</p> : null}
      {replacement && existing && candidate ? <label className="notice warn check"><input type="checkbox" checked={replaceOk} onChange={(event) => setReplaceOk(event.target.checked)} /><span>Ya tenías el corte del {shortDate(existing.cutoffDate)} con pago de {formatMoney(existing.paymentToAvoidInterest)}. Reemplazarlo por este ({formatMoney(candidate.paymentToAvoidInterest)}).</span></label> : null}
      <div className="actions">
        <button className="btn primary grow" type="button" disabled={!canConfirm} onClick={() => void confirm()}><Check size={17} />{duplicate ? "Agregar compras" : "Confirmar estado de cuenta"}</button>
        <button className="btn" type="button" onClick={reset}>Cancelar</button>
      </div>
      <p className="tiny muted">Confirmar no registra ningún pago. Cuando pagues tu tarjeta, regístralo en «Registrar → Pago de tarjeta».</p>
    </section> : null}

    {statements.length ? <section className="card">
      <div className="card-title"><h2>Estados guardados</h2></div>
      <div className="list">{statements.map((statement, index) => <div className="item" key={statement.id}><div className="grow"><p className="title">Corte {shortDate(statement.cutoffDate)} {statement.cutoffDate.slice(0, 4)}</p><p className="meta">Pago {formatMoney(statement.paymentToAvoidInterest)} · a meses {formatMoney(statement.installmentBalance)}</p></div>{index === 0 ? <span className="pill info">Actual</span> : null}</div>)}</div>
    </section> : null}
  </>;
}
