export function createTripMetricSyncEngine({ parseNum, parseMoney, syncTargets }) {
  let syncingMetric = false;
  let lockPair = ["pounds", "rate"];

  const getFieldValue = (field) => {
    if (field === "amount") return parseMoney(syncTargets.amount?.value);
    return parseNum(syncTargets[field]?.value);
  };

  const setMetricValue = (field, value, decimals = 2) => {
    const el = syncTargets[field];
    if (!el) return;
    if (!(Number.isFinite(value) && value > 0)) {
      el.value = "";
      return;
    }
    el.value = Number(value).toFixed(decimals);
  };

  function updateDerivedField() {
    if (syncingMetric) return;
    syncingMetric = true;
    try {
      const pounds = getFieldValue("pounds");
      const rate = getFieldValue("rate");
      const amount = getFieldValue("amount");
      if (lockPair[0] === "pounds" && lockPair[1] === "amount") {
        if (Number.isFinite(pounds) && pounds > 0 && Number.isFinite(amount) && amount > 0) setMetricValue("rate", amount / pounds, 2);
        else setMetricValue("rate", 0, 2);
        return;
      }
      if (Number.isFinite(pounds) && pounds > 0 && Number.isFinite(rate) && rate > 0) setMetricValue("amount", pounds * rate, 2);
      else setMetricValue("amount", 0, 2);
    } finally {
      syncingMetric = false;
    }
  }

  function onUserEdit(field) {
    if (syncingMetric) return;
    if (field === "amount") lockPair = ["pounds", "amount"];
    if (field === "rate") lockPair = ["pounds", "rate"];
  }

  return {
    updateDerivedField,
    onUserEdit,
    getLockPair: () => [...lockPair]
  };
}

const METRIC_HELPER_TEXT_BY_PAIR = Object.freeze({
  "pounds+rate": "Pounds × Pay Rate = Amount (auto-calculated).",
  "pounds+amount": "Pay Rate is auto-calculated from Pounds + Amount."
});

export function getMetricHelperText(lockPair = []) {
  const key = Array.isArray(lockPair) ? lockPair.join("+") : "";
  return METRIC_HELPER_TEXT_BY_PAIR[key] || METRIC_HELPER_TEXT_BY_PAIR["pounds+rate"];
}

export function createMetricStateHelperUpdater({ helperId, metricSync }) {
  const metricStateHelperEl = document.getElementById(helperId);
  return ()=>{
    if(!metricStateHelperEl) return;
    metricStateHelperEl.textContent = getMetricHelperText(metricSync.getLockPair());
  };
}

export function sanitizeDecimalInput(raw){
  let s = String(raw || "").replace(/[^\d.,]/g, "");
  const decimalIdx = s.search(/[.,]/);
  if(decimalIdx !== -1){
    const intPart = s.slice(0, decimalIdx).replace(/[.,]/g, "");
    const fracPart = s.slice(decimalIdx + 1).replace(/[.,]/g, "");
    s = `${intPart}.${fracPart}`;
  }else{
    s = s.replace(/[.,]/g, "");
  }
  return s;
}

export function primeNumericField(el, zeroValues){
  try{
    const v = String(el.value || "").trim();
    if(!v || (zeroValues || []).includes(v)){
      el.value = "";
    }else{
      requestAnimationFrame(()=>{ try{ el.select(); }catch(_){} });
    }
  }catch(_){ }
}

export function normalizeAmountOnBlur(el, parseMoney){
  try{
    const s = String(el.value || "").trim();
    if(!s){ el.value = "0.00"; return; }
    const n = parseMoney(s);
    el.value = Number.isFinite(n) ? n.toFixed(2) : "0.00";
  }catch(_){ }
}

function display2(val){
  if(val === "" || val == null) return "";
  const n = Number(val);
  if(!Number.isFinite(n)) return String(val);
  const rounded = Math.round((n + Number.EPSILON) * 100) / 100;
  return rounded.toFixed(2);
}

export function displayAmount(val){
  return display2(val);
}

export function renderSuggestions(list, current, dataAttr, escapeHtml){
  const cur = String(current||"").trim().toLowerCase();
  if(!cur) return "";
  const matches = [];
  for(const item of (Array.isArray(list)?list:[])){
    const s = String(item||"").trim();
    if(!s) continue;
    const key = s.toLowerCase();
    if(key === cur) continue;
    if(key.includes(cur)) matches.push(s);
    if(matches.length >= 8) break;
  }
  if(!matches.length) return "";
  return `<div class="muted small" style="margin-top:8px">Suggestions</div>
    <div class="chips" style="margin-top:8px">
      ${matches.map(s=>`<button class="chip" ${dataAttr}="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join("")}
    </div>`;
}
