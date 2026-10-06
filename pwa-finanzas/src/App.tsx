import { useEffect, useRef, useState } from "react";
import { ChevronLeft, CreditCard, Ellipsis, House, List, Plus, RefreshCw } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { BBVAImport } from "./BBVAImport";
import { TransactionForm } from "./TransactionForm";
import type { TransactionPrefill } from "./TransactionForm";
import { ConfirmDialog, Sheet, formatMoney, fullDate } from "./ui";
import type { ConfirmRequest } from "./ui";
import { Backup } from "./views/Backup";
import { Card } from "./views/Card";
import { Home } from "./views/Home";
import { MandadoImport } from "./views/MandadoImport";
import { Budgets, MoreMenu, Subscriptions } from "./views/More";
import { Movements } from "./views/Movements";
import { Settings } from "./views/Settings";
import { buildPaymentScheduleFor, normalizeCategory, normalizeState, periodIdForDate, reconcileCashBalanceFor } from "./lib/calculations";
import { sameStatement, validateStatement } from "./lib/bbva";
import type { BankStatement, StatementMovement } from "./lib/bbva-types";
import { exportMovementsCsv, exportStateJson, readJsonFile } from "./lib/files";
import { planImport, statementCandidates } from "./lib/imports";
import type { ImportCandidate } from "./lib/imports";
import { applyServiceWorkerUpdate, checkForServiceWorkerUpdate, getServiceWorkerRegistration, registerServiceWorker } from "./lib/pwa";
import type { PwaUpdateStatus } from "./lib/pwa";
import { cloneSeed, today } from "./lib/seed";
import { loadState, saveState } from "./lib/storage";
import { decryptStateFromSync, encryptStateForSync, fetchSync, normalizeEndpoint, syncSecret } from "./lib/sync";
import type { AppState, Budget, RecurringItem, Settings as PlanSettings, SyncSettings, Transaction, ViewId } from "./lib/types";

type Toast = { id: number; message: string; tone?: "danger" };
type SheetState = { draft: Transaction | null; prefill: TransactionPrefill };
type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<unknown> };

const TITLES: Record<ViewId, string> = {
  home: "Inicio", movements: "Movimientos", card: "Tarjeta", more: "Más", subscriptions: "Suscripciones", budgets: "Presupuestos",
  statements: "Estado de cuenta BBVA", mandado: "Compras de Mandado", settings: "Mi dinero y sueldo", backup: "Respaldo y app",
};
const TABS: Array<[ViewId, LucideIcon, string]> = [["home", House, "Inicio"], ["movements", List, "Movimientos"], ["card", CreditCard, "Tarjeta"], ["more", Ellipsis, "Más"]];
const MAIN_VIEWS = new Set<ViewId>(["home", "movements", "card", "more"]);
const isPayroll = (transaction: Pick<Transaction, "method" | "category">) => transaction.method === "income" && normalizeCategory(transaction.category) === "nomina";

export function App() {
  const [state, setState] = useState<AppState>(() => cloneSeed());
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const savingRef = useRef(false);
  const [view, setView] = useState<ViewId>("home");
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [pwaStatus, setPwaStatus] = useState<PwaUpdateStatus>("checking");
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const reloadingRef = useRef(false);

  useEffect(() => {
    loadState().then(setState).catch((error: Error) => setLoadError(error.message || "No se pudo leer el registro local.")).finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) { setPwaStatus("unsupported"); return undefined; }
    let disposed = false;
    const onControllerChange = () => { if (reloadingRef.current) return; reloadingRef.current = true; setPwaStatus("reloading"); window.location.reload(); };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    registerServiceWorker({
      onRegistered: (value) => { if (!disposed) { setRegistration(value); setPwaStatus(value.waiting ? "available" : "current"); } },
      onUpdateAvailable: (value) => { if (!disposed) { setRegistration(value); setPwaStatus("available"); } },
    }).catch((error) => { console.error(error); if (!disposed) setPwaStatus("error"); });
    return () => { disposed = true; navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange); };
  }, []);

  useEffect(() => {
    const handler = (event: Event) => { event.preventDefault(); setInstallPrompt(event as InstallPromptEvent); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => { window.scrollTo({ top: 0 }); }, [view]);

  function showToast(message: string, tone?: Toast["tone"]) {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 3000);
  }

  async function commit(nextState: AppState, message: string): Promise<boolean> {
    if (savingRef.current || loadError) return false;
    savingRef.current = true;
    try {
      const normalized = normalizeState({ ...nextState, updatedAt: new Date().toISOString() });
      await saveState(normalized);
      setState(normalized);
      setSaveError("");
      showToast(message);
      return true;
    } catch (error) {
      setSaveError(`No se guardaron los cambios: ${(error as Error).message}`);
      return false;
    } finally { savingRef.current = false; }
  }

  function ask(request: Omit<ConfirmRequest, "resolve">): Promise<boolean> {
    return new Promise((resolve) => setConfirmRequest({ ...request, resolve }));
  }

  function openForm(prefill: TransactionPrefill = { kind: "expense" }, draft: Transaction | null = null) { setSheet({ draft, prefill }); }

  async function saveTransaction(input: Transaction) {
    const draft = sheet?.draft || null;
    const periodId = periodIdForDate(state, input.date);
    if (!periodId) { showToast("La fecha no es válida.", "danger"); return; }
    let transaction: Transaction = { ...input, periodId, status: input.date > today ? "planned" : input.status };
    // A payroll for a half-month that already has a planned one completes that plan instead of adding another.
    if (!draft && isPayroll(transaction)) {
      const planned = state.transactions.find((entry) => isPayroll(entry) && entry.status === "planned" && entry.periodId === periodId);
      if (planned) transaction = { ...transaction, id: planned.id };
    }
    const replacedId = draft?.id || transaction.id;
    const duplicate = state.transactions.some((entry) => entry.id !== replacedId && entry.date === transaction.date && entry.method === transaction.method && Math.round(entry.amount * 100) === Math.round(transaction.amount * 100) && normalizeCategory(entry.category) === normalizeCategory(transaction.category));
    if (duplicate && !(await ask({ title: "¿Es otro movimiento?", message: `Ya tienes un movimiento de ${formatMoney(transaction.amount)} con la misma fecha y categoría. Guárdalo solo si es una operación distinta.`, confirmText: "Sí, es otro" }))) return;
    const base = state.transactions.filter((entry) => entry.id !== replacedId);
    const saved = { ...transaction, paymentSchedule: buildPaymentScheduleFor({ ...state, transactions: base }, transaction) };
    const message = draft ? "Movimiento actualizado" : transaction.status === "planned" ? "Programado; confírmalo cuando suceda" : isPayroll(transaction) ? "Nómina registrada" : transaction.method === "card_payment" ? "Pago de tarjeta registrado" : transaction.method === "income" ? "Ingreso registrado" : "Gasto registrado";
    if (await commit({ ...state, transactions: [...base, saved] }, message)) setSheet(null);
  }

  async function deleteTransaction(transaction: Transaction) {
    if (!(await ask({ title: "Borrar movimiento", message: `«${transaction.description}» por ${formatMoney(transaction.amount)} se quitará y se recalcularán tus saldos.`, confirmText: "Borrar", danger: true }))) return;
    if (await commit({ ...state, transactions: state.transactions.filter((entry) => entry.id !== transaction.id) }, "Movimiento borrado")) setSheet(null);
  }

  async function confirmPlanned(transaction: Transaction) {
    const date = transaction.date <= today ? transaction.date : today;
    if (!(await ask({ title: "¿Ya se realizó?", message: `${transaction.description} por ${formatMoney(transaction.amount)} quedará como realizado el ${fullDate(date)}. Si el monto cambió, edítalo después.`, confirmText: "Sí, ya se realizó" }))) return;
    const next: Transaction = { ...transaction, status: "confirmed", date, periodId: periodIdForDate(state, date) };
    await commit({ ...state, transactions: state.transactions.map((entry) => entry.id === next.id ? next : entry) }, "Movimiento confirmado");
  }

  async function confirmRecurring(transaction: Transaction) {
    if (state.transactions.some((entry) => entry.sourceRecurringId === transaction.sourceRecurringId && entry.recurringDate?.slice(0, 7) === transaction.recurringDate?.slice(0, 7))) return;
    const matching = state.transactions.filter((entry) => !entry.sourceRecurringId && entry.date === transaction.date && entry.method === transaction.method && entry.amount === transaction.amount && entry.description.trim().toLowerCase() === transaction.description.trim().toLowerCase());
    if (matching.length === 1) {
      await commit({ ...state, transactions: state.transactions.map((entry) => entry.id === matching[0].id ? { ...entry, status: "confirmed", sourceRecurringId: transaction.sourceRecurringId, recurringDate: transaction.recurringDate } : entry) }, "Se vinculó con el cargo que ya registraste");
      return;
    }
    await commit({ ...state, transactions: [...state.transactions, { ...transaction, status: "confirmed" }] }, `${transaction.description} confirmado`);
  }

  async function importStatement(input: BankStatement, movements: StatementMovement[]): Promise<boolean> {
    const statement = validateStatement(input);
    if (statement.cutoffDate > today) throw new Error("La fecha de corte debe ser hoy o anterior.");
    const previous = state.statements?.find((entry) => entry.id === statement.id || entry.cutoffDate === statement.cutoffDate);
    const same = Boolean(previous && sameStatement(previous, statement));
    // Replacing a confirmed statement keeps a copy of the plan first.
    if (previous && !same) exportStateJson(state, today);
    const purchases = movements.length ? planImport(state, statementCandidates(statement, movements)).add : [];
    const statements = same ? state.statements || [] : [...(state.statements || []).filter((entry) => entry.id !== statement.id && entry.cutoffDate !== statement.cutoffDate), statement];
    const message = `${same ? "Estado sin cambios" : previous ? "Estado actualizado (se descargó respaldo)" : "Estado de cuenta guardado"}${purchases.length ? ` · ${purchases.length} compras agregadas` : ""}`;
    return commit({ ...state, statements, transactions: [...state.transactions, ...purchases] }, message);
  }

  async function importMandado(candidates: ImportCandidate[]): Promise<boolean> {
    const { add, duplicates } = planImport(state, candidates);
    if (!add.length) { showToast("Esas compras ya estaban registradas."); return true; }
    return commit({ ...state, transactions: [...state.transactions, ...add] }, `${add.length} compras de Mandado agregadas${duplicates.length ? ` · ${duplicates.length} ya estaban` : ""}`);
  }

  function saveRecurring(item: RecurringItem): Promise<boolean> {
    const exists = state.recurring.some((entry) => entry.id === item.id);
    return commit({ ...state, recurring: exists ? state.recurring.map((entry) => entry.id === item.id ? item : entry) : [...state.recurring, item] }, "Suscripción guardada");
  }
  async function deleteRecurring(item: RecurringItem) {
    if (!(await ask({ title: `Borrar ${item.name}`, message: "Deja de proyectarse cada mes. Los cobros que ya confirmaste se conservan.", confirmText: "Borrar", danger: true }))) return;
    await commit({ ...state, recurring: state.recurring.filter((entry) => entry.id !== item.id) }, "Suscripción borrada");
  }
  function saveBudgets(budgets: Budget[]) { return commit({ ...state, settings: { ...state.settings, budgets } }, "Presupuestos guardados"); }
  function saveSettings(patch: Partial<PlanSettings>, message: string) { return commit({ ...state, settings: { ...state.settings, ...patch } }, message); }
  function reconcile(savings: number, rentReserve: number, foodReserve: number) { return commit(reconcileCashBalanceFor(state, savings, rentReserve, today, foodReserve), "Saldo de hoy guardado"); }

  async function payRent() {
    const amount = state.settings.rentReserve;
    if (amount <= 0 || !(await ask({ title: "¿Ya pagaste la renta?", message: `Se registra el pago de ${formatMoney(amount)} con el dinero apartado para la renta.`, confirmText: "Sí, la pagué" }))) return;
    const transaction: Transaction = { id: crypto.randomUUID(), date: today, description: "Renta", amount, category: "Renta", method: "cash", periodId: periodIdForDate(state, today), installments: 1, shared: false, status: "confirmed", fundingSource: "rent_reserve", affectsSavings: true };
    await commit({ ...state, transactions: [...state.transactions, transaction] }, "Renta registrada");
  }

  async function resetPlan() {
    if (!(await ask({ title: "Empezar de cero", message: "Se descarga un respaldo de tu plan y la app queda en blanco. Guarda ese archivo para recuperar tus datos.", confirmText: "Respaldar y empezar", danger: true }))) return;
    exportStateJson(state, today);
    if (await commit(cloneSeed(), "Plan nuevo listo")) setView("home");
  }

  async function importJson(file: File) {
    try {
      const next = normalizeState(await readJsonFile(file));
      if (!(await ask({ title: "Restaurar respaldo", message: "El archivo reemplaza el plan de este dispositivo. Antes se descarga una copia del actual.", confirmText: "Respaldar y restaurar" }))) return;
      exportStateJson(state, today);
      if (await commit(next, "Respaldo restaurado")) setView("home");
    } catch (error) { setSaveError(`No se importó el archivo: ${(error as Error).message}`); }
  }

  async function runSync(action: "save" | "test" | "push" | "pull", sync: SyncSettings, passphrase: string, confirmation: string) {
    const endpoint = normalizeEndpoint(sync.endpoint.trim());
    const syncId = sync.syncId.trim();
    try {
      if (action === "save") { await commit({ ...state, sync: { endpoint, syncId } }, "Sincronización guardada"); return; }
      if (!endpoint) throw new Error("Falta el servidor");
      if (action === "test") { const result = await fetchSync<{ ok: boolean }>(`${endpoint}/api/health`); showToast(result?.ok ? "Servidor conectado" : "Respuesta desconocida"); return; }
      if (!syncId) throw new Error("Falta el ID de sincronización");
      if (passphrase.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres");
      if (confirmation && confirmation !== passphrase) throw new Error("Las contraseñas no coinciden");
      const url = `${endpoint}/api/sync/${encodeURIComponent(syncId)}`;
      const headers = { "X-Sync-Secret": await syncSecret(passphrase) };
      if (action === "push") {
        const nextState = { ...state, sync: { endpoint, syncId } };
        await fetchSync(url, { method: "PUT", headers, body: JSON.stringify({ payload: await encryptStateForSync(nextState, passphrase) }) });
        await commit(nextState, "Respaldo cifrado subido");
        return;
      }
      if (!(await ask({ title: "Bajar respaldo cifrado", message: "Reemplaza el plan de este dispositivo con la copia del servidor. Antes se descarga una copia del actual.", confirmText: "Bajar y reemplazar" }))) return;
      const result = await fetchSync<{ payload: Parameters<typeof decryptStateFromSync>[0] }>(url, { headers });
      const next = await decryptStateFromSync(result.payload, passphrase);
      exportStateJson(state, today);
      await commit({ ...next, sync: { endpoint, syncId } }, "Respaldo cifrado descargado");
    } catch (error) { showToast(`Sincronización: ${(error as Error).message}`, "danger"); }
  }

  async function checkUpdate() {
    try {
      setPwaStatus("checking");
      const value = await checkForServiceWorkerUpdate(registration);
      if (!value) { setPwaStatus("unsupported"); return; }
      setRegistration(value);
      setPwaStatus(value.waiting ? "available" : "current");
      if (!value.waiting) showToast("Ya tienes la versión más reciente");
    } catch (error) { console.error(error); setPwaStatus("error"); }
  }
  async function applyUpdate() {
    const value = registration || (await getServiceWorkerRegistration());
    if (!applyServiceWorkerUpdate(value)) { setPwaStatus("current"); return; }
    setPwaStatus("activating");
  }
  async function install() { if (!installPrompt) return; await installPrompt.prompt(); await installPrompt.userChoice; setInstallPrompt(null); }

  if (loadError) return <main className="loading"><div className="card stack" style={{ maxWidth: "28rem", margin: "1rem" }}><h1 style={{ fontSize: "1.2rem" }}>No se pudo abrir tu registro</h1><p className="small muted">{loadError}</p><p className="small muted">Tus datos guardados se conservan. Reintenta antes de registrar cambios.</p><button className="btn primary" type="button" onClick={() => window.location.reload()}>Reintentar</button></div></main>;
  if (!ready) return <main className="loading">Cargando tu plan…</main>;

  const showFab = view === "home" || view === "movements" || view === "card";
  const activeTab: ViewId = MAIN_VIEWS.has(view) ? view : "more";
  return <div className="shell">
    <header className="topbar">
      {!MAIN_VIEWS.has(view) ? <button className="icon-btn" type="button" onClick={() => setView("more")} aria-label="Volver"><ChevronLeft size={18} /></button> : null}
      <div><h1>{TITLES[view]}</h1>{view === "home" ? <p className="sub">{fullDate(today)}</p> : null}</div>
      <span className="spacer" />
      {pwaStatus === "available" ? <button className="btn small" type="button" onClick={() => void applyUpdate()}><RefreshCw size={15} />Actualizar app</button> : null}
    </header>
    <nav className="tabbar" aria-label="Secciones">
      {TABS.map(([id, Icon, label]) => <button key={id} type="button" className="tab" aria-current={activeTab === id ? "page" : undefined} onClick={() => setView(id)}><Icon size={20} />{label}</button>)}
    </nav>
    <main className={`content ${showFab ? "with-fab" : ""}`}>
      {saveError ? <div className="notice bad row between wrap" role="alert"><span>{saveError}</span><button className="btn small" type="button" onClick={() => setSaveError("")}>Cerrar</button></div> : null}
      {state.migrationWarnings?.length ? <div className="notice warn stack-sm" role="status">{state.migrationWarnings.map((warning) => <p key={warning}>{warning}</p>)}<button className="btn small" type="button" onClick={() => void commit({ ...state, migrationWarnings: [] }, "Aviso cerrado")}>Entendido</button></div> : null}
      {view === "home" ? <Home state={state} today={today} onRegister={(prefill) => openForm(prefill)} onConfirmPlanned={confirmPlanned} onConfirmRecurring={confirmRecurring} onNavigate={setView} /> : null}
      {view === "movements" ? <Movements state={state} today={today} onEdit={(transaction) => openForm(undefined, transaction)} onConfirmPlanned={confirmPlanned} /> : null}
      {view === "card" ? <Card state={state} today={today} onRegister={(prefill) => openForm(prefill)} onEdit={(transaction) => openForm(undefined, transaction)} onNavigate={setView} /> : null}
      {view === "more" ? <MoreMenu state={state} today={today} onNavigate={setView} /> : null}
      {view === "subscriptions" ? <Subscriptions state={state} today={today} onSave={saveRecurring} onDelete={(item) => void deleteRecurring(item)} onConfirm={confirmRecurring} /> : null}
      {view === "budgets" ? <Budgets key={state.updatedAt} state={state} today={today} onSave={saveBudgets} /> : null}
      {view === "statements" ? <BBVAImport state={state} today={today} onImport={importStatement} /> : null}
      {view === "mandado" ? <MandadoImport state={state} onImport={importMandado} /> : null}
      {view === "settings" ? <Settings key={state.updatedAt} state={state} today={today} onReconcile={reconcile} onSaveSettings={saveSettings} onPayRent={() => void payRent()} onReset={() => void resetPlan()} /> : null}
      {view === "backup" ? <Backup state={state} pwaStatus={pwaStatus} canInstall={Boolean(installPrompt)} onExportJson={() => { exportStateJson(state, today); showToast("Respaldo descargado"); }} onExportCsv={() => exportMovementsCsv(state.transactions, today)} onImportJson={(file) => void importJson(file)} onSync={(action, sync, passphrase, confirmation) => void runSync(action, sync, passphrase, confirmation)} onCheckUpdate={() => void checkUpdate()} onApplyUpdate={() => void applyUpdate()} onInstall={() => void install()} /> : null}
    </main>
    {showFab ? <button className="fab" type="button" onClick={() => openForm()}><Plus size={20} />Registrar</button> : null}
    <Sheet open={Boolean(sheet)} title={sheet?.draft ? "Editar movimiento" : "Registrar"} onClose={() => setSheet(null)}>
      {sheet ? <TransactionForm key={`${sheet.draft?.id || "new"}-${JSON.stringify(sheet.prefill)}`} state={state} today={today} draft={sheet.draft} prefill={sheet.prefill} onSave={(transaction) => void saveTransaction(transaction)} onDelete={(transaction) => void deleteTransaction(transaction)} onCancel={() => setSheet(null)} /> : null}
    </Sheet>
    <ConfirmDialog request={confirmRequest} onDone={(value) => { confirmRequest?.resolve(value); setConfirmRequest(null); }} />
    <div className="toasts" aria-live="polite">{toasts.map((toast) => <div key={toast.id} className={`toast ${toast.tone || ""}`}>{toast.message}</div>)}</div>
  </div>;
}
