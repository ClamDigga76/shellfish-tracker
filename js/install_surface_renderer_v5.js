import { createStatusSurfaceSeam } from "./status_surface_seam_v5.js";

export function resolveInstallSummary(model){
  const actionNeeded = !!(model?.actionEnabled && model?.showAction);
  return actionNeeded ? "Install available" : "Install status up to date";
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

  const trustNote = "Browser version and installed app can store different local data. Create a backup before switching phones, browsers, or app icons.";
  const statusSurface = createStatusSurfaceSeam({ escapeHtml });
  const primaryActionHtml = model.showAction
    ? `<button class="btn ${mode === "full" ? "primary settingsInlineBtn" : ""}" id="${escapeHtml(actionId)}" type="button" ${model.actionEnabled ? "" : "disabled"}>${escapeHtml(model.actionLabel)}</button>`
    : "";

  if (mode === "compact") {
    return `
      <section class="homeSection homeInstallSection">
        ${statusSurface.renderStatusSurface({
          variant: "homeInstall",
          emphasis: "soft",
          compact: false,
          className: "homeInstallBand",
          title: "Best experience: install the app",
          statusPill: model.statusPill,
          body: model.statusLine,
          support: model.statusHint,
          minorNoteHtml: `<b>${escapeHtml(model.whyTitle)}</b> ${escapeHtml(model.whyBody)}<br>${escapeHtml(model.stepsLine)}<br>${escapeHtml(trustNote)}`,
          actions: [
            ...(model.showAction ? [{ id: actionId, label: model.actionLabel, disabled: !model.actionEnabled }] : []),
            { id: helpId, label: "Open install help" }
          ]
        })}
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
