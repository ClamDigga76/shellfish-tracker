export function createFeedbackHelpers({
  escapeHtml,
  lockBodyScroll,
  unlockBodyScroll,
  focusFirstFocusable
}){
  let toastTimer = null;
  let toastCleanupTimer = null;
  let toastShowFrame = 0;
  let celebrationTimer = null;
  let ariaLiveTimer = null;
  let ariaLiveClearTimer = null;
  let celebrationViewportCleanup = null;
  let celebrationLayoutFrame = 0;
  let celebrationFocusReturn = null;
  let celebrationKeydownHandler = null;
  let dialogIdSeed = 0;
  let lastAnnouncementText = "";
  let lastAnnouncementMode = "polite";
  let lastAnnouncementAt = 0;
  const TOAST_EXIT_MS = 260;
  const MODAL_EXIT_MS = 240;

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

  function clearCelebrationViewport(el){
    if(celebrationViewportCleanup){
      try{ celebrationViewportCleanup(); }catch(_){ }
      celebrationViewportCleanup = null;
    }
    if(celebrationLayoutFrame){
      try{ cancelAnimationFrame(celebrationLayoutFrame); }catch(_){ }
      celebrationLayoutFrame = 0;
    }
    if(!el) return;
    el.style.left = "";
    el.style.top = "";
    el.style.bottom = "";
    el.style.width = "";
    el.style.maxWidth = "";
    el.style.maxHeight = "";
    try{ el.scrollTop = 0; }catch(_){ }
  }

  function bindCelebrationViewport(el){
    clearCelebrationViewport(el);
    if(!el || typeof window === "undefined") return;

    const clamp = (value, min, max)=>Math.min(Math.max(value, min), max);
    const scheduleLayout = ()=>{
      if(celebrationLayoutFrame) return;
      celebrationLayoutFrame = requestAnimationFrame(()=>{
        celebrationLayoutFrame = 0;
        if(!el.isConnected) return;
        const vv = window.visualViewport;
        const viewportWidth = Math.max(0, vv?.width || window.innerWidth || document.documentElement.clientWidth || 0);
        const viewportHeight = Math.max(0, vv?.height || window.innerHeight || document.documentElement.clientHeight || 0);
        const offsetLeft = Math.max(0, vv?.offsetLeft || 0);
        const offsetTop = Math.max(0, vv?.offsetTop || 0);
        const sideInset = 12;
        const verticalInset = 16;
        const maxWidth = Math.max(220, viewportWidth - (sideInset * 2));
        const maxHeight = Math.max(160, viewportHeight - (verticalInset * 2));

        el.style.left = `${offsetLeft + (viewportWidth / 2)}px`;
        el.style.top = `${offsetTop + (viewportHeight / 2)}px`;
        el.style.bottom = "auto";
        el.style.width = `${Math.min(420, maxWidth)}px`;
        el.style.maxWidth = `${maxWidth}px`;
        el.style.maxHeight = `${maxHeight}px`;

        const rect = el.getBoundingClientRect();
        const minCenterX = offsetLeft + sideInset + (rect.width / 2);
        const maxCenterX = offsetLeft + viewportWidth - sideInset - (rect.width / 2);
        const minCenterY = offsetTop + verticalInset + (rect.height / 2);
        const maxCenterY = offsetTop + viewportHeight - verticalInset - (rect.height / 2);

        el.style.left = `${clamp(offsetLeft + (viewportWidth / 2), minCenterX, Math.max(minCenterX, maxCenterX))}px`;
        el.style.top = `${clamp(offsetTop + (viewportHeight / 2), minCenterY, Math.max(minCenterY, maxCenterY))}px`;
      });
    };

    const vv = window.visualViewport;
    if(vv && vv.addEventListener){
      vv.addEventListener("resize", scheduleLayout);
      vv.addEventListener("scroll", scheduleLayout);
    }
    window.addEventListener("resize", scheduleLayout);
    window.addEventListener("orientationchange", scheduleLayout);
    celebrationViewportCleanup = ()=>{
      if(vv && vv.removeEventListener){
        vv.removeEventListener("resize", scheduleLayout);
        vv.removeEventListener("scroll", scheduleLayout);
      }
      window.removeEventListener("resize", scheduleLayout);
      window.removeEventListener("orientationchange", scheduleLayout);
    };
    scheduleLayout();
  }

  function finalizeToastCleanup(el){
    if(!el) return;
    clearToastTimers();
    el.classList.remove("show");
    el.textContent = "";
  }

  function clearToastTimers(){
    clearTimeout(toastTimer);
    clearTimeout(toastCleanupTimer);
    if(toastShowFrame){
      try{ cancelAnimationFrame(toastShowFrame); }catch(_){ }
      toastShowFrame = 0;
    }
    toastTimer = null;
    toastCleanupTimer = null;
  }

  function hardResetToastShell(el){
    if(!el) return;
    clearToastTimers();
    el.classList.remove("show", "milestoneToast", "toastMilestone", "toast--milestone");
    try{ el.replaceChildren(); }catch(_){ el.textContent = ""; }
    el.removeAttribute("role");
    el.removeAttribute("aria-live");
    el.removeAttribute("aria-atomic");
  }

  function resetToastState(el){
    if(!el) return;
    finalizeToastCleanup(el);
  }

  function hideToast(el, { immediate = false } = {}){
    if(!el) return;
    clearToastTimers();
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
    clearTimeout(toastTimer);
    clearTimeout(toastCleanupTimer);
    toastTimer = null;
    toastCleanupTimer = null;
    if(toastShowFrame){
      try{ cancelAnimationFrame(toastShowFrame); }catch(_){ }
      toastShowFrame = 0;
    }
    toastShowFrame = requestAnimationFrame(()=>{
      toastShowFrame = 0;
      el.classList.add("show");
    });
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

  function buildDialogIds(prefix = "dialog"){
    dialogIdSeed += 1;
    return {
      titleId: `${prefix}_title_${dialogIdSeed}`,
      bodyId: `${prefix}_body_${dialogIdSeed}`
    };
  }

  function getFocusableElements(root){
    if(!root) return [];
    return Array.from(root.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter((el)=> el instanceof HTMLElement && !el.hasAttribute("disabled") && !el.getAttribute("aria-hidden"));
  }

  function trapDialogFocus(dialog, event){
    if(!dialog) return;
    if(event.key !== "Tab") return;
    const focusables = getFocusableElements(dialog);
    if(!focusables.length){
      event.preventDefault();
      try{ dialog.focus({ preventScroll: true }); }catch(_){ }
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if(event.shiftKey && active === first){
      event.preventDefault();
      try{ last.focus({ preventScroll: true }); }catch(_){ }
      return;
    }
    if(!event.shiftKey && active === last){
      event.preventDefault();
      try{ first.focus({ preventScroll: true }); }catch(_){ }
    }
  }

  function restoreFocus(opener){
    if(opener && document.contains(opener)){
      try{
        opener.focus({ preventScroll: true });
        return;
      }catch(_){ }
    }
    try{ focusFirstFocusable(document.getElementById("app")); }catch(_){ }
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
      if(!text){
        el.textContent = "";
        return;
      }
      const now = Date.now();
      if(text === lastAnnouncementText && nextMode === lastAnnouncementMode && (now - lastAnnouncementAt) < 900){
        return;
      }
      lastAnnouncementText = text;
      lastAnnouncementMode = nextMode;
      lastAnnouncementAt = now;
      el.setAttribute("aria-live", nextMode);
      el.textContent = "";
      clearTimeout(ariaLiveTimer);
      clearTimeout(ariaLiveClearTimer);
      ariaLiveTimer = setTimeout(()=>{
        el.textContent = text;
        ariaLiveClearTimer = setTimeout(()=>{ el.textContent = ""; }, 1600);
      }, 30);
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

  function clearLegacyMilestoneToastState(){
    const toastEl = document.getElementById("toast");
    if(!toastEl) return;
    const hasLegacyMilestoneClass =
      toastEl.classList.contains("milestoneToast") ||
      toastEl.classList.contains("toastMilestone") ||
      toastEl.classList.contains("toast--milestone");
    const hasLegacyMilestoneNodes = !!toastEl.querySelector(
      ".milestoneTitle, .milestoneDetail, .milestoneDismiss, .celebrationTitle, .celebrationDetail"
    );
    const toastText = String(toastEl.textContent || "").trim();
    const looksLikeMilestoneText = /(milestone|record|all[- ]?time|new high)/i.test(toastText);
    const hasToastAction = !!toastEl.querySelector(".toastAction");
    if(!hasLegacyMilestoneClass && !hasLegacyMilestoneNodes && !(looksLikeMilestoneText && !hasToastAction)) return;
    hardResetToastShell(toastEl);
  }

  function showMilestoneToast({ headline = "", detail = "", okLabel = "OK", durationMs = 0 } = {}){
    try{
      const root = document.getElementById("celebrationRoot");
      if(!root){
        try{ console.debug("[milestone] celebration modal mount failed: missing root"); }catch(_){ }
        return false;
      }
      const toastEl = document.getElementById("toast");
      if(toastEl) hardResetToastShell(toastEl);
      clearCelebration();
      clearLegacyMilestoneToastState();
      celebrationFocusReturn = document.activeElement instanceof HTMLElement ? document.activeElement : null;

      const panel = document.createElement("div");
      panel.className = "celebrationPanel card";
      panel.tabIndex = -1;
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-modal", "true");
      const ids = buildDialogIds("celebrate");

      const content = document.createElement("div");
      content.className = "celebrationContent";

      const titleNode = document.createElement("div");
      titleNode.className = "celebrationTitle";
      titleNode.id = ids.titleId;
      titleNode.textContent = String(headline || "Milestone reached");
      content.appendChild(titleNode);
      panel.setAttribute("aria-labelledby", ids.titleId);

      if(String(detail || "").trim()){
        const detailNode = document.createElement("div");
        detailNode.className = "celebrationDetail";
        detailNode.id = ids.bodyId;
        detailNode.textContent = String(detail || "").trim();
        content.appendChild(detailNode);
        panel.setAttribute("aria-describedby", ids.bodyId);
      }

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "celebrationAction";
      btn.textContent = String(okLabel || "OK");
      btn.addEventListener("click", ()=>{
        clearCelebration();
      }, { once: true });

      panel.appendChild(content);
      panel.appendChild(btn);
      root.textContent = "";
      root.appendChild(panel);
      if(celebrationKeydownHandler){
        root.removeEventListener("keydown", celebrationKeydownHandler);
        celebrationKeydownHandler = null;
      }
      celebrationKeydownHandler = (event)=>{
        if(event.key === "Escape"){
          event.preventDefault();
          clearCelebration();
          return;
        }
        trapDialogFocus(panel, event);
      };
      root.addEventListener("keydown", celebrationKeydownHandler);
      root.classList.remove("hidden");
      root.setAttribute("aria-hidden", "false");
      bindCelebrationViewport(panel);
      const spokenMilestone = String(detail || "").trim()
        ? `${titleNode.textContent}. ${String(detail || "").trim()}`
        : titleNode.textContent;
      announce(spokenMilestone, "polite");
      triggerHaptic("medium");
      requestAnimationFrame(()=>{
        root.classList.add("show");
        try{ btn.focus({ preventScroll: true }); }catch(_){ }
      });
      if(Number.isFinite(durationMs) && durationMs > 0){
        celebrationTimer = setTimeout(()=>{ clearCelebration(); }, durationMs);
      }
      try{ console.debug("[milestone] celebration modal mount succeeded"); }catch(_){ }
      return true;
    }catch{
      try{ console.debug("[milestone] celebration modal mount failed: exception thrown"); }catch(_){ }
      return false;
    }
  }

  function clearCelebration({ shouldRestoreFocus = true } = {}){
    const root = document.getElementById("celebrationRoot");
    const panel = root?.querySelector(".celebrationPanel");
    clearTimeout(celebrationTimer);
    celebrationTimer = null;
    clearCelebrationViewport(panel);
    if(!root) return;
    root.classList.remove("show");
    root.classList.add("hidden");
    root.setAttribute("aria-hidden", "true");
    if(celebrationKeydownHandler){
      root.removeEventListener("keydown", celebrationKeydownHandler);
      celebrationKeydownHandler = null;
    }
    root.textContent = "";
    if(shouldRestoreFocus){
      restoreFocus(celebrationFocusReturn);
    }
    celebrationFocusReturn = null;
    const toastEl = document.getElementById("toast");
    if(toastEl) hardResetToastShell(toastEl);
    clearLegacyMilestoneToastState();
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
      const ids = buildDialogIds("install");
      const el = document.createElement("div");
      el.className = "modalOverlay";
      el.innerHTML = `
        <div class="modalCard card" role="dialog" aria-modal="true" aria-labelledby="${ids.titleId}" ${body ? `aria-describedby="${ids.bodyId}"` : ""}>
          <b id="${ids.titleId}">${escapeHtml(title||"Install")}</b>
          ${body ? `<div id="${ids.bodyId}" class="muted small mt8 lh135 preWrap">${escapeHtml(body)}</div>` : ""}
          <div class="row mt14 gap10 jcEnd wrap">
            <button class="btn" id="im_cancel" type="button">Not now</button>
            <button class="btn primary" id="im_yes" type="button">${escapeHtml(primaryText)}</button>
          </div>
        </div>
      `;
      const dialog = el.querySelector(".modalCard");
      if(dialog instanceof HTMLElement) dialog.tabIndex = -1;

      let settled = false;
      const cleanup = (v)=>{
        if(settled) return;
        settled = true;
        el.removeEventListener("pointerdown", onBackdrop);
        el.removeEventListener("click", onBackdrop);
        el.removeEventListener("keydown", onKeydown);
        animateModalOverlayOut(el, ()=>{
          unlockBodyScroll(el);
          try{ el.remove(); }catch(_){ }
          restoreFocus(opener);
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
      const onKeydown = (event)=>{
        if(event.key === "Escape"){
          event.preventDefault();
          cleanup(false);
          return;
        }
        trapDialogFocus(dialog, event);
      };
      el.addEventListener("keydown", onKeydown);
      document.body.appendChild(el);
      lockBodyScroll(el);
      animateModalOverlayIn(el);
      focusFirstFocusable(dialog);

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
      const ids = buildDialogIds("confirm");
      const el = document.createElement("div");
      el.className = "modalOverlay";
      el.innerHTML = `
        <div class="modalCard card" role="dialog" aria-modal="true" aria-labelledby="${ids.titleId}" ${body ? `aria-describedby="${ids.bodyId}"` : ""}>
          <b id="${ids.titleId}">${escapeHtml(title)}</b>
          ${body ? `<div id="${ids.bodyId}" class="muted small mt8 preWrap">${escapeHtml(body)}</div>` : ""}
          <div class="row mt14 gap10 jcEnd">
            <button class="btn" id="m_cancel" type="button">Cancel</button>
            <button class="btn primary" id="m_yes" type="button">Yes, Save</button>
          </div>
        </div>
      `;
      const dialog = el.querySelector(".modalCard");
      if(dialog instanceof HTMLElement) dialog.tabIndex = -1;

      let settled = false;
      const cleanup = (v)=>{
        if(settled) return;
        settled = true;
        el.removeEventListener("pointerdown", onBackdrop);
        el.removeEventListener("click", onBackdrop);
        el.removeEventListener("keydown", onKeydown);
        animateModalOverlayOut(el, ()=>{
          unlockBodyScroll(el);
          try{ el.remove(); }catch(_){ }
          restoreFocus(opener);
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
      const onKeydown = (event)=>{
        if(event.key === "Escape"){
          event.preventDefault();
          cleanup(false);
          return;
        }
        trapDialogFocus(dialog, event);
      };
      el.addEventListener("keydown", onKeydown);
      document.body.appendChild(el);
      lockBodyScroll(el);
      animateModalOverlayIn(el);
      focusFirstFocusable(dialog);

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
    clearMilestoneCelebration: ()=>clearCelebration({ shouldRestoreFocus: false }),
    maybeOfferInstallAfterFirstSave,
    confirmSaveModal,
    copyTextWithFeedback,
    triggerHaptic
  };
}
