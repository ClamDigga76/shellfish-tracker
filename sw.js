/* Shellfish Tracker Service Worker (v-param driven)
   Goal: prevent mixed-cache deploys and the "Unexpected keyword 'class'" failure
   caused when HTML is served in place of JS.
*/
const SW_V = new URL(self.location.href).searchParams.get("v") || "0";
const CACHE_VERSION = `v${SW_V}`;
const CACHE_NAME = `shellfish-tracker-v5-${CACHE_VERSION}`;

// Core assets. Keep this list short and stable.
const CORE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./js/bootstrap_v5.js",
  "./js/utils_v5.js",
  "./js/app_v5.js",
];

function isJS(url) {
  return /\.js($|\?)/i.test(url);
}
function isHTML(url) {
  return /(^\.\/($|index\.html$))|\/($|index\.html$)/i.test(url) || /\.html($|\?)/i.test(url);
}
function looksLikeJSResponse(resp) {
  const ct = (resp.headers.get("content-type") || "").toLowerCase();
  return ct.includes("javascript") || ct.includes("ecmascript");
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    // Install with guards: never cache HTML as JS.
    for (const url of CORE) {
      try {
        const r = await fetch(url, { cache: "no-store" });
        if (!r.ok) continue;

        if (isJS(url) && !looksLikeJSResponse(r)) {
          // Skip caching bad response; this prevents JS parse errors later.
          continue;
        }
        await cache.put(url, r);
      } catch (_) {}
    }
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    // Delete old caches
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k.startsWith("shellfish-tracker-v5-") && k !== CACHE_NAME) ? caches.delete(k) : Promise.resolve()));

    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event?.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Only handle same-origin
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);

    // HTML: network-first (so deploys update quickly), fallback to cache.
    if (isHTML(url.pathname) || req.mode === "navigate") {
      try {
        const net = await fetch(req, { cache: "no-store" });
        if (net && net.ok) {
          await cache.put("./index.html", net.clone());
          return net;
        }
      } catch (_) {}
      const cached = await cache.match("./index.html");
      return cached || fetch(req);
    }

    // JS: network-first with strict guards to avoid caching HTML.
    if (isJS(url.pathname)) {
      try {
        const net = await fetch(req, { cache: "no-store" });
        if (net && net.ok && looksLikeJSResponse(net)) {
          await cache.put(req, net.clone());
          return net;
        }
      } catch (_) {}

      const cached = await cache.match(req);
      if (cached) {
        // If cached JS is bad (HTML), purge and fail closed.
        if (!looksLikeJSResponse(cached)) {
          try { await cache.delete(req); } catch (_) {}
          return fetch(req, { cache: "no-store" });
        }
        return cached;
      }
      return fetch(req, { cache: "no-store" });
    }

    // Other static assets: cache-first, then network.
    const cached = await cache.match(req);
    if (cached) return cached;

    try {
      const net = await fetch(req);
      if (net && net.ok) await cache.put(req, net.clone());
      return net;
    } catch (_) {
      return cached || Response.error();
    }
  })());
});
