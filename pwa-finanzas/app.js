const DB_NAME = "plan-financiero-pwa";
const DB_VERSION = 1;
const STORE = "state";
const STATE_KEY = "main";

const money = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
});

const today = new Date().toISOString().slice(0, 10);

const seedState = {
  version: 1,
  updatedAt: new Date().toISOString(),
  settings: {
    currentSavings: 0,
    rentReserve: 0,
    salary: 0,
    monthlyRent: 0,
    defaultFood: 0,
    chatGpt: 0,
    cutoffDay: 3,
    dueDay: 25,
    previousCardDebt: 0,
    previousCardPayment: 0,
    pointsPayment: 0,
    newJulyPurchases: 0,
    nonRecurringBalance: 0,
  },
  periods: [
    {
      id: "2026-06-h2",
      month: "Junio",
      label: "2a junio",
      note: "Base actual. Importa tu respaldo privado o captura tus montos reales.",
      salary: 0,
      extraIncome: 0,
      partnerIncome: 0,
      rent: 0,
      debitServices: 0,
      foodCredit: 0,
      chatGptCredit: 0,
      cardPayment: 0,
      lockedBase: true,
    },
    {
      id: "2026-07-h1",
      month: "Julio",
      label: "1a julio",
      note: "Quincena financiada con el sueldo del 30 del mes anterior.",
      salary: 0,
      extraIncome: 0,
      partnerIncome: 0,
      rent: 0,
      debitServices: 0,
      foodCredit: 0,
      chatGptCredit: 0,
      cardPayment: 0,
    },
    {
      id: "2026-07-h2",
      month: "Julio",
      label: "2a julio",
      note: "Quincena financiada con el sueldo del 15. Aqui suele caer el pago de tarjeta.",
      salary: 0,
      extraIncome: 0,
      partnerIncome: 0,
      rent: 0,
      debitServices: 0,
      foodCredit: 0,
      chatGptCredit: 0,
      cardPayment: 0,
    },
  ],
  recurring: [],
  transactions: [],
  cardCalendar: [
    { month: "Junio", total: 0, userPart: 0, debt: 0 },
    { month: "Julio", total: 0, userPart: 0, debt: 0 },
    { month: "Agosto", total: 0, userPart: 0, debt: 0 },
    { month: "Septiembre", total: 0, userPart: 0, debt: 0 },
    { month: "Octubre", total: 0, userPart: 0, debt: 0 },
    { month: "Noviembre", total: 0, userPart: 0, debt: 0 },
  ],
  sync: {
    endpoint: "https://plan-financiero-sync.uriel-plan-financiero.workers.dev",
    syncId: "",
  },
};

let state = structuredClone(seedState);
let deferredInstallPrompt = null;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function normalizeState(input) {
  return {
    ...structuredClone(seedState),
    ...input,
    settings: { ...seedState.settings, ...(input?.settings || {}) },
    periods: Array.isArray(input?.periods) ? input.periods : structuredClone(seedState.periods),
    recurring: Array.isArray(input?.recurring) ? input.recurring : [],
    transactions: Array.isArray(input?.transactions) ? input.transactions : [],
    cardCalendar: Array.isArray(input?.cardCalendar)
      ? input.cardCalendar
      : structuredClone(seedState.cardCalendar),
    sync: { ...seedState.sync, ...(input?.sync || {}) },
  };
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function loadState() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).get(STATE_KEY);
    request.onsuccess = () => resolve(normalizeState(request.result || structuredClone(seedState)));
    request.onerror = () => reject(request.error);
  });
}

async function saveState() {
  state.updatedAt = new Date().toISOString();
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(state, STATE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function asNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatMoney(value) {
  return money.format(asNumber(value));
}

function signedClass(value) {
  return asNumber(value) < 0 ? "money-negative" : "money-positive";
}

function sum(items, selector) {
  return items.reduce((total, item) => total + selector(item), 0);
}

export function calculatePeriodsFor(inputState) {
  let running = inputState.settings.currentSavings;
  return inputState.periods.map((period, index) => {
    const income = period.salary + period.extraIncome + period.partnerIncome;
    const cashExpenses = period.rent + period.debitServices;
    const cardPayment = period.cardPayment;
    const flow = index === 0 ? 0 : income + cashExpenses + cardPayment;
    running = index === 0 ? inputState.settings.currentSavings : running + flow;
    const creditCharges = period.foodCredit + period.chatGptCredit;
    return {
      ...period,
      income,
      cashExpenses,
      cardPayment,
      flow,
      creditCharges,
      savings: running,
    };
  });
}

function calcPeriods() {
  return calculatePeriodsFor(state);
}

export function calculateMonthlyFor(inputState, periods = calculatePeriodsFor(inputState)) {
  const order = ["Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre"];
  return order.map((month) => {
    const monthPeriods = periods.filter((period) => period.month === month);
    const card = inputState.cardCalendar.find((entry) => entry.month === month);
    return {
      month,
      income: sum(monthPeriods, (period) => period.income),
      cashExpenses: sum(monthPeriods, (period) => period.cashExpenses),
      cardPayment:
        month === "Junio"
          ? -inputState.settings.previousCardPayment
          : sum(monthPeriods, (period) => period.cardPayment),
      flow: sum(monthPeriods, (period) => period.flow),
      savings: monthPeriods.at(-1)?.savings ?? inputState.settings.currentSavings,
      creditCharges:
        sum(monthPeriods, (period) => period.creditCharges) +
        (month === "Junio" ? inputState.settings.newJulyPurchases : 0),
      cardTotal: card?.total ?? Math.abs(sum(monthPeriods, (period) => period.cardPayment)),
    };
  });
}

function calcMonthly(periods = calcPeriods()) {
  return calculateMonthlyFor(state, periods);
}

function getPeriod(id) {
  return state.periods.find((period) => period.id === id);
}

function transactionImpact(transaction) {
  const amount = asNumber(transaction.amount);
  const sharedIncome = transaction.shared ? amount / 2 : 0;
  const creditPayment = transaction.method === "credit" ? 0 : -amount;
  return { amount, sharedIncome, creditPayment };
}

function isCardPaymentPeriod(period) {
  return period.label.toLowerCase().startsWith("2a ");
}

export function buildPaymentScheduleFor(inputState, transaction) {
  if (transaction.method !== "credit") return [];
  const selectedIndex = inputState.periods.findIndex((period) => period.id === transaction.periodId);
  if (selectedIndex < 0) return [];
  const paymentPeriods = inputState.periods.slice(selectedIndex + 1).filter(isCardPaymentPeriod);
  const installmentCount = Math.max(1, asNumber(transaction.installments, 1));
  const usablePeriods = paymentPeriods.slice(0, installmentCount);
  if (!usablePeriods.length) return [];

  const amount = asNumber(transaction.amount);
  const baseInstallment = Math.floor((amount / installmentCount) * 100) / 100;
  let assigned = 0;
  return usablePeriods.map((period, index) => {
    const isLastScheduled = index === usablePeriods.length - 1;
    const installmentAmount = isLastScheduled
      ? Math.round((amount - assigned) * 100) / 100
      : baseInstallment;
    assigned += installmentAmount;
    return {
      periodId: period.id,
      amount: installmentAmount,
    };
  });
}

function buildPaymentSchedule(transaction) {
  return buildPaymentScheduleFor(state, transaction);
}

async function persistAndRender(message = "Cambios guardados") {
  await saveState();
  render();
  showToast(message);
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("visible");
  window.setTimeout(() => toast.classList.remove("visible"), 2200);
}

function setView(viewId) {
  $$(".view").forEach((view) => view.classList.toggle("active-view", view.id === viewId));
  $$(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === viewId));
  const label = document.querySelector(`[data-view="${viewId}"]`)?.textContent || "Inicio";
  $("#viewTitle").textContent = label;
}

function renderDashboard(periods, monthly) {
  const hasRealData =
    state.settings.currentSavings !== 0 ||
    state.settings.salary !== 0 ||
    state.transactions.length > 0 ||
    state.recurring.length > 0;
  $("#onboardingPanel").hidden = hasRealData;
  $("#currentSavings").textContent = formatMoney(state.settings.currentSavings);
  $("#currentSavingsNote").textContent = `Renta apartada: ${formatMoney(state.settings.rentReserve)}`;
  $("#afterFirstJuly").textContent = formatMoney(getPeriodCalc(periods, "2026-07-h1")?.savings || 0);
  $("#julyCardPayment").textContent = formatMoney(Math.abs(getPeriodCalc(periods, "2026-07-h2")?.cardPayment || 0));
  $("#projectedClose").textContent = formatMoney(periods.at(-1)?.savings || 0);

  $("#dashboardPeriods").innerHTML = periods
    .slice(0, 6)
    .map(
      (period) => `
        <tr>
          <td><strong>${period.label}</strong><br><span class="muted">${period.note.split("|")[0]?.trim() || ""}</span></td>
          <td>${formatMoney(period.income)}</td>
          <td class="${signedClass(period.cashExpenses)}">${formatMoney(period.cashExpenses)}</td>
          <td class="${signedClass(period.cardPayment)}">${formatMoney(period.cardPayment)}</td>
          <td class="${signedClass(period.flow)}">${formatMoney(period.flow)}</td>
          <td><strong>${formatMoney(period.savings)}</strong></td>
        </tr>
      `,
    )
    .join("");

  const alerts = [];
  const lowSavings = periods.find((period) => period.savings < 10000);
  if (lowSavings) {
    alerts.push({
      type: "warning",
      text: `${lowSavings.label} baja a ${formatMoney(lowSavings.savings)}. Conviene revisar gastos variables.`,
    });
  }
  const negativeFlows = periods.filter((period) => period.flow < 0);
  if (negativeFlows.length) {
    alerts.push({
      type: "danger",
      text: `${negativeFlows.length} quincenas tienen flujo negativo por pagos de tarjeta.`,
    });
  }
  alerts.push({
    type: "ok",
    text: `Cierre proyectado: ${formatMoney(periods.at(-1)?.savings || 0)}.`,
  });
  $("#alerts").innerHTML = alerts
    .map((alert) => `<div class="alert ${alert.type === "ok" ? "" : alert.type}">${alert.text}</div>`)
    .join("");
}

function getPeriodCalc(periods, id) {
  return periods.find((period) => period.id === id);
}

function renderPeriods(periods) {
  $("#periodRows").innerHTML = periods
    .map(
      (period) => `
        <tr>
          <td><strong>${period.label}</strong></td>
          <td>${period.note}</td>
          <td>${formatMoney(period.salary)}</td>
          <td>${formatMoney(period.partnerIncome)}</td>
          <td class="${signedClass(period.rent)}">${formatMoney(period.rent)}</td>
          <td class="${signedClass(period.debitServices)}">${formatMoney(period.debitServices)}</td>
          <td>${formatMoney(period.foodCredit)}</td>
          <td>${formatMoney(period.chatGptCredit)}</td>
          <td class="${signedClass(period.cardPayment)}">${formatMoney(period.cardPayment)}</td>
          <td><strong>${formatMoney(period.savings)}</strong></td>
          <td><button class="ghost-button" data-edit-period="${period.id}">Editar</button></td>
        </tr>
      `,
    )
    .join("");
}

function renderTransactions() {
  const periodOptions = state.periods
    .map((period) => `<option value="${period.id}">${period.label}</option>`)
    .join("");
  $("#transactionPeriodSelect").innerHTML = periodOptions;

  $("#transactionList").innerHTML = state.transactions
    .slice()
    .reverse()
    .map((transaction) => {
      const schedule = transaction.paymentSchedule?.length
        ? transaction.paymentSchedule
            .map((payment) => `${getPeriod(payment.periodId)?.label || "quincena"}: ${formatMoney(payment.amount)}`)
            .join(" · ")
        : "";
      return `
        <div class="item">
          <div>
            <strong>${transaction.description}</strong>
            <small>${transaction.date} · ${transaction.category} · ${getPeriod(transaction.periodId)?.label || "Sin quincena"}</small>
            <small>${transaction.method === "credit" ? "Tarjeta de crédito" : "Efectivo / débito"} ${
              transaction.shared ? "· dividido con pareja" : ""
            }</small>
            ${schedule ? `<small>Pago TDC: ${schedule}</small>` : ""}
          </div>
          <div class="mini-actions">
            <span class="pill">${formatMoney(transaction.amount)}</span>
            <button data-delete-transaction="${transaction.id}">Borrar</button>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderRecurring() {
  $("#recurringList").innerHTML = state.recurring
    .map(
      (item) => `
        <div class="item">
          <div>
            <strong>${item.name}</strong>
            <small>Día ${item.day} · ${item.method === "credit" ? "Tarjeta" : "Débito"} · ${
              item.active ? "Activo" : "Cancelado"
            }</small>
          </div>
          <div class="mini-actions">
            <span class="pill">${formatMoney(item.amount)}</span>
            <button data-edit-recurring="${item.id}">Editar</button>
            <button data-delete-recurring="${item.id}">Borrar</button>
          </div>
        </div>
      `,
    )
    .join("");
}

function renderCard() {
  $("#cardCalendar").innerHTML = state.cardCalendar
    .map(
      (entry) => `
        <div class="item">
          <div>
            <strong>${entry.month}</strong>
            <small>Parte tuya: ${formatMoney(entry.userPart)}</small>
          </div>
          <span class="pill">${formatMoney(entry.total)}</span>
        </div>
      `,
    )
    .join("");

  $("#debtTimeline").innerHTML = state.cardCalendar
    .map(
      (entry) => `
        <div class="timeline-step">
          <strong>${entry.month}</strong>
          <div>Saldo no recurrente: <span class="${entry.debt <= 0 ? "money-positive" : "money-negative"}">${formatMoney(
            entry.debt,
          )}</span></div>
        </div>
      `,
    )
    .join("");
}

function renderReports(monthly) {
  $("#monthlyReportRows").innerHTML = monthly
    .map(
      (row) => `
        <tr>
          <td><strong>${row.month}</strong></td>
          <td>${formatMoney(row.income)}</td>
          <td class="${signedClass(row.cashExpenses)}">${formatMoney(row.cashExpenses)}</td>
          <td class="${signedClass(row.cardPayment)}">${formatMoney(row.cardPayment)}</td>
          <td class="${signedClass(row.flow)}">${formatMoney(row.flow)}</td>
          <td><strong>${formatMoney(row.savings)}</strong></td>
        </tr>
      `,
    )
    .join("");
}

function renderSettings() {
  const form = $("#settingsForm");
  const settings = state.settings;
  for (const [key, value] of Object.entries(settings)) {
    if (form.elements[key]) form.elements[key].value = value;
  }
}

function render() {
  const periods = calcPeriods();
  const monthly = calcMonthly(periods);
  renderDashboard(periods, monthly);
  renderPeriods(periods);
  renderTransactions();
  renderRecurring();
  renderCard();
  renderReports(monthly);
  renderSettings();
  renderSyncSettings();
}

function updatePeriodFromTransaction(transaction, direction = 1) {
  const period = getPeriod(transaction.periodId);
  if (!period) return;
  const { amount, sharedIncome, creditPayment } = transactionImpact(transaction);
  if (transaction.method === "credit") {
    period.foodCredit += direction * amount;
    const schedule = transaction.paymentSchedule?.length ? transaction.paymentSchedule : buildPaymentSchedule(transaction);
    for (const payment of schedule) {
      const paymentPeriod = getPeriod(payment.periodId);
      if (paymentPeriod) paymentPeriod.cardPayment -= direction * payment.amount;
    }
  } else {
    period.debitServices += direction * creditPayment;
  }
  period.partnerIncome += direction * sharedIncome;
}

function downloadText(filename, text, type = "application/json") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function importStateFromFile(fileInput) {
  const file = fileInput.files[0];
  if (!file) return;
    const imported = JSON.parse(await file.text());
    if (!imported.settings || !Array.isArray(imported.periods)) {
      throw new Error("El respaldo no tiene el formato esperado");
    }
  state = normalizeState(imported);
  await persistAndRender("Respaldo importado");
  fileInput.value = "";
}

function toCsv(rows) {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const text = String(cell ?? "");
          return text.includes(",") || text.includes("\n") || text.includes('"')
            ? `"${text.replaceAll('"', '""')}"`
            : text;
        })
        .join(","),
    )
    .join("\n");
}

function getCrypto() {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Este navegador no soporta Web Crypto");
  }
  return globalThis.crypto;
}

function randomBytes(length) {
  const bytes = new Uint8Array(length);
  getCrypto().getRandomValues(bytes);
  return bytes;
}

function bytesToBase64(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(text) {
  const digest = await getCrypto().subtle.digest("SHA-256", new TextEncoder().encode(text));
  return bytesToHex(new Uint8Array(digest));
}

async function deriveEncryptionKey(passphrase, saltBytes) {
  const baseKey = await getCrypto().subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return getCrypto().subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltBytes,
      iterations: 250000,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encryptStateForSync(passphrase) {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await deriveEncryptionKey(passphrase, salt);
  const plaintext = new TextEncoder().encode(JSON.stringify(state));
  const ciphertext = await getCrypto().subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  return {
    version: 1,
    algorithm: "AES-GCM",
    kdf: "PBKDF2-SHA256",
    iterations: 250000,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    updatedAt: new Date().toISOString(),
  };
}

async function decryptStateFromSync(payload, passphrase) {
  const salt = base64ToBytes(payload.salt);
  const iv = base64ToBytes(payload.iv);
  const ciphertext = base64ToBytes(payload.ciphertext);
  const key = await deriveEncryptionKey(passphrase, salt);
  const plaintext = await getCrypto().subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return normalizeState(JSON.parse(new TextDecoder().decode(plaintext)));
}

function normalizeEndpoint(endpoint) {
  return endpoint.replace(/\/+$/, "");
}

function getSyncInputs() {
  const endpoint = normalizeEndpoint($("#syncEndpoint").value.trim());
  const syncId = $("#syncId").value.trim();
  const passphrase = $("#syncPassphrase").value;
  const confirm = $("#syncPassphraseConfirm").value;
  if (!endpoint) throw new Error("Falta endpoint");
  if (!syncId) throw new Error("Falta ID de sincronizacion");
  if (!passphrase || passphrase.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres");
  if (confirm && confirm !== passphrase) throw new Error("Las contraseñas no coinciden");
  return { endpoint, syncId, passphrase };
}

async function syncSecret(passphrase) {
  return sha256Hex(`plan-financiero-sync:${passphrase}`);
}

async function fetchSync(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(body?.error || `Error HTTP ${response.status}`);
  }
  return body;
}

function renderSyncSettings() {
  $("#syncEndpoint").value = state.sync?.endpoint || "";
  $("#syncId").value = state.sync?.syncId || "";
  $("#syncStatus").textContent = state.sync?.endpoint ? "Configurable" : "Local";
}

function wireNavigation() {
  $$(".nav-item").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });
  $$("[data-view-target]").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.viewTarget));
  });
  $("#quickAddButton").addEventListener("click", () => setView("transactions"));
}

function wireForms() {
  $("#transactionForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    const transaction = {
      id: crypto.randomUUID(),
      date: data.date || today,
      description: data.description,
      amount: asNumber(data.amount),
      category: data.category,
      method: data.method,
      periodId: data.periodId,
      shared: form.elements.shared.checked,
      installments: asNumber(data.installments, 1),
    };
    transaction.paymentSchedule = buildPaymentSchedule(transaction);
    state.transactions.push(transaction);
    updatePeriodFromTransaction(transaction, 1);
    form.reset();
    form.elements.date.value = today;
    await persistAndRender("Movimiento agregado");
  });

  $("#recurringForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const item = {
      id: data.id || crypto.randomUUID(),
      name: data.name,
      amount: asNumber(data.amount),
      day: asNumber(data.day, 1),
      method: data.method,
      active: data.active === "true",
    };
    const index = state.recurring.findIndex((entry) => entry.id === item.id);
    if (index >= 0) state.recurring[index] = item;
    else state.recurring.push(item);
    event.currentTarget.reset();
    await persistAndRender("Recurrente guardado");
  });

  $("#settingsForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    for (const key of Object.keys(state.settings)) {
      if (data[key] !== undefined && data[key] !== "") state.settings[key] = asNumber(data[key], state.settings[key]);
    }
    await persistAndRender("Ajustes guardados");
  });

  $("#periodForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    const period = getPeriod(data.id);
    if (period) {
      period.label = data.label;
      period.note = data.note;
      period.salary = asNumber(data.salary);
      period.extraIncome = asNumber(data.extraIncome);
      period.partnerIncome = asNumber(data.partnerIncome);
      period.rent = asNumber(data.rent);
      period.debitServices = asNumber(data.debitServices);
      period.foodCredit = asNumber(data.foodCredit);
      period.chatGptCredit = asNumber(data.chatGptCredit);
      period.cardPayment = asNumber(data.cardPayment);
    }
    $("#periodDialog").close();
    await persistAndRender("Quincena guardada");
  });
}

function wireActions() {
  document.body.addEventListener("click", async (event) => {
    const editPeriodId = event.target.dataset.editPeriod;
    if (editPeriodId) {
      const period = getPeriod(editPeriodId);
      const form = $("#periodForm");
      for (const key of [
        "id",
        "label",
        "note",
        "salary",
        "extraIncome",
        "partnerIncome",
        "rent",
        "debitServices",
        "foodCredit",
        "chatGptCredit",
        "cardPayment",
      ]) {
        if (form.elements[key]) form.elements[key].value = period[key] ?? "";
      }
      $("#periodDialog").showModal();
    }

    const deleteTransactionId = event.target.dataset.deleteTransaction;
    if (deleteTransactionId) {
      const transaction = state.transactions.find((entry) => entry.id === deleteTransactionId);
      state.transactions = state.transactions.filter((entry) => entry.id !== deleteTransactionId);
      if (transaction) updatePeriodFromTransaction(transaction, -1);
      await persistAndRender("Movimiento borrado");
    }

    const editRecurringId = event.target.dataset.editRecurring;
    if (editRecurringId) {
      const item = state.recurring.find((entry) => entry.id === editRecurringId);
      const form = $("#recurringForm");
      for (const key of ["id", "name", "amount", "day", "method", "active"]) {
        if (form.elements[key]) form.elements[key].value = String(item[key]);
      }
      setView("recurring");
    }

    const deleteRecurringId = event.target.dataset.deleteRecurring;
    if (deleteRecurringId) {
      state.recurring = state.recurring.filter((entry) => entry.id !== deleteRecurringId);
      await persistAndRender("Recurrente borrado");
    }
  });

  $("#addPeriodButton").addEventListener("click", async () => {
    const last = state.periods.at(-1);
    state.periods.push({
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
    });
    await persistAndRender("Quincena agregada");
  });

  $("#resetSeedButton").addEventListener("click", async () => {
    if (!confirm("Esto reemplaza los datos actuales por una plantilla vacia. ¿Continuar?")) return;
    state = structuredClone(seedState);
    await persistAndRender("Plantilla restaurada");
  });

  $("#saveSnapshotButton").addEventListener("click", () => {
    downloadText(`plan-financiero-respaldo-${today}.json`, JSON.stringify(state, null, 2));
  });

  $("#exportJsonButton").addEventListener("click", () => {
    downloadText(`plan-financiero-${today}.json`, JSON.stringify(state, null, 2));
  });

  $("#exportCsvButton").addEventListener("click", () => {
    const rows = [["Mes", "Ingresos", "Gastos efectivo", "Pago TDC", "Flujo", "Ahorro cierre"]];
    for (const row of calcMonthly()) {
      rows.push([row.month, row.income, row.cashExpenses, row.cardPayment, row.flow, row.savings]);
    }
    downloadText(`reporte-mensual-${today}.csv`, toCsv(rows), "text/csv");
  });

  $$("[data-import-json]").forEach((input) => {
    input.addEventListener("change", async (event) => {
      try {
        await importStateFromFile(event.target);
      } catch (error) {
        console.error(error);
        showToast("No pude importar ese respaldo");
      }
    });
  });

  $("#saveSyncSettingsButton").addEventListener("click", async () => {
    state.sync = {
      endpoint: normalizeEndpoint($("#syncEndpoint").value.trim()),
      syncId: $("#syncId").value.trim(),
    };
    await persistAndRender("Sync guardado");
  });

  $("#testSyncButton").addEventListener("click", async () => {
    try {
      const endpoint = normalizeEndpoint($("#syncEndpoint").value.trim());
      if (!endpoint) throw new Error("Falta endpoint");
      const result = await fetchSync(`${endpoint}/api/health`);
      showToast(result?.ok ? "Backend conectado" : "Respuesta desconocida");
    } catch (error) {
      console.error(error);
      showToast(`Sync falló: ${error.message}`);
    }
  });

  $("#pushSyncButton").addEventListener("click", async () => {
    try {
      const { endpoint, syncId, passphrase } = getSyncInputs();
      state.sync = { endpoint, syncId };
      const payload = await encryptStateForSync(passphrase);
      await fetchSync(`${endpoint}/api/sync/${encodeURIComponent(syncId)}`, {
        method: "PUT",
        headers: { "X-Sync-Secret": await syncSecret(passphrase) },
        body: JSON.stringify({ payload }),
      });
      await persistAndRender("Respaldo cifrado subido");
    } catch (error) {
      console.error(error);
      showToast(`No pude subir: ${error.message}`);
    }
  });

  $("#pullSyncButton").addEventListener("click", async () => {
    try {
      const { endpoint, syncId, passphrase } = getSyncInputs();
      const result = await fetchSync(`${endpoint}/api/sync/${encodeURIComponent(syncId)}`, {
        headers: { "X-Sync-Secret": await syncSecret(passphrase) },
      });
      state = await decryptStateFromSync(result.payload, passphrase);
      state.sync = { endpoint, syncId };
      await persistAndRender("Respaldo cifrado descargado");
    } catch (error) {
      console.error(error);
      showToast(`No pude bajar: ${error.message}`);
    }
  });
}

function wireInstall() {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    $("#installButton").hidden = false;
  });
  $("#installButton").addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    $("#installButton").hidden = true;
  });
}

async function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    await navigator.serviceWorker.register("./sw.js");
  }
}

async function boot() {
  state = await loadState();
  $("#transactionForm").elements.date.value = today;
  wireNavigation();
  wireForms();
  wireActions();
  wireInstall();
  render();
  await registerServiceWorker();
}

if (typeof document !== "undefined") {
  boot().catch((error) => {
    console.error(error);
    showToast("No pude iniciar la app. Revisa la consola.");
  });
}
