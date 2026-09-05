import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Check, Plus, CreditCard } from "lucide-react";
import { buildCardCalendarFor, buildPaymentScheduleFor, formatMoney, transactionUserAmount } from "./lib/calculations";
import type { AppState, CalculatedPeriod, CardDebtSummary, Transaction } from "./lib/types";

export function CardView({ state, periods, cardDebt, onRegisterPayment, onNewInstallment, onEdit }: {
  state: AppState; periods: CalculatedPeriod[]; cardDebt: CardDebtSummary;
  onRegisterPayment: (period: CalculatedPeriod) => void;
  onNewInstallment: () => void; onEdit: (transaction: Transaction) => void;
}) {
  const calendar = buildCardCalendarFor(state);
  const purchases = state.transactions.filter((tx) => tx.method === "credit" && (tx.totalInstallments || tx.installments) > 1);
  const paymentRows = periods.filter((period) => (period.pendingCardPayment || 0) > 0);
  return <div className="grid gap-5">
    <section className="grid gap-4 md:grid-cols-3">
      {[["Próximo pago pendiente", cardDebt.nextPayment, "Después de pagos registrados"], ["Deuda registrada", cardDebt.totalDebt, "Incluye el cargo total compartido"], ["Cuotas futuras", cardDebt.installmentBalance, "Principal pendiente en mensualidades"]].map(([label,value,note]) => <article className="metric-card" key={String(label)}><CreditCard className="mb-4 text-teal" size={21} /><p className="eyebrow">{label}</p><strong className="my-2 block text-3xl text-navy">{formatMoney(value)}</strong><p className="text-sm text-slate-500">{note}</p></article>)}
    </section>
    <section className="panel" data-tour="card-payment">
      <div className="section-heading mb-5"><div><p className="eyebrow">Control de pagos</p><h3 className="text-2xl font-black text-navy">Tus próximos compromisos</h3><p className="mt-2 text-sm text-slate-500">Confirma el pago después de realizarlo. Para un abono parcial, usa Registrar → Pago TDC.</p></div><button className="button-primary" onClick={onNewInstallment}><Plus size={18} />Agregar compra a meses</button></div>
      {paymentRows.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{paymentRows.slice(0,6).map((period) => <article key={period.id} className="installment-card">
        <p className="eyebrow">{period.label}</p><strong className="my-3 block text-2xl text-navy">{formatMoney(period.pendingCardPayment)}</strong>
        <p className="text-sm text-slate-500">Salida real en esta quincena: {formatMoney(period.actualCardPayment)}</p>
        <button className="button-ghost mt-4 w-full" disabled={Boolean(period.closedAt)} onClick={() => onRegisterPayment(period)}><Check size={16} />Registrar este pago</button>
      </article>)}</div> : <p className="rounded-lg border border-dashed border-blue-100 p-6 text-slate-500">Sin pagos pendientes. Agrega una compra o tus mensualidades actuales para construir el calendario.</p>}
    </section>
    <section className="panel">
      <div className="section-heading mb-5"><div><p className="eyebrow">Meses sin intereses</p><h3 className="text-2xl font-black text-navy">Cada cuota, bajo control</h3></div><span className="pill">{purchases.length} compras</span></div>
      <div className="grid gap-3 md:grid-cols-2">{purchases.map((tx) => {
        const term = tx.totalInstallments || tx.installments;
        const scheduled = buildPaymentScheduleFor(state, tx);
        const paid = tx.currentInstallment || 0;
        const live = calendar.flatMap((entry) => entry.installments || []).filter((item) => item.transactionId === tx.id);
        const completed = paid + live.filter((item) => item.remaining <= 0).length;
        const outstanding = live.reduce((total, item) => total + Math.round(item.remaining * 100), 0) / 100;
        const next = live.find((item) => item.remaining > 0);
        return <article className="installment-card" key={tx.id}>
          <div className="flex items-start justify-between gap-3"><div><strong className="text-lg text-navy">{tx.description}</strong><p className="text-sm text-slate-500">{term} meses · {formatMoney(tx.monthlyAmount || tx.amount / term)} / mes</p></div><button className="button-ghost" onClick={() => onEdit(tx)} disabled={Boolean(state.periods.find((p) => p.id === tx.periodId)?.closedAt)}>Editar</button></div>
          <progress className="installment-progress mt-4 w-full" value={completed} max={term} aria-label={"Cuotas pagadas de " + tx.description} />
          <div className="mt-3 flex flex-wrap justify-between gap-2 text-sm"><span>{completed} de {term} pagadas</span><strong>{formatMoney(outstanding)} pendiente</strong></div>
          <p className="mt-2 text-sm text-slate-500">{next ? "Próxima cuota: " + next.installment + "/" + term + " · " + formatMoney(next.remaining) : "Compra liquidada"}</p>
          <p className="mt-2 text-sm text-slate-500">Desde {tx.nextPaymentMonth || scheduled[0]?.periodId.slice(0, 7) || "—"} · Tu parte total: {formatMoney(transactionUserAmount(tx))}</p>
          <details className="mt-3 text-sm"><summary className="cursor-pointer text-teal">Ver cuotas programadas</summary><div className="mt-3 grid gap-2">{scheduled.map((payment, index) => <div className="flex flex-wrap justify-between gap-3" key={payment.periodId}><span>Cuota {paid + index + 1}/{term} · {payment.dueDate}</span><strong>{formatMoney(payment.amount)} · Pendiente {formatMoney(live.find((item) => item.installment === paid + index + 1)?.remaining ?? payment.amount)}</strong></div>)}</div></details>
        </article>;
      })}</div>
      {!purchases.length ? <p className="rounded-lg border border-dashed border-blue-100 p-6 text-slate-500">Puedes agregar compras nuevas o compras en curso indicando las cuotas que ya pagaste.</p> : null}
      <p className="mt-4 text-sm text-slate-500">Los pagos posteriores se descuentan del calendario. «Pagadas al registrar» conserva tu punto de partida; no lo incrementes al registrar un pago nuevo.</p>
    </section>
    <section className="panel" data-tour="card-chart">
      <p className="eyebrow">Proyección por mes</p><h3 className="mb-5 text-2xl font-black text-navy">Calendario de tarjeta</h3>
      <div className="h-64"><ResponsiveContainer><BarChart data={calendar}><CartesianGrid strokeDasharray="3 3" stroke="#23344b" /><XAxis dataKey="month" tickLine={false} axisLine={false} /><YAxis tickFormatter={(v) => "$" + Math.round(Number(v))} tickLine={false} axisLine={false} /><Tooltip formatter={(v) => formatMoney(v)} /><Legend /><Bar dataKey="total" name="Cargo programado" fill="#62dbea" radius={[5,5,0,0]} /><Bar dataKey="remaining" name="Pendiente de pago" fill="#b9f17c" radius={[5,5,0,0]} /></BarChart></ResponsiveContainer></div>
      <div className="table-scroll mt-5" data-tour="card-list"><table className="w-full"><thead><tr><th className="table-head text-left">Mes</th><th className="table-head">Total del corte</th><th className="table-head">Tu parte</th><th className="table-head">Pagos aplicados</th><th className="table-head">Por pagar</th><th className="table-head">Deuda tras el mes</th></tr></thead><tbody>{calendar.map((entry) => <tr key={entry.monthKey || entry.month}><td className="table-cell text-left text-navy">{entry.month}</td><td className="table-cell">{formatMoney(entry.total)}</td><td className="table-cell">{formatMoney(entry.userPart)}</td><td className="table-cell money-positive">{formatMoney(entry.paid)}</td><td className="table-cell">{formatMoney(entry.remaining)}</td><td className="table-cell">{formatMoney(entry.debt)}</td></tr>)}</tbody></table></div>
      <p className="mt-4 text-sm text-slate-500" data-tour="card-debt">La deuda tras cada mes supone que se pague lo programado; esas cifras no se suman. Tu parte es informativa: la obligación de tu tarjeta es el total. Las suscripciones futuras se estiman mientras estén activas.</p>
    </section>
  </div>;
}
