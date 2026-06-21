import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode, RefObject } from "react";
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
  CalendarClock,
  ChartSpline,
  Check,
  ChevronRight,
  CreditCard,
  Download,
  FileJson,
  LayoutDashboard,
  ListChecks,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
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
  applyTransactionToPeriods,
  asNumber,
  buildPaymentScheduleFor,
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
import type { AppState, CalculatedPeriod, MonthlyReport, Period, RecurringItem, Transaction, ViewId } from "./lib/types";

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
  const activeNav = navItems.find((item) => item.id === view) || navItems[0];

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
      {
        ...state,
        transactions: [...state.transactions, transaction],
        periods: applyTransactionToPeriods(state.periods, transaction, 1),
      },
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
      {
        ...state,
        transactions: state.transactions.filter((entry) => entry.id !== transaction.id),
        periods: applyTransactionToPeriods(state.periods, transaction, -1),
      },
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
      {mobileMenu ? <div className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm lg:hidden" onClick={() => setMobileMenu(false)} /> : null}

      <div
        className={`grid min-h-dvh transition-[grid-template-columns] duration-200 lg:grid-cols-[18rem_minmax(0,1fr)] ${
          sidebarCollapsed ? "lg:grid-cols-[6rem_minmax(0,1fr)]" : ""
        }`}
      >
        <aside
          className={`fixed inset-y-0 left-0 z-50 flex w-[min(21rem,calc(100vw-3rem))] flex-col gap-6 overflow-hidden bg-gradient-to-b from-navy to-slate-900 p-5 text-white shadow-2xl transition-transform duration-200 lg:sticky lg:top-0 lg:h-dvh lg:w-auto lg:translate-x-0 ${
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

          <nav className="grid gap-2" role="tablist" aria-label="Secciones">
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
                  onClick={() => setView(item.id)}
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
                {installPrompt ? (
                  <button className="button-ghost mt-4 w-full border-white/20 bg-white/10 text-white" type="button" onClick={handleInstall}>
                    Instalar app
                  </button>
                ) : null}
              </>
            )}
          </div>
        </aside>

        <main className="min-w-0 p-4 lg:p-6">
          <header className="sticky top-0 z-30 mb-5 flex flex-col gap-4 rounded-[1.6rem] border border-white/60 bg-white/70 p-4 shadow-card backdrop-blur-2xl md:flex-row md:items-center md:justify-between">
            <div>
              <p className="eyebrow">Actualizable por ti</p>
              <h2 className="text-3xl font-black tracking-tight text-navy md:text-4xl">{activeNav.label}</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="button-ghost lg:hidden" type="button" onClick={() => setMobileMenu(true)}>
                <Menu size={18} />
                Menu
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
            {view === "card" ? <CardView state={state} /> : null}
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
        onExport={() => {
          setQuickActionsOpen(false);
          exportStateJson(state, today);
          showToast("Respaldo exportado");
        }}
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
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-navy via-ocean to-teal p-6 text-white shadow-glow md:p-8">
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full border border-white/20 bg-white/10 blur-sm" />
        <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-center">
          <div>
            <p className="eyebrow text-white/70">Centro financiero</p>
            <h3 className="mt-3 max-w-4xl text-4xl font-black leading-[0.98] tracking-[-0.06em] md:text-6xl">
              Tu plan quincenal, tarjeta y ahorros en un tablero vivo.
            </h3>
            <p className="mt-4 max-w-2xl text-white/76">
              Edita supuestos, agrega movimientos, revisa reportes y sincroniza un respaldo cifrado sin volver al Excel.
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-white/20 bg-white/12 p-5 backdrop-blur-2xl">
            <p className="text-sm text-white/70">Sync cifrado</p>
            <strong className="mt-2 block text-2xl font-black">Cloudflare KV</strong>
            <p className="mt-2 text-sm text-white/70">Backend y base de datos listos para subir o bajar respaldos.</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Ahorro actual" value={formatMoney(state.settings.currentSavings)} note={`Renta apartada: ${formatMoney(state.settings.rentReserve)}`} icon={WalletCards} />
        <MetricCard label="Tras 1a julio" value={formatMoney(periods.find((period) => period.id === "2026-07-h1")?.savings || 0)} note="Sueldo del 30 jun aplicado" icon={CalendarClock} />
        <MetricCard label="Pago TDC julio" value={formatMoney(Math.abs(periods.find((period) => period.id === "2026-07-h2")?.cardPayment || 0))} note="Estimado al 25 jul" icon={CreditCard} />
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

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,.75fr)]">
        <div className="panel">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="eyebrow">Tendencia</p>
              <h3 className="text-xl font-black text-navy">Ahorro y flujo mensual</h3>
            </div>
          </div>
          <div className="h-72">
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

        <div className="panel">
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

      <section className="panel">
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

function PeriodsTable({ periods, compact, onEdit }: { periods: CalculatedPeriod[]; compact?: boolean; onEdit?: (period: Period) => void }) {
  return (
    <div className="overflow-x-auto rounded-3xl border border-blue-100 bg-white/80">
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
    <section className="panel">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="eyebrow">Editable</p>
          <h3 className="text-2xl font-black text-navy">Plan quincenal</h3>
        </div>
        <button className="button-secondary" type="button" onClick={onAdd}>
          <Plus size={18} />
          Agregar quincena
        </button>
      </div>
      <PeriodsTable periods={periods} onEdit={onEdit} />
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
      <form className="panel self-start" onSubmit={onSubmit}>
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
          <Field label="Medio">
            <select className="input" name="method" defaultValue="credit">
              <option value="credit">Tarjeta de credito</option>
              <option value="cash">Efectivo / debito</option>
            </select>
          </Field>
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
        <label className="mb-4 flex items-center gap-3 text-sm font-black text-navy">
          <input className="h-4 w-4" name="shared" type="checkbox" />
          Dividir con mi pareja
        </label>
        <Field label="Meses sin intereses">
          <select className="input" name="installments" defaultValue="1">
            <option value="1">Una exhibicion</option>
            <option value="3">3 MSI</option>
            <option value="6">6 MSI</option>
          </select>
        </Field>
        <button className="button-primary mt-2 w-full" type="submit">
          <Plus size={18} />
          Guardar movimiento
        </button>
      </form>

      <section className="panel">
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
                  <div>
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
                  <div className="flex items-center gap-2">
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
      <form className="panel self-start" onSubmit={onSubmit}>
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

      <section className="panel">
        <p className="eyebrow">Servicios</p>
        <h3 className="mb-5 text-2xl font-black text-navy">Recurrentes</h3>
        {recurring.length ? (
          <div className="grid gap-3">
            {recurring.map((item) => (
              <article key={item.id} className="flex flex-col gap-3 rounded-3xl border border-blue-100 bg-white/75 p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <strong className="text-navy">{item.name}</strong>
                  <p className="text-sm text-slate-500">
                    Dia {item.day} | {item.method === "credit" ? "Tarjeta" : "Debito"} | {item.active ? "Activo" : "Cancelado"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
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

function CardView({ state }: { state: AppState }) {
  const data = state.cardCalendar.map((entry) => ({ month: entry.month, total: entry.total, tuParte: entry.userPart, deuda: entry.debt }));
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,.8fr)]">
      <section className="panel">
        <p className="eyebrow">Tarjeta</p>
        <h3 className="mb-5 text-2xl font-black text-navy">Calendario TDC</h3>
        <div className="h-80">
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
        <div className="mt-5 grid gap-3">
          {state.cardCalendar.map((entry) => (
            <article key={entry.month} className="flex items-center justify-between rounded-3xl border border-blue-100 bg-white/75 p-4">
              <div>
                <strong className="text-navy">{entry.month}</strong>
                <p className="text-sm text-slate-500">Parte tuya: {formatMoney(entry.userPart)}</p>
              </div>
              <span className="pill">{formatMoney(entry.total)}</span>
            </article>
          ))}
        </div>
      </section>
      <section className="panel">
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
        <div className="flex flex-wrap gap-2">
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
      <div className="mb-6 h-80">
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
      <div className="overflow-x-auto rounded-3xl border border-blue-100 bg-white/80">
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
      <form className="panel" onSubmit={onSubmitSettings} key={`settings-${state.updatedAt}`}>
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
        <button className="button-primary mt-5" type="submit">
          <Check size={18} />
          Guardar ajustes
        </button>
      </form>

      <section className="panel">
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

function QuickActionsModal({
  open,
  onClose,
  onView,
  onExport,
}: {
  open: boolean;
  onClose: () => void;
  onView: (view: ViewId) => void;
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
