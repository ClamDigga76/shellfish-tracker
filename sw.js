/* Bank the Catch service worker (v-param driven)
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
  "./js/utils_v5.js?v="+SW_V,
  "./js/settings.js?v="+SW_V,
  "./js/migrations_v5.js?v="+SW_V,
  "./js/navigation_v5.js?v="+SW_V,
  "./js/reports_charts_v5.js?v="+SW_V,
  "./js/reports_aggregation_v5.js?v="+SW_V,
  "./js/reports_seasonality_v5.js?v="+SW_V,
  "./js/reports_compare_foundations_v5.js?v="+SW_V,
  "./js/quick_chips_v5.js?v="+SW_V,
  "./js/reports_filters_v5.js?v="+SW_V,
  "./js/settings_list_management_v5.js?v="+SW_V,
  "./js/backup_restore_v5.js?v="+SW_V,
  "./js/trip_shared_engine_v5.js?v="+SW_V,
  "./js/trip_cards_v5.js?v="+SW_V,
  "./js/help_about_render_v5.js?v="+SW_V,
  "./js/trip_form_render_v5.js?v="+SW_V,
  "./js/home_dashboard_v5.js?v="+SW_V,
  "./js/settings_screen_v5.js?v="+SW_V,
  "./js/reports_screen_v5.js?v="+SW_V,
  "./js/reports_advanced_panel_v5.js?v="+SW_V,
  "./js/reports_highlights_v5.js?v="+SW_V,
  "./js/trip_card_renderer_core_v5.js?v="+SW_V,
  "./js/feedback_seam_v5.js?v="+SW_V,
  "./js/trip_screen_orchestrator_v5.js?v="+SW_V,
  "./js/update_runtime_status_v5.js?v="+SW_V,
  "./js/diagnostics_fatal_v5.js?v="+SW_V,
  "./js/app_shell_v5.js?v="+SW_V,
  "./js/trip_flow_save_seam_v5.js?v="+SW_V,
  "./js/unified_filters_seam_v5.js?v="+SW_V,
  "./js/root_state_save_seam_v5.js?v="+SW_V,
  "./js/runtime_orchestration_seam_v5.js?v="+SW_V,
  "./js/top_level_navigation_transition_seam_v5.js?v="+SW_V,
  "./js/app_v5.js?v="+SW_V,
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
    // Purge prior app caches that use the legacy shellfish-tracker prefix; keep only the current build cache.
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

  // Only handle same-origin
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);

    // HTML: network-first (so deploys update quickly), fallback to cache.
    if (isHTML(url.pathname) || req.mode === "navigate") {
      try {
        const net = await fetch(req, { cache: "no-store" });
        if (net && net.ok) {
          const previousIndex = await cache.match("./index.html");
          await cache.put("./index.html", net.clone());
          if (previousIndex && previousIndex.url && previousIndex.url !== net.url) {
            try { await cache.delete(previousIndex.url); } catch (_) {}
          }
          return net;
        }
      } catch (_) {}
      const cached = await cache.match("./index.html");
      return cached || fetch(req, { cache: "no-store" });
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
