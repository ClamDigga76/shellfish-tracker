import { createSettingsSupportRecoverySeam } from "./settings_support_recovery_v5.js";
import { escapeSettingsHtml } from "./settings_utils_v5.js";
import { renderInstallSurface, resolveInstallSummary, resolveInstallStatusPill } from "./install_surface_renderer_v5.js";
import { createStatusSurfaceSeam } from "./status_surface_seam_v5.js";

function settingsIconSvg(name) {
  const iconMap = {
    build: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8.5 12 4l8 4.5v7L12 20l-8-4.5v-7Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 4v16M4 8.5l8 4.5 8-4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`,
    install: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m8.5 12.2 2.4 2.4 4.6-5.1" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    backup: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 18.2A4.8 4.8 0 1 1 8.2 9a5.5 5.5 0 0 1 10.3 2.2A3.8 3.8 0 0 1 18 18.2H7Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="m12 9.4-.01 6m0 0-2.2-2.2m2.2 2.2 2.2-2.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    updates: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 8.8V5.5h-3.3M5 15.2v3.3h3.3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 12a6 6 0 0 0-10.2-4.2L5.7 10M6 12a6 6 0 0 0 10.2 4.2l2.1-2.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    choices: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s6-4.7 6-9.1a6 6 0 1 0-12 0c0 4.4 6 9.1 6 9.1Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="11" r="2.2" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>`,
    about: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.8" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 10.1v5.2M12 7.8h.01" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>`,
    support: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 13.6v-1.4a6.5 6.5 0 0 1 13 0v1.4M7.6 16.6h-1a1.6 1.6 0 0 1-1.6-1.6v-2a1.6 1.6 0 0 1 1.6-1.6h1.2v5.2ZM16.4 16.6h1a1.6 1.6 0 0 0 1.6-1.6v-2a1.6 1.6 0 0 0-1.6-1.6h-1.2v5.2ZM8 18.4c.8.7 2.1 1.1 4 1.1h1.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    reload: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.6 11.3a6.8 6.8 0 1 0-.8 4.5M18.6 11.3V7.6h-3.7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    restore: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.2 8.2A6.2 6.2 0 1 1 6 12h2.8M8.2 8.2V4.9M8.2 8.2h3.3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    deleted: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 7h11M9.2 7V5.5h5.6V7m-7 0 1 11h6.4l1-11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M10.5 10.4v4.7M13.5 10.4v4.7" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`
  };
  return iconMap[name] || iconMap.about;
}

export function createSettingsScreenOrchestrator({
  getState,
  getApp,
  ensureAreas,
  ensureDealers,
  renderPageHeader,
  settingsListManagement,
  displayBuildVersion,
  updateBuildBadge,
  bindNavHandlers,
  pushView,
  updateUpdateRow,
  updateBuildInfo,
  updateBackupHealthWarning,
  updateLastBackupLine,
  updateRestoreRollbackLine,
  exportBackup,
  parseBackupFileForRestore,
  openRestorePreviewModal,
  openReplaceSafetyBackupModal,
  importBackupFromFile,
  applyThemeMode,
  render,
  openRestoreErrorModal,
  openRestoreResultModal,
  restoreFromRollbackSnapshot,
  saveState,
  clearPendingTripUndo,
  openConfirmModal,
  restoreDeletedTrip,
  permanentlyDeleteDeletedTrip,
  clearDeletedTripsBin,
  showToast,
  getInstallSurfaceModel,
  runInstallAction,
  getReleaseValidationSnapshot,
  formatReleaseValidationLedger,
  copyTextWithFeedback
}) {
  const statusSurfaceSeam = createStatusSurfaceSeam({ escapeHtml: escapeSettingsHtml });
  const supportRecoverySeam = createSettingsSupportRecoverySeam({
    displayBuildVersion,
    showToast,
    render,
    saveState,
    applyThemeMode,
    exportBackup,
    parseBackupFileForRestore,
    openRestorePreviewModal,
    openReplaceSafetyBackupModal,
    importBackupFromFile,
    openRestoreErrorModal,
    openRestoreResultModal,
    restoreFromRollbackSnapshot,
    updateBackupHealthWarning,
    updateLastBackupLine,
    updateRestoreRollbackLine,
    clearPendingTripUndo,
    restoreDeletedTrip,
    permanentlyDeleteDeletedTrip,
    clearDeletedTripsBin,
    openConfirmModal,
    getReleaseValidationSnapshot,
    formatReleaseValidationLedger,
    copyTextWithFeedback
  });

  function shouldShowReleaseValidationSurface() {
    try {
      const params = new URLSearchParams(window.location.search || "");
      return ["support", "dev", "releaseValidation"].some((flag) => params.get(flag) === "1");
    } catch (_) {
      return false;
    }
  }

  function renderSettings(opts = {}) {
    const state = getState();

    ensureAreas();
    ensureDealers();

    const s = state.settings || (state.settings = {});
    const listMode = String(s.listMode || "areas").toLowerCase();
    const deletedTrips = Array.isArray(state.deletedTrips) ? state.deletedTrips : [];
    const deletedTripsHtml = supportRecoverySeam.buildDeletedTripsHtml(deletedTrips);

    const areaCount = Array.isArray(state.areas) ? state.areas.length : 0;
    const dealerCount = Array.isArray(state.dealers) ? state.dealers.length : 0;
    const installModel = typeof getInstallSurfaceModel === "function"
      ? getInstallSurfaceModel()
      : null;
    const shouldShowReleaseValidation = shouldShowReleaseValidationSurface();
    const backupTrustSurfaceHtml = statusSurfaceSeam.renderStatusSurface({
      variant: "settingsTrust",
      emphasis: "soft",
      compact: true,
      className: "settingsBackupTrustSurface",
      title: "Protect your trip records",
      statusPill: "Recommended",
      body: "Save a backup before updates, restoring data, or switching phones.",
      support: "For the safest backup, choose a place that saves off this device: iCloud Drive on Apple devices or Google Drive on Android.",
      minorNote: "If your only backup stays on this phone and the phone is lost, damaged, or replaced, your trip data may be lost too. Keep one current backup and one older backup in iCloud Drive or Google Drive."
    });

    getApp().innerHTML = `
    ${renderPageHeader("settings")}
    <div class="settingsHealthStrip card" aria-label="Settings health summary">
      <div class="settingsHealthCell">
        <div class="settingsHealthLabel"><span class="settingsHealthIcon">${settingsIconSvg("build")}</span>Version</div>
        <div class="settingsHealthValue" id="settingsHealthBuild">${displayBuildVersion}</div>
      </div>
      <div class="settingsHealthCell">
        <div class="settingsHealthLabel"><span class="settingsHealthIcon">${settingsIconSvg("install")}</span>Install</div>
        <div class="settingsHealthValue" id="settingsHealthInstall">${installModel ? resolveInstallStatusPill(installModel) : "Checking"}</div>
      </div>
      <div class="settingsHealthCell">
        <div class="settingsHealthLabel"><span class="settingsHealthIcon">${settingsIconSvg("backup")}</span>Backup</div>
        <div class="settingsHealthValue" id="settingsHealthBackup">Checking</div>
      </div>
      <div class="settingsHealthCell">
        <div class="settingsHealthLabel"><span class="settingsHealthIcon">${settingsIconSvg("choices")}</span>Lists</div>
        <div class="settingsHealthValue" id="settingsHealthChoices">${areaCount}A / ${dealerCount}D</div>
      </div>
    </div>

    <div class="settingsGroupBlock">
      <button class="card settingsSectionCard settingsGroupedCard settingsNavCard" id="settingsHelpNav" type="button">
        <span class="settingsCardBadge" aria-hidden="true">${settingsIconSvg("support")}</span>
        <div class="settingsAccordionMeta">
          <div class="settingsGroupLabel">Help</div>
          <div class="settingsAccordionTitle">App guide</div>
          <div class="muted small settingsAccordionStatus">Open help for trips, backup, updates, install, and troubleshooting.</div>
        </div>
        <div class="settingsAccordionRight">
          <span class="settingsAccordionChevron settingsAccordionChevron--nav" aria-hidden="true">›</span>
        </div>
      </button>
    </div>

    <div class="settingsGroupBlock" id="settingsSafetyRecovery">
      <details class="card settingsSectionCard settingsGroupedCard settingsAccordionCard" data-settings-accordion>
        <summary class="settingsAccordionSummary">
          <span class="settingsCardBadge" aria-hidden="true">${settingsIconSvg("backup")}</span>
          <div class="settingsAccordionMeta">
            <div class="settingsGroupLabel">Backup</div>
            <div class="settingsAccordionTitle">Backup and restore trips</div>
            <div class="muted small settingsAccordionStatus" id="safetySummaryLine">Protect your trip records with a saved backup.</div>
          </div>
          <div class="settingsAccordionRight">
            <span class="settingsAccordionAction">Backup</span>
            <span class="settingsAccordionPill settingsAccordionPill--ghost" id="safetyStatusPill">Checking</span>
            <span class="settingsAccordionChevron" aria-hidden="true">▾</span>
          </div>
        </summary>
        <div class="settingsRow settingsRow--split">
          <div>
            <div class="settingsRowTitle">Backup and restore trips</div>
          </div>
          <span class="settingsValuePill">Backup status</span>
        </div>
        <div class="settingsRow settingsRow--status">
          <div id="backupHealthLane" class="settingsBackupHealth" hidden aria-live="polite" aria-hidden="true"></div>
          <div class="muted small" id="lastBackupLine"></div>
        </div>
        <div class="settingsRow settingsRow--action settingsBackupRow">
          <button class="btn primary settingsFlexBtn" id="downloadBackup">Create Backup</button>
          <button class="btn settingsFlexBtn" id="restoreBackup">Restore</button>
          <input id="backupFile" type="file" accept="application/json,.json,text/plain,.txt" class="hiddenInput" />
        </div>
        <div class="settingsRow settingsRow--minor settingsRow--statusSurface">${backupTrustSurfaceHtml}</div>
        <div class="settingsRow settingsRow--status">
          <div class="muted small" id="restoreRollbackLine"></div>
        </div>
        <div class="settingsRow settingsRow--action">
          <button class="btn settingsFlexBtn" id="restoreRollbackBtn" hidden>Undo last restore</button>
        </div>
        ${deletedTripsHtml}
      </details>
    </div>

    <div class="settingsGroupBlock" id="settingsUpdatesSupport">
      <details class="card settingsSectionCard settingsGroupedCard settingsAccordionCard" data-settings-accordion>
        <summary class="settingsAccordionSummary">
          <span class="settingsCardBadge" aria-hidden="true">${settingsIconSvg("updates")}</span>
          <div class="settingsAccordionMeta">
            <div class="settingsGroupLabel">Updates</div>
            <div class="settingsAccordionTitle">App version and updates</div>
            <span class="hidden" aria-hidden="true">Version & update status</span>
            <div class="muted small settingsAccordionStatus" id="updatesSummaryLine">Check for the latest app version.</div>
          </div>
          <div class="settingsAccordionRight settingsAccordionRight--updates">
            <button class="btn settingsSummaryActionBtn" id="settingsUpdateSummaryAction" type="button" aria-label="Run update action">Update</button>
            <span class="settingsAccordionPill settingsAccordionPill--ghost" id="updatesStatusPill">Checking</span>
            <span class="settingsAccordionChevron" aria-hidden="true">▾</span>
          </div>
        </summary>
        <div class="settingsRow settingsRow--split">
          <div>
            <div class="settingsRowTitle settingsMiniTitle">Updates</div>
          </div>
          <span class="settingsValuePill">Status</span>
        </div>
        <div class="settingsRow settingsRow--status">
          <div id="updateBigStatus" class="settingsUpdateStatus">Checking version…</div>
          <div class="muted settingsBodyTiny" id="updateVersionLine"></div>
        </div>
        <div class="settingsRow settingsRow--action">
          <button class="btn settingsInlineBtn" id="updatePrimary">Update app now</button>
          <div class="muted settingsBodyTiny settingsInlineMsg" id="updateInlineMsg"></div>
        </div>
        <details class="settingsDetails settingsRow">
          <summary class="muted settingsBodyTiny">Technical details</summary>
          <div class="muted settingsBodyTiny settingsBuildInfo" id="buildInfoDetails"></div>
        </details>
      </details>
    </div>

    <div class="settingsGroupBlock" id="settingsDataLists">
      <details class="card settingsSectionCard settingsGroupedCard settingsAccordionCard" data-settings-accordion>
        <summary class="settingsAccordionSummary">
          <span class="settingsCardBadge" aria-hidden="true">${settingsIconSvg("choices")}</span>
          <div class="settingsAccordionMeta">
            <div class="settingsGroupLabel">Lists</div>
            <div class="settingsAccordionTitle">Areas & dealers</div>
            <div class="muted small settingsAccordionStatus" id="dataListsSummaryLine">${areaCount} areas • ${dealerCount} dealers</div>
          </div>
          <div class="settingsAccordionRight">
            <span class="settingsAccordionAction">Manage</span>
            <span class="settingsAccordionPill settingsAccordionPill--ghost" id="dataListsStatusPill">${areaCount} / ${dealerCount}</span>
            <span class="settingsAccordionChevron" aria-hidden="true">▾</span>
          </div>
        </summary>
        <div class="settingsRow settingsRow--split">
          <div>
            <div class="settingsRowTitle">Manage trip setup</div>
            <div class="muted small">Manage the areas and dealers you use when saving trips.</div>
          </div>
          <span class="settingsValuePill">Edit</span>
        </div>

        <div class="settingsRow settingsRow--field">
          <div class="segWrap">
            <button class="chip segBtn ${listMode === "areas" ? "on is-selected" : ""}" data-listmode="areas" type="button">Areas</button>
            <button class="chip segBtn ${listMode === "dealers" ? "on is-selected" : ""}" data-listmode="dealers" type="button">Dealers</button>
            <button class="chip segBtn ${listMode === "species" ? "on is-selected" : ""}" data-listmode="species" type="button">Species</button>
          </div>
        </div>
        <div class="settingsRow settingsRow--field">
          <div id="listMgmtPanel">${settingsListManagement.renderListMgmtPanel(listMode)}</div>
        </div>
      </details>
    </div>

    <div class="settingsGroupBlock" id="settingsInstallApp">
      <details class="card settingsSectionCard settingsGroupedCard settingsAccordionCard" data-settings-accordion>
        <summary class="settingsAccordionSummary">
          <span class="settingsCardBadge" aria-hidden="true">${settingsIconSvg("install")}</span>
          <div class="settingsAccordionMeta">
            <div class="settingsGroupLabel">Install</div>
            <div class="settingsAccordionTitle">App setup on this device</div>
            <div class="muted small settingsAccordionStatus" id="installSummaryLine">This device is set up.</div>
          </div>
          <div class="settingsAccordionRight">
            <span class="settingsAccordionPill settingsAccordionPill--ghost" id="installStatusPill">Checking</span>
            <span class="settingsAccordionChevron" aria-hidden="true">▾</span>
          </div>
        </summary>
        ${renderInstallSurface({
          model: installModel,
          mode: "full",
          escapeHtml: escapeSettingsHtml,
          actionId: "installActionBtn",
          helpId: "installHelpBtn"
        })}
      </details>
    </div>

    <div class="settingsGroupBlock" id="settingsAbout">
      <details class="card settingsSectionCard settingsGroupedCard settingsAccordionCard" data-settings-accordion>
        <summary class="settingsAccordionSummary">
          <span class="settingsCardBadge" aria-hidden="true">${settingsIconSvg("about")}</span>
          <div class="settingsAccordionMeta">
            <div class="settingsGroupLabel">About</div>
            <div class="settingsAccordionTitle">Version, support, and legal</div>
            <div class="muted small settingsAccordionStatus" id="aboutSummaryLine">Version details • Privacy • Terms</div>
          </div>
          <div class="settingsAccordionRight">
            <span class="settingsAccordionPill settingsAccordionPill--ghost" id="aboutStatusPill">${displayBuildVersion}</span>
            <span class="settingsAccordionChevron" aria-hidden="true">▾</span>
          </div>
        </summary>
        <div class="settingsRow settingsRow--split">
          <div>
            <div class="settingsRowTitle">Version</div>
            <div class="muted small">Current app version on this device.</div>
          </div>
          <span class="settingsValuePill">${displayBuildVersion}</span>
        </div>
        <div class="settingsRow settingsRow--minor">
          <div id="buildBadge" class="muted small"></div>
        </div>
        <div class="settingsRow settingsRow--minor">
          <div class="muted small">Bank the Catch • Operated by <b>JMW Legacy LLC.</b></div>
          <div class="muted small mt6">Support: <a class="settingsEmail" href="mailto:jmwlegacyllc@gmail.com">jmwlegacyllc@gmail.com</a></div>
          <div class="muted small mt6">Need setup or recovery help? Open the <b>Help guide</b>.</div>
          <div class="muted small mt8">© 2026 JMW Legacy LLC. All rights reserved.</div>
        </div>
        <div class="settingsRow settingsRow--split settingsRow--minor">
          <div>
            <div class="settingsRowTitle">Legal and privacy</div>
            <div class="muted small">Terms, privacy, and software license details.</div>
          </div>
          <span class="settingsValuePill">Info</span>
        </div>
        <div class="settingsRow settingsRow--action">
          <div class="row gap10 wrap">
            <button class="btn" id="openTerms">Terms of Use</button>
            <button class="btn" id="openPrivacy">Privacy Policy</button>
            <button class="btn" id="openLicense">Software License</button>
          </div>
        </div>
      </details>
    </div>

    <div class="settingsGroupBlock" id="settingsAdvanced">
      <details class="card settingsSectionCard settingsGroupedCard settingsAdvancedCard settingsAccordionCard" id="advancedBox" data-settings-accordion>
        <summary class="settingsAccordionSummary">
          <span class="settingsCardBadge" aria-hidden="true">${settingsIconSvg("support")}</span>
          <div class="settingsAccordionMeta">
            <div class="settingsGroupLabel">SUPPORT</div>
            <div class="settingsAccordionTitle">Troubleshooting and reset tools</div>
            <div class="muted small settingsAccordionStatus" id="advancedSummaryLine">Copy troubleshooting info, reload the app, or erase data if needed.</div>
          </div>
          <div class="settingsAccordionRight">
            <span class="settingsAccordionPill settingsAccordionPill--ghost" id="advancedStatusPill">Support</span>
            <span class="settingsAccordionChevron" aria-hidden="true">▾</span>
          </div>
        </summary>
        <div class="settingsRow settingsRow--action mt10">
          <div class="row gap10 wrap">
            <button class="btn" id="copyDebug">Copy troubleshooting info</button>
            <button class="btn" id="refreshApp">Reload app</button>
          </div>
        </div>
${shouldShowReleaseValidation ? `        <div class="settingsRow settingsRow--split settingsRow--minor">
          <div>
            <div class="settingsRowTitle">Release-trial validation</div>
            <div class="muted small">Mark checks for this release candidate.</div>
          </div>
          <span class="settingsValuePill" id="releaseValidationBuild">${displayBuildVersion}</span>
        </div>
        <div class="settingsRow settingsRow--status">
          <div id="releaseValidationSummary" class="settingsUpdateStatus">Preparing release snapshot…</div>
          <div class="muted settingsBodyTiny" id="releaseValidationStamp"></div>
          <div class="muted settingsBodyTiny" id="releaseValidationManualStamp">Manual checklist last updated: Not saved yet</div>
          <div class="muted settingsBodyTiny" id="releaseValidationDraftNotice"></div>
        </div>
        <div class="settingsRow settingsRow--field">
          <div id="releaseValidationSignals" class="muted settingsBodyTiny"></div>
        </div>
        <div class="settingsRow settingsRow--field">
          <label class="muted small" for="releaseCheckBrowser">Browser mode opens current release</label>
          <div class="selectRowWrap settingsSelectWrap mt6">
            <select id="releaseCheckBrowser" class="select" aria-label="Browser mode validation">
              <option value="not-run">Not run</option>
              <option value="pass">Pass</option>
              <option value="fail">Fail</option>
            </select>
            <span class="chev" aria-hidden="true">▾</span>
          </div>
        </div>
        <div class="settingsRow settingsRow--field">
          <label class="muted small" for="releaseCheckInstalled">Installed mode opens current release</label>
          <div class="selectRowWrap settingsSelectWrap mt6">
            <select id="releaseCheckInstalled" class="select" aria-label="Installed mode validation">
              <option value="not-run">Not run</option>
              <option value="pass">Pass</option>
              <option value="fail">Fail</option>
            </select>
            <span class="chev" aria-hidden="true">▾</span>
          </div>
        </div>
        <div class="settingsRow settingsRow--field">
          <label class="muted small" for="releaseCheckUpdate">Update pickup after reload</label>
          <div class="selectRowWrap settingsSelectWrap mt6">
            <select id="releaseCheckUpdate" class="select" aria-label="Update pickup validation">
              <option value="not-run">Not run</option>
              <option value="pass">Pass</option>
              <option value="fail">Fail</option>
            </select>
            <span class="chev" aria-hidden="true">▾</span>
          </div>
        </div>
        <div class="settingsRow settingsRow--field">
          <label class="muted small" for="releaseCheckReopen">Reopen keeps expected build</label>
          <div class="selectRowWrap settingsSelectWrap mt6">
            <select id="releaseCheckReopen" class="select" aria-label="Reopen validation">
              <option value="not-run">Not run</option>
              <option value="pass">Pass</option>
              <option value="fail">Fail</option>
            </select>
            <span class="chev" aria-hidden="true">▾</span>
          </div>
        </div>
        <div class="settingsRow settingsRow--field">
          <label class="muted small" for="releaseCheckRecovery">Recovery/reset trust flow</label>
          <div class="selectRowWrap settingsSelectWrap mt6">
            <select id="releaseCheckRecovery" class="select" aria-label="Recovery validation">
              <option value="not-run">Not run</option>
              <option value="pass">Pass</option>
              <option value="fail">Fail</option>
            </select>
            <span class="chev" aria-hidden="true">▾</span>
          </div>
        </div>
        <div class="settingsRow settingsRow--field">
          <label class="muted small" for="releaseValidationNotes">Release trial notes (optional)</label>
          <textarea id="releaseValidationNotes" class="input mt6" rows="3" placeholder="Example: iPhone standalone reopened twice and stayed on v438."></textarea>
        </div>
        <div class="settingsRow settingsRow--action">
          <div class="row gap10 wrap">
            <button class="btn" id="refreshReleaseSnapshot">Refresh snapshot</button>
            <button class="btn" id="copyReleaseLedger">Copy release ledger</button>
          </div>
        </div>
` : ""}        <div class="settingsRow settingsRow--minor">
          <div class="muted small">Copy app troubleshooting info, then send it with a short note about what happened.</div>
        </div>
        <div class="settingsRow settingsRow--danger">
          <div class="muted small"><b>Danger zone:</b> Erase removes all trips, list entries, and local recovery metadata on this device. Create a backup first.</div>
          <div class="row mt10">
            <button class="btn danger" id="resetData">Erase All Data</button>
          </div>
        </div>
      </details>
    </div>
  `;
    updateBuildBadge();

    bindNavHandlers(state);

    const accordionEls = Array.from(document.querySelectorAll("[data-settings-accordion]"));
    accordionEls.forEach((detailsEl) => {
      detailsEl.addEventListener("toggle", () => {
        if (!detailsEl.open) return;
        accordionEls.forEach((otherEl) => {
          if (otherEl === detailsEl) return;
          otherEl.open = false;
        });
      });
    });

    document.getElementById("settingsHelpNav").onclick = () => {
      pushView(state, "help");
    };

    const installActionBtn = document.getElementById("installActionBtn");
    const installHelpBtn = document.getElementById("installHelpBtn");
    const updatesSummaryLine = document.getElementById("updatesSummaryLine");
    const installSummaryLine = document.getElementById("installSummaryLine");
    const backupSummaryLine = document.getElementById("safetySummaryLine");
    const advancedSummaryLine = document.getElementById("advancedSummaryLine");
    const updatesStatusPill = document.getElementById("updatesStatusPill");
    const settingsUpdateSummaryAction = document.getElementById("settingsUpdateSummaryAction");
    const safetyStatusPill = document.getElementById("safetyStatusPill");
    const installStatusPill = document.getElementById("installStatusPill");
    const aboutStatusPill = document.getElementById("aboutStatusPill");
    const advancedStatusPill = document.getElementById("advancedStatusPill");
    const dataListsSummaryLine = document.getElementById("dataListsSummaryLine");
    const dataListsStatusPill = document.getElementById("dataListsStatusPill");
    const settingsHealthInstall = document.getElementById("settingsHealthInstall");
    const settingsHealthBackup = document.getElementById("settingsHealthBackup");
    const settingsHealthChoices = document.getElementById("settingsHealthChoices");
    const toCompactBackupHealth = (summaryText) => {
      const normalized = String(summaryText || "").trim();
      if (!normalized) return "Checking";
      const lower = normalized.toLowerCase();
      if (lower.includes("checking")) return "Checking";
      if (lower.includes("today")) return "Today";
      if (lower.includes("yesterday") || /\b1\s+day(?:\b|s\b)/.test(lower)) return "1 day ago";
      if (lower.includes("never") || lower.includes("none")) return "None yet";
      if (lower.includes("backed up") || lower.includes("fresh")) return "Backed up";
      const dayMatch = lower.match(/(\d+)\s+day/);
      if (dayMatch) return `${dayMatch[1]} days ago`;
      return "Backed up";
    };

    const dataListsSummaryText = `${areaCount} areas • ${dealerCount} dealers`;
    const dataListsPillText = `${areaCount}A/${dealerCount}D`;
    if (dataListsSummaryLine) dataListsSummaryLine.textContent = dataListsSummaryText;
    if (dataListsStatusPill) {
      dataListsStatusPill.textContent = dataListsPillText;
      dataListsStatusPill.title = dataListsSummaryText;
    }
    if (settingsHealthChoices) settingsHealthChoices.textContent = `${areaCount}A / ${dealerCount}D`;

    if (updatesSummaryLine) {
      updatesSummaryLine.textContent = "Check for the latest app version.";
    }
    if (settingsUpdateSummaryAction) {
      settingsUpdateSummaryAction.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
      });
    }
    if (backupSummaryLine) {
      backupSummaryLine.textContent = "Checking backup freshness";
    }
    if (settingsHealthBackup) {
      settingsHealthBackup.textContent = toCompactBackupHealth(backupSummaryLine?.textContent || "");
    }
    if (advancedSummaryLine) {
      advancedSummaryLine.textContent = shouldShowReleaseValidation
        ? "Release checks and reset tools"
        : "Help, safe reload, and reset tools";
    }
    const aboutSummaryLine = document.getElementById("aboutSummaryLine");
    if (aboutSummaryLine) {
      aboutSummaryLine.textContent = "Version details • Privacy • Terms";
    }
    if (aboutStatusPill) {
      aboutStatusPill.textContent = displayBuildVersion;
      aboutStatusPill.title = `Current app version ${displayBuildVersion}`;
    }
    if (advancedStatusPill) {
      advancedStatusPill.textContent = "Support";
      advancedStatusPill.title = "Support tools and reset actions";
    }

    if (installSummaryLine) {
      installSummaryLine.textContent = installModel
        ? resolveInstallSummary(installModel)
        : "Checking install status";
    }
    if (installStatusPill) {
      installStatusPill.textContent = installModel
        ? resolveInstallStatusPill(installModel)
        : "Checking";
      installStatusPill.title = installSummaryLine?.textContent || "Install readiness status";
    }
    if (settingsHealthInstall) {
      settingsHealthInstall.textContent = installStatusPill?.textContent || "Checking";
      settingsHealthInstall.title = installSummaryLine?.textContent || "Install readiness status";
    }
    if (installActionBtn && installModel) {
      installActionBtn.onclick = async () => {
        if (typeof runInstallAction !== "function") return;
        const result = await runInstallAction();
        if (result?.message) showToast(result.message);
        renderSettings();
      };
    }
    if (installHelpBtn) {
      installHelpBtn.onclick = () => {
        state.helpJump = "install";
        state.view = "help";
        state.lastAction = "nav:help-install";
        saveState();
        render();
      };
    }

    updateUpdateRow();
    const updateBigStatusEl = document.getElementById("updateBigStatus");
    const updateVersionLineEl = document.getElementById("updateVersionLine");
    if (updatesSummaryLine && updateBigStatusEl) {
      const formatUpdateStatusPill = (statusText) => {
        const normalized = String(statusText || "").toLowerCase();
        if (!normalized) return "Checking";
        if (normalized.includes("new") || normalized.includes("update")) return "Attention";
        if (normalized.includes("latest") || normalized.includes("current") || normalized.includes("up to date")) return "Up to date";
        return "Checking";
      };
      const extractVersionToken = (versionMetaText) => {
        const match = String(versionMetaText || "").match(/\bv\d+(?:\.\d+){1,3}\b/i);
        return match ? match[0].toLowerCase() : "";
      };
      const syncUpdateSummaryLine = () => {
        const status = String(updateBigStatusEl.textContent || "").trim();
        const versionMeta = String(updateVersionLineEl?.textContent || "").trim();
        updatesSummaryLine.textContent = versionMeta ? `${status} • ${versionMeta}` : (status || "Version status available");
        if (updatesStatusPill) {
          const versionToken = extractVersionToken(versionMeta);
          updatesStatusPill.textContent = versionToken || formatUpdateStatusPill(status);
          updatesStatusPill.title = updatesSummaryLine.textContent || "Update status";
        }
      };
      syncUpdateSummaryLine();
      const updateObserver = new MutationObserver(() => syncUpdateSummaryLine());
      updateObserver.observe(updateBigStatusEl, { childList: true, characterData: true, subtree: true });
      if (updateVersionLineEl) {
        updateObserver.observe(updateVersionLineEl, { childList: true, characterData: true, subtree: true });
      }
    }
    try {
      updateBuildInfo();
    } catch (_) {}

    if (shouldShowReleaseValidation) {
      const { hydrateReleaseValidationSurface } = supportRecoverySeam.createReleaseValidationController({
        advancedSummaryLine
      });
      hydrateReleaseValidationSurface();
    }

    try {
      settingsListManagement.bindListMgmtHandlers();
    } catch (_) {}

    supportRecoverySeam.bindBackupRestoreControls();
    const syncBackupSummaryLine = () => {
      supportRecoverySeam.syncBackupSummaryLine({
        backupSummaryLine,
        backupStatusPill: safetyStatusPill,
        deletedTripsCount: deletedTrips.length
      });
      if (settingsHealthBackup) {
        settingsHealthBackup.textContent = toCompactBackupHealth(backupSummaryLine?.textContent || "");
        settingsHealthBackup.title = backupSummaryLine?.textContent || "Backup freshness status";
      }
    };
    syncBackupSummaryLine();
    const lastBackupLineEl = document.getElementById("lastBackupLine");
    const restoreRollbackLineEl = document.getElementById("restoreRollbackLine");
    if (backupSummaryLine && (lastBackupLineEl || restoreRollbackLineEl)) {
      const backupSummaryObserver = new MutationObserver(() => syncBackupSummaryLine());
      if (lastBackupLineEl) {
        backupSummaryObserver.observe(lastBackupLineEl, { childList: true, characterData: true, subtree: true });
      }
      if (restoreRollbackLineEl) {
        backupSummaryObserver.observe(restoreRollbackLineEl, { childList: true, characterData: true, subtree: true });
      }
      setTimeout(syncBackupSummaryLine, 0);
    }

    supportRecoverySeam.bindDeletedTripRecoveryControls();

    document.getElementById("openTerms").onclick = () => {
      window.location.href = "legal/terms.html";
    };
    document.getElementById("openPrivacy").onclick = () => {
      window.location.href = "legal/privacy.html";
    };
    document.getElementById("openLicense").onclick = () => {
      window.location.href = "legal/license.html";
    };
  }

  return {
    renderSettings
  };
}
