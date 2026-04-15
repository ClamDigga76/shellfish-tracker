import { APP_ENTRY_MODULE_PATH, BOOTSTRAP_REQUIRED_ASSET_PATHS, BOOTSTRAP_SANITY_REFERENCE_PATHS, SW_REGISTRATION_PATH, buildVersionedAssetHref, buildVersionedAssetHrefList, buildVersionedPath } from "./startup_asset_manifest_v5.js";

const BOOTSTRAP_URL = new URL(import.meta.url, location.href);
const APP_VERSION = BOOTSTRAP_URL.searchParams.get("v") || "0";
const SAFE_MODE_PARAM = "safeMode";
const SAFE_MODE_SESSION_KEY = "shellfish-safe-mode-session";
const LAST_GOOD_RUNTIME_KEY = "shellfish-last-good-runtime-v1";

// Single source of truth for build/version
window.APP_VERSION = APP_VERSION;
window.APP_BUILD = `v5.${APP_VERSION}`;
window.__SHELLFISH_SAFE_MODE__ =
  BOOTSTRAP_URL.searchParams.get(SAFE_MODE_PARAM) === "1" ||
  (() => {
    try {
      return sessionStorage.getItem(SAFE_MODE_SESSION_KEY) === "1";
    } catch (_) {
      return false;
    }
  })();
/**
 * Bank the Catch v5 bootstrap
 *
 * Responsibilities:
 * - Verify critical assets are reachable (helps catch bad deploys / broken caches)
 * - Register the service worker and show the update banner
 * - Provide a recovery UI when the app module fails to parse/load or never starts
 */
async function __assertAssetExists(path) {
  // Record fetch diagnostics for Copy Debug.
  try {
    window.__BOOT_DIAG__ = window.__BOOT_DIAG__ || { stage: "bootstrap:start", assetChecks: [] };
  } catch (_) {}

  let r;
  try {
    r = await fetch(path, { cache: "no-store" });
  } catch (e) {
    try {
      window.__BOOT_DIAG__.assetChecks.push({ url: String(path), ok: false, status: 0, contentType: "", note: "fetch failed" });
    } catch (_) {}
    throw new Error(`Failed to fetch required asset: ${path} (${e?.message || "network error"})`);
  }

  const ct0 = (r.headers.get("content-type") || "").toLowerCase();
  try {
    window.__BOOT_DIAG__.assetChecks.push({ url: String(path), ok: !!r.ok, status: r.status, contentType: ct0 });
  } catch (_) {}

  if (!r.ok) throw new Error(`Missing required asset: ${path} (HTTP ${r.status})`);

  let requestedUrl;
  let responseUrl;
  try {
    requestedUrl = new URL(String(path), location.href);
    responseUrl = new URL(String(r.url || path), location.href);
  } catch (_) {}

  if (r.redirected) {
    throw new Error(`Unexpected redirect for required asset: ${path}. Try Reset Cache.`);
  }

  if (requestedUrl && responseUrl) {
    if (requestedUrl.pathname !== responseUrl.pathname) {
      throw new Error(`Wrong required asset returned for ${path}. Try Reset Cache.`);
    }
    const reqV = requestedUrl.searchParams.get("v");
    const resV = responseUrl.searchParams.get("v");
    if (reqV && resV !== reqV) {
      throw new Error(`Stale required asset response for ${path} (expected v=${reqV}). Try Reset Cache.`);
    }
  }

  // Accept v-param'd JS URLs
  if (/\.js($|\?)/i.test(path)) {
    const ct = ct0;
    if (!(ct.includes("javascript") || ct.includes("ecmascript"))) {
      throw new Error(`Bad content-type for ${path}: ${ct || "unknown"} (expected JavaScript). Try Reset Cache.`);
    }

    // Body sniff: catch corrupted/garbled cached responses that still claim JS content-type.
    // (Valid JS in this app typically starts with "const", "import", or a block comment.)
    const txt = await r.clone().text();
    const trimmed = (txt || "").trim();
    if (!trimmed) {
      throw new Error(`Empty JS response for ${path}. Try Reset Cache.`);
    }
    if (trimmed.length < 24) {
      throw new Error(`Incomplete JS response for ${path} (${trimmed.length} bytes). Try Reset Cache.`);
    }
    const head = (txt || "").trimStart().slice(0, 64);
    if (head.startsWith("<") || head.startsWith(")") || head.startsWith("]") || head.startsWith("}")) {
      throw new Error(`Corrupted JS response for ${path} (starts with: ${head.slice(0, 12)}). Try Reset Cache.`);
    }
    const sniff = trimmed.slice(0, 512);
    if (!/(^|\s)(import|export|const|let|var|function|class)\b/.test(sniff)) {
      throw new Error(`Unexpected JS payload for ${path}. Try Reset Cache.`);
    }
  }
}

function detectLegacyStateKey() {
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
window.__SHELLFISH_LAST_GOOD_RUNTIME_KEY__ = LAST_GOOD_RUNTIME_KEY;

window.__recordLastGoodRuntimeConfirmation = function recordLastGoodRuntimeConfirmation() {
  try {
    const standalone =
      (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
    const payload = {
      buildVersion: String(window.APP_BUILD || `v5.${APP_VERSION}`),
      confirmedAt: new Date().toISOString(),
      mode: standalone ? "installed-standalone" : "browser",
      swControllerPresent: !!navigator.serviceWorker?.controller,
    };
    localStorage.setItem(LAST_GOOD_RUNTIME_KEY, JSON.stringify(payload));
    window.__LAST_GOOD_RUNTIME_CONFIRMATION__ = payload;
    return payload;
  } catch (_) {
    return null;
  }
};

// Boot diagnostics (Copy Debug). Keep this small + structured; do NOT dump user data.
window.__BOOT_DIAG__ = window.__BOOT_DIAG__ || {
  stage: "bootstrap:init",
  assetChecks: [],
  lastBootError: null,
};
window.__BOOT_DIAG__.swRegistration = window.__BOOT_DIAG__.swRegistration || {
  attempted: false,
  registered: false,
  scope: "",
  activeScriptURL: "",
  waitingScriptURL: "",
  controllerPresentAtRegistration: false,
  lastError: "",
};

const STARTUP_REFERENCE_SANITY = [
  ...BOOTSTRAP_SANITY_REFERENCE_PATHS.map((path) => buildVersionedPath(path, "${APP_VERSION}")),
];

function __assertBootstrapVersionChain() {
  try {
    const bootstrapUrl = new URL(import.meta.url, location.href);
    const scriptV = bootstrapUrl.searchParams.get("v");
    if (!scriptV) return;
    if (String(scriptV) !== String(APP_VERSION)) {
      throw new Error(
        `Bootstrap version mismatch: script v=${scriptV}, runtime v=${APP_VERSION}. Bump index.html bootstrap ?v and APP_VERSION together.`
      );
    }
  } catch (err) {
    try {
      window.__BOOT_DIAG__.lastBootError = {
        name: err?.name || "Error",
        message: String(err?.message || err || "Unknown error"),
        stackTop: String(err?.stack || "").split("\n").slice(0, 3).join("\n"),
      };
    } catch (_) {}
    throw err;
  }
}

function __setBootStage(stage) {
  try {
    window.__BOOT_DIAG__.stage = stage;
  } catch (_) {}
}

function dispatchVersionedWindowEvent(name, detail = {}) {
  try {
    window.dispatchEvent(new CustomEvent(String(name || ""), { detail: { ...detail, version: APP_VERSION } }));
  } catch (_) {}
}

function updateSwRegistrationDiag(next = {}) {
  try {
    const base = window.__BOOT_DIAG__.swRegistration || {};
    window.__BOOT_DIAG__.swRegistration = {
      attempted: base.attempted === true,
      registered: base.registered === true,
      scope: String(base.scope || ""),
      activeScriptURL: String(base.activeScriptURL || ""),
      waitingScriptURL: String(base.waitingScriptURL || ""),
      controllerPresentAtRegistration: base.controllerPresentAtRegistration === true,
      lastError: String(base.lastError || ""),
      ...next,
    };
  } catch (_) {}
}

function wireServiceWorkerUpdateBanner(reg) {
  const banner = document.getElementById("swUpdateBanner");
  let __swUpdateReadyNotified = false;
  const btnApply = document.getElementById("swUpdateApply");
  const btnDismiss = document.getElementById("swUpdateDismiss");
  const bannerMsg = banner?.querySelector?.(".swUpdateBannerMessage");

  const emitSwUpdateState = (state) => {
    dispatchVersionedWindowEvent("sw-update-state", { state: String(state || "") });
  };

  const showBanner = () => {
    if (!banner) return;
    banner.style.display = "block";
    banner.dataset.state = "ready";
    if (bannerMsg) {
      bannerMsg.textContent = `Build v5.${APP_VERSION} is ready on this device. Load it now to avoid staying on an older runtime.`;
    }
    emitSwUpdateState("ready");
    if (!__swUpdateReadyNotified) {
      __swUpdateReadyNotified = true;
      try {
        window.dispatchEvent(new CustomEvent("sw-update-ready", { detail: { version: APP_VERSION } }));
      } catch (_) {}
    }
  };

  const hideBanner = () => {
    if (!banner) return;
    banner.style.display = "none";
    delete banner.dataset.state;
  };

  if (btnDismiss) btnDismiss.onclick = () => {
    emitSwUpdateState("dismissed");
    hideBanner();
  };

  if (btnApply) {
    btnApply.onclick = async () => {
      emitSwUpdateState("applying");
      try {
        if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
      } catch (_) {}
      hideBanner();
      // Reload once when the new SW takes control (avoids reload loops on iOS).
      let reloaded = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (reloaded) return;
        reloaded = true;
        emitSwUpdateState("controller-changed");
        location.reload();
      });
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
}

// Exposed so asset checks + global handlers can show a friendly recovery screen.
window.__showModuleError = function (err) {
  try {
    __setBootStage("bootstrap:error");
    try {
      window.__BOOT_DIAG__.lastBootError = {
        name: err?.name || "Error",
        message: String(err?.message || err || "Unknown error"),
        stackTop: String(err?.stack || "").split("\n").slice(0, 3).join("\n"),
      };
    } catch (_) {}

    let app = document.getElementById("app");
    const pill = document.getElementById("bootPill");

    if (pill) pill.style.display = "none";

    const msg =
      err && (err.stack || err.message)
        ? String(err.stack || err.message)
        : String(err || "Unknown error");

    const diag = {
      at: new Date().toISOString(),
      build: window.__SHELLFISH_BUILD__ || "unknown",
      boot: {
        stage: window.__BOOT_DIAG__?.stage || null,
        lastBootError: window.__BOOT_DIAG__?.lastBootError || null,
        assetChecks: Array.isArray(window.__BOOT_DIAG__?.assetChecks) ? window.__BOOT_DIAG__.assetChecks : [],
      },
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
        // Optional: storage estimate can help diagnose iOS eviction / quota issues.
        try {
          if (navigator.storage?.estimate) {
            const est = await navigator.storage.estimate();
            diag.storageEstimate = {
              usage: typeof est?.usage === "number" ? Math.round(est.usage) : null,
              quota: typeof est?.quota === "number" ? Math.round(est.quota) : null,
            };
          }
        } catch (_) {}

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
            const lsKey = detectLegacyStateKey();
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

    if (!app) {
      // Fail loud: if #app is missing (HTML damage), still render recovery UI into body.
      const wrap = document.createElement("div");
      wrap.id = "app";
      wrap.style.maxWidth = "720px";
      wrap.style.margin = "24px auto";
      wrap.style.padding = "0 14px";
      document.body.innerHTML = "";
      document.body.appendChild(wrap);
      app = wrap;
    }

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
            <button class="btn" id="copyErr">Copy diagnostics</button>
            <button class="btn good" id="reload">Reload now</button>
            <button class="btn" id="safeMode">Open Recovery Mode</button>
            <button class="btn" id="resetCache">Reset Cache & Reload</button>
          </div>
          <div class="muted small" style="margin-top:8px">Reload now tries the latest hosted build. Reset Cache & Reload is the stronger recovery step when files look stale or mismatched. Recovery Mode starts with a temporary clean session and does not erase trips.</div>
        </div>
      `;

      const copyBtn = document.getElementById("copyErr");
      if (copyBtn) {
        copyBtn.onclick = async () => {
          try {
            const payload = copyBtn.dataset.payload || msg;
            await navigator.clipboard.writeText(payload);
            copyBtn.textContent = "Copied";
            setTimeout(() => (copyBtn.textContent = "Copy diagnostics"), 900);
          } catch (_) {
            copyBtn.textContent = "Copy failed";
            setTimeout(() => (copyBtn.textContent = "Copy diagnostics"), 1200);
          }
        };
      }

      const reloadBtn = document.getElementById("reload");
      if (reloadBtn) reloadBtn.onclick = () => location.reload();

      const safeModeBtn = document.getElementById("safeMode");
      if (safeModeBtn) {
        safeModeBtn.onclick = () => {
          try {
            sessionStorage.setItem(SAFE_MODE_SESSION_KEY, "1");
          } catch (_) {}

          try {
            const nextUrl = new URL(location.href);
            nextUrl.searchParams.set(SAFE_MODE_PARAM, "1");
            location.assign(nextUrl.toString());
          } catch (_) {
            location.reload();
          }
        };
      }

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

// Proactively surface broken deploys / missing files, then load the app module here so we can
// surface real import/parse errors (404, HTML-as-JS, syntax errors) instead of only the watchdog.
(async () => {
  try {
    __assertBootstrapVersionChain();
    __setBootStage("assets:checking");
    // Assert and import using absolute URLs derived from this module's location.
    // (Avoids "./js/..." resolving to "/js/js/..." when bootstrap lives in /js/.)
    const requiredAssetUrls = buildVersionedAssetHrefList(BOOTSTRAP_REQUIRED_ASSET_PATHS, APP_VERSION, import.meta.url);
    const APP_URL = buildVersionedAssetHref(APP_ENTRY_MODULE_PATH, APP_VERSION, import.meta.url);

    for (const url of requiredAssetUrls) {
      await __assertAssetExists(url);
    }
    __setBootStage("app:importing");
    await import(APP_URL);
    __setBootStage("app:imported");
  } catch (e) {
    if (typeof window.__showModuleError === "function") window.__showModuleError(e);
    else console.error(e);
  }
})();

// Boot watchdog: if the app never flips the started flag, show recovery UI.
window.__BOOT_WATCHDOG__ = setTimeout(() => {
  try {
    if (window.__SHELLFISH_APP_STARTED) return;
    __setBootStage("watchdog:timeout");
    const msg =
      "App did not start. This usually means the JS module failed to load (cached old files or a network error). " +
      "Tap Reset Cache then Reload.\n\n" +
      "If it still fails on iPhone/iPad: Settings → Safari → Advanced → Website Data → remove this site, then reload.";
    window.__showModuleError(new Error(msg));
  } catch (_) {}
}, 4000);

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    dispatchVersionedWindowEvent("sw-registration-state", { state: "unsupported" });
    return;
  }

  const emitSwRegistrationState = (state, details = {}) => {
    dispatchVersionedWindowEvent("sw-registration-state", { state: String(state || ""), ...details });
  };

  try {
    __setBootStage("sw:registering");
    updateSwRegistrationDiag({ attempted: true, lastError: "" });
    emitSwRegistrationState("attempted", { controllerPresent: !!navigator.serviceWorker?.controller });
    const swUrl = buildVersionedPath(SW_REGISTRATION_PATH, APP_VERSION);
    const reg = await navigator.serviceWorker.register(swUrl, { updateViaCache: "none" });
    __setBootStage("sw:registered");
    updateSwRegistrationDiag({
      registered: true,
      scope: String(reg?.scope || ""),
      activeScriptURL: String(reg?.active?.scriptURL || ""),
      waitingScriptURL: String(reg?.waiting?.scriptURL || ""),
      controllerPresentAtRegistration: !!navigator.serviceWorker?.controller,
      lastError: "",
    });
    emitSwRegistrationState("registered", {
      scope: String(reg?.scope || ""),
      controllerPresent: !!navigator.serviceWorker?.controller,
      activeScriptURL: String(reg?.active?.scriptURL || ""),
      waitingScriptURL: String(reg?.waiting?.scriptURL || ""),
    });
    try {
      await reg.update();
    } catch (_) {}
    wireServiceWorkerUpdateBanner(reg);
  } catch (err) {
    updateSwRegistrationDiag({
      registered: false,
      scope: "",
      activeScriptURL: "",
      waitingScriptURL: "",
      controllerPresentAtRegistration: !!navigator.serviceWorker?.controller,
      lastError: String(err?.message || err || "Unknown service worker registration error"),
    });
    emitSwRegistrationState("error", { message: String(err?.message || err || "Unknown service worker registration error") });
  }
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
