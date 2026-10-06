import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { monthAfter, monthLabel, normalizeCategory } from "../lib/calculations";
import { monthSummaryFor } from "../lib/outlook";
import type { AppState, Transaction } from "../lib/types";
import { Bar, CategoryIcon, Money, dayDate, formatMoney, methodLabel } from "../ui";

type Filter = "all" | "spending" | "income" | "payments" | "planned";
const FILTERS: Array<[Filter, string]> = [["all", "Todo"], ["spending", "Gastos"], ["income", "Ingresos"], ["payments", "Pagos de tarjeta"], ["planned", "Programados"]];

function matches(transaction: Transaction, filter: Filter): boolean {
  if (filter === "spending") return transaction.method === "credit" || transaction.method === "cash";
  if (filter === "income") return transaction.method === "income";
  if (filter === "payments") return transaction.method === "card_payment";
  if (filter === "planned") return transaction.status === "planned";
  return true;
}

export function Movements({ state, today, onEdit, onConfirmPlanned }: {
  state: AppState; today: string; onEdit: (transaction: Transaction) => void; onConfirmPlanned: (transaction: Transaction) => void;
}) {
  const [month, setMonth] = useState(today.slice(0, 7));
  const [filter, setFilter] = useState<Filter>("all");
  const [category, setCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const summary = useMemo(() => monthSummaryFor(state, month, today), [state, month, today]);
  const query = search.trim().toLocaleLowerCase("es-MX");
  const rows = state.transactions
    .filter((transaction) => transaction.date.slice(0, 7) === month && matches(transaction, filter))
    .filter((transaction) => !category || ((transaction.method === "credit" || transaction.method === "cash") && normalizeCategory(transaction.category).replace(/^comida$/, "mandado") === normalizeCategory(category).replace(/^comida$/, "mandado")))
    .filter((transaction) => !query || `${transaction.description} ${transaction.category}`.toLocaleLowerCase("es-MX").includes(query))
    .sort((a, b) => b.date.localeCompare(a.date) || a.description.localeCompare(b.description));
  const days = [...new Set(rows.map((row) => row.date))];
  const maxSpent = Math.max(1, ...summary.spending.byCategory.map((item) => Math.max(item.spent, item.budget)));
  return <>
    <div className="row between">
      <button className="icon-btn" type="button" onClick={() => setMonth(monthAfter(month, -1))} aria-label="Mes anterior"><ChevronLeft size={18} /></button>
      <h2 style={{ fontSize: "1.05rem" }}>{monthLabel(month)}</h2>
      <button className="icon-btn" type="button" onClick={() => setMonth(monthAfter(month, 1))} aria-label="Mes siguiente"><ChevronRight size={18} /></button>
    </div>

    <section className="card stack" aria-label="Resumen del mes">
      <div className="grid-2">
        <div><p className="tiny muted">Ingresos</p><p className="mid pos">{formatMoney(summary.income.received)}</p>{summary.income.expected ? <p className="tiny muted">+ {formatMoney(summary.income.expected)} por recibir</p> : null}</div>
        <div><p className="tiny muted">Gastos</p><p className="mid">{formatMoney(summary.spending.total)}</p><p className="tiny muted">Tarjeta {formatMoney(summary.spending.card)} · Débito {formatMoney(summary.spending.debit)}</p></div>
      </div>
      {summary.cardPayments ? <p className="small muted">Pagaste a la tarjeta {formatMoney(summary.cardPayments)} (no es gasto nuevo: liquida compras anteriores).</p> : null}
      {summary.spending.byCategory.length ? <div className="stack-sm">
        <p className="tiny muted">Toca una categoría para ver sus movimientos.</p>
        {summary.spending.byCategory.filter((item) => item.spent > 0 || item.budget > 0).map((item) => {
          const tone = item.budget ? (item.spent > item.budget ? "bad" : item.spent > item.budget * 0.8 ? "warn" : "ok") : undefined;
          const selected = category === item.category;
          return <button key={item.category} type="button" className="stack-sm" style={{ gap: "0.25rem", border: 0, background: "none", padding: 0, textAlign: "left", opacity: category && !selected ? 0.5 : 1 }} aria-pressed={selected} onClick={() => setCategory(selected ? null : item.category)}>
            <span className="row between small" style={{ width: "100%" }}><span>{item.category}</span><span className="num">{formatMoney(item.spent)}{item.budget ? <span className="muted"> de {formatMoney(item.budget)}</span> : null}</span></span>
            <Bar value={item.spent} max={item.budget || maxSpent} tone={tone} />
          </button>;
        })}
      </div> : null}
    </section>

    <div className="stack-sm">
      <div className="chips" role="group" aria-label="Filtrar movimientos">{FILTERS.map(([key, label]) => <button key={key} type="button" className="chip" aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>)}</div>
      <label className="row" style={{ position: "relative" }}><Search size={16} className="faint" style={{ position: "absolute", left: "0.75rem" }} aria-hidden="true" /><input className="input" style={{ paddingLeft: "2.2rem" }} type="search" placeholder="Buscar" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Buscar movimientos" /></label>
      {category ? <button className="btn small" type="button" onClick={() => setCategory(null)}>Quitar filtro: {category}</button> : null}
    </div>

    <section className="card" aria-label="Movimientos">
      {rows.length ? days.map((day) => <div key={day}>
        <p className="day-label">{dayDate(day)}</p>
        <div className="list">{rows.filter((row) => row.date === day).map((transaction) => {
          const planned = transaction.status === "planned";
          const sign = transaction.method === "income" ? 1 : -1;
          return <div className="item" key={transaction.id}>
            <CategoryIcon transaction={transaction} />
            <button type="button" className="grow" style={{ border: 0, background: "none", padding: 0, textAlign: "left", minWidth: 0 }} onClick={() => onEdit(transaction)}>
              <p className="title">{transaction.description}</p>
              <p className="meta">{transaction.method === "credit" || transaction.method === "cash" ? `${transaction.category} · ` : ""}{methodLabel(transaction)}{(transaction.totalInstallments || 1) > 1 ? ` · ${transaction.totalInstallments} meses` : ""}{transaction.source === "statement" ? " · del estado de cuenta" : transaction.source === "mandado" ? " · de Mandado" : ""}{transaction.shared ? ` · tu parte ${formatMoney(transaction.userAmount || 0)}` : ""}</p>
            </button>
            <div style={{ textAlign: "right" }}>
              <Money value={transaction.method === "card_payment" ? -transaction.amount : sign * transaction.amount} signed={transaction.method === "income"} className="amount" />
              {planned ? <div><button className="btn small primary" style={{ marginTop: "0.3rem" }} type="button" onClick={() => onConfirmPlanned(transaction)}>Confirmar</button></div> : null}
            </div>
          </div>;
        })}</div>
      </div>) : <p className="small muted">No hay movimientos {category ? `de ${category} ` : ""}en {monthLabel(month).toLowerCase()}.</p>}
    </section>
  </>;
}
