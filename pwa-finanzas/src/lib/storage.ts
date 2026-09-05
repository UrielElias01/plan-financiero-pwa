import { cloneSeed } from "./seed";
import { normalizeState } from "./calculations";
import type { AppState } from "./types";
import { validateBackup } from "./validation";

const DB_NAME = "plan-financiero-pwa";
const DB_VERSION = 1;
const STORE = "state";
const STATE_KEY = "main";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error("Este navegador no permite guardar datos locales. Habilita el almacenamiento del sitio."));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    let blocked = false;
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => {
      const db = request.result;
      if (blocked) {
        db.close();
        return;
      }
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => reject(request.error || new Error("No se pudo abrir el almacenamiento local."));
    request.onblocked = () => {
      blocked = true;
      reject(new Error("Otra pestaña está bloqueando el almacenamiento. Ciérrala y vuelve a abrir la app."));
    };
  });
}

export async function loadState(): Promise<AppState> {
  const db = await openDb();
  try {
    const stored = await new Promise<unknown>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const request = tx.objectStore(STORE).get(STATE_KEY);
      // A successful request can still be rolled back. Resolve only when the transaction commits.
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error || request.error || new Error("No se pudieron leer los datos guardados."));
      tx.onabort = () => reject(tx.error || new Error("La lectura de los datos se interrumpió."));
    });
    return normalizeState(stored === undefined ? cloneSeed() : validateBackup(stored));
  } finally {
    db.close();
  }
}

export async function saveState(state: AppState): Promise<void> {
  validateBackup(state);
  const nextState = { ...state, updatedAt: new Date().toISOString() };
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("No se pudo guardar el cambio en este dispositivo."));
      tx.onabort = () => reject(tx.error || new Error("El guardado se interrumpió; el cambio no se confirmó."));
      tx.objectStore(STORE).put(nextState, STATE_KEY);
    });
  } finally {
    db.close();
  }
}
