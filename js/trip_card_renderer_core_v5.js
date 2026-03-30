export function createTripCardRendererCore({ formatDateDMY, to2, computePPL, resolveTripPayRate, deriveTripSettlement, formatMoney, escapeHtml }){
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
    const ppl = typeof resolveTripPayRate === "function" ? resolveTripPayRate(t) : computePPL(lbs, amt);
    const settlement = typeof deriveTripSettlement === "function"
      ? deriveTripSettlement(t)
      : { hasDifference: false, writtenCheckAmount: amt, dealerAdjustment: 0, adjustmentClass: "none" };
    const settlementPrefix = settlement.adjustmentClass === "rounded_up" || settlement.adjustmentClass === "rounded_down"
      ? "Rounded"
      : "Adjustment";
    const settlementText = settlement.hasDifference
      ? `Check paid: ${formatMoney(settlement.writtenCheckAmount)} · ${settlementPrefix} ${settlement.dealerAdjustment >= 0 ? "+" : "-"}${formatMoney(Math.abs(settlement.dealerAdjustment))}`
      : "";

    return {
      id: String(t?.id || ""),
      dateText: metaOverride || date || "",
      dealer,
      area,
      species,
      notesPreview,
      lbs,
      amountText: formatMoney(amt),
      valueText: valueOverride || `${formatMoney(ppl)}/lb`,
      settlementText
    };
  }

  function renderTripCardHTML(model, opts = {}){
    const {
      interactive = false,
      variant = "standard"
    } = opts;
    const tag = interactive ? "button" : "div";
    const role = interactive ? "button" : "group";
    const tab = interactive ? "0" : "-1";
    const idAttr = interactive ? ` data-id="${escapeHtml(model.id)}"` : "";
    const modeClass = interactive ? "tripCardInteractive" : "tripCardReadOnly";
    const isTripsBrowse = variant === "tripsBrowse";
    const variantClass = isTripsBrowse ? "tripCardVariantTripsBrowse" : "tripCardVariantStandard";
    const primaryIdentity = isTripsBrowse ? model.area : model.dealer;
    const secondaryIdentity = isTripsBrowse ? model.dealer : model.area;
    const primaryIdentityClass = isTripsBrowse ? "tripCardArea" : "tripCardDealer";
    const secondaryIdentityClass = isTripsBrowse ? "tripCardDealer" : "tripCardArea";
    const metricRows = isTripsBrowse
      ? `
            <span class="catchMetric tripCardMetricChip lbsBlue tripCardMetricEmphasis"><b class="metricValue lbsBlue">${model.lbs}</b> lbs</span>
            <span class="catchMetric tripCardMetricChip money tripCardMetricEmphasis"><b class="metricValue money">${model.amountText}</b></span>
            <span class="catchMetric tripCardMetricChip"><b class="metricValue rate ppl">${escapeHtml(model.valueText)}</b></span>
        `
      : `
            <span class="catchMetric tripCardMetricChip money"><b class="metricValue money">${model.amountText}</b></span>
            <span class="catchMetric tripCardMetricChip lbsBlue"><b class="metricValue lbsBlue">${model.lbs}</b> lbs</span>
            <span class="catchMetric tripCardMetricChip"><b class="metricValue rate ppl">${escapeHtml(model.valueText)}</b></span>
        `;

    return `
      <${tag} class="trip triprow catchCard tripCardStandard ${modeClass} ${variantClass}"${idAttr} role="${role}" tabindex="${tab}"${interactive ? ' type="button"' : ""}>
        <div class="tripCardGrid">
          <div class="tripCardLeftStack">
            <div class="tripCardTextRow tripCardDate">${escapeHtml(model.dateText)}</div>
            <div class="tripCardTextRow ${primaryIdentityClass} tripCardIdentityPrimary">${escapeHtml(primaryIdentity)}</div>
            <div class="tripCardTextRow ${secondaryIdentityClass} tripCardIdentitySecondary">${escapeHtml(secondaryIdentity)}</div>
            <div class="tripCardTextRow tripCardSpecies" title="Species">${escapeHtml(model.species)}</div>
            ${model.notesPreview ? `<div class="tripCardTextRow tripCardNotes" title="Notes">${escapeHtml(model.notesPreview)}</div>` : ""}
          </div>
          <div class="catchFoot tripCardMetricsCol">
            ${metricRows}
            ${model.settlementText ? `<span class="tripCardSettlementSubtle">${escapeHtml(model.settlementText)}</span>` : ""}
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
