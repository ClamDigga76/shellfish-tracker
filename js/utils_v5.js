
// v81: tiny HTML escape (for modal titles/placeholders)
export function escapeHtml(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

// Shellfish Tracker — V4 ESM Branch
// Phase 2A: Extracted pure utilities (no DOM, no state)

export function uid(prefix=""){
  const p = String(prefix || "").trim();
  const core = Math.random().toString(36).slice(2) + Date.now().toString(36);
  return p ? `${p}_${core}` : core;
}

export function to2(n){
  const v = Number.isFinite(n) ? n : 0;
  return Math.round(v * 100) / 100;
}

export function clamp(n, min = 0){
  if(!Number.isFinite(n)) return min;
  return Math.max(min, n);
}

export function pad2(n){
  return String(n).padStart(2, "0");
}

export function formatDateDMY(input){
  if(input == null || input === "") return "";

  // Pure date input (YYYY-MM-DD): preserve exact calendar day via UTC.
  if(typeof input === "string"){
    const s = input.trim();
    if(!s) return "";
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if(m){
      const y = Number(m[1]);
      const mo = Number(m[2]);
      const d = Number(m[3]);
      if(!(y >= 1 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31)) return "";
      const dt = new Date(Date.UTC(y, mo - 1, d));
      if(dt.getUTCFullYear() !== y || (dt.getUTCMonth() + 1) !== mo || dt.getUTCDate() !== d) return "";
      return `${pad2(dt.getUTCDate())}/${pad2(dt.getUTCMonth() + 1)}/${dt.getUTCFullYear()}`;
    }
  }

  const dt = (input instanceof Date) ? input : new Date(input);
  if(Number.isNaN(dt.getTime())) return "";
  return `${pad2(dt.getDate())}/${pad2(dt.getMonth() + 1)}/${dt.getFullYear()}`;
}

export function formatDateDisplay(iso){
  return formatDateDMY(iso);
}

// Back-compat alias (older call sites still reference this name).
export const formatDateMDY = formatDateDisplay;

export function parseMDYToISO(mdy){
  const s = String(mdy || "").trim();
  if(!s) return "";
  if(s.length === 10 && s[4] === "-" && s[7] === "-") return s;

  const parts = [];
  let cur = "";
  for(let i=0;i<s.length;i++){
    const ch = s[i];
    if(ch >= "0" && ch <= "9") cur += ch;
    else if(ch === "/" || ch === "-" || ch === "."){
      if(cur){ parts.push(cur); cur = ""; }
    }
  }
  if(cur) parts.push(cur);
  if(parts.length !== 3) return "";

  const mm = Number(parts[0]);
  const dd = Number(parts[1]);
  let yy = String(parts[2]);
  if(yy.length === 2){
    const n = Number(yy);
    yy = String((n <= 79 ? 2000 : 1900) + n);
  }
  const y = Number(yy);
  if(!(mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31 && y >= 1900 && y <= 2100)) return "";
  const dt = new Date(y, mm - 1, dd);
  if(dt.getFullYear() !== y || (dt.getMonth()+1) !== mm || dt.getDate() !== dd) return "";
  return y + "-" + pad2(mm) + "-" + pad2(dd);
}

export function parseNum(s){
  const raw = String(s || "").trim();
  let cleaned = "";
  for(let i=0;i<raw.length;i++){
    const ch = raw[i];
    if((ch >= "0" && ch <= "9") || ch === "." || ch === "," || ch === "-") cleaned += ch;
  }

  if(!cleaned) return 0;

  let out = cleaned;
  const dotIdx = cleaned.indexOf(".");
  if(dotIdx >= 0){
    // Dot-decimal stays primary. Commas before dot are grouping separators;
    // comma after dot is treated as a break, not another decimal marker.
    const left = cleaned.slice(0, dotIdx).replaceAll(",", "");
    const rightRaw = cleaned.slice(dotIdx + 1);
    const commaAfterDot = rightRaw.indexOf(",");
    const right = (commaAfterDot >= 0 ? rightRaw.slice(0, commaAfterDot) : rightRaw)
      .replaceAll(",", "");
    out = left + "." + right;
  }else if(cleaned.includes(",")){
    const commaCount = (cleaned.match(/,/g) || []).length;
    if(commaCount === 1){
      const parts = cleaned.split(",");
      const frac = parts[1] || "";
      // Accept simple comma decimals like "12,5" / "12,50".
      if(frac.length > 0 && frac.length <= 2) out = parts[0] + "." + frac;
      else out = cleaned.replaceAll(",", "");
    }else{
      out = cleaned.replaceAll(",", "");
    }
  }

  let normalized = "";
  for(let i=0;i<out.length;i++){
    const ch = out[i];
    if(ch === "-"){
      if(normalized.length === 0) normalized += ch;
      continue;
    }
    normalized += ch;
  }

  const v = parseFloat(normalized);
  return Number.isFinite(v) ? v : 0;
}

export function parseMoney(s){
  const raw = String(s || "").replace(/\$/g, "").trim();
  if(!raw) return 0;

  // NOTE (Outside-first Live Text mode): do NOT apply cents-inference to digits-only values.
  // iOS Live Text often captures "$189.00" as "189" in some contexts; interpreting that as cents
  // would incorrectly become "$1.89". Users always review/confirm anyway.
  return parseNum(raw);
}

export function computePPL(pounds, amount){
  const p = clamp(Number(pounds), 0);
  const a = Number.isFinite(Number(amount)) ? Number(amount) : 0;
  return p > 0 ? to2(a / p) : 0;
}

export function formatMoney(n){
  try{
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2
    }).format(Number.isFinite(n) ? n : 0);
  }catch{
    return "$" + to2(n).toFixed(2);
  }
}


export function normalizeDealerForExport(name){
  // Display-friendly, stable normalization for CSV (non-destructive)
  let s = String(name||"").trim();
  if(!s) return "";
  s = s.replace(/\s+/g, " ");
  // remove common trailing business suffixes
  s = s.replace(/\b(inc\.?|incorporated|llc|l\.l\.c\.|co\.?|company|corp\.?|corporation)\b\s*$/i, "");
  // strip trailing punctuation/whitespace
  s = s.replace(/[\s,\.]+$/g, "");
  return s;
}

export function normalizeKey(s){
  return String(s || "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .join(" ")
    .replaceAll(".", "")
    .replaceAll(",", "")
    .replaceAll("#", "");
}

export function canonicalDealerGroupKey(name){
  const raw = String(name || "").trim();
  if(!raw) return "";
  return normalizeKey(raw);
}

export function likelyDuplicate(a, b){
  if(a.dateISO !== b.dateISO) return false;
  if(normalizeKey(a.dealer) !== normalizeKey(b.dealer)) return false;
  return Math.abs((a.pounds || 0) - (b.pounds || 0)) <= 0.25 &&
         Math.abs((a.amount || 0) - (b.amount || 0)) <= 2;
}

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


export function toCSV(trips){
  const headers = ["Date","Dealer","Pounds","Amount","PricePerLb","Area","RecordID"];
  const lines = [headers.join(",")];
  const clean = (v) => String(v ?? "").replace(/[\r\n]+/g, " ").trim();

  for(const t of trips){
    const ppl = computePPL(t.pounds, t.amount);
    const cells = [
      clean(formatDateMDY(t.dateISO)),
      clean(normalizeDealerForExport(t.dealer)),
      String(to2(t.pounds)),
      String(to2(t.amount)),
      String(to2(ppl)),
      clean(t.area || ""),
      clean(t.id || "")
    ].map(v => {
      const needs = v.includes(",") || v.includes('"');
      const esc = v.split('"').join('""');
      return needs ? `"${esc}"` : esc;
    });

    lines.push(cells.join(","));
  }

  return lines.join("\r\n");
}



function parseTripCreatedAt(createdAt){
  if(typeof createdAt === "number" && Number.isFinite(createdAt)) return createdAt;
  const raw = String(createdAt || "").trim();
  if(!raw) return 0;
  const ts = Date.parse(raw);
  if(Number.isFinite(ts)) return ts;
  const num = Number(raw);
  return Number.isFinite(num) ? num : 0;
}

export function compareTripsNewestFirst(a, b){
  const da = String(a?.dateISO || "");
  const db = String(b?.dateISO || "");
  if(db && da && db !== da) return db.localeCompare(da);

  const ca = parseTripCreatedAt(a?.createdAt);
  const cb = parseTripCreatedAt(b?.createdAt);
  if(cb !== ca) return cb - ca;

  const ia = String(a?.id || a?._id || "");
  const ib = String(b?.id || b?._id || "");
  if(ia !== ib) return ia.localeCompare(ib);

  const af = `${String(a?.dealer||"")}|${String(a?.area||"")}|${String(a?.species||"")}|${String(a?.pounds||"")}|${String(a?.amount||"")}|${String(a?.notes||"")}`;
  const bf = `${String(b?.dealer||"")}|${String(b?.area||"")}|${String(b?.species||"")}|${String(b?.pounds||"")}|${String(b?.amount||"")}|${String(b?.notes||"")}`;
  return af.localeCompare(bf);
}

// Return a NEW array of trips sorted newest-first.
export function getTripsNewestFirst(trips){
  const arr = Array.isArray(trips) ? trips.slice() : [];
  return arr.sort(compareTripsNewestFirst);
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

  closeModal();

  const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  const isCenter = position === "center";
  root.classList.remove("hidden");
  root.setAttribute("aria-hidden","false");

  const closeBtnHtml = showCloseButton
    ? `<button class="btn" id="modalCloseBtn" type="button" aria-label="Close">✕</button>`
    : "";

  const sheetStyle = isCenter
    ? "position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:calc(100% - 32px);max-width:400px;border-radius:16px;box-shadow:0 16px 44px rgba(0,0,0,.48);"
    : "";

  if(isCenter){
    root.style.alignItems = "center";
    root.style.paddingBottom = "16px";
  }

  root.innerHTML = `
    <div class="modalSheet" style="${sheetStyle}" role="dialog" aria-modal="true">
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
    backdropHandler: backdropClose ? closeFromBackdrop : null
  };

  focusFirstFocusable(sheet);

  try{ onOpen && onOpen(); }catch(_e){}
}

export function closeModal(){
  const root = document.getElementById("modalRoot");
  if(!root) return;
  const state = activeModalState;

  if(state?.backdropHandler){
    root.removeEventListener("pointerdown", state.backdropHandler);
    root.removeEventListener("click", state.backdropHandler);
  }
  if(state?.escHandler){
    window.removeEventListener("keydown", state.escHandler);
  }

  root.classList.add("hidden");
  root.style.alignItems = "";
  root.style.paddingBottom = "";
  root.setAttribute("aria-hidden","true");
  root.innerHTML = "";
  unlockBodyScroll(root);

  if(state?.opener && document.contains(state.opener)){
    try{ state.opener.focus({ preventScroll: true }); }catch(_){ }
  }
  activeModalState = null;
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
