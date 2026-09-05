import assert from "node:assert/strict";
import { validateBackup } from "../pwa-finanzas/src/lib/validation.ts";
import { readJsonFile } from "../pwa-finanzas/src/lib/files.ts";
import { loadState, saveState } from "../pwa-finanzas/src/lib/storage.ts";
import { cloneSeed } from "../pwa-finanzas/src/lib/seed.ts";

// Synthetic fixtures only. Never copy a personal backup into tracked tests.
const blank = () => ({
  version: 3,
  updatedAt: "2030-02-01T12:00:00.000Z",
  settings: { currentSavings: 0, salary: 0, cutoffDay: 10, dueDay: 25 },
  periods: [], recurring: [], transactions: [], cardCalendar: [],
});
const purchase = () => ({
  id: "purchase-a", date: "2030-02-01", periodId: "2030-02-h1",
  description: "Synthetic purchase", category: "Test", method: "credit", amount: 250,
  installments: 5, totalInstallments: 5, currentInstallment: 2, monthlyAmount: 50,
  nextPaymentMonth: "2030-03", shared: true, userAmount: 200,
});
function rejects(edit, pattern = /Respaldo inválido/) {
  const state = blank();
  state.transactions.push(purchase());
  edit(state);
  assert.throws(() => validateBackup(state), pattern);
}

for (const version of [1, 2, 3]) {
  const state = blank();
  state.version = version;
  state.periods.push({ id: "2030-02-h1", cardPayment: -25, rent: -50 });
  assert.equal(validateBackup(state), state, `preserve legitimate v${version} backups`);
}
assert.doesNotThrow(() => validateBackup(cloneSeed()));
assert.throws(() => validateBackup(null), /objeto/);
assert.throws(() => validateBackup([]), /objeto/);
rejects((state) => { state.version = 99; });
rejects((state) => { state.transactions = {}; });
rejects((state) => { state.transactions.push(purchase()); }, /duplicado/);
rejects((state) => { state.transactions[0].amount = "250"; });
rejects((state) => { state.transactions[0].amount = NaN; });
rejects((state) => { state.transactions[0].amount = Infinity; });
rejects((state) => { state.transactions[0].amount = -10; });
rejects((state) => { state.settings.salary = null; });
rejects((state) => { state.settings.cutoffDay = 32; });
rejects((state) => { state.transactions[0].date = "2030-02-30"; }, /inexistente/);
rejects((state) => { state.transactions[0].date = "0000-02-01"; }, /1900/);
rejects((state) => { state.transactions[0].nextPaymentMonth = "9999-12"; }, /2200/);
rejects((state) => { state.transactions[0].periodId = "2030-15-h1"; });
rejects((state) => { state.transactions[0].nextPaymentMonth = "2030-13"; });
rejects((state) => { state.transactions[0].totalInstallments = 1_000_000; });
rejects((state) => { state.transactions[0].totalInstallments = 5.5; });
rejects((state) => { state.transactions[0].currentInstallment = 6; });
rejects((state) => { state.transactions[0].installmentsAsOf = "2030-02-30"; });
rejects((state) => { state.transactions[0].installmentPaymentIds = "payment-a"; });
rejects((state) => { state.transactions[0].installmentPaymentIds = [123]; });
rejects((state) => { state.transactions[0].installmentPaymentIds = ["payment-a", "payment-a"]; }, /duplicados/);
rejects((state) => { state.transactions[0].userAmount = 251; });
rejects((state) => { state.transactions[0].method = "unknown"; });
rejects((state) => {
  const transaction = state.transactions[0];
  transaction.sourceRecurringId = "recurring-a";
  transaction.recurringDate = transaction.date;
  state.transactions.push({ ...transaction, id: "purchase-b" });
}, /duplica un cargo/);
rejects((state) => {
  state.recurring.push({ id: "recurring-a", name: "Synthetic", amount: 10, day: 1,
    method: "debit", active: true, startsOn: "2030-03-01", endsOn: "2030-02-01" });
}, /antes de su inicio/);
const file = (body) => ({ size: body.length, text: async () => body });
assert.deepEqual(await readJsonFile(file(JSON.stringify(blank()))), blank());
await assert.rejects(readJsonFile(file("{broken")), /JSON/);
await assert.rejects(readJsonFile({ size: 21 * 1024 * 1024, text: async () => "{}" }), /20 MB/);

// An IDB request succeeding is insufficient: aborts must remain failures, connections must close,
// and a malformed save must be rejected before a transaction can replace existing data.
let outcome = "complete";
let closes = 0;
let writes = 0;
let stored = undefined;
let readRequestSucceeded = false;
let saveSettled = false;
const originalIndexedDB = globalThis.indexedDB;
globalThis.indexedDB = {
  open() {
    const request = {};
    const db = {
      close() { closes += 1; },
      transaction() {
        const tx = {
          error: null,
          objectStore() {
            return {
              get() {
                const read = { result: stored };
                queueMicrotask(() => {
                  readRequestSucceeded = true;
                  read.onsuccess?.();
                  queueMicrotask(() => outcome === "abort" ? tx.onabort?.() : tx.oncomplete?.());
                });
                return read;
              },
              put() {
                writes += 1;
                queueMicrotask(() => {
                  assert.equal(saveSettled, false, "save cannot resolve before its transaction commits");
                  outcome === "abort" ? tx.onabort?.() : tx.oncomplete?.();
                });
              },
            };
          },
        };
        return tx;
      },
    };
    request.result = db;
    queueMicrotask(() => request.onsuccess());
    return request;
  },
};
try {
  const fresh = await loadState();
  assert.equal(readRequestSucceeded, true);
  assert.equal(fresh.transactions.length, 0);
  assert.equal(closes, 1);

  await saveState(fresh).then(() => { saveSettled = true; });
  assert.equal(writes, 1);
  assert.equal(closes, 2);

  saveSettled = false;
  outcome = "abort";
  await assert.rejects(saveState(fresh), /interrumpió/);
  await assert.rejects(loadState(), /interrumpió/);
  assert.equal(closes, 4, "aborted reads and writes must close their connection");

  const invalid = { ...fresh, transactions: [{ ...purchase(), amount: NaN }] };
  await assert.rejects(saveState(invalid), /Respaldo inválido/);
  assert.equal(writes, 2, "invalid state must not start a write");

  outcome = "complete";
  stored = { malformed: true };
  await assert.rejects(loadState(), /Respaldo inválido/);
  assert.equal(writes, 2, "corrupt stored data must not be silently replaced with a blank plan");
  assert.equal(closes, 5);
} finally {
  if (originalIndexedDB === undefined) delete globalThis.indexedDB;
  else globalThis.indexedDB = originalIndexedDB;
}

console.log("Backup validation and atomic storage checks passed.");
