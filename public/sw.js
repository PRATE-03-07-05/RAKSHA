/* RAKSHA Service Worker — offline application shell.
 *
 * Responsibilities (deliberately narrow):
 *  - Cache the application shell (index + hashed static assets) so a
 *    previously loaded RAKSHA keeps opening after the network drops.
 *  - Network-first for navigations (always try the fresh shell, fall back to
 *    the cached one when offline).
 *  - Cache-first for same-origin immutable static assets.
 *
 * Safety rules:
 *  - ONLY same-origin GET requests are ever intercepted. The FastAPI backend
 *    (cross-origin, e.g. http://localhost:8000) is NEVER touched or cached —
 *    no JWTs, no medical data, no API responses enter this cache.
 *  - Opaque/failed responses are never stored.
 */
const CACHE = "raksha-shell-v1";

self.addEventListener("install", (event) => {
  // Seed the shell cache; "/" pulls in index.html and the hashed assets it
  // references are added at runtime as they are fetched.
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(["/"]).catch(() => undefined))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // never intercept writes

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never touch the API origin

  // Navigations: network-first so refreshes pick up new builds; the cached
  // shell answers when the device is offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put("/", copy)).catch(() => undefined);
          return res;
        })
        .catch(() =>
          caches.match("/").then((cached) => cached || Response.error())
        )
    );
    return;
  }

  // Static assets (hashed by the bundler → immutable): cache-first.
  event.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req).then((res) => {
          if (res.ok && (res.type === "basic" || res.type === "default")) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => undefined);
          }
          return res;
        })
    )
  );
});
