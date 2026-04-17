import {
  escapeSettingsHtml,
  formatDeletedStamp,
  normalizeLedgerStatus,
  releaseStatusLabel,
  formatReleaseDraftStamp
} from "./settings_utils_v5.js";

export function createSettingsSupportRecoverySeam(deps) {
  const {
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
  } = deps;

  function buildDeletedTripsHtml(deletedTrips) {
    return deletedTrips.length ? `
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
  }

  function syncSafetySummaryLine({ safetySummaryLine, deletedTripsCount }) {
    if (!safetySummaryLine) return;
    const lastBackupLineEl = document.getElementById("lastBackupLine");
    const backupText = String(lastBackupLineEl?.textContent || "").trim() || "Backup status available";
    safetySummaryLine.textContent = `${backupText} • Recently deleted: ${deletedTripsCount}`;
  }

  function bindBackupRestoreControls() {
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
              showToast(r.method === "share" ? "Backup ready to share" : "Backup saved");
            } else if (r?.reason === "share-canceled") {
              showToast("Backup canceled");
            } else {
              showToast("Backup failed");
            }
          } catch (_) {
            showToast("Backup failed");
          }
        };
      }

      if (btnRollback) {
        btnRollback.onclick = async () => {
          try {
            const restored = await restoreFromRollbackSnapshot();
            const modeLabel = restored?.mode === "replace" ? "Replace" : "Merge";
            showToast(`Rollback restored (${modeLabel})`);
            applyThemeMode();
            render();
          } catch (_) {
            showToast("Rollback restore failed");
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
            showToast("Restore failed");
            await openRestoreErrorModal(e);
          }
        };
      }
    } catch (_) {}
  }

  function bindDeletedTripRecoveryControls() {
    try {
      document.querySelectorAll("[data-restore-trip]").forEach((btn) => {
        btn.addEventListener("click", () => {
          clearPendingTripUndo();
          const result = restoreDeletedTrip(btn.getAttribute("data-restore-trip"));
          if (!result?.ok) {
            showToast("Trip restore failed");
            return;
          }
          saveState();
          render();
          showToast(result.idChanged ? "Trip restored (new ID assigned)" : "Trip restored");
        });
      });
      document.querySelectorAll("[data-delete-forever]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const ok = await openConfirmModal({
            title: "Delete Forever",
            message: "Permanently remove this deleted trip? This cannot be undone.",
            confirmLabel: "Delete Forever",
            cancelLabel: "Cancel",
            confirmTone: "destructive"
          });
          if (!ok) return;
          clearPendingTripUndo();
          const removed = permanentlyDeleteDeletedTrip(btn.getAttribute("data-delete-forever"));
          if (!removed) {
            showToast("Delete forever failed");
            return;
          }
          saveState();
          render();
          showToast("Trip deleted forever");
        });
      });
      const clearDeletedTripsBtn = document.getElementById("clearDeletedTrips");
      if (clearDeletedTripsBtn) {
        clearDeletedTripsBtn.onclick = async () => {
          const ok = await openConfirmModal({
            title: "Clear Recently Deleted",
            message: "Permanently remove all deleted trips from Recently Deleted?",
            confirmLabel: "Clear All",
            cancelLabel: "Cancel",
            confirmTone: "destructive"
          });
          if (!ok) return;
          clearPendingTripUndo();
          const cleared = clearDeletedTripsBin();
          saveState();
          render();
          showToast(cleared > 0 ? "Recently Deleted cleared" : "Recently Deleted was already empty");
        };
      }
    } catch (_) {}
  }

  function createReleaseValidationController({ advancedSummaryLine }) {
    let latestReleaseSnapshot = null;
    let draftStateRestored = false;
    let staleDraftBuild = "";
    let latestManualUpdatedAt = "";
    const releaseSummaryEl = document.getElementById("releaseValidationSummary");
    const releaseStampEl = document.getElementById("releaseValidationStamp");
    const releaseManualStampEl = document.getElementById("releaseValidationManualStamp");
    const releaseDraftNoticeEl = document.getElementById("releaseValidationDraftNotice");
    const releaseSignalsEl = document.getElementById("releaseValidationSignals");
    const releaseNotesEl = document.getElementById("releaseValidationNotes");
    const releaseDraftBuildKey = "shellfish-release-validation-draft-build-v1";
    const releaseDraftStateKey = `shellfish-release-validation-draft-v1:${displayBuildVersion}`;
    const releaseInputs = {
      browser_mode: document.getElementById("releaseCheckBrowser"),
      installed_mode: document.getElementById("releaseCheckInstalled"),
      update_pickup: document.getElementById("releaseCheckUpdate"),
      reopen_behavior: document.getElementById("releaseCheckReopen"),
      recovery_reset: document.getElementById("releaseCheckRecovery")
    };

    function readReleaseSelections() {
      const out = {};
      Object.entries(releaseInputs).forEach(([key, input]) => {
        out[key] = normalizeLedgerStatus(input?.value || "not-run");
      });
      return out;
    }

    function updateManualChecklistStampLine() {
      if (!releaseManualStampEl) return;
      releaseManualStampEl.textContent = `Manual checklist last updated: ${formatReleaseDraftStamp(latestManualUpdatedAt)}`;
    }

    function saveReleaseDraftState() {
      const payload = {
        buildVersion: String(displayBuildVersion || ""),
        updatedAt: new Date().toISOString(),
        selections: readReleaseSelections(),
        notes: String(releaseNotesEl?.value || "")
      };
      latestManualUpdatedAt = payload.updatedAt;
      updateManualChecklistStampLine();
      try {
        localStorage.setItem(releaseDraftStateKey, JSON.stringify(payload));
        localStorage.setItem(releaseDraftBuildKey, String(displayBuildVersion || ""));
      } catch (_) {}
    }

    function restoreReleaseDraftState() {
      try {
        const previousBuild = String(localStorage.getItem(releaseDraftBuildKey) || "").trim();
        if (previousBuild && previousBuild !== String(displayBuildVersion || "")) {
          staleDraftBuild = previousBuild;
        }
      } catch (_) {}
      try {
        localStorage.setItem(releaseDraftBuildKey, String(displayBuildVersion || ""));
      } catch (_) {}
      try {
        const raw = localStorage.getItem(releaseDraftStateKey);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        const selections = parsed?.selections && typeof parsed.selections === "object" ? parsed.selections : {};
        Object.entries(releaseInputs).forEach(([key, input]) => {
          if (!input) return;
          input.value = normalizeLedgerStatus(selections[key] || input.value || "not-run");
        });
        if (releaseNotesEl) releaseNotesEl.value = String(parsed?.notes || "");
        latestManualUpdatedAt = String(parsed?.updatedAt || "");
        draftStateRestored = true;
      } catch (_) {}
    }

    function syncReleaseValidationSummary() {
      if (!releaseSummaryEl) return;
      const picks = Object.values(readReleaseSelections());
      const passCount = picks.filter((v) => v === "pass").length;
      const failCount = picks.filter((v) => v === "fail").length;
      const notRunCount = picks.length - passCount - failCount;
      const runCount = passCount + failCount;
      let status = notRunCount === 0
        ? `Checklist complete • ${runCount}/${picks.length} checks run`
        : `Checklist in progress • ${notRunCount} remaining not run`;
      status += ` • ${passCount} Pass`;
      if (failCount > 0) status += ` • ${failCount} Fail`;
      if (latestReleaseSnapshot?.summary?.updateAligned === false) status += " • Version alignment warning";
      if (latestReleaseSnapshot?.summary?.recoveryReady) status += " • Recovery attention signal";
      releaseSummaryEl.textContent = status;
      if (advancedSummaryLine) advancedSummaryLine.textContent = `Build ${displayBuildVersion} • ${status}`;
    }

    async function hydrateReleaseValidationSurface() {
      if (typeof getReleaseValidationSnapshot !== "function") {
        if (releaseSummaryEl) releaseSummaryEl.textContent = "Release snapshot unavailable in this build";
        return;
      }
      try {
        const snapshot = await getReleaseValidationSnapshot();
        latestReleaseSnapshot = snapshot;
        if (releaseSignalsEl) {
          releaseSignalsEl.textContent = Array.isArray(snapshot.signalLines) ? snapshot.signalLines.join("\n") : "";
        }
        if (releaseStampEl) {
          const stamp = snapshot?.at ? new Date(snapshot.at) : null;
          const stampLabel = stamp && !Number.isNaN(stamp.getTime()) ? stamp.toLocaleString() : "Unknown time";
          releaseStampEl.textContent = `Snapshot captured ${stampLabel}`;
        }
        if (!draftStateRestored) {
          const checkMap = Array.isArray(snapshot?.checks)
            ? Object.fromEntries(snapshot.checks.map((check) => [check.key, normalizeLedgerStatus(check.suggested)]))
            : {};
          Object.entries(releaseInputs).forEach(([key, input]) => {
            if (!input) return;
            input.value = normalizeLedgerStatus(checkMap[key] || input.value || "not-run");
          });
        }
        syncReleaseValidationSummary();
      } catch (_) {
        if (releaseSummaryEl) releaseSummaryEl.textContent = "Could not capture release snapshot";
      }
    }

    restoreReleaseDraftState();
    updateManualChecklistStampLine();
    if (releaseDraftNoticeEl) {
      releaseDraftNoticeEl.textContent = staleDraftBuild
        ? `Saved checklist from build ${staleDraftBuild} was not applied to this build.`
        : "Checklist is saved on this device for this build only.";
    }

    Object.values(releaseInputs).forEach((input) => {
      if (!input) return;
      input.onchange = () => {
        syncReleaseValidationSummary();
        saveReleaseDraftState();
      };
    });
    if (releaseNotesEl) {
      releaseNotesEl.oninput = () => saveReleaseDraftState();
    }

    const refreshReleaseSnapshotBtn = document.getElementById("refreshReleaseSnapshot");
    if (refreshReleaseSnapshotBtn) {
      refreshReleaseSnapshotBtn.onclick = async () => {
        await hydrateReleaseValidationSurface();
        showToast("Release snapshot refreshed for support bundle");
      };
    }

    const copyReleaseLedgerBtn = document.getElementById("copyReleaseLedger");
    if (copyReleaseLedgerBtn) {
      copyReleaseLedgerBtn.onclick = async () => {
        const selections = readReleaseSelections();
        const notes = releaseNotesEl?.value || "";
        let ledgerText = "";
        if (typeof formatReleaseValidationLedger === "function") {
          ledgerText = formatReleaseValidationLedger(latestReleaseSnapshot, selections, notes);
        } else {
          const lines = [
            `Build ${displayBuildVersion} release validation`,
            `Browser mode: ${releaseStatusLabel(selections.browser_mode)}`,
            `Installed mode: ${releaseStatusLabel(selections.installed_mode)}`,
            `Update pickup: ${releaseStatusLabel(selections.update_pickup)}`,
            `Reopen behavior: ${releaseStatusLabel(selections.reopen_behavior)}`,
            `Recovery/reset: ${releaseStatusLabel(selections.recovery_reset)}`
          ];
          if (String(notes || "").trim()) lines.push(`Notes: ${String(notes).trim()}`);
          ledgerText = lines.join("\n");
        }
        let copied = false;
        try {
          if (typeof copyTextWithFeedback === "function") {
            copied = await copyTextWithFeedback(ledgerText);
          }
        } catch (_) {}
        if (!copied) {
          try {
            await navigator.clipboard.writeText(ledgerText);
            copied = true;
          } catch (_) {}
        }
        showToast(copied ? "Release ledger copied for support" : "Could not copy release ledger");
      };
    }

    return {
      hydrateReleaseValidationSurface
    };
  }

  return {
    buildDeletedTripsHtml,
    bindBackupRestoreControls,
    bindDeletedTripRecoveryControls,
    syncSafetySummaryLine,
    createReleaseValidationController
  };
}
