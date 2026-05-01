import { AREA_NOT_RECORDED } from "./trip_shared_engine_v5.js";

export function createTripCardRendererCore({ formatDateDMY, to2, computePPL, resolveTripPayRate, deriveTripSettlement, formatMoney, escapeHtml }){
  // Shared Trip Card model + HTML layout seam:
  // - Keep display model normalization and card markup centralized here.
  // - Public callers should route through trip_cards_v5.js helpers.
  // - Future trip-card variants should be added through wrapper/core seams, not copied markup.
  function resolveTripCardModel(t, opts = {}){
    const {
      valueOverride = "",
      metaOverride = ""
    } = opts;
    const date = t?.invalidDateQuarantined ? "Invalid date (quarantined)" : formatDateDMY(t?.dateISO || "");
    const quarantineStatusText = t?.invalidDateQuarantined
      ? "Date unavailable • quarantined for safety"
      : "";
    const dealerRaw = String(t?.dealer || "").trim();
    const dealer = dealerRaw || "(dealer)";
    const areaRaw = String(t?.area || "").trim();
    const areaUnknown = !areaRaw || areaRaw === AREA_NOT_RECORDED;
    const area = areaUnknown ? AREA_NOT_RECORDED : areaRaw;
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
      areaUnknown,
      notesPreview,
      lbs,
      amountText: formatMoney(amt),
      valueText: valueOverride || `${formatMoney(ppl)}/lb`,
      settlementText,
      quarantineStatusText
    };
  }

  function renderTripCardHTML(model, opts = {}){
    const {
      interactive = false,
      variant = "standard",
      auditVariant = "",
      showTripsBrowseActions = false
    } = opts;
    const isTripsBrowse = variant === "tripsBrowse";
    const useButtonShell = interactive && !isTripsBrowse;
    const tag = useButtonShell ? "button" : "div";
    const role = interactive ? "button" : "group";
    const tab = interactive ? "0" : "-1";
    const idAttr = interactive ? ` data-id="${escapeHtml(model.id)}"` : "";
    const auditVariantAttr = auditVariant ? ` data-trip-card-variant="${escapeHtml(auditVariant)}"` : "";
    const modeClass = interactive ? "tripCardInteractive" : "tripCardReadOnly";
    const variantClass = isTripsBrowse ? "tripCardVariantTripsBrowse" : "tripCardVariantStandard";
    const primaryIdentity = model.area;
    const primaryIdentityContent = model.areaUnknown
      ? `<span class="tripCardUnknownBadge" aria-label="Area unknown">${escapeHtml(primaryIdentity)}</span>`
      : escapeHtml(primaryIdentity);
    const secondaryIdentity = model.dealer;
    const primaryIdentityClass = "tripCardArea";
    const secondaryIdentityClass = "tripCardDealer";
    const metricRows = `
            <span class="catchMetric tripCardMetricChip lbsBlue tripCardMetricEmphasis"><b class="metricValue lbsBlue">${model.lbs}</b> lbs</span>
            <span class="catchMetric tripCardMetricChip money tripCardMetricEmphasis"><b class="metricValue money">${model.amountText}</b></span>
            <span class="catchMetric tripCardMetricChip"><b class="metricValue rate ppl">${escapeHtml(model.valueText)}</b></span>
        `;

    const tripsBrowseActions = (isTripsBrowse && showTripsBrowseActions)
      ? `<div class="tripCardActionsRow" role="group" aria-label="Trip actions"><button class="tripCardActionBtn" type="button" data-trip-action="edit" data-id="${escapeHtml(model.id)}">Edit Trip</button><button class="tripCardActionBtn" type="button" data-trip-action="share" data-id="${escapeHtml(model.id)}">Share Card</button></div>`
      : "";

    return `
      <${tag} class="trip triprow catchCard tripCardStandard ${modeClass} ${variantClass}"${idAttr}${auditVariantAttr} role="${role}" tabindex="${tab}"${useButtonShell ? ' type="button"' : ""}>
        <div class="tripCardGrid">
          <div class="tripCardLeftStack">
            <div class="tripCardTextRow tripCardDate">${escapeHtml(model.dateText)}</div>
            ${model.quarantineStatusText ? `<div class="tripCardTextRow muted small tripCardQuarantineStatus">${escapeHtml(model.quarantineStatusText)}</div>` : ""}
            <div class="tripCardTextRow ${primaryIdentityClass} tripCardIdentityPrimary${model.areaUnknown ? " tripCardAreaUnknown" : ""}">${primaryIdentityContent}</div>
            <div class="tripCardTextRow ${secondaryIdentityClass} tripCardIdentitySecondary">${escapeHtml(secondaryIdentity)}</div>
            <div class="tripCardTextRow tripCardSpecies" title="Species">${escapeHtml(model.species)}</div>
            ${model.notesPreview ? `<div class="tripCardTextRow tripCardNotes" title="Notes">${escapeHtml(model.notesPreview)}</div>` : ""}
          </div>
          <div class="catchFoot tripCardMetricsCol">
            ${tripsBrowseActions}
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
