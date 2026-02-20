// Simple offline cache for Shellfish Tracker (v5)
const APP_VERSION = "v5";
const SW_V = new URL(self.location.href).searchParams.get("v") || "0";
const CACHE_VERSION = `v${SW_V}`;
const CACHE_NAME = `shellfish-tracker-${APP_VERSION}-${CACHE_VERSION}`;
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./js/app_v5.js",
  "./js/utils_v5.js",
  "./js/bootstrap_v5.js",
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

    // Guarded pre-cache: never store HTML in place of JS (common iOS/SW mixed-version failure mode).
    for (const url of CORE_ASSETS) {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res || !res.ok) continue;

        // If this is a JS asset, require a JS-like content-type.
        const isJs = typeof url === "string" && url.includes("/js/") && url.endsWith(".js");
        const ct = (res.headers.get("content-type") || "").toLowerCase();
        if (isJs && !(ct.includes("javascript") || ct.includes("ecmascript"))) {
          // Skip caching bad responses (usually index.html/404 HTML).
          continue;
        }

        await cache.put(url, res.clone());
      } catch (_) {}
    }

    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {, (event) => {
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

    const isJsReq = (url.pathname.includes("/js/") && url.pathname.endsWith(".js"));
    const cachedCt = cached ? ((cached.headers.get("content-type") || "").toLowerCase()) : "";
    const cachedLooksJs = cached ? (cachedCt.includes("javascript") || cachedCt.includes("ecmascript")) : false;

    const fetchAndCache = async () => {
      const fresh = await fetch(req);
      if (fresh && fresh.ok) {
        try { await cache.put(req, fresh.clone()); } catch (_) {}
      }
      return fresh;
    };

    
// Network-first for JS modules to avoid mixed-version crashes on iOS Safari.
if (isJsReq) {
  try {
    const reqNoCache = new Request(req, { cache: "no-store" });
    const fresh = await fetch(reqNoCache);
    if (fresh && fresh.ok) {
      const ct = (fresh.headers.get("content-type") || "").toLowerCase();
      const looksJs = ct.includes("javascript") || ct.includes("ecmascript");
      if (looksJs) {
        try { await cache.put(req, fresh.clone()); } catch (_) {}
        return fresh;
      }
      // If we got HTML here, do NOT cache it.
    }
  } catch (_) {}
  if (cached && cachedLooksJs) return cached;
  // purge any bad cached entry
  try { await cache.delete(req); } catch (_) {}
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

