import { computePPL, escapeHtml } from "./utils_v5.js";

export function renderTripEntryForm({
  mode = "new",
  formId,
  dateId,
  dealerId,
  poundsId,
  amountId,
  areaId,
  speciesId,
  notesId,
  rateId,
  dateValue,
  dealerOptions,
  areaOptions,
  speciesOptions,
  topDealerChipsHtml,
  topAreaChipsHtml,
  poundsValue,
  amountValue,
  notesValue,
  rateValue,
  primaryActionLabel,
  secondaryActionLabel,
  secondaryActionId,
  tertiaryActionLabel = "",
  tertiaryActionId = "",
  extraCardClass = "",
  dateIconHtml = "📅",
  showSpeciesField = true,
  showNotesField = true,
  settlementRevealId = "",
  settlementExpanded = false,
  writtenCheckAmountId = "",
  writtenCheckAmountValue = "",
  settlementAdjustmentText = "",
  settlementHintText = "",
  areaGuidanceText = "If you don't know the area yet, choose Area Not Recorded.",
  metricStateHelperId = "",
  metricStateHelperText = "Amount = Pounds × $/LB (auto-calculated).",
  dealerValue = "",
  areaValue = ""
}) {
  const isEdit = mode === "edit";
  const isNew = mode === "new";
  const tertiaryButton = tertiaryActionLabel ? `<button class="btn danger" id="${escapeHtml(tertiaryActionId)}" type="button">${escapeHtml(tertiaryActionLabel)}</button>` : "";
  const notesLockBadge = `
    <button class="tripTopLockPill" id="newTripLockedNotesInfo" type="button" aria-label="Notes are locked for this screen">
      <span aria-hidden="true">🔒</span>
      <span>Notes locked</span>
    </button>
  `;
  const dealerDisplayValue = String(dealerValue || "").trim() || "Select dealer";
  const areaDisplayValue = String(areaValue || "").trim() || "Select area";
  const metricHelperText = String(metricStateHelperText || "").trim();
  const settlementToggle = settlementRevealId
    ? `<button class="tripSettlementReveal tripSettlementReveal--compact" id="${escapeHtml(settlementRevealId)}" type="button" aria-expanded="${settlementExpanded ? "true" : "false"}"><span>${settlementExpanded ? "Hide check details" : "Check total differs?"}</span><span class="tripSettlementChevron" aria-hidden="true">${settlementExpanded ? "▾" : "▸"}</span></button>`
    : "";
  const settlementDetails = settlementRevealId && writtenCheckAmountId ? `
    <div class="tripSettlementPanel${settlementExpanded ? " is-open" : ""}" data-settlement-panel>
      <div class="field">
        <label class="fieldLabel overline center" for="${escapeHtml(writtenCheckAmountId)}">WRITTEN CHECK AMOUNT</label>
        <div class="inputWrap inputWrap--prefix">
          <span class="moneyPrefix moneyGreen" aria-hidden="true">$</span>
          <input class="input inputWithPrefix" id="${escapeHtml(writtenCheckAmountId)}" type="text" inputmode="decimal" enterkeyhint="next" placeholder="0.00" value="${escapeHtml(String(writtenCheckAmountValue ?? ""))}" min="0" step="0.01" pattern="[0-9]*[.,]?[0-9]*" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" />
        </div>
      </div>
      <div class="tripSettlementSummary">
        <span>Dealer Adjustment</span>
        <b id="${escapeHtml(writtenCheckAmountId)}_adjustment">${escapeHtml(String(settlementAdjustmentText || "$0.00"))}</b>
      </div>
      ${settlementHintText ? `<div class="tripSettlementHint">${escapeHtml(settlementHintText)}</div>` : ""}
    </div>
  ` : "";

  return `
    <div class="card formCard tripFormFoundation ${escapeHtml(extraCardClass)}">
      <form id="${escapeHtml(formId)}">
        <section class="trip-section">
          ${isNew ? `
            <div class="tripGuidedHeader tripGuidedHeader--compact">
              <div class="tripGuidedHeaderTop tripGuidedHeaderTop--compact">
                <div class="dateRow">
                  <span class="dateIcon">${dateIconHtml}</span>
                  <input class="input datePill" id="${escapeHtml(dateId)}" type="date" enterkeyhint="next" value="${escapeHtml(String(dateValue || "").slice(0,10))}" />
                </div>
                <div class="tripLockChipRow">
                  ${notesLockBadge}
                </div>
              </div>
            </div>
          ` : `
            <div class="field">
              <div class="dateRow">
                <span class="dateIcon">${dateIconHtml}</span>
                <input class="input datePill" id="${escapeHtml(dateId)}" type="date" enterkeyhint="next" value="${escapeHtml(String(dateValue || "").slice(0,10))}" />
              </div>
            </div>
          `}
        </section>

        ${showSpeciesField ? `
        <section class="trip-section">
          <div class="field">
            <label class="fieldLabel overline center" for="${escapeHtml(speciesId)}">SPECIES</label>
            <div class="selectRowWrap">
              <select class="input" id="${escapeHtml(speciesId)}" enterkeyhint="next">${speciesOptions}</select>
              <span class="chev">›</span>
            </div>
          </div>
        </section>
        ` : ""}

        <section class="trip-section">
          <div class="tripSectionHeader">
            <h3>Catch Details</h3>
            <p>Enter pounds and $/LB — we’ll do the math.</p>
            ${settlementToggle}
          </div>
          <div class="tripCalculatorHero">
            <div class="tripCalculatorColumns" aria-label="Catch details calculator">
              <div class="tripCalcStack tripCalcStack--pounds">
                <span class="tripSummaryMetricLabel">POUNDS</span>
                <span class="tripSummaryMetricValue" id="${escapeHtml(poundsId)}_summary">${escapeHtml(String(poundsValue || "0.0"))}</span>
                <div class="tripCalcChip tripCalcChip--pounds">
                  <label class="sr-only" for="${escapeHtml(poundsId)}">Enter pounds</label>
                  <span class="tripCalcChipIcon" aria-hidden="true">⚖️</span>
                  <div class="inputWrap">
                    <input class="input tripCalcInput" id="${escapeHtml(poundsId)}" type="text" inputmode="decimal" enterkeyhint="next" placeholder="" value="${escapeHtml(String(poundsValue ?? ""))}" required min="0" step="0.1" pattern="[0-9]*[.,]?[0-9]*" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false"/>
                  </div>
                </div>
              </div>
              <span class="tripSummaryOp" aria-hidden="true">×</span>
              <div class="tripCalcStack tripCalcStack--rate">
                <span class="tripSummaryMetricLabel">$/LB</span>
                <span class="tripSummaryMetricValue" id="${escapeHtml(rateId)}_summary">$${escapeHtml(String(rateValue || "0.00"))}</span>
                <div class="tripCalcChip tripCalcChip--rate">
                  <label class="sr-only" for="${escapeHtml(rateId)}">Enter $/LB</label>
                  <span class="tripCalcChipIcon" aria-hidden="true">💲</span>
                  <div class="inputWrap inputWrap--rate">
                    <input class="input tripCalcInput" id="${escapeHtml(rateId)}" type="text" inputmode="decimal" enterkeyhint="next" placeholder="" value="${escapeHtml(String(rateValue ?? computePPL(Number(poundsValue || 0), Number(amountValue || 0)).toFixed(2)))}" min="0" step="0.01" pattern="[0-9]*[.,]?[0-9]*" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" />
                  </div>
                </div>
              </div>
              <span class="tripSummaryOp" aria-hidden="true">=</span>
              <div class="tripCalcStack tripCalcStack--amount">
                <span class="tripSummaryMetricLabel">AMOUNT</span>
                <span class="tripSummaryMetricValue" id="${escapeHtml(amountId)}_summary">$${escapeHtml(String(amountValue || "0.00"))}</span>
                <div class="tripCalcChip tripCalcChip--amount">
                  <label class="sr-only" for="${escapeHtml(amountId)}">Amount</label>
                  <span class="tripCalcChipIcon" aria-hidden="true">💵</span>
                  <div class="inputWrap inputWrap--prefix">
                    <span class="moneyPrefix moneyGreen" aria-hidden="true">$</span>
                    <input class="input inputWithPrefix tripCalcInput" id="${escapeHtml(amountId)}" type="text" inputmode="decimal" enterkeyhint="next" placeholder="0.00" value="${escapeHtml(String(amountValue ?? ""))}" min="0" step="0.01" pattern="[0-9]*[.,]?[0-9]*" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" />
                  </div>
                </div>
              </div>
            </div>
          </div>
          ${metricHelperText ? `<div class="tripMetricStateHelper" id="${escapeHtml(metricStateHelperId)}" aria-live="polite">${escapeHtml(metricStateHelperText)}</div>` : ""}
          ${settlementDetails}
        </section>

        <section class="trip-section tripDetailsSection">
          <div class="tripDetailsCard">
            ${isNew ? `
            <div class="tripContextRow" aria-label="Trip species context">
              <span class="tripContextLabel">Species</span>
              <span class="tripContextValue">Soft-shell Clams <span class="tripContextDivider" aria-hidden="true">·</span> <span class="tripContextBadge">Fixed</span></span>
            </div>
            ` : ""}
            <div class="field">
              <label class="fieldLabel overline center" for="${escapeHtml(dealerId)}">Dealer</label>
              <div class="tripSectionSubhead">Who are you selling to?</div>
              ${topDealerChipsHtml}
              <div class="selectRowWrap tripSelectPreview">
                <div class="tripSelectedValueRow">
                  <span class="tripSelectedValueIcon" aria-hidden="true">🏪</span>
                  <span class="tripSelectedValueText" id="${escapeHtml(dealerId)}_preview_value">${escapeHtml(dealerDisplayValue)}</span>
                  <span class="tripSelectedValueChevron" aria-hidden="true">›</span>
                </div>
                <select class="input" id="${escapeHtml(dealerId)}" autocomplete="organization" enterkeyhint="next">${dealerOptions}</select>
              </div>
            </div>

            <div class="field tripDetailsAreaField">
              <label class="fieldLabel overline center" for="${escapeHtml(areaId)}">Area</label>
              <div class="tripSectionSubhead">Where did you harvest?</div>
              ${topAreaChipsHtml}
              <div class="selectRowWrap tripSelectPreview">
                <div class="tripSelectedValueRow">
                  <span class="tripSelectedValueIcon" aria-hidden="true">📍</span>
                  <span class="tripSelectedValueText" id="${escapeHtml(areaId)}_preview_value">${escapeHtml(areaDisplayValue)}</span>
                  <span class="tripSelectedValueChevron" aria-hidden="true">›</span>
                </div>
                <select class="input" id="${escapeHtml(areaId)}" enterkeyhint="done">${areaOptions}</select>
              </div>
              <div class="tripAreaGuidance">${escapeHtml(areaGuidanceText)}</div>
            </div>
          </div>
        </section>

        ${showNotesField ? `
        <section class="trip-section">
          <div class="field">
            <label class="fieldLabel overline center" for="${escapeHtml(notesId)}">NOTES</label>
            <textarea class="input textarea" id="${escapeHtml(notesId)}" rows="3" maxlength="280" placeholder="Optional notes">${escapeHtml(String(notesValue ?? ""))}</textarea>
          </div>
        </section>
        ` : ""}

        ${isNew ? `
          <section class="trip-section tripInlineActions" aria-label="Trip form actions">
            <div class="tripActionPrimaryRow">
              <button class="btn primary" id="saveTrip" type="submit" form="${escapeHtml(formId)}" disabled>${escapeHtml(primaryActionLabel)}</button>
            </div>
            <div class="tripActionTextRow">
              <button class="tripDockSecondaryAction" id="${escapeHtml(secondaryActionId)}" type="button">${escapeHtml(secondaryActionLabel)}</button>
            </div>
            <div class="tripAutosaveLine"><span aria-hidden="true">🔒</span><span>Your draft is saved automatically</span></div>
          </section>
        ` : ""}
      </form>

      ${isEdit ? `
      <section class="trip-action-dock" aria-label="Trip form actions">
        <div class="tripActionBar">
          <div class="tripActionRow${tertiaryActionLabel ? " tripActionRow--three" : ""}">
            <button class="btn primary" id="saveEdit" type="submit" form="${escapeHtml(formId)}">${escapeHtml(primaryActionLabel)}</button>
            <button class="btn" id="${escapeHtml(secondaryActionId)}" type="button">${escapeHtml(secondaryActionLabel)}</button>
            ${tertiaryButton}
          </div>
        </div>
      </section>
      ` : ""}
    </div>
  `;
}
