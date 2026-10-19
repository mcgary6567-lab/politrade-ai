// Hillradar service worker — the app shell and hashed assets are cached so the app opens without internet,
// and GET API responses are kept (network-first) so the last-loaded trades, politicians and dashboard stay
// readable offline. Writes (login, settings, watchlist) always need the network.
const SHELL = "hillradar-shell-v4";
const DATA = "hillradar-data-v4";
const DATA_MAX = 300;
const NEVER_CACHE = /^\/api\/(auth|admin|me\/telegram|me\/test|trades\.csv)/;
const SERVER_PAGES = /^\/(privacy|terms|disclaimer|contact|faq)(\/|$)/;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(["/", "/index.html", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"]).catch(() => {})).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== DATA).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("message", (e) => { if (e.data === "skipWaiting") self.skipWaiting(); });

// Store a clean copy: drop content-encoding/length so a Brotli/gzip response from the server is never
// re-decoded or truncated when replayed from the Cache API (the body we read is already decoded).
async function cachePut(cacheName, req, res) {
  try {
    const buf = await res.clone().arrayBuffer();
    const h = new Headers(res.headers);
    h.delete("content-encoding"); h.delete("content-length");
    const c = await caches.open(cacheName);
    await c.put(req, new Response(buf, { status: res.status, statusText: res.statusText, headers: h }));
    if (cacheName === DATA) trim(c);
  } catch { /* opaque / uncacheable — skip */ }
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || SERVER_PAGES.test(url.pathname) || NEVER_CACHE.test(url.pathname)) return;

  // API data: network first (fresh), fall back to the last copy when offline; keep the cache bounded
  if (url.pathname.startsWith("/api/")) {
    e.respondWith(fetch(req).then((res) => {
      if (res.ok) cachePut(DATA, req, res);
      return res;
    }).catch(async () => {
      const hit = await caches.match(req);
      if (hit) { const h = new Headers(hit.headers); h.set("x-offline", "1"); return new Response(hit.body, { status: hit.status, headers: h }); }
      return new Response(JSON.stringify({ error: "You are offline and this page was not loaded before." }), { status: 503, headers: { "content-type": "application/json" } });
    }));
    return;
  }
  // navigations: network first so updates arrive; cached shell when offline
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then((res) => { cachePut(SHELL, "/index.html", res); return res; })
      .catch(() => caches.match("/index.html")));
    return;
  }
  // hashed build assets, icons, photos: cache first
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
    if (res.ok && (url.pathname.startsWith("/assets/") || /\.(png|svg|jpg|webmanifest|woff2?)$/.test(url.pathname))) cachePut(SHELL, req, res);
    return res;
  })));
});

async function trim(cache) {
  const keys = await cache.keys();
  if (keys.length > DATA_MAX) for (const k of keys.slice(0, keys.length - DATA_MAX)) await cache.delete(k);
}
