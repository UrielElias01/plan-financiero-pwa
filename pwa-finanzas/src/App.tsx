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
  calculateCardDebtFor,
  calculateMonthlyFor,
  calculatePeriodsFor,
  formatMoney,
  normalizeState,
  signedTone,
} from "./lib/calculations";
import { exportMonthlyCsv, exportStateJson, readJsonFile } from "./lib/files";
import { cloneSeed, today } from "./lib/seed";
import { loadState, saveState } from "./lib/storage";
import { decryptStateFromSync, encryptStateForSync, fetchSync, normalizeEndpoint, syncSecret } from "./lib/sync";
import { registerServiceWorker } from "./lib/pwa";
import type { AppState, CalculatedPeriod, CardDebtSummary, MonthlyReport, Period, RecurringItem, Transaction, ViewId } from "./lib/types";

type Toast = { id: number; message: string; tone?: "ok" | "danger" };
type ConfirmConfig = {
  title: string;
  message: string;
  confirmText?: string;
  danger?: boolean;
  resolve: (value: boolean) => void;
};

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
    summary: "Aqui vive el calendario financiero real: cada sueldo alimenta la quincena que toca sobrevivir.",
    editable: ["Sueldo", "Ingreso extra o de pareja", "Renta/apartado", "Servicios", "Cargos a tarjeta", "Pago de tarjeta"],
    steps: [
      "Abre la quincena que quieres ajustar.",
      "Captura gastos en negativo si son salidas de efectivo, como renta o servicios.",
      "Captura pago de tarjeta en negativo para que afecte el ahorro proyectado.",
      "Guarda y vuelve a Inicio para ver el impacto completo.",
    ],
    tip: "Esta es la pantalla mas importante para conservar el modelo por quincenas, sin mezclar saldos intermedios.",
    icon: CalendarClock,
    accent: "from-blue-700 to-sky-500",
  },
  {
    id: "transactions",
    title: "Movimientos",
    summary: "Registra compras, gastos o ingresos nuevos y deja que la app los acomode en quincenas, ahorros y pagos de TDC.",
    editable: ["Nombre", "Monto", "Fecha", "Categoria", "Medio de pago", "Quincena", "Dividir con pareja", "MSI"],
    steps: [
      "Elige si fue tarjeta o efectivo/debito.",
      "Selecciona la quincena donde ocurrio el gasto.",
      "Si fue efectivo/debito en la quincena base, el ahorro actual baja de inmediato porque ese dinero salio del ahorro.",
      "Si fue compartido, marca dividir con pareja para agregar la mitad como ingreso.",
      "Si fue tarjeta a meses, elige 3 o 6 MSI para repartir pagos en las segundas quincenas.",
    ],
    tip: "Para comida compartida pagada con TDC, captura el total y marca dividir con pareja.",
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
      "Si ya no lo pagas, cambialo a cancelado o borralo.",
    ],
    tip: "Sirve como checklist para no olvidar cargos pequenos que se comen el margen.",
    icon: ListChecks,
    accent: "from-indigo-600 to-blue-500",
  },
  {
    id: "card",
    title: "Tarjeta",
    summary: "Muestra pago al corte, saldo utilizado, calendario de deuda, tu parte y saldos no recurrentes por mes.",
    editable: ["Se alimenta desde tus compras y quincenas", "Los MSI se reflejan en pagos futuros", "El saldo utilizado suma el siguiente corte mas lo que queda a meses", "El calendario base viene del respaldo importado"],
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
    editable: ["Ahorro actual", "Renta apartada", "Sueldo", "Renta mensual", "Comida/TDC por defecto", "ChatGPT", "Base de adeudo TDC", "Dias de corte y pago", "Sync cifrado"],
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
    focus: "Ayuda abre una guia contextual, Tour inicia una guia, Agregar gasto abre Movimientos, Acciones muestra atajos y Respaldo descarga tu JSON.",
    action: "Usa Respaldo antes de cambios grandes y Agregar gasto cuando quieras capturar algo nuevo rapido.",
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
    focus: "Cada sueldo se usa para vivir la quincena correspondiente; aqui no se mezclan saldos intermedios.",
    action: "Usalo para ajustar montos que pertenecen a una quincena especifica.",
    outcome: "El historial queda ordenado por periodos.",
  },
  {
    moduleId: "periods",
    view: "periods",
    target: "periods-add",
    targetLabel: "Agregar quincena",
    title: "Crear nuevos periodos",
    intro: "Este boton agrega una quincena editable al final del plan.",
    focus: "La nueva quincena toma valores base de tus ajustes para que no empieces desde cero.",
    action: "Usalo cuando quieras extender el plan a mas meses.",
    outcome: "Puedes seguir proyectando sin rehacer tablas.",
  },
  {
    moduleId: "periods",
    view: "periods",
    target: "periods-table",
    targetLabel: "Tabla quincenal",
    title: "Leer la tabla",
    intro: "Cada fila representa una quincena y cada columna te dice como afecta tu ahorro.",
    focus: "Sueldo e ingresos suman; gastos, renta y pago de tarjeta restan; flujo cambia el ahorro.",
    action: "Presiona Editar en una fila para corregir montos puntuales.",
    outcome: "El plan se recalcula sin borrar las demas quincenas.",
  },
  {
    moduleId: "transactions",
    view: "transactions",
    target: "transactions-form",
    targetLabel: "Formulario de movimiento",
    title: "Captura un movimiento",
    intro: "Aqui registras compras, gastos o ingresos nuevos.",
    focus: "Nombre, monto, fecha, categoria, medio de pago y quincena.",
    action: "Captura el monto real de la compra o gasto.",
    outcome: "La app ajusta la quincena y, si aplica, los pagos de tarjeta.",
  },
  {
    moduleId: "transactions",
    view: "transactions",
    target: "transactions-method",
    targetLabel: "Medio de pago",
    title: "Tarjeta vs debito",
    intro: "Esta seleccion cambia como se refleja el movimiento.",
    focus: "Tarjeta agenda el pago futuro; efectivo/debito pega directo al flujo de la quincena.",
    action: "Elige tarjeta si entrara al corte; elige debito si el dinero ya salio.",
    outcome: "El calculo cae en el periodo correcto.",
  },
  {
    moduleId: "transactions",
    view: "transactions",
    target: "transactions-shared",
    targetLabel: "Dividir con pareja",
    title: "Gastos compartidos",
    intro: "Esta casilla sirve para compras que pagas completas pero te reembolsan una parte.",
    focus: "La app suma la mitad como ingreso de pareja para reflejar tu carga real.",
    action: "Marcala cuando captures el total real pagado con tu tarjeta.",
    outcome: "La tarjeta refleja el total y tu plan refleja solo tu carga real.",
  },
  {
    moduleId: "transactions",
    view: "transactions",
    target: "transactions-installments",
    targetLabel: "Meses sin intereses",
    title: "Compras a MSI",
    intro: "Este selector reparte una compra de tarjeta en pagos futuros.",
    focus: "Una exhibicion cae en el siguiente pago; 3 o 6 MSI se distribuyen por meses.",
    action: "Elige el plazo real antes de guardar.",
    outcome: "El pago de tarjeta futuro queda mas realista.",
  },
  {
    moduleId: "transactions",
    view: "transactions",
    target: "transactions-list",
    targetLabel: "Registro de movimientos",
    title: "Historial editable",
    intro: "Aqui ves lo que ya capturaste.",
    focus: "Descripcion, fecha, categoria, quincena y calendario de pago TDC.",
    action: "Si algo esta mal, borralo y capturalo de nuevo con los datos correctos.",
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
    intro: "Esta grafica compara el total mensual contra tu parte.",
    focus: "Azul es total; verde es tu parte; los picos indican meses mas pesados.",
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
    focus: "Ahorro actual, renta apartada, sueldo, renta mensual, comida/TDC, ChatGPT y fechas de tarjeta.",
    action: "Cambia aqui solo lo que aplica de forma recurrente.",
    outcome: "Las quincenas nuevas nacen con valores correctos.",
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

const emptyRecurring: Omit<RecurringItem, "id"> & { id?: string } = {
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
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-ocean/15 to-teal/15 text-navy transition group-hover:scale-105">
          <Icon size={21} />
        </span>
      </div>
      <strong className="block text-3xl font-black tracking-tight text-navy">{value}</strong>
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
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog">
      <div className="animate-fade-up w-full max-w-3xl overflow-hidden rounded-[2rem] border border-white/60 bg-white/90 shadow-glow backdrop-blur-2xl">
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
    <div className="rounded-3xl border border-dashed border-blue-200 bg-white/50 p-8 text-center">
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

export function App() {
  const [state, setState] = useState<AppState>(cloneSeed());
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<ViewId>("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideTopicId, setGuideTopicId] = useState<ViewId | null>(null);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourStepIndex, setTourStepIndex] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState<SpotlightRect | null>(null);
  const [periodDraft, setPeriodDraft] = useState<Period | null>(null);
  const [recurringDraft, setRecurringDraft] = useState(emptyRecurring);
  const [syncDraft, setSyncDraft] = useState(cloneSeed().sync);
  const [passphrase, setPassphrase] = useState("");
  const [passphraseConfirm, setPassphraseConfirm] = useState("");
  const [confirmConfig, setConfirmConfig] = useState<ConfirmConfig | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const periods = useMemo(() => calculatePeriodsFor(state), [state]);
  const monthly = useMemo(() => calculateMonthlyFor(state, periods), [state, periods]);
  const cardDebt = useMemo(() => calculateCardDebtFor(state, periods), [state, periods]);
  const activeNav = navItems.find((item) => item.id === view) || navItems[0];
  const activeGuide = guideTopics.find((topic) => topic.id === (guideTopicId || view)) || guideTopics[0];
  const activeTourStep = guidedTourSteps[tourStepIndex] || guidedTourSteps[0];

  useEffect(() => {
    loadState()
      .then((loaded) => {
        setState(loaded);
        setSyncDraft(loaded.sync);
      })
      .finally(() => setReady(true));
    registerServiceWorker().catch(console.error);
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
    const normalized = normalizeState({ ...nextState, updatedAt: new Date().toISOString() });
    await saveState(normalized);
    setState(normalized);
    setSyncDraft(normalized.sync);
    showToast(message);
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

  function openPeriod(period: Period) {
    setPeriodDraft({ ...period });
  }

  async function savePeriod() {
    if (!periodDraft) return;
    await commit(
      {
        ...state,
        periods: state.periods.map((period) => (period.id === periodDraft.id ? { ...periodDraft } : period)),
      },
      "Quincena guardada",
    );
    setPeriodDraft(null);
  }

  async function addPeriod() {
    const last = state.periods.at(-1);
    const period: Period = {
      id: crypto.randomUUID(),
      month: last?.month || "Nuevo",
      label: "Nueva quincena",
      note: "Edita esta quincena",
      salary: state.settings.salary,
      extraIncome: 0,
      partnerIncome: state.settings.defaultFood / 2,
      rent: -(state.settings.monthlyRent / 2),
      debitServices: 0,
      foodCredit: state.settings.defaultFood,
      chatGptCredit: 0,
      cardPayment: 0,
    };
    await commit({ ...state, periods: [...state.periods, period] }, "Quincena agregada");
    setPeriodDraft(period);
  }

  async function submitTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const transactionBase: Transaction = {
      id: crypto.randomUUID(),
      date: getField(form, "date") || today,
      description: getField(form, "description"),
      amount: asNumber(getField(form, "amount")),
      category: getField(form, "category"),
      method: getField(form, "method") === "credit" ? "credit" : "cash",
      periodId: getField(form, "periodId"),
      shared: Boolean(new FormData(form).get("shared")),
      installments: asNumber(getField(form, "installments"), 1),
    };
    const transaction = {
      ...transactionBase,
      paymentSchedule: buildPaymentScheduleFor(state, transactionBase),
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
      "Movimiento agregado",
    );
    form.reset();
    (form.elements.namedItem("date") as HTMLInputElement).value = today;
  }

  async function deleteTransaction(transaction: Transaction) {
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
  }

  async function submitRecurring(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const item: RecurringItem = {
      id: recurringDraft.id || crypto.randomUUID(),
      name: recurringDraft.name,
      amount: asNumber(recurringDraft.amount),
      day: asNumber(recurringDraft.day, 1),
      method: recurringDraft.method,
      active: recurringDraft.active,
    };
    const index = state.recurring.findIndex((entry) => entry.id === item.id);
    const recurring = index >= 0 ? state.recurring.map((entry) => (entry.id === item.id ? item : entry)) : [...state.recurring, item];
    await commit({ ...state, recurring }, "Recurrente guardado");
    setRecurringDraft({ ...emptyRecurring });
  }

  async function deleteRecurring(item: RecurringItem) {
    const confirmed = await confirmAction({
      title: "Borrar recurrente",
      message: "El gasto recurrente saldra del registro editable.",
      confirmText: "Borrar",
      danger: true,
    });
    if (!confirmed) return;
    await commit({ ...state, recurring: state.recurring.filter((entry) => entry.id !== item.id) }, "Recurrente borrado");
  }

  async function submitSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const settings: Record<string, number> = { ...state.settings };
    for (const key of Object.keys(settings)) {
      const raw = getField(form, key);
      if (raw !== "") settings[key] = asNumber(raw, settings[key]);
    }
    await commit({ ...state, settings: settings as AppState["settings"] }, "Ajustes guardados");
  }

  async function resetTemplate() {
    const confirmed = await confirmAction({
      title: "Restaurar plantilla",
      message: "Esto reemplaza los datos actuales por una plantilla vacia. Haz respaldo antes si quieres conservarlos.",
      confirmText: "Restaurar",
      danger: true,
    });
    if (!confirmed) return;
    await commit(cloneSeed(), "Plantilla restaurada");
  }

  async function importJson(file?: File | null) {
    if (!file) return;
    const imported = await readJsonFile(file);
    const next = normalizeState(imported as Partial<AppState>);
    await commit(next, "Respaldo importado");
    if (fileInputRef.current) fileInputRef.current.value = "";
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
    state.settings.salary !== 0 ||
    state.transactions.length > 0 ||
    state.recurring.length > 0;

  const lowSavings = periods.find((period) => period.savings < 10000);
  const negativeFlows = periods.filter((period) => period.flow < 0);
  const chartData = monthly.map((row) => ({
    month: row.month,
    ingresos: row.income,
    flujo: row.flow,
    ahorro: row.savings,
    tarjeta: Math.abs(row.cardPayment),
  }));

  if (!ready) {
    return (
      <div className="grid min-h-dvh place-items-center p-6">
        <div className="panel max-w-sm text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-3xl bg-gradient-to-br from-ocean to-teal text-white">
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
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <div className="ambient ambient-three" />
      {mobileMenu ? <div className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm lg:hidden" onClick={() => setMobileMenu(false)} /> : null}

      <div
        className={`grid min-h-dvh transition-[grid-template-columns] duration-200 lg:grid-cols-[18rem_minmax(0,1fr)] ${
          sidebarCollapsed ? "lg:grid-cols-[6rem_minmax(0,1fr)]" : ""
        }`}
      >
        <aside
          className={`mobile-menu-shell fixed inset-y-0 left-0 z-50 flex h-dvh w-[min(21rem,calc(100vw-3rem))] flex-col gap-6 overflow-y-auto bg-gradient-to-b from-navy to-slate-900 p-5 text-white shadow-2xl transition-transform duration-200 lg:sticky lg:top-0 lg:w-auto lg:translate-x-0 lg:overflow-hidden ${
            mobileMenu ? "translate-x-0" : "-translate-x-[105%]"
          } ${sidebarCollapsed ? "lg:items-center lg:p-4" : ""}`}
        >
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 shrink-0 -rotate-3 place-items-center rounded-2xl bg-white font-black tracking-tighter text-navy shadow-xl">
              PF
            </div>
            {!sidebarCollapsed ? (
              <div className="min-w-0">
                <h1 className="truncate text-base font-black">Plan Financiero</h1>
                <p className="truncate text-xs text-white/70">Quincenas, TDC y ahorros</p>
              </div>
            ) : null}
            <button
              className="ml-auto hidden h-10 w-10 place-items-center rounded-2xl border border-white/15 bg-white/10 text-white lg:grid"
              type="button"
              onClick={toggleSidebar}
              aria-label={sidebarCollapsed ? "Mostrar menu" : "Ocultar menu"}
            >
              {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </button>
            <button
              className="ml-auto grid h-10 w-10 place-items-center rounded-2xl border border-white/15 bg-white/10 text-white lg:hidden"
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
                  className={`flex items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-black transition hover:translate-x-1 hover:bg-white/10 ${
                    active ? "bg-white/15 text-white" : "text-white/78"
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
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/10">
                    <Icon size={18} />
                  </span>
                  {!sidebarCollapsed ? <span>{item.label}</span> : null}
                </button>
              );
            })}
          </nav>

          <div className={`mt-auto rounded-3xl border border-white/15 bg-white/10 p-4 backdrop-blur-xl ${sidebarCollapsed ? "lg:p-3" : ""}`}>
            {sidebarCollapsed ? (
              <ShieldCheck className="mx-auto" />
            ) : (
              <>
                <p className="eyebrow text-white/70">PWA</p>
                <p className="mt-2 text-sm text-white/78">Instalable, offline y con sync cifrado.</p>
                <button
                  className="button-ghost mt-4 w-full border-white/20 bg-white/10 text-white"
                  type="button"
                  onClick={() => {
                    setView("guide");
                    setMobileMenu(false);
                  }}
                >
                  <BookOpen size={16} />
                  Manual de uso
                </button>
                <button className="button-ghost mt-2 w-full border-white/20 bg-white/10 text-white" type="button" onClick={() => startGuidedTour()}>
                  <PlayCircle size={16} />
                  Tour guiado
                </button>
                {installPrompt ? (
                  <button className="button-ghost mt-4 w-full border-white/20 bg-white/10 text-white" type="button" onClick={handleInstall}>
                    Instalar app
                  </button>
                ) : null}
              </>
            )}
          </div>
        </aside>

        <main className="min-w-0 p-3 sm:p-4 lg:p-6">
          <header className="app-header md:sticky md:top-0 z-30 mb-4 flex flex-col gap-4 overflow-hidden rounded-[1.4rem] border border-white/60 bg-white/70 p-3 shadow-card backdrop-blur-2xl sm:p-4 md:mb-5 md:flex-row md:items-center md:justify-between md:rounded-[1.6rem]">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-ocean via-teal to-mint" />
            <div className="relative">
              <p className="eyebrow">Actualizable por ti</p>
              <h2 className="text-2xl font-black tracking-tight text-navy sm:text-3xl md:text-4xl">{activeNav.label}</h2>
              <p className="mt-1 max-w-2xl text-sm text-slate-500">{activeGuide.summary}</p>
            </div>
            <div className="app-header-actions relative grid grid-cols-2 gap-2 md:flex md:flex-wrap md:justify-end" data-tour="header-actions">
              <button className="button-ghost lg:hidden" type="button" onClick={() => setMobileMenu(true)}>
                <Menu size={18} />
                Menu
              </button>
              <button
                className="button-ghost"
                type="button"
                onClick={() => {
                  setGuideTopicId(view);
                  setGuideOpen(true);
                }}
              >
                <CircleHelp size={18} />
                Ayuda
              </button>
              <button className="button-secondary" type="button" onClick={() => startGuidedTour(view)}>
                <PlayCircle size={18} />
                Tour
              </button>
              <button className="button-primary" type="button" onClick={() => setView("transactions")}>
                <Plus size={18} />
                Agregar gasto
              </button>
              <button className="button-ghost" type="button" onClick={() => setQuickActionsOpen(true)}>
                <Sparkles size={18} />
                Acciones
              </button>
              <button className="button-secondary" type="button" onClick={() => exportStateJson(state, today)}>
                <Download size={18} />
                Respaldo
              </button>
            </div>
          </header>

          <section className="animate-fade-up">
            {view === "dashboard" ? (
              <Dashboard
                periods={periods}
                monthly={monthly}
                state={state}
                cardDebt={cardDebt}
                hasRealData={hasRealData}
                lowSavings={lowSavings}
                negativeFlows={negativeFlows.length}
                chartData={chartData}
                onImport={importJson}
                onEditPeriods={() => setView("periods")}
                fileInputRef={fileInputRef}
              />
            ) : null}
            {view === "periods" ? <PeriodsView periods={periods} onEdit={openPeriod} onAdd={addPeriod} /> : null}
            {view === "transactions" ? (
              <TransactionsView
                state={state}
                onSubmit={submitTransaction}
                onDelete={deleteTransaction}
              />
            ) : null}
            {view === "recurring" ? (
              <RecurringView
                recurring={state.recurring}
                draft={recurringDraft}
                setDraft={setRecurringDraft}
                onSubmit={submitRecurring}
                onEdit={(item) => setRecurringDraft({ ...item })}
                onDelete={deleteRecurring}
              />
            ) : null}
            {view === "card" ? <CardView state={state} cardDebt={cardDebt} /> : null}
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
                onSubmitSettings={submitSettings}
                onReset={resetTemplate}
                onSaveSync={saveSyncSettings}
                onTestSync={testSync}
                onPushSync={pushSync}
                onPullSync={pullSync}
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

      <QuickActionsModal
        open={quickActionsOpen}
        onClose={() => setQuickActionsOpen(false)}
        onView={(next) => {
          setQuickActionsOpen(false);
          setView(next);
        }}
        onStartTour={() => startGuidedTour()}
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

      <PeriodModal
        period={periodDraft}
        onClose={() => setPeriodDraft(null)}
        onChange={setPeriodDraft}
        onSave={savePeriod}
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
  monthly,
  state,
  cardDebt,
  hasRealData,
  lowSavings,
  negativeFlows,
  chartData,
  onImport,
  onEditPeriods,
  fileInputRef,
}: {
  periods: CalculatedPeriod[];
  monthly: MonthlyReport[];
  state: AppState;
  cardDebt: CardDebtSummary;
  hasRealData: boolean;
  lowSavings?: CalculatedPeriod;
  negativeFlows: number;
  chartData: Array<Record<string, number | string>>;
  onImport: (file?: File | null) => void;
  onEditPeriods: () => void;
  fileInputRef: RefObject<HTMLInputElement>;
}) {
  return (
    <div className="grid gap-5">
      <section className="relative overflow-hidden rounded-[1.6rem] bg-gradient-to-br from-navy via-ocean to-teal p-4 text-white shadow-glow sm:p-6 md:rounded-[2rem] md:p-8" data-tour="dashboard-hero">
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full border border-white/20 bg-white/10 blur-sm" />
        <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-center">
          <div>
            <p className="eyebrow text-white/70">Centro financiero</p>
            <h3 className="mt-3 max-w-4xl text-3xl font-black leading-[0.98] tracking-[-0.06em] sm:text-4xl md:text-6xl">
              Tu plan quincenal, tarjeta y ahorros en un tablero vivo.
            </h3>
            <p className="mt-4 max-w-2xl text-white/76">
              Edita supuestos, agrega movimientos, revisa reportes y sincroniza un respaldo cifrado sin volver al Excel.
            </p>
          </div>
          <div className="rounded-[1.35rem] border border-white/20 bg-white/12 p-4 backdrop-blur-2xl sm:rounded-[1.5rem] sm:p-5">
            <p className="text-sm text-white/70">Sync cifrado</p>
            <strong className="mt-2 block text-2xl font-black">Cloudflare KV</strong>
            <p className="mt-2 text-sm text-white/70">Backend y base de datos listos para subir o bajar respaldos.</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5" data-tour="dashboard-metrics">
        <MetricCard label="Ahorro actual" value={formatMoney(state.settings.currentSavings)} note={`Renta apartada: ${formatMoney(state.settings.rentReserve)}`} icon={WalletCards} />
        <MetricCard label="Tras 1a julio" value={formatMoney(periods.find((period) => period.id === "2026-07-h1")?.savings || 0)} note="Sueldo del 30 jun aplicado" icon={CalendarClock} />
        <MetricCard label="Pago TDC julio" value={formatMoney(Math.abs(periods.find((period) => period.id === "2026-07-h2")?.cardPayment || 0))} note="Estimado al 25 jul" icon={CreditCard} />
        <MetricCard label="Saldo utilizado TDC" value={formatMoney(cardDebt.totalDebt)} note="Corte + MSI" icon={CreditCard} />
        <MetricCard label="Cierre proyectado" value={formatMoney(periods.at(-1)?.savings || 0)} note="Noviembre 2026" icon={ChartSpline} />
      </section>

      {!hasRealData ? (
        <section className="panel flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="eyebrow">Primer arranque</p>
            <h3 className="text-xl font-black text-navy">La app publica no trae tus montos personales</h3>
            <p className="mt-2 text-sm text-slate-500">
              Importa el respaldo privado generado desde el Excel para cargar tu plan real en este dispositivo.
            </p>
          </div>
          <label className="button-primary">
            <Upload size={18} />
            Importar respaldo privado
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
                <defs>
                  <linearGradient id="ahorro" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#2e75b6" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#2e75b6" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#dbeafe" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <YAxis tickFormatter={(value) => `$${Math.round(Number(value) / 1000)}k`} tickLine={false} axisLine={false} />
                <Tooltip formatter={(value) => formatMoney(value)} />
                <Area type="monotone" dataKey="ahorro" stroke="#2e75b6" fill="url(#ahorro)" strokeWidth={3} />
                <Area type="monotone" dataKey="flujo" stroke="#0f7f83" fill="#0f7f8320" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel" data-tour="dashboard-alerts">
          <p className="eyebrow">Alertas</p>
          <h3 className="mb-4 text-xl font-black text-navy">Atencion</h3>
          <div className="grid gap-3">
            {lowSavings ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm">
                {lowSavings.label} baja a <strong>{formatMoney(lowSavings.savings)}</strong>. Conviene revisar gastos variables.
              </div>
            ) : null}
            {negativeFlows ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm">
                {negativeFlows} quincenas tienen flujo negativo por pagos de tarjeta.
              </div>
            ) : null}
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
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

function PeriodsTable({ periods, compact, onEdit, tourTarget }: { periods: CalculatedPeriod[]; compact?: boolean; onEdit?: (period: Period) => void; tourTarget?: string }) {
  return (
    <div className={`table-scroll ${compact ? "table-scroll-compact" : ""} overflow-x-auto rounded-3xl border border-blue-100 bg-white/80`} data-tour={tourTarget}>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="table-head text-left">Quincena</th>
            <th className="table-head text-left">Rango</th>
            {!compact ? <th className="table-head">Sueldo</th> : null}
            {!compact ? <th className="table-head">Ingreso pareja</th> : null}
            <th className="table-head">Gastos</th>
            <th className="table-head">Pago TDC</th>
            <th className="table-head">Flujo</th>
            <th className="table-head">Ahorro</th>
            {onEdit ? <th className="table-head" /> : null}
          </tr>
        </thead>
        <tbody>
          {periods.map((period) => (
            <tr key={period.id} className="transition hover:bg-blue-50/70">
              <td className="table-cell text-left font-black text-navy">{period.label}</td>
              <td className="table-cell max-w-xs whitespace-normal text-left text-slate-500">{period.note}</td>
              {!compact ? <td className="table-cell">{formatMoney(period.salary)}</td> : null}
              {!compact ? <td className="table-cell">{formatMoney(period.partnerIncome)}</td> : null}
              <td className={`table-cell ${toneClass(period.cashExpenses)}`}>{formatMoney(period.cashExpenses)}</td>
              <td className={`table-cell ${toneClass(period.cardPayment)}`}>{formatMoney(period.cardPayment)}</td>
              <td className={`table-cell ${toneClass(period.flow)}`}>{formatMoney(period.flow)}</td>
              <td className="table-cell font-black text-navy">{formatMoney(period.savings)}</td>
              {onEdit ? (
                <td className="table-cell">
                  <button className="button-ghost px-3 py-2" type="button" onClick={() => onEdit(period)}>
                    Editar
                  </button>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PeriodsView({ periods, onEdit, onAdd }: { periods: CalculatedPeriod[]; onEdit: (period: Period) => void; onAdd: () => void }) {
  return (
    <section className="panel" data-tour="periods-panel">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="eyebrow">Editable</p>
          <h3 className="text-2xl font-black text-navy">Plan quincenal</h3>
        </div>
        <button className="button-secondary" type="button" onClick={onAdd} data-tour="periods-add">
          <Plus size={18} />
          Agregar quincena
        </button>
      </div>
      <PeriodsTable periods={periods} onEdit={onEdit} tourTarget="periods-table" />
    </section>
  );
}

function TransactionsView({
  state,
  onSubmit,
  onDelete,
}: {
  state: AppState;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onDelete: (transaction: Transaction) => void;
}) {
  const transactions = [...state.transactions].reverse();
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(320px,.75fr)_minmax(0,1.25fr)]">
      <form className="panel self-start" onSubmit={onSubmit} data-tour="transactions-form">
        <p className="eyebrow">Nuevo</p>
        <h3 className="mb-5 text-2xl font-black text-navy">Movimiento</h3>
        <Field label="Nombre">
          <input className="input" name="description" required placeholder="Ej. Farmacia, mandado, gasolina" />
        </Field>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Monto">
            <input className="input" name="amount" type="number" step="0.01" min="0" required />
          </Field>
          <Field label="Fecha">
            <input className="input" name="date" type="date" required defaultValue={today} />
          </Field>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Categoria">
            <select className="input" name="category" defaultValue="Comida">
              <option>Comida</option>
              <option>Tarjeta</option>
              <option>Servicio</option>
              <option>Renta</option>
              <option>Ingreso</option>
              <option>Otro</option>
            </select>
          </Field>
          <div data-tour="transactions-method">
            <Field label="Medio">
              <select className="input" name="method" defaultValue="credit">
                <option value="credit">Tarjeta de credito</option>
                <option value="cash">Efectivo / debito</option>
              </select>
            </Field>
          </div>
        </div>
        <Field label="Quincena">
          <select className="input" name="periodId" defaultValue={state.periods[0]?.id}>
            {state.periods.map((period) => (
              <option key={period.id} value={period.id}>
                {period.label}
              </option>
            ))}
          </select>
        </Field>
        <label className="mb-4 flex items-center gap-3 text-sm font-black text-navy" data-tour="transactions-shared">
          <input className="h-4 w-4" name="shared" type="checkbox" />
          Dividir con mi pareja
        </label>
        <div data-tour="transactions-installments">
          <Field label="Meses sin intereses">
            <select className="input" name="installments" defaultValue="1">
              <option value="1">Una exhibicion</option>
              <option value="3">3 MSI</option>
              <option value="6">6 MSI</option>
            </select>
          </Field>
        </div>
        <button className="button-primary mt-2 w-full" type="submit">
          <Plus size={18} />
          Guardar movimiento
        </button>
      </form>

      <section className="panel" data-tour="transactions-list">
        <p className="eyebrow">Registro</p>
        <h3 className="mb-5 text-2xl font-black text-navy">Movimientos recientes</h3>
        {transactions.length ? (
          <div className="grid gap-3">
            {transactions.map((transaction) => {
              const schedule = transaction.paymentSchedule?.length
                ? transaction.paymentSchedule
                    .map((payment) => `${getPeriodLabel(state.periods, payment.periodId)}: ${formatMoney(payment.amount)}`)
                    .join(" | ")
                : "";
              return (
                <article key={transaction.id} className="flex flex-col gap-3 rounded-3xl border border-blue-100 bg-white/75 p-4 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <strong className="text-navy">{transaction.description}</strong>
                    <p className="text-sm text-slate-500">
                      {transaction.date} | {transaction.category} | {getPeriodLabel(state.periods, transaction.periodId)}
                    </p>
                    <p className="text-sm text-slate-500">
                      {transaction.method === "credit" ? "Tarjeta de credito" : "Efectivo / debito"}
                      {transaction.shared ? " | dividido con pareja" : ""}
                    </p>
                    {schedule ? <p className="text-xs text-slate-500">Pago TDC: {schedule}</p> : null}
                  </div>
                  <div className="flex items-center justify-between gap-2 md:justify-end">
                    <span className="pill">{formatMoney(transaction.amount)}</span>
                    <button className="button-ghost px-3 py-2 text-red-700" type="button" onClick={() => onDelete(transaction)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState title="Sin movimientos todavia" text="Agrega compras, gastos o ingresos para que el plan se recalcule." />
        )}
      </section>
    </div>
  );
}

function RecurringView({
  recurring,
  draft,
  setDraft,
  onSubmit,
  onEdit,
  onDelete,
}: {
  recurring: RecurringItem[];
  draft: Omit<RecurringItem, "id"> & { id?: string };
  setDraft: (draft: Omit<RecurringItem, "id"> & { id?: string }) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onEdit: (item: RecurringItem) => void;
  onDelete: (item: RecurringItem) => void;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(320px,.75fr)_minmax(0,1.25fr)]">
      <form className="panel self-start" onSubmit={onSubmit} data-tour="recurring-form">
        <p className="eyebrow">Editar</p>
        <h3 className="mb-5 text-2xl font-black text-navy">Gasto recurrente</h3>
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
        <div className="mt-2 flex gap-2">
          <button className="button-primary flex-1" type="submit">
            <Check size={18} />
            Guardar
          </button>
          <button className="button-ghost" type="button" onClick={() => setDraft(emptyRecurring)}>
            Limpiar
          </button>
        </div>
      </form>

      <section className="panel" data-tour="recurring-list">
        <p className="eyebrow">Servicios</p>
        <h3 className="mb-5 text-2xl font-black text-navy">Recurrentes</h3>
        {recurring.length ? (
          <div className="grid gap-3">
            {recurring.map((item) => (
              <article key={item.id} className="flex flex-col gap-3 rounded-3xl border border-blue-100 bg-white/75 p-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <strong className="text-navy">{item.name}</strong>
                  <p className="text-sm text-slate-500">
                    Dia {item.day} | {item.method === "credit" ? "Tarjeta" : "Debito"} | {item.active ? "Activo" : "Cancelado"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 md:justify-end">
                  <span className="pill">{formatMoney(item.amount)}</span>
                  <button className="button-ghost px-3 py-2" type="button" onClick={() => onEdit(item)}>
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
  );
}

function CardView({ state, cardDebt }: { state: AppState; cardDebt: CardDebtSummary }) {
  const data = state.cardCalendar.map((entry) => ({ month: entry.month, total: entry.total, tuParte: entry.userPart, deuda: entry.debt }));
  return (
    <div className="grid gap-5">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Pago al corte" value={formatMoney(cardDebt.nextPayment)} note="Proximo pago programado" icon={CalendarClock} />
        <MetricCard label="Saldo utilizado TDC" value={formatMoney(cardDebt.totalDebt)} note="Corte + MSI" icon={CreditCard} />
        <MetricCard label="A meses / futuro" value={formatMoney(cardDebt.installmentBalance)} note="Despues del siguiente corte" icon={ChartSpline} />
        <MetricCard label="Compras TDC" value={formatMoney(cardDebt.creditPurchases)} note="Movimientos registrados" icon={WalletCards} />
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,.8fr)]">
        <section className="panel" data-tour="card-chart">
          <p className="eyebrow">Tarjeta</p>
          <h3 className="mb-5 text-2xl font-black text-navy">Calendario TDC</h3>
          <div className="h-64 sm:h-80">
            <ResponsiveContainer>
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#dbeafe" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <YAxis tickFormatter={(value) => `$${Math.round(Number(value) / 1000)}k`} tickLine={false} axisLine={false} />
                <Tooltip formatter={(value) => formatMoney(value)} />
                <Legend />
                <Bar dataKey="total" name="Total" fill="#2e75b6" radius={[12, 12, 0, 0]} />
                <Bar dataKey="tuParte" name="Parte tuya" fill="#0f7f83" radius={[12, 12, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-5 grid gap-3" data-tour="card-list">
            {state.cardCalendar.map((entry) => (
              <article key={entry.month} className="flex items-center justify-between gap-3 rounded-3xl border border-blue-100 bg-white/75 p-4">
                <div className="min-w-0">
                  <strong className="text-navy">{entry.month}</strong>
                  <p className="text-sm text-slate-500">Parte tuya: {formatMoney(entry.userPart)}</p>
                </div>
                <span className="pill shrink-0">{formatMoney(entry.total)}</span>
              </article>
            ))}
          </div>
        </section>
        <section className="panel" data-tour="card-debt">
          <p className="eyebrow">No recurrente</p>
          <h3 className="mb-5 text-2xl font-black text-navy">Deuda estimada</h3>
          <div className="grid gap-3">
            {state.cardCalendar.map((entry) => (
              <article key={entry.month} className="rounded-3xl border border-blue-100 bg-white/75 p-4">
                <strong className="text-navy">{entry.month}</strong>
                <p className="mt-2 text-sm">
                  Saldo no recurrente: <span className={entry.debt <= 0 ? "money-positive" : "money-negative"}>{formatMoney(entry.debt)}</span>
                </p>
              </article>
            ))}
          </div>
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
            <CartesianGrid strokeDasharray="3 3" stroke="#dbeafe" />
            <XAxis dataKey="month" tickLine={false} axisLine={false} />
            <YAxis tickFormatter={(value) => `$${Math.round(Number(value) / 1000)}k`} tickLine={false} axisLine={false} />
            <Tooltip formatter={(value) => formatMoney(value)} />
            <Legend />
            <Bar dataKey="ingresos" fill="#2e75b6" radius={[12, 12, 0, 0]} />
            <Bar dataKey="tarjeta" fill="#0f7f83" radius={[12, 12, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="table-scroll overflow-x-auto rounded-3xl border border-blue-100 bg-white/80" data-tour="reports-table">
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
  onSubmitSettings,
  onReset,
  onSaveSync,
  onTestSync,
  onPushSync,
  onPullSync,
}: {
  state: AppState;
  syncDraft: AppState["sync"];
  setSyncDraft: (sync: AppState["sync"]) => void;
  passphrase: string;
  setPassphrase: (value: string) => void;
  passphraseConfirm: string;
  setPassphraseConfirm: (value: string) => void;
  onSubmitSettings: (event: FormEvent<HTMLFormElement>) => void;
  onReset: () => void;
  onSaveSync: () => void;
  onTestSync: () => void;
  onPushSync: () => void;
  onPullSync: () => void;
}) {
  const settings = state.settings;
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
            Restaurar plantilla
          </button>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Ahorro actual"><input className="input" name="currentSavings" type="number" step="0.01" defaultValue={settings.currentSavings} /></Field>
          <Field label="Renta apartada fuera del ahorro"><input className="input" name="rentReserve" type="number" step="0.01" defaultValue={settings.rentReserve} /></Field>
          <Field label="Sueldo quincenal"><input className="input" name="salary" type="number" step="0.01" defaultValue={settings.salary} /></Field>
          <Field label="Renta mensual"><input className="input" name="monthlyRent" type="number" step="0.01" defaultValue={settings.monthlyRent} /></Field>
          <Field label="Cargos TDC por defecto"><input className="input" name="defaultFood" type="number" step="0.01" defaultValue={settings.defaultFood} /></Field>
          <Field label="ChatGPT mensual TDC"><input className="input" name="chatGpt" type="number" step="0.01" defaultValue={settings.chatGpt} /></Field>
          <Field label="Dia de corte TDC"><input className="input" name="cutoffDay" type="number" min="1" max="31" defaultValue={settings.cutoffDay} /></Field>
          <Field label="Dia limite pago TDC"><input className="input" name="dueDay" type="number" min="1" max="31" defaultValue={settings.dueDay} /></Field>
        </div>
        <div className="mt-6 rounded-[1.4rem] border border-blue-100 bg-blue-50/50 p-4">
          <p className="eyebrow">Base de tarjeta</p>
          <p className="mt-2 text-sm text-slate-500">
            Estos campos alimentan el saldo utilizado cuando vienes de un saldo previo o hiciste pagos fuera de Movimientos.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <Field label="Adeudo previo TDC"><input className="input" name="previousCardDebt" type="number" step="0.01" defaultValue={settings.previousCardDebt} /></Field>
            <Field label="Pago TDC aplicado"><input className="input" name="previousCardPayment" type="number" step="0.01" defaultValue={settings.previousCardPayment} /></Field>
            <Field label="Pago con puntos"><input className="input" name="pointsPayment" type="number" step="0.01" defaultValue={settings.pointsPayment} /></Field>
            <Field label="Compras TDC extra"><input className="input" name="newJulyPurchases" type="number" step="0.01" defaultValue={settings.newJulyPurchases} /></Field>
            <Field label="Saldo no recurrente"><input className="input" name="nonRecurringBalance" type="number" step="0.01" defaultValue={settings.nonRecurringBalance} /></Field>
          </div>
        </div>
        <button className="button-primary mt-5" type="submit" data-tour="settings-save">
          <Check size={18} />
          Guardar ajustes
        </button>
      </form>

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
    "Ajusta Quincenas si cambio renta, sueldo, comida o pago TDC.",
    "Captura Movimientos nuevos para recalcular sin romper el plan.",
    "Exporta JSON cuando termines cambios importantes.",
  ];

  return (
    <div className="grid gap-5">
      <section className="guide-hero" data-tour="guide-hero">
        <div className="relative z-[1] max-w-3xl">
          <p className="eyebrow text-white/70">Manual dinamico</p>
          <h3 className="mt-3 text-3xl font-black leading-none tracking-[-0.05em] text-white sm:text-4xl md:text-6xl">
            Guia practica para mover tu plan sin perderte.
          </h3>
          <p className="mt-4 text-white/78">
            Cada pantalla tiene una guia rapida, que puedes modificar y un paso a paso. Usa esto como mapa cuando estes actualizando gastos o revisando la tarjeta.
          </p>
        </div>
        <div className="relative z-[1] rounded-[1.35rem] border border-white/20 bg-white/12 p-4 text-white backdrop-blur-2xl sm:rounded-[1.5rem] sm:p-5">
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
                <span className="grid h-9 w-9 place-items-center rounded-2xl bg-gradient-to-br from-ocean to-teal text-sm font-black text-white">
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
              <div key={step} className="flex gap-3 rounded-3xl border border-blue-100 bg-white/75 p-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-ocean to-teal text-sm font-black text-white">
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
            <MiniGuide title="Quiero cambiar mi sueldo/renta" text="Ve a Quincenas o Ajustes, segun si es algo puntual o permanente." />
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
              <div className={`mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br ${topic.accent} text-white shadow-lg`}>
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
    <div className="rounded-3xl border border-blue-100 bg-gradient-to-br from-white to-blue-50/70 p-4">
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
        <div className={`rounded-[1.35rem] bg-gradient-to-br ${topic.accent} p-4 text-white shadow-glow sm:rounded-[1.5rem] sm:p-5`}>
          <div className="flex items-start gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/20">
              <Icon size={24} />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-white/70">Guia rapida</p>
              <h3 className="mt-1 text-3xl font-black">{topic.title}</h3>
              <p className="mt-2 text-sm text-white/78">{topic.summary}</p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <section className="rounded-3xl border border-blue-100 bg-white/75 p-4 sm:p-5">
            <h4 className="flex items-center gap-2 font-black text-navy">
              <Lightbulb size={18} />
              Que puedes modificar
            </h4>
            <ul className="mt-4 grid gap-2 text-sm text-slate-600">
              {topic.editable.map((item) => (
                <li key={item} className="rounded-2xl bg-blue-50 px-3 py-2">{item}</li>
              ))}
            </ul>
          </section>

          <section className="rounded-3xl border border-blue-100 bg-white/75 p-4 sm:p-5">
            <h4 className="flex items-center gap-2 font-black text-navy">
              <Compass size={18} />
              Paso a paso
            </h4>
            <ol className="mt-4 grid gap-2 text-sm text-slate-600">
              {topic.steps.map((step, index) => (
                <li key={step} className="flex gap-2 rounded-2xl bg-white px-3 py-2">
                  <span className="font-black text-teal">{index + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className="mt-5 rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
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
      <aside className="tour-panel pointer-events-auto absolute w-[min(28rem,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)] overflow-y-auto overflow-x-hidden rounded-[1.5rem] border border-white/70 bg-white/95 shadow-glow backdrop-blur-2xl sm:rounded-[2rem]" style={panelStyle}>
        <div className="bg-gradient-to-br from-navy via-ocean to-teal p-4 text-white sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/20">
                <Icon size={24} />
              </span>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-white/70">
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
          <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-3 sm:rounded-3xl sm:p-4">
            <p className="eyebrow">Mira esto</p>
            <p className="mt-2 text-sm text-slate-600">{step.focus}</p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3 sm:rounded-3xl sm:p-4">
            <p className="eyebrow text-emerald-700">Haz esto</p>
            <p className="mt-2 text-sm text-emerald-950">{step.action}</p>
          </div>
          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-3 sm:rounded-3xl sm:p-4">
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
  onExport,
}: {
  open: boolean;
  onClose: () => void;
  onView: (view: ViewId) => void;
  onStartTour: () => void;
  onExport: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose}>
      <div className="p-6">
        <p className="eyebrow">Acciones rapidas</p>
        <h3 className="mt-2 text-2xl font-black text-navy">Que quieres hacer ahora?</h3>
        <p className="mt-2 text-sm text-slate-500">Atajos para moverte sin buscar entre secciones.</p>
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          <ActionTile title="Nuevo movimiento" text="Agregar gasto, ingreso o compra MSI." onClick={() => onView("transactions")} />
          <ActionTile title="Editar quincenas" text="Ajustar renta, comida, sueldo o pagos TDC." onClick={() => onView("periods")} />
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
    <button className="rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5 text-left transition hover:-translate-y-1 hover:border-ocean/50 hover:shadow-card" type="button" onClick={onClick}>
      <strong className="text-navy">{title}</strong>
      <span className="mt-2 block text-sm text-slate-500">{text}</span>
    </button>
  );
}

function PeriodModal({
  period,
  onClose,
  onChange,
  onSave,
}: {
  period: Period | null;
  onClose: () => void;
  onChange: (period: Period) => void;
  onSave: () => void;
}) {
  if (!period) return null;
  const update = (patch: Partial<Period>) => onChange({ ...period, ...patch });
  return (
    <Modal open={Boolean(period)} onClose={onClose}>
      <div className="max-h-[85dvh] overflow-y-auto p-6">
        <p className="eyebrow">Editar</p>
        <h3 className="mt-2 text-2xl font-black text-navy">Quincena</h3>
        <div className="mt-5 grid gap-3">
          <Field label="Quincena"><input className="input" value={period.label} onChange={(event) => update({ label: event.target.value })} /></Field>
          <Field label="Rango / nota"><textarea className="input min-h-24" value={period.note} onChange={(event) => update({ note: event.target.value })} /></Field>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Sueldo"><input className="input" value={period.salary} onChange={(event) => update({ salary: asNumber(event.target.value) })} type="number" step="0.01" /></Field>
            <Field label="Ingreso extra"><input className="input" value={period.extraIncome} onChange={(event) => update({ extraIncome: asNumber(event.target.value) })} type="number" step="0.01" /></Field>
            <Field label="Ingreso pareja"><input className="input" value={period.partnerIncome} onChange={(event) => update({ partnerIncome: asNumber(event.target.value) })} type="number" step="0.01" /></Field>
            <Field label="Renta / apartado"><input className="input" value={period.rent} onChange={(event) => update({ rent: asNumber(event.target.value) })} type="number" step="0.01" /></Field>
            <Field label="Servicios debito"><input className="input" value={period.debitServices} onChange={(event) => update({ debitServices: asNumber(event.target.value) })} type="number" step="0.01" /></Field>
            <Field label="Cargos TDC"><input className="input" value={period.foodCredit} onChange={(event) => update({ foodCredit: asNumber(event.target.value) })} type="number" step="0.01" /></Field>
            <Field label="ChatGPT TDC"><input className="input" value={period.chatGptCredit} onChange={(event) => update({ chatGptCredit: asNumber(event.target.value) })} type="number" step="0.01" /></Field>
            <Field label="Pago tarjeta"><input className="input" value={period.cardPayment} onChange={(event) => update({ cardPayment: asNumber(event.target.value) })} type="number" step="0.01" /></Field>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button className="button-ghost" type="button" onClick={onClose}>Cancelar</button>
          <button className="button-primary" type="button" onClick={onSave}>Guardar</button>
        </div>
      </div>
    </Modal>
  );
}
