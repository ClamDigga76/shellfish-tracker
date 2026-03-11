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

        <div id="updateBigStatus" class="settingsUpdateStatus">Up to date</div>
        <div class="muted settingsBodyTiny" id="updateVersionLine"></div>

        <div class="row settingsInlineRow">
          <button class="btn settingsInlineBtn" id="updatePrimary">Refresh app</button>
          <div class="muted settingsBodyTiny settingsInlineMsg" id="updateInlineMsg"></div>
        </div>

        <details class="settingsDetails">
          <summary class="muted settingsBodyTiny">Details</summary>
          <div class="muted settingsBodyTiny settingsBuildInfo" id="buildInfoDetails"></div>
        </details>
      </div>

      <div class="card settingsMiniCard">
        <b class="settingsMiniTitle">Help</b>
        <div class="sep settingsMiniSep"></div>
        <div class="muted settingsBodyTiny">Short instructions for manual entry, clipboard paste, backups, and install.</div>
        <div class="row settingsHelpRow">
          <button class="btn settingsInlineBtn" id="openHelp">Open Help</button>
        </div>
      </div>
    </div>

    <div class="card">
      <b>Appearance</b>
      <div class="sep"></div>
      <div class="muted small mt10">Choose how the app theme is applied.</div>
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
      <div class="muted small mt10">Create a backup file you can store in Files/Drive. Restore shows a preview first so you can confirm details before any changes.</div>
      <div class="muted small mt10" id="lastBackupLine"></div>
      <div class="hint mt10"><b>Backup recommended</b> before major updates.</div>
      <div class="row settingsBackupRow">
        <button class="btn primary settingsFlexBtn" id="downloadBackup">💾 Create Backup</button>
        <button class="btn settingsFlexBtn" id="restoreBackup">📥 Restore Backup</button>
        <input id="backupFile" type="file" accept="application/json,.json,text/plain,.txt" class="hiddenInput" />
      </div>
      <div class="muted small mt10">Tip: after you download a backup, move it into <b>iCloud Drive</b> (iPhone Files app) or <b>Google Drive</b> (Android) so it gets included in your regular phone/cloud backups. Keep at least one older backup too.</div>
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
      <div class="muted small mt10">Manage the dropdown lists used in New Trip and Edit Trip.</div>

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
      <div class="muted small mt6">Review terms, privacy details, and license information.</div>
      <div class="row mt10 gap10 wrap">
        <button class="btn" id="openTerms">Terms of Use</button>
        <button class="btn" id="openPrivacy">Privacy Policy</button>
        <button class="btn" id="openLicense">Open Source License</button>
      </div>
    </div>

    <details class="card" id="advancedBox">
      <summary class="settingsAdvancedSummary"><b>Advanced</b></summary>
      <div class="sep mt10"></div>

      <div class="row mt12 gap10 wrap">
        <button class="btn" id="copyDebug">Copy Debug</button>
        <button class="btn" id="refreshApp">Refresh App</button>
      </div>

      <div class="muted small mt10">Erase removes all trips and lists on this device. Use a backup first.</div>
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
              showToast(r.method === "share" ? "Share opened" : "Backup created");
            } else {
              showToast("Backup failed");
            }
          } catch (_) {
            showToast("Backup failed");
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
              showToast("Restore canceled");
              return;
            }

            if (options.mode === "replace") {
              const safetyChoice = await openReplaceSafetyBackupModal();
              if (safetyChoice === "cancel") {
                showToast("Restore canceled");
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
            showToast(Number.isFinite(n) ? `Restore complete (${n} trips, ${modeLabel})` : `Restore complete (${modeLabel})`);
            applyThemeMode();
            render();
          } catch (e) {
            showToast("Restore failed");
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
