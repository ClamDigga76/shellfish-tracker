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
    const species = String(t?.species || "").trim() || "(species)";
    const notesRaw = String(t?.notes || "").trim();
    const notesPreview = notesRaw ? (notesRaw.length > 56 ? `${notesRaw.slice(0, 56)}…` : notesRaw) : "";
    const lbs = to2(Number(t?.pounds) || 0);
    const amt = to2(Number(t?.amount) || 0);
    const ppl = computePPL(lbs, amt);

    return {
      id: String(t?.id || ""),
      dateText: metaOverride || date || "",
      dealer,
      area,
      species,
      notesPreview,
      lbs,
      amountText: formatMoney(amt),
      valueText: valueOverride || `${formatMoney(ppl)}/lb`
    };
  }

  function renderTripCardHTML(model, opts = {}){
    const {
      interactive = false
    } = opts;
    const tag = interactive ? "button" : "div";
    const role = interactive ? "button" : "group";
    const tab = interactive ? "0" : "-1";
    const idAttr = interactive ? ` data-id="${escapeHtml(model.id)}"` : "";
    const modeClass = interactive ? "tripCardInteractive" : "tripCardReadOnly";

    return `
      <${tag} class="trip triprow tripCardStandard ${modeClass}"${idAttr} role="${role}" tabindex="${tab}"${interactive ? ' type="button"' : ""}>
        <div class="tripCardGrid">
          <div>
            <div class="catchHead tripCardHeadline tripCardDate">${escapeHtml(model.dateText)}</div>
            <div class="catchMain tripCardMain">${escapeHtml(model.area)}</div>
            <div class="catchHead tripCardHeadline tripCardHeadlineDealer">${escapeHtml(model.dealer)}</div>
            <div class="tripCardLowerLeft">
              <div class="tripCardSpecies" title="Species">${escapeHtml(model.species)}</div>
              ${model.notesPreview ? `<div class="tripCardNotes" title="Notes">${escapeHtml(model.notesPreview)}</div>` : ""}
            </div>
          </div>
          <div class="catchFoot tripCardMetricsCol">
            <span class="catchMetric tripCardMetricChip lbsBlue"><b class="metricValue lbsBlue">${model.lbs}</b> lbs</span>
            <span class="catchMetric tripCardMetricChip"><b class="metricValue rate ppl">${escapeHtml(model.valueText)}</b></span>
            <span class="catchMetric tripCardMetricChip money"><b class="metricValue money">${model.amountText}</b></span>
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
