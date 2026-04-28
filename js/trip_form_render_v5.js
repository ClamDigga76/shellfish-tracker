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
  metricStateHelperText = "Pounds × Pay Rate = Amount"
}) {
  const isEdit = mode === "edit";
  const isNew = mode === "new";
  const tertiaryButton = tertiaryActionLabel ? `<button class="btn danger" id="${escapeHtml(tertiaryActionId)}" type="button">${escapeHtml(tertiaryActionLabel)}</button>` : "";
  const tertiaryTextButton = tertiaryActionLabel ? `<button class="tripDockSecondaryAction" id="${escapeHtml(tertiaryActionId)}" type="button">${escapeHtml(tertiaryActionLabel)}</button>` : "";
  const notesLockBadge = `
    <button class="tripTopLockPill" id="newTripLockedNotesInfo" type="button" aria-label="Notes are locked for this screen">
      <span aria-hidden="true">🔒</span>
      <span>Notes</span>
    </button>
  `;
  const lockedSpeciesValue = `<div class="tripLockedValue"><span aria-hidden="true">🔒</span><span>Soft-shell Clams</span><small>Locked</small></div>`;
  const settlementToggle = settlementRevealId
    ? `<button class="tripSettlementReveal" id="${escapeHtml(settlementRevealId)}" type="button" aria-expanded="${settlementExpanded ? "true" : "false"}">${settlementExpanded ? "Hide check details" : "Check Total"}</button>`
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
          <div class="field${isNew ? " tripTopFieldRow" : ""}">
            <div class="dateRow">
              <span class="dateIcon">${dateIconHtml}</span>
              <input class="input datePill" id="${escapeHtml(dateId)}" type="date" enterkeyhint="next" value="${escapeHtml(String(dateValue || "").slice(0,10))}" />
            </div>
            ${isNew ? notesLockBadge : ""}
          </div>
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
        ` : (isNew ? `
        <section class="trip-section">
          <div class="field">
            <label class="fieldLabel overline center">SPECIES</label>
            ${lockedSpeciesValue}
          </div>
        </section>
        ` : "")}

        <section class="trip-section">
          <div class="tripMetricsRow">
            <div class="field tripMetricField">
              <label class="fieldLabel overline tripMetricLabel tripMetricLabel--pounds center" for="${escapeHtml(poundsId)}">POUNDS</label>
              <div class="inputWrap inputWrap--suffix">
                <input class="input inputWithSuffix" id="${escapeHtml(poundsId)}" type="text" inputmode="decimal" enterkeyhint="next" placeholder="0.0" value="${escapeHtml(String(poundsValue ?? ""))}" required min="0" step="0.1" pattern="[0-9]*[.,]?[0-9]*" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false"/>
                <span class="unitSuffix lbsBlue" aria-hidden="true">lbs</span>
              </div>
            </div>
            <div class="tripMetricSymbol" aria-hidden="true">×</div>
            <div class="field tripMetricField">
              <label class="fieldLabel overline tripMetricLabel tripMetricLabel--price center" for="${escapeHtml(rateId)}">$/LB</label>
              <div class="inputWrap inputWrap--rate">
                <input class="input" id="${escapeHtml(rateId)}" type="text" inputmode="decimal" enterkeyhint="next" placeholder="0.00" value="${escapeHtml(String(rateValue ?? computePPL(Number(poundsValue || 0), Number(amountValue || 0)).toFixed(2)))}" min="0" step="0.01" pattern="[0-9]*[.,]?[0-9]*" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" />
              </div>
            </div>
            <div class="tripMetricSymbol" aria-hidden="true">=</div>
            <div class="field tripMetricField">
              <label class="fieldLabel overline tripMetricLabel tripMetricLabel--amount center" for="${escapeHtml(amountId)}">AMOUNT</label>
              <div class="inputWrap inputWrap--prefix">
                <span class="moneyPrefix moneyGreen" aria-hidden="true">$</span>
                <input class="input inputWithPrefix" id="${escapeHtml(amountId)}" type="text" inputmode="decimal" enterkeyhint="next" placeholder="0.00" value="${escapeHtml(String(amountValue ?? ""))}" min="0" step="0.01" pattern="[0-9]*[.,]?[0-9]*" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" />
              </div>
            </div>
          </div>
          <div class="tripMetricStateHelper" id="${escapeHtml(metricStateHelperId)}" aria-live="polite">${escapeHtml(metricStateHelperText)}</div>
          ${settlementToggle}
          ${settlementDetails}
        </section>

        <section class="trip-section">
          <div class="field">
            <label class="fieldLabel overline center" for="${escapeHtml(dealerId)}">DEALER</label>
            ${topDealerChipsHtml}
            <div class="selectRowWrap">
              <select class="input" id="${escapeHtml(dealerId)}" autocomplete="organization" enterkeyhint="next">${dealerOptions}</select>
              <span class="chev">›</span>
            </div>
          </div>
        </section>

        <section class="trip-section">
          <div class="field">
            <label class="fieldLabel overline center" for="${escapeHtml(areaId)}">AREA</label>
            ${topAreaChipsHtml}
            <div class="selectRowWrap">
              <select class="input" id="${escapeHtml(areaId)}" enterkeyhint="done">${areaOptions}</select>
              <span class="chev">›</span>
            </div>
            <div class="tripAreaGuidance">${escapeHtml(areaGuidanceText)}</div>
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

      </form>

      <section class="trip-action-dock" aria-label="Trip form actions">
        <div class="tripActionBar">
          ${isNew ? `
            <div class="tripActionPrimaryRow">
              <button class="btn primary" id="saveTrip" type="submit" form="${escapeHtml(formId)}" disabled>${escapeHtml(primaryActionLabel)}</button>
            </div>
            <div class="tripActionTextRow">
              <button class="tripDockSecondaryAction" id="${escapeHtml(secondaryActionId)}" type="button">${escapeHtml(secondaryActionLabel)}</button>
              ${tertiaryTextButton}
            </div>
          ` : `
            <div class="tripActionRow${tertiaryActionLabel ? " tripActionRow--three" : ""}">
              <button class="btn primary" id="saveEdit" type="submit" form="${escapeHtml(formId)}">${escapeHtml(primaryActionLabel)}</button>
              <button class="btn" id="${escapeHtml(secondaryActionId)}" type="button">${escapeHtml(secondaryActionLabel)}</button>
              ${tertiaryButton}
            </div>
          `}
        </div>
      </section>
    </div>
  `;
}
