export function createHomeDashboardRenderer({
  state,
  ensureHomeFilter,
  buildUnifiedFilterFromHomeFilter,
  applyUnifiedTripFilter,
  computePPL,
  round2,
  getTripsNewestFirst,
  homeTripsLimit,
  renderTripCatchCard,
  renderPageHeader,
  escapeHtml,
  parseReportDateToISO,
  formatMoney,
  getApp,
  pushView,
  saveState,
  render,
  bindDatePill,
  showToast,
  tipMsg,
  exportBackup
}) {
  let homeKpiFitBound = false;
  let homeKpiFitRaf = 0;

  function fitHomeKpiValues() {
    const root = getApp();
    if (!root) return;
    const values = root.querySelectorAll(".kpiCard .kpiValueFit");
    values.forEach((el) => {
      el.style.removeProperty("font-size");
      el.style.removeProperty("--kpi-fit-scale");

      const wrap = el.parentElement;
      if (!wrap) return;

      const available = Math.max(0, Math.floor(wrap.clientWidth));
      if (!available) return;

      for (let i = 0; i < 4; i++) {
        const content = Math.ceil(el.scrollWidth);
        if (content <= available) break;

        const currentSize = Number.parseFloat(getComputedStyle(el).fontSize) || 0;
        if (!(currentSize > 0)) break;

        const nextSize = Math.max(10, currentSize * ((available - 2) / content));
        if (nextSize >= currentSize - 0.1) break;
        el.style.fontSize = `${nextSize.toFixed(2)}px`;
      }
    });

    if (homeKpiFitBound) return;
    homeKpiFitBound = true;
    const rerun = () => {
      if (homeKpiFitRaf) cancelAnimationFrame(homeKpiFitRaf);
      homeKpiFitRaf = requestAnimationFrame(() => fitHomeKpiValues());
    };
    window.addEventListener("resize", rerun, { passive: true });
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", rerun, { passive: true });
    }
  }

  function renderHome() {
    const tripsAll = Array.isArray(state.trips) ? state.trips : [];
    ensureHomeFilter();
    const hf = state.homeFilter || { mode: "YTD", from: "", to: "" };
    const unified = buildUnifiedFilterFromHomeFilter(hf);
    const trips = applyUnifiedTripFilter(tripsAll, unified).rows;
    const totalAmount = trips.reduce((s, t) => s + (Number(t?.amount) || 0), 0);
    const totalLbs = trips.reduce((s, t) => s + (Number(t?.pounds) || 0), 0);
    const avgPpl = totalLbs > 0 ? computePPL(totalLbs, totalAmount) : null;

    const lbsVal = round2(totalLbs);
    const lbsStr = (Number.isFinite(lbsVal) && Math.abs(lbsVal % 1) < 1e-9) ? String(Math.trunc(lbsVal)) : String(lbsVal);
    const moneyRounded = (() => {
      const v = Math.round(Number(totalAmount) || 0);
      try { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v); }
      catch { return "$" + v.toLocaleString("en-US"); }
    })();

    const s = state.settings || (state.settings = {});
    const isStandalone = (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || (window.navigator && window.navigator.standalone === true);
    const pwaNoteDismissed = !!s.pwaStorageNoteDismissed;
    const showPwaStorageNote = isStandalone && !pwaNoteDismissed;
    const pwaStorageNoteHTML = showPwaStorageNote ? `
      <div class="card">
        <b>Using the installed app?</b>
        <div class="muted small" style="margin-top:6px;line-height:1.45">
          On iPhone/iPad (and sometimes Android), the installed Home Screen app can store data separately from Safari.
          If you logged trips in Safari, create a backup there and restore it here.
        </div>
        <div class="row mt10">
          <button class="btn" id="pwaNoteHelp">How to move trips</button>
          <button class="btn" id="pwaNoteDismiss">Got it</button>
        </div>
      </div>
    ` : "";

    const now = Date.now();
    const lastAt = Number(s.lastBackupAt || 0);
    const lastCount = Number(s.lastBackupTripCount || 0);
    const snoozeUntil = Number(s.backupSnoozeUntil || 0);
    const newCount = tripsAll.length - lastCount;
    const daysSince = lastAt ? ((now - lastAt) / (1000 * 60 * 60 * 24)) : 999;
    const shouldRemind = tripsAll.length > 0
      && now > snoozeUntil
      && (
        (!lastAt && tripsAll.length >= 5)
        || (newCount > 0 && daysSince >= 7)
      );

    const backupReminderHTML = shouldRemind ? `
      <div class="card">
        <b>Backup reminder</b>
        <div class="muted small" style="margin-top:6px">
          You have ${newCount > 0 ? newCount : tripsAll.length} trip${(newCount > 1 || (!lastAt && tripsAll.length !== 1)) ? "s" : ""} not included in your most recent backup.
        </div>
        <div class="row mt10">
          <button class="btn" id="backupNow">💾 Create Backup</button>
          <button class="btn" id="backupLater">Not now</button>
        </div>
      </div>
    ` : "";

    const f = String((state.homeFilter && state.homeFilter.mode) || "YTD").toUpperCase();
    const chip = (key, label) => `<button class="chip segBtn ${f === key ? "on is-selected" : ""}" data-hf="${key}" type="button">${label}</button>`;

    const tripsSorted = getTripsNewestFirst(trips);
    const rows = tripsSorted.length
      ? tripsSorted.slice(0, homeTripsLimit).map((t) => renderTripCatchCard(t, { interactive: true })).join("")
      : `<div class="muted small">No trips in this range yet. Tap <b>＋ New Trip</b> to log your first one.</div>`;

    getApp().innerHTML = `
      ${renderPageHeader("home")}

      <div class="card dashCard">
        <div class="homeFilterStack">
          <div class="segWrap">
            ${chip("YTD", "YTD")}
            ${chip("MONTH", "Month")}
            ${chip("7D", "7 Days")}
            ${chip("RANGE", "Range")}
          </div>
          ${f === "RANGE" ? `
            <div class="row gap10 wrap dateRangeRow">
              <div class="homeRangeInputs">
                <input class="input" id="homeRangeFrom" type="date" value="${escapeHtml(parseReportDateToISO(hf.from))}" />
                <input class="input" id="homeRangeTo" type="date" value="${escapeHtml(parseReportDateToISO(hf.to))}" />
              </div>
              <button class="btn" id="homeRangeApply">Apply</button>
            </div>
          ` : ``}
        </div>

        <div class="kpiRow">
          <div class="kpiCard">
            <div class="kpiLabel">Trips</div>
            <div class="kpiValue"><span class="kpiValueFit">${trips.length}</span></div>
          </div>
          <div class="kpiCard">
            <div class="kpiLabel">Pounds</div>
            <div class="kpiValue lbsBlue"><span class="kpiValueFit">${lbsStr} lbs</span></div>
          </div>
          <div class="kpiCard">
            <div class="kpiLabel">Amount</div>
            <div class="kpiValue money"><span class="kpiValueFit">${moneyRounded}</span></div>
          </div>
          <div class="kpiCard">
            <div class="kpiLabel">Avg $/lb</div>
            <div class="kpiValue rate ppl"><span class="kpiValueFit">${avgPpl === null ? "—" : formatMoney(avgPpl)}</span></div>
          </div>
        </div>
      </div>

      ${pwaStorageNoteHTML}

      ${backupReminderHTML}

      <div id="reviewWarnings"></div>

      <div class="card">
        <b>Trips</b>
        <div class="sep"></div>
        <div class="triplist">${rows}</div>
        ${trips.length > homeTripsLimit ? `<div style="margin-top:10px"><button class="btn" id="viewAllTrips">View all trips</button></div>` : ``}
      </div>
    `;

    try { const app = getApp(); if (app) app.scrollTop = 0; } catch (_e) { }

    const vbtn = document.getElementById("viewAllTrips");
    if (vbtn) { vbtn.onclick = () => { pushView(state, "all_trips"); }; }

    getApp().querySelectorAll(".trip[data-id]").forEach((card) => {
      const open = () => {
        const id = card.getAttribute("data-id");
        if (!id) return;
        state.view = "edit";
        state.editId = id;
        saveState();
        render();
      };
      card.addEventListener("click", open);
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
      });
    });

    getApp().querySelectorAll("button.chip[data-hf]").forEach((btn) => {
      btn.addEventListener("click", () => {
        ensureHomeFilter();
        state.homeFilter.mode = String(btn.getAttribute("data-hf") || "YTD").toUpperCase();
        saveState();
        showToast("Home filter updated");
        renderHome();
      });
    });
    const homeApply = document.getElementById("homeRangeApply");
    if (homeApply) {
      homeApply.onclick = () => {
        ensureHomeFilter();
        const from = parseReportDateToISO(document.getElementById("homeRangeFrom")?.value || "");
        const to = parseReportDateToISO(document.getElementById("homeRangeTo")?.value || "");
        state.homeFilter.from = from;
        state.homeFilter.to = to;
        saveState();
        showToast("Date range applied");
        renderHome();
      };
    }
    bindDatePill("homeRangeFrom");
    bindDatePill("homeRangeTo");
    fitHomeKpiValues();

    const toggleToast = (e) => {
      try {
        e?.preventDefault?.();
        e?.stopPropagation?.();
        const t = document.getElementById("toast");
        if (t?.classList?.contains?.("show")) {
          t.classList.remove("show");
          return;
        }
        showToast(tipMsg);
      } catch {
        showToast(tipMsg);
      }
    };

    const btnPaste = document.getElementById("paste");
    const warn = document.getElementById("warn");

    if (btnPaste) {
      btnPaste.onclick = toggleToast;
      btnPaste.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") toggleToast(e); };
    }
    if (warn) {
      warn.onclick = toggleToast;
    }

    const btnPwaDismiss = document.getElementById("pwaNoteDismiss");
    if (btnPwaDismiss) {
      btnPwaDismiss.onclick = () => {
        const settings = state.settings || (state.settings = {});
        settings.pwaStorageNoteDismissed = true;
        state.lastAction = "pwaNote:dismiss";
        saveState();
        render();
      };
    }
    const btnPwaHelp = document.getElementById("pwaNoteHelp");
    if (btnPwaHelp) {
      btnPwaHelp.onclick = () => {
        state.view = "help";
        state.lastAction = "nav:help";
        saveState();
        render();
      };
    }

    const btnBackupNow = document.getElementById("backupNow");
    if (btnBackupNow) {
      btnBackupNow.onclick = async () => {
        try {
          const r = await exportBackup();
          state.settings = state.settings || {};
          state.settings.lastBackupAt = Date.now();
          state.settings.lastBackupTripCount = Array.isArray(state.trips) ? state.trips.length : 0;
          state.settings.backupSnoozeUntil = 0;
          saveState();
          showToast(r?.method === "share" ? "Share opened" : "Backup created");
        } catch (e) {
          showToast("Backup failed");
        } finally {
          renderHome();
        }
      };
    }
    const btnBackupLater = document.getElementById("backupLater");
    if (btnBackupLater) {
      btnBackupLater.onclick = () => {
        state.settings = state.settings || {};
        state.settings.backupSnoozeUntil = Date.now() + (24 * 60 * 60 * 1000);
        saveState();
        showToast("Backup reminder snoozed");
        renderHome();
      };
    }
  }

  return { renderHome };
}
