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

    <div class="row" style="gap:10px;align-items:stretch;flex-wrap:nowrap">
      <div class="card" style="flex:1;min-width:0;padding:10px">
        <b style="font-size:.95rem">Updates</b>
        <div class="sep" style="margin:8px 0"></div>

        <div id="updateBigStatus" style="font-size:15px;font-weight:800;line-height:1.2">Up to date</div>
        <div class="muted" id="updateVersionLine" style="margin-top:4px;font-size:11px;line-height:1.25"></div>

        <div class="row" style="margin-top:8px;gap:8px;align-items:center;min-width:0">
          <button class="btn" id="updatePrimary" style="font-size:12px;padding:7px 10px;min-width:0;white-space:nowrap">Refresh app</button>
          <div class="muted" id="updateInlineMsg" style="display:none;font-size:11px"></div>
        </div>

        <details style="margin-top:8px">
          <summary class="muted" style="font-size:11px">Details</summary>
          <div class="muted" id="buildInfoDetails" style="white-space:pre-wrap;margin-top:6px;font-size:11px;line-height:1.25"></div>
        </details>
      </div>

      <div class="card" style="flex:1;min-width:0;padding:10px">
        <b style="font-size:.95rem">Help</b>
        <div class="sep" style="margin:8px 0"></div>
        <div class="muted" style="margin-top:4px;font-size:11px;line-height:1.25">Short instructions for manual entry, clipboard paste, backups, and install.</div>
        <div class="row" style="margin-top:8px;min-width:0">
          <button class="btn" id="openHelp" style="font-size:12px;padding:7px 10px;min-width:0;white-space:nowrap">Open Help</button>
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
      <div class="muted small" id="lastBackupLine" style="margin-top:10px"></div>
      <div class="hint mt10"><b>Backup recommended</b> before major updates.</div>
      <div class="row" style="margin-top:12px;gap:10px;align-items:center;flex-wrap:nowrap">
        <button class="btn primary" id="downloadBackup" style="flex:1">💾 Create Backup</button>
        <button class="btn" id="restoreBackup" style="flex:1">📥 Restore Backup</button>
        <input id="backupFile" type="file" accept="application/json,.json,text/plain,.txt" style="display:none" />
      </div>
      <div class="muted small mt10">Tip: after you download a backup, move it into <b>iCloud Drive</b> (iPhone Files app) or <b>Google Drive</b> (Android) so it gets included in your regular phone/cloud backups. Keep at least one older backup too.</div>
    </div>

    <div class="card">
      <b>List Management</b>
      <div class="sep"></div>

      <div class="segWrap" style="margin-top:10px">
        <button class="chip segBtn ${listMode === "areas" ? "on is-selected" : ""}" data-listmode="areas" type="button">Areas</button>
        <button class="chip segBtn ${listMode === "dealers" ? "on is-selected" : ""}" data-listmode="dealers" type="button">Dealers</button>
        <button class="chip segBtn" type="button" disabled aria-disabled="true" title="Coming soon" style="display:flex;flex-direction:column;align-items:center;line-height:1.05">
          <div>Species</div>
          <div class="muted tiny" style="margin-top:2px;opacity:.85">Coming soon</div>
        </button>
      </div>
      <div class="muted small mt10">Manage the dropdown lists used in New Trip and Edit Trip.</div>

      <div id="listMgmtPanel">${settingsListManagement.renderListMgmtPanel(listMode)}</div>
    </div>

    <div class="card">
      <b>About</b>
      <div class="sep"></div>
      <div class="muted small mt10">Created by <b>Jeremy Wood</b> — <a class="settingsEmail" href="mailto:jeremywwood76@gmail.com">jeremywwood76@gmail.com</a></div>
      <div class="muted small" style="margin-top:8px">Version: <b>${displayBuildVersion}</b></div>
      <div id="buildBadge" class="muted small" style="margin-top:8px"></div>

      <div class="muted small" style="margin-top:8px">© 2026 Jeremy Wood. All rights reserved.</div>
      <div class="sep" style="margin-top:10px"></div>
      <div class="muted small mt10"><b>Legal</b></div>
      <div class="row mt10 gap10 wrap">
        <button class="btn" id="openTerms">Terms</button>
        <button class="btn" id="openPrivacy">Privacy</button>
        <button class="btn" id="openLicense">License</button>
      </div>
    </div>

    <details class="card" id="advancedBox">
      <summary style="cursor:pointer;"><b>Advanced</b></summary>
      <div class="sep" style="margin-top:10px"></div>

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
