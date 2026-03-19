export function createFeedbackHelpers({
  escapeHtml,
  lockBodyScroll,
  unlockBodyScroll,
  focusFirstFocusable
}){
  let toastTimer = null;
  let toastCleanupTimer = null;
  let ariaLiveTimer = null;
  const TOAST_EXIT_MS = 260;
  const MODAL_EXIT_MS = 220;

  const LS_INSTALL_PROMPTED = "btc-install_prompted_v1";
  let deferredInstallPrompt = null;

  const hapticPatterns = {
    light: [
      /saved/i,
      /copied/i,
      /copy success/i,
      /confirm/i,
      /undone/i
    ],
    medium: [
      /delete(d)?/i,
      /restore(d)?/i,
      /milestone/i,
      /backup (created|saved)/i
    ]
  };

  function finalizeToastCleanup(el){
    if(!el) return;
    clearTimeout(toastTimer);
    clearTimeout(toastCleanupTimer);
    el.classList.remove("show", "toastMilestone");
    el.textContent = "";
  }

  function resetToastState(el){
    if(!el) return;
    finalizeToastCleanup(el);
  }

  function hideToast(el, { immediate = false } = {}){
    if(!el) return;
    clearTimeout(toastTimer);
    clearTimeout(toastCleanupTimer);
    if(immediate){
      finalizeToastCleanup(el);
      return;
    }
    el.classList.remove("show");
    toastCleanupTimer = setTimeout(()=>{
      if(!el.classList.contains("show")) finalizeToastCleanup(el);
    }, TOAST_EXIT_MS);
  }

  function showToastElement(el){
    if(!el) return;
    requestAnimationFrame(()=>{ el.classList.add("show"); });
  }

  function animateModalOverlayIn(el){
    if(!el) return;
    requestAnimationFrame(()=>{ el.classList.add("is-visible"); });
  }

  function animateModalOverlayOut(el, onDone){
    if(!el){
      onDone && onDone();
      return;
    }
    el.classList.remove("is-visible");
    el.classList.add("is-closing");
    setTimeout(()=>{
      onDone && onDone();
    }, MODAL_EXIT_MS);
  }

  function supportsHaptics(){
    try{ return typeof navigator !== "undefined" && typeof navigator.vibrate === "function"; }catch(_){ return false; }
  }

  function triggerHaptic(level = "light"){
    try{
      if(!supportsHaptics()) return false;
      if(level === "medium"){
        navigator.vibrate([18, 24, 22]);
        return true;
      }
      navigator.vibrate(10);
      return true;
    }catch(_){
      return false;
    }
  }

  function detectToastHapticLevel(text){
    const msg = String(text || "").trim();
    if(!msg) return "none";
    if(hapticPatterns.medium.some((re)=>re.test(msg))) return "medium";
    if(hapticPatterns.light.some((re)=>re.test(msg))) return "light";
    return "none";
  }

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
      el.classList.remove("toastMilestone");
      const text = String(msg||"");
      const actionLabel = String(opts?.actionLabel || "").trim();
      const onAction = (typeof opts?.onAction === "function") ? opts.onAction : null;
      const durationMs = Number(opts?.durationMs);

      resetToastState(el);
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
          hideToast(el);
        }, { once: true });
        el.appendChild(btn);
      }

      const trimmed = text.trim();
      if(/^Saved$/i.test(trimmed)){
        announce("Saved", "polite");
      }else if(/(error|failed|invalid|missing)/i.test(trimmed)){
        announce(/^Error:/i.test(trimmed) ? trimmed : `Error: ${trimmed}`, "assertive");
      }
      const hapticLevel = String(opts?.haptic || "auto").toLowerCase();
      if(hapticLevel === "light" || hapticLevel === "medium") triggerHaptic(hapticLevel);
      else if(hapticLevel === "auto"){
        const detected = detectToastHapticLevel(trimmed);
        if(detected !== "none") triggerHaptic(detected);
      }
      showToastElement(el);
      toastTimer = setTimeout(()=>{ hideToast(el); }, Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 2400);
    }catch{}
  }

  function showMilestoneToast({ headline = "", detail = "", okLabel = "OK", durationMs = 0 } = {}){
    try{
      const el = document.getElementById("toast");
      if(!el) return;
      resetToastState(el);
      el.classList.add("toastMilestone");

      const content = document.createElement("div");
      content.className = "toastMilestoneContent";

      const titleNode = document.createElement("div");
      titleNode.className = "toastMilestoneTitle";
      titleNode.textContent = String(headline || "Milestone reached");
      content.appendChild(titleNode);

      if(String(detail || "").trim()){
        const detailNode = document.createElement("div");
        detailNode.className = "toastMilestoneDetail";
        detailNode.textContent = String(detail || "").trim();
        content.appendChild(detailNode);
      }

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "toastAction";
      btn.textContent = String(okLabel || "OK");
      btn.addEventListener("click", ()=>{
        hideToast(el);
      }, { once: true });

      el.appendChild(content);
      el.appendChild(btn);
      announce(titleNode.textContent, "polite");
      triggerHaptic("medium");
      showToastElement(el);
      if(Number.isFinite(durationMs) && durationMs > 0){
        toastTimer = setTimeout(()=>{ hideToast(el); }, durationMs);
      }
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

      let settled = false;
      const cleanup = (v)=>{
        if(settled) return;
        settled = true;
        el.removeEventListener("pointerdown", onBackdrop);
        el.removeEventListener("click", onBackdrop);
        animateModalOverlayOut(el, ()=>{
          unlockBodyScroll(el);
          try{ el.remove(); }catch(_){ }
          if(opener && document.contains(opener)){
            try{ opener.focus({ preventScroll: true }); }catch(_){ }
          }
          resolve(v);
        });
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
      animateModalOverlayIn(el);
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

      let settled = false;
      const cleanup = (v)=>{
        if(settled) return;
        settled = true;
        el.removeEventListener("pointerdown", onBackdrop);
        el.removeEventListener("click", onBackdrop);
        animateModalOverlayOut(el, ()=>{
          unlockBodyScroll(el);
          try{ el.remove(); }catch(_){ }
          if(opener && document.contains(opener)){
            try{ opener.focus({ preventScroll: true }); }catch(_){ }
          }
          resolve(v);
        });
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
      animateModalOverlayIn(el);
      focusFirstFocusable(el.querySelector(".modalCard"));

      el.querySelector("#m_cancel")?.addEventListener("click", ()=>cleanup(false));
      el.querySelector("#m_yes")?.addEventListener("click", ()=>{
        triggerHaptic("light");
        cleanup(true);
      });
    });
  }

  function copyTextToClipboard(txt){
    return navigator.clipboard?.writeText(String(txt||""))
      .then(()=>true).catch(()=>false);
  }

  async function copyTextWithFeedback(txt, successMsg = "Copied"){
    const ok = await copyTextToClipboard(txt);
    showToast(ok ? successMsg : "Copy failed", { haptic: ok ? "light" : "none" });
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
    showMilestoneToast,
    maybeOfferInstallAfterFirstSave,
    confirmSaveModal,
    copyTextWithFeedback,
    triggerHaptic
  };
}
