/* Shellfish Tracker Service Worker (v-param driven)
   Goal: prevent mixed-cache deploys and the "Unexpected keyword 'class'" failure
   caused when HTML is served in place of JS.
*/
const SW_V = new URL(self.location.href).searchParams.get("v") || "0";
const CACHE_VERSION = `v${SW_V}`;
const CACHE_NAME = `shellfish-tracker-${CACHE_VERSION}`;

// Core assets. Keep this list short and stable.
const CORE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./legal/terms.html",
  "./legal/privacy.html",
  "./legal/license.html",
  `./js/bootstrap_v5.js?v=${SW_V}`,
  `./js/utils_v5.js?v=${SW_V}`,
  `./js/app_v5.js?v=${SW_V}`,
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
function looksLikeHTMLBytes(text) {
  const t = String(text || "").trimStart().toLowerCase();
  return t.startsWith("<!doctype") || t.startsWith("<html") || t.startsWith("<head") || t.startsWith("<body") || t.startsWith("<script") || t.startsWith("<");
}

async function guardedCachePut(cache, key, resp) {
  // For core JS files, do a tiny body sniff + marker check to avoid caching HTML or empty/truncated responses.
  try {
    const url = (typeof key === "string") ? key : (key && key.url) ? key.url : "";
    const isCore = /\/js\/(app_v5|utils_v5|bootstrap_v5)\.js/i.test(url);
    if (isCore) {
      const txt = await resp.clone().text();
      const head = txt.slice(0, 200);
      if (!txt) return false;
      if (looksLikeHTMLBytes(head)) return false;
      if (!head.includes("/*__SHELLFISH_CORE_JS__")) return false;
    }
    await cache.put(key, resp.clone());
    return true;
  } catch (_) {
    return false;
  }
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
        await guardedCachePut(cache, url, r);
      } catch (_) {}
    }
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    // Delete old caches
    const keys = await caches.keys();
    // Purge any prior Shellfish Tracker caches, keep only the current build cache.
    await Promise.all(keys.map((k) => (k.startsWith("shellfish-tracker-v") && k !== CACHE_NAME) ? caches.delete(k) : Promise.resolve()));

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

// Normalize core module URLs: if the app requests unversioned core JS, rewrite to this build's v-param.
// This prevents Safari/HTTP cache from re-serving stale bytes for ./js/app_v5.js or ./js/utils_v5.js.
const isCoreJS = (p) => p.endsWith("/js/app_v5.js") || p.endsWith("/js/utils_v5.js") || p.endsWith("/js/bootstrap_v5.js");
let req2 = req;
let url2 = url;
if (isCoreJS(url.pathname) && !url.searchParams.get("v")) {
  url2 = new URL(req.url);
  url2.searchParams.set("v", SW_V);
  req2 = new Request(url2.toString(), req);
}
  // Only handle same-origin
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);

    // HTML: network-first (so deploys update quickly), fallback to cache.
    if (isHTML(url.pathname) || req.mode === "navigate") {
      try {
        const net = await fetch(req2, { cache: "no-store" });
        if (net && net.ok) {
          await cache.put("./index.html", net.clone());
          return net;
        }
      } catch (_) {}
      const cached = await cache.match("./index.html");
      return cached || fetch(req);
    }

    // JS: network-first with strict guards to avoid caching HTML.
    if (isJS(url2.pathname)) {
      try {
        const net = await fetch(req2, { cache: "no-store" });
        if (net && net.ok && looksLikeJSResponse(net)) {
          await guardedCachePut(cache, req2, net);
          return net;
        }
      } catch (_) {}

      const cached = await cache.match(req2);
      if (cached) {
        // If cached JS is bad (HTML), purge and fail closed.
        if (!looksLikeJSResponse(cached)) {
          try { await cache.delete(req2); } catch (_) {}
          return fetch(req2, { cache: "no-store" });
        }
        return cached;
      }
      return fetch(req2, { cache: "no-store" });
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
