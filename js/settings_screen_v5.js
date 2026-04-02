import { createSettingsSupportRecoverySeam } from "./settings_support_recovery_v5.js";
import { escapeSettingsHtml } from "./settings_utils_v5.js";

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
    restoreDeletedTrip,
    permanentlyDeleteDeletedTrip,
    clearDeletedTripsBin,
    openConfirmModal,
    getReleaseValidationSnapshot,
    formatReleaseValidationLedger,
    copyTextWithFeedback
  });

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
    const settingsJumpTargets = [
      { id: "settingsUpdatesSupport", label: "Updates" },
      { id: "settingsInstallApp", label: "Install" },
      { id: "settingsSafetyRecovery", label: "Safety" },
      { id: "settingsDataLists", label: "Data Lists" },
      { id: "settingsAbout", label: "About" },
      { id: "settingsAdvanced", label: "Advanced" }
    ];

    getApp().innerHTML = `
    ${renderPageHeader("settings")}
    <div class="settingsJumpNavCard card" aria-label="Settings section quick links">
      <div class="settingsJumpNavRow" role="navigation" aria-label="Jump to section">
        ${settingsJumpTargets.map((target) => `<button class="chip settingsJumpChip" type="button" data-settings-jump="${target.id}">${target.label}</button>`).join("")}
      </div>
    </div>

    <div class="settingsGroupBlock" id="settingsUpdatesSupport">
      <details class="card settingsSectionCard settingsGroupedCard settingsAccordionCard" data-settings-accordion>
        <summary class="settingsAccordionSummary">
          <div class="settingsAccordionMeta">
            <div class="settingsGroupLabel">Updates & Support</div>
            <div class="settingsAccordionTitle">Update status and help</div>
            <div class="muted small settingsAccordionStatus" id="updatesSummaryLine">Checking version status…</div>
          </div>
          <span class="settingsAccordionChevron" aria-hidden="true">▾</span>
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
          <button class="btn settingsInlineBtn" id="updatePrimary">Reload latest build</button>
          <div class="muted settingsBodyTiny settingsInlineMsg" id="updateInlineMsg"></div>
        </div>
        <details class="settingsDetails settingsRow">
          <summary class="muted settingsBodyTiny">Technical details</summary>
          <div class="muted settingsBodyTiny settingsBuildInfo" id="buildInfoDetails"></div>
        </details>
        <div class="settingsRow settingsRow--split settingsRow--minor">
          <div>
            <div class="settingsRowTitle">Help</div>
            <div class="muted small">Open full install, backup, update, and support walkthroughs.</div>
          </div>
          <button class="btn settingsInlineBtn" id="openHelp">Open Help</button>
        </div>
      </details>
    </div>

    <div class="settingsGroupBlock" id="settingsInstallApp">
      <details class="card settingsSectionCard settingsGroupedCard settingsAccordionCard" data-settings-accordion>
        <summary class="settingsAccordionSummary">
          <div class="settingsAccordionMeta">
            <div class="settingsGroupLabel">Install App</div>
            <div class="settingsAccordionTitle">Install status and actions</div>
            <div class="muted small settingsAccordionStatus" id="installSummaryLine">Checking install state…</div>
          </div>
          <span class="settingsAccordionChevron" aria-hidden="true">▾</span>
        </summary>
        <div class="settingsRow settingsRow--split">
          <div>
            <div class="settingsRowTitle settingsMiniTitle">App mode</div>
          </div>
          <span class="settingsValuePill" id="installModePill">Checking…</span>
        </div>
        <div class="settingsRow settingsRow--status">
          <div id="installModeLine" class="settingsUpdateStatus">Checking app mode…</div>
          <div class="muted settingsBodyTiny" id="installStatusHint"></div>
        </div>
        <div class="settingsRow settingsRow--action settingsInstallActions">
          <button class="btn primary settingsInlineBtn" id="installActionBtn" type="button">Install app</button>
          <button class="btn settingsInlineBtn" id="installHelpBtn" type="button">Open full install help</button>
        </div>
        <div class="settingsRow settingsRow--minor">
          <div class="hint" id="installWhyLine"></div>
          <div class="muted small mt8" id="installStepsLine"></div>
        </div>
      </details>
    </div>

    <div class="settingsGroupBlock" id="settingsSafetyRecovery">
      <details class="card settingsSectionCard settingsGroupedCard settingsAccordionCard" data-settings-accordion>
        <summary class="settingsAccordionSummary">
          <div class="settingsAccordionMeta">
            <div class="settingsGroupLabel">Safety & Recovery</div>
            <div class="settingsAccordionTitle">Backup and restore tools</div>
            <div class="muted small settingsAccordionStatus" id="safetySummaryLine">Backup freshness</div>
          </div>
          <span class="settingsAccordionChevron" aria-hidden="true">▾</span>
        </summary>
        <div class="settingsRow settingsRow--split">
          <div>
            <div class="settingsRowTitle">Backup & Restore</div>
          </div>
          <span class="settingsValuePill">Freshness</span>
        </div>
        <div class="settingsRow settingsRow--status">
          <div id="backupHealthLane" class="settingsBackupHealth" hidden aria-live="polite" aria-hidden="true"></div>
          <div class="muted small" id="lastBackupLine"></div>
        </div>
        <div class="settingsRow settingsRow--action settingsBackupRow">
          <button class="btn primary settingsFlexBtn" id="downloadBackup">💾 Create Backup</button>
          <button class="btn settingsFlexBtn" id="restoreBackup">📥 Restore Backup</button>
          <input id="backupFile" type="file" accept="application/json,.json,text/plain,.txt" class="hiddenInput" />
        </div>
        <div class="settingsRow settingsRow--minor">
          <div class="hint"><b>Recommended:</b> create a fresh backup before major updates or Replace restore.</div>
          <div class="muted small mt8">Keep one current copy and one older copy in iCloud Drive or Google Drive.</div>
        </div>
        <div class="settingsRow settingsRow--status">
          <div class="muted small" id="restoreRollbackLine"></div>
        </div>
        <div class="settingsRow settingsRow--action">
          <button class="btn settingsFlexBtn" id="restoreRollbackBtn" hidden>↩ Undo last restore</button>
        </div>
        ${deletedTripsHtml}
      </details>
    </div>

    <div class="settingsGroupBlock" id="settingsDataLists">
      <details class="card settingsSectionCard settingsGroupedCard settingsAccordionCard" data-settings-accordion>
        <summary class="settingsAccordionSummary">
          <div class="settingsAccordionMeta">
            <div class="settingsGroupLabel">Data Lists</div>
            <div class="settingsAccordionTitle">Trip list management</div>
            <div class="muted small settingsAccordionStatus" id="dataListsSummaryLine">${areaCount} areas • ${dealerCount} dealers</div>
          </div>
          <span class="settingsAccordionChevron" aria-hidden="true">▾</span>
        </summary>
        <div class="settingsRow settingsRow--split">
          <div>
            <div class="settingsRowTitle">List Management</div>
            <div class="muted small">Edit the lists used in New Trip and Edit Trip.</div>
          </div>
          <span class="settingsValuePill">Edit</span>
        </div>

        <div class="settingsRow settingsRow--field">
          <div class="segWrap">
            <button class="chip segBtn ${listMode === "areas" ? "on is-selected" : ""}" data-listmode="areas" type="button">Areas</button>
            <button class="chip segBtn ${listMode === "dealers" ? "on is-selected" : ""}" data-listmode="dealers" type="button">Dealers</button>
            <button class="chip segBtn settingsStackedSegBtn" type="button" disabled aria-disabled="true" title="Coming soon">
              <div>Species</div>
              <div class="muted tiny settingsSoonNote">Coming soon</div>
            </button>
          </div>
        </div>
        <div class="settingsRow settingsRow--field">
          <div id="listMgmtPanel">${settingsListManagement.renderListMgmtPanel(listMode)}</div>
        </div>
      </details>
    </div>

    <div class="settingsGroupBlock" id="settingsAbout">
      <details class="card settingsSectionCard settingsGroupedCard settingsAccordionCard" data-settings-accordion>
        <summary class="settingsAccordionSummary">
          <div class="settingsAccordionMeta">
            <div class="settingsGroupLabel">About</div>
            <div class="settingsAccordionTitle">Version, support, and legal</div>
            <div class="muted small settingsAccordionStatus" id="aboutSummaryLine">Build ${displayBuildVersion}</div>
          </div>
          <span class="settingsAccordionChevron" aria-hidden="true">▾</span>
        </summary>
        <div class="settingsRow settingsRow--split">
          <div>
            <div class="settingsRowTitle">Build</div>
            <div class="muted small">Current build on this device.</div>
          </div>
          <span class="settingsValuePill">${displayBuildVersion}</span>
        </div>
        <div class="settingsRow settingsRow--minor">
          <div id="buildBadge" class="muted small"></div>
        </div>
        <div class="settingsRow settingsRow--minor">
          <div class="muted small">Bank the Catch • Created by <b>Jeremy Wood</b></div>
          <div class="muted small mt6">Support: <a class="settingsEmail" href="mailto:jeremywwood76@gmail.com">jeremywwood76@gmail.com</a></div>
          <div class="muted small mt6">Need setup or recovery help? Open <b>Help</b>.</div>
          <div class="muted small mt8">© 2026 Jeremy Wood. All rights reserved.</div>
        </div>
        <div class="settingsRow settingsRow--split settingsRow--minor">
          <div>
            <div class="settingsRowTitle">Legal & Trust</div>
            <div class="muted small">Terms, privacy, and open-source details.</div>
          </div>
          <span class="settingsValuePill">Info</span>
        </div>
        <div class="settingsRow settingsRow--action">
          <div class="row gap10 wrap">
            <button class="btn" id="openTerms">Terms of Use</button>
            <button class="btn" id="openPrivacy">Privacy Policy</button>
            <button class="btn" id="openLicense">Open Source License</button>
          </div>
        </div>
      </details>
    </div>

    <div class="settingsGroupBlock" id="settingsAdvanced">
      <details class="card settingsSectionCard settingsGroupedCard settingsAdvancedCard settingsAccordionCard" id="advancedBox" data-settings-accordion>
        <summary class="settingsAccordionSummary">
          <div class="settingsAccordionMeta">
            <div class="settingsGroupLabel">Advanced</div>
            <div class="settingsAccordionTitle">Support bundle and reset</div>
            <div class="muted small settingsAccordionStatus" id="advancedSummaryLine">Support tools and release checks</div>
          </div>
          <span class="settingsAccordionChevron" aria-hidden="true">▾</span>
        </summary>
        <div class="settingsRow settingsRow--action mt10">
          <div class="row gap10 wrap">
            <button class="btn" id="copyDebug">Copy support bundle</button>
            <button class="btn" id="refreshApp">Reload app safely</button>
          </div>
        </div>
        <div class="settingsRow settingsRow--split settingsRow--minor">
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
        <div class="settingsRow settingsRow--minor">
          <div class="muted small">Copy this support bundle (privacy-safe runtime metadata only) with a short repro note.</div>
        </div>
        <div class="settingsRow settingsRow--danger">
          <div class="muted small"><b>Danger zone:</b> Erase removes all trips and lists on this device. Create a backup first.</div>
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

    const jumpButtons = Array.from(document.querySelectorAll("[data-settings-jump]"));
    jumpButtons.forEach((button) => {
      button.onclick = () => {
        const targetId = String(button.getAttribute("data-settings-jump") || "").trim();
        if (!targetId) return;
        const targetEl = document.getElementById(targetId);
        if (!targetEl) return;
        const detailsEl = targetEl.querySelector("[data-settings-accordion]");
        if (detailsEl) detailsEl.open = true;
        targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
      };
    });

    document.getElementById("openHelp").onclick = () => {
      pushView(state, "help");
    };

    const installModel = typeof getInstallSurfaceModel === "function"
      ? getInstallSurfaceModel()
      : null;
    const installModePill = document.getElementById("installModePill");
    const installModeLine = document.getElementById("installModeLine");
    const installStatusHint = document.getElementById("installStatusHint");
    const installWhyLine = document.getElementById("installWhyLine");
    const installStepsLine = document.getElementById("installStepsLine");
    const installActionBtn = document.getElementById("installActionBtn");
    const installHelpBtn = document.getElementById("installHelpBtn");
    const updatesSummaryLine = document.getElementById("updatesSummaryLine");
    const installSummaryLine = document.getElementById("installSummaryLine");
    const safetySummaryLine = document.getElementById("safetySummaryLine");
    const advancedSummaryLine = document.getElementById("advancedSummaryLine");

    if (updatesSummaryLine) {
      updatesSummaryLine.textContent = "Checking version status…";
    }
    if (safetySummaryLine) {
      safetySummaryLine.textContent = `Recently deleted: ${deletedTrips.length}`;
    }
    if (advancedSummaryLine) {
      advancedSummaryLine.textContent = `Build ${displayBuildVersion} • Release checks not run`;
    }

    if (installModel) {
      if (installModePill) installModePill.textContent = installModel.statusPill;
      if (installModeLine) installModeLine.textContent = installModel.statusLine;
      if (installStatusHint) installStatusHint.textContent = installModel.statusHint;
      if (installSummaryLine) installSummaryLine.textContent = `${installModel.statusPill} • ${installModel.statusHint}`;
      if (installWhyLine) installWhyLine.innerHTML = `<b>${escapeSettingsHtml(installModel.whyTitle)}</b> ${escapeSettingsHtml(installModel.whyBody)}`;
      if (installStepsLine) installStepsLine.textContent = installModel.stepsLine;
      if (installActionBtn) {
        installActionBtn.textContent = installModel.actionLabel;
        installActionBtn.disabled = !installModel.actionEnabled;
        installActionBtn.hidden = !installModel.showAction;
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
    }

    updateUpdateRow();
    const updateBigStatusEl = document.getElementById("updateBigStatus");
    const updateVersionLineEl = document.getElementById("updateVersionLine");
    if (updatesSummaryLine && updateBigStatusEl) {
      const syncUpdateSummaryLine = () => {
        const status = String(updateBigStatusEl.textContent || "").trim();
        const versionMeta = String(updateVersionLineEl?.textContent || "").trim();
        updatesSummaryLine.textContent = versionMeta ? `${status} • ${versionMeta}` : (status || "Update status available");
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

    const { hydrateReleaseValidationSurface } = supportRecoverySeam.createReleaseValidationController({
      advancedSummaryLine
    });

    hydrateReleaseValidationSurface();

    try {
      settingsListManagement.bindListMgmtHandlers();
    } catch (_) {}

    supportRecoverySeam.bindBackupRestoreControls();
    supportRecoverySeam.syncSafetySummaryLine({
      safetySummaryLine,
      deletedTripsCount: deletedTrips.length
    });

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
