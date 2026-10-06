import { useMemo } from "react";
import { ChevronRight, CircleCheck, FileText, Settings, Target, TriangleAlert, Upload } from "lucide-react";
import { cardOutlookFor, monthSummaryFor, pendingTasksFor } from "../lib/outlook";
import type { DueOutlook, PendingTask } from "../lib/outlook";
import type { AppState, Transaction, ViewId } from "../lib/types";
import { Bar, Money, dayDate, formatMoney, fullDate, inDays, shortDate } from "../ui";
import type { TransactionPrefill } from "../TransactionForm";

type Verdict = { tone: "ok" | "warn" | "bad"; title: string; detail?: string };

export function verdictFor(outlook: DueOutlook): Verdict {
  const { available, required, shortfall } = outlook;
  if (required <= 0) return { tone: "ok", title: "Pagado" };
  if (available >= required) return { tone: "ok", title: `Alcanza. Te sobrarían ${formatMoney(available - required)}` };
  if (outlook.minimumPlusInstallments !== undefined && available >= outlook.minimumPlusInstallments) {
    const covered = outlook.minimumPlusInstallments <= 0 ? "Ya cubriste el mínimo + mensualidades" : `Sí cubres el mínimo + mensualidades (${formatMoney(outlook.minimumPlusInstallments)})`;
    return { tone: "warn", title: `No alcanza el total: faltan ${formatMoney(shortfall)}`, detail: `${covered}: tus meses sin intereses se conservan, pero lo que no pagues del total genera intereses.` };
  }
  if (outlook.minimum !== undefined && available >= outlook.minimum) {
    return { tone: "bad", title: `Solo alcanza el pago mínimo (${formatMoney(outlook.minimum)})`, detail: "Pagando menos que el mínimo + mensualidades, también tus compras a meses generan intereses." };
  }
  if (outlook.minimum !== undefined) return { tone: "bad", title: `No alcanza ni el pago mínimo: faltan ${formatMoney(Math.max(0, outlook.minimum - Math.max(0, available)))}`, detail: "No cubrir el mínimo genera comisión por pago tardío." };
  return { tone: "bad", title: `Faltarían ${formatMoney(shortfall)}` };
}

function VerdictBanner({ verdict }: { verdict: Verdict }) {
  const Icon = verdict.tone === "ok" ? CircleCheck : TriangleAlert;
  return <div className={`verdict ${verdict.tone}`} role="status"><Icon size={22} /><div><strong>{verdict.title}</strong>{verdict.detail ? <p className="small" style={{ marginTop: "0.25rem" }}>{verdict.detail}</p> : null}</div></div>;
}

function CashLines({ outlook, first }: { outlook: DueOutlook; first: boolean }) {
  return <div className="lines">
    <div className="line"><span>{first ? "Dinero disponible hoy" : "Te quedaría del pago anterior"}</span><Money value={outlook.startCash} /></div>
    {outlook.inflows.map((line, index) => <div className="line" key={`in-${index}`}><span>+ {line.label} · {shortDate(line.date)}</span><span className="pos">+{formatMoney(line.amount)}</span></div>)}
    {outlook.outflows.map((line, index) => <div className="line" key={`out-${index}`}><span>− {line.label} · {shortDate(line.date)}</span><span>−{formatMoney(line.amount)}</span></div>)}
    <div className="line total"><span>Tendrás el {shortDate(outlook.dueDate)}</span><Money value={outlook.available} className={outlook.available < 0 ? "neg" : ""} /></div>
  </div>;
}

function DueItems({ outlook }: { outlook: DueOutlook }) {
  return <div className="lines">
    {outlook.items.map((item) => <div className="line" key={item.kind}><span>{item.label}{item.count > 1 ? ` (${item.count})` : ""}{item.estimated ? " · estimado" : ""}</span><span>{formatMoney(item.amount)}</span></div>)}
    <div className="line total"><span>Total a pagar</span><span>{formatMoney(outlook.required)}</span></div>
  </div>;
}

function Tier({ ok, label, amount }: { ok: boolean; label: string; amount: number }) {
  return <div className="tier"><span className={ok ? "pos" : "neg"} aria-label={ok ? "Alcanza" : "No alcanza"}>{ok ? "✓" : "✗"}</span><span>{label}</span><span className="amount">{amount > 0 ? formatMoney(amount) : "Cubierto"}</span></div>;
}

function NextPaymentCard({ outlook, today, onPay, onNavigate }: { outlook: DueOutlook; today: string; onPay: (amount: number) => void; onNavigate: (view: ViewId) => void }) {
  const verdict = verdictFor(outlook);
  return <section className="card stack" aria-labelledby="next-payment">
    <div className="row between">
      <div>
        <p className="eyebrow">{outlook.overdue ? "Pago vencido" : outlook.isStatement ? "Pago de tu tarjeta" : "Próximo pago estimado"}</p>
        <h2 id="next-payment" className="small muted" style={{ marginTop: "0.2rem" }}>{outlook.overdue ? "Venció; regístralo si ya pagaste" : `${fullDate(outlook.dueDate)} · ${inDays(outlook.dueDate, today)}`}</h2>
      </div>
      {outlook.isStatement ? <span className="pill info">Estado de cuenta</span> : <span className="pill">Estimado</span>}
    </div>
    <div>
      <p className="big">{formatMoney(outlook.required)}</p>
      <p className="small muted">{outlook.isStatement ? "Pago para no generar intereses" : "Lo que calculamos que pagarás"}{outlook.paidSoFar ? ` · ya abonaste ${formatMoney(outlook.paidSoFar)}` : ""}</p>
    </div>
    <VerdictBanner verdict={verdict} />
    <CashLines outlook={outlook} first />
    {outlook.isStatement && outlook.minimum !== undefined ? <div className="stack-sm">
      <p className="eyebrow">Opciones de pago</p>
      <div className="tiers">
        <Tier ok={outlook.available >= outlook.required} label="Pago para no generar intereses" amount={outlook.required} />
        {outlook.minimumPlusInstallments !== undefined ? <Tier ok={outlook.available >= outlook.minimumPlusInstallments} label="Mínimo + mensualidades (conserva tus MSI)" amount={outlook.minimumPlusInstallments} /> : null}
        <Tier ok={outlook.available >= outlook.minimum} label="Pago mínimo" amount={outlook.minimum} />
      </div>
    </div> : <details><summary className="disclosure">Qué incluye este pago</summary><div style={{ marginTop: "0.6rem" }}><DueItems outlook={outlook} /></div></details>}
    {outlook.shortfall > 0 && outlook.interestOnShortfall ? <p className="small muted">Si pagas {formatMoney(outlook.payable)}, quedan {formatMoney(outlook.shortfall)} pendientes: unos {formatMoney(outlook.interestOnShortfall)} de intereses aproximados en el siguiente corte (tasa del estado + IVA; puede variar).</p> : null}
    <div className="actions">
      <button className="btn primary" type="button" onClick={() => onPay(Math.min(outlook.required, Math.max(0, outlook.available)) || outlook.required)}>Registrar pago</button>
      <button className="btn" type="button" onClick={() => onNavigate("card")}>Ver tarjeta <ChevronRight size={16} /></button>
    </div>
  </section>;
}

function UpcomingCard({ outlooks, today }: { outlooks: DueOutlook[]; today: string }) {
  if (!outlooks.length) return null;
  return <section className="card" aria-labelledby="upcoming">
    <div className="card-title"><h2 id="upcoming">Siguientes pagos de tarjeta</h2><span className="pill">Estimados</span></div>
    <p className="tiny muted" style={{ marginBottom: "0.5rem" }}>Suponen que en cada fecha pagas lo que puedas: lo que falte pasa al siguiente pago con intereses aproximados. Incluyen mensualidades, suscripciones, tus presupuestos y lo que ya registraste.</p>
    {outlooks.map((outlook) => {
      const verdict = verdictFor(outlook);
      return <details className="due" key={outlook.dueDate}>
        <summary className="month-row">
          <span className="date-badge"><b>{outlook.dueDate.slice(8)}</b><span>{shortDate(outlook.dueDate).split(" ")[1]}</span></span>
          <span className="grow"><span className="num" style={{ fontWeight: 700 }}>{formatMoney(outlook.required)}</span><span className="tiny muted" style={{ display: "block" }}>Tendrás {formatMoney(outlook.available)} · {inDays(outlook.dueDate, today)}</span></span>
          <span className={`pill ${verdict.tone}`}>{verdict.tone === "ok" ? "Alcanza" : `Faltan ${formatMoney(outlook.shortfall)}`}</span>
        </summary>
        <div className="stack" style={{ paddingTop: "0.25rem" }}><DueItems outlook={outlook} /><CashLines outlook={outlook} first={false} /></div>
      </details>;
    })}
  </section>;
}

function MonthCard({ state, today, onNavigate }: { state: AppState; today: string; onNavigate: (view: ViewId) => void }) {
  const summary = useMemo(() => monthSummaryFor(state, today.slice(0, 7), today), [state, today]);
  const income = summary.income.received + summary.income.expected;
  const categories = summary.spending.byCategory.filter((item) => item.spent > 0 || item.budget > 0).slice(0, 6);
  return <section className="card stack" aria-labelledby="month">
    <div className="card-title" style={{ marginBottom: 0 }}><h2 id="month">{summary.label}: ingresos y gastos</h2><button className="btn ghost small" type="button" onClick={() => onNavigate("movements")}>Detalle <ChevronRight size={15} /></button></div>
    <div className="grid-2">
      <div><p className="tiny muted">Ingresos del mes</p><p className="mid pos">{formatMoney(income)}</p><p className="tiny muted">{formatMoney(summary.income.received)} recibido · {formatMoney(summary.income.expected)} por recibir</p></div>
      <div><p className="tiny muted">Gastos registrados</p><p className="mid">{formatMoney(summary.spending.total)}</p><p className="tiny muted">Tarjeta {formatMoney(summary.spending.card)} · Débito {formatMoney(summary.spending.debit)}</p></div>
    </div>
    {categories.length ? <div className="stack-sm">
      {categories.map((item) => {
        const tone = item.budget ? (item.spent > item.budget ? "bad" : item.spent > item.budget * 0.8 ? "warn" : "ok") : undefined;
        return <div key={item.category} className="stack-sm" style={{ gap: "0.25rem" }}>
          <div className="row between small"><span>{item.category}</span><span className="num">{formatMoney(item.spent)}{item.budget ? <span className="muted"> / {formatMoney(item.budget)}</span> : null}</span></div>
          {item.budget ? <Bar value={item.spent} max={item.budget} tone={tone} /> : null}
        </div>;
      })}
    </div> : <p className="small muted">Registra tus gastos o importa tu estado de cuenta para ver en qué se va tu dinero.</p>}
    {!state.settings.budgets?.length ? <button className="btn small" type="button" onClick={() => onNavigate("budgets")}><Target size={15} />Define cuánto quieres gastar al mes</button> : null}
  </section>;
}

function Tasks({ tasks, onAct }: { tasks: PendingTask[]; onAct: (task: PendingTask) => void }) {
  if (!tasks.length) return null;
  const action: Record<PendingTask["kind"], string> = { payroll: "Registrar", subscription: "Sí, se cobró", planned: "Sí", statement: "Importar", "card-payment": "Registrar pago" };
  return <section className="card" aria-labelledby="tasks">
    <div className="card-title"><h2 id="tasks">Pendientes</h2><span className="pill warn">{tasks.length}</span></div>
    <div className="list">{tasks.map((task) => <div className="item" key={task.id}>
      <div className="grow"><p className="small" style={{ fontWeight: 600 }}>{task.label}</p><p className="tiny muted">{dayDate(task.date)}{"amount" in task ? ` · ${formatMoney(task.amount)}` : ""}</p></div>
      <button className="btn small primary" type="button" onClick={() => onAct(task)}>{action[task.kind]}</button>
    </div>)}</div>
  </section>;
}

function Setup({ onNavigate }: { onNavigate: (view: ViewId) => void }) {
  return <section className="card stack" aria-labelledby="setup">
    <div><p className="eyebrow">Empieza aquí</p><h2 id="setup" style={{ marginTop: "0.3rem" }}>Tres pasos para saber si te alcanza</h2></div>
    <div className="card menu" style={{ background: "var(--surface-2)" }}>
      <button className="menu-item" type="button" onClick={() => onNavigate("settings")}><Settings size={18} className="info" /><span className="grow"><b className="small">1. Tu dinero y tu sueldo</b><span className="tiny muted" style={{ display: "block" }}>Cuánto tienes hoy, cuánto te pagan y cuándo</span></span><ChevronRight size={16} /></button>
      <button className="menu-item" type="button" onClick={() => onNavigate("statements")}><FileText size={18} className="info" /><span className="grow"><b className="small">2. Tu estado de cuenta BBVA</b><span className="tiny muted" style={{ display: "block" }}>Sube el PDF: pago, mínimo y meses sin intereses</span></span><ChevronRight size={16} /></button>
      <button className="menu-item" type="button" onClick={() => onNavigate("budgets")}><Target size={18} className="info" /><span className="grow"><b className="small">3. Tus presupuestos</b><span className="tiny muted" style={{ display: "block" }}>Cuánto gastas al mes en mandado, transporte…</span></span><ChevronRight size={16} /></button>
    </div>
    <button className="btn" type="button" onClick={() => onNavigate("backup")}><Upload size={16} />Tengo un respaldo</button>
  </section>;
}

export function Home({ state, today, onRegister, onConfirmPlanned, onConfirmRecurring, onNavigate }: {
  state: AppState; today: string;
  onRegister: (prefill: TransactionPrefill) => void;
  onConfirmPlanned: (transaction: Transaction) => void;
  onConfirmRecurring: (transaction: Transaction) => void;
  onNavigate: (view: ViewId) => void;
}) {
  const outlooks = useMemo(() => cardOutlookFor(state, today, 4), [state, today]);
  const tasks = useMemo(() => pendingTasksFor(state, today), [state, today]);
  const needsSetup = state.settings.salary <= 0 && !state.statements?.length && !state.transactions.length;
  const pay = (amount: number) => onRegister({ kind: "payment", amount });
  function act(task: PendingTask) {
    if (task.kind === "payroll") onRegister({ kind: "income", payroll: true, amount: task.amount, date: task.date });
    else if (task.kind === "subscription") onConfirmRecurring(task.transaction);
    else if (task.kind === "planned") onConfirmPlanned(task.transaction);
    else if (task.kind === "statement") onNavigate("statements");
    else pay(task.amount);
  }
  return <>
    <Tasks tasks={tasks} onAct={act} />
    {needsSetup ? <Setup onNavigate={onNavigate} /> : null}
    {outlooks[0] ? <NextPaymentCard outlook={outlooks[0]} today={today} onPay={pay} onNavigate={onNavigate} /> : !needsSetup ? <section className="card stack">
      <p className="eyebrow">Tarjeta</p>
      <p className="small muted">No hay pagos de tarjeta pendientes. Importa tu estado de cuenta para saber cuánto pagar y si te alcanza.</p>
      <button className="btn primary" type="button" onClick={() => onNavigate("statements")}><FileText size={16} />Importar estado de cuenta</button>
    </section> : null}
    <UpcomingCard outlooks={outlooks.slice(1)} today={today} />
    {!needsSetup ? <MonthCard state={state} today={today} onNavigate={onNavigate} /> : null}
  </>;
}
