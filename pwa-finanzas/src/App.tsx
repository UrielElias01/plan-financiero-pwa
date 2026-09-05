import { CardView } from "./CardView";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, FormEvent, ReactNode, RefObject } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BookOpen,
  CalendarClock,
  ChartSpline,
  Check,
  ChevronRight,
  CircleHelp,
  CircleDollarSign,
  Compass,
  CreditCard,
  Download,
  FileJson,
  LayoutDashboard,
  Lightbulb,
  ListChecks,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  PlayCircle,
  Plus,
  RefreshCcw,
  Receipt,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  WalletCards,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  applyTransactionToState,
  asNumber,
  buildPaymentScheduleFor,
  reconcileCashBalanceFor,
  calculateCardDebtFor,
  calculateMonthlyFor,
  calculatePeriodsFor,
  closePeriodFor,
  duePeriodsFor,
  formatMoney,
  normalizeState,
  paydayForPeriod,
  periodIdForDate,
  reconcileRecurringTransactions,
  recurringOccurrencesFor,
  reopenPeriodFor,
  signedTone,
} from "./lib/calculations";
import { exportMonthlyCsv, exportStateJson, readJsonFile } from "./lib/files";
import { cloneSeed, today } from "./lib/seed";
import { loadState, saveState } from "./lib/storage";
import { decryptStateFromSync, encryptStateForSync, fetchSync, normalizeEndpoint, syncSecret } from "./lib/sync";
import {
  applyServiceWorkerUpdate,
  checkForServiceWorkerUpdate,
  getServiceWorkerRegistration,
  registerServiceWorker,
} from "./lib/pwa";
import type { PwaUpdateStatus } from "./lib/pwa";
import type { AppState, CalculatedPeriod, CardDebtSummary, MonthlyReport, Period, RecurringItem, Transaction, ViewId } from "./lib/types";

type Toast = { id: number; message: string; tone?: "ok" | "danger" };
type InsightTone = "danger" | "warning" | "ok" | "info";
type FinancialInsight = {
  id: string;
  title: string;
  detail: string;
  action: string;
  value: string;
  tone: InsightTone;
  icon: LucideIcon;
  view: ViewId;
};
type ConfirmConfig = {
  title: string;
  message: string;
  confirmText?: string;
  danger?: boolean;
  resolve: (value: boolean) => void;
};
type RecurringDraft = Omit<RecurringItem, "id"> & { id?: string };

type NavItem = {
  id: ViewId;
  label: string;
  short: string;
  icon: LucideIcon;
};

const navItems: NavItem[] = [
  { id: "dashboard", label: "Inicio", short: "IN", icon: LayoutDashboard },
  { id: "periods", label: "Quincenas", short: "Q", icon: CalendarClock },
  { id: "transactions", label: "Movimientos", short: "M", icon: WalletCards },
  { id: "recurring", label: "Recurrentes", short: "R", icon: ListChecks },
  { id: "card", label: "Tarjeta", short: "TC", icon: CreditCard },
  { id: "reports", label: "Reportes", short: "RP", icon: ChartSpline },
  { id: "settings", label: "Ajustes", short: "AJ", icon: Settings },
  { id: "guide", label: "Manual", short: "MA", icon: BookOpen },
];

type GuideTopic = {
  id: ViewId;
  title: string;
  summary: string;
  editable: string[];
  steps: string[];
  tip: string;
  icon: LucideIcon;
  accent: string;
};

type GuidedTourStep = {
  moduleId: ViewId;
  view: ViewId;
  target: string;
  targetLabel: string;
  title: string;
  intro: string;
  focus: string;
  action: string;
  outcome: string;
};

type SpotlightRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

const guideTopics: GuideTopic[] = [
  {
    id: "dashboard",
    title: "Inicio",
    summary: "Es tu tablero principal: muestra ahorro actual, pago de tarjeta, alertas y tendencia mensual.",
    editable: ["Importar tu respaldo privado", "Ir rapido a editar quincenas", "Revisar si hay alertas de flujo negativo"],
    steps: [
      "Importa el JSON privado si la app arranca en ceros.",
      "Revisa las tarjetas superiores para ubicar ahorro, renta apartada y TDC.",
      "Si una alerta sale en amarillo o rojo, abre Quincenas o Movimientos para ajustar el origen.",
    ],
    tip: "Usa Inicio como semaforo: si el cierre proyectado se ve bien, no tienes que tocar todo el plan.",
    icon: LayoutDashboard,
    accent: "from-ocean to-teal",
  },
  {
    id: "periods",
    title: "Quincenas",
    summary: "Resume los movimientos reales y las obligaciones conocidas dentro de cada quincena.",
    editable: ["Cerrar una quincena terminada", "Reabrir una quincena si necesitas corregir su historial"],
    steps: [
      "Registra ingresos y gastos desde Movimientos.",
      "Revisa aqui el total que cayo en cada quincena.",
      "Cierra una quincena terminada para proteger su historial.",
    ],
    tip: "Cerrar una quincena solo la archiva; no modifica saldos.",
    icon: CalendarClock,
    accent: "from-blue-700 to-sky-500",
  },
  {
    id: "transactions",
    title: "Movimientos",
    summary: "Es la fuente de verdad para ingresos, gastos, compras y pagos de tarjeta.",
    editable: ["Nomina", "Ingreso extra", "Debito o efectivo", "Tarjeta de credito", "Pago TDC", "Fecha", "Categoria", "MSI"],
    steps: [
      "Pulsa Registrar movimiento para abrir el modal.",
      "Elige nomina, ingreso extra, debito/efectivo, tarjeta o pago TDC.",
      "Captura la fecha real; la quincena se asigna sola.",
      "Nomina e ingresos extra suman al ahorro; los gastos reales lo restan.",
      "Para MSI indica mensualidad, plazo, cuotas pagadas antes de registrarla y próximo mes de pago. El día límite asigna la quincena.",
    ],
    tip: "Si alguien te reembolsa una parte, registra ese dinero como ingreso cuando lo recibas.",
    icon: WalletCards,
    accent: "from-teal to-emerald-500",
  },
  {
    id: "recurring",
    title: "Recurrentes",
    summary: "Es tu lista editable de servicios y suscripciones para tener claro que sigue activo y cuanto cuesta.",
    editable: ["Servicio", "Monto", "Dia", "Medio", "Estado activo o cancelado"],
    steps: [
      "Agrega cada servicio con su costo mensual.",
      "Marca si se paga con debito o tarjeta.",
      "Cuando el cargo se realice, usa Confirmar cargo. Hasta entonces solo afecta la proyección.",
      "Si ya no lo pagas, cambialo a cancelado o borralo.",
    ],
    tip: "Sirve como checklist para no olvidar cargos pequenos que se comen el margen.",
    icon: ListChecks,
    accent: "from-indigo-600 to-blue-500",
  },
  {
    id: "card",
    title: "Tarjeta",
    summary: "Muestra pago al corte, saldo utilizado total, calendario de deuda, tu parte y saldos no recurrentes por mes.",
    editable: ["Compras a meses nuevas o en curso", "Mensualidad, plazo y cuotas iniciales pagadas", "Pagos completos o abonos parciales", "Tu parte explícita por compra"],
    steps: [
      "Revisa la tarjeta Saldo utilizado TDC para saber cuanto aparece ocupado en la tarjeta.",
      "Revisa el mes con barras mas altas.",
      "Compara total contra parte tuya.",
      "Si un pago no cuadra, ve a Movimientos o Quincenas para ajustar el origen.",
    ],
    tip: "La tarjeta se entiende mejor por fecha de pago: mira sobre todo las segundas quincenas.",
    icon: CreditCard,
    accent: "from-slate-800 to-blue-600",
  },
  {
    id: "reports",
    title: "Reportes",
    summary: "Resume ingresos, gastos, tarjeta, flujo y ahorro de cierre por mes.",
    editable: ["Exportar JSON", "Exportar CSV", "Importar JSON", "Comparar meses en graficas"],
    steps: [
      "Usa la grafica para ver si el gasto de tarjeta domina algun mes.",
      "Exporta CSV si quieres revisar numeros en Excel.",
      "Exporta JSON antes de hacer cambios grandes.",
    ],
    tip: "El CSV es para analizar; el JSON es tu respaldo completo para restaurar la app.",
    icon: ChartSpline,
    accent: "from-cyan-700 to-teal",
  },
  {
    id: "settings",
    title: "Ajustes",
    summary: "Controla los supuestos base, la plantilla y la sincronizacion cifrada.",
    editable: ["Ahorro actual", "Renta apartada", "Renta mensual", "Saldo utilizado TDC", "Dias de corte y pago", "Sync cifrado"],
    steps: [
      "Ajusta los supuestos generales cuando cambie tu vida normal.",
      "Guarda antes de salir de la pantalla.",
      "Configura endpoint, ID y contrasena para subir o bajar respaldo cifrado.",
      "Prueba conexion antes de usar Subir cifrado o Bajar cifrado.",
    ],
    tip: "La contrasena de sync no se guarda; si la pierdes no se puede descifrar el respaldo remoto.",
    icon: Settings,
    accent: "from-orange-600 to-amber-500",
  },
  {
    id: "guide",
    title: "Manual",
    summary: "Centro de ayuda dentro de la app: explica cada pantalla y te lleva al lugar correcto.",
    editable: ["Abrir una pantalla", "Leer pasos guiados", "Usar ayuda contextual desde el header"],
    steps: [
      "Lee la ruta sugerida si estas empezando.",
      "Abre la tarjeta de una pantalla para ver que modifica.",
      "Usa el boton Ayuda en cualquier seccion para una guia rapida.",
    ],
    tip: "El manual no cambia tus datos; solo te guia por la app.",
    icon: BookOpen,
    accent: "from-fuchsia-700 to-ocean",
  },
];

const guidedTourSteps: GuidedTourStep[] = [
  {
    moduleId: "dashboard",
    view: "dashboard",
    target: "header-actions",
    targetLabel: "Botones superiores",
    title: "Acciones siempre disponibles",
    intro: "Estos botones viven en todas las pantallas para que no tengas que volver al menu.",
    focus: "Ayuda abre una guia contextual, Registrar abre el modal de movimientos y Acciones muestra el resto de atajos.",
    action: "Usa Registrar para capturar algo real y Acciones para respaldo, tour o manual.",
    outcome: "Puedes moverte por la app sin perder el punto donde estabas.",
  },
  {
    moduleId: "dashboard",
    view: "dashboard",
    target: "dashboard-hero",
    targetLabel: "Centro financiero",
    title: "Portada del plan",
    intro: "Este bloque confirma que estas en el tablero correcto.",
    focus: "Resume que el sistema junta quincenas, tarjeta, ahorros, reportes y sync cifrado.",
    action: "Empieza aqui para ubicarte antes de tocar datos.",
    outcome: "Tienes contexto antes de ir al detalle.",
  },
  {
    moduleId: "dashboard",
    view: "dashboard",
    target: "dashboard-metrics",
    targetLabel: "Tarjetas de resumen",
    title: "Indicadores clave",
    intro: "Estas tarjetas son la lectura rapida del plan.",
    focus: "Ahorro actual, renta apartada, pago de tarjeta y cierre proyectado.",
    action: "Si un monto se ve raro, abre Quincenas o Ajustes para revisar el origen.",
    outcome: "Detectas problemas sin leer toda la tabla.",
  },
  {
    moduleId: "dashboard",
    view: "dashboard",
    target: "dashboard-chart",
    targetLabel: "Grafica de ahorro y flujo",
    title: "Grafica de tendencia",
    intro: "La linea de ahorro muestra hacia donde va tu dinero; la de flujo muestra si una quincena empuja arriba o abajo.",
    focus: "Ahorro es el saldo proyectado; flujo es el cambio de cada periodo.",
    action: "Mira los bajones: suelen venir de pagos de tarjeta, renta o gastos variables.",
    outcome: "Sabes que mes revisar primero.",
  },
  {
    moduleId: "dashboard",
    view: "dashboard",
    target: "dashboard-alerts",
    targetLabel: "Alertas",
    title: "Alertas automaticas",
    intro: "Este panel te avisa si algo requiere atencion.",
    focus: "Flujos negativos, ahorro bajo o cierre proyectado.",
    action: "Si aparece una alerta roja o amarilla, entra al modulo que menciona el problema.",
    outcome: "No tienes que buscar a ciegas.",
  },
  {
    moduleId: "dashboard",
    view: "dashboard",
    target: "dashboard-preview",
    targetLabel: "Proximas quincenas",
    title: "Vista previa quincenal",
    intro: "Aqui ves las siguientes quincenas sin salir de Inicio.",
    focus: "Gastos, pago TDC, flujo y ahorro de cada periodo.",
    action: "Presiona Editar para abrir Quincenas si necesitas corregir un periodo.",
    outcome: "Pasas del resumen al detalle en un clic.",
  },
  {
    moduleId: "periods",
    view: "periods",
    target: "periods-panel",
    targetLabel: "Plan quincenal",
    title: "Modulo de Quincenas",
    intro: "Este modulo es la columna vertebral del sistema.",
    focus: "Cada fila agrupa los movimientos por fecha y separa ingresos, debito, cargos TDC y pagos.",
    action: "Usalo para revisar o cerrar periodos terminados.",
    outcome: "El historial queda ordenado por periodos.",
  },
  {
    moduleId: "periods",
    view: "periods",
    target: "periods-table",
    targetLabel: "Tabla quincenal",
    title: "Leer la tabla",
    intro: "Cada fila representa una quincena y cada columna te dice como afecta tu ahorro.",
    focus: "Ingresos, gastos, cargos TDC y pagos salen de tus movimientos.",
    action: "Cierra una quincena cuando termine; reabrela solo si necesitas corregir movimientos.",
    outcome: "El historial queda protegido sin cambiar tus saldos.",
  },
  {
    moduleId: "transactions",
    view: "transactions",
    target: "transactions-list",
    targetLabel: "Registro de movimientos",
    title: "Captura desde el modal",
    intro: "El historial queda limpio y el formulario se abre solo cuando lo necesitas.",
    focus: "Nomina e ingreso extra aparecen separados junto a debito, compra TDC y pago TDC.",
    action: "Pulsa Registrar movimiento y elige el tipo real.",
    outcome: "La app ajusta la quincena y, si aplica, los pagos de tarjeta.",
  },
  {
    moduleId: "transactions",
    view: "transactions",
    target: "transactions-list",
    targetLabel: "Registro de movimientos",
    title: "Historial editable",
    intro: "Aqui ves lo que ya capturaste.",
    focus: "Descripcion, fecha, categoria, quincena y calendario de pago TDC.",
    action: "Si algo esta mal, usa Editar para corregirlo o borralo si ya no debe existir.",
    outcome: "Evitas arrastrar errores en meses futuros.",
  },
  {
    moduleId: "recurring",
    view: "recurring",
    target: "recurring-form",
    targetLabel: "Formulario recurrente",
    title: "Servicios y suscripciones",
    intro: "Aqui registras gastos que se repiten.",
    focus: "Nombre del servicio, monto, dia, medio de pago y estado.",
    action: "Marca cancelado lo que ya no pagas, o borralo si no quieres verlo.",
    outcome: "Tu checklist mensual queda limpio.",
  },
  {
    moduleId: "recurring",
    view: "recurring",
    target: "recurring-list",
    targetLabel: "Lista de recurrentes",
    title: "Control de cargos fijos",
    intro: "Esta lista te ayuda a ubicar gastos pequenos que se repiten.",
    focus: "Monto, dia de cobro, medio y estado activo/cancelado.",
    action: "Revisala cuando cambie una suscripcion o servicio.",
    outcome: "No olvidas cargos repetidos.",
  },
  {
    moduleId: "card",
    view: "card",
    target: "card-chart",
    targetLabel: "Grafica de TDC",
    title: "Calendario de tarjeta",
    intro: "Esta gráfica compara el cargo programado y el pendiente después de los pagos.",
    focus: "Cian es programado; lima es pendiente. La tabla muestra tu parte informativa.",
    action: "Identifica el mes mas alto y revisa sus compras o MSI.",
    outcome: "Anticipas el pago antes de que llegue el corte.",
  },
  {
    moduleId: "card",
    view: "card",
    target: "card-list",
    targetLabel: "Totales por mes",
    title: "Detalle mensual",
    intro: "Estas tarjetas desglosan el calendario por mes.",
    focus: "Cada tarjeta muestra total y parte tuya.",
    action: "Compara contra tu app bancaria cuando llegue el corte.",
    outcome: "Puedes detectar diferencias rapido.",
  },
  {
    moduleId: "card",
    view: "card",
    target: "card-debt",
    targetLabel: "Deuda no recurrente",
    title: "Saldo no recurrente",
    intro: "Este panel separa deuda temporal de pagos fijos.",
    focus: "Si el saldo sube, normalmente viene de compras nuevas o MSI.",
    action: "Si no cuadra, vuelve a Movimientos.",
    outcome: "Sabes que parte de la tarjeta es extraordinaria.",
  },
  {
    moduleId: "reports",
    view: "reports",
    target: "reports-actions",
    targetLabel: "Exportar/importar",
    title: "Botones de reporte",
    intro: "Estos botones son para respaldar o analizar tus datos.",
    focus: "JSON guarda todo el estado; CSV exporta el resumen mensual; Importar JSON restaura un respaldo.",
    action: "Exporta JSON antes de cambios grandes.",
    outcome: "Puedes volver a una version anterior si algo sale mal.",
  },
  {
    moduleId: "reports",
    view: "reports",
    target: "reports-chart",
    targetLabel: "Grafica mensual",
    title: "Comparacion mensual",
    intro: "Esta grafica te dice que meses cargan mas ingreso o tarjeta.",
    focus: "Ingresos y tarjeta se muestran lado a lado para detectar meses pesados.",
    action: "Busca el mes donde tarjeta se acerca demasiado a ingresos.",
    outcome: "Tienes una alerta visual antes de ver la tabla.",
  },
  {
    moduleId: "reports",
    view: "reports",
    target: "reports-table",
    targetLabel: "Tabla de reporte",
    title: "Resumen numerico",
    intro: "La tabla mensual es la version exacta de la grafica.",
    focus: "Ingresos, gastos efectivo, pago TDC, flujo y ahorro de cierre.",
    action: "Usala para revisar numeros finos o exportarlos a CSV.",
    outcome: "Puedes auditar el plan mes por mes.",
  },
  {
    moduleId: "settings",
    view: "settings",
    target: "settings-form",
    targetLabel: "Ajustes principales",
    title: "Supuestos base",
    intro: "Aqui viven las constantes del plan.",
    focus: "Saldo actual, sueldo estimado, renta y deuda inicial que no hayas registrado en compras.",
    action: "Usalo para conciliar los saldos que muestran tu banco y tu tarjeta.",
    outcome: "Los movimientos siguientes parten de saldos reales.",
  },
  {
    moduleId: "settings",
    view: "settings",
    target: "settings-save",
    targetLabel: "Guardar ajustes",
    title: "Guardar cambios",
    intro: "Los cambios de supuestos no se aplican hasta guardar.",
    focus: "Este boton persiste los ajustes en IndexedDB.",
    action: "Presionalo despues de editar los campos base.",
    outcome: "La app recalcula y conserva los datos localmente.",
  },
  {
    moduleId: "settings",
    view: "settings",
    target: "settings-sync",
    targetLabel: "Sync cifrado",
    title: "Sincronizacion segura",
    intro: "Este bloque sube y baja respaldos cifrados.",
    focus: "Endpoint, ID de sync, contrasena local y botones de subir/bajar.",
    action: "Prueba conexion antes de subir o bajar.",
    outcome: "Tus datos viajan cifrados; el servidor solo guarda texto cifrado.",
  },
  {
    moduleId: "guide",
    view: "guide",
    target: "guide-hero",
    targetLabel: "Manual dinamico",
    title: "Manual central",
    intro: "El manual queda como referencia permanente.",
    focus: "Explica pantallas, rutas sugeridas y acceso a tours por modulo.",
    action: "Vuelve aqui cuando quieras entender una parte sin preguntarme otra vez.",
    outcome: "La app se explica a si misma.",
  },
  {
    moduleId: "guide",
    view: "guide",
    target: "guide-tour-cards",
    targetLabel: "Tours por modulo",
    title: "Tours especificos",
    intro: "Estas tarjetas inician recorridos por partes concretas de la app.",
    focus: "Cada modulo tiene varios pasos con foco visual.",
    action: "Elige el modulo que quieres aprender.",
    outcome: "Aprendes solo lo que necesitas en ese momento.",
  },
  {
    moduleId: "guide",
    view: "guide",
    target: "guide-module-cards",
    targetLabel: "Tarjetas del manual",
    title: "Referencia por pantalla",
    intro: "Estas tarjetas son la biblioteca de ayuda.",
    focus: "Guia abre una explicacion rapida; Abrir te lleva a la pantalla.",
    action: "Usa Guia si quieres leer, Tour si quieres que la app te lleve de la mano.",
    outcome: "Tienes ayuda pasiva y ayuda guiada.",
  },
];

const emptyRecurring: RecurringDraft = {
  id: "",
  name: "",
  amount: 0,
  day: 1,
  method: "debit",
  active: true,
};

function toneClass(value: number): string {
  return signedTone(value) === "negative" ? "money-negative" : "money-positive";
}

function getField(form: HTMLFormElement, key: string): string {
  return String(new FormData(form).get(key) ?? "");
}

function getPeriodLabel(periods: Period[], id: string): string {
  return periods.find((period) => period.id === id)?.label || "Sin quincena";
}

function isClosedPeriod(state: AppState, periodId: string): boolean {
  return Boolean(state.periods.find((period) => period.id === periodId)?.closedAt);
}

function transactionMethodLabel(method: Transaction["method"]): string {
  if (method === "income") return "Ingreso";
  if (method === "credit") return "Tarjeta de credito";
  if (method === "card_payment") return "Pago TDC aplicado";
  return "Efectivo / debito";
}

function payrollRentReserve(state: AppState, previousReserve = 0): number {
  const monthlyRent = Math.max(0, asNumber(state.settings.monthlyRent));
  const reserveBeforeEdit = Math.max(0, state.settings.rentReserve - previousReserve);
  return Math.min(monthlyRent / 2, Math.max(0, monthlyRent - reserveBeforeEdit));
}

function MetricCard({
  label,
  value,
  note,
  icon: Icon,
}: {
  label: string;
  value: string;
  note: string;
  icon: LucideIcon;
}) {
  return (
    <article className="metric-card group">
      <div className="mb-5 flex items-center justify-between gap-3">
        <span className="text-sm font-black text-slate-500">{label}</span>
        <span className="metric-icon">
          <Icon size={21} />
        </span>
      </div>
      <strong className="metric-value block text-3xl font-black text-navy">{value}</strong>
      <small className="mt-2 block text-sm text-slate-500">{note}</small>
    </article>
  );
}

function Modal({
  open,
  children,
  onClose,
}: {
  open: boolean;
  children: ReactNode;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const selector = 'button:not(:disabled), input:not([type="hidden"]):not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]';
    (dialog?.querySelector<HTMLElement>('input:not([type="hidden"]), button') || dialog)?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); closeRef.current(); }
      if (event.key !== "Tab" || !dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(selector)).filter((element) => element.getClientRects().length > 0);
      const first = focusable[0]; const last = focusable.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    dialog?.addEventListener("keydown", handleKey);
    return () => { dialog?.removeEventListener("keydown", handleKey); if (previous?.isConnected) previous.focus(); };
  }, [open]);
  if (!open) return null;
  return (
    <div ref={dialogRef} tabIndex={-1} className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Registro y confirmación">
      <div className="animate-fade-up w-full max-w-3xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card">
        <button
          className="absolute right-5 top-5 z-10 grid h-10 w-10 place-items-center rounded-full bg-white/80 text-navy shadow"
          type="button"
          onClick={onClose}
          aria-label="Cerrar modal"
        >
          <X size={18} />
        </button>
        {children}
      </div>
    </div>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-blue-200 bg-white p-8 text-center">
      <Sparkles className="mx-auto mb-3 text-teal" />
      <h4 className="font-black text-navy">{title}</h4>
      <p className="mt-2 text-sm text-slate-500">{text}</p>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="label">
      {label}
      {children}
    </label>
  );
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "0%";
  return `${Math.round(value)}%`;
}

function pwaStatusText(status: PwaUpdateStatus): string {
  const labels: Record<PwaUpdateStatus, string> = {
    unsupported: "No disponible",
    checking: "Buscando",
    current: "Actualizada",
    available: "Lista",
    activating: "Activando",
    reloading: "Recargando",
    error: "Error",
  };
  return labels[status];
}

function buildFinancialInsights(
  state: AppState,
  periods: CalculatedPeriod[],
  monthly: MonthlyReport[],
  cardDebt: CardDebtSummary,
): FinancialInsight[] {
  const insights: FinancialInsight[] = [];
  const currentSavings = Math.max(0, asNumber(state.settings.currentSavings));
  const salary = Math.max(0, asNumber(state.settings.salary));
  const monthlyRent = Math.max(0, asNumber(state.settings.monthlyRent));
  const rentReserve = Math.max(0, asNumber(state.settings.rentReserve));
  const finalSavings = periods.at(-1)?.savings || currentSavings;
  const lowestSavings = periods.reduce<CalculatedPeriod | null>(
    (lowest, period) => (!lowest || period.savings < lowest.savings ? period : lowest),
    null,
  );
  const worstFlow = periods.reduce<CalculatedPeriod | null>(
    (worst, period) => (!worst || period.flow < worst.flow ? period : worst),
    null,
  );
  const activeRecurring = state.recurring
    .filter((item) => item.active && asNumber(item.amount) > 0)
    .sort((left, right) => asNumber(right.amount) - asNumber(left.amount));
  const inactiveRecurring = state.recurring.filter((item) => !item.active || asNumber(item.amount) <= 0);
  const recurringTotal = activeRecurring.reduce((total, item) => total + Math.max(0, asNumber(item.amount)), 0);
  const recurringTop = activeRecurring[0];
  const nextPaymentShare = currentSavings > 0 ? (cardDebt.nextPayment / currentSavings) * 100 : 0;
  const cardVsSavings = currentSavings > 0 ? (cardDebt.totalDebt / currentSavings) * 100 : 0;
  const monthlyCardPeak = monthly.reduce((peak, row) => Math.max(peak, Math.abs(row.cardPayment)), 0);

  if (salary <= 0) {
    insights.push({
      id: "salary-missing",
      title: "Falta nomina estimada",
      value: formatMoney(0),
      detail: "Las quincenas futuras solo pueden proyectar egresos mientras este monto siga en cero.",
      action: "Configura tu nomina estimada por quincena.",
      tone: "warning",
      icon: CircleDollarSign,
      view: "settings",
    });
  }

  if (cardDebt.totalDebt > currentSavings && currentSavings > 0) {
    insights.push({
      id: "card-above-savings",
      title: "Tarjeta por encima del ahorro",
      value: formatMoney(cardDebt.totalDebt - currentSavings),
      detail: `El total ocupado equivale a ${formatPercent(cardVsSavings)} de tu ahorro actual.`,
      action: "Congela compras nuevas y usa el siguiente pago para bajar saldo real.",
      tone: "danger",
      icon: CreditCard,
      view: "card",
    });
  } else if (cardDebt.totalDebt > 0) {
    insights.push({
      id: "card-under-control",
      title: "Tarjeta contenida",
      value: formatMoney(cardDebt.totalDebt),
      detail: "El saldo ocupado no rebasa tu ahorro actual.",
      action: "Manten el pago siguiente y evita subir MSI mientras baja el saldo.",
      tone: "ok",
      icon: CreditCard,
      view: "card",
    });
  }

  if (cardDebt.nextPayment > 0) {
    insights.push({
      id: "next-card-payment",
      title: "Proximo pago TDC",
      value: formatMoney(cardDebt.nextPayment),
      detail:
        currentSavings > 0
          ? `Equivale a ${formatPercent(nextPaymentShare)} de tu ahorro disponible.`
          : "Es el pago mas urgente del calendario de tarjeta.",
      action: nextPaymentShare >= 50 ? "Evita gastos variables hasta cubrirlo." : "Registralo al pagarlo para actualizar ahorro y deuda.",
      tone: nextPaymentShare >= 50 ? "warning" : "info",
      icon: CalendarClock,
      view: "card",
    });
  }

  if (lowestSavings && lowestSavings.savings < 10000) {
    insights.push({
      id: "low-savings",
      title: "Colchon apretado",
      value: formatMoney(lowestSavings.savings),
      detail: `${lowestSavings.label} es el punto mas bajo proyectado.`,
      action: "Recorta gasto variable hasta volver arriba de $10,000.",
      tone: "warning",
      icon: WalletCards,
      view: "periods",
    });
  }

  if (recurringTop) {
    insights.push({
      id: "recurring-review",
      title: "Recurrentes activos",
      value: formatMoney(recurringTotal),
      detail: `${activeRecurring.length} cargos activos; el mayor es ${recurringTop.name} (${formatMoney(recurringTop.amount)}).`,
      action: `Si no se usa, pausalo antes del dia ${recurringTop.day}.`,
      tone: recurringTotal >= 1000 ? "warning" : "info",
      icon: ListChecks,
      view: "recurring",
    });
  }

  if (cardDebt.installmentBalance > 0) {
    insights.push({
      id: "future-card-balance",
      title: "A meses / futuro",
      value: formatMoney(cardDebt.installmentBalance),
      detail: "Es saldo que sigue despues del siguiente corte.",
      action: "Evita MSI nuevos hasta que este bloque baje de forma visible.",
      tone: "info",
      icon: ChartSpline,
      view: "card",
    });
  }

  if (monthlyRent > 0 && rentReserve < monthlyRent) {
    insights.push({
      id: "rent-reserve",
      title: "Renta por completar",
      value: formatMoney(monthlyRent - rentReserve),
      detail: `Tienes apartado ${formatPercent((rentReserve / monthlyRent) * 100)} de la renta mensual.`,
      action: "La siguiente nomina apartara automaticamente la mitad configurada.",
      tone: rentReserve === 0 ? "warning" : "info",
      icon: Receipt,
      view: "settings",
    });
  }

  if (worstFlow && worstFlow.flow < 0 && monthlyCardPeak > 0) {
    insights.push({
      id: "negative-flow",
      title: "Flujo negativo detectado",
      value: formatMoney(worstFlow.flow),
      detail: `${worstFlow.label} es la quincena mas presionada por pagos y gastos.`,
      action: "Mueve compras no urgentes fuera de esa quincena.",
      tone: "danger",
      icon: Lightbulb,
      view: "periods",
    });
  }

  if (inactiveRecurring.length > 0) {
    const names = inactiveRecurring
      .slice(0, 2)
      .map((item) => item.name)
      .join(", ");
    insights.push({
      id: "inactive-recurring",
      title: "Gastos ya contenidos",
      value: `${inactiveRecurring.length}`,
      detail: `${names} ${inactiveRecurring.length === 1 ? "esta" : "estan"} apagados o en $0.`,
      action: "No los reactives salvo que vuelvan a ser necesarios.",
      tone: "ok",
      icon: ShieldCheck,
      view: "recurring",
    });
  }

  if (finalSavings > currentSavings) {
    insights.push({
      id: "projected-recovery",
      title: "Cierre mejora",
      value: formatMoney(finalSavings - currentSavings),
      detail: "El plan proyecta recuperar ahorro hacia noviembre.",
      action: "Protege esa mejora evitando gastos recurrentes nuevos.",
      tone: "ok",
      icon: Sparkles,
      view: "reports",
    });
  }

  return insights.slice(0, 6);
}

export function App() {
  const [state, setState] = useState<AppState>(cloneSeed());
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const savingRef = useRef(false);
  const [view, setView] = useState<ViewId>("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideTopicId, setGuideTopicId] = useState<ViewId | null>(null);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourStepIndex, setTourStepIndex] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState<SpotlightRect | null>(null);
  const [transactionModalOpen, setTransactionModalOpen] = useState(false);
  const [transactionDraft, setTransactionDraft] = useState<Transaction | null>(null);
  const [newTransactionMethod, setNewTransactionMethod] = useState<Transaction["method"]>("cash");
  const [newTransactionCategory, setNewTransactionCategory] = useState("Comida");
  const [recurringDraft, setRecurringDraft] = useState(emptyRecurring);
  const [recurringDraftIndex, setRecurringDraftIndex] = useState<number | null>(null);
  const [syncDraft, setSyncDraft] = useState(cloneSeed().sync);
  const [passphrase, setPassphrase] = useState("");
  const [passphraseConfirm, setPassphraseConfirm] = useState("");
  const [confirmConfig, setConfirmConfig] = useState<ConfirmConfig | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [pwaStatus, setPwaStatus] = useState<PwaUpdateStatus>("checking");
  const [pwaRegistration, setPwaRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const updateReloadingRef = useRef(false);

  const periods = useMemo(() => calculatePeriodsFor(state), [state]);
  const monthly = useMemo(() => calculateMonthlyFor(state, periods), [state, periods]);
  const cardDebt = useMemo(() => calculateCardDebtFor(state, periods), [state, periods]);
  const duePeriods = useMemo(() => duePeriodsFor(state, today), [state]);
  const activeNav = navItems.find((item) => item.id === view) || navItems[0];
  const activeGuide = guideTopics.find((topic) => topic.id === (guideTopicId || view)) || guideTopics[0];
  const activeTourStep = guidedTourSteps[tourStepIndex] || guidedTourSteps[0];

  useEffect(() => {
    loadState()
      .then((loaded) => {
        setState(loaded);
        setSyncDraft(loaded.sync);
      })
      .catch((error: Error) => setLoadError(error.message || "No se pudo leer el registro local."))
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      setPwaStatus("unsupported");
      return undefined;
    }

    let disposed = false;
    const handleControllerChange = () => {
      if (updateReloadingRef.current) return;
      updateReloadingRef.current = true;
      setPwaStatus("reloading");
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
    registerServiceWorker({
      onRegistered: (registration) => {
        if (disposed) return;
        setPwaRegistration(registration);
        setPwaStatus(registration.waiting ? "available" : "current");
      },
      onUpdateAvailable: (registration) => {
        if (disposed) return;
        setPwaRegistration(registration);
        setPwaStatus("available");
        showToast("Actualizacion lista");
      },
    }).catch((error) => {
      console.error(error);
      if (!disposed) setPwaStatus("error");
    });

    return () => {
      disposed = true;
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, []);

  useEffect(() => {
    const collapsed = localStorage.getItem("pf-sidebar-collapsed") === "true";
    setSidebarCollapsed(collapsed);
  }, []);

  useEffect(() => {
    if (!mobileMenu) return undefined;

    const scrollY = window.scrollY;
    const previousBodyStyle = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
    };

    document.documentElement.classList.add("mobile-menu-open");
    document.body.classList.add("mobile-menu-open");
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";

    return () => {
      document.documentElement.classList.remove("mobile-menu-open");
      document.body.classList.remove("mobile-menu-open");
      document.body.style.overflow = previousBodyStyle.overflow;
      document.body.style.position = previousBodyStyle.position;
      document.body.style.top = previousBodyStyle.top;
      document.body.style.width = previousBodyStyle.width;
      window.scrollTo({ top: scrollY, behavior: "instant" });
    };
  }, [mobileMenu]);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => {
    setMobileMenu(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [view]);

  useEffect(() => {
    if (!tourOpen) {
      setSpotlightRect(null);
      return undefined;
    }

    let frame = 0;
    let timer = 0;

    const measure = () => {
      const target = document.querySelector<HTMLElement>(`[data-tour="${activeTourStep.target}"]`);
      if (!target) {
        setSpotlightRect(null);
        return;
      }
      const rect = target.getBoundingClientRect();
      const padding = 10;
      const top = Math.max(8, rect.top - padding);
      const left = Math.max(8, rect.left - padding);
      const right = Math.min(window.innerWidth - 8, rect.right + padding);
      const bottom = Math.min(window.innerHeight - 8, rect.bottom + padding);
      setSpotlightRect({
        top,
        left,
        width: Math.max(32, right - left),
        height: Math.max(32, bottom - top),
      });
    };

    const scrollAndMeasure = () => {
      const target = document.querySelector<HTMLElement>(`[data-tour="${activeTourStep.target}"]`);
      target?.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
      window.setTimeout(measure, 280);
    };

    const scheduleMeasure = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measure);
    };

    timer = window.setTimeout(scrollAndMeasure, 120);
    window.addEventListener("resize", scheduleMeasure);
    window.addEventListener("scroll", scheduleMeasure, true);

    return () => {
      window.clearTimeout(timer);
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", scheduleMeasure);
      window.removeEventListener("scroll", scheduleMeasure, true);
    };
  }, [activeTourStep.target, tourOpen, view]);

  function showToast(message: string, tone: Toast["tone"] = "ok") {
    const id = Date.now();
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 2600);
  }

  async function commit(nextState: AppState, message: string) {
    if (savingRef.current || loadError) return false;
    savingRef.current = true;
    try {
      const normalized = normalizeState({ ...nextState, updatedAt: new Date().toISOString() });
      await saveState(normalized);
      setState(normalized);
      setSyncDraft(normalized.sync);
      setSaveError("");
      showToast(message);
      return true;
    } catch (error) {
      setSaveError(`No se guardaron los cambios: ${(error as Error).message}`);
      return false;
    } finally { savingRef.current = false; }
  }

  function confirmAction(config: Omit<ConfirmConfig, "resolve">): Promise<boolean> {
    return new Promise((resolve) => setConfirmConfig({ ...config, resolve }));
  }

  function resolveConfirm(value: boolean) {
    confirmConfig?.resolve(value);
    setConfirmConfig(null);
  }

  function toggleSidebar() {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    localStorage.setItem("pf-sidebar-collapsed", next ? "true" : "false");
  }

  function resolveTourIndex(start: number | ViewId = 0) {
    if (typeof start === "number") return Math.max(0, Math.min(start, guidedTourSteps.length - 1));
    const index = guidedTourSteps.findIndex((step) => step.moduleId === start);
    return index >= 0 ? index : 0;
  }

  function goToTourStep(index: number) {
    const nextIndex = resolveTourIndex(index);
    const step = guidedTourSteps[nextIndex];
    setTourStepIndex(nextIndex);
    setView(step.view);
    setMobileMenu(false);
    window.setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 60);
  }

  function startGuidedTour(start: number | ViewId = 0) {
    setGuideOpen(false);
    setQuickActionsOpen(false);
    setTourOpen(true);
    goToTourStep(resolveTourIndex(start));
  }

  function closeGuidedTour() {
    setTourOpen(false);
    setSpotlightRect(null);
    showToast("Tour guiado cerrado");
  }

  async function handleInstall() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  async function checkForAppUpdate() {
    if (!("serviceWorker" in navigator)) {
      setPwaStatus("unsupported");
      showToast("Actualizacion no disponible en este navegador", "danger");
      return;
    }

    try {
      setPwaStatus("checking");
      const registration = await checkForServiceWorkerUpdate(pwaRegistration);
      if (!registration) {
        setPwaStatus("unsupported");
        showToast("Actualizacion no disponible en este navegador", "danger");
        return;
      }

      setPwaRegistration(registration);
      if (registration.waiting) {
        setPwaStatus("available");
        showToast("Actualizacion lista");
      } else {
        setPwaStatus("current");
        showToast("Ya tienes la version mas reciente");
      }
    } catch (error) {
      console.error(error);
      setPwaStatus("error");
      showToast("No pude buscar actualizacion", "danger");
    }
  }

  async function applyAppUpdate() {
    const registration = pwaRegistration || (await getServiceWorkerRegistration());
    setPwaRegistration(registration);
    if (!applyServiceWorkerUpdate(registration)) {
      setPwaStatus("current");
      showToast("No hay actualizacion pendiente");
      return;
    }

    setPwaStatus("activating");
    showToast("Actualizando app");
  }

  async function closePeriod(period: Period) {
    const confirmed = await confirmAction({
      title: `Cerrar ${period.label}`,
      message: "La quincena quedara como historial y ya no aceptara cambios. Tus saldos no se modificaran.",
      confirmText: "Cerrar quincena",
    });
    if (!confirmed) return;

    const result = closePeriodFor(state, period.id, today);
    await commit(result.state, result.nextPeriod ? "Quincena cerrada y siguiente agregada" : "Quincena cerrada");
  }

  async function reopenPeriod(period: Period) {
    if (!period.closedAt) return;
    const confirmed = await confirmAction({
      title: `Reabrir ${period.label}`,
      message: "La quincena volvera a aceptar movimientos. Tus saldos no se modificaran.",
      confirmText: "Reabrir quincena",
    });
    if (!confirmed) return;
    await commit(reopenPeriodFor(state, period.id), "Quincena reabierta");
  }

  async function resetRentReserve() {
    const rentReserve = Math.max(0, asNumber(state.settings.rentReserve));
    if (rentReserve <= 0) {
      showToast("No hay renta apartada por restablecer", "danger");
      return;
    }

    const confirmed = await confirmAction({
      title: "Registrar renta pagada",
      message: `Se pondra la renta apartada en $0.00 porque ya pagaste ${formatMoney(rentReserve)} fuera del ahorro.`,
      confirmText: "Renta pagada",
    });
    if (!confirmed) return;
    await commit(reconcileCashBalanceFor(state, state.settings.currentSavings, 0), "Renta apartada restablecida");
  }

  async function submitTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const methodField = getField(form, "method");
    const method: Transaction["method"] =
      methodField === "income"
        ? "income"
        : methodField === "card_payment"
          ? "card_payment"
          : methodField === "credit"
            ? "credit"
            : "cash";
    const date = getField(form, "date") || today;
    const category = method === "card_payment" ? "Pago TDC" : getField(form, "category");
    const periodId = periodIdForDate(state, date);
    const rentReserveAmount =
      method === "income" && category === "Nomina"
        ? payrollRentReserve(state, asNumber(transactionDraft?.rentReserveAmount))
        : 0;
    const transactionBase: Transaction = {
      id: transactionDraft?.id || crypto.randomUUID(),
      date,
      description: getField(form, "description").trim(),
      amount: asNumber(getField(form, "amount")),
      category,
      method,
      periodId,
      shared: getField(form, "shared") === "on",
      userAmount: getField(form, "shared") === "on" ? asNumber(getField(form, "userAmount")) : undefined,
      installments: method === "credit" ? asNumber(getField(form, "totalInstallments"), 1) : 1,
      totalInstallments: method === "credit" ? asNumber(getField(form, "totalInstallments"), 1) : 1,
      monthlyAmount: method === "credit" && getField(form, "monthlyAmount") ? asNumber(getField(form, "monthlyAmount")) : undefined,
      currentInstallment: method === "credit" ? asNumber(getField(form, "currentInstallment")) : 0,
      installmentPaymentIds: method === "credit" && asNumber(getField(form, "currentInstallment")) > 0
        ? transactionDraft?.currentInstallment === asNumber(getField(form, "currentInstallment")) ? transactionDraft.installmentPaymentIds
          : state.transactions.filter((entry) => entry.method === "card_payment" && entry.date <= today).map((entry) => entry.id)
        : undefined,
      nextPaymentMonth: method === "credit" ? getField(form, "nextPaymentMonth") || undefined : undefined,
      installmentsAsOf: method === "credit" && asNumber(getField(form, "currentInstallment")) > 0
        ? transactionDraft?.currentInstallment === asNumber(getField(form, "currentInstallment")) ? transactionDraft.installmentsAsOf || transactionDraft.date : today
        : undefined,
      paymentForPeriodId: method === "card_payment" ? getField(form, "paymentForPeriodId") || undefined : undefined,
      sourceRecurringId: transactionDraft?.sourceRecurringId,
      recurringDate: transactionDraft?.recurringDate,
      skipPlanImpact: false,
      affectsSavings:
        transactionDraft?.method === method && typeof transactionDraft.affectsSavings === "boolean"
          ? transactionDraft.affectsSavings
          : method !== "credit",
      rentReserveAmount,
    };
    if (transactionBase.amount <= 0) {
      showToast("El monto debe ser mayor a cero", "danger");
      return;
    }
    if (!transactionBase.description || (transactionBase.shared && (transactionBase.userAmount! < 0 || transactionBase.userAmount! > transactionBase.amount))) {
      showToast("Revisa el nombre y tu parte: debe estar entre cero y el monto total.", "danger");
      return;
    }
    if (method === "credit") {
      const total = transactionBase.totalInstallments!;
      const paid = transactionBase.currentInstallment!;
      if (!Number.isInteger(total) || total < 1 || total > 120 || !Number.isInteger(paid) || paid < 0 || paid > total) {
        showToast("Revisa el plazo (1 a 120 meses) y las cuotas ya pagadas.", "danger"); return;
      }
      if (total > 1 && (!transactionBase.monthlyAmount || !transactionBase.nextPaymentMonth)) {
        showToast("Indica la mensualidad del banco y el mes de la próxima cuota.", "danger"); return;
      }
      if (transactionBase.monthlyAmount && Math.abs(Math.round(transactionBase.monthlyAmount * 100) * total - Math.round(transactionBase.amount * 100)) > total) {
        showToast("La mensualidad por el plazo debe coincidir con el total de la compra (tolerancia de un centavo por cuota).", "danger"); return;
      }
    }
    if (date > today) {
      showToast("Registra el movimiento cuando realmente ocurra", "danger");
      return;
    }
    if (!transactionBase.periodId) {
      showToast("No existe una quincena para esa fecha", "danger");
      return;
    }
    if (isClosedPeriod(state, transactionBase.periodId) || (transactionDraft && isClosedPeriod(state, transactionDraft.periodId))) {
      showToast("Reabre la quincena antes de cambiar sus movimientos", "danger");
      return;
    }
    const duplicate = state.transactions.some(
      (entry) =>
        entry.id !== transactionDraft?.id &&
        entry.date === transactionBase.date &&
        entry.method === transactionBase.method &&
        entry.category === transactionBase.category &&
        entry.description.trim().toLowerCase() === transactionBase.description.trim().toLowerCase() &&
        Math.abs(entry.amount - transactionBase.amount) < 0.01,
    );
    if (duplicate) {
      const confirmed = await confirmAction({ title: "Movimiento parecido", message: "Ya existe un movimiento con la misma fecha, nombre e importe. Continúa solo si corresponde a una operación real diferente.", confirmText: "Es otra operación" });
      if (!confirmed) return;
    }
    const baseState = transactionDraft
      ? applyTransactionToState(
          {
            ...state,
            transactions: state.transactions.filter((entry) => entry.id !== transactionDraft.id),
          },
          transactionDraft,
          -1,
        )
      : state;
    const transaction = {
      ...transactionBase,
      paymentSchedule: buildPaymentScheduleFor(baseState, transactionBase),
    };
    const saved = await commit(
      applyTransactionToState(
        {
          ...baseState,
          transactions: [...baseState.transactions, transaction],
        },
        transaction,
        1,
      ),
      transactionDraft ? "Movimiento actualizado" : "Movimiento agregado",
    );
    if (!saved) return;
    setTransactionDraft(null);
    setNewTransactionMethod("cash");
    setNewTransactionCategory("Comida");
    setTransactionModalOpen(false);
  }

  function editTransaction(transaction: Transaction) {
    if (isClosedPeriod(state, transaction.periodId)) {
      showToast("Reabre la quincena antes de editar ese movimiento", "danger");
      return;
    }
    setTransactionDraft({ ...transaction });
    setNewTransactionMethod(transaction.method);
    setNewTransactionCategory(transaction.category);
    setTransactionModalOpen(true);
  }

  function clearTransactionDraft() {
    setTransactionDraft(null);
    setNewTransactionMethod("cash");
    setNewTransactionCategory("Comida");
    setTransactionModalOpen(false);
  }

  function openNewTransaction() {
    setTransactionDraft(null);
    setNewTransactionMethod("cash");
    setNewTransactionCategory("Comida");
    setTransactionModalOpen(true);
  }

  async function deleteTransaction(transaction: Transaction) {
    if (isClosedPeriod(state, transaction.periodId)) {
      showToast("Reabre la quincena antes de borrar ese movimiento", "danger");
      return;
    }
    const confirmed = await confirmAction({
      title: "Borrar movimiento",
      message: "Se quitara el movimiento y se recalculara la quincena relacionada.",
      confirmText: "Borrar",
      danger: true,
    });
    if (!confirmed) return;
    await commit(
      applyTransactionToState(
        {
          ...state,
          transactions: state.transactions.filter((entry) => entry.id !== transaction.id),
        },
        transaction,
        -1,
      ),
      "Movimiento borrado",
    );
    if (transactionDraft?.id === transaction.id) clearTransactionDraft();
  }

  async function registerCardPayment(period: CalculatedPeriod) {
    if (period.closedAt) {
      showToast("Reabre la quincena antes de registrar pagos TDC", "danger");
      return;
    }
    const amount = Math.max(0, asNumber(period.pendingCardPayment));
    if (amount <= 0) {
      showToast("Esta quincena no tiene pago TDC pendiente", "danger");
      return;
    }

    const pendingAmount = amount;
    if (pendingAmount <= 0) {
      showToast("Ese pago TDC ya estaba registrado");
      return;
    }

    const confirmed = await confirmAction({
      title: "Registrar pago TDC",
      message: `Se restaran ${formatMoney(pendingAmount)} del ahorro y del saldo utilizado de la tarjeta para ${period.label}.`,
      confirmText: "Registrar pago",
    });
    if (!confirmed) return;

    const transaction: Transaction = {
      id: crypto.randomUUID(),
      date: today,
      description: `Pago TDC ${period.label}`,
      amount: pendingAmount,
      category: "Pago TDC",
      method: "card_payment",
      periodId: periodIdForDate(state, today),
      paymentForPeriodId: period.id,
      shared: false,
      installments: 1,
      paymentSchedule: [],
      affectsSavings: true,
      rentReserveAmount: 0,
    };

    await commit(
      applyTransactionToState(
        {
          ...state,
          transactions: [...state.transactions, transaction],
        },
        transaction,
        1,
      ),
      "Pago TDC registrado",
    );
  }

  async function submitRecurring(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const indexById = recurringDraft.id ? state.recurring.findIndex((entry) => entry.id === recurringDraft.id) : -1;
    const editIndex = indexById >= 0 ? indexById : recurringDraftIndex ?? -1;
    const item: RecurringItem = {
      id: recurringDraft.id || state.recurring[editIndex]?.id || crypto.randomUUID(),
      name: recurringDraft.name,
      amount: asNumber(recurringDraft.amount),
      day: asNumber(recurringDraft.day, 1),
      method: recurringDraft.method,
      active: recurringDraft.active,
      startsOn: recurringDraft.startsOn || today,
      endsOn: recurringDraft.endsOn || undefined,
    };
    if (!item.name.trim() || item.amount <= 0 || !Number.isInteger(item.day) || item.day < 1 || item.day > 31 || (item.endsOn && item.endsOn < item.startsOn!)) {
      showToast("Revisa el nombre, importe, día y fechas de la suscripción.", "danger"); return;
    }
    const recurring =
      editIndex >= 0
        ? state.recurring.map((entry, index) => (index === editIndex ? item : entry))
        : [...state.recurring, item];
    const reconciled = reconcileRecurringTransactions({ ...state, recurring }, today, [item.id]);
    await commit(reconciled.state, "Recurrente guardado");
    clearRecurringDraft();
  }

  async function confirmRecurring(transaction: Transaction) {
    if (isClosedPeriod(state, transaction.periodId)) {
      showToast("Reabre la quincena de esa fecha para confirmar el cargo.", "danger"); return;
    }
    if (state.transactions.some((entry) => entry.sourceRecurringId === transaction.sourceRecurringId && entry.recurringDate?.slice(0, 7) === transaction.recurringDate?.slice(0, 7))) return;
    const matching = state.transactions.filter((entry) => !entry.sourceRecurringId && entry.date === transaction.date && entry.method === transaction.method && entry.amount === transaction.amount && entry.description.trim().toLowerCase() === transaction.description.trim().toLowerCase());
    if (matching.length === 1) {
      await commit({ ...state, transactions: state.transactions.map((entry) => entry.id === matching[0].id ? { ...entry, sourceRecurringId: transaction.sourceRecurringId, recurringDate: transaction.recurringDate } : entry) }, "La suscripción se vinculó al cargo que ya registraste"); return;
    }
    await commit(applyTransactionToState({ ...state, transactions: [...state.transactions, transaction] }, transaction), "Cargo confirmado una sola vez");
  }

  function editRecurring(item: RecurringItem, index: number) {
    setRecurringDraft({ ...item });
    setRecurringDraftIndex(index);
  }

  function clearRecurringDraft() {
    setRecurringDraft({ ...emptyRecurring });
    setRecurringDraftIndex(null);
  }

  async function deleteRecurring(item: RecurringItem) {
    const confirmed = await confirmAction({
      title: "Borrar recurrente",
      message: "El gasto recurrente saldra del registro editable.",
      confirmText: "Borrar",
      danger: true,
    });
    if (!confirmed) return;
    const reconciled = reconcileRecurringTransactions(
      { ...state, recurring: state.recurring.filter((entry) => entry.id !== item.id) },
      today,
      [item.id],
    );
    await commit(reconciled.state, "Recurrente borrado");
    if (recurringDraft.id === item.id) clearRecurringDraft();
  }

  async function submitSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const next = reconcileCashBalanceFor(state, asNumber(getField(form, "currentSavings")), asNumber(getField(form, "rentReserve")));
    await commit({ ...next, settings: { ...next.settings,
      salary: asNumber(getField(form, "salary")), monthlyRent: asNumber(getField(form, "monthlyRent")),
      cutoffDay: asNumber(getField(form, "cutoffDay")), dueDay: asNumber(getField(form, "dueDay")),
      openingCardDebt: asNumber(getField(form, "openingCardDebt")),
      openingCardPaymentMonth: getField(form, "openingCardPaymentMonth") || today.slice(0, 7),
    } }, "Ajustes guardados");
  }

  async function resetTemplate() {
    const confirmed = await confirmAction({
      title: "Empezar un nuevo plan",
      message: "Se descargará un respaldo del plan actual y empezarás desde cero, con las quincenas de hoy en adelante. Conserva ese archivo para recuperar tu registro anterior.",
      confirmText: "Respaldar y empezar",
      danger: true,
    });
    if (!confirmed) return;
    exportStateJson(state, today);
    await commit(cloneSeed(), "Nuevo plan listo");
  }

  async function importJson(file?: File | null) {
    if (!file) return;
    try {
      const imported = await readJsonFile(file);
      const next = normalizeState(imported as Partial<AppState>);
      if (state.transactions.length || state.recurring.length || state.settings.currentSavings) {
        const confirmed = await confirmAction({ title: "Importar respaldo", message: "El archivo reemplazará el plan de este dispositivo. Primero se descargará una copia de tu plan actual.", confirmText: "Respaldar e importar" });
        if (!confirmed) return;
        exportStateJson(state, today);
      }
      await commit(next, "Respaldo importado");
    } catch (error) { setSaveError(`No se importó el archivo: ${(error as Error).message}`); }
    finally { if (fileInputRef.current) fileInputRef.current.value = ""; }
  }

  function validateSyncInputs() {
    const endpoint = normalizeEndpoint(syncDraft.endpoint.trim());
    const syncId = syncDraft.syncId.trim();
    if (!endpoint) throw new Error("Falta endpoint");
    if (!syncId) throw new Error("Falta ID de sincronizacion");
    if (!passphrase || passphrase.length < 8) throw new Error("La contrasena debe tener al menos 8 caracteres");
    if (passphraseConfirm && passphraseConfirm !== passphrase) throw new Error("Las contrasenas no coinciden");
    return { endpoint, syncId, passphrase };
  }

  async function saveSyncSettings() {
    const endpoint = normalizeEndpoint(syncDraft.endpoint.trim());
    const syncId = syncDraft.syncId.trim();
    await commit({ ...state, sync: { endpoint, syncId } }, "Sync guardado");
  }

  async function testSync() {
    try {
      const endpoint = normalizeEndpoint(syncDraft.endpoint.trim());
      if (!endpoint) throw new Error("Falta endpoint");
      const result = await fetchSync<{ ok: boolean }>(`${endpoint}/api/health`);
      showToast(result?.ok ? "Backend conectado" : "Respuesta desconocida");
    } catch (error) {
      showToast(`Sync fallo: ${(error as Error).message}`, "danger");
    }
  }

  async function pushSync() {
    try {
      const inputs = validateSyncInputs();
      const nextState = { ...state, sync: { endpoint: inputs.endpoint, syncId: inputs.syncId } };
      const payload = await encryptStateForSync(nextState, inputs.passphrase);
      await fetchSync(`${inputs.endpoint}/api/sync/${encodeURIComponent(inputs.syncId)}`, {
        method: "PUT",
        headers: { "X-Sync-Secret": await syncSecret(inputs.passphrase) },
        body: JSON.stringify({ payload }),
      });
      await commit(nextState, "Respaldo cifrado subido");
    } catch (error) {
      showToast(`No pude subir: ${(error as Error).message}`, "danger");
    }
  }

  async function pullSync() {
    try {
      const inputs = validateSyncInputs();
      const result = await fetchSync<{ payload: Parameters<typeof decryptStateFromSync>[0] }>(
        `${inputs.endpoint}/api/sync/${encodeURIComponent(inputs.syncId)}`,
        { headers: { "X-Sync-Secret": await syncSecret(inputs.passphrase) } },
      );
      const next = await decryptStateFromSync(result.payload, inputs.passphrase);
      await commit({ ...next, sync: { endpoint: inputs.endpoint, syncId: inputs.syncId } }, "Respaldo cifrado descargado");
    } catch (error) {
      showToast(`No pude bajar: ${(error as Error).message}`, "danger");
    }
  }

  const hasRealData =
    state.settings.currentSavings !== 0 ||
    state.transactions.length > 0 ||
    state.recurring.length > 0;

  const lowSavings = periods.find((period) => period.savings < 0);
  const negativeFlows = periods.filter((period) => period.flow < 0);
  const financialInsights = useMemo(
    () => buildFinancialInsights(state, periods, monthly, cardDebt),
    [state, periods, monthly, cardDebt],
  );
  const chartData = monthly.map((row) => ({
    month: row.month,
    ingresos: row.income,
    flujo: row.flow,
    ahorro: row.savings,
    tarjeta: Math.abs(row.cardPayment),
  }));

  if (loadError) return <main className="grid min-h-screen place-items-center p-6"><section className="panel max-w-xl"><h1 className="text-2xl text-navy">No se pudo abrir tu registro</h1><p className="my-4">{loadError}</p><p className="mb-4 text-sm text-slate-500">Tus datos guardados se conservan. Reintenta antes de registrar cambios.</p><button className="button-primary" onClick={() => window.location.reload()}>Reintentar</button></section></main>;
  if (!ready) {
    return (
      <div className="grid min-h-dvh place-items-center p-6">
        <div className="panel max-w-sm text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-lg bg-ocean text-white">
            <Sparkles className="animate-soft-pulse" />
          </div>
          <h1 className="text-xl font-black text-navy">Cargando tu plan</h1>
          <p className="mt-2 text-sm text-slate-500">Preparando IndexedDB, PWA y calculos...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {mobileMenu ? <div className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm lg:hidden" onClick={() => setMobileMenu(false)} /> : null}

      <div
        className={`app-shell grid min-h-dvh transition-[grid-template-columns] duration-200 lg:grid-cols-[18rem_minmax(0,1fr)] ${
          sidebarCollapsed ? "lg:grid-cols-[6rem_minmax(0,1fr)]" : ""
        }`}
      >
        <aside
          data-open={mobileMenu}
          className={`app-sidebar mobile-menu-shell fixed inset-y-0 left-0 z-50 flex h-dvh w-[min(21rem,calc(100vw-3rem))] flex-col gap-6 overflow-y-auto p-5 shadow-2xl transition-transform duration-200 lg:sticky lg:top-0 lg:w-auto lg:translate-x-0 lg:overflow-hidden ${
            mobileMenu ? "translate-x-0" : "-translate-x-[105%]"
          } ${sidebarCollapsed ? "lg:items-center lg:p-4" : ""}`}
        >
          <div className="flex items-center gap-3">
            <div className="brand-mark grid h-12 w-12 shrink-0 place-items-center rounded-lg font-black">
              PF
            </div>
            {!sidebarCollapsed ? (
              <div className="brand-copy min-w-0">
                <h1 className="truncate text-base font-black">Plan Financiero</h1>
                <p className="truncate text-xs">Quincenas, TDC y ahorros</p>
              </div>
            ) : null}
            <button
              className="sidebar-icon-button ml-auto hidden h-10 w-10 place-items-center rounded-lg lg:grid"
              type="button"
              onClick={toggleSidebar}
              aria-label={sidebarCollapsed ? "Mostrar menu" : "Ocultar menu"}
            >
              {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </button>
            <button
              className="sidebar-icon-button ml-auto grid h-10 w-10 place-items-center rounded-lg lg:hidden"
              type="button"
              onClick={() => setMobileMenu(false)}
              aria-label="Cerrar menu"
            >
              <X size={18} />
            </button>
          </div>

          <nav className="grid gap-2" role="tablist" aria-label="Secciones" data-tour="sidebar-nav">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = view === item.id;
              return (
                <button
                  key={item.id}
                  className={`nav-item flex items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-black transition ${
                    active ? "active" : ""
                  } ${sidebarCollapsed ? "lg:justify-center lg:px-2" : ""}`}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setView(item.id);
                    setMobileMenu(false);
                  }}
                  title={item.label}
                >
                  <span className="nav-icon grid h-9 w-9 shrink-0 place-items-center rounded-lg">
                    <Icon size={18} />
                  </span>
                  {!sidebarCollapsed ? <span>{item.label}</span> : null}
                </button>
              );
            })}
          </nav>

          <div className={`sidebar-footer mt-auto rounded-lg p-4 ${sidebarCollapsed ? "lg:p-3" : ""}`}>
            {sidebarCollapsed ? (
              <ShieldCheck className="mx-auto" />
            ) : (
              <>
                <p className="eyebrow">PWA</p>
                <p className="mt-2 text-sm">Instalable, offline y con sync cifrado.</p>
                <button
                  className="button-ghost mt-4 w-full"
                  type="button"
                  onClick={() => {
                    setView("guide");
                    setMobileMenu(false);
                  }}
                >
                  <BookOpen size={16} />
                  Manual de uso
                </button>
                <button className="button-ghost mt-2 w-full" type="button" onClick={() => startGuidedTour()}>
                  <PlayCircle size={16} />
                  Tour guiado
                </button>
                {installPrompt ? (
                  <button className="button-ghost mt-4 w-full" type="button" onClick={handleInstall}>
                    Instalar app
                  </button>
                ) : null}
              </>
            )}
          </div>
        </aside>

        <main className="min-w-0 p-3 sm:p-5 lg:p-8">
          <header className="app-header md:sticky md:top-0 z-30 mb-5 flex flex-col gap-4 py-2 md:flex-row md:items-center md:justify-between">
            <div className="relative">
              <p className="eyebrow">Plan financiero</p>
              <h2 className="text-3xl font-black text-navy sm:text-4xl">{activeNav.label}</h2>
              <p className="mt-1 max-w-2xl text-sm text-slate-500">{activeGuide.summary}</p>
            </div>
            <div className="app-header-actions relative flex flex-wrap items-center gap-2" data-tour="header-actions">
              <button className="button-ghost lg:hidden" type="button" onClick={() => setMobileMenu(true)}>
                <Menu size={18} />
                Menu
              </button>
              <button
                className="icon-button"
                type="button"
                onClick={() => {
                  setGuideTopicId(view);
                  setGuideOpen(true);
                }}
                aria-label="Ayuda"
                title="Ayuda"
              >
                <CircleHelp size={18} />
              </button>
              {pwaStatus === "available" ? (
                <button className="button-secondary" type="button" onClick={applyAppUpdate}>
                  <RefreshCcw size={18} />
                  Actualizar
                </button>
              ) : null}
              <button className="button-primary" type="button" onClick={openNewTransaction}>
                <Plus size={18} />
                Registrar
              </button>
              <button className="icon-button" type="button" onClick={() => setQuickActionsOpen(true)} aria-label="Acciones" title="Acciones">
                <Sparkles size={18} />
              </button>
            </div>
          </header>

          {saveError ? <div className="panel mb-5 border-red-200" role="alert"><p>{saveError}</p><button className="button-ghost mt-3" onClick={() => setSaveError("")}>Cerrar aviso</button></div> : null}
          {state.migrationWarnings?.length ? <div className="panel mb-5" role="status"><strong>Revisa los datos importados</strong>{state.migrationWarnings.map((warning) => <p className="mt-2 text-sm" key={warning}>{warning}</p>)}</div> : null}
          <section className="animate-fade-up">
            {view === "dashboard" ? (
              <Dashboard
                periods={periods}
                state={state}
                cardDebt={cardDebt}
                hasRealData={hasRealData}
                lowSavings={lowSavings}
                negativeFlows={negativeFlows.length}
                insights={financialInsights}
                chartData={chartData}
                onImport={importJson}
                onEditPeriods={() => setView("periods")}
                onNavigate={setView}
                onAddMovement={openNewTransaction}
                fileInputRef={fileInputRef}
              />
            ) : null}
            {view === "periods" ? (
              <PeriodsView
                periods={periods}
                duePeriods={duePeriods}
                onClosePeriod={closePeriod}
                onReopenPeriod={reopenPeriod}
              />
            ) : null}
            {view === "transactions" ? (
              <TransactionsView
                state={state}
                onEdit={editTransaction}
                onDelete={deleteTransaction}
                onNew={openNewTransaction}
              />
            ) : null}
            {view === "recurring" ? (
              <RecurringView
                state={state}
                onConfirm={confirmRecurring}
                recurring={state.recurring}
                draft={recurringDraft}
                setDraft={setRecurringDraft}
                onClear={clearRecurringDraft}
                onSubmit={submitRecurring}
                onEdit={editRecurring}
                onDelete={deleteRecurring}
              />
            ) : null}
            {view === "card" ? <CardView state={state} periods={periods} cardDebt={cardDebt} onRegisterPayment={registerCardPayment} onEdit={editTransaction} onNewInstallment={() => { setTransactionDraft(null); setNewTransactionMethod("credit"); setNewTransactionCategory("Otro"); setTransactionModalOpen(true); }} /> : null}
            {view === "reports" ? (
              <ReportsView monthly={monthly} chartData={chartData} onExportJson={() => exportStateJson(state, today)} onExportCsv={() => exportMonthlyCsv(monthly, today)} onImport={importJson} />
            ) : null}
            {view === "settings" ? (
              <SettingsView
                state={state}
                syncDraft={syncDraft}
                setSyncDraft={setSyncDraft}
                passphrase={passphrase}
                setPassphrase={setPassphrase}
                passphraseConfirm={passphraseConfirm}
                setPassphraseConfirm={setPassphraseConfirm}
                pwaStatus={pwaStatus}
                onSubmitSettings={submitSettings}
                onReset={resetTemplate}
                onSaveSync={saveSyncSettings}
                onTestSync={testSync}
                onPushSync={pushSync}
                onPullSync={pullSync}
                onCheckUpdate={checkForAppUpdate}
                onApplyUpdate={applyAppUpdate}
                onResetRentReserve={resetRentReserve}
              />
            ) : null}
            {view === "guide" ? (
              <ManualView
                topics={guideTopics}
                tourSteps={guidedTourSteps}
                onNavigate={setView}
                onOpenTopic={(topicId) => {
                  setGuideTopicId(topicId);
                  setGuideOpen(true);
                }}
                onStartTour={startGuidedTour}
              />
            ) : null}
          </section>
        </main>
      </div>

      <Modal open={transactionModalOpen} onClose={clearTransactionDraft}>
        <TransactionForm
          key={`${transactionDraft?.id || "new"}-${newTransactionMethod}-${newTransactionCategory}`}
          state={state}
          draft={transactionDraft}
          defaultMethod={newTransactionMethod}
          defaultCategory={newTransactionCategory}
          onSubmit={submitTransaction}
          onCancel={clearTransactionDraft}
        />
      </Modal>

      <QuickActionsModal
        open={quickActionsOpen}
        onClose={() => setQuickActionsOpen(false)}
        onView={(next) => {
          setQuickActionsOpen(false);
          setView(next);
        }}
        onStartTour={() => startGuidedTour()}
        onNewTransaction={() => {
          setQuickActionsOpen(false);
          openNewTransaction();
        }}
        onExport={() => {
          setQuickActionsOpen(false);
          exportStateJson(state, today);
          showToast("Respaldo exportado");
        }}
      />

      <GuideModal
        open={guideOpen}
        topic={activeGuide}
        onClose={() => setGuideOpen(false)}
        onOpenManual={() => {
          setGuideOpen(false);
          setView("guide");
        }}
      />

      <GuidedTourPanel
        open={tourOpen}
        step={activeTourStep}
        spotlightRect={spotlightRect}
        stepIndex={tourStepIndex}
        totalSteps={guidedTourSteps.length}
        onClose={closeGuidedTour}
        onPrevious={() => goToTourStep(tourStepIndex - 1)}
        onNext={() => {
          if (tourStepIndex >= guidedTourSteps.length - 1) {
            closeGuidedTour();
            setView("guide");
            return;
          }
          goToTourStep(tourStepIndex + 1);
        }}
        onJump={goToTourStep}
      />

      <Modal open={Boolean(confirmConfig)} onClose={() => resolveConfirm(false)}>
        <div className="p-6">
          <p className="eyebrow">Confirmar</p>
          <h3 className="mt-2 text-2xl font-black text-navy">{confirmConfig?.title}</h3>
          <p className="mt-3 text-slate-500">{confirmConfig?.message}</p>
          <div className="mt-6 flex justify-end gap-3">
            <button className="button-ghost" type="button" onClick={() => resolveConfirm(false)}>
              Cancelar
            </button>
            <button className={confirmConfig?.danger ? "button-danger" : "button-primary"} type="button" onClick={() => resolveConfirm(true)}>
              {confirmConfig?.confirmText || "Confirmar"}
            </button>
          </div>
        </div>
      </Modal>

      <div className="fixed bottom-5 left-1/2 z-[100] grid -translate-x-1/2 gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`animate-fade-up rounded-full px-5 py-3 text-sm font-black text-white shadow-glow backdrop-blur-xl ${
              toast.tone === "danger" ? "bg-red-700/92" : "bg-navy/92"
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </>
  );
}

function Dashboard({
  periods,
  state,
  cardDebt,
  hasRealData,
  lowSavings,
  negativeFlows,
  insights,
  chartData,
  onImport,
  onEditPeriods,
  onNavigate,
  onAddMovement,
  fileInputRef,
}: {
  periods: CalculatedPeriod[];
  state: AppState;
  cardDebt: CardDebtSummary;
  hasRealData: boolean;
  lowSavings?: CalculatedPeriod;
  negativeFlows: number;
  insights: FinancialInsight[];
  chartData: Array<Record<string, number | string>>;
  onImport: (file?: File | null) => void;
  onEditPeriods: () => void;
  onNavigate: (view: ViewId) => void;
  onAddMovement: () => void;
  fileInputRef: RefObject<HTMLInputElement>;
}) {
  const activePeriod = periods.find((period) => period.id === periodIdForDate(state, today)) || periods.find((period) => !period.closedAt) || periods[0];
  const activeRecurring = state.recurring.filter((item) => item.active && item.amount > 0);
  const recurringTotal = activeRecurring.reduce((total, item) => total + item.amount, 0);
  const recurringDebitTotal = activeRecurring
    .filter((item) => item.method === "debit")
    .reduce((total, item) => total + item.amount, 0);
  const recurringCreditTotal = recurringTotal - recurringDebitTotal;
  return (
    <div className="dashboard-stack grid gap-5">
      <section className="dashboard-hero" data-tour="dashboard-hero">
        <div className="dashboard-hero-main">
          <div>
            <p className="dashboard-hero-period">{activePeriod?.label || "Sin quincena activa"}</p>
            <p className="dashboard-hero-label">Tu saldo, al día</p>
            <strong className="dashboard-hero-balance">{formatMoney(state.settings.currentSavings)}</strong>
          </div>
          <div className="dashboard-hero-meta">
            <span>
              <CircleDollarSign size={17} />
              Nomina estimada <strong>{formatMoney(state.settings.salary)}</strong>
            </span>
            <span>
              <Receipt size={17} />
              Renta apartada <strong>{formatMoney(state.settings.rentReserve)}</strong>
            </span>
          </div>
        </div>
        <div className="dashboard-hero-side">
          <div>
            <p>Saldo utilizado TDC</p>
            <strong>{formatMoney(cardDebt.totalDebt)}</strong>
          </div>
          <div className="dashboard-hero-payment">
            <span>Proximo pago</span>
            <strong>{formatMoney(cardDebt.nextPayment)}</strong>
          </div>
          <button className="dashboard-register-button" type="button" onClick={onAddMovement}>
            <Plus size={19} />
            Registrar movimiento
          </button>
        </div>
      </section>

      <section className="metric-grid grid gap-4" data-tour="dashboard-metrics">
        <MetricCard label="Renta apartada" value={formatMoney(state.settings.rentReserve)} note={`Meta mensual ${formatMoney(state.settings.monthlyRent)}`} icon={Receipt} />
        <MetricCard label="Nomina estimada" value={formatMoney(state.settings.salary)} note="Proyeccion por quincena" icon={CircleDollarSign} />
        <MetricCard label="Proximo pago TDC" value={formatMoney(cardDebt.nextPayment)} note="Pendiente calculado" icon={CalendarClock} />
        <MetricCard
          label="Recurrentes activos"
          value={formatMoney(recurringTotal)}
          note={`Ahorro ${formatMoney(recurringDebitTotal)} | TDC ${formatMoney(recurringCreditTotal)}`}
          icon={ListChecks}
        />
        <MetricCard label="Cierre proyectado" value={formatMoney(periods.at(-1)?.savings || 0)} note={periods.at(-1)?.label || "Sin proyeccion"} icon={ChartSpline} />
      </section>

      {hasRealData ? <FinancialInsightsPanel insights={insights} onNavigate={onNavigate} /> : null}

      {!hasRealData ? (
        <section className="panel flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="eyebrow">Tu punto de partida</p>
            <h3 className="text-xl font-black text-navy">Construye tu nuevo plan</h3>
            <p className="mt-2 text-sm text-slate-500">
              Empieza con tu saldo actual y sueldo estimado. Después agrega suscripciones, compras a meses y movimientos reales.
            </p>
          </div>
          <button className="button-primary" onClick={() => onNavigate("settings")}><Settings size={18} />Configurar mi plan</button>
          <label className="button-ghost">
            <Upload size={18} />
            Importar respaldo
            <input ref={fileInputRef} hidden type="file" accept="application/json" onChange={(event) => onImport(event.target.files?.[0])} />
          </label>
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,.75fr)] xl:gap-5">
        <div className="panel" data-tour="dashboard-chart">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="eyebrow">Tendencia</p>
              <h3 className="text-xl font-black text-navy">Ahorro y flujo mensual</h3>
            </div>
          </div>
          <div className="h-64 sm:h-72">
            <ResponsiveContainer>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#23344b" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <YAxis tickFormatter={(value) => `$${Math.round(Number(value) / 1000)}k`} tickLine={false} axisLine={false} />
                <Tooltip formatter={(value) => formatMoney(value)} />
                <Area type="monotone" dataKey="ahorro" stroke="#62dbea" fill="#62dbea" fillOpacity={0.13} strokeWidth={3} />
                <Area type="monotone" dataKey="flujo" stroke="#b9f17c" fill="#b9f17c" fillOpacity={0.07} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel" data-tour="dashboard-risk-alerts">
          <p className="eyebrow">Alertas</p>
          <h3 className="mb-4 text-xl font-black text-navy">Atencion</h3>
          <div className="grid gap-3">
            {lowSavings ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
                {lowSavings.label} baja a <strong>{formatMoney(lowSavings.savings)}</strong>. Conviene revisar gastos variables.
              </div>
            ) : null}
            {negativeFlows ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm">
                {negativeFlows} quincenas tienen flujo negativo por pagos de tarjeta.
              </div>
            ) : null}
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm">
              Cierre proyectado: <strong>{formatMoney(periods.at(-1)?.savings || 0)}</strong>.
            </div>
          </div>
        </div>
      </section>

      <section className="panel" data-tour="dashboard-preview">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="eyebrow">Plan vivo</p>
            <h3 className="text-xl font-black text-navy">Proximas quincenas</h3>
          </div>
          <button className="button-ghost" type="button" onClick={onEditPeriods}>
            Editar
            <ChevronRight size={16} />
          </button>
        </div>
        <PeriodsTable periods={periods.slice(0, 6)} compact />
      </section>
    </div>
  );
}

function FinancialInsightsPanel({
  insights,
  onNavigate,
}: {
  insights: FinancialInsight[];
  onNavigate: (view: ViewId) => void;
}) {
  const toneClass: Record<InsightTone, string> = {
    danger: "border-red-200 bg-red-50 text-red-950",
    warning: "border-amber-200 bg-amber-50 text-amber-950",
    ok: "border-emerald-200 bg-emerald-50 text-emerald-950",
    info: "border-blue-200 bg-blue-50 text-slate-700",
  };
  const iconClass: Record<InsightTone, string> = {
    danger: "bg-red-700 text-white",
    warning: "bg-amber-500 text-white",
    ok: "bg-emerald-700 text-white",
    info: "bg-ocean text-white",
  };

  return (
    <section className="grid gap-4" data-tour="dashboard-alerts">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="eyebrow">Consejos accionables</p>
          <h3 className="text-xl font-black text-navy">Segun tu estado actual</h3>
        </div>
        <span className="pill w-fit">{insights.length} alertas y oportunidades</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {insights.map((insight) => {
          const Icon = insight.icon;
          return (
            <article key={insight.id} className={`insight-card rounded-lg border p-4 shadow-card ${toneClass[insight.tone]}`}>
              <div className="flex items-start gap-3">
                <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg ${iconClass[insight.tone]}`}>
                  <Icon size={20} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-black">{insight.title}</p>
                  <strong className="mt-1 block text-2xl font-black text-navy">{insight.value}</strong>
                </div>
              </div>
              <p className="mt-3 text-sm leading-relaxed">{insight.detail}</p>
              <p className="mt-2 text-sm font-black">{insight.action}</p>
              <button className="button-ghost mt-4 bg-white/70" type="button" onClick={() => onNavigate(insight.view)}>
                Abrir modulo
                <ChevronRight size={16} />
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function PeriodsTable({
  periods,
  compact,
  duePeriodIds,
  onClosePeriod,
  onReopenPeriod,
  tourTarget,
}: {
  periods: CalculatedPeriod[];
  compact?: boolean;
  duePeriodIds?: Set<string>;
  onClosePeriod?: (period: Period) => void;
  onReopenPeriod?: (period: Period) => void;
  tourTarget?: string;
}) {
  const hasActions = Boolean(onClosePeriod || onReopenPeriod);
  return (
    <div className={`table-scroll ${compact ? "table-scroll-compact" : ""} overflow-x-auto rounded-lg border border-blue-100 bg-white`} data-tour={tourTarget}>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="table-head text-left">Quincena</th>
            <th className="table-head text-left">Rango</th>
            <th className="table-head">Ingresos</th>
            <th className="table-head">Gastos / renta</th>
            {!compact ? <th className="table-head">Cargos TDC</th> : null}
            <th className="table-head">Pago TDC</th>
            <th className="table-head">Flujo</th>
            <th className="table-head">Saldo al cierre</th>
            {hasActions ? <th className="table-head" /> : null}
          </tr>
        </thead>
        <tbody>
          {periods.map((period) => (
            <tr key={period.id} className="transition hover:bg-blue-50/70">
              <td className="table-cell text-left font-black text-navy">{period.label}</td>
              <td className="table-cell max-w-xs whitespace-normal text-left text-slate-500">{period.note}</td>
              <td className={`table-cell ${toneClass(period.income)}`}>
                <strong className="block">{formatMoney(period.income)}</strong>
                {period.salary || period.extraIncome ? (
                  <span className="income-breakdown">
                    {period.salaryProjected ? "Nomina estimada" : "Nomina real"}: {formatMoney(period.salary)}
                    {period.extraIncome ? ` | Extras: ${formatMoney(period.extraIncome)}` : ""}
                    {period.rent ? ` | Renta: ${formatMoney(period.rent)}` : ""}
                  </span>
                ) : null}
              </td>
              <td className={`table-cell ${toneClass(period.cashExpenses)}`}>{formatMoney(period.cashExpenses)}</td>
              {!compact ? <td className="table-cell text-amber-700">{formatMoney(period.creditCharges)}</td> : null}
              <td className={`table-cell ${toneClass(period.cardPayment)}`}><strong>{formatMoney(period.cardPayment)}</strong><span className="income-breakdown">Real: {formatMoney(period.actualCardPayment)} · Pendiente: {formatMoney(period.pendingCardPayment)}</span></td>
              <td className={`table-cell ${toneClass(period.flow)}`}>{formatMoney(period.flow)}</td>
              <td className="table-cell font-black text-navy">{formatMoney(period.savings)}<span className="income-breakdown">{period.closedAt ? "Cierre archivado" : "Proyectado"}</span></td>
              {hasActions ? (
                <td className="table-cell">
                  <div className="flex justify-end gap-2">
                    {period.closedAt ? <span className="pill">Cerrada</span> : null}
                    {period.closedAt && onReopenPeriod ? (
                      <button className="button-secondary px-3 py-2" type="button" onClick={() => onReopenPeriod(period)}>
                        Reabrir
                      </button>
                    ) : null}
                    {!period.closedAt && duePeriodIds?.has(period.id) && onClosePeriod ? (
                      <button className="button-primary px-3 py-2" type="button" onClick={() => onClosePeriod(period)}>
                        Cerrar
                      </button>
                    ) : null}
                  </div>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PeriodsView({
  periods,
  duePeriods,
  onClosePeriod,
  onReopenPeriod,
}: {
  periods: CalculatedPeriod[];
  duePeriods: Period[];
  onClosePeriod: (period: Period) => void;
  onReopenPeriod: (period: Period) => void;
}) {
  const duePeriod = duePeriods[0];
  const duePeriodIds = new Set(duePeriods.map((period) => period.id));
  const duePayday = duePeriod ? paydayForPeriod(duePeriod) : null;
  return (
    <div className="grid gap-5">
      {duePeriod ? (
        <section className="panel border-emerald-200 bg-emerald-50/70">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="eyebrow text-emerald-700">Lista para archivar</p>
              <h3 className="text-2xl font-black text-navy">{duePeriod.label}</h3>
              <p className="mt-2 text-sm text-emerald-950">
                Termino el {duePayday}. El cierre no cambia el ahorro, la renta ni la tarjeta.
              </p>
            </div>
            <button className="button-primary" type="button" onClick={() => onClosePeriod(duePeriod)}>
              <Check size={18} />
              Cerrar quincena
            </button>
          </div>
        </section>
      ) : null}

      <section className="panel" data-tour="periods-panel">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="eyebrow">Registro</p>
            <h3 className="text-2xl font-black text-navy">Resumen por quincena</h3>
          </div>
        </div>
        <p className="mb-3 text-sm text-slate-500">Desliza la tabla para ver todos los importes. Los saldos futuros son estimaciones, no dinero confirmado.</p>
        <PeriodsTable
          periods={periods}
          duePeriodIds={duePeriodIds}
          onClosePeriod={onClosePeriod}
          onReopenPeriod={onReopenPeriod}
          tourTarget="periods-table"
        />
      </section>
    </div>
  );
}

function TransactionsView({
  state,
  onEdit,
  onDelete,
  onNew,
}: {
  state: AppState;
  onEdit: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
  onNew: () => void;
}) {
  const [search, setSearch] = useState("");
  const [filterMethod, setFilterMethod] = useState("all");
  const transactions = [...state.transactions].filter((tx) => (filterMethod === "all" || tx.method === filterMethod) && (tx.description + " " + tx.category + " " + tx.date).toLocaleLowerCase("es-MX").includes(search.toLocaleLowerCase("es-MX"))).sort((left, right) => right.date.localeCompare(left.date));
  return (
    <section className="panel" data-tour="transactions-list">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Registro real</p>
          <h3 className="text-2xl font-black text-navy">Movimientos recientes</h3>
        </div>
        <button className="button-primary" type="button" onClick={onNew}>
          <Plus size={18} />
          Registrar movimiento
        </button>
      </div>
      <div className="mb-5 grid gap-3 md:grid-cols-2"><Field label="Buscar movimientos"><input className="input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre, categoría o fecha" type="search" /></Field><Field label="Tipo de movimiento"><select className="input" value={filterMethod} onChange={(event) => setFilterMethod(event.target.value)}><option value="all">Todos los movimientos</option><option value="income">Ingresos</option><option value="cash">Débito y efectivo</option><option value="credit">Compras TDC</option><option value="card_payment">Pagos TDC</option></select></Field></div>
      {transactions.length ? (
        <div className="grid gap-3">
          {transactions.map((transaction) => {
            const periodClosed = isClosedPeriod(state, transaction.periodId);
            const automatic = Boolean(transaction.sourceRecurringId);
            const locked = periodClosed;
            const schedule = transaction.paymentSchedule?.length
              ? transaction.paymentSchedule
                  .map((payment) => `${getPeriodLabel(state.periods, payment.periodId)}: ${formatMoney(payment.amount)}`)
                  .join(" | ")
              : "";
            return (
              <article key={transaction.id} className="movement-row">
                <div className="min-w-0">
                  <strong className="text-navy">{transaction.description}</strong>
                  <p className="text-sm text-slate-500">
                    {transaction.date} | {transaction.category} | {getPeriodLabel(state.periods, transaction.periodId)}
                  </p>
                  <p className="text-sm text-slate-500">
                    {transaction.method === "income" && transaction.category === "Nomina"
                      ? "Nomina recibida"
                      : transaction.method === "income"
                        ? "Ingreso extra"
                        : transactionMethodLabel(transaction.method)}
                    {automatic ? " | Suscripción confirmada" : ""}
                    {transaction.rentReserveAmount ? ` | Renta: ${formatMoney(transaction.rentReserveAmount)}` : ""}
                  </p>
                  {schedule ? <p className="text-xs text-slate-500">Pago TDC: {schedule}</p> : null}
                </div>
                <div className="flex items-center justify-between gap-2 md:justify-end">
                  <span className={`movement-amount ${transaction.method === "income" ? "income" : transaction.method === "credit" ? "credit" : "expense"}`}>
                    {transaction.method === "income" ? "+" : transaction.method === "credit" ? "" : "-"}{formatMoney(transaction.amount)}
                  </span>
                  {automatic ? <span className="pill">Recurrente</span> : null}
                  {periodClosed ? <span className="pill">Historico</span> : null}
                  <button className="button-ghost px-3 py-2" type="button" onClick={() => onEdit(transaction)} disabled={locked}>
                    Editar
                  </button>
                  <button className="button-ghost px-3 py-2 text-red-700" type="button" onClick={() => onDelete(transaction)} disabled={locked} aria-label={`Borrar ${transaction.description}`}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState title="Sin movimientos todavia" text="Los ingresos y gastos reales apareceran aqui." />
      )}
    </section>
  );
}

function TransactionForm({
  state,
  draft,
  defaultMethod,
  defaultCategory,
  onSubmit,
  onCancel,
}: {
  state: AppState;
  draft: Transaction | null;
  defaultMethod: Transaction["method"];
  defaultCategory: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  const [method, setMethod] = useState<Transaction["method"]>(draft?.method || defaultMethod);
  const [category, setCategory] = useState(draft?.category || defaultCategory);
  const [shared, setShared] = useState(draft?.shared || false);
  const [term, setTerm] = useState(draft?.totalInstallments || draft?.installments || 1);
  const extraIncomeCategories = ["Ingreso extra", "Reembolso", "Venta", "Otro ingreso"];
  const expenseCategories = ["Comida", "Transporte", "Salud", "Servicio", "Hogar", "Mascotas", "Entretenimiento", "Otro"];
  const isPayroll = method === "income" && category === "Nomina";
  const isExtraIncome = method === "income" && !isPayroll;

  function chooseKind(nextMethod: Transaction["method"], nextCategory: string) {
    setMethod(nextMethod);
    setCategory(nextCategory);
  }

  const placeholder = isPayroll
    ? "Ej. Nomina 1a julio"
    : isExtraIncome
      ? "Ej. Reembolso, venta o bono"
      : method === "card_payment"
        ? "Ej. Pago tarjeta julio"
        : "Ej. Farmacia, mandado o gasolina";

  return (
    <form className="transaction-form p-6 sm:p-8" onSubmit={onSubmit} data-tour="transactions-form">
      <p className="eyebrow">Registro real</p>
      <h3 className="mt-2 text-2xl font-black text-navy sm:text-3xl">{draft ? "Editar movimiento" : "Registrar movimiento"}</h3>
      <input type="hidden" name="method" value={method} />

      <div className="movement-type-grid my-6" data-tour="transactions-method">
        <button className={isPayroll ? "movement-type active payroll" : "movement-type"} type="button" onClick={() => chooseKind("income", "Nomina")}>
          <CircleDollarSign size={18} />
          Nomina
        </button>
        <button className={isExtraIncome ? "movement-type active income" : "movement-type"} type="button" onClick={() => chooseKind("income", "Ingreso extra")}>
          <Plus size={18} />
          Ingreso extra
        </button>
        <button className={method === "cash" ? "movement-type active cash" : "movement-type"} type="button" onClick={() => chooseKind("cash", "Comida")}>
          <Receipt size={18} />
          Debito / efectivo
        </button>
        <button className={method === "credit" ? "movement-type active credit" : "movement-type"} type="button" onClick={() => chooseKind("credit", "Comida")}>
          <CreditCard size={18} />
          Compra TDC
        </button>
        <button className={method === "card_payment" ? "movement-type active payment" : "movement-type"} type="button" onClick={() => chooseKind("card_payment", "Pago TDC")}>
          <Check size={18} />
          Pago TDC
        </button>
      </div>

      <Field label="Nombre">
        <input className="input" name="description" required placeholder={placeholder} defaultValue={draft?.description || ""} />
      </Field>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label={method === "credit" ? "Total original de la compra" : "Monto real del movimiento"}>
          <input className="input" name="amount" type="number" step="0.01" min="0.01" required defaultValue={draft?.amount ?? ""} />
        </Field>
        <Field label="Fecha">
          <input className="input" name="date" type="date" max={today} required defaultValue={draft?.date || today} />
        </Field>
      </div>

      {isPayroll || method === "card_payment" ? (
        <input type="hidden" name="category" value={isPayroll ? "Nomina" : "Pago TDC"} />
      ) : (
        <Field label={isExtraIncome ? "Tipo de ingreso" : "Categoria"}>
          <select className="input" name="category" value={category} onChange={(event) => setCategory(event.target.value)}>
            {(isExtraIncome ? extraIncomeCategories : expenseCategories).map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </Field>
      )}

      {isPayroll ? (
        <div className="payroll-status mb-4">
          <div>
            <span>Nomina estimada</span>
            <strong>{formatMoney(state.settings.salary)}</strong>
          </div>
          <div>
            <span>Renta que se aparta</span>
            <strong>{formatMoney(payrollRentReserve(state, asNumber(draft?.rentReserveAmount)))}</strong>
          </div>
        </div>
      ) : null}

      {method === "credit" ? (
        <div data-tour="transactions-installments">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Plazo total en meses (1 = una exhibición)"><input className="input" name="totalInstallments" type="number" min="1" max="120" step="1" value={term} onChange={(event) => setTerm(Number(event.target.value))} required /></Field>
            <Field label="Cuotas ya pagadas antes de este registro"><input className="input" name="currentInstallment" type="number" min="0" max={term} step="1" defaultValue={draft?.currentInstallment || 0} required /></Field>
            {term > 1 ? <Field label="Mensualidad fija del banco"><input className="input" name="monthlyAmount" type="number" step="0.01" min="0.01" required defaultValue={draft?.monthlyAmount ?? ""} /></Field> : null}
            <Field label="Mes del próximo pago"><input className="input" name="nextPaymentMonth" type="month" required={term > 1} defaultValue={draft?.nextPaymentMonth || ""} /></Field>
          </div>
          <p className="mb-4 text-sm text-slate-500">Para una compra que ya estás pagando, captura su total original y cuántas cuotas pagaste. Solo se agregará lo pendiente. El mes indicado corresponde al pago, según tu estado de cuenta.</p>
        </div>
      ) : null}
      {method === "cash" || method === "credit" ? <div className="mb-4 rounded-lg border border-blue-100 p-4">
        <label className="flex items-center gap-3"><input name="shared" type="checkbox" checked={shared} onChange={(event) => setShared(event.target.checked)} />Compartir esta compra con otra persona</label>
        {shared ? <><Field label="Mi parte del monto total"><input className="input" name="userAmount" type="number" min="0" step="0.01" required defaultValue={draft?.userAmount ?? ""} /></Field><p className="text-sm text-slate-500">La tarjeta conserva el cargo completo. Tu parte es informativa; un reembolso se registra cuando lo recibas. En efectivo, captura la parte que realmente salió de tu dinero.</p></> : null}
      </div> : null}
      {method === "card_payment" ? <Field label="Aplicar al pago de (opcional)"><select className="input" name="paymentForPeriodId" defaultValue={draft?.paymentForPeriodId || ""}><option value="">Primero el más antiguo pendiente</option>{calculatePeriodsFor(state).filter((period) => (period.pendingCardPayment || 0) > 0 || period.id === draft?.paymentForPeriodId).map((period) => <option key={period.id} value={period.id}>{period.label} · {formatMoney(period.pendingCardPayment)}</option>)}</select></Field> : null}

      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        <button className="button-primary w-full" type="submit">
          {draft ? <Check size={18} /> : <Plus size={18} />}
          {draft ? "Actualizar movimiento" : "Guardar movimiento"}
        </button>
        <button className="button-ghost w-full" type="button" onClick={onCancel}>
          <X size={18} />
          Cancelar
        </button>
      </div>
    </form>
  );
}

function RecurringView({
  state,
  onConfirm,
  recurring,
  draft,
  setDraft,
  onClear,
  onSubmit,
  onEdit,
  onDelete,
}: {
  state: AppState;
  onConfirm: (transaction: Transaction) => void;
  recurring: RecurringItem[];
  draft: RecurringDraft;
  setDraft: (draft: RecurringDraft) => void;
  onClear: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onEdit: (item: RecurringItem, index: number) => void;
  onDelete: (item: RecurringItem) => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const pending = recurringOccurrencesFor(state);
  const activeRecurring = recurring.filter((item) => item.active && item.amount > 0);
  const debitTotal = activeRecurring
    .filter((item) => item.method === "debit")
    .reduce((total, item) => total + item.amount, 0);
  const creditTotal = activeRecurring
    .filter((item) => item.method === "credit")
    .reduce((total, item) => total + item.amount, 0);

  function handleEdit(item: RecurringItem, index: number) {
    onEdit(item, index);
    window.setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  return (
    <div className="grid gap-5">
      <section className="recurring-impact-band" aria-label="Impacto de recurrentes activos">
        <div className="recurring-impact-item">
          <span className="recurring-impact-icon debit">
            <WalletCards size={20} />
          </span>
          <div>
            <p className="text-xs font-black uppercase text-slate-500">Debito programado</p>
            <strong className="mt-1 block text-2xl font-black text-navy">{formatMoney(debitTotal)}</strong>
            <p className="mt-1 text-sm text-slate-600">Se estima cada mes; descuenta saldo cuando confirmas el cargo.</p>
          </div>
        </div>
        <div className="recurring-impact-item">
          <span className="recurring-impact-icon credit">
            <CreditCard size={20} />
          </span>
          <div>
            <p className="text-xs font-black uppercase text-slate-500">TDC programada</p>
            <strong className="mt-1 block text-2xl font-black text-navy">{formatMoney(creditTotal)}</strong>
            <p className="mt-1 text-sm text-slate-600">Se agenda según el corte; aumenta la deuda al confirmar el cargo.</p>
          </div>
        </div>
      </section>

      <section className="panel"><p className="eyebrow">Pendientes de confirmar</p><h3 className="mb-3 text-2xl text-navy">¿Ya se realizó el cargo?</h3><p className="mb-4 text-sm text-slate-500">Confirma únicamente los cargos que veas realizados. Si cambió el importe, confirma y edita ese movimiento. Modificar una suscripción cambia sus previsiones, conservando los cargos reales anteriores.</p>{pending.length ? <div className="grid gap-3">{pending.map(({ recurring, date, transaction }) => <article className="movement-row" key={transaction.id}><div><strong className="text-navy">{recurring.name}</strong><p className="text-sm text-slate-500">{date} · {formatMoney(transaction.amount)} · {recurring.method === "credit" ? "Tarjeta" : "Débito"}</p></div><button className="button-primary" onClick={() => onConfirm(transaction)}><Check size={16} />Confirmar cargo</button></article>)}</div> : <p className="text-sm text-slate-500">No hay cargos vencidos sin confirmar.</p>}</section>
      <div className="grid gap-5 xl:grid-cols-[minmax(320px,.75fr)_minmax(0,1.25fr)]">
        <form ref={formRef} className="panel self-start scroll-mt-24" onSubmit={onSubmit} data-tour="recurring-form">
          <p className="eyebrow">Editar</p>
          <h3 className="mb-5 text-2xl font-black text-navy">{draft.id ? "Editar recurrente" : "Nuevo recurrente"}</h3>
          <Field label="Servicio">
            <input className="input" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} required placeholder="Ej. Spotify" />
          </Field>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Monto">
              <input className="input" value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: asNumber(event.target.value) })} type="number" step="0.01" min="0" required />
            </Field>
            <Field label="Dia">
              <input className="input" value={draft.day} onChange={(event) => setDraft({ ...draft, day: asNumber(event.target.value, 1) })} type="number" min="1" max="31" required />
            </Field>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Medio">
              <select className="input" value={draft.method} onChange={(event) => setDraft({ ...draft, method: event.target.value as RecurringItem["method"] })}>
                <option value="debit">Debito</option>
                <option value="credit">Tarjeta de credito</option>
              </select>
            </Field>
            <Field label="Estado">
              <select className="input" value={String(draft.active)} onChange={(event) => setDraft({ ...draft, active: event.target.value === "true" })}>
                <option value="true">Activo</option>
                <option value="false">Cancelado</option>
              </select>
            </Field>
          </div>
          <div className="grid gap-3 md:grid-cols-2"><Field label="A partir de"><input className="input" type="date" value={draft.startsOn || today} onChange={(event) => setDraft({ ...draft, startsOn: event.target.value })} required /></Field><Field label="Último día (opcional)"><input className="input" type="date" value={draft.endsOn || ""} onChange={(event) => setDraft({ ...draft, endsOn: event.target.value || undefined })} /></Field></div>
          <div className="mt-2 flex gap-2">
            <button className="button-primary flex-1" type="submit">
              <Check size={18} />
              {draft.id ? "Guardar cambios" : "Guardar"}
            </button>
            <button className="button-ghost" type="button" onClick={onClear}>
              Limpiar
            </button>
          </div>
        </form>

        <section className="panel" data-tour="recurring-list">
          <p className="eyebrow">Servicios</p>
          <h3 className="mb-5 text-2xl font-black text-navy">Recurrentes</h3>
          {recurring.length ? (
            <div className="grid gap-3">
              {recurring.map((item, index) => (
                <article key={item.id} className="movement-row">
                  <div className="min-w-0">
                    <strong className="text-navy">{item.name}</strong>
                    <p className="text-sm text-slate-500">
                      Dia {item.day} | {item.method === "credit" ? "Tarjeta" : "Debito"} | {item.active ? "Activo" : "Cancelado"}
                    </p>
                    <span className={`impact-chip ${item.active ? item.method : "inactive"}`}>
                      {item.method === "credit" ? <CreditCard size={14} /> : <WalletCards size={14} />}
                      {item.active
                        ? item.method === "credit"
                          ? "TDC al confirmar el cargo"
                          : "Descuenta saldo al confirmar"
                        : "Pausado: no se aplica"}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 md:justify-end">
                    <span className="pill">{formatMoney(item.amount)}</span>
                    <button className="button-ghost px-3 py-2" type="button" onClick={() => handleEdit(item, index)}>
                      Editar
                    </button>
                    <button className="button-ghost px-3 py-2 text-red-700" type="button" onClick={() => onDelete(item)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title="Sin recurrentes" text="Captura servicios o suscripciones para tenerlos visibles." />
          )}
        </section>
      </div>
    </div>
  );
}

function ReportsView({
  monthly,
  chartData,
  onExportJson,
  onExportCsv,
  onImport,
}: {
  monthly: MonthlyReport[];
  chartData: Array<Record<string, number | string>>;
  onExportJson: () => void;
  onExportCsv: () => void;
  onImport: (file?: File | null) => void;
}) {
  return (
    <section className="panel">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="eyebrow">Resumen</p>
          <h3 className="text-2xl font-black text-navy">Reporte mensual</h3>
        </div>
        <div className="flex flex-wrap gap-2" data-tour="reports-actions">
          <button className="button-secondary" type="button" onClick={onExportJson}>
            <FileJson size={18} />
            JSON
          </button>
          <button className="button-secondary" type="button" onClick={onExportCsv}>
            <Download size={18} />
            CSV
          </button>
          <label className="button-ghost">
            <Upload size={18} />
            Importar JSON
            <input hidden type="file" accept="application/json" onChange={(event) => onImport(event.target.files?.[0])} />
          </label>
        </div>
      </div>
      <div className="mb-6 h-64 sm:h-80" data-tour="reports-chart">
        <ResponsiveContainer>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#23344b" />
            <XAxis dataKey="month" tickLine={false} axisLine={false} />
            <YAxis tickFormatter={(value) => `$${Math.round(Number(value) / 1000)}k`} tickLine={false} axisLine={false} />
            <Tooltip formatter={(value) => formatMoney(value)} />
            <Legend />
            <Bar dataKey="ingresos" fill="#2e75b6" radius={[12, 12, 0, 0]} />
            <Bar dataKey="tarjeta" fill="#0f7f83" radius={[12, 12, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="table-scroll overflow-x-auto rounded-lg border border-blue-100 bg-white" data-tour="reports-table">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="table-head text-left">Mes</th>
              <th className="table-head">Ingresos</th>
              <th className="table-head">Gastos efectivo</th>
              <th className="table-head">Pago TDC</th>
              <th className="table-head">Flujo</th>
              <th className="table-head">Ahorro cierre</th>
            </tr>
          </thead>
          <tbody>
            {monthly.map((row) => (
              <tr key={row.month} className="transition hover:bg-blue-50/70">
                <td className="table-cell text-left font-black text-navy">{row.month}</td>
                <td className="table-cell">{formatMoney(row.income)}</td>
                <td className={`table-cell ${toneClass(row.cashExpenses)}`}>{formatMoney(row.cashExpenses)}</td>
                <td className={`table-cell ${toneClass(row.cardPayment)}`}>{formatMoney(row.cardPayment)}</td>
                <td className={`table-cell ${toneClass(row.flow)}`}>{formatMoney(row.flow)}</td>
                <td className="table-cell font-black text-navy">{formatMoney(row.savings)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SettingsView({
  state,
  syncDraft,
  setSyncDraft,
  passphrase,
  setPassphrase,
  passphraseConfirm,
  setPassphraseConfirm,
  pwaStatus,
  onSubmitSettings,
  onReset,
  onSaveSync,
  onTestSync,
  onPushSync,
  onPullSync,
  onCheckUpdate,
  onApplyUpdate,
  onResetRentReserve,
}: {
  state: AppState;
  syncDraft: AppState["sync"];
  setSyncDraft: (sync: AppState["sync"]) => void;
  passphrase: string;
  setPassphrase: (value: string) => void;
  passphraseConfirm: string;
  setPassphraseConfirm: (value: string) => void;
  pwaStatus: PwaUpdateStatus;
  onSubmitSettings: (event: FormEvent<HTMLFormElement>) => void;
  onReset: () => void;
  onSaveSync: () => void;
  onTestSync: () => void;
  onPushSync: () => void;
  onPullSync: () => void;
  onCheckUpdate: () => void;
  onApplyUpdate: () => void;
  onResetRentReserve: () => void;
}) {
  const settings = state.settings;
  const updateBusy = pwaStatus === "checking" || pwaStatus === "activating" || pwaStatus === "reloading";
  return (
    <div className="grid gap-5">
      <form className="panel" onSubmit={onSubmitSettings} key={`settings-${state.updatedAt}`} data-tour="settings-form">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="eyebrow">Supuestos</p>
            <h3 className="text-2xl font-black text-navy">Ajustes principales</h3>
          </div>
          <button className="button-ghost text-red-700" type="button" onClick={onReset}>
            <RefreshCcw size={18} />
            Nuevo plan desde cero
          </button>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Ahorro actual"><input className="input" name="currentSavings" type="number" step="0.01" defaultValue={settings.currentSavings} /></Field>
          <Field label="Nomina estimada por quincena"><input className="input" name="salary" type="number" step="0.01" min="0" defaultValue={settings.salary} /></Field>
          <Field label="Renta apartada fuera del ahorro"><input className="input" name="rentReserve" type="number" step="0.01" defaultValue={settings.rentReserve} /></Field>
          <Field label="Renta mensual"><input className="input" name="monthlyRent" type="number" step="0.01" defaultValue={settings.monthlyRent} /></Field>
          <Field label="Dia de corte TDC"><input className="input" name="cutoffDay" type="number" min="1" max="31" defaultValue={settings.cutoffDay} /></Field>
          <Field label="Dia limite pago TDC"><input className="input" name="dueDay" type="number" min="1" max="31" defaultValue={settings.dueDay} /></Field>
        </div>
        <div className="mt-6 rounded-lg border border-blue-100 bg-blue-50/50 p-4">
          <p className="eyebrow">Base de tarjeta</p>
          <p className="mt-2 text-sm text-slate-500">
            Captura solo la deuda anterior que no vas a desglosar en compras. Los MSI que registres se suman automáticamente: no los incluyas también aquí. Para empezar desde cero, deja este campo en cero y agrega cada compra.
          </p>
          <div className="mt-4 max-w-md">
            <Field label="Deuda inicial sin compras registradas"><input className="input" name="openingCardDebt" type="number" step="0.01" min="0" defaultValue={settings.openingCardDebt || 0} /></Field>
            <Field label="Mes para liquidar la deuda inicial"><input className="input" name="openingCardPaymentMonth" type="month" defaultValue={settings.openingCardPaymentMonth || today.slice(0, 7)} required /></Field>
          </div>
        </div>
        <button className="button-primary mt-5" type="submit" data-tour="settings-save">
          <Check size={18} />
          Guardar ajustes
        </button>
      </form>

      <section className="panel">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="eyebrow">Renta</p>
            <h3 className="text-2xl font-black text-navy">Apartado de renta</h3>
            <p className="mt-2 text-sm text-slate-500">
              Usa esto cuando ya pagaste la renta con el dinero separado fuera del ahorro.
            </p>
          </div>
          <span className="pill">{formatMoney(settings.rentReserve)}</span>
        </div>
        <button className="button-secondary" type="button" onClick={onResetRentReserve} disabled={settings.rentReserve <= 0}>
          <Check size={18} />
          Renta pagada
        </button>
      </section>

      <section className="panel" data-tour="settings-sync">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="eyebrow">Opcional</p>
            <h3 className="text-2xl font-black text-navy">Sincronizacion cifrada</h3>
          </div>
          <span className="pill">{syncDraft.endpoint ? "Configurable" : "Local"}</span>
        </div>
        <p className="mb-5 text-sm text-slate-500">
          Tus datos se cifran en este dispositivo antes de subirlos; el servidor solo guarda texto cifrado.
        </p>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Endpoint del backend">
            <input className="input" value={syncDraft.endpoint} onChange={(event) => setSyncDraft({ ...syncDraft, endpoint: event.target.value })} />
          </Field>
          <Field label="ID de sincronizacion">
            <input className="input" value={syncDraft.syncId} onChange={(event) => setSyncDraft({ ...syncDraft, syncId: event.target.value })} placeholder="mi-plan-personal" />
          </Field>
          <Field label="Contrasena local">
            <input className="input" value={passphrase} onChange={(event) => setPassphrase(event.target.value)} type="password" autoComplete="new-password" />
          </Field>
          <Field label="Confirmar contrasena">
            <input className="input" value={passphraseConfirm} onChange={(event) => setPassphraseConfirm(event.target.value)} type="password" autoComplete="new-password" />
          </Field>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <button className="button-secondary" type="button" onClick={onSaveSync}>Guardar sync</button>
          <button className="button-ghost" type="button" onClick={onTestSync}>Probar conexion</button>
          <button className="button-primary" type="button" onClick={onPushSync}><ArrowUpFromLine size={18} />Subir cifrado</button>
          <button className="button-secondary" type="button" onClick={onPullSync}><ArrowDownToLine size={18} />Bajar cifrado</button>
        </div>
      </section>

      <section className="panel" data-tour="settings-updates">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="eyebrow">PWA</p>
            <h3 className="text-2xl font-black text-navy">Actualizaciones</h3>
          </div>
          <span className="pill" aria-live="polite">{pwaStatusText(pwaStatus)}</span>
        </div>
        <p className="mb-5 text-sm text-slate-500">
          Puedes instalar la version nueva sin desinstalar la app movil. Tus datos locales se quedan en IndexedDB; aun asi conviene hacer respaldo o sync antes de cambios grandes.
        </p>
        <div className="flex flex-wrap gap-2">
          <button className="button-ghost" type="button" onClick={onCheckUpdate} disabled={updateBusy}>
            <RefreshCcw size={18} />
            Buscar actualizacion
          </button>
          <button className="button-primary" type="button" onClick={onApplyUpdate} disabled={pwaStatus !== "available" || updateBusy}>
            <Check size={18} />
            Actualizar ahora
          </button>
        </div>
      </section>
    </div>
  );
}

function ManualView({
  topics,
  tourSteps,
  onNavigate,
  onOpenTopic,
  onStartTour,
}: {
  topics: GuideTopic[];
  tourSteps: GuidedTourStep[];
  onNavigate: (view: ViewId) => void;
  onOpenTopic: (view: ViewId) => void;
  onStartTour: (start?: number | ViewId) => void;
}) {
  const flow = [
    "Importa tu respaldo privado o captura tus ajustes base.",
    "Revisa Inicio para ver el panorama y alertas.",
    "Registra cada ingreso o gasto real en Movimientos.",
    "Revisa Quincenas para confirmar en que periodo quedo.",
    "Exporta JSON cuando termines cambios importantes.",
  ];

  return (
    <div className="grid gap-5">
      <section className="guide-hero" data-tour="guide-hero">
        <div className="relative z-[1] max-w-3xl">
          <p className="eyebrow text-white/70">Manual dinamico</p>
          <h3 className="mt-3 text-3xl font-black leading-none text-white sm:text-4xl md:text-5xl">
            Guia practica para mover tu plan sin perderte.
          </h3>
          <p className="mt-4 text-white/78">
            Cada pantalla tiene una guia rapida, que puedes modificar y un paso a paso. Usa esto como mapa cuando estes actualizando gastos o revisando la tarjeta.
          </p>
        </div>
        <div className="relative z-[1] rounded-lg border border-white/20 bg-white/10 p-4 text-white sm:p-5">
          <Compass className="mb-4" />
          <strong className="block text-2xl font-black">Ruta sugerida</strong>
          <p className="mt-2 text-sm text-white/70">Empieza por el estado general y baja al detalle solo si algo no cuadra.</p>
          <button className="button-ghost mt-5 w-full border-white/20 bg-white/10 text-white" type="button" onClick={() => onStartTour(0)}>
            <PlayCircle size={18} />
            Iniciar tour guiado
          </button>
        </div>
      </section>

      <section className="panel" data-tour="guide-tour-cards">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="eyebrow">Guiado por modulo</p>
            <h3 className="text-2xl font-black text-navy">Tours especificos</h3>
            <p className="mt-2 text-sm text-slate-500">
              Cada tour oscurece lo demas y resalta botones, graficas, tablas o formularios del modulo elegido.
            </p>
          </div>
          <button className="button-primary" type="button" onClick={() => onStartTour(0)}>
            <PlayCircle size={18} />
            Tour general
          </button>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {topics.map((topic) => {
            const count = tourSteps.filter((step) => step.moduleId === topic.id).length;
            const Icon = topic.icon;
            return (
              <button key={topic.id} className="tour-step-card" type="button" onClick={() => onStartTour(topic.id)}>
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-ocean text-sm font-black text-white">
                  <Icon size={17} />
                </span>
                <span>
                  <strong className="block text-navy">{topic.title}</strong>
                  <small className="mt-1 block text-slate-500">{count} pasos con foco visual</small>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)]">
        <article className="panel">
          <p className="eyebrow">Paso a paso</p>
          <h3 className="mb-5 text-2xl font-black text-navy">Flujo recomendado</h3>
          <div className="grid gap-3">
            {flow.map((step, index) => (
              <div key={step} className="flex gap-3 rounded-lg border border-blue-100 bg-white p-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-ocean text-sm font-black text-white">
                  {index + 1}
                </span>
                <p className="text-sm text-slate-600">{step}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <p className="eyebrow">Atajo mental</p>
          <h3 className="mb-5 text-2xl font-black text-navy">Que pantalla uso?</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <MiniGuide title="Recibi dinero" text="Abre Registrar y elige Nomina o Ingreso extra; la nomina aparta renta automaticamente." />
            <MiniGuide title="Hice una compra nueva" text="Ve a Movimientos y elige tarjeta, debito o MSI." />
            <MiniGuide title="Quiero respaldar" text="Ve a Reportes para JSON/CSV o a Ajustes para sync cifrado." />
            <MiniGuide title="No entiendo un numero" text="Abre Ayuda en esa pantalla y revisa que modifica cada campo." />
          </div>
        </article>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" data-tour="guide-module-cards">
        {topics.map((topic) => {
          const Icon = topic.icon;
          return (
            <article key={topic.id} className="guide-card">
              <div className="mb-4 grid h-12 w-12 place-items-center rounded-lg bg-ocean text-white">
                <Icon size={22} />
              </div>
              <h4 className="text-xl font-black text-navy">{topic.title}</h4>
              <p className="mt-2 min-h-16 text-sm text-slate-500">{topic.summary}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button className="button-ghost px-3 py-2" type="button" onClick={() => onOpenTopic(topic.id)}>
                  <CircleHelp size={16} />
                  Guia
                </button>
                <button className="button-secondary px-3 py-2" type="button" onClick={() => onStartTour(topic.id)}>
                  <PlayCircle size={16} />
                  Tour
                </button>
                <button className="button-primary px-3 py-2" type="button" onClick={() => onNavigate(topic.id)}>
                  Abrir
                  <ChevronRight size={16} />
                </button>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}

function MiniGuide({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50/70 p-4">
      <strong className="text-navy">{title}</strong>
      <p className="mt-2 text-sm text-slate-500">{text}</p>
    </div>
  );
}

function GuideModal({
  open,
  topic,
  onClose,
  onOpenManual,
}: {
  open: boolean;
  topic: GuideTopic;
  onClose: () => void;
  onOpenManual: () => void;
}) {
  const Icon = topic.icon;
  return (
    <Modal open={open} onClose={onClose}>
      <div className="max-h-[85dvh] overflow-y-auto p-4 sm:p-6">
        <div className="rounded-lg bg-navy p-4 text-white shadow-card sm:p-5">
          <div className="flex items-start gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-white/20">
              <Icon size={24} />
            </span>
            <div>
              <p className="text-xs font-black uppercase text-white/70">Guia rapida</p>
              <h3 className="mt-1 text-3xl font-black">{topic.title}</h3>
              <p className="mt-2 text-sm text-white/78">{topic.summary}</p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <section className="rounded-lg border border-blue-100 bg-white p-4 sm:p-5">
            <h4 className="flex items-center gap-2 font-black text-navy">
              <Lightbulb size={18} />
              Que puedes modificar
            </h4>
            <ul className="mt-4 grid gap-2 text-sm text-slate-600">
              {topic.editable.map((item) => (
                <li key={item} className="rounded-lg bg-blue-50 px-3 py-2">{item}</li>
              ))}
            </ul>
          </section>

          <section className="rounded-lg border border-blue-100 bg-white p-4 sm:p-5">
            <h4 className="flex items-center gap-2 font-black text-navy">
              <Compass size={18} />
              Paso a paso
            </h4>
            <ol className="mt-4 grid gap-2 text-sm text-slate-600">
              {topic.steps.map((step, index) => (
                <li key={step} className="flex gap-2 rounded-lg bg-white px-3 py-2">
                  <span className="font-black text-teal">{index + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <strong>Tip:</strong> {topic.tip}
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button className="button-ghost" type="button" onClick={onClose}>
            Cerrar
          </button>
          <button className="button-primary" type="button" onClick={onOpenManual}>
            <BookOpen size={18} />
            Ver manual completo
          </button>
        </div>
      </div>
    </Modal>
  );
}

function SpotlightOverlay({ rect }: { rect: SpotlightRect | null }) {
  if (!rect || typeof window === "undefined") return <div className="tour-dim inset-0" />;

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const top = Math.max(0, Math.min(rect.top, viewportHeight));
  const left = Math.max(0, Math.min(rect.left, viewportWidth));
  const width = Math.max(0, Math.min(rect.width, viewportWidth - left));
  const height = Math.max(0, Math.min(rect.height, viewportHeight - top));
  const bottomHeight = Math.max(0, viewportHeight - top - height);
  const rightWidth = Math.max(0, viewportWidth - left - width);
  const arrowOnLeft = left + width / 2 > viewportWidth / 2;
  const arrowStyle: CSSProperties = {
    top: "50%",
    transform: arrowOnLeft ? "translateY(-50%) rotate(180deg)" : "translateY(-50%)",
  };
  if (arrowOnLeft) arrowStyle.left = -64;
  else arrowStyle.right = -64;

  return (
    <>
      <div className="tour-dim" style={{ top: 0, left: 0, width: "100%", height: top }} />
      <div className="tour-dim" style={{ top, left: 0, width: left, height }} />
      <div className="tour-dim" style={{ top, right: 0, width: rightWidth, height }} />
      <div className="tour-dim" style={{ top: top + height, left: 0, width: "100%", height: bottomHeight }} />
      <div className="tour-spotlight-ring" style={{ top, left, width, height }}>
        <span className="tour-spotlight-dot" />
        <svg className="tour-arrow" style={arrowStyle} viewBox="0 0 72 72" aria-hidden="true">
          <path d="M8 36 C22 12 44 12 58 34" />
          <path d="M46 24 L60 36 L46 48" />
        </svg>
      </div>
    </>
  );
}

function GuidedTourPanel({
  open,
  step,
  stepIndex,
  spotlightRect,
  totalSteps,
  onClose,
  onPrevious,
  onNext,
  onJump,
}: {
  open: boolean;
  step: GuidedTourStep;
  stepIndex: number;
  spotlightRect: SpotlightRect | null;
  totalSteps: number;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onJump: (index: number) => void;
}) {
  if (!open) return null;
  const nav = navItems.find((item) => item.id === step.view) || navItems[0];
  const Icon = nav.icon;
  const isLast = stepIndex === totalSteps - 1;
  const viewportWidth = typeof window === "undefined" ? 1280 : window.innerWidth;
  const viewportHeight = typeof window === "undefined" ? 720 : window.innerHeight;
  const prefersTop = spotlightRect ? spotlightRect.top + spotlightRect.height / 2 > viewportHeight / 2 : false;
  const prefersLeft = spotlightRect ? spotlightRect.left + spotlightRect.width / 2 > viewportWidth / 2 : false;
  const panelStyle: CSSProperties = prefersTop ? { top: 16 } : { bottom: 16 };
  if (prefersLeft) panelStyle.left = 16;
  else panelStyle.right = 16;

  return (
    <div className="pointer-events-none fixed inset-0 z-[95]">
      <SpotlightOverlay rect={spotlightRect} />
      <aside className="tour-panel pointer-events-auto absolute w-[min(28rem,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)] overflow-y-auto overflow-x-hidden rounded-lg border border-slate-200 bg-white shadow-card" style={panelStyle}>
        <div className="bg-navy p-4 text-white sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-white/20">
                <Icon size={24} />
              </span>
              <div>
                <p className="text-xs font-black uppercase text-white/70">
                  Paso {stepIndex + 1} de {totalSteps} | {nav.label}
                </p>
                <h3 className="mt-1 text-xl font-black sm:text-2xl">{step.title}</h3>
                <span className="mt-2 inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-black text-white/85">
                  En foco: {step.targetLabel}
                </span>
              </div>
            </div>
            <button className="grid h-9 w-9 place-items-center rounded-full bg-white/15" type="button" onClick={onClose} aria-label="Cerrar tour guiado">
              <X size={18} />
            </button>
          </div>
          <p className="mt-4 text-sm text-white/78">{step.intro}</p>
        </div>

        <div className="grid gap-3 p-4 sm:gap-4 sm:p-5">
          <div className="rounded-lg border border-blue-100 bg-blue-50/70 p-3 sm:p-4">
            <p className="eyebrow">Mira esto</p>
            <p className="mt-2 text-sm text-slate-600">{step.focus}</p>
          </div>
          <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 sm:p-4">
            <p className="eyebrow text-emerald-700">Haz esto</p>
            <p className="mt-2 text-sm text-emerald-950">{step.action}</p>
          </div>
          <div className="rounded-lg border border-amber-100 bg-amber-50 p-3 sm:p-4">
            <p className="eyebrow text-amber-700">Resultado esperado</p>
            <p className="mt-2 text-sm text-amber-950">{step.outcome}</p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="tour-progress-dots flex max-w-full gap-1 overflow-x-auto pb-1">
              {Array.from({ length: totalSteps }, (_, index) => (
                <button
                  key={index}
                  className={`h-2.5 rounded-full transition-all ${index === stepIndex ? "w-8 bg-teal" : "w-2.5 bg-blue-200 hover:bg-ocean/50"}`}
                  type="button"
                  onClick={() => onJump(index)}
                  aria-label={`Ir al paso ${index + 1}`}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <button className="button-ghost px-3 py-2" type="button" onClick={onPrevious} disabled={stepIndex === 0}>
                Anterior
              </button>
              <button className="button-primary px-3 py-2" type="button" onClick={onNext}>
                {isLast ? "Terminar" : "Siguiente"}
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function QuickActionsModal({
  open,
  onClose,
  onView,
  onStartTour,
  onNewTransaction,
  onExport,
}: {
  open: boolean;
  onClose: () => void;
  onView: (view: ViewId) => void;
  onStartTour: () => void;
  onNewTransaction: () => void;
  onExport: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose}>
      <div className="p-6">
        <p className="eyebrow">Acciones rapidas</p>
        <h3 className="mt-2 text-2xl font-black text-navy">Que quieres hacer ahora?</h3>
        <p className="mt-2 text-sm text-slate-500">Atajos para moverte sin buscar entre secciones.</p>
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          <ActionTile title="Nuevo movimiento" text="Agregar nomina, ingreso, gasto o compra TDC." onClick={onNewTransaction} />
          <ActionTile title="Revisar quincenas" text="Ver ingresos, gastos y pagos agrupados por fecha." onClick={() => onView("periods")} />
          <ActionTile title="Sync y ajustes" text="Configurar respaldo cifrado y supuestos." onClick={() => onView("settings")} />
          <ActionTile title="Tour guiado" text="La app te lleva paso a paso por cada pantalla." onClick={onStartTour} />
          <ActionTile title="Manual de uso" text="Ver pasos guiados y que modifica cada pantalla." onClick={() => onView("guide")} />
          <ActionTile title="Exportar respaldo" text="Descargar JSON actual de la app." onClick={onExport} />
        </div>
      </div>
    </Modal>
  );
}

function ActionTile({ title, text, onClick }: { title: string; text: string; onClick: () => void }) {
  return (
    <button className="rounded-lg border border-blue-100 bg-white p-5 text-left transition hover:border-ocean/50 hover:bg-blue-50 hover:shadow-card" type="button" onClick={onClick}>
      <strong className="text-navy">{title}</strong>
      <span className="mt-2 block text-sm text-slate-500">{text}</span>
    </button>
  );
}
