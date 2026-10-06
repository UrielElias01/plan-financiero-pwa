import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Check, Trash2 } from "lucide-react";
import { asNumber, formatMoney, nextPaymentMonthFor, normalizeCategory } from "./lib/calculations";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, cardOutlookFor } from "./lib/outlook";
import type { AppState, Transaction } from "./lib/types";
import { Field, Segmented, transactionIcon } from "./ui";

export type TransactionPrefill = {
  kind: "expense" | "income" | "payment";
  method?: "credit" | "cash";
  payroll?: boolean;
  amount?: number;
  date?: string;
  category?: string;
  description?: string;
  installments?: boolean;
};

const half = (value: number) => Math.round(Math.max(0, value) * 100 / 2) / 100;
const isPayrollCategory = (category: string) => normalizeCategory(category) === "nomina";

export function TransactionForm({ state, today, draft, prefill, onSave, onDelete, onCancel }: {
  state: AppState; today: string; draft: Transaction | null; prefill: TransactionPrefill;
  onSave: (transaction: Transaction) => void; onDelete: (transaction: Transaction) => void; onCancel: () => void;
}) {
  const initialKind: TransactionPrefill["kind"] = draft ? (draft.method === "income" ? "income" : draft.method === "card_payment" ? "payment" : "expense") : prefill.kind;
  const [kind, setKind] = useState(initialKind);
  const [method, setMethod] = useState<"credit" | "cash">(draft?.method === "cash" ? "cash" : draft?.method === "credit" ? "credit" : prefill.method || "credit");
  const [payroll, setPayroll] = useState(draft ? draft.method === "income" && isPayrollCategory(draft.category) : Boolean(prefill.payroll));
  const [amount, setAmount] = useState(draft ? String(draft.amount) : prefill.amount ? String(prefill.amount) : "");
  const [category, setCategory] = useState(draft && draft.method !== "income" && draft.method !== "card_payment" ? draft.category : prefill.category || "Mandado");
  const [incomeCategory, setIncomeCategory] = useState(draft?.method === "income" && !isPayrollCategory(draft.category) ? draft.category : "Ingreso extra");
  const [description, setDescription] = useState(draft?.description || prefill.description || "");
  const [date, setDate] = useState(draft?.date || prefill.date || today);
  const [planned, setPlanned] = useState(draft?.status === "planned");
  const term0 = draft?.totalInstallments || draft?.installments || 1;
  const [onInstallments, setOnInstallments] = useState(term0 > 1 || Boolean(prefill.installments));
  const [term, setTerm] = useState(String(term0 > 1 ? term0 : 6));
  const [monthly, setMonthly] = useState(draft?.monthlyAmount !== undefined ? String(draft.monthlyAmount) : "");
  const [paidBefore, setPaidBefore] = useState(String(draft?.currentInstallment || 0));
  const [nextMonth, setNextMonth] = useState(draft?.nextPaymentMonth || "");
  const [remaining, setRemaining] = useState(draft?.remainingPrincipalAmount !== undefined ? String(draft.remainingPrincipalAmount) : "");
  const [shared, setShared] = useState(Boolean(draft?.shared));
  const [userAmount, setUserAmount] = useState(draft?.userAmount !== undefined ? String(draft.userAmount) : "");
  const [fundingSource, setFundingSource] = useState<NonNullable<Transaction["fundingSource"]>>(draft?.fundingSource || "savings");
  const [error, setError] = useState("");
  const statementOutlook = useMemo(() => kind === "payment" ? cardOutlookFor(state, today, 1)[0] : undefined, [kind, state, today]);
  const future = date > today;
  const isPlanned = planned || future;
  const showFunding = (kind === "payment" || (kind === "expense" && method === "cash")) && (state.settings.rentReserve > 0 || (state.settings.foodReserve || 0) > 0 || fundingSource !== "savings");
  const rentHalf = half(state.settings.monthlyRent);
  const defaultNextMonth = nextPaymentMonthFor(state, date);

  function chooseCategory(value: string) {
    setCategory(value);
    if (value === "Renta" && method === "cash" && state.settings.rentReserve > 0) setFundingSource("rent_reserve");
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const value = asNumber(amount);
    if (!(value > 0)) return setError("Escribe un monto mayor a cero.");
    const txMethod: Transaction["method"] = kind === "income" ? "income" : kind === "payment" ? "card_payment" : method;
    const txCategory = kind === "payment" ? "Pago TDC" : kind === "income" ? (payroll ? "Nómina" : incomeCategory) : category;
    const isPayroll = kind === "income" && payroll;
    const originalPayroll = draft && draft.method === "income" && isPayrollCategory(draft.category) ? draft : undefined;
    const rentReserveAmount = isPayroll ? Math.min(value, originalPayroll?.rentReserveAmount ?? rentHalf) : 0;
    const foodReserveAmount = isPayroll ? Math.min(Math.max(0, value - rentReserveAmount), originalPayroll?.foodReserveAmount ?? half(state.settings.monthlyFood || 0)) : 0;
    const credit = txMethod === "credit";
    const installments = credit && onInstallments;
    const total = installments ? Math.trunc(asNumber(term, 1)) : 1;
    const paid = installments ? Math.trunc(asNumber(paidBefore)) : 0;
    if (installments) {
      if (!Number.isInteger(total) || total < 2 || total > 120) return setError("El plazo debe ser de 2 a 120 meses.");
      if (paid < 0 || paid >= total) return setError("Las mensualidades ya pagadas deben ser menos que el plazo.");
      if (!(asNumber(monthly) > 0)) return setError("Escribe la mensualidad que cobra el banco.");
    }
    if (shared && (asNumber(userAmount) < 0 || asNumber(userAmount) > value || userAmount === "")) return setError("Tu parte debe estar entre cero y el total.");
    const sameCount = draft?.currentInstallment === paid;
    const transaction: Transaction = {
      id: draft?.id || crypto.randomUUID(),
      date, status: isPlanned ? "planned" : "confirmed",
      description: description.trim() || (kind === "payment" ? "Pago de tarjeta" : isPayroll ? "Nómina" : kind === "income" ? incomeCategory : category),
      amount: value, category: txCategory, method: txMethod, periodId: draft?.periodId || "",
      shared: (txMethod === "credit" || txMethod === "cash") && shared,
      userAmount: (txMethod === "credit" || txMethod === "cash") && shared ? asNumber(userAmount) : undefined,
      installments: total, totalInstallments: total,
      monthlyAmount: installments ? asNumber(monthly) : undefined,
      remainingPrincipalAmount: installments && remaining !== "" ? asNumber(remaining) : undefined,
      currentInstallment: paid,
      installmentPaymentIds: paid > 0 ? (sameCount ? draft?.installmentPaymentIds : state.transactions.filter((entry) => entry.method === "card_payment" && entry.status !== "planned" && entry.date <= today).map((entry) => entry.id)) : undefined,
      installmentsAsOf: paid > 0 ? (sameCount ? draft?.installmentsAsOf || draft?.date : today) : undefined,
      nextPaymentMonth: installments ? nextMonth || defaultNextMonth : undefined,
      paymentForPeriodId: txMethod === "card_payment" ? draft?.paymentForPeriodId : undefined,
      sourceRecurringId: draft?.sourceRecurringId, recurringDate: draft?.recurringDate, externalId: draft?.externalId, source: draft?.source,
      skipPlanImpact: false,
      affectsSavings: draft?.method === txMethod && typeof draft.affectsSavings === "boolean" ? draft.affectsSavings : txMethod !== "credit",
      rentReserveAmount, foodReserveAmount,
      fundingSource: txMethod === "cash" || txMethod === "card_payment" ? fundingSource : "savings",
    };
    onSave(transaction);
  }

  const amountLabel = kind === "expense" && method === "credit" && onInstallments ? "Total de la compra" : "Monto";
  return <form className="stack" onSubmit={submit}>
    <Segmented label="Tipo de movimiento" value={kind} onChange={(value) => { setKind(value); setError(""); }} options={[["expense", "Gasto"], ["income", "Ingreso"], ["payment", "Pago de tarjeta"]]} />
    <Field label={amountLabel}><input className="input amount" inputMode="decimal" type="number" step="0.01" min="0" placeholder="$0.00" value={amount} onChange={(event) => setAmount(event.target.value)} autoFocus={!draft} required /></Field>

    {kind === "expense" ? <>
      <Field label="¿Cómo pagaste?"><Segmented label="Medio de pago" value={method} onChange={setMethod} options={[["credit", "Tarjeta de crédito"], ["cash", "Débito o efectivo"]]} /></Field>
      <div className="field">Categoría<div className="chips">{EXPENSE_CATEGORIES.map((option) => { const { Icon } = transactionIcon({ method: "cash", category: option }); return <button key={option} type="button" className="chip" aria-pressed={normalizeCategory(category) === normalizeCategory(option)} onClick={() => chooseCategory(option)}><Icon size={14} />{option}</button>; })}</div></div>
    </> : null}

    {kind === "income" ? <>
      <Segmented label="Tipo de ingreso" value={payroll ? "payroll" : "extra"} onChange={(value) => setPayroll(value === "payroll")} options={[["payroll", "Nómina"], ["extra", "Dinero extra"]]} />
      {payroll ? <p className="notice small">{rentHalf > 0 ? `De esta nómina se apartan ${formatMoney(Math.min(rentHalf, asNumber(amount) || rentHalf))} para la renta; el resto queda disponible.` : "La nómina suma a tu dinero disponible."}{state.settings.salary > 0 && !draft ? ` Tu nómina habitual es ${formatMoney(state.settings.salary)}.` : ""}</p>
        : <Field label="¿De dónde viene?"><select className="input" value={incomeCategory} onChange={(event) => setIncomeCategory(event.target.value)}>{INCOME_CATEGORIES.map((option) => <option key={option}>{option}</option>)}</select></Field>}
    </> : null}

    {kind === "payment" ? <>
      {statementOutlook?.isStatement && statementOutlook.required > 0 ? <div className="stack-sm"><p className="tiny muted">Usar un importe del estado de cuenta:</p><div className="chips">
        <button type="button" className="chip" onClick={() => setAmount(String(statementOutlook.required))}>Total {formatMoney(statementOutlook.required)}</button>
        {statementOutlook.minimumPlusInstallments ? <button type="button" className="chip" onClick={() => setAmount(String(statementOutlook.minimumPlusInstallments))}>Mín. + meses {formatMoney(statementOutlook.minimumPlusInstallments)}</button> : null}
        {statementOutlook.minimum ? <button type="button" className="chip" onClick={() => setAmount(String(statementOutlook.minimum))}>Mínimo {formatMoney(statementOutlook.minimum)}</button> : null}
      </div></div> : null}
      <p className="tiny muted">Registra lo que realmente pagaste. Si es un abono parcial, el resto sigue pendiente.</p>
    </> : null}

    <div className="grid-2">
      <Field label="Descripción" hint="Opcional"><input className="input" value={description} maxLength={120} onChange={(event) => setDescription(event.target.value)} placeholder={kind === "expense" ? `Ej. ${category === "Mandado" ? "Chedraui" : category}` : kind === "payment" ? "Pago de tarjeta" : payroll ? "Nómina" : "Ej. venta, reembolso"} /></Field>
      <Field label="Fecha"><input className="input" type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></Field>
    </div>
    {future ? <p className="tiny warn">Es una fecha futura: se guarda como programado y no cuenta como real hasta que lo confirmes.</p> : null}

    {showFunding ? <Field label="¿De dónde sale el dinero?"><select className="input" value={fundingSource} onChange={(event) => setFundingSource(event.target.value as typeof fundingSource)}>
      <option value="savings">Dinero disponible</option>
      {state.settings.rentReserve > 0 || fundingSource === "rent_reserve" ? <option value="rent_reserve">Renta apartada ({formatMoney(state.settings.rentReserve)})</option> : null}
      {(state.settings.foodReserve || 0) > 0 || fundingSource === "food_reserve" ? <option value="food_reserve">Comida apartada ({formatMoney(state.settings.foodReserve || 0)})</option> : null}
    </select></Field> : null}

    <details open={onInstallments || shared || planned}>
      <summary className="disclosure">Más opciones</summary>
      <div className="stack" style={{ marginTop: "0.75rem" }}>
        {kind === "expense" && method === "credit" ? <label className="check"><input type="checkbox" checked={onInstallments} onChange={(event) => setOnInstallments(event.target.checked)} /><span>Es a meses sin intereses</span></label> : null}
        {kind === "expense" && method === "credit" && onInstallments ? <div className="grid-2">
          <Field label="Plazo (meses)"><input className="input" type="number" min="2" max="120" step="1" value={term} onChange={(event) => setTerm(event.target.value)} /></Field>
          <Field label="Mensualidad del banco"><input className="input" type="number" min="0" step="0.01" value={monthly} onChange={(event) => setMonthly(event.target.value)} placeholder={asNumber(amount) && asNumber(term) ? (asNumber(amount) / asNumber(term)).toFixed(2) : ""} /></Field>
          <Field label="Mensualidades ya pagadas" hint="0 si es una compra nueva"><input className="input" type="number" min="0" step="1" value={paidBefore} onChange={(event) => setPaidBefore(event.target.value)} /></Field>
          <Field label="Mes de la siguiente mensualidad" hint={`Si lo dejas vacío: ${defaultNextMonth}`}><input className="input" type="month" value={nextMonth} onChange={(event) => setNextMonth(event.target.value)} /></Field>
          <Field label="Saldo pendiente exacto" hint="Opcional, como aparece en el banco"><input className="input" type="number" min="0" step="0.01" value={remaining} onChange={(event) => setRemaining(event.target.value)} /></Field>
        </div> : null}
        {kind === "expense" ? <label className="check"><input type="checkbox" checked={shared} onChange={(event) => setShared(event.target.checked)} /><span>Lo comparto con alguien (solo cuenta mi parte como gasto)</span></label> : null}
        {kind === "expense" && shared ? <Field label="Mi parte" hint="La tarjeta conserva el cargo completo; registra el reembolso como ingreso cuando te lo den."><input className="input" type="number" min="0" step="0.01" value={userAmount} onChange={(event) => setUserAmount(event.target.value)} /></Field> : null}
        {!future ? <label className="check"><input type="checkbox" checked={planned} onChange={(event) => setPlanned(event.target.checked)} /><span>Todavía no sucede (programado). No cuenta como real hasta que lo confirmes.</span></label> : null}
      </div>
    </details>

    {error ? <p className="notice bad" role="alert">{error}</p> : null}
    <div className="actions">
      <button className="btn primary grow" type="submit"><Check size={18} />{draft ? "Guardar cambios" : "Guardar"}</button>
      {draft ? <button className="btn danger" type="button" onClick={() => onDelete(draft)} aria-label="Borrar movimiento"><Trash2 size={17} /></button> : <button className="btn" type="button" onClick={onCancel}>Cancelar</button>}
    </div>
  </form>;
}
