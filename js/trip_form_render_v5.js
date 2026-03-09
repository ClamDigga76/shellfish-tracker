import { computePPL, formatMoney, escapeHtml } from "./utils_v5.js";

export function renderTripEntryForm({
  mode = "new",
  formId,
  dateId,
  dealerId,
  poundsId,
  amountId,
  areaId,
  rateId,
  todayBtnId,
  dateValue,
  dealerOptions,
  areaOptions,
  topDealerChipsHtml,
  topAreaChipsHtml,
  poundsValue,
  amountValue,
  primaryActionLabel,
  secondaryActionLabel,
  secondaryActionId,
  tertiaryActionLabel = "",
  tertiaryActionId = "",
  extraCardClass = "",
  dateIconHtml = "📅"
}) {
  const isEdit = mode === "edit";
  const modeBanner = isEdit ? `
    <section class="trip-section trip-edit-indicator" aria-label="Edit mode indicator">
      <h1 class="edit-trip-title">EDIT TRIP</h1>
      <div class="editModePill" role="status" aria-live="polite">
        <span class="editModePillIcon" aria-hidden="true">✎</span>
        <span>Editing Trip</span>
      </div>
    </section>
  ` : "";

  const tertiaryButton = tertiaryActionLabel ? `<button class="btn danger" id="${escapeHtml(tertiaryActionId)}" type="button">${escapeHtml(tertiaryActionLabel)}</button>` : "";

  return `
    <div class="card formCard tripFormFoundation ${escapeHtml(extraCardClass)}">
      <form id="${escapeHtml(formId)}">
        ${modeBanner}

        <section class="trip-section">
          <div class="field">
            <label class="fieldLabel overline center" for="${escapeHtml(dateId)}">HARVEST DATE</label>
            <div class="dateRow">
              <span class="dateIcon">${dateIconHtml}</span>
              <input class="input datePill" id="${escapeHtml(dateId)}" type="date" enterkeyhint="next" value="${escapeHtml(String(dateValue || "").slice(0,10))}" />
              <button class="todayBtn" id="${escapeHtml(todayBtnId)}" type="button">Today</button>
            </div>
          </div>
        </section>

        <section class="trip-section">
          <div class="tripMetricsRow">
            <div class="field">
              <label class="fieldLabel overline" for="${escapeHtml(poundsId)}">POUNDS</label>
              <div class="inputWrap inputWrap--suffix">
                <span class="inputLane inputLane--value">
                  <input class="input inputWithSuffix" id="${escapeHtml(poundsId)}" type="text" inputmode="decimal" enterkeyhint="next" placeholder="0.0" value="${escapeHtml(String(poundsValue ?? ""))}" required min="0" step="0.1" pattern="[0-9]*[.,]?[0-9]*" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false"/>
                </span>
                <span class="inputLane inputLane--indicator" aria-hidden="true">
                  <span class="unitSuffix lbsBlue">lbs</span>
                </span>
              </div>
            </div>
            <div class="field">
              <label class="fieldLabel overline" for="${escapeHtml(amountId)}">AMOUNT</label>
              <div class="inputWrap inputWrap--prefix">
                <span class="inputLane inputLane--indicator" aria-hidden="true">
                  <span class="moneyPrefix moneyGreen">$</span>
                </span>
                <span class="inputLane inputLane--value">
                  <input class="input inputWithPrefix" id="${escapeHtml(amountId)}" type="text" inputmode="decimal" enterkeyhint="next" placeholder="0.00" value="${escapeHtml(String(amountValue ?? ""))}" required min="0" step="0.01" pattern="[0-9]*[.,]?[0-9]*" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false"/>
                </span>
              </div>
            </div>
            <div class="field">
              <label class="fieldLabel overline" for="${escapeHtml(rateId)}">$/LB</label>
              <div class="inputWrap inputWrap--rate">
                <span class="inputLane inputLane--value">
                  <input class="input" id="${escapeHtml(rateId)}" type="text" value="${formatMoney(computePPL(Number(poundsValue || 0), Number(amountValue || 0)))}" readonly tabindex="-1" aria-readonly="true" />
                </span>
              </div>
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
          </div>
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

        <section class="trip-section trip-actions">
          <div class="tripActionBar">
            <div class="tripActionRow${tertiaryActionLabel ? " tripActionRow--three" : ""}">
              <button class="btn primary" id="${isEdit ? "saveEdit" : "saveTrip"}" type="submit" ${isEdit ? "" : "disabled"}>${escapeHtml(primaryActionLabel)}</button>
              <button class="btn${isEdit ? "" : " danger"}" id="${escapeHtml(secondaryActionId)}" type="button">${escapeHtml(secondaryActionLabel)}</button>
              ${tertiaryButton}
            </div>
          </div>
        </section>
      </form>
    </div>
  `;
}
