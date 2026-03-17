export function createHomeDashboardRenderer({
  state,
  ensureHomeFilter,
  buildUnifiedFilterFromHomeFilter,
  applyUnifiedTripFilter,
  computePPL,
  round2,
  getTripsNewestFirst,
  renderPageHeader,
  escapeHtml,
  parseReportDateToISO,
  formatMoney,
  getApp,
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
      <div class="noticeBand" role="status" aria-live="polite">
        <div class="noticeTitle">Installed app check</div>
        <div class="muted small noticeBody">
          On iPhone/iPad (and sometimes Android), the Home Screen app may use separate local storage from Safari.
          If recent trips were saved in Safari, create a backup there and restore it here to keep records aligned.
        </div>
        <div class="row mt10 noticeActions">
          <button class="btn" id="pwaNoteHelp">Review safe transfer</button>
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
      <div class="noticeBand" role="status" aria-live="polite">
        <div class="noticeTitle">Backup reminder</div>
        <div class="muted small noticeBody">
          You have ${newCount > 0 ? newCount : tripsAll.length} trip${(newCount > 1 || (!lastAt && tripsAll.length !== 1)) ? "s" : ""} not yet included in your latest backup.
        </div>
        <div class="row mt10 noticeActions">
          <button class="btn" id="backupNow">💾 Create Backup</button>
          <button class="btn" id="backupLater">Not now</button>
        </div>
      </div>
    ` : "";

    const f = String((state.homeFilter && state.homeFilter.mode) || "YTD").toUpperCase();
    const chip = (key, label) => `<button class="chip segBtn ${f === key ? "on is-selected" : ""}" data-hf="${key}" type="button">${label}</button>`;

    const tripsSorted = getTripsNewestFirst(trips);
    const newestSavedTrip = tripsSorted[0] || null;
    const dealerRollup = trips.reduce((map, trip) => {
      const dealerName = String(trip?.dealer || "").trim() || "Dealer not set";
      const next = map.get(dealerName) || { dealer: dealerName, trips: 0, amount: 0, pounds: 0 };
      next.trips += 1;
      next.amount += Number(trip?.amount) || 0;
      next.pounds += Number(trip?.pounds) || 0;
      map.set(dealerName, next);
      return map;
    }, new Map());
    const dealers = Array.from(dealerRollup.values());
    const strongestDealer = dealers.length
      ? dealers.slice().sort((a, b) => b.amount - a.amount || b.pounds - a.pounds || b.trips - a.trips)[0]
      : null;
    const bestAvgDealer = dealers
      .filter((item) => item.pounds > 0)
      .sort((a, b) => (b.amount / b.pounds) - (a.amount / a.pounds))[0] || null;
    const smartSummaryLines = [];
    if (strongestDealer) {
      smartSummaryLines.push(`<li><b>Top dealer:</b> ${escapeHtml(strongestDealer.dealer)} at ${formatMoney(strongestDealer.amount)} from ${round2(strongestDealer.pounds)} lbs.</li>`);
    }
    if (bestAvgDealer) {
      const avg = bestAvgDealer.amount / bestAvgDealer.pounds;
      smartSummaryLines.push(`<li><b>Best average:</b> ${escapeHtml(bestAvgDealer.dealer)} at ${formatMoney(avg)}/lb in this range.</li>`);
    }
    if (newestSavedTrip) {
      const latestDate = parseReportDateToISO(newestSavedTrip.dateISO || "") || "latest trip";
      smartSummaryLines.push(`<li><b>Latest trip:</b> ${latestDate} • ${formatMoney(Number(newestSavedTrip.amount) || 0)} on ${round2(Number(newestSavedTrip.pounds) || 0)} lbs.</li>`);
    }
    const smartSummaryHtml = smartSummaryLines.length
      ? `<ul class="homeSmartSummary">${smartSummaryLines.join("")}</ul>`
      : `<div class="homeSmartSummaryFallback muted small">Need more saved trips in this range before smart summary insights can show.</div>`;

    const monthTotals = trips.reduce((map, trip) => {
      const iso = parseReportDateToISO(trip?.dateISO || "");
      if (!iso) return map;
      const monthKey = String(iso).slice(0, 7);
      if (!monthKey) return map;
      const bucket = map.get(monthKey) || { monthKey, amount: 0, pounds: 0, trips: 0 };
      bucket.amount += Number(trip?.amount) || 0;
      bucket.pounds += Number(trip?.pounds) || 0;
      bucket.trips += 1;
      map.set(monthKey, bucket);
      return map;
    }, new Map());
    const monthSeries = Array.from(monthTotals.values()).sort((a, b) => String(a.monthKey).localeCompare(String(b.monthKey)));
    const currentMonth = monthSeries[monthSeries.length - 1] || null;
    const previousMonth = monthSeries.length > 1 ? monthSeries[monthSeries.length - 2] : null;
    const toneFromDelta = (current, prior) => {
      if (!(prior > 0) || !(current > 0)) return "steady";
      const delta = (current - prior) / Math.max(1, Math.abs(prior));
      if (Math.abs(delta) <= 0.03) return "steady";
      return delta > 0 ? "up" : "down";
    };
    const poundsTone = toneFromDelta(Number(currentMonth?.pounds) || 0, Number(previousMonth?.pounds) || 0);
    const amountTone = toneFromDelta(Number(currentMonth?.amount) || 0, Number(previousMonth?.amount) || 0);
    const homeOverviewTone = (() => {
      if (!previousMonth || !currentMonth) return "steady";
      if (amountTone === "up" || poundsTone === "up") return "up";
      if (amountTone === "down" && poundsTone === "down") return "down";
      return "steady";
    })();
    const homeOverviewHeadline = (() => {
      if (!previousMonth || !currentMonth) return "Overview synced to this selected range.";
      if (homeOverviewTone === "up") return "Recent catches are trending higher than last month.";
      if (homeOverviewTone === "down") return "Recent catches are below last month levels.";
      return "Recent catches are holding steady month to month.";
    })();
    const homeOverviewRangeLabel = currentMonth
      ? `${currentMonth.monthKey}${previousMonth ? ` vs ${previousMonth.monthKey}` : ""}`
      : "Current filter";
    getApp().innerHTML = `
      ${renderPageHeader("home")}

      <div class="card dashCard">
        <div class="homeFilterStack">
          <div class="segWrap timeframeUnifiedControl" role="group" aria-label="Home timeframe filter">
            ${chip("YTD", "YTD")}
            ${chip("MONTH", "This Month")}
            ${chip("7D", "Last 7 Days")}
            ${chip("RANGE", "Custom Range")}
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

        <div class="homeHero">
          <div class="homeHeroEyebrow">Overview dashboard</div>
          <div class="homeHeroHeadline">${escapeHtml(homeOverviewHeadline)}</div>
          <div class="homeHeroTone tone-${homeOverviewTone}">Range ${escapeHtml(homeOverviewRangeLabel)} • ${trips.length} trips</div>
          <div class="homeHeroStats">
            <div class="homeHeroStat">
              <span class="muted small">Total amount</span>
              <b class="money">${formatMoney(totalAmount)}</b>
            </div>
            <div class="homeHeroStat">
              <span class="muted small">Total pounds</span>
              <b class="lbsBlue">${lbsStr} lbs</b>
            </div>
          </div>
        </div>

        <div class="kpiGroupLabel">Core metrics</div>
        <div class="kpiRow">
          <div class="kpiCard">
            <div class="kpiLabel">Trips</div>
            <div class="kpiValue"><span class="kpiValueFit">${trips.length}</span></div>
          </div>
          <div class="kpiCard">
            <div class="kpiLabel">Pounds</div>
            <div class="kpiValue lbsBlue"><span class="kpiValueFit">${lbsStr} lbs</span></div>
          </div>
          <div class="kpiCard kpiCardPrimary">
            <div class="kpiLabel">Amount</div>
            <div class="kpiValue money"><span class="kpiValueFit">${moneyRounded}</span></div>
          </div>
          <div class="kpiCard kpiCardPrimary">
            <div class="kpiLabel ppl">Avg $/lb</div>
            <div class="kpiValue rate ppl"><span class="kpiValueFit">${avgPpl === null ? "—" : formatMoney(avgPpl)}</span></div>
          </div>
        </div>

        ${smartSummaryHtml}
      </div>

      ${pwaStorageNoteHTML}

      ${backupReminderHTML}

      <div id="reviewWarnings"></div>
    `;

    try { const app = getApp(); if (app) app.scrollTop = 0; } catch (_e) { }

    getApp().querySelectorAll("button.chip[data-hf]").forEach((btn) => {
      btn.addEventListener("click", () => {
        ensureHomeFilter();
        state.homeFilter.mode = String(btn.getAttribute("data-hf") || "YTD").toUpperCase();
        saveState();
        showToast("Filter updated");
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
        showToast("Range applied");
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
