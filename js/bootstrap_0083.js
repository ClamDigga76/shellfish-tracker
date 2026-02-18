/**
 * Bootstrap + watchdog + SW update UX.
 * Keeps CSP strict by avoiding inline scripts.
 */
const attachModuleErrorHandler = () => {
  const el = document.getElementById("appModule");
  if(!el) return;
  el.addEventListener("error", (event) => {
    if(window.__showModuleError) window.__showModuleError(event);
  });
};

// ---- boot pill + module error UI ----
const pill = document.getElementById("bootPill");
  const app = document.getElementById("app");

  // Make error handler available to non-module scripts if needed
  window.__showModuleError = function(err){
    try{
      if(pill){
        pill.textContent = "ERROR";
        pill.classList.add("err");
        pill.title = "Module error";
      }
      const msg =
        (err && (err.stack || err.message)) ? String(err.stack || err.message)
        : String(err || "Module import failed");
      try{ localStorage.setItem("shellfish-last-error", msg); }catch{}
      try{ localStorage.setItem("shellfish-last-error-at", new Date().toISOString()); }catch{}

      const esc = msg.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
      try{
        localStorage.setItem("shellfish-last-error", msg);
        localStorage.setItem("shellfish-last-error-at", new Date().toISOString());
      }catch(e){}

      app.innerHTML = `
        <div class="card">
          <b>Module failed to load.</b>
          <div class="sep"></div>
          <div class="muted small" style="white-space:pre-wrap">${esc}</div>
          <div class="row" style="margin-top:12px;gap:10px;flex-wrap:wrap">
            <button class="btn" id="copyErr">Copy</button>
            <button class="btn" id="reload">Reload</button>
            <button class="btn" id="resetCache">Reset Cache</button>
          </div>
        </div>
      `;

      const copyBtn = document.getElementById("copyErr");
      if(copyBtn){
        copyBtn.onclick = async ()=>{
          try{
            await navigator.clipboard.writeText(msg);
            copyBtn.textContent = "Copied";
            setTimeout(()=> copyBtn.textContent="Copy", 900);
          }catch(e){
            // fallback: select text
            const pre = document.createElement("textarea");
            pre.value = msg;
            pre.style.position="fixed";
            pre.style.left="-9999px";
            document.body.appendChild(pre);
            pre.select();
            document.execCommand("copy");
            document.body.removeChild(pre);
            copyBtn.textContent = "Copied";
            setTimeout(()=> copyBtn.textContent="Copy", 900);
          }
        };
      }

      const r = document.getElementById("reload");
      if(r) r.onclick = ()=> location.reload();

      const z = document.getElementById("resetCache");
      if(z) z.onclick = async ()=>{
        try{
          if("serviceWorker" in navigator){
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map(r=>r.unregister()));
          }
          if("caches" in window){
            const keys = await caches.keys();
            await Promise.all(keys.map(k=>caches.delete(k)));
          }
        }catch(e){}
        location.reload();
      };
    }catch(e){
      console.error("Error rendering module error UI", e);
    }
    console.error(err);
  };

    // Boot watchdog: if the module never starts (common with stale SW caches), show recovery UI.
  window.__BOOT_WATCHDOG__ = setTimeout(()=>{
    try{
      if(!window.__SHELLFISH_APP_STARTED){
        const errMsg = (function(){
          try{ return localStorage.getItem("shellfish-last-error") || localStorage.getItem("SHELLFISH_LAST_ERROR") || "App did not start (possible cached/stale JS)."; }catch(_){ return "App did not start (possible cached/stale JS)."; }
        })();
        window.__showModuleError({message: errMsg});
      }
    }catch(e){}
  }, 4000);

// Load the app module (direct src, avoids dynamic import syntax issues on some Safari builds).

// ---- watchdog ----
// Watchdog: if the module doesn't start, show a helpful error card.
    window.__SHELLFISH_STARTED = false;
    window.__SHELLFISH_BOOT_AT = Date.now();
    setTimeout(function(){
      if(window.__SHELLFISH_STARTED) return;
      try{
        const msg = "App did not start. This usually means the JS module failed to load (cached old files or a network error). Tap Reset Cache then Reload.

If it still fails: open Safari Settings → Advanced → Website Data → delete this site, then reload.";
        if(window.__showModuleError) window.__showModuleError(new Error(msg));
        else console.error(msg);
      }catch(e){}
    }, 1800);

// ---- service worker UX ----
// PWA offline support + deterministic update UX (RC)
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", async () => {
      try {
        const swUrl = "./sw.js?v=41";
        const reg = await navigator.serviceWorker.register(swUrl, { updateViaCache: "none" });

        
        await reg.update();
const banner = document.getElementById("swUpdateBanner");
        const btnApply = document.getElementById("swUpdateApply");
        const btnDismiss = document.getElementById("swUpdateDismiss");

        const showBanner = () => { if (banner) banner.style.display = "block"; };
        const hideBanner = () => { if (banner) banner.style.display = "none"; };

        if (btnDismiss) btnDismiss.onclick = hideBanner;

        if (btnApply) {
          btnApply.onclick = async () => {
            try {
              const waiting = reg.waiting;
              if (waiting) waiting.postMessage({ type: "SKIP_WAITING" });
            } catch (_) {}
          };
        }

        // If there's already a waiting worker, prompt immediately.
        if (reg.waiting) showBanner();

        // When a new SW is found, prompt once it's installed (and we already have a controller).
        reg.addEventListener("updatefound", () => {
          const nw = reg.installing;
          if (!nw) return;
          nw.addEventListener("statechange", () => {
            if (nw.state === "installed" && navigator.serviceWorker.controller) showBanner();
          });
        });

        // Once the new SW takes control, reload to get fresh assets.
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          window.location.reload();
        });
      } catch (_) {}
    });
  }

attachModuleErrorHandler();
