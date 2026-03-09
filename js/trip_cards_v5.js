export function normalizeDealerDisplay(name){
  let s = String(name||"").trim();
  if(!s) return "";
  // collapse whitespace
  s = s.replace(/\s+/g, " ");
  // remove common trailing business suffixes (display-only)
  s = s.replace(/\b(inc\.?|incorporated|llc|co\.?|company)\b\.?/gi, "").replace(/\s+/g," ").trim();
  // Title-case words (keeps & and numbers)
  return s.split(" ").map(w=>{
    if(!w) return w;
    // keep all-caps short tokens like "USA"
    if(w.length <= 3 && w.toUpperCase() === w) return w;
    const lower = w.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }).join(" ");
}

export function createTripCardRenderHelpers({ formatDateDMY, to2, computePPL, formatMoney, escapeHtml }){
  function renderTripCatchCard(t, opts = {}){
    const {
      interactive = false,
      extraClass = "",
      valueOverride = "",
      metaOverride = ""
    } = opts;
    const date = t?.invalidDateQuarantined ? "Invalid date (quarantined)" : formatDateDMY(t?.dateISO || "");
    const dealerRaw = String(t?.dealer || "").trim();
    const dealer = dealerRaw || "(dealer)";
    const area = String(t?.area || "").trim() || "(area)";
    const lbs = to2(Number(t?.pounds) || 0);
    const amt = to2(Number(t?.amount) || 0);
    const ppl = computePPL(lbs, amt);
    const tag = interactive ? "button" : "div";
    const role = interactive ? "button" : "group";
    const tab = interactive ? "0" : "-1";
    const idAttr = interactive ? ` data-id="${escapeHtml(String(t?.id || ""))}"` : "";
    const valueText = valueOverride || `${formatMoney(ppl)}/lb`;
    const dateText = metaOverride || date || "";

    return `
      <${tag} class="trip triprow catchCard ${escapeHtml(extraClass)}"${idAttr} role="${role}" tabindex="${tab}"${interactive ? ' type="button"' : ""}>
        <div style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:start">
          <div>
            <div class="catchHead" style="font-size:18px;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(dateText)}</div>
            <div class="catchMain" style="font-size:18px">${escapeHtml(area)}</div>
            <div class="catchHead" style="margin-top:2px;font-size:18px;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(dealer)}</div>
          </div>
          <div class="catchFoot" style="margin-top:0;display:flex;flex-direction:column;gap:6px;align-items:flex-end;flex-wrap:nowrap">
            <span class="catchMetric lbsBlue" style="font-size:14px;padding:6px 10px"><b class="lbsBlue">${lbs}</b> lbs</span>
            <span class="catchMetric" style="font-size:14px;padding:6px 10px"><b class="rate ppl">${escapeHtml(valueText)}</b></span>
            <span class="catchMetric money" style="font-size:14px;padding:6px 10px"><b class="money">${formatMoney(amt)}</b></span>
          </div>
        </div>
      </${tag}>
    `;
  }

  return {
    renderTripCatchCard
  };
}
