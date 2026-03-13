export function createSettingsScreenOrchestrator({
  getState,
  getApp,
  ensureAreas,
  ensureDealers,
  renderPageHeader,
  themeModeSystem,
  themeModeLight,
  themeModeDark,
  settingsListManagement,
  displayBuildVersion,
  updateBuildBadge,
  bindThemeControls,
  bindNavHandlers,
  pushView,
  updateUpdateRow,
  updateBuildInfo,
  updateLastBackupLine,
  exportBackup,
  parseBackupFileForRestore,
  openRestorePreviewModal,
  openReplaceSafetyBackupModal,
  importBackupFromFile,
  applyThemeMode,
  render,
  openRestoreErrorModal,
  showToast
}) {
  function renderSettings(opts = {}) {
    const state = getState();

    ensureAreas();
    ensureDealers();

    const s = state.settings || (state.settings = {});
    const listMode = String(s.listMode || "areas").toLowerCase();

    getApp().innerHTML = `
    ${renderPageHeader("settings")}

    <div class="row settingsTopRow">
      <div class="card settingsMiniCard">
        <b class="settingsMiniTitle">Updates</b>
        <div class="sep settingsMiniSep"></div>

        <div id="updateBigStatus" class="settingsUpdateStatus">Checking for updates…</div>
        <div class="muted settingsBodyTiny" id="updateVersionLine"></div>

        <div class="row settingsInlineRow">
          <button class="btn settingsInlineBtn" id="updatePrimary">Load latest update</button>
          <div class="muted settingsBodyTiny settingsInlineMsg" id="updateInlineMsg"></div>
        </div>

        <div class="hint mt10">Check app health here anytime. When a new build is ready, tap <b>Load latest update</b> for a safe reload to the latest version.</div>

        <details class="settingsDetails">
          <summary class="muted settingsBodyTiny">Details</summary>
          <div class="muted settingsBodyTiny settingsBuildInfo" id="buildInfoDetails"></div>
        </details>
      </div>

      <div class="card settingsMiniCard">
        <b class="settingsMiniTitle">Help</b>
        <div class="sep settingsMiniSep"></div>
        <div class="muted settingsBodyTiny">Quick trust guidance for trips, reports, install/offline use, and backup safety.</div>
        <div class="row settingsHelpRow">
          <button class="btn settingsInlineBtn" id="openHelp">View Help</button>
        </div>
      </div>
    </div>

    <div class="card">
      <b>Appearance</b>
      <div class="sep"></div>
      <div class="muted small mt10">Choose how app appearance is applied.</div>
      <div class="field mt10">
        <label class="label" for="themeMode">Theme</label>
        <div class="selectRowWrap">
          <select id="themeMode" class="select" aria-label="Theme">
            <option value="${themeModeSystem}">System (default)</option>
            <option value="${themeModeLight}">Light</option>
            <option value="${themeModeDark}">Dark</option>
          </select>
          <span class="chev" aria-hidden="true">▾</span>
        </div>
      </div>
    </div>

    <div class="card">
      <b>Backup & Restore</b>
      <div class="sep"></div>
      <div class="muted small mt10">Create a backup you can save to Files/Drive. Restore always opens a preview first so you can confirm details before changes are applied.</div>
      <div class="muted small mt10" id="lastBackupLine"></div>
      <div class="hint mt10"><b>Recommended:</b> create a fresh backup before major updates, restore actions, or bulk edits.</div>
      <div class="row settingsBackupRow">
        <button class="btn primary settingsFlexBtn" id="downloadBackup">💾 Create Backup</button>
        <button class="btn settingsFlexBtn" id="restoreBackup">📥 Restore Backup</button>
        <input id="backupFile" type="file" accept="application/json,.json,text/plain,.txt" class="hiddenInput" />
      </div>
      <div class="muted small mt10">Tip: after creating a backup, move it to <b>iCloud Drive</b> (iPhone Files) or <b>Google Drive</b> (Android) so it stays in your normal safety routine. Keep at least one older copy too.</div>
      <div class="hint mt10">Restore preview shows trip count and lets you choose <b>Merge</b> or <b>Replace</b> before anything changes.</div>
    </div>

    <div class="card">
      <b>List Management</b>
      <div class="sep"></div>

      <div class="segWrap mt10">
        <button class="chip segBtn ${listMode === "areas" ? "on is-selected" : ""}" data-listmode="areas" type="button">Areas</button>
        <button class="chip segBtn ${listMode === "dealers" ? "on is-selected" : ""}" data-listmode="dealers" type="button">Dealers</button>
        <button class="chip segBtn settingsStackedSegBtn" type="button" disabled aria-disabled="true" title="Coming soon">
          <div>Species</div>
          <div class="muted tiny settingsSoonNote">Coming soon</div>
        </button>
      </div>
      <div class="muted small mt10">Manage the lists used in New Trip and Edit Trip.</div>

      <div id="listMgmtPanel">${settingsListManagement.renderListMgmtPanel(listMode)}</div>
    </div>

    <div class="card">
      <b>About</b>
      <div class="sep"></div>
      <div class="muted small mt10">Created by <b>Jeremy Wood</b></div>
      <div class="muted small mt6">Support/contact: <a class="settingsEmail" href="mailto:jeremywwood76@gmail.com">jeremywwood76@gmail.com</a></div>
      <div class="muted small mt8">Version: <b>${displayBuildVersion}</b></div>
      <div id="buildBadge" class="muted small mt8"></div>

      <div class="muted small mt8">© 2026 Jeremy Wood. All rights reserved.</div>
      <div class="sep mt10"></div>
      <div class="muted small mt10"><b>Legal & Trust</b></div>
      <div class="muted small mt6">Review terms, privacy details, and open-source license info.</div>
      <div class="row mt10 gap10 wrap">
        <button class="btn" id="openTerms">Terms of Use</button>
        <button class="btn" id="openPrivacy">Privacy Policy</button>
        <button class="btn" id="openLicense">Open Source License</button>
      </div>
    </div>

    <details class="card" id="advancedBox">
      <summary class="settingsAdvancedSummary"><b>Advanced</b></summary>
      <div class="sep mt10"></div>
      <div class="muted small">Diagnostics and recovery tools for app-health troubleshooting. Use only when needed.</div>

      <div class="row mt12 gap10 wrap">
        <button class="btn" id="copyDebug">Copy diagnostics info</button>
        <button class="btn" id="refreshApp">Reload app safely</button>
      </div>

      <div class="sep mt12"></div>
      <div class="muted small mt10"><b>Danger zone:</b> Erase removes all trips and lists stored on this device. Create a backup first.</div>
      <div class="row mt12">
        <button class="btn danger" id="resetData">Erase All Data</button>
      </div>
    </details>
  `;
    updateBuildBadge();
    bindThemeControls();

    bindNavHandlers(state);

    document.getElementById("openHelp").onclick = () => {
      pushView(state, "help");
    };

    updateUpdateRow();
    try {
      updateBuildInfo();
    } catch (_) {}

    try {
      settingsListManagement.bindListMgmtHandlers();
    } catch (_) {}

    try {
      updateLastBackupLine();
      const btnDl = document.getElementById("downloadBackup");
      const btnRs = document.getElementById("restoreBackup");
      const inp = document.getElementById("backupFile");

      if (btnDl) {
        btnDl.onclick = async () => {
          try {
            const r = await exportBackup();
            if (r?.ok) {
              showToast(r.method === "share" ? "Share sheet opened" : "Backup saved");
            } else {
              showToast("Could not create backup");
            }
          } catch (_) {
            showToast("Could not create backup");
          }
        };
      }

      if (btnRs && inp) {
        btnRs.onclick = () => {
          try {
            inp.value = "";
          } catch (_) {}
          try {
            inp.click();
          } catch (_) {}
        };
        inp.onchange = async () => {
          const file = inp.files && inp.files[0];
          try {
            inp.value = "";
          } catch (_) {}
          if (!file) return;

          try {
            const preview = await parseBackupFileForRestore(file);
            const options = await openRestorePreviewModal(preview);
            if (!options) {
              showToast("Restore cancelled");
              return;
            }

            if (options.mode === "replace") {
              const safetyChoice = await openReplaceSafetyBackupModal();
              if (safetyChoice === "cancel") {
                showToast("Restore cancelled");
                return;
              }
              if (safetyChoice === "created") {
                showToast("Safety backup created");
              }
            }

            const result = await importBackupFromFile(file, {
              parsedBackup: preview,
              mode: options.mode,
              includeSettings: options.includeSettings
            });

            const n = Number(result?.tripsAdded);
            const modeLabel = result?.mode === "replace" ? "Replace" : "Merge";
            showToast(Number.isFinite(n) ? `Restore finished (${n} trips, ${modeLabel})` : `Restore finished (${modeLabel})`);
            applyThemeMode();
            render();
          } catch (e) {
            showToast("Could not restore backup");
            await openRestoreErrorModal(e);
          }
        };
      }
    } catch (_) {}

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
