export function createFeedbackHelpers({
  escapeHtml,
  lockBodyScroll,
  unlockBodyScroll,
  focusFirstFocusable
}){
  let toastTimer = null;
  let ariaLiveTimer = null;
  const LS_INSTALL_PROMPTED = "btc-install_prompted_v1";
  let deferredInstallPrompt = null;

  function announce(msg, mode = "polite"){
    try{
      const el = document.getElementById("ariaLive");
      if(!el) return;
      const nextMode = (mode === "assertive") ? "assertive" : "polite";
      const text = String(msg || "").trim();
      el.setAttribute("aria-live", nextMode);
      el.textContent = "";
      clearTimeout(ariaLiveTimer);
      ariaLiveTimer = setTimeout(()=>{ el.textContent = text; }, 30);
    }catch{}
  }

  function showToast(msg, opts = {}){
    try{
      const el = document.getElementById("toast");
      if(!el) return;
      const text = String(msg||"");
      const actionLabel = String(opts?.actionLabel || "").trim();
      const onAction = (typeof opts?.onAction === "function") ? opts.onAction : null;
      const durationMs = Number(opts?.durationMs);

      clearTimeout(toastTimer);
      el.textContent = "";
      const textNode = document.createElement("span");
      textNode.className = "toastText";
      textNode.textContent = text;
      el.appendChild(textNode);

      if(actionLabel && onAction){
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "toastAction";
        btn.textContent = actionLabel;
        btn.addEventListener("click", ()=>{
          try{ onAction(); }catch(_){ }
          clearTimeout(toastTimer);
          el.classList.remove("show");
        }, { once: true });
        el.appendChild(btn);
      }

      const trimmed = text.trim();
      if(/^Saved$/i.test(trimmed)){
        announce("Saved", "polite");
      }else if(/(error|failed|invalid|missing)/i.test(trimmed)){
        announce(/^Error:/i.test(trimmed) ? trimmed : `Error: ${trimmed}`, "assertive");
      }
      el.classList.add("show");
      toastTimer = setTimeout(()=>{ el.classList.remove("show"); }, Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 2400);
    }catch{}
  }

  function isStandaloneMode(){
    try{
      return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || (navigator.standalone === true);
    }catch(_){
      return false;
    }
  }

  function isIOS(){
    try{
      return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    }catch(_){
      return false;
    }
  }

  function hasPromptedInstall(){
    try{ return localStorage.getItem(LS_INSTALL_PROMPTED) === "1"; }catch(_){ return false; }
  }

  function markPromptedInstall(){
    try{ localStorage.setItem(LS_INSTALL_PROMPTED, "1"); }catch(_){ }
  }

  function installModal({ title, body, primaryText="Install", onPrimary }){
    return new Promise((resolve)=>{
      const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const el = document.createElement("div");
      el.className = "modalOverlay";
      el.innerHTML = `
        <div class="modalCard card" role="dialog" aria-modal="true">
          <b>${escapeHtml(title||"Install")}</b>
          ${body ? `<div class="muted small mt8 lh135 preWrap">${escapeHtml(body)}</div>` : ""}
          <div class="row mt14 gap10 jcEnd wrap">
            <button class="btn" id="im_cancel" type="button">Not now</button>
            <button class="btn primary" id="im_yes" type="button">${escapeHtml(primaryText)}</button>
          </div>
        </div>
      `;

      const cleanup = (v)=>{
        el.removeEventListener("pointerdown", onBackdrop);
        el.removeEventListener("click", onBackdrop);
        unlockBodyScroll(el);
        try{ el.remove(); }catch(_){ }
        if(opener && document.contains(opener)){
          try{ opener.focus({ preventScroll: true }); }catch(_){ }
        }
        resolve(v);
      };

      const onBackdrop = (e)=>{
        if(e.target !== el) return;
        e.preventDefault();
        e.stopPropagation();
        cleanup(false);
      };

      el.addEventListener("pointerdown", onBackdrop);
      el.addEventListener("click", onBackdrop);
      document.body.appendChild(el);
      lockBodyScroll(el);
      focusFirstFocusable(el.querySelector(".modalCard"));

      el.querySelector("#im_cancel")?.addEventListener("click", ()=>cleanup(false));
      el.querySelector("#im_yes")?.addEventListener("click", async ()=>{
        try{
          if(onPrimary) await onPrimary();
        }catch(_){ }
        cleanup(true);
      });
    });
  }

  async function maybeOfferInstallAfterFirstSave(){
    try{
      if(isStandaloneMode()) return;
      if(hasPromptedInstall()) return;

      markPromptedInstall();

      const title = "Install Bank the Catch?";
      const benefits = "Installing keeps it on your Home Screen and works better offline at the shore.";

      if(deferredInstallPrompt){
        await installModal({
          title,
          body: benefits,
          primaryText: "Install",
          onPrimary: async ()=>{
            try{
              deferredInstallPrompt.prompt();
              const choice = await deferredInstallPrompt.userChoice;
              deferredInstallPrompt = null;
              if(choice && choice.outcome === "accepted"){
                try{ showToast("Installing…"); }catch(_){ }
              }else{
                try{ showToast("No worries — you can install later"); }catch(_){ }
              }
            }catch(_){ }
          }
        });
        return;
      }

      if(isIOS()){
        const iosBody = benefits + "\n\nOn iPhone/iPad:\n1) Tap Share (square + arrow)\n2) Choose “Add to Home Screen”\n3) Tap Add";
        await installModal({
          title,
          body: iosBody,
          primaryText: "Got it",
          onPrimary: async ()=>{}
        });
      }
    }catch(_){ }
  }

  function confirmSaveModal({ title="Save this trip?", body="" } = {}){
    return new Promise((resolve)=>{
      const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const el = document.createElement("div");
      el.className = "modalOverlay";
      el.innerHTML = `
        <div class="modalCard card" role="dialog" aria-modal="true">
          <b>${escapeHtml(title)}</b>
          ${body ? `<div class="muted small mt8 preWrap">${escapeHtml(body)}</div>` : ""}
          <div class="row mt14 gap10 jcEnd">
            <button class="btn" id="m_cancel" type="button">Cancel</button>
            <button class="btn primary" id="m_yes" type="button">Yes, Save</button>
          </div>
        </div>
      `;

      const cleanup = (v)=>{
        el.removeEventListener("pointerdown", onBackdrop);
        el.removeEventListener("click", onBackdrop);
        unlockBodyScroll(el);
        try{ el.remove(); }catch(_){ }
        if(opener && document.contains(opener)){
          try{ opener.focus({ preventScroll: true }); }catch(_){ }
        }
        resolve(v);
      };

      const onBackdrop = (e)=>{
        if(e.target !== el) return;
        e.preventDefault();
        e.stopPropagation();
        cleanup(false);
      };

      el.addEventListener("pointerdown", onBackdrop);
      el.addEventListener("click", onBackdrop);
      document.body.appendChild(el);
      lockBodyScroll(el);
      focusFirstFocusable(el.querySelector(".modalCard"));

      el.querySelector("#m_cancel")?.addEventListener("click", ()=>cleanup(false));
      el.querySelector("#m_yes")?.addEventListener("click", ()=>cleanup(true));
    });
  }

  function copyTextToClipboard(txt){
    return navigator.clipboard?.writeText(String(txt||""))
      .then(()=>true).catch(()=>false);
  }

  async function copyTextWithFeedback(txt, successMsg = "Copied"){
    const ok = await copyTextToClipboard(txt);
    showToast(ok ? successMsg : "Copy failed");
    if(ok){
      try{ navigator.vibrate?.(10); }catch(_){ }
    }
    return ok;
  }

  window.addEventListener("beforeinstallprompt", (e)=>{
    try{
      e.preventDefault();
      deferredInstallPrompt = e;
    }catch(_){ }
  });

  window.addEventListener("appinstalled", ()=>{
    markPromptedInstall();
    try{ showToast("Installed ✓"); }catch(_){ }
  });

  return {
    announce,
    showToast,
    maybeOfferInstallAfterFirstSave,
    confirmSaveModal,
    copyTextWithFeedback
  };
}
