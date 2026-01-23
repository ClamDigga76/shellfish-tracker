// Simple offline cache for Shellfish Tracker (RC)
const APP_VERSION = "ESM-0083-RC1.1";
const CACHE_VERSION = "v28";
const CACHE_NAME = `shellfish-tracker-${APP_VERSION}-${CACHE_VERSION}`;
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./js/app_0083.js",
  "./js/utils_0083.js",
  "./icons/favicon-32.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-512-maskable.png",
  "./icons/icon-180.png"
];


self.addEventListener("message", (event) => {
  if (event?.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(CORE_ASSETS);
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k === CACHE_NAME) ? null : caches.delete(k)));
    self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (!req || req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req);

    const fetchAndCache = async () => {
      const fresh = await fetch(req);
      if (fresh && fresh.ok) {
        try { await cache.put(req, fresh.clone()); } catch (_) {}
      }
      return fresh;
    };

    
// Network-first for JS modules to avoid mixed-version crashes on iOS Safari.
if (url.pathname.includes("/js/") && url.pathname.endsWith(".js")) {
  try {
    const reqNoCache = new Request(req, { cache: "no-store" });
    const fresh = await fetch(reqNoCache);
    if (fresh && fresh.ok) {
      try { await cache.put(req, fresh.clone()); } catch (_) {}
      return fresh;
    }
  } catch (_) {}
  if (cached) return cached;
  return Response.error();
}

// Prefer fresh HTML for navigations; fall back to cache when offline.
    if (req.mode === "navigate") {
      try {
        return await fetchAndCache();
      } catch (_) {
        return cached || (await cache.match("./index.html")) || Response.error();
      }
    }

    // Stale-while-revalidate for other same-origin assets.
    if (cached) {
      event.waitUntil(fetchAndCache().catch(() => {}));
      return cached;
    }

    try {
      return await fetchAndCache();
    } catch (_) {
      return cached || Response.error();
    }
  })());
});

