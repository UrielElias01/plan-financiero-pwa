import { useMemo } from "react";
import { FileText, Plus } from "lucide-react";
import { buildCardCalendarFor, calculateCardDebtFor, latestStatementFor, toCents } from "../lib/calculations";
import { cardOutlookFor } from "../lib/outlook";
import type { AppState, Transaction, ViewId } from "../lib/types";
import { Bar, formatMoney, fullDate, inDays, shortDate } from "../ui";
import type { TransactionPrefill } from "../TransactionForm";

type InstallmentRow = { key: string; name: string; billed: number; total: number; next?: { amount: number; dueDate: string; installment: number }; remaining: number; transaction?: Transaction };

export function Card({ state, today, onRegister, onEdit, onNavigate }: {
  state: AppState; today: string; onRegister: (prefill: TransactionPrefill) => void; onEdit: (transaction: Transaction) => void; onNavigate: (view: ViewId) => void;
}) {
  const statement = latestStatementFor(state, today);
  const debt = useMemo(() => calculateCardDebtFor(state, undefined, today), [state, today]);
  const calendar = useMemo(() => buildCardCalendarFor(state, today), [state, today]);
  const outlook = useMemo(() => cardOutlookFor(state, today, 1)[0], [state, today]);
  const live = calendar.flatMap((entry) => (entry.installments || []).map((item) => ({ ...item, dueDate: entry.dueDate || "" })));
  const rows: InstallmentRow[] = [];
  for (const item of statement?.installments || []) {
    const schedule = live.filter((entry) => entry.transactionId === `statement:${statement!.id}:${item.id}`);
    const next = schedule.find((entry) => entry.remaining > 0);
    rows.push({ key: item.id, name: item.merchant, billed: item.billedInstallment, total: item.totalInstallments, remaining: schedule.reduce((sum, entry) => sum + toCents(entry.remaining), 0) / 100, next: next ? { amount: next.remaining, dueDate: next.dueDate, installment: next.installment } : undefined });
  }
  for (const transaction of state.transactions.filter((entry) => entry.method === "credit" && (entry.totalInstallments || entry.installments) > 1 && entry.status !== "planned" && (!statement || entry.date > statement.cutoffDate))) {
    const schedule = live.filter((entry) => entry.transactionId === transaction.id);
    const next = schedule.find((entry) => entry.remaining > 0);
    const total = transaction.totalInstallments || transaction.installments;
    rows.push({ key: transaction.id, name: transaction.description, billed: (transaction.currentInstallment || 0) + schedule.filter((entry) => entry.remaining <= 0).length, total, remaining: schedule.reduce((sum, entry) => sum + toCents(entry.remaining), 0) / 100, next: next ? { amount: next.remaining, dueDate: next.dueDate, installment: next.installment } : undefined, transaction });
  }
  const upcoming = calendar.filter((entry) => entry.monthKey && entry.monthKey >= today.slice(0, 7) && (entry.remaining || 0) > 0).slice(0, 6);
  const statementPaid = statement && outlook?.isStatement ? outlook.paidSoFar || 0 : 0;
  const statementPending = statement && outlook?.isStatement ? outlook.required : 0;
  return <>
    <section className="card stack" aria-labelledby="statement">
      <div className="row between"><div><p className="eyebrow">BBVA</p><h2 id="statement" style={{ marginTop: "0.2rem", fontSize: "1.05rem" }}>{statement ? `Corte del ${shortDate(statement.cutoffDate)}` : "Sin estado de cuenta"}</h2></div>
        <button className="btn small" type="button" onClick={() => onNavigate("statements")}><FileText size={15} />{statement ? "Actualizar" : "Importar"}</button></div>
      {statement ? <>
        <div className="lines">
          <div className="line"><span>Fecha límite de pago</span><span>{fullDate(statement.dueDate)} · {inDays(statement.dueDate, today)}</span></div>
          <div className="line"><span>Pago para no generar intereses</span><span>{formatMoney(statement.paymentToAvoidInterest)}</span></div>
          {statement.minimumPlusInstallments !== undefined ? <div className="line"><span>Mínimo + mensualidades</span><span>{formatMoney(statement.minimumPlusInstallments)}</span></div> : null}
          <div className="line"><span>Pago mínimo</span><span>{formatMoney(statement.minimumPayment)}</span></div>
          <div className="line"><span>Ya abonaste desde el corte</span><span className="pos">{formatMoney(statementPaid)}</span></div>
          <div className="line total"><span>Te falta pagar de este corte</span><span>{formatMoney(statementPending)}</span></div>
        </div>
        <div className="actions"><button className="btn primary" type="button" disabled={statementPending <= 0} onClick={() => onRegister({ kind: "payment", amount: statementPending })}>Registrar pago</button></div>
      </> : <p className="small muted">Importa el PDF de tu estado de cuenta: con eso la app sabe cuánto pagar, el mínimo y tus compras a meses.</p>}
    </section>

    <section className="card stack" aria-labelledby="debt">
      <div className="card-title" style={{ marginBottom: 0 }}><h2 id="debt">Lo que debes hoy</h2></div>
      <div className="grid-2">
        <div><p className="tiny muted">Deuda conocida</p><p className="mid">{formatMoney(debt.totalDebt)}</p><p className="tiny muted">Corte + compras posteriores registradas</p></div>
        {statement?.creditLimit ? <div><p className="tiny muted">Crédito disponible aprox.</p><p className="mid">{formatMoney(Math.max(0, statement.creditLimit - debt.totalDebt))}</p><p className="tiny muted">Límite {formatMoney(statement.creditLimit)}</p></div> : null}
      </div>
      {debt.reconciliationWarning ? <p className="notice warn small">{debt.reconciliationWarning}</p> : null}
      <p className="tiny muted">Si tu app de BBVA muestra más, faltan compras por registrar desde el corte (o importa el siguiente estado).</p>
    </section>

    <section className="card" aria-labelledby="msi">
      <div className="card-title"><h2 id="msi">Compras a meses</h2><button className="btn small" type="button" onClick={() => onRegister({ kind: "expense", method: "credit", installments: true })}><Plus size={15} />Agregar</button></div>
      {rows.length ? <div className="list">{rows.map((row) => <div className="item" key={row.key} style={{ display: "grid", gap: "0.4rem" }}>
        <div className="row between"><span className="title">{row.name}</span>{row.transaction ? <button className="btn ghost small" type="button" onClick={() => onEdit(row.transaction!)}>Editar</button> : <span className="pill">{row.billed} de {row.total}</span>}</div>
        <Bar value={row.billed} max={row.total} tone="ok" />
        <p className="tiny muted">{row.next ? `Siguiente: ${formatMoney(row.next.amount)} el ${shortDate(row.next.dueDate)} (${row.next.installment} de ${row.total})` : "Sin mensualidades pendientes"} · Resta {formatMoney(row.remaining)}</p>
      </div>)}</div> : <p className="small muted">Sin compras a meses pendientes.</p>}
    </section>

    <section className="card" aria-labelledby="calendar">
      <div className="card-title"><h2 id="calendar">Pagos por mes</h2></div>
      {upcoming.length ? <div className="table-wrap"><table className="simple"><thead><tr><th>Fecha límite</th><th>A pagar</th><th>Estimado</th><th>Deuda después</th></tr></thead><tbody>
        {upcoming.map((entry) => <tr key={entry.monthKey}><td>{entry.dueDate ? shortDate(entry.dueDate) : entry.month}</td><td>{formatMoney(entry.remaining)}</td><td className="muted">{formatMoney(Math.min(entry.remaining || 0, entry.projected || 0))}</td><td>{formatMoney(entry.debt)}</td></tr>)}
      </tbody></table></div> : <p className="small muted">Sin pagos programados.</p>}
      <p className="tiny muted" style={{ marginTop: "0.6rem" }}>«Estimado» son suscripciones y presupuestos que aún no suceden. «Deuda después» cuenta solo compras reales pendientes.</p>
    </section>
  </>;
}
