import { createTimeframeFilterControlsSeam } from "./timeframe_filter_controls_seam_v5.js";
import { createFilteredRowsMemo, createRowsComputationMemo } from "./runtime_memo_v5.js";
import { renderInstallSurface } from "./install_surface_renderer_v5.js";
import { createStatusSurfaceSeam } from "./status_surface_seam_v5.js";

export function createHomeDashboardRenderer({
  state,
  buildUnifiedFilterFromHomeFilter,
  applyUnifiedTripFilter,
  computeAggregatePPL,
  round2,
  getTripsNewestFirst,
  renderPageHeader,
  escapeHtml,
  parseReportDateToISO,
  formatDateDMY,
  formatMoney,
  getApp,
  saveState,
  render,
  bindDatePill,
  normalizeCustomRangeWithFeedback,
  showToast,
  tipMsg,
  exportBackup,
  renderHomeMetricDetail,
  getInstallSurfaceModel,
  runInstallAction,
  renderTripsBrowseInteractiveTripCard,
  renderTripsBrowseReadOnlyTripCard,
  createTripShareCardSeam,
  openModal,
  closeModal,
  openScreenshotCardPreview
}) {
  const timeframeFilterControls = createTimeframeFilterControlsSeam({
    escapeHtml,
    parseReportDateToISO,
    formatDateDMY
  });
  const statusSurfaceSeam = createStatusSurfaceSeam({ escapeHtml });
  const tripShareCardSeam = createTripShareCardSeam({
    parseReportDateToISO,
    round2,
    formatMoney
  });
  let homeKpiFitBound = false;
  let homeKpiFitRaf = 0;

  const getHomeFilteredTrips = createFilteredRowsMemo((rows, unified)=> applyUnifiedTripFilter(rows, unified));
  const getHomeRangeTotals = createRowsComputationMemo((rows)=> {
    const totalAmount = rows.reduce((s, t) => s + (Number(t?.amount) || 0), 0);
    const totalLbs = rows.reduce((s, t) => s + (Number(t?.pounds) || 0), 0);
    return {
      totalAmount,
      totalLbs,
      avgAmountPerTrip: rows.length ? (totalAmount / rows.length) : null,
      avgPoundsPerTrip: rows.length ? (totalLbs / rows.length) : null
    };
  });
  const computeHomeOverview = createRowsComputationMemo((rows)=> {
    const totalAmount = rows.reduce((s, t) => s + (Number(t?.amount) || 0), 0);
    const totalLbs = rows.reduce((s, t) => s + (Number(t?.pounds) || 0), 0);
    const dealerRollup = rows.reduce((map, trip) => {
      const dealerName = String(trip?.dealer || "").trim() || "Dealer not set";
      const next = map.get(dealerName) || { dealer: dealerName, trips: 0, amount: 0, pounds: 0 };
      next.trips += 1;
      next.amount += Number(trip?.amount) || 0;
      next.pounds += Number(trip?.pounds) || 0;
      map.set(dealerName, next);
      return map;
    }, new Map());
    const areaRollup = rows.reduce((map, trip) => {
      const areaName = String(trip?.area || "").trim() || "Area not set";
      const next = map.get(areaName) || { area: areaName, trips: 0, amount: 0, pounds: 0 };
      next.trips += 1;
      next.amount += Number(trip?.amount) || 0;
      next.pounds += Number(trip?.pounds) || 0;
      map.set(areaName, next);
      return map;
    }, new Map());
    const dealers = Array.from(dealerRollup.values());
    return {
      totalAmount,
      totalLbs,
      dealers,
      strongestDealer: dealers.length ? dealers.slice().sort((a, b) => b.amount - a.amount || b.pounds - a.pounds || b.trips - a.trips)[0] : null,
      strongestArea: Array.from(areaRollup.values()).sort((a, b) => b.pounds - a.pounds || b.amount - a.amount || b.trips - a.trips)[0] || null
    };
  });

  function ensureHomeFilter() {
    if (!state.homeFilter || typeof state.homeFilter !== "object") state.homeFilter = { mode: "YTD", from: "", to: "" };
    if (!state.homeFilter.mode) state.homeFilter.mode = "YTD";
    const normalizedMode = String(state.homeFilter.mode || "YTD").toUpperCase();
    if (normalizedMode === "ALL") state.homeFilter.mode = "YTD";
    if (state.homeFilter.from == null) state.homeFilter.from = "";
    if (state.homeFilter.to == null) state.homeFilter.to = "";
    if (!Array.isArray(state.homeFilter.customRangeCorrectionMessages)) state.homeFilter.customRangeCorrectionMessages = [];
  }


  function renderHomeTimeframeControls({ mode = "YTD", homeFilter = {} } = {}){
    const fMode = String(mode || "YTD").toUpperCase();
    const correctionMessages = Array.isArray(homeFilter.customRangeCorrectionMessages)
      ? homeFilter.customRangeCorrectionMessages
      : [];
    const quickFilterByKey = new Map(
      timeframeFilterControls.HOME_PRESET_FILTER_ITEMS.map((item)=> [String(item?.key || "").toUpperCase(), item])
    );
    const homeQuickItems = [
      { key: "YTD", label: "Season Preview", subLabel: "(Free Preview)" },
      { key: "7D", label: "7 Days" },
      { key: "14D", label: "14 Days" },
      { key: "28D", label: "4 Weeks" }
    ].map((item)=> ({ ...quickFilterByKey.get(String(item.key || "").toUpperCase()), ...item }));
    const homeFuturePaidItems = [
      { key: "YTD", label: "YTD" },
      { key: "MONTH", label: "This Month" },
      { key: "RANGE", label: "Custom" }
    ].map((item)=> ({ ...quickFilterByKey.get(String(item.key || "").toUpperCase()), ...item }));
    const premiumRowChips = homeFuturePaidItems.map((item)=> {
      const isSelected = fMode === String(item.key || "").toUpperCase();
      const textLabel = String(item.label || item.key || "");
      return `<button class="chip segBtn homeTimeframeChip homeTimeframeChipLocked ${isSelected ? "on is-selected" : ""}" data-hf="${escapeHtml(String(item.key || ""))}" type="button" aria-label="${escapeHtml(textLabel)}"><span class="timeframeChipMainLabel">${escapeHtml(textLabel)}</span></button>`;
    }).join("");
    return `
      ${timeframeFilterControls.renderPresetChipRow({
        items: homeQuickItems,
        activeKey: fMode,
        dataAttr: "data-hf",
        chipClass: "homeTimeframeChip",
        groupClass: "homeTimeframeRow homeTimeframeRowQuick",
        ariaLabel: "Home timeframe filter"
      })}
      <div class="segWrap timeframeUnifiedControl homeTimeframeRow homeTimeframeRowLocked" role="group" aria-label="Home premium ranges">
        <div class="homePremiumInlineLabel" aria-hidden="true">Premium 🔒</div>
        ${premiumRowChips}
      </div>
      ${timeframeFilterControls.renderCustomRangeRow({
        mode: fMode,
        fromValue: homeFilter.from,
        toValue: homeFilter.to,
        fromId: "homeRangeFrom",
        toId: "homeRangeTo",
        applyId: "homeRangeApply",
        wrapperClass: "homeRangeRow"
      })}
      ${timeframeFilterControls.renderCorrectionMessages({
        mode: fMode,
        messages: correctionMessages,
        className: "homeRangeCorrectionNote"
      })}
    `;
  }
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
    const trips = getHomeFilteredTrips(tripsAll, unified);
    const { totalAmount, totalLbs, strongestDealer, strongestArea } = computeHomeOverview(trips);
    const avgPpl = totalLbs > 0 ? computeAggregatePPL(totalLbs, totalAmount) : null;
    const {
      avgAmountPerTrip,
      avgPoundsPerTrip
    } = getHomeRangeTotals(trips);
    const trendToneFromDelta = (delta, epsilon = 0.00001) => {
      if (!Number.isFinite(delta) || Math.abs(delta) <= epsilon) return "flat";
      return delta > 0 ? "up" : "down";
    };
    const renderOverviewTrendArrow = (tone, label) => {
      if (tone !== "up" && tone !== "down") return "";
      const arrow = tone === "up" ? "↗" : "↘";
      const cssTone = tone === "up" ? "homeOverviewTrend--up" : "homeOverviewTrend--down";
      return `<span class="homeOverviewTrend ${cssTone}" aria-label="${escapeHtml(label)}">${arrow}</span>`;
    };

    const resolveLatestTickAverages = (activeTrips) => {
      if (!Array.isArray(activeTrips) || activeTrips.length < 2) {
        return {
          currentAvgAmountPerTrip: null,
          previousAvgAmountPerTrip: null,
          currentAvgPoundsPerTrip: null,
          previousAvgPoundsPerTrip: null
        };
      }
      const newestFirst = getTripsNewestFirst(activeTrips);
      const oldestFirst = newestFirst.slice().reverse();
      const beforeLatest = oldestFirst.slice(0, -1);
      const currentTotals = getHomeRangeTotals(oldestFirst);
      const previousTotals = getHomeRangeTotals(beforeLatest);
      return {
        currentAvgAmountPerTrip: currentTotals.avgAmountPerTrip,
        previousAvgAmountPerTrip: previousTotals.avgAmountPerTrip,
        currentAvgPoundsPerTrip: currentTotals.avgPoundsPerTrip,
        previousAvgPoundsPerTrip: previousTotals.avgPoundsPerTrip
      };
    };

    const formatGroupedHomeNumber = (value, { maximumFractionDigits = 2 } = {}) => {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return "0";
      try {
        return new Intl.NumberFormat("en-US", {
          minimumFractionDigits: 0,
          maximumFractionDigits
        }).format(numeric);
      } catch {
        return numeric.toLocaleString("en-US", { maximumFractionDigits });
      }
    };

    const formatHomePounds = (value, { maximumFractionDigits = 0 } = {}) => {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return "0 lbs";
      return `${formatGroupedHomeNumber(numeric, { maximumFractionDigits })} lbs`;
    };

    const f = String((state.homeFilter && state.homeFilter.mode) || "YTD").toUpperCase();
    const lbsVal = round2(totalLbs);
    const toKiloBandLabel = (value) => {
      const numeric = Number(value);
      if (!(numeric > 0)) return "—";
      const valueInK = numeric / 1000;
      const lowerK = Math.max(0, Math.floor(valueInK));
      const upperK = Math.max(lowerK + 1, Math.ceil(valueInK) + 2);
      return `${lowerK}k–${upperK}k lbs`;
    };
    const toMoneyBandLabel = (value) => {
      const numeric = Number(value);
      if (!(numeric > 0)) return "—";
      const valueInK = numeric / 1000;
      const lowerK = Math.max(0, Math.floor(valueInK));
      const upperK = Math.max(lowerK + 1, Math.ceil(valueInK) + 2);
      return `$${lowerK}k–$${upperK}k`;
    };
    const toAvgPplBandLabel = (value) => {
      const numeric = Number(value);
      if (!(numeric > 0)) return "—";
      const dollarBand = Math.floor(numeric);
      const bandProgress = numeric - dollarBand;
      const tier = bandProgress <= 0.33 ? "Low" : (bandProgress <= 0.66 ? "Mid" : "High");
      return `${tier} $${dollarBand}/lb range`;
    };
    const isSeasonPreviewMode = f === "YTD";
    const lbsStr = isSeasonPreviewMode ? toKiloBandLabel(lbsVal) : formatGroupedHomeNumber(lbsVal);
    const tripsStr = formatGroupedHomeNumber(trips.length, { maximumFractionDigits: 0 });
    const moneyRounded = (() => {
      const v = Math.round(Number(totalAmount) || 0);
      try { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v); }
      catch { return "$" + v.toLocaleString("en-US"); }
    })();
    const amountDisplay = isSeasonPreviewMode ? toMoneyBandLabel(totalAmount) : moneyRounded;
    const avgPplDisplay = isSeasonPreviewMode ? toAvgPplBandLabel(avgPpl) : (avgPpl === null ? "—" : formatMoney(avgPpl));

    const s = state.settings || (state.settings = {});
    const isStandalone = (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || (window.navigator && window.navigator.standalone === true);
    const pwaNoteDismissed = !!s.pwaStorageNoteDismissed;
    const showPwaStorageNote = isStandalone && !pwaNoteDismissed;
    const hasSavedTrips = tripsAll.length > 0;
    const shouldShowBeginnerCard = !hasSavedTrips && !s.onboardingHomeDismissed;
    const pwaStorageNoteHTML = showPwaStorageNote ? statusSurfaceSeam.renderStatusSurface({
      variant: "homeTrust",
      emphasis: "soft",
      title: "Installed app check",
      statusPill: "Trust",
      body: "Browser mode and Installed mode are both valid. Installed mode is recommended for app-like use.",
      support: "Storage can differ by mode or device, so create backup and restore backup when switching phones, browsers, or app modes.",
      actions: [
        { id: "pwaNoteHelp", label: "Review safe transfer" },
        { id: "pwaNoteDismiss", label: "Got it" }
      ]
    }) : "";

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

    const backupReminderHTML = shouldRemind ? statusSurfaceSeam.renderStatusSurface({
      variant: "homeTrust",
      emphasis: "warning",
      title: "Backup reminder",
      statusPill: "Needs backup",
      body: `You have ${newCount > 0 ? newCount : tripsAll.length} trip${(newCount > 1 || (!lastAt && tripsAll.length !== 1)) ? "s" : ""} not yet included in your latest backup.`,
      actions: [
        { id: "backupNow", label: "💾 Create Backup" },
        { id: "backupLater", label: "Not now" }
      ]
    }) : "";

    const tripsSorted = getTripsNewestFirst(trips);
    const newestSavedTrip = tripsSorted[0] || null;
    const latestTickAverages = resolveLatestTickAverages(trips);
    const avgAmountTrendTone = Number.isFinite(latestTickAverages.currentAvgAmountPerTrip)
      && Number.isFinite(latestTickAverages.previousAvgAmountPerTrip)
      ? trendToneFromDelta(
        latestTickAverages.currentAvgAmountPerTrip - latestTickAverages.previousAvgAmountPerTrip,
        0.01
      )
      : "flat";
    const avgPoundsTrendTone = Number.isFinite(latestTickAverages.currentAvgPoundsPerTrip)
      && Number.isFinite(latestTickAverages.previousAvgPoundsPerTrip)
      ? trendToneFromDelta(
        latestTickAverages.currentAvgPoundsPerTrip - latestTickAverages.previousAvgPoundsPerTrip,
        0.001
      )
      : "flat";
    const installModel = typeof getInstallSurfaceModel === "function" ? getInstallSurfaceModel() : null;
    const showInstallCard = shouldShowBeginnerCard && installModel && !installModel.isInstalled;
    const installCardHTML = showInstallCard
      ? renderInstallSurface({
        model: installModel,
        mode: "compact",
        escapeHtml,
        actionId: "homeInstallAction",
        helpId: "homeInstallHelp"
      })
      : ``;

    const homeBeginnerCardHTML = shouldShowBeginnerCard ? `
      <section class="homeSection homeBeginnerSection">
        ${statusSurfaceSeam.renderStatusSurface({
          variant: "homeBeginner",
          emphasis: "soft",
          className: "homeBeginnerCard",
          eyebrow: "Start here",
          title: "Add a trip to unlock Home.",
          body: "Save your first trip, then Home fills in automatically.",
          supportHtml: `<div class="homeBeginnerSteps" aria-label="Beginner next steps"><div class="homeBeginnerStep"><span class="homeBeginnerStepNum">1</span><span>Add a trip in New Trip.</span></div><div class="homeBeginnerStep"><span class="homeBeginnerStepNum">2</span><span>Return to Home for your latest summary.</span></div><div class="homeBeginnerStep"><span class="homeBeginnerStepNum">3</span><span>Open Insights after a few more trips.</span></div></div>`,
          actions: [
            { id: "homeBeginnerPrimary", label: "＋ New Trip", tone: "primary" },
            { id: "homeBeginnerHelp", label: "Quick start help" },
            { id: "homeBeginnerDismiss", label: "Dismiss", tone: "btn-ghost", className: "homeBeginnerDismiss" }
          ],
          actionsClass: "homeBeginnerActions"
        })}
      </section>
      ${installCardHTML}
    ` : ``;

    const newestSavedTripId = String(newestSavedTrip?.id || "").trim();
    const hasEditableLatestTrip = !!(newestSavedTrip && newestSavedTripId);
    const lastSavedTripContextHtml = newestSavedTrip
      ? ``
      : `<div class="homeLastTripContext">Your latest trip appears here after your first save.</div>`;

    const lastSavedTripHtml = newestSavedTrip
      ? (() => {
        const fallbackDate = parseReportDateToISO(newestSavedTrip.dateISO || "") || "Date not set";
        if (typeof renderTripsBrowseInteractiveTripCard !== "function") {
          return `
            <div class="emptyState compact homeLastTripFallback">
              <div class="emptyStateTitle">Latest saved trip • ${escapeHtml(fallbackDate)}</div>
            </div>
          `;
        }
        return `<div class="homeLastTripCardWrap">${renderTripsBrowseInteractiveTripCard(newestSavedTrip)}</div>`;
      })()
      : `<div class="emptyState compact homeLastTripFallback"><div class="emptyStateTitle">No trip saved yet</div><div class="emptyStateBody">Save your first trip to show it here.</div></div>`;

    const homeFilterLabel = timeframeFilterControls.resolveRangeLabel({
      mode: f,
      fromISO: unified.fromISO,
      toISO: unified.toISO,
      monthLabel: "Current Month",
      lastMonthLabel: "Previous Month"
    });
    const homeOverviewRangeLabel = homeFilterLabel;
    const lastTripHeaderActionHtml = hasEditableLatestTrip
      ? ``
      : `<div class="homeLastTripRangePill">Range ${escapeHtml(homeOverviewRangeLabel)}</div>`;
    getApp().innerHTML = `
      ${renderPageHeader("home")}

      <div class="card dashCard homeScreenShell">
        ${homeBeginnerCardHTML}
        <section class="homeSection homeFilterSection">
          <div class="homeFilterStack">
            ${renderHomeTimeframeControls({ mode: f, homeFilter: hf })}
          </div>
        </section>

        <section class="homeSection homeKpiSection">
          <div class="kpiRow">
            <button class="kpiCard kpiCardTap" type="button" data-kpi-detail="trips" aria-label="Open trips detail">
              <div class="kpiLabel trips">Trips</div>
              <div class="kpiValue trips"><span class="kpiValueFit">${tripsStr}</span></div>
            </button>
            <button class="kpiCard kpiCardTap" type="button" data-kpi-detail="pounds" aria-label="Open pounds detail">
              <div class="kpiLabel lbsBlue">Pounds</div>
              <div class="kpiValue lbsBlue"><span class="kpiValueFit">${lbsStr}</span></div>
            </button>
            <button class="kpiCard kpiCardPrimary kpiCardTap" type="button" data-kpi-detail="amount" aria-label="Open amount detail">
              <div class="kpiLabel money">Amount</div>
              <div class="kpiValue money"><span class="kpiValueFit">${amountDisplay}</span></div>
            </button>
            <button class="kpiCard kpiCardPrimary kpiCardTap" type="button" data-kpi-detail="ppl" aria-label="Open average dollars per pound detail">
              <div class="kpiLabel rate ppl">Avg $ / lb</div>
              <div class="kpiValue rate ppl"><span class="kpiValueFit">${avgPplDisplay}</span></div>
            </button>
          </div>
        </section>

        <section class="homeSection homeLastTripShell">
          <div class="homeLastTripHeaderRow">
            <div class="homeLastTripHeader reportsHeroEyebrow">Last Saved Trip</div>
            ${lastTripHeaderActionHtml}
          </div>
          ${lastSavedTripContextHtml}
          ${lastSavedTripHtml}
        </section>

        <section class="homeSection homeOverviewCard">
          <div class="homeOverviewHeaderRow">
            <div class="reportsHeroEyebrow">Overview</div>
            <div class="homeOverviewScopePill" aria-label="Active Home filter scope">${escapeHtml(homeOverviewRangeLabel)} • ${trips.length} trips</div>
          </div>
          <div class="homeOverviewGrid">
            <div class="homeOverviewStat homeOverviewStat--top">
              <div class="reportsHeroLabel">AVG $ / TRIP</div>
              <div class="reportsHeroValue money homeOverviewHeroValue">${avgAmountPerTrip === null ? "—" : formatMoney(round2(avgAmountPerTrip))}</div>
              ${renderOverviewTrendArrow(avgAmountTrendTone, "Average amount trend")}
            </div>
            <div class="homeOverviewStat homeOverviewStat--top">
              <div class="reportsHeroLabel">AVG LBS / TRIP</div>
              <div class="reportsHeroValue lbsBlue homeOverviewHeroValue">${avgPoundsPerTrip === null ? "—" : `${round2(avgPoundsPerTrip)}`}</div>
              ${renderOverviewTrendArrow(avgPoundsTrendTone, "Average pounds trend")}
            </div>
            <div class="homeOverviewStat">
              <div class="reportsHeroLabel">TOP DEALER</div>
              <div class="reportsHeroValue homeOverviewDealerValue">${escapeHtml(strongestDealer?.dealer || "—")}</div>
              <div class="reportsHeroMeta money">${strongestDealer ? formatMoney(round2(strongestDealer.amount)) : "No trips in range"}</div>
            </div>
            <div class="homeOverviewStat">
              <div class="reportsHeroLabel">STRONGEST AREA</div>
              <div class="reportsHeroValue">${escapeHtml(strongestArea?.area || "—")}</div>
              <div class="reportsHeroMeta homeOverviewMetaPounds">${strongestArea ? formatHomePounds(round2(strongestArea.pounds)) : "No trips in range"}</div>
            </div>
          </div>
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
        const nextMode = String(btn.getAttribute("data-hf") || "YTD").toUpperCase();
        const isFuturePaidPreview = nextMode === "MONTH" || nextMode === "ALL" || nextMode === "RANGE";
        const filterToastMessage = isFuturePaidPreview
          ? "Premium range preview — available for testing while Bank the Catch is being built."
          : "";
        state.homeFilter.mode = nextMode;
        if(state.homeFilter.mode !== "RANGE") state.homeFilter.customRangeCorrectionMessages = [];
        saveState();
        if (filterToastMessage) showToast(filterToastMessage);
        renderHome();
      });
    });
    const homeApply = document.getElementById("homeRangeApply");
    if (homeApply) {
      homeApply.onclick = () => {
        ensureHomeFilter();
        const from = parseReportDateToISO(document.getElementById("homeRangeFrom")?.value || "");
        const to = parseReportDateToISO(document.getElementById("homeRangeTo")?.value || "");
        const normalized = normalizeCustomRangeWithFeedback({ fromISO: from, toISO: to });
        state.homeFilter.from = normalized.fromISO;
        state.homeFilter.to = normalized.toISO;
        state.homeFilter.customRangeCorrectionMessages = normalized.messages;
        saveState();
        showToast("Range updated");
        renderHome();
      };
    }
    bindDatePill("homeRangeFrom");
    bindDatePill("homeRangeTo");
    fitHomeKpiValues();
    const homeLastTripCardWrap = getApp().querySelector(".homeLastTripCardWrap");
    if (homeLastTripCardWrap && newestSavedTrip && hasEditableLatestTrip) {
      const openLatestTripEditor = () => {
        state.editId = newestSavedTripId;
        state.view = "edit";
        saveState();
        render();
      };
      homeLastTripCardWrap.querySelectorAll("[data-trip-action]").forEach((btn) => {
        btn.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          const action = String(btn.getAttribute("data-trip-action") || "").toLowerCase();
          if (action === "share") {
            openScreenshotCardPreview({
              trip: newestSavedTrip,
              renderTripsBrowseReadOnlyTripCard,
              openModal,
              closeModal,
              showToast,
              escapeHtml
            });
            return;
          }
          if (action === "edit") openLatestTripEditor();
        });
      });
    }

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
        const launchedRangeLabel = timeframeFilterControls.resolveRangeLabel({
          mode: launchedHomeFilter.mode,
          fromISO: launchedHomeFilter.from,
          toISO: launchedHomeFilter.to,
          monthLabel: "Current Month",
          lastMonthLabel: "Previous Month"
        });
        state.homeMetricDetail = metricKey;
        state.homeMetricDetailContext = {
          homeFilter: launchedHomeFilter,
          homeScope: {
            rangeLabel: launchedRangeLabel,
            tripCount: trips.length,
            contextText: `Range ${launchedRangeLabel} • ${trips.length} trips`
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
