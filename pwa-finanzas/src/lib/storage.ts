import { cloneSeed } from "./seed";
import { normalizeState } from "./calculations";
import type { AppState } from "./types";

const DB_NAME = "plan-financiero-pwa";
const DB_VERSION = 1;
const STORE = "state";
const STATE_KEY = "main";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadState(): Promise<AppState> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).get(STATE_KEY);
    request.onsuccess = () => resolve(normalizeState(request.result || cloneSeed()));
    request.onerror = () => reject(request.error);
  });
}

export async function saveState(state: AppState): Promise<void> {
  const nextState = { ...state, updatedAt: new Date().toISOString() };
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(nextState, STATE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
