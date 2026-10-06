import { useState } from "react";
import type { FormEvent } from "react";
import { asNumber } from "../lib/calculations";
import type { AppState, Settings as PlanSettings } from "../lib/types";
import { Field, formatMoney, fullDate } from "../ui";

export function Settings({ state, today, onReconcile, onSaveSettings, onPayRent, onReset }: {
  state: AppState; today: string;
  onReconcile: (savings: number, rentReserve: number, foodReserve: number) => Promise<boolean>;
  onSaveSettings: (patch: Partial<PlanSettings>, message: string) => Promise<boolean>;
  onPayRent: () => void;
  onReset: () => void;
}) {
  const { settings } = state;
  const [savings, setSavings] = useState(String(settings.currentSavings));
  const [rent, setRent] = useState(String(settings.rentReserve));
  const [food, setFood] = useState(String(settings.foodReserve || 0));
  const [salary, setSalary] = useState(String(settings.salary || ""));
  const [nextPayday, setNextPayday] = useState(settings.nextPayday || today);
  const [monthlyRent, setMonthlyRent] = useState(String(settings.monthlyRent || ""));
  const [cutoffDay, setCutoffDay] = useState(String(settings.cutoffDay));
  const [dueDay, setDueDay] = useState(String(settings.dueDay));
  const [openingDebt, setOpeningDebt] = useState(String(settings.openingCardDebt || 0));
  const [openingMonth, setOpeningMonth] = useState(settings.openingCardPaymentMonth || today.slice(0, 7));
  const showFood = (settings.foodReserve || 0) > 0;
  const days = (value: string) => { const day = Math.trunc(asNumber(value)); return day >= 1 && day <= 31 ? day : null; };

  function reconcile(event: FormEvent) { event.preventDefault(); void onReconcile(asNumber(savings), Math.max(0, asNumber(rent)), Math.max(0, asNumber(food))); }
  function saveIncome(event: FormEvent) { event.preventDefault(); void onSaveSettings({ salary: Math.max(0, asNumber(salary)), nextPayday, monthlyRent: Math.max(0, asNumber(monthlyRent)) }, "Sueldo y renta guardados"); }
  function saveCard(event: FormEvent) {
    event.preventDefault();
    const cutoff = days(cutoffDay); const due = days(dueDay);
    if (!cutoff || !due) return;
    void onSaveSettings({ cutoffDay: cutoff, dueDay: due, ...(!state.statements?.length ? { openingCardDebt: Math.max(0, asNumber(openingDebt)), openingCardPaymentMonth: openingMonth } : {}) }, "Datos de la tarjeta guardados");
  }

  return <>
    <form className="card stack" onSubmit={reconcile}>
      <div><p className="eyebrow">Tu dinero hoy</p><h2 style={{ fontSize: "1rem", marginTop: "0.25rem" }}>¿Cuánto tienes en tu cuenta?</h2></div>
      <p className="small muted">Revisa tu app del banco y escribe lo que tienes hoy. Incluye el dinero que apartaste para pagar la tarjeta; deja fuera solo lo que es para la renta. Es tu punto de partida: no se suma ninguna nómina que ya hayas recibido.</p>
      <div className="grid-2">
        <Field label="Dinero disponible"><input className="input" type="number" step="0.01" value={savings} onChange={(event) => setSavings(event.target.value)} /></Field>
        <Field label="Renta apartada"><input className="input" type="number" min="0" step="0.01" value={rent} onChange={(event) => setRent(event.target.value)} /></Field>
        {showFood ? <Field label="Comida apartada"><input className="input" type="number" min="0" step="0.01" value={food} onChange={(event) => setFood(event.target.value)} /></Field> : null}
      </div>
      <p className="tiny muted">Último ajuste: {settings.balanceAsOf ? fullDate(settings.balanceAsOf) : "nunca"}. Desde entonces, los movimientos que registras actualizan el saldo solos.</p>
      <button className="btn primary" type="submit">Guardar mi saldo de hoy</button>
    </form>

    <form className="card stack" onSubmit={saveIncome}>
      <div><p className="eyebrow">Sueldo y renta</p></div>
      <div className="grid-2">
        <Field label="Nómina por quincena" hint="Lo que te depositan, ya con descuentos"><input className="input" type="number" min="0" step="0.01" value={salary} onChange={(event) => setSalary(event.target.value)} /></Field>
        <Field label="Próxima nómina que aún no recibes" hint="Los días 15 y último de cada mes"><input className="input" type="date" value={nextPayday} onChange={(event) => setNextPayday(event.target.value)} required /></Field>
        <Field label="Renta mensual" hint="Se aparta la mitad de cada nómina"><input className="input" type="number" min="0" step="0.01" value={monthlyRent} onChange={(event) => setMonthlyRent(event.target.value)} /></Field>
      </div>
      <button className="btn primary" type="submit">Guardar sueldo y renta</button>
      {settings.rentReserve > 0 ? <div className="notice small row between wrap"><span>Tienes {formatMoney(settings.rentReserve)} apartados para la renta.</span><button className="btn small" type="button" onClick={onPayRent}>Ya pagué la renta</button></div> : null}
    </form>

    <form className="card stack" onSubmit={saveCard}>
      <div><p className="eyebrow">Tarjeta de crédito</p></div>
      <div className="grid-2">
        <Field label="Día de corte"><input className="input" type="number" min="1" max="31" value={cutoffDay} onChange={(event) => setCutoffDay(event.target.value)} /></Field>
        <Field label="Día límite de pago"><input className="input" type="number" min="1" max="31" value={dueDay} onChange={(event) => setDueDay(event.target.value)} /></Field>
      </div>
      {!state.statements?.length ? <details><summary className="disclosure">No tengo mi estado de cuenta</summary><div className="grid-2" style={{ marginTop: "0.75rem" }}>
        <Field label="Deuda de la tarjeta" hint="Solo si no registras sus compras una por una"><input className="input" type="number" min="0" step="0.01" value={openingDebt} onChange={(event) => setOpeningDebt(event.target.value)} /></Field>
        <Field label="Mes en que la pagarías"><input className="input" type="month" value={openingMonth} onChange={(event) => setOpeningMonth(event.target.value)} /></Field>
      </div></details> : <p className="tiny muted">Tu último estado de cuenta define la deuda y las fechas reales.</p>}
      <button className="btn primary" type="submit">Guardar tarjeta</button>
    </form>

    <section className="card stack">
      <p className="eyebrow">Empezar de nuevo</p>
      <p className="small muted">Descarga un respaldo del plan actual y deja la app en blanco.</p>
      <button className="btn danger" type="button" onClick={onReset}>Respaldar y empezar de cero</button>
    </section>
  </>;
}
