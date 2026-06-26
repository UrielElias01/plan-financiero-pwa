export type PwaUpdateStatus = "unsupported" | "checking" | "current" | "available" | "activating" | "reloading" | "error";

type RegisterServiceWorkerOptions = {
  onRegistered?: (registration: ServiceWorkerRegistration) => void;
  onUpdateAvailable?: (registration: ServiceWorkerRegistration) => void;
};

function hasWaitingWorker(registration: ServiceWorkerRegistration): boolean {
  return Boolean(registration.waiting);
}

function watchForWaitingWorker(
  registration: ServiceWorkerRegistration,
  onUpdateAvailable?: (registration: ServiceWorkerRegistration) => void,
): void {
  if (hasWaitingWorker(registration)) {
    onUpdateAvailable?.(registration);
    return;
  }

  registration.addEventListener("updatefound", () => {
    const worker = registration.installing;
    if (!worker) return;

    worker.addEventListener("statechange", () => {
      if (worker.state === "installed" && navigator.serviceWorker.controller) {
        onUpdateAvailable?.(registration);
      }
    });
  });
}

function waitForInstallingWorker(registration: ServiceWorkerRegistration): Promise<void> {
  const worker = registration.installing;
  if (!worker || worker.state === "installed" || worker.state === "activated" || worker.state === "redundant") {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    worker.addEventListener("statechange", () => {
      if (worker.state === "installed" || worker.state === "activated" || worker.state === "redundant") resolve();
    });
  });
}

export async function registerServiceWorker(
  options: RegisterServiceWorkerOptions = {},
): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;

  const registration = await navigator.serviceWorker.register("./sw.js");
  options.onRegistered?.(registration);
  watchForWaitingWorker(registration, options.onUpdateAvailable);
  return registration;
}

export async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  return (await navigator.serviceWorker.getRegistration()) || null;
}

export async function checkForServiceWorkerUpdate(
  registration?: ServiceWorkerRegistration | null,
): Promise<ServiceWorkerRegistration | null> {
  const activeRegistration = registration || (await getServiceWorkerRegistration());
  if (!activeRegistration) return null;
  await activeRegistration.update();
  await waitForInstallingWorker(activeRegistration);
  return activeRegistration;
}

export function applyServiceWorkerUpdate(registration?: ServiceWorkerRegistration | null): boolean {
  const worker = registration?.waiting;
  if (!worker) return false;
  worker.postMessage({ type: "SKIP_WAITING" });
  return true;
}
