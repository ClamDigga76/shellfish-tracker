// Shellfish Tracker — V1.5 ESM Branch
// Phase 2A: Extracted pure utilities (no DOM, no state)

export function uid(){
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
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

export function formatDateMDY(iso){
  const p = String(iso || "").split("-");
  if(p.length !== 3) return iso || "";
  return p[1] + "/" + p[2] + "/" + p[0];
}

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
  return y + "-" + pad2(mm) + "-" + pad2(dd);
}

export function parseNum(s){
  const raw = String(s || "");
  let out = "";
  for(let i=0;i<raw.length;i++){
    const ch = raw[i];
    if((ch >= "0" && ch <= "9") || ch === "." || ch === "-") out += ch;
  }
  const v = parseFloat(out);
  return Number.isFinite(v) ? v : 0;
}

export function parseMoney(s){
  const raw = String(s || "").replace(/[$,]/g, "").trim();
  if(!raw) return 0;

  let digitsOnly = true;
  for(let i=0;i<raw.length;i++){
    const ch = raw[i];
    if(!(ch >= "0" && ch <= "9")) { digitsOnly = false; break; }
  }

  if(digitsOnly && raw.length >= 3 && raw.length <= 9){
    const cents = Number(raw);
    const usd = cents / 100;
    if(Number.isFinite(usd) && usd >= 1 && usd <= 500000) return usd;
  }

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

export function likelyDuplicate(a, b){
  if(a.dateISO !== b.dateISO) return false;
  if(normalizeKey(a.dealer) !== normalizeKey(b.dealer)) return false;
  return Math.abs((a.pounds || 0) - (b.pounds || 0)) <= 0.25 &&
         Math.abs((a.amount || 0) - (b.amount || 0)) <= 2;
}

export function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function downloadText(filename, text){
  const isCsv = String(filename || "").toLowerCase().endsWith(".csv");
  const payload = isCsv ? "\uFEFF" + String(text || "") : String(text || "");
  const blob = new Blob([payload], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
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
