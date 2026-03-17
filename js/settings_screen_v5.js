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

    <div class="settingsGroupBlock">
      <div class="settingsGroupLabel">Appearance</div>
      <div class="card settingsSectionCard settingsGroupedCard">
        <div class="settingsRow settingsRow--split">
          <div>
            <div class="settingsRowTitle">Theme</div>
            <div class="muted small">Choose how app appearance is applied.</div>
          </div>
          <span class="settingsValuePill">Mode</span>
        </div>
        <div class="settingsRow settingsRow--field">
          <div class="selectRowWrap settingsSelectWrap">
            <select id="themeMode" class="select" aria-label="Theme">
              <option value="${themeModeSystem}">System (default)</option>
              <option value="${themeModeLight}">Light</option>
              <option value="${themeModeDark}">Dark</option>
            </select>
            <span class="chev" aria-hidden="true">▾</span>
          </div>
        </div>
      </div>
    </div>

    <div class="settingsGroupBlock">
      <div class="settingsGroupLabel">Updates & Support</div>
      <div class="card settingsSectionCard settingsGroupedCard">
        <div class="settingsRow settingsRow--split">
          <div>
            <div class="settingsRowTitle settingsMiniTitle">Updates</div>
            <div class="muted small">Check status and switch to the newest build safely.</div>
          </div>
          <span class="settingsValuePill">Status</span>
        </div>
        <div class="settingsRow settingsRow--status">
          <div id="updateBigStatus" class="settingsUpdateStatus">Checking for updates…</div>
          <div class="muted settingsBodyTiny" id="updateVersionLine"></div>
        </div>
        <div class="settingsRow settingsRow--action">
          <button class="btn settingsInlineBtn" id="updatePrimary">Load latest update</button>
          <div class="muted settingsBodyTiny settingsInlineMsg" id="updateInlineMsg"></div>
        </div>
        <details class="settingsDetails settingsRow">
          <summary class="muted settingsBodyTiny">Diagnostics details</summary>
          <div class="muted settingsBodyTiny settingsBuildInfo" id="buildInfoDetails"></div>
        </details>
        <div class="settingsRow settingsRow--split settingsRow--minor">
          <div>
            <div class="settingsRowTitle">Help</div>
            <div class="muted small">Practical guidance for install, offline use, and backup safety.</div>
          </div>
          <button class="btn settingsInlineBtn" id="openHelp">View Help</button>
        </div>
      </div>
    </div>

    <div class="settingsGroupBlock">
      <div class="settingsGroupLabel">Safety & Recovery</div>
      <div class="card settingsSectionCard settingsGroupedCard">
        <div class="settingsRow settingsRow--split">
          <div>
            <div class="settingsRowTitle">Backup & Restore</div>
            <div class="muted small">Create or restore backups with a preview and clear warnings before changes are applied.</div>
          </div>
          <span class="settingsValuePill">Freshness</span>
        </div>
        <div class="settingsRow settingsRow--status">
          <div class="muted small" id="lastBackupLine"></div>
        </div>
        <div class="settingsRow settingsRow--action settingsBackupRow">
          <button class="btn primary settingsFlexBtn" id="downloadBackup">💾 Create Backup</button>
          <button class="btn settingsFlexBtn" id="restoreBackup">📥 Restore Backup</button>
          <input id="backupFile" type="file" accept="application/json,.json,text/plain,.txt" class="hiddenInput" />
        </div>
        <div class="settingsRow settingsRow--minor">
          <div class="hint"><b>Recommended:</b> create a fresh backup before major updates, restore actions (especially Replace), or bulk edits.</div>
          <div class="muted small mt8">After creating a backup, move it to <b>iCloud Drive</b> (iPhone Files) or <b>Google Drive</b> (Android) and keep one older copy too.</div>
        </div>
      </div>
    </div>

    <div class="settingsGroupBlock">
      <div class="settingsGroupLabel">Data Lists</div>
      <div class="card settingsSectionCard settingsGroupedCard">
        <div class="settingsRow settingsRow--split">
          <div>
            <div class="settingsRowTitle">List Management</div>
            <div class="muted small">Manage the lists used in New Trip and Edit Trip.</div>
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
      </div>
    </div>

    <div class="settingsGroupBlock">
      <div class="settingsGroupLabel">About</div>
      <div class="card settingsSectionCard settingsGroupedCard">
        <div class="settingsRow settingsRow--split">
          <div>
            <div class="settingsRowTitle">Build</div>
            <div class="muted small">Version currently running on this device.</div>
          </div>
          <span class="settingsValuePill">${displayBuildVersion}</span>
        </div>
        <div class="settingsRow settingsRow--minor">
          <div id="buildBadge" class="muted small"></div>
        </div>
        <div class="settingsRow settingsRow--minor">
          <div class="muted small">Created by <b>Jeremy Wood</b></div>
          <div class="muted small mt6">Support: <a class="settingsEmail" href="mailto:jeremywwood76@gmail.com">jeremywwood76@gmail.com</a></div>
          <div class="muted small mt8">© 2026 Jeremy Wood. All rights reserved.</div>
        </div>
        <div class="settingsRow settingsRow--split settingsRow--minor">
          <div>
            <div class="settingsRowTitle">Legal & Trust</div>
            <div class="muted small">Review terms, privacy details, and open-source license info.</div>
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
      </div>
    </div>

    <div class="settingsGroupBlock">
      <div class="settingsGroupLabel">Advanced</div>
      <details class="card settingsSectionCard settingsGroupedCard settingsAdvancedCard" id="advancedBox">
        <summary class="settingsAdvancedSummary">Diagnostics and reset</summary>
        <div class="settingsRow settingsRow--action mt10">
          <div class="row gap10 wrap">
            <button class="btn" id="copyDebug">Copy diagnostics</button>
            <button class="btn" id="refreshApp">Reload app safely</button>
          </div>
        </div>
        <div class="settingsRow settingsRow--danger">
          <div class="muted small"><b>Danger zone:</b> Erase removes all trips and lists stored on this device. Create a backup first.</div>
          <div class="row mt10">
            <button class="btn danger" id="resetData">Erase All Data</button>
          </div>
        </div>
      </details>
    </div>
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
