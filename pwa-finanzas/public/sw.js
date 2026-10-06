const CACHE_NAME = "plan-financiero-react-v22";
const APP_SHELL = [
  "./",
  "./index.html",
  "./assets/index.js",
  "./assets/style.css",
  "./manifest.webmanifest",
  "./icons/icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("plan-financiero-react-") && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

async function cacheFirstFallback(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  return caches.match("./index.html");
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return cacheFirstFallback(request);
  }
}

// Android "Compartir → Finanzas" (manifest share_target) posts the Mandado export here.
// The file waits in its own cache until the app opens and reads it; it is never sent anywhere.
const SHARE_CACHE = "plan-financiero-compartido";
const SHARED_FILE = "./compartido/mandado.json";

async function receiveSharedFile(request) {
  const target = new URL("./?compartido=mandado", self.registration.scope).href;
  try {
    const form = await request.formData();
    const file = form.getAll("archivo").find((entry) => entry && typeof entry.text === "function");
    if (!file || file.size > 5 * 1024 * 1024) return Response.redirect(new URL("./?compartido=error", self.registration.scope).href, 303);
    const cache = await caches.open(SHARE_CACHE);
    await cache.put(SHARED_FILE, new Response(await file.text(), { headers: { "Content-Type": "application/json" } }));
    return Response.redirect(target, 303);
  } catch {
    return Response.redirect(new URL("./?compartido=error", self.registration.scope).href, 303);
  }
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (event.request.method === "POST" && url.pathname.endsWith("/compartir-mandado")) {
    event.respondWith(receiveSharedFile(event.request));
    return;
  }
  if (event.request.method !== "GET") return;
  event.respondWith(networkFirst(event.request));
});
