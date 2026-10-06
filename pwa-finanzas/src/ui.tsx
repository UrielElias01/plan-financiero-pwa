import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import {
  Car, CircleDollarSign, CreditCard, Gamepad2, HeartPulse, House, KeyRound, PawPrint, Plus, Receipt,
  ShoppingBag, ShoppingCart, Tv, Utensils, X, Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { formatMoney, normalizeCategory } from "./lib/calculations";
import type { Transaction } from "./lib/types";

export { formatMoney };

const weekday = new Intl.DateTimeFormat("es-MX", { weekday: "short", timeZone: "UTC" });
const dayMonth = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", timeZone: "UTC" });
const longDate = new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const asDate = (value: string) => new Date(`${value}T12:00:00Z`);
const clean = (value: string) => value.replace(/\./g, "");

/** "23 oct" */
export function shortDate(value: string): string { return clean(dayMonth.format(asDate(value))); }
/** "vie 23 oct" */
export function dayDate(value: string): string { return `${clean(weekday.format(asDate(value)))} ${shortDate(value)}`; }
/** "viernes, 23 de octubre" */
export function fullDate(value: string): string { return longDate.format(asDate(value)); }
export function daysUntil(value: string, from: string): number { return Math.round((asDate(value).getTime() - asDate(from).getTime()) / 86_400_000); }
export function inDays(value: string, from: string): string {
  const days = daysUntil(value, from);
  if (days === 0) return "hoy";
  if (days === 1) return "mañana";
  if (days < 0) return `hace ${-days} días`;
  return `en ${days} días`;
}

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  mandado: ShoppingCart, comida: ShoppingCart, "comida fuera": Utensils, transporte: Car, suscripciones: Tv, compras: ShoppingBag,
  salud: HeartPulse, hogar: House, servicios: Zap, entretenimiento: Gamepad2, mascotas: PawPrint, renta: KeyRound,
};
export function transactionIcon(transaction: Pick<Transaction, "method" | "category">): { Icon: LucideIcon; tone: string } {
  if (transaction.method === "income") return { Icon: normalizeCategory(transaction.category) === "nomina" ? CircleDollarSign : Plus, tone: "income" };
  if (transaction.method === "card_payment") return { Icon: CreditCard, tone: "payment" };
  return { Icon: CATEGORY_ICONS[normalizeCategory(transaction.category)] || Receipt, tone: "" };
}
export function CategoryIcon({ transaction }: { transaction: Pick<Transaction, "method" | "category"> }) {
  const { Icon, tone } = transactionIcon(transaction);
  return <span className={`cat-icon ${tone}`} aria-hidden="true"><Icon size={18} /></span>;
}

export function methodLabel(transaction: Pick<Transaction, "method" | "category">): string {
  if (transaction.method === "income") return normalizeCategory(transaction.category) === "nomina" ? "Nómina" : "Ingreso";
  if (transaction.method === "card_payment") return "Pago de tarjeta";
  if (transaction.method === "credit") return "Tarjeta";
  return "Débito / efectivo";
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="field">{label}{children}{hint ? <span className="hint">{hint}</span> : null}</label>;
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: Array<[T, string]>; onChange: (value: T) => void; label: string }) {
  return <div className="segmented" role="group" aria-label={label}>
    {options.map(([key, text]) => <button key={key} type="button" aria-pressed={value === key} onClick={() => onChange(key)}>{text}</button>)}
  </div>;
}

export function Bar({ value, max, tone }: { value: number; max: number; tone?: "ok" | "warn" | "bad" }) {
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return <div className={`bar ${tone || ""}`} role="presentation"><span style={{ width: `${percent}%` }} /></div>;
}

export function Sheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    (dialog?.querySelector<HTMLElement>("[autofocus], input:not([type=hidden]), button") || dialog)?.focus();
    const onKey = (event: KeyboardEvent) => {
      // With a confirmation on top of a form, only the dialog that holds the focus reacts.
      if (!dialog || !dialog.contains(document.activeElement)) return;
      if (event.key === "Escape") { event.preventDefault(); closeRef.current(); }
      if (event.key !== "Tab") return;
      const focusable = [...dialog.querySelectorAll<HTMLElement>("button:not(:disabled), input:not([type=hidden]):not(:disabled), select:not(:disabled), textarea, summary")].filter((element) => element.getClientRects().length);
      const first = focusable[0]; const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus(); };
  }, [open]);
  if (!open) return null;
  return <div className="backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={ref} className="sheet" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
      <div className="sheet-head"><h2>{title}</h2><button className="icon-btn" type="button" onClick={onClose} aria-label="Cerrar"><X size={18} /></button></div>
      {children}
    </div>
  </div>;
}

export type ConfirmRequest = { title: string; message: string; confirmText?: string; danger?: boolean; resolve: (value: boolean) => void };
export function ConfirmDialog({ request, onDone }: { request: ConfirmRequest | null; onDone: (value: boolean) => void }) {
  return <Sheet open={Boolean(request)} title={request?.title || ""} onClose={() => onDone(false)}>
    <p className="muted small" style={{ whiteSpace: "pre-line" }}>{request?.message}</p>
    <div className="actions" style={{ marginTop: "1.25rem", justifyContent: "flex-end" }}>
      <button className="btn" type="button" onClick={() => onDone(false)}>Cancelar</button>
      <button className={`btn ${request?.danger ? "danger" : "primary"}`} type="button" onClick={() => onDone(true)}>{request?.confirmText || "Confirmar"}</button>
    </div>
  </Sheet>;
}

export function Money({ value, signed, className = "" }: { value: number; signed?: boolean; className?: string }) {
  const tone = signed ? (value < 0 ? "neg" : value > 0 ? "pos" : "") : "";
  return <span className={`num ${tone} ${className}`}>{signed && value > 0 ? "+" : ""}{formatMoney(value)}</span>;
}
