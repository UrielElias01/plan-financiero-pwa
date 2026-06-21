export async function registerServiceWorker(): Promise<void> {
  if ("serviceWorker" in navigator) {
    await navigator.serviceWorker.register("./sw.js");
  }
}
