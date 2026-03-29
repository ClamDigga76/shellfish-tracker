export function createHomeDashboardRenderer({
  state,
  ensureHomeFilter,
  buildUnifiedFilterFromHomeFilter,
  applyUnifiedTripFilter,
  computePPL,
  resolveTripPayRate,
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
  exportBackup,
  renderHomeMetricDetail,
  getInstallSurfaceModel,
  runInstallAction,
  renderStandardReadOnlyTripCard
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
    const isHomeMetricDetail = state.homeMetricDetailContext
      && typeof state.homeMetricDetailContext === "object"
      && String(state.homeMetricDetail || "").trim();
    if (isHomeMetricDetail && typeof renderHomeMetricDetail === "function") {
      renderHomeMetricDetail();
      return;
    }

    const tripsAll = Array.isArray(state.trips) ? state.trips : [];
    ensureHomeFilter();
    const hf = state.homeFilter || { mode: "YTD", from: "", to: "" };
    const unified = buildUnifiedFilterFromHomeFilter(hf);
    const trips = applyUnifiedTripFilter(tripsAll, unified).rows;
    const totalAmount = trips.reduce((s, t) => s + (Number(t?.amount) || 0), 0);
    const totalLbs = trips.reduce((s, t) => s + (Number(t?.pounds) || 0), 0);
    const weightedRateTotal = trips.reduce((sum, trip) => {
      const lbs = Number(trip?.pounds) || 0;
      if (!(lbs > 0)) return sum;
      const rate = typeof resolveTripPayRate === "function" ? resolveTripPayRate(trip) : computePPL(lbs, Number(trip?.amount) || 0);
      return (Number.isFinite(rate) && rate > 0) ? (sum + (rate * lbs)) : sum;
    }, 0);
    const avgPpl = totalLbs > 0 ? (weightedRateTotal / totalLbs) : null;
    const avgAmountPerTrip = trips.length ? (totalAmount / trips.length) : null;
    const avgPoundsPerTrip = trips.length ? (totalLbs / trips.length) : null;

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
    const hasSavedTrips = tripsAll.length > 0;
    const shouldShowBeginnerCard = !hasSavedTrips && !s.onboardingHomeDismissed;
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
    const areaRollup = trips.reduce((map, trip) => {
      const areaName = String(trip?.area || "").trim() || "Area not set";
      const next = map.get(areaName) || { area: areaName, trips: 0, amount: 0, pounds: 0 };
      next.trips += 1;
      next.amount += Number(trip?.amount) || 0;
      next.pounds += Number(trip?.pounds) || 0;
      map.set(areaName, next);
      return map;
    }, new Map());
    const strongestArea = Array.from(areaRollup.values())
      .sort((a, b) => b.amount - a.amount || b.pounds - a.pounds || b.trips - a.trips)[0] || null;
    const installModel = typeof getInstallSurfaceModel === "function" ? getInstallSurfaceModel() : null;
    const showInstallCard = shouldShowBeginnerCard && installModel && !installModel.isInstalled;
    const installCardHTML = showInstallCard ? `
      <section class="homeSection homeInstallSection">
        <div class="noticeBand homeInstallBand" role="status" aria-live="polite">
          <div class="noticeTitle">Best experience: install the app</div>
          <div class="muted small noticeBody">${escapeHtml(installModel.statusHint || "Use the installed app when you want a steadier Home Screen shortcut and clearer app-vs-browser status.")}</div>
          <div class="muted small noticeBody mt8">${escapeHtml(installModel.stepsLine || "Open Settings later if you need install steps again.")}</div>
          <div class="row mt10 noticeActions">
            ${installModel.showAction ? `<button class="btn" id="homeInstallAction" type="button" ${installModel.actionEnabled ? '' : 'disabled'}>${escapeHtml(installModel.actionLabel)}</button>` : ``}
            <button class="btn" id="homeInstallHelp" type="button">Install help</button>
          </div>
        </div>
      </section>
    ` : ``;

    const homeBeginnerCardHTML = shouldShowBeginnerCard ? `
      <section class="homeSection homeBeginnerSection">
        <div class="homeBeginnerCard" role="status" aria-live="polite">
          <div class="homeBeginnerEyebrow">Start here</div>
          <div class="homeBeginnerTitle">Save one trip to unlock your Home snapshot.</div>
          <div class="homeBeginnerBody">Save your first trip to start your Home snapshot.</div>
          <div class="homeBeginnerSteps" aria-label="Beginner next steps">
            <div class="homeBeginnerStep"><span class="homeBeginnerStepNum">1</span><span>Save your first trip.</span></div>
            <div class="homeBeginnerStep"><span class="homeBeginnerStepNum">2</span><span>Review your latest result on Home.</span></div>
            <div class="homeBeginnerStep"><span class="homeBeginnerStepNum">3</span><span>Open Reports after a few trips.</span></div>
          </div>
          <div class="row mt10 noticeActions homeBeginnerActions">
            <button class="btn primary" id="homeBeginnerPrimary" type="button">＋ New Trip</button>
            <button class="btn" id="homeBeginnerHelp" type="button">Quick start help</button>
            <button class="btn btn-ghost homeBeginnerDismiss" id="homeBeginnerDismiss" type="button">Dismiss</button>
          </div>
        </div>
      </section>
      ${installCardHTML}
    ` : ``;

    const lastSavedTripContextHtml = newestSavedTrip
      ? `<div class="homeLastTripContext">Read-only snapshot of your latest saved trip. Open Trips to edit details.</div>`
      : `<div class="homeLastTripContext">Save your first trip to populate this Home snapshot section.</div>`;

    const lastSavedTripHtml = newestSavedTrip
      ? (() => {
        const fallbackDate = parseReportDateToISO(newestSavedTrip.dateISO || "") || "Date not set";
        if (typeof renderStandardReadOnlyTripCard !== "function") {
          return `
            <div class="emptyState compact homeLastTripFallback">
              <div class="emptyStateTitle">Latest saved trip: ${escapeHtml(fallbackDate)}.</div>
            </div>
          `;
        }
        return `<div class="homeLastTripCardWrap">${renderStandardReadOnlyTripCard(newestSavedTrip)}</div>`;
      })()
      : `<div class="emptyState compact homeLastTripFallback"><div class="emptyStateTitle">No saved trip yet</div><div class="emptyStateBody">Save your first trip to show your latest trip here.</div></div>`;

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
      if (!previousMonth || !currentMonth) return "Overview aligned to the selected range.";
      if (homeOverviewTone === "up") return "Recent catches are trending higher than last month.";
      if (homeOverviewTone === "down") return "Recent catches are below last month levels.";
      return "Recent catches are holding steady month to month.";
    })();
    const homeFilterLabel = (() => {
      if (f === "MONTH") return "This Month";
      if (f === "LAST_MONTH") return "Last Month";
      if (f === "7D") return "Last 7 Days";
      if (f === "30D") return "Last 30 Days";
      if (f === "RANGE") {
        const from = parseReportDateToISO(hf.from || "") || "—";
        const to = parseReportDateToISO(hf.to || "") || "—";
        return `${from} → ${to}`;
      }
      return "YTD";
    })();
    const homeOverviewRangeLabel = homeFilterLabel;
    getApp().innerHTML = `
      ${renderPageHeader("home")}

      <div class="card dashCard homeScreenShell">
        ${homeBeginnerCardHTML}

        <section class="homeSection homeFilterSection">
          <div class="homeFilterStack">
            <div class="segWrap timeframeUnifiedControl" role="group" aria-label="Home timeframe filter">
              ${chip("YTD", "YTD")}
              ${chip("MONTH", "This Month")}
              ${chip("LAST_MONTH", "Last Month")}
              ${chip("7D", "Last 7 Days")}
              ${chip("30D", "Last 30 Days")}
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
        </section>

        <section class="homeSection homeKpiSection">
          <div class="kpiGroupLabel">Core metrics</div>
          <div class="kpiRow">
            <button class="kpiCard kpiCardTap" type="button" data-kpi-detail="trips" aria-label="Open trips detail">
              <div class="kpiLabel trips">Trips</div>
              <div class="kpiValue trips"><span class="kpiValueFit">${trips.length}</span></div>
            </button>
            <button class="kpiCard kpiCardTap" type="button" data-kpi-detail="pounds" aria-label="Open pounds detail">
              <div class="kpiLabel lbsBlue">Pounds</div>
              <div class="kpiValue lbsBlue"><span class="kpiValueFit">${lbsStr} lbs</span></div>
            </button>
            <button class="kpiCard kpiCardPrimary kpiCardTap" type="button" data-kpi-detail="amount" aria-label="Open amount detail">
              <div class="kpiLabel money">Amount</div>
              <div class="kpiValue money"><span class="kpiValueFit">${moneyRounded}</span></div>
            </button>
            <button class="kpiCard kpiCardPrimary kpiCardTap" type="button" data-kpi-detail="ppl" aria-label="Open average dollars per pound detail">
              <div class="kpiLabel rate ppl">Avg $/lb</div>
              <div class="kpiValue rate ppl"><span class="kpiValueFit">${avgPpl === null ? "—" : formatMoney(avgPpl)}</span></div>
            </button>
          </div>
        </section>

        <section class="homeSection homeOverviewCard">
          <div class="reportsHeroEyebrow">Overview</div>
          <div class="homeHeroHeadline">${escapeHtml(homeOverviewHeadline)}</div>
          <div class="reportsHeroSub">Range ${escapeHtml(homeOverviewRangeLabel)} • ${trips.length} trips • Home summary</div>
          <div class="reportsHeroGrid">
            <div class="reportsHeroStat">
              <div class="reportsHeroLabel">Average amount / trip</div>
              <div class="reportsHeroValue money">${avgAmountPerTrip === null ? "—" : formatMoney(round2(avgAmountPerTrip))}</div>
            </div>
            <div class="reportsHeroStat">
              <div class="reportsHeroLabel">Average pounds / trip</div>
              <div class="reportsHeroValue lbsBlue">${avgPoundsPerTrip === null ? "—" : `${round2(avgPoundsPerTrip)} lbs`}</div>
            </div>
            <div class="reportsHeroStat">
              <div class="reportsHeroLabel">Top dealer</div>
              <div class="reportsHeroValue">${escapeHtml(strongestDealer?.dealer || "—")}</div>
              <div class="reportsHeroMeta money">${strongestDealer ? formatMoney(round2(strongestDealer.amount)) : "No trips in range"}</div>
            </div>
            <div class="reportsHeroStat">
              <div class="reportsHeroLabel">Strongest area</div>
              <div class="reportsHeroValue">${escapeHtml(strongestArea?.area || "—")}</div>
              <div class="reportsHeroMeta money">${strongestArea ? formatMoney(round2(strongestArea.amount)) : "No trips in range"}</div>
            </div>
          </div>
        </section>

        <section class="homeSection homeLastTripShell">
          <div class="homeLastTripHeaderRow">
            <div class="homeLastTripHeader reportsHeroEyebrow">Last Saved Trip</div>
            <div class="homeLastTripRangePill">Range ${escapeHtml(homeOverviewRangeLabel)}</div>
          </div>
          ${lastSavedTripContextHtml}
          ${lastSavedTripHtml}
        </section>
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

    getApp().querySelectorAll("[data-kpi-detail]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const metricKey = String(btn.getAttribute("data-kpi-detail") || "").toLowerCase();
        if (!metricKey) return;
        ensureHomeFilter();
        const launchedHomeFilter = {
          mode: String(state.homeFilter?.mode || "YTD").toUpperCase(),
          from: parseReportDateToISO(state.homeFilter?.from || "") || "",
          to: parseReportDateToISO(state.homeFilter?.to || "") || ""
        };
        const launchedRangeLabel = launchedHomeFilter.mode === "RANGE"
          ? `${launchedHomeFilter.from || "—"} → ${launchedHomeFilter.to || "—"}`
          : (launchedHomeFilter.mode === "MONTH" ? "This Month"
            : (launchedHomeFilter.mode === "LAST_MONTH" ? "Last Month"
              : (launchedHomeFilter.mode === "7D" ? "Last 7 Days"
                : (launchedHomeFilter.mode === "30D" ? "Last 30 Days"
                  : "YTD"))));
        state.homeMetricDetail = metricKey;
        state.homeMetricDetailContext = {
          homeFilter: launchedHomeFilter,
          homeScope: {
            rangeLabel: launchedRangeLabel,
            tripCount: trips.length,
            contextText: `Home • Range ${launchedRangeLabel} • ${trips.length} trips`
          }
        };
        state.reportsMetricDetail = "";
        state.reportsMetricDetailContext = null;
        state.view = "home";
        saveState();
        render();
      });
    });

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
    const btnHomeBeginnerPrimary = document.getElementById("homeBeginnerPrimary");
    if (btnHomeBeginnerPrimary) {
      btnHomeBeginnerPrimary.onclick = () => {
        state.view = "new";
        state.lastAction = "nav:new";
        saveState();
        render();
      };
    }
    const btnHomeBeginnerHelp = document.getElementById("homeBeginnerHelp");
    if (btnHomeBeginnerHelp) {
      btnHomeBeginnerHelp.onclick = () => {
        state.helpJump = "newtrip";
        state.view = "help";
        state.lastAction = "nav:help";
        saveState();
        render();
      };
    }
    const btnHomeInstallAction = document.getElementById("homeInstallAction");
    if (btnHomeInstallAction) {
      btnHomeInstallAction.onclick = async () => {
        if (typeof runInstallAction !== "function") return;
        const result = await runInstallAction();
        if (result?.message) showToast(result.message);
        renderHome();
      };
    }
    const btnHomeInstallHelp = document.getElementById("homeInstallHelp");
    if (btnHomeInstallHelp) {
      btnHomeInstallHelp.onclick = () => {
        state.helpJump = "install";
        state.view = "help";
        state.lastAction = "nav:help-install";
        saveState();
        render();
      };
    }
    const btnHomeBeginnerDismiss = document.getElementById("homeBeginnerDismiss");
    if (btnHomeBeginnerDismiss) {
      btnHomeBeginnerDismiss.onclick = () => {
        const settings = state.settings || (state.settings = {});
        settings.onboardingHomeDismissed = true;
        state.lastAction = "homeOnboarding:dismiss";
        saveState();
        renderHome();
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
