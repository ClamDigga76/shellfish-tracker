function escapeSettingsHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDeletedStamp(value) {
  const iso = String(value || "").trim();
  if (!iso) return "recently";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "recently";
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

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
  runInstallAction
}) {
  function renderSettings(opts = {}) {
    const state = getState();

    ensureAreas();
    ensureDealers();

    const s = state.settings || (state.settings = {});
    const listMode = String(s.listMode || "areas").toLowerCase();
    const deletedTrips = Array.isArray(state.deletedTrips) ? state.deletedTrips : [];
    const deletedTripsHtml = deletedTrips.length ? `
        <div class="settingsRow settingsRow--split settingsRow--minor">
          <div>
            <div class="settingsRowTitle">Recently Deleted</div>
            <div class="muted small">Restore a deleted trip here, or clear it for good.</div>
          </div>
          <span class="settingsValuePill">${deletedTrips.length}</span>
        </div>
        <div class="settingsDeletedList" id="deletedTripsList">
          ${deletedTrips.map((entry) => {
            const trip = entry?.trip || {};
            const dateLabel = String(trip.dateISO || "").trim() ? trip.dateISO : "No date";
            const dealerLabel = String(trip.dealer || "").trim() || "Unknown dealer";
            const areaLabel = String(trip.area || "").trim() || "No area";
            const poundsLabel = Number.isFinite(Number(trip.pounds)) && Number(trip.pounds) > 0 ? `${Number(trip.pounds)} lbs` : "";
            const deletedLabel = String(entry?.deletedAt || "").trim() || "";
            return `
              <div class="settingsDeletedItem">
                <div class="settingsDeletedMeta">
                  <div class="settingsDeletedTitle">${escapeSettingsHtml(dealerLabel)}</div>
                  <div class="muted small">${escapeSettingsHtml(dateLabel)} • ${escapeSettingsHtml(areaLabel)}${poundsLabel ? ` • ${escapeSettingsHtml(poundsLabel)}` : ""}</div>
                  <div class="muted settingsBodyTiny">Deleted ${escapeSettingsHtml(formatDeletedStamp(deletedLabel))}</div>
                </div>
                <div class="settingsDeletedActions">
                  <button class="btn settingsInlineBtn" type="button" data-restore-trip="${escapeSettingsHtml(String(entry?.id || ""))}">Restore</button>
                  <button class="btn danger settingsInlineBtn" type="button" data-delete-forever="${escapeSettingsHtml(String(entry?.id || ""))}">Delete forever</button>
                </div>
              </div>
            `;
          }).join("")}
        </div>
        <div class="settingsRow settingsRow--action">
          <button class="btn danger settingsFlexBtn" id="clearDeletedTrips">Clear all permanently</button>
        </div>
      ` : `
        <div class="settingsRow settingsRow--minor">
          <div class="muted small">No deleted trips waiting here.</div>
        </div>
      `;

    getApp().innerHTML = `
    ${renderPageHeader("settings")}

    <div class="settingsGroupBlock">
      <div class="settingsGroupLabel">Appearance</div>
      <div class="card settingsSectionCard settingsGroupedCard">
        <div class="settingsRow settingsRow--split">
          <div>
            <div class="settingsRowTitle">Theme</div>
            <div class="muted small">Pick how the app looks.</div>
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
            <div class="muted small">Quick status and update actions.</div>
          </div>
          <span class="settingsValuePill">Status</span>
        </div>
        <div class="settingsRow settingsRow--status">
          <div id="updateBigStatus" class="settingsUpdateStatus">Checking version…</div>
          <div class="muted settingsBodyTiny" id="updateVersionLine"></div>
        </div>
        <div class="settingsRow settingsRow--action">
          <button class="btn settingsInlineBtn" id="updatePrimary">Reload latest version</button>
          <div class="muted settingsBodyTiny settingsInlineMsg" id="updateInlineMsg"></div>
        </div>
        <details class="settingsDetails settingsRow">
          <summary class="muted settingsBodyTiny">Technical details</summary>
          <div class="muted settingsBodyTiny settingsBuildInfo" id="buildInfoDetails"></div>
        </details>
        <div class="settingsRow settingsRow--split settingsRow--minor">
          <div>
            <div class="settingsRowTitle">Help</div>
            <div class="muted small">Install, backup, and support how-to lives in Help.</div>
          </div>
          <button class="btn settingsInlineBtn" id="openHelp">Open Help</button>
        </div>
      </div>
    </div>

    <div class="settingsGroupBlock">
      <div class="settingsGroupLabel">Install App</div>
      <div class="card settingsSectionCard settingsGroupedCard">
        <div class="settingsRow settingsRow--split">
          <div>
            <div class="settingsRowTitle settingsMiniTitle">App mode</div>
            <div class="muted small">Check mode and run install actions.</div>
          </div>
          <span class="settingsValuePill" id="installModePill">Checking…</span>
        </div>
        <div class="settingsRow settingsRow--status">
          <div id="installModeLine" class="settingsUpdateStatus">Checking how the app is opening…</div>
          <div class="muted settingsBodyTiny" id="installStatusHint"></div>
        </div>
        <div class="settingsRow settingsRow--action settingsInstallActions">
          <button class="btn primary settingsInlineBtn" id="installActionBtn" type="button">Install app</button>
          <button class="btn settingsInlineBtn" id="installHelpBtn" type="button">Install help</button>
        </div>
        <div class="settingsRow settingsRow--minor">
          <div class="hint" id="installWhyLine"></div>
          <div class="muted small mt8" id="installStepsLine"></div>
        </div>
      </div>
    </div>

    <div class="settingsGroupBlock">
      <div class="settingsGroupLabel">Safety & Recovery</div>
      <div class="card settingsSectionCard settingsGroupedCard">
        <div class="settingsRow settingsRow--split">
          <div>
            <div class="settingsRowTitle">Backup & Restore</div>
            <div class="muted small">Create a backup, then restore from preview when needed.</div>
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
      </div>
    </div>

    <div class="settingsGroupBlock">
      <div class="settingsGroupLabel">Data Lists</div>
      <div class="card settingsSectionCard settingsGroupedCard">
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
      </div>
    </div>

    <div class="settingsGroupBlock">
      <div class="settingsGroupLabel">About</div>
      <div class="card settingsSectionCard settingsGroupedCard">
        <div class="settingsRow settingsRow--split">
          <div>
            <div class="settingsRowTitle">Build</div>
            <div class="muted small">Version running on this device.</div>
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
      </div>
    </div>

    <div class="settingsGroupBlock">
      <div class="settingsGroupLabel">Advanced</div>
      <details class="card settingsSectionCard settingsGroupedCard settingsAdvancedCard" id="advancedBox">
        <summary class="settingsAdvancedSummary">Advanced diagnostics and reset</summary>
        <div class="settingsRow settingsRow--action mt10">
          <div class="row gap10 wrap">
            <button class="btn" id="copyDebug">Copy diagnostics</button>
            <button class="btn" id="refreshApp">Reload app safely</button>
          </div>
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
    bindThemeControls();

    bindNavHandlers(state);

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

    if (installModel) {
      if (installModePill) installModePill.textContent = installModel.statusPill;
      if (installModeLine) installModeLine.textContent = installModel.statusLine;
      if (installStatusHint) installStatusHint.textContent = installModel.statusHint;
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
    try {
      updateBuildInfo();
    } catch (_) {}

    try {
      settingsListManagement.bindListMgmtHandlers();
    } catch (_) {}

    try {
      updateBackupHealthWarning();
      updateLastBackupLine();
      updateRestoreRollbackLine();
      const btnDl = document.getElementById("downloadBackup");
      const btnRs = document.getElementById("restoreBackup");
      const btnRollback = document.getElementById("restoreRollbackBtn");
      const inp = document.getElementById("backupFile");

      if (btnDl) {
        btnDl.onclick = async () => {
          try {
            const r = await exportBackup();
            if (r?.ok) {
              showToast(r.method === "share" ? "Bank the Catch backup ready to share" : "Bank the Catch backup saved");
            } else {
              showToast("Could not create Bank the Catch backup");
            }
          } catch (_) {
            showToast("Could not create Bank the Catch backup");
          }
        };
      }

      if (btnRollback) {
        btnRollback.onclick = async () => {
          try {
            const restored = await restoreFromRollbackSnapshot();
            const modeLabel = restored?.mode === "replace" ? "Replace" : "Merge";
            showToast(`Pre-restore snapshot restored (${modeLabel})`);
            applyThemeMode();
            render();
          } catch (_) {
            showToast("Could not restore pre-restore snapshot");
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
                showToast("Bank the Catch safety backup created");
              }
            }

            const result = await importBackupFromFile(file, {
              parsedBackup: preview,
              mode: options.mode,
              includeSettings: options.includeSettings
            });

            const modeLabel = result?.mode === "replace" ? "Replace" : "Merge";
            const tripsAdded = Number(result?.tripsAdded || 0);
            const tripsSkipped = Number(result?.tripsSkippedDuplicates || 0);
            showToast(result?.mode === "merge"
              ? `Restore complete: ${tripsAdded} trips added, ${tripsSkipped} likely duplicates skipped (${modeLabel})`
              : `Restore complete: ${tripsAdded} trips restored (${modeLabel})`);
            await openRestoreResultModal(result);
            updateRestoreRollbackLine();
            applyThemeMode();
            render();
          } catch (e) {
            showToast("Could not restore Bank the Catch backup");
            await openRestoreErrorModal(e);
          }
        };
      }
    } catch (_) {}

    try {
      document.querySelectorAll("[data-restore-trip]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const result = restoreDeletedTrip(btn.getAttribute("data-restore-trip"));
          if (!result?.ok) {
            showToast("Could not restore that trip");
            return;
          }
          saveState();
          render();
          showToast(result.idChanged ? "Trip restored with a new ID" : "Trip restored");
        });
      });
      document.querySelectorAll("[data-delete-forever]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const ok = await openConfirmModal({
            title: "Delete Forever",
            message: "Permanently remove this deleted trip? This cannot be undone.",
            confirmLabel: "Delete Forever",
            cancelLabel: "Cancel"
          });
          if (!ok) return;
          const removed = permanentlyDeleteDeletedTrip(btn.getAttribute("data-delete-forever"));
          if (!removed) {
            showToast("Could not remove that deleted trip");
            return;
          }
          saveState();
          render();
          showToast("Deleted trip removed forever");
        });
      });
      const clearDeletedTripsBtn = document.getElementById("clearDeletedTrips");
      if (clearDeletedTripsBtn) {
        clearDeletedTripsBtn.onclick = async () => {
          const ok = await openConfirmModal({
            title: "Clear Recently Deleted",
            message: "Permanently remove all deleted trips from Recently Deleted?",
            confirmLabel: "Clear All",
            cancelLabel: "Cancel"
          });
          if (!ok) return;
          const cleared = clearDeletedTripsBin();
          saveState();
          render();
          showToast(cleared > 0 ? "Recently Deleted cleared" : "Recently Deleted was already empty");
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
