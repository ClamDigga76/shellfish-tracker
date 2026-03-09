export function createTripCardRendererCore({ formatDateDMY, to2, computePPL, formatMoney, escapeHtml }){
  function resolveTripCardModel(t, opts = {}){
    const {
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

    return {
      id: String(t?.id || ""),
      dateText: metaOverride || date || "",
      dealer,
      area,
      lbs,
      amountText: formatMoney(amt),
      valueText: valueOverride || `${formatMoney(ppl)}/lb`
    };
  }

  function renderTripCardHTML(model, opts = {}){
    const {
      interactive = false,
      compact = false,
      extraClass = ""
    } = opts;
    const tag = interactive ? "button" : "div";
    const role = interactive ? "button" : "group";
    const tab = interactive ? "0" : "-1";
    const idAttr = interactive ? ` data-id="${escapeHtml(model.id)}"` : "";
    const compactClass = compact ? " tripCardCompact" : "";

    return `
      <${tag} class="trip triprow catchCard${compactClass} ${escapeHtml(extraClass)}"${idAttr} role="${role}" tabindex="${tab}"${interactive ? ' type="button"' : ""}>
        <div style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:start">
          <div>
            <div class="catchHead" style="font-size:18px;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(model.dateText)}</div>
            <div class="catchMain" style="font-size:18px">${escapeHtml(model.area)}</div>
            <div class="catchHead" style="margin-top:2px;font-size:18px;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(model.dealer)}</div>
          </div>
          <div class="catchFoot" style="margin-top:0;display:flex;flex-direction:column;gap:6px;align-items:flex-end;flex-wrap:nowrap">
            <span class="catchMetric lbsBlue" style="font-size:14px;padding:6px 10px"><b class="lbsBlue">${model.lbs}</b> lbs</span>
            <span class="catchMetric" style="font-size:14px;padding:6px 10px"><b class="rate ppl">${escapeHtml(model.valueText)}</b></span>
            <span class="catchMetric money" style="font-size:14px;padding:6px 10px"><b class="money">${model.amountText}</b></span>
          </div>
        </div>
      </${tag}>
    `;
  }

  return {
    resolveTripCardModel,
    renderTripCardHTML
  };
}
