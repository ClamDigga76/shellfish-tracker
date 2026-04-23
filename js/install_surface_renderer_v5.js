export function resolveInstallSummary(model){
  const actionNeeded = !!(model?.actionEnabled && model?.showAction);
  return actionNeeded ? "Install action available" : "Install setup is up to date";
}

export function resolveInstallStatusPill(model){
  return String(model?.statusPill || "").toLowerCase().includes("installed") ? "Installed" : "Browser";
}

export function renderInstallSurface({
  model,
  mode = "full",
  escapeHtml = (value) => String(value || ""),
  actionId = "installActionBtn",
  helpId = "installHelpBtn"
} = {}){
  if (!model) return "";

  const trustNote = "Browser mode and Installed mode can store different local data. Create a backup before switching devices, browsers, or app modes.";
  const primaryActionHtml = model.showAction
    ? `<button class="btn ${mode === "full" ? "primary settingsInlineBtn" : ""}" id="${escapeHtml(actionId)}" type="button" ${model.actionEnabled ? "" : "disabled"}>${escapeHtml(model.actionLabel)}</button>`
    : "";

  if (mode === "compact") {
    return `
      <section class="homeSection homeInstallSection">
        <div class="noticeBand homeInstallBand" role="status" aria-live="polite">
          <div class="noticeTitle">Best experience: install the app</div>
          <div class="row gap10 wrap mt6">
            <span class="settingsValuePill">${escapeHtml(model.statusPill)}</span>
            <span class="muted small">${escapeHtml(model.statusLine)}</span>
          </div>
          <div class="muted small noticeBody mt8">${escapeHtml(model.statusHint)}</div>
          <div class="muted small noticeBody mt8"><b>${escapeHtml(model.whyTitle)}</b> ${escapeHtml(model.whyBody)}</div>
          <div class="muted small noticeBody mt8">${escapeHtml(model.stepsLine)}</div>
          <div class="muted small noticeBody mt8">${escapeHtml(trustNote)}</div>
          <div class="row mt10 noticeActions">
            ${primaryActionHtml}
            <button class="btn" id="${escapeHtml(helpId)}" type="button">Open install help</button>
          </div>
        </div>
      </section>
    `;
  }

  return `
    <div class="settingsRow settingsRow--split">
      <div>
        <div class="settingsRowTitle settingsMiniTitle">App mode</div>
      </div>
      <span class="settingsValuePill">${escapeHtml(model.statusPill)}</span>
    </div>
    <div class="settingsRow settingsRow--status">
      <div class="settingsUpdateStatus">${escapeHtml(model.statusLine)}</div>
      <div class="muted settingsBodyTiny">${escapeHtml(model.statusHint)}</div>
    </div>
    <div class="settingsRow settingsRow--action settingsInstallActions">
      ${primaryActionHtml}
      <button class="btn settingsInlineBtn" id="${escapeHtml(helpId)}" type="button">Open install help</button>
    </div>
    <div class="settingsRow settingsRow--minor">
      <div class="hint"><b>${escapeHtml(model.whyTitle)}</b> ${escapeHtml(model.whyBody)}</div>
      <div class="muted small mt8">${escapeHtml(model.stepsLine)}</div>
      <div class="muted small mt8">${escapeHtml(trustNote)}</div>
    </div>
  `;
}
