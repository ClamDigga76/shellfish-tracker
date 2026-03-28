import { escapeHtml } from "./utils_v5.js";

export function downloadText(filename, text){
  const lower = String(filename || "").toLowerCase();
  const isCsv = lower.endsWith(".csv");
  const isJson = lower.endsWith(".json");

  // CSV: keep BOM for Excel friendliness
  const payload = isCsv ? "\uFEFF" + String(text || "") : String(text || "");

  // Pick a MIME type that matches the extension.
  // This prevents iOS Safari from appending “.txt” to .json downloads.
  const mime = isJson
    ? "application/json;charset=utf-8"
    : (isCsv ? "text/csv;charset=utf-8" : "text/plain;charset=utf-8");

  const blob = new Blob([payload], { type: mime });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();

  // Cleanup
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}

let overlayLockCount = 0;
const overlayAllowTouchRoots = new Set();
let touchMoveBlockerAttached = false;

const touchMoveBlocker = (e)=>{
  if(!overlayAllowTouchRoots.size) return;
  const target = e.target;
  for(const root of overlayAllowTouchRoots){
    if(root && (target === root || root.contains(target))) return;
  }
  e.preventDefault();
};

function setTouchMoveBlocker(attached){
  if(attached === touchMoveBlockerAttached) return;
  touchMoveBlockerAttached = attached;
  if(attached){
    document.addEventListener("touchmove", touchMoveBlocker, { passive: false, capture: true });
  }else{
    document.removeEventListener("touchmove", touchMoveBlocker, { capture: true });
  }
}

export function lockBodyScroll(allowTouchRoot){
  overlayLockCount += 1;
  if(allowTouchRoot) overlayAllowTouchRoots.add(allowTouchRoot);
  document.body.classList.add("scrollLock");
  setTouchMoveBlocker(true);
}

export function unlockBodyScroll(allowTouchRoot){
  if(allowTouchRoot) overlayAllowTouchRoots.delete(allowTouchRoot);
  overlayLockCount = Math.max(0, overlayLockCount - 1);
  if(overlayLockCount === 0){
    document.body.classList.remove("scrollLock");
    setTouchMoveBlocker(false);
  }
}

export function focusFirstFocusable(container){
  if(!container) return null;
  const target = container.querySelector("[autofocus], input:not([type='hidden']):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex='-1'])");
  if(target && typeof target.focus === "function"){
    target.focus({ preventScroll: true });
    return target;
  }
  return null;
}


// ===========================
// v81: Modal helpers (Quick Add, etc.)
let activeModalState = null;
const MODAL_ROOT_EXIT_MS = 240;


export function openModal({
  title,
  html,
  onOpen,
  backdropClose = true,
  escClose = true,
  showCloseButton = true,
  position = "sheet"
}){
  const root = document.getElementById("modalRoot");
  if(!root) return;

  closeModal({ immediate: true });

  const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  const isCenter = position === "center";
  root.classList.remove("hidden");
  root.setAttribute("aria-hidden","false");

  const closeBtnHtml = showCloseButton
    ? `<button class="btn" id="modalCloseBtn" type="button" aria-label="Close">✕</button>`
    : "";

  const sheetStyle = isCenter
    ? "position:absolute;top:50%;left:50%;width:calc(100% - 32px);max-width:400px;border-radius:16px;box-shadow:0 16px 44px rgba(0,0,0,.48);"
    : "";

  if(isCenter){
    root.style.alignItems = "center";
    root.style.paddingBottom = "16px";
  }

  root.innerHTML = `
    <div class="modalSheet${isCenter ? " modalSheet--center" : ""}" style="${sheetStyle}" role="dialog" aria-modal="true">
      <div class="modalHdr">
        <div class="modalTitle">${escapeHtml(String(title||""))}</div>
        ${closeBtnHtml}
      </div>
      <div class="modalBody">${html||""}</div>
    </div>
  `;

  const sheet = root.querySelector(".modalSheet");
  const close = ()=>closeModal();

  const closeFromBackdrop = (e)=>{
    if(e.target !== root) return;
    e.preventDefault();
    e.stopPropagation();
    close();
  };

  // close button
  if(showCloseButton){
    document.getElementById("modalCloseBtn")?.addEventListener("click", close);
  }

  if(backdropClose){
    root.addEventListener("pointerdown", closeFromBackdrop);
    root.addEventListener("click", closeFromBackdrop);
  }

  const escHandler = (e)=>{
    if(e.key === "Escape"){
      e.preventDefault();
      close();
    }
  };
  if(escClose){
    window.addEventListener("keydown", escHandler);
  }

  lockBodyScroll(root);

  activeModalState = {
    root,
    opener,
    escHandler: escClose ? escHandler : null,
    backdropHandler: backdropClose ? closeFromBackdrop : null,
    closing: false
  };

  requestAnimationFrame(()=>{ root.classList.add("is-visible"); });
  focusFirstFocusable(sheet);

  try{ onOpen && onOpen(); }catch(_e){}
}

export function closeModal({ immediate = false } = {}){
  const root = document.getElementById("modalRoot");
  if(!root) return;
  const state = activeModalState;

  if(state?.closing) return;
  if(state) state.closing = true;

  if(state?.backdropHandler){
    root.removeEventListener("pointerdown", state.backdropHandler);
    root.removeEventListener("click", state.backdropHandler);
  }
  if(state?.escHandler){
    window.removeEventListener("keydown", state.escHandler);
  }

  const finalizeClose = ()=>{
    root.classList.add("hidden");
    root.classList.remove("is-closing", "is-visible");
    root.style.alignItems = "";
    root.style.paddingBottom = "";
    root.setAttribute("aria-hidden","true");
    root.innerHTML = "";
    unlockBodyScroll(root);

    if(state?.opener && document.contains(state.opener)){
      try{ state.opener.focus({ preventScroll: true }); }catch(_){ }
    }
    activeModalState = null;
  };

  if(immediate){
    finalizeClose();
    return;
  }

  root.classList.remove("is-visible");
  root.classList.add("is-closing");

  window.setTimeout(finalizeClose, MODAL_ROOT_EXIT_MS);
}

export function attachLongPress(el, { ms = 500, movePx = 10, onLongPressArmed, onLongPressTrigger } = {}){
  if(!el) return ()=>{};

  const delay = Number.isFinite(Number(ms)) ? Math.max(1, Number(ms)) : 500;
  const moveLimit = Number.isFinite(Number(movePx)) ? Math.max(1, Number(movePx)) : 10;

  let timer = null;
  let pointerId = null;
  let startX = 0;
  let startY = 0;
  let armed = false;

  const clearTimer = ()=>{
    if(timer){
      clearTimeout(timer);
      timer = null;
    }
  };

  const resetPress = ()=>{
    clearTimer();
    pointerId = null;
    armed = false;
  };

  const onPointerDown = (e)=>{
    if(e.pointerType === "mouse" && e.button !== 0) return;

    resetPress();
    pointerId = e.pointerId;
    startX = Number(e.clientX || 0);
    startY = Number(e.clientY || 0);

    timer = setTimeout(()=>{
      timer = null;
      if(pointerId == null) return;
      armed = true;
      if(typeof onLongPressArmed === "function"){
        try{ onLongPressArmed(e); }catch(_){ }
      }
    }, delay);
  };

  const onPointerMove = (e)=>{
    if(pointerId == null || e.pointerId !== pointerId) return;
    const dx = Number(e.clientX || 0) - startX;
    const dy = Number(e.clientY || 0) - startY;
    if((dx*dx + dy*dy) > (moveLimit * moveLimit)){
      resetPress();
    }
  };

  const onPointerUp = (e)=>{
    if(pointerId == null || e.pointerId !== pointerId) return;
    const shouldTrigger = armed;
    resetPress();
    if(shouldTrigger && typeof onLongPressTrigger === "function"){
      try{ onLongPressTrigger(e); }catch(_){ }
    }
  };

  const onPointerCancel = (e)=>{
    if(pointerId == null || e.pointerId !== pointerId) return;
    resetPress();
  };

  el.addEventListener("pointerdown", onPointerDown, { passive: true });
  el.addEventListener("pointermove", onPointerMove, { passive: true });
  el.addEventListener("pointerup", onPointerUp);
  el.addEventListener("pointercancel", onPointerCancel);

  return ()=>{
    resetPress();
    el.removeEventListener("pointerdown", onPointerDown);
    el.removeEventListener("pointermove", onPointerMove);
    el.removeEventListener("pointerup", onPointerUp);
    el.removeEventListener("pointercancel", onPointerCancel);
  };
}
