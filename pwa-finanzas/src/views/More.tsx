import { useMemo, useState } from "react";
import { ChevronRight, CloudUpload, FileText, Plus, Repeat, Settings, ShoppingCart, Target, Trash2 } from "lucide-react";
import { asNumber, latestStatementFor, monthAfter, recurringOccurrencesFor, toCents } from "../lib/calculations";
import { EXPENSE_CATEGORIES, monthSummaryFor } from "../lib/outlook";
import type { AppState, Budget, RecurringItem, Transaction, ViewId } from "../lib/types";
import { Field, Segmented, Sheet, formatMoney, shortDate } from "../ui";

export function MoreMenu({ state, today, onNavigate }: { state: AppState; today: string; onNavigate: (view: ViewId) => void }) {
  const active = state.recurring.filter((item) => item.active && item.amount > 0);
  const statement = latestStatementFor(state, today);
  const budgets = state.settings.budgets || [];
  const items: Array<[ViewId, typeof Repeat, string, string]> = [
    ["settings", Settings, "Mi dinero y sueldo", `Disponible ${formatMoney(state.settings.currentSavings)} · nómina ${formatMoney(state.settings.salary)}`],
    ["budgets", Target, "Presupuestos", budgets.length ? `${budgets.length} categorías · ${formatMoney(budgets.reduce((sum, item) => sum + item.monthlyAmount, 0))} al mes` : "Define cuánto quieres gastar"],
    ["subscriptions", Repeat, "Suscripciones y pagos fijos", `${active.length} activas · ${formatMoney(active.reduce((sum, item) => sum + item.amount, 0))} al mes`],
    ["statements", FileText, "Estado de cuenta BBVA", statement ? `Último corte: ${shortDate(statement.cutoffDate)}` : "Importa tu PDF"],
    ["mandado", ShoppingCart, "Compras de la app Mandado", "Registra tu mandado real"],
    ["backup", CloudUpload, "Respaldo, sincronización y app", "Exportar, importar, actualizar"],
  ];
  return <section className="card menu">
    {items.map(([view, Icon, title, detail]) => <button key={view} className="menu-item" type="button" onClick={() => onNavigate(view)}>
      <span className="cat-icon"><Icon size={18} /></span>
      <span className="grow"><b className="small" style={{ display: "block" }}>{title}</b><span className="tiny muted">{detail}</span></span>
      <ChevronRight size={16} className="faint" />
    </button>)}
  </section>;
}

type RecurringDraft = Omit<RecurringItem, "id"> & { id?: string };
const emptyRecurring = (today: string): RecurringDraft => ({ name: "", amount: 0, day: Number(today.slice(8)), method: "credit", active: true, startsOn: today });

export function Subscriptions({ state, today, onSave, onDelete, onConfirm }: {
  state: AppState; today: string;
  onSave: (item: RecurringItem) => Promise<boolean>; onDelete: (item: RecurringItem) => void; onConfirm: (transaction: Transaction) => void;
}) {
  const [draft, setDraft] = useState<RecurringDraft | null>(null);
  const [error, setError] = useState("");
  const pending = recurringOccurrencesFor(state, today);
  const active = state.recurring.filter((item) => item.active && item.amount > 0);
  const total = (method: RecurringItem["method"]) => active.filter((item) => item.method === method).reduce((sum, item) => sum + toCents(item.amount), 0) / 100;
  async function save() {
    if (!draft) return;
    const item: RecurringItem = { ...draft, id: draft.id || crypto.randomUUID(), name: draft.name.trim(), amount: asNumber(draft.amount), day: Math.trunc(asNumber(draft.day, 1)), startsOn: draft.startsOn || today, endsOn: draft.endsOn || undefined };
    if (!item.name || item.amount <= 0 || item.day < 1 || item.day > 31 || (item.endsOn && item.endsOn < item.startsOn!)) return setError("Revisa nombre, monto, día (1 a 31) y fechas.");
    if (await onSave(item)) { setDraft(null); setError(""); }
  }
  return <>
    <section className="card stack">
      <div className="grid-2">
        <div><p className="tiny muted">Con tarjeta, al mes</p><p className="mid">{formatMoney(total("credit"))}</p></div>
        <div><p className="tiny muted">Con débito, al mes</p><p className="mid">{formatMoney(total("debit"))}</p></div>
      </div>
      <p className="tiny muted">Se incluyen en la proyección cada mes mientras estén activas. Cuando el banco cobre una, confírmala para que cuente como real.</p>
    </section>
    {pending.length ? <section className="card"><div className="card-title"><h2>¿Ya se cobraron?</h2><span className="pill warn">{pending.length}</span></div>
      <div className="list">{pending.map(({ recurring, date, transaction }) => <div className="item" key={transaction.id}>
        <div className="grow"><p className="title">{recurring.name}</p><p className="meta">{shortDate(date)} · {formatMoney(transaction.amount)} · {recurring.method === "credit" ? "Tarjeta" : "Débito"}</p></div>
        <button className="btn small primary" type="button" onClick={() => onConfirm(transaction)}>Sí</button>
      </div>)}</div>
    </section> : null}
    <section className="card">
      <div className="card-title"><h2>Tus suscripciones</h2><button className="btn small" type="button" onClick={() => setDraft(emptyRecurring(today))}><Plus size={15} />Agregar</button></div>
      {state.recurring.length ? <div className="list">{state.recurring.map((item) => <button key={item.id} type="button" className="item" onClick={() => setDraft({ ...item })}>
        <div className="grow"><p className="title" style={{ opacity: item.active ? 1 : 0.5 }}>{item.name}</p><p className="meta">Día {item.day} · {item.method === "credit" ? "Tarjeta" : "Débito"}{item.active ? "" : " · pausada"}</p></div>
        <span className="amount">{formatMoney(item.amount)}</span>
      </button>)}</div> : <p className="small muted">Agrega Netflix, Spotify, tu plan de celular… lo que se cobre cada mes.</p>}
    </section>
    <Sheet open={Boolean(draft)} title={draft?.id ? "Editar suscripción" : "Nueva suscripción"} onClose={() => { setDraft(null); setError(""); }}>
      {draft ? <form className="stack" onSubmit={(event) => { event.preventDefault(); void save(); }}>
        <Field label="Nombre"><input className="input" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Ej. Spotify" required /></Field>
        <div className="grid-2">
          <Field label="Monto mensual"><input className="input" type="number" min="0" step="0.01" value={draft.amount || ""} onChange={(event) => setDraft({ ...draft, amount: asNumber(event.target.value) })} required /></Field>
          <Field label="Día de cobro"><input className="input" type="number" min="1" max="31" step="1" value={draft.day} onChange={(event) => setDraft({ ...draft, day: asNumber(event.target.value, 1) })} required /></Field>
        </div>
        <Field label="Se cobra en"><Segmented label="Medio" value={draft.method} onChange={(method) => setDraft({ ...draft, method })} options={[["credit", "Tarjeta"], ["debit", "Débito"]]} /></Field>
        <div className="grid-2">
          <Field label="Desde"><input className="input" type="date" value={draft.startsOn || today} onChange={(event) => setDraft({ ...draft, startsOn: event.target.value })} /></Field>
          <Field label="Hasta" hint="Opcional"><input className="input" type="date" value={draft.endsOn || ""} onChange={(event) => setDraft({ ...draft, endsOn: event.target.value || undefined })} /></Field>
        </div>
        <label className="check"><input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} /><span>Activa</span></label>
        {error ? <p className="notice bad">{error}</p> : null}
        <div className="actions"><button className="btn primary grow" type="submit">Guardar</button>{draft.id ? <button className="btn danger" type="button" aria-label="Borrar suscripción" onClick={() => { onDelete(draft as RecurringItem); setDraft(null); }}><Trash2 size={17} /></button> : null}</div>
      </form> : null}
    </Sheet>
  </>;
}

export function Budgets({ state, today, onSave }: { state: AppState; today: string; onSave: (budgets: Budget[]) => Promise<boolean> }) {
  const [rows, setRows] = useState<Budget[]>(() => (state.settings.budgets || []).map((item) => ({ ...item })));
  const [error, setError] = useState("");
  const current = useMemo(() => monthSummaryFor(state, today.slice(0, 7), today), [state, today]);
  const previous = useMemo(() => monthSummaryFor(state, monthAfter(today.slice(0, 7), -1), today), [state, today]);
  const spent = (summary: typeof current, category: string) => summary.spending.byCategory.find((item) => item.category.toLowerCase() === category.toLowerCase())?.spent || 0;
  const used = new Set(rows.map((row) => row.category));
  const options = [...new Set([...EXPENSE_CATEGORIES, ...rows.map((row) => row.category)])];
  const suggestions = previous.spending.byCategory.filter((item) => item.spent > 0 && !used.has(item.category));
  function update(index: number, patch: Partial<Budget>) { setRows(rows.map((row, position) => position === index ? { ...row, ...patch } : row)); }
  async function save() {
    const clean = rows.filter((row) => row.category.trim());
    if (new Set(clean.map((row) => row.category.toLowerCase())).size !== clean.length) return setError("Cada categoría puede tener un solo presupuesto.");
    if (clean.some((row) => !(row.monthlyAmount >= 0))) return setError("Revisa los montos.");
    if (await onSave(clean)) setError("");
  }
  return <>
    <section className="card stack">
      <p className="small">¿Cuánto quieres gastar al mes en cada cosa? La proyección descuenta lo que <b>todavía no gastas</b> de cada presupuesto; cada gasto que registras (o importas) lo va consumiendo.</p>
      <p className="tiny muted">«Tarjeta»: lo que falta se suma al siguiente pago de tu tarjeta. «Débito»: sale de tu dinero en cada quincena.</p>
    </section>
    <section className="card stack">
      {rows.map((row, index) => <div key={row.id} className="stack-sm" style={{ paddingBottom: "0.75rem", borderBottom: "1px solid var(--line)" }}>
        <div className="row">
          <select className="input grow" value={row.category} onChange={(event) => update(index, { category: event.target.value })} aria-label="Categoría">{options.map((option) => <option key={option} disabled={option !== row.category && used.has(option)}>{option}</option>)}</select>
          <button className="icon-btn" type="button" aria-label={`Quitar ${row.category}`} onClick={() => setRows(rows.filter((_, position) => position !== index))}><Trash2 size={16} /></button>
        </div>
        <div className="grid-2">
          <Field label="Al mes"><input className="input" type="number" min="0" step="1" value={row.monthlyAmount || ""} onChange={(event) => update(index, { monthlyAmount: asNumber(event.target.value) })} /></Field>
          <Field label="Lo pagas con"><Segmented label="Medio" value={row.method} onChange={(method) => update(index, { method })} options={[["credit", "Tarjeta"], ["debit", "Débito"]]} /></Field>
        </div>
        <p className="tiny muted">Este mes llevas {formatMoney(spent(current, row.category))}{spent(previous, row.category) ? ` · el mes pasado ${formatMoney(spent(previous, row.category))}` : ""}</p>
      </div>)}
      <button className="btn" type="button" onClick={() => { const category = options.find((option) => !used.has(option)) || "Otro"; setRows([...rows, { id: crypto.randomUUID(), category, monthlyAmount: Math.round(spent(previous, category)), method: "credit" }]); }}><Plus size={16} />Agregar presupuesto</button>
      {suggestions.length ? <p className="tiny muted">El mes pasado también gastaste en: {suggestions.slice(0, 5).map((item) => `${item.category} ${formatMoney(item.spent)}`).join(" · ")}.</p> : null}
      {error ? <p className="notice bad">{error}</p> : null}
      <button className="btn primary" type="button" onClick={() => void save()}>Guardar presupuestos</button>
    </section>
  </>;
}
