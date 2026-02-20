const SW_VERSION = "12";
/**
 * Shellfish Tracker v5 bootstrap
 *
 * Responsibilities:
 * - Verify critical assets are reachable (helps catch bad deploys / broken caches)
 * - Register the service worker and show the update banner
 * - Provide a recovery UI when the app module fails to parse/load or never starts
 */
async function __assertAssetExists(path) {
  const r = await fetch(path, { cache: "no-store" });
  if (!r.ok) throw new Error(`Missing required asset: ${path} (HTTP ${r.status})`);

  // Guard: if a JS file is accidentally served HTML (common with bad SW caches),
  // fail fast with a clear error instead of a cryptic parse error like: Unexpected keyword 'class'.
  if (/\.js$/i.test(path)) {
    const ct = (r.headers.get("content-type") || "").toLowerCase();
    if (!(ct.includes("javascript") || ct.includes("ecmascript"))) {
      throw new Error(`Bad content-type for ${path}: ${ct || "unknown"} (expected JavaScript). Try Reset Cache.`);
    }
  }
}

function detectShellfishStateKey() {
  const canonical = "shellfish-state";
  try {
    if (localStorage.getItem(canonical)) return canonical;
  } catch {}

  try {
    let best = null;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      const m = /^shellfish-v(\d+)\.(\d+)\.(\d+)$/.exec(k || "");
      if (!m) continue;

      const v = [Number(m[1]), Number(m[2]), Number(m[3])];
      const isNewer =
        !best ||
        v[0] > best.v[0] ||
        (v[0] === best.v[0] && v[1] > best.v[1]) ||
        (v[0] === best.v[0] && v[1] === best.v[1] && v[2] > best.v[2]);

      if (isNewer) best = { key: k, v };
    }
    return best?.key || "shellfish-v1.5.0";
  } catch {
    return "shellfish-v1.5.0";
  }
}

const BOOT_BUILD = "v5";
window.__SHELLFISH_BUILD__ = window.__SHELLFISH_BUILD__ || BOOT_BUILD;
window.__SHELLFISH_BOOT_AT = Date.now();
window.__SHELLFISH_APP_STARTED = Boolean(window.__SHELLFISH_APP_STARTED);

// Exposed so asset checks + global handlers can show a friendly recovery screen.
window.__showModuleError = function (err) {
  try {
    const app = document.getElementById("app");
    const pill = document.getElementById("bootPill");

    if (pill) pill.style.display = "none";

    const msg =
      err && (err.stack || err.message)
        ? String(err.stack || err.message)
        : String(err || "Unknown error");

    const diag = {
      at: new Date().toISOString(),
      build: window.__SHELLFISH_BUILD__ || "unknown",
      url: location.href,
      referrer: document.referrer || "",
      ua: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      viewport: { w: innerWidth, h: innerHeight, dpr: window.devicePixelRatio || 1 },
      storage: { localStorage: false },
      sw: { supported: "serviceWorker" in navigator, controller: !!navigator.serviceWorker?.controller },
      cacheKeys: [],
    };

    try {
      const k = "__ls_probe__";
      localStorage.setItem(k, "1");
      localStorage.removeItem(k);
      diag.storage.localStorage = true;
    } catch (_) {}

    (async () => {
      try {
        if ("serviceWorker" in navigator) {
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg) {
            diag.sw = {
              supported: true,
              controller: !!navigator.serviceWorker.controller,
              scope: reg.scope,
              activeScriptURL: reg.active?.scriptURL || null,
              installing: !!reg.installing,
              waiting: !!reg.waiting,
            };
          }
        }

        if ("caches" in window) {
          diag.cacheKeys = await caches.keys();
        }

        if (diag.storage.localStorage) {
          try {
            const lsKey = detectShellfishStateKey();
            diag.stateKeyUsed = lsKey;
            const raw = localStorage.getItem(lsKey);
            if (raw) {
              const s = JSON.parse(raw);
              diag.state = {
                view: s?.view || null,
                tripsLen: Array.isArray(s?.trips) ? s.trips.length : null,
                navStackLen: Array.isArray(s?.navStack) ? s.navStack.length : null,
                filter: s?.filter || null,
                fontScale: s?.settings?.fontScale ?? null,
              };
            }
          } catch (_) {}
        }

        const diagBox = document.getElementById("diagBox");
        if (diagBox) diagBox.textContent = JSON.stringify({ error: msg, diag }, null, 2);
        const copyBtn = document.getElementById("copyErr");
        if (copyBtn) copyBtn.dataset.payload = JSON.stringify({ error: msg, diag }, null, 2);
      } catch (_) {}
    })();

    const esc = msg
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");

    if (app) {
      app.innerHTML = `
        <div class="card">
          <b>Module failed to load.</b>
          <div class="sep"></div>
          <div class="muted small" style="white-space:pre-wrap">${esc}</div>

          <div class="sep"></div>
          <details class="small muted">
            <summary>Diagnostics</summary>
            <pre id="diagBox" style="white-space:pre-wrap;margin-top:8px"></pre>
          </details>

          <div class="row" style="margin-top:12px;gap:10px;flex-wrap:wrap">
            <button class="btn" id="copyErr">Copy debug</button>
            <button class="btn good" id="reload">Reload</button>
            <button class="btn" id="resetCache">Reset Cache</button>
          </div>
        </div>
      `;

      const copyBtn = document.getElementById("copyErr");
      if (copyBtn) {
        copyBtn.onclick = async () => {
          try {
            const payload = copyBtn.dataset.payload || msg;
            await navigator.clipboard.writeText(payload);
            copyBtn.textContent = "Copied";
            setTimeout(() => (copyBtn.textContent = "Copy debug"), 900);
          } catch (_) {
            copyBtn.textContent = "Copy failed";
            setTimeout(() => (copyBtn.textContent = "Copy debug"), 1200);
          }
        };
      }

      const reloadBtn = document.getElementById("reload");
      if (reloadBtn) reloadBtn.onclick = () => location.reload();

      const resetBtn = document.getElementById("resetCache");
      if (resetBtn) {
        resetBtn.onclick = async () => {
          try {
            if ("serviceWorker" in navigator) {
              const regs = await navigator.serviceWorker.getRegistrations();
              await Promise.all(regs.map((r) => r.unregister()));
            }
            if ("caches" in window) {
              const keys = await caches.keys();
              await Promise.all(keys.map((k) => caches.delete(k)));
            }
          } catch (_) {}
          location.reload();
        };
      }
    }
  } catch (e) {
    console.error("Error rendering module error UI", e);
  }
  console.error(err);
};

// Proactively surface broken deploys / missing files.
(async () => {
  try {
    await __assertAssetExists("./js/utils_v5.js");
    await __assertAssetExists("./js/app_v5.js");
  } catch (e) {
    if (typeof window.__showModuleError === "function") window.__showModuleError(e);
    else console.error(e);
  }
})();

// Boot watchdog: if the app never flips the started flag, show recovery UI.
window.__BOOT_WATCHDOG__ = setTimeout(() => {
  try {
    if (window.__SHELLFISH_APP_STARTED) return;
    const msg =
      "App did not start. This usually means the JS module failed to load (cached old files or a network error). " +
      "Tap Reset Cache then Reload.\n\n" +
      "If it still fails on iPhone/iPad: Settings → Safari → Advanced → Website Data → remove this site, then reload.";
    window.__showModuleError(new Error(msg));
  } catch (_) {}
}, 4000);

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  try {
    const swUrl = `./sw.js?v=${SW_VERSION}`;
    const reg = await navigator.serviceWorker.register(swUrl, { updateViaCache: "none" });
    try {
      await reg.update();
    } catch (_) {}

    const banner = document.getElementById("swUpdateBanner");
    const btnApply = document.getElementById("swUpdateApply");
    const btnDismiss = document.getElementById("swUpdateDismiss");

    const showBanner = () => {
      if (!banner) return;
      banner.style.display = "block";
    };

    const hideBanner = () => {
      if (!banner) return;
      banner.style.display = "none";
    };

    if (btnDismiss) btnDismiss.onclick = hideBanner;

    if (btnApply) {
      btnApply.onclick = async () => {
        try {
          if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
        } catch (_) {}
        hideBanner();
        location.reload();
      };
    }

    const maybePrompt = () => {
      if (reg.waiting) showBanner();
    };

    maybePrompt();

    reg.addEventListener("updatefound", () => {
      const installing = reg.installing;
      if (!installing) return;
      installing.addEventListener("statechange", () => {
        if (installing.state === "installed" && navigator.serviceWorker.controller) {
          maybePrompt();
        }
      });
    });
  } catch (_) {}
}

window.addEventListener("load", () => {
  registerServiceWorker().catch(() => {});
});

window.addEventListener("error", (ev) => {
  if (window.__showModuleError) window.__showModuleError(ev?.error || ev);
});

window.addEventListener("unhandledrejection", (ev) => {
  if (window.__showModuleError) window.__showModuleError(ev?.reason || ev);
});
