import type { AppState } from "./types";

type RecordValue = Record<string, unknown>;

const MAX_ITEMS = 100_000;
const MAX_MONEY = 1_000_000_000_000;

function invalid(path: string, reason: string): never {
  throw new Error(`Respaldo inválido: ${path} ${reason}. No se modificaron tus datos.`);
}

function record(value: unknown, path: string): RecordValue {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid(path, "debe ser un objeto");
  return value as RecordValue;
}

function list(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value) || value.length > MAX_ITEMS) invalid(path, "debe ser una lista de tamaño válido");
  return value;
}

function text(value: unknown, path: string, allowEmpty = false): asserts value is string {
  if (typeof value !== "string" || (!allowEmpty && !value.trim()) || value.length > 20_000) {
    invalid(path, "debe contener texto válido");
  }
}

function amount(value: unknown, path: string, negative = false): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) > MAX_MONEY || (!negative && value < 0)) {
    invalid(path, "debe ser un importe numérico finito dentro del rango permitido");
  }
}

function integer(value: unknown, path: string, min: number, max: number): asserts value is number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    invalid(path, `debe ser un entero entre ${min} y ${max}`);
  }
}

function date(value: unknown, path: string): asserts value is string {
  text(value, path);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) invalid(path, "debe tener formato AAAA-MM-DD");
  month(value.slice(0, 7), path);
  const parsed = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) invalid(path, "contiene una fecha inexistente");
}

function month(value: unknown, path: string): void {
  text(value, path);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value) || Number(value.slice(0, 4)) < 1900 || Number(value.slice(0, 4)) > 2200) invalid(path, "debe ser un mes AAAA-MM entre 1900 y 2200");
}

function periodId(value: unknown, path: string): void {
  text(value, path);
  if (!/^\d{4}-(0[1-9]|1[0-2])-h[12]$/.test(value)) invalid(path, "debe identificar una quincena válida");
  month(value.slice(0, 7), path);
}

function optional(value: RecordValue, key: string, path: string, check: (value: unknown, path: string) => void): void {
  if (value[key] !== undefined) check(value[key], `${path}.${key}`);
}

function boolean(value: unknown, path: string): void {
  if (typeof value !== "boolean") invalid(path, "debe ser verdadero o falso");
}

function timestamp(value: unknown, path: string): void {
  text(value, path);
  if (!Number.isFinite(Date.parse(value))) invalid(path, "debe contener una fecha válida");
}

function uniqueRows(value: unknown, path: string, check: (row: RecordValue, path: string) => void): void {
  const ids = new Set<string>();
  list(value, path).forEach((entry, index) => {
    const rowPath = `${path}[${index + 1}]`;
    const row = record(entry, rowPath);
    text(row.id, `${rowPath}.id`);
    if (ids.has(row.id)) invalid(`${rowPath}.id`, "está duplicado");
    ids.add(row.id);
    check(row, rowPath);
  });
}

function ownership(row: RecordValue, path: string): void {
  optional(row, "shared", path, boolean);
  optional(row, "userAmount", path, amount);
  if (typeof row.userAmount === "number" && typeof row.amount === "number" && row.userAmount > row.amount) {
    invalid(`${path}.userAmount`, "no puede superar el importe total");
  }
}

function calendar(value: unknown, path: string): void {
  list(value, path).forEach((entry, index) => {
    const rowPath = `${path}[${index + 1}]`;
    const row = record(entry, rowPath);
    text(row.month, `${rowPath}.month`);
    for (const key of ["total", "userPart", "debt"]) amount(row[key], `${rowPath}.${key}`);
    for (const key of ["monthKey", "paymentMonth"]) optional(row, key, rowPath, month);
  });
}

/** Validate before migration so malformed data cannot be coerced into a plausible balance. */
export function validateBackup(input: unknown): Partial<AppState> {
  const state = record(input, "archivo");
  optional(state, "version", "archivo", (value, path) => integer(value, path, 1, 3));
  optional(state, "updatedAt", "archivo", timestamp);
  optional(state, "recurringLastAppliedDate", "archivo", date);
  const settings = record(state.settings, "settings");
  for (const key of ["currentSavings", "openingSavings", "openingRentReserve", "rentReserve"]) {
    optional(settings, key, "settings", (value, path) => amount(value, path, true));
  }
  for (const key of ["salary", "monthlyRent", "defaultFood", "chatGpt", "previousCardDebt", "previousCardPayment", "pointsPayment", "newJulyPurchases", "nonRecurringBalance", "usedCreditBalance", "openingCardDebt"]) {
    optional(settings, key, "settings", amount);
  }
  for (const key of ["cutoffDay", "dueDay"]) optional(settings, key, "settings", (value, path) => integer(value, path, 1, 31));
  optional(settings, "openingCardPaymentMonth", "settings", month);

  uniqueRows(state.periods, "periods", (row, path) => {
    periodId(row.id, `${path}.id`);
    for (const key of ["month", "label", "note"]) optional(row, key, path, (value, location) => text(value, location, true));
    // Older backups store projected expenses and card payments with a negative sign.
    for (const key of ["salary", "extraIncome", "partnerIncome", "rent", "debitServices", "foodCredit", "otherCredit", "chatGptCredit", "cardPayment", "appliedIncome", "appliedRentReserve"]) optional(row, key, path, (value, location) => amount(value, location, true));
    optional(row, "closingSavings", path, (value, location) => amount(value, location, true));
    optional(row, "lockedBase", path, boolean);
    optional(row, "closedAt", path, timestamp);
  });

  uniqueRows(state.recurring, "recurring", (row, path) => {
    text(row.name, `${path}.name`);
    amount(row.amount, `${path}.amount`);
    integer(row.day, `${path}.day`, 1, 31);
    if (row.method !== "debit" && row.method !== "credit") invalid(`${path}.method`, "no es un medio de pago reconocido");
    boolean(row.active, `${path}.active`);
    ownership(row, path);
    optional(row, "startsOn", path, date);
    optional(row, "endsOn", path, date);
    if (typeof row.startsOn === "string" && typeof row.endsOn === "string" && row.endsOn < row.startsOn) invalid(path, "termina antes de su inicio");
  });

  const recurringOccurrences = new Set<string>();
  uniqueRows(state.transactions, "transactions", (row, path) => {
    date(row.date, `${path}.date`);
    amount(row.amount, `${path}.amount`);
    periodId(row.periodId, `${path}.periodId`);
    for (const key of ["description", "category"]) optional(row, key, path, (value, location) => text(value, location, true));
    if (!["income", "credit", "cash", "card_payment"].includes(row.method as string)) invalid(`${path}.method`, "no es un tipo de movimiento reconocido");
    ownership(row, path);
    for (const key of ["installments", "totalInstallments"]) optional(row, key, path, (value, location) => integer(value, location, 1, 120));
    const total = Number(row.totalInstallments ?? row.installments ?? 1);
    optional(row, "currentInstallment", path, (value, location) => integer(value, location, 0, total));
    optional(row, "installmentsAsOf", path, date);
    if (row.installmentPaymentIds !== undefined) {
      const ids = new Set<string>();
      list(row.installmentPaymentIds, `${path}.installmentPaymentIds`).forEach((value) => {
        text(value, `${path}.installmentPaymentIds`);
        if (ids.has(value)) invalid(`${path}.installmentPaymentIds`, "contiene IDs duplicados");
        ids.add(value);
      });
    }
    optional(row, "monthlyAmount", path, amount);
    optional(row, "nextPaymentMonth", path, month);
    optional(row, "paymentForPeriodId", path, periodId);
    optional(row, "rentReserveAmount", path, amount);
    for (const key of ["skipPlanImpact", "affectsSavings"]) optional(row, key, path, boolean);
    optional(row, "sourceRecurringId", path, text);
    optional(row, "recurringDate", path, date);
    if (row.sourceRecurringId && row.recurringDate) {
      const key = JSON.stringify([row.sourceRecurringId, row.recurringDate]);
      if (recurringOccurrences.has(key)) invalid(path, "duplica un cargo de suscripción en la misma fecha");
      recurringOccurrences.add(key);
    }
    if (row.paymentSchedule !== undefined) list(row.paymentSchedule, `${path}.paymentSchedule`).forEach((entry, index) => {
      const location = `${path}.paymentSchedule[${index + 1}]`;
      const payment = record(entry, location);
      periodId(payment.periodId, `${location}.periodId`);
      amount(payment.amount, `${location}.amount`);
      optional(payment, "total", location, amount);
      optional(payment, "userAmount", location, amount);
      optional(payment, "dueDate", location, date);
      optional(payment, "monthKey", location, month);
      for (const key of ["installment", "totalInstallments"]) optional(payment, key, location, (value, entryPath) => integer(value, entryPath, 1, 120));
    });
  });

  optional(state, "cardCalendar", "archivo", calendar);
  if (state.sync !== undefined) {
    const sync = record(state.sync, "sync");
    for (const key of ["endpoint", "syncId"]) optional(sync, key, "sync", (value, path) => text(value, path, true));
  }
  if (state.migrationWarnings !== undefined) list(state.migrationWarnings, "migrationWarnings").forEach((value) => text(value, "migrationWarnings"));
  if (state.legacySnapshot !== undefined) {
    const snapshot = record(state.legacySnapshot, "legacySnapshot");
    calendar(snapshot.cardCalendar, "legacySnapshot.cardCalendar");
    list(snapshot.periodPayments, "legacySnapshot.periodPayments").forEach((entry) => {
      const payment = record(entry, "legacySnapshot.periodPayments");
      periodId(payment.periodId, "legacySnapshot.periodPayments.periodId");
      amount(payment.amount, "legacySnapshot.periodPayments.amount", true);
    });
  }
  return input as Partial<AppState>;
}
