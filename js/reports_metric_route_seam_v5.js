export function createReportsMetricRouteSeam(deps){
  const {
    parseReportDateToISO,
    resolveUnifiedRange,
    formatDateDMY,
    applyUnifiedTripFilter,
    buildUnifiedFilterFromReportsFilter
  } = deps;
  const getMemoizedFilteredTrips = createMemoizedFilteredTrips(applyUnifiedTripFilter);

  function clearStaleHomeDetailForReports({ state, homeMetricOnly = false } = {}){
    if(homeMetricOnly) return false;
    const hasStaleHomeDetail = String(state?.homeMetricDetail || "").trim()
      || (state?.homeMetricDetailContext && typeof state.homeMetricDetailContext === "object");
    if(!hasStaleHomeDetail) return false;
    state.homeMetricDetail = "";
    state.homeMetricDetailContext = null;
    return true;
  }

  function mapHomeModeToUnifiedRange(modeValue){
    const normalized = String(modeValue || "YTD").toUpperCase();
    if(normalized === "ALL") return "all";
    if(normalized === "MONTH" || normalized === "THIS_MONTH") return "mtd";
    if(normalized === "LAST_MONTH") return "last_month";
    if(normalized === "LAST_YEAR") return "last_year";
    if(normalized === "7D" || normalized === "LAST_7_DAYS") return "7d";
    if(normalized === "30D") return "30d";
    if(normalized === "90D") return "90d";
    if(normalized === "12M") return "12m";
    if(normalized === "RANGE" || normalized === "CUSTOM") return "custom";
    return "ytd";
  }

  function buildHomeMetricScope({ homeFilter, homeScopeSnapshot = null, tripsAll = [] } = {}){
    const normalizedFilter = homeFilter && typeof homeFilter === "object"
      ? {
        mode: String(homeFilter.mode || "YTD").toUpperCase(),
        from: parseReportDateToISO(homeFilter.from || "") || "",
        to: parseReportDateToISO(homeFilter.to || "") || ""
      }
      : null;
    if(!normalizedFilter) return null;

    const unifiedFilter = {
      range: mapHomeModeToUnifiedRange(normalizedFilter.mode),
      fromISO: normalizedFilter.from,
      toISO: normalizedFilter.to,
      dealer: "all",
      area: "all",
      species: "all",
      text: ""
    };
    const resolvedRange = resolveUnifiedRange(unifiedFilter);
    const displayRangeLabel = unifiedFilter.range === "custom"
      ? `${formatDateDMY(resolvedRange.fromISO)} → ${formatDateDMY(resolvedRange.toISO)}`
      : String(resolvedRange.label || "YTD");
    const filtered = getMemoizedFilteredTrips(tripsAll, unifiedFilter);
    const fallbackTripCount = filtered.rows.length;
    const snapshotTripCount = Number(homeScopeSnapshot?.tripCount);
    const tripCount = Number.isFinite(snapshotTripCount) && snapshotTripCount >= 0
      ? snapshotTripCount
      : fallbackTripCount;
    const contextText = `Home • Range ${displayRangeLabel} • ${tripCount} trips`;

    return {
      filter: normalizedFilter,
      unifiedFilter,
      resolvedRange,
      rangeLabel: displayRangeLabel,
      tripCount,
      contextText,
      trips: filtered.rows
    };
  }

  function resolveReportsRangeLabel({ isHomeMetricDetail, homeScope, fMode, hasValidRange, resolvedReportsRange } = {}){
    if(isHomeMetricDetail && homeScope) return homeScope.rangeLabel;
    if(fMode === "RANGE"){
      return hasValidRange
        ? `${formatDateDMY(resolvedReportsRange.fromISO)} → ${formatDateDMY(resolvedReportsRange.toISO)}`
        : "Set dates";
    }
    if(fMode === "THIS_MONTH") return "This Month";
    if(fMode === "LAST_MONTH") return "Last Month";
    if(fMode === "LAST_YEAR") return "Previous Year";
    if(fMode === "90D") return "Last 3 Months";
    if(fMode === "ALL") return "All Time";
    return "YTD";
  }

  function resolveMetricRouteContext({ state, homeMetricOnly = false, tripsAll = [], reportsPresetModes = [] } = {}){
    const rf = state?.reportsFilter || { mode:"YTD", from:"", to:"", dealer:"", area:"", adv:false };
    const fMode = String(rf.mode || "YTD").toUpperCase();
    const hasReportsCustomConstraints = !!parseReportDateToISO(rf.from)
      || !!parseReportDateToISO(rf.to)
      || !!String(rf.dealer || "").trim()
      || !!String(rf.area || "").trim();
    const isPresetExactMatch = reportsPresetModes.includes(fMode) && !hasReportsCustomConstraints;
    const isAdvancedActive = !!rf.adv || !isPresetExactMatch;
    const activePresetFilterKey = isPresetExactMatch ? fMode : "";

    const reportsSectionKey = String(state?.reportsSection || "insights").toLowerCase();
    const reportsMetricDetail = String(state?.reportsMetricDetail || "").toLowerCase();
    const reportsMetricDetailContext = state?.reportsMetricDetailContext && typeof state.reportsMetricDetailContext === "object"
      ? state.reportsMetricDetailContext
      : null;
    const homeMetricDetail = String(state?.homeMetricDetail || "").toLowerCase();
    const homeMetricDetailContext = state?.homeMetricDetailContext && typeof state.homeMetricDetailContext === "object"
      ? state.homeMetricDetailContext
      : null;

    const isHomeMetricDetail = !!homeMetricOnly;
    const activeMetricDetail = isHomeMetricDetail ? homeMetricDetail : reportsMetricDetail;
    const metricDetailContext = isHomeMetricDetail ? homeMetricDetailContext : reportsMetricDetailContext;

    const hasValidRange = (fMode !== "RANGE") || (parseReportDateToISO(rf.from) && parseReportDateToISO(rf.to));
    const homeScope = isHomeMetricDetail
      ? buildHomeMetricScope({
        homeFilter: metricDetailContext?.homeFilter,
        homeScopeSnapshot: metricDetailContext?.homeScope,
        tripsAll
      })
      : null;

    const unified = (isHomeMetricDetail && activeMetricDetail && homeScope)
      ? homeScope.unifiedFilter
      : buildUnifiedFilterFromReportsFilter(rf);

    const filteredReportsResult = getMemoizedFilteredTrips(tripsAll, hasValidRange ? unified : { ...unified, range:"all" });
    const trips = isHomeMetricDetail && activeMetricDetail && homeScope
      ? homeScope.trips
      : filteredReportsResult.rows;

    const seasonalityUnified = { ...unified, range: "all", fromISO: "", toISO: "" };
    const seasonalityResult = getMemoizedFilteredTrips(tripsAll, seasonalityUnified);
    const seasonalityTrips = isHomeMetricDetail && homeScope
      ? homeScope.trips
      : seasonalityResult.rows;

    const excludedQuarantinedCount = Number((isHomeMetricDetail && homeScope)
      ? 0
      : filteredReportsResult?.transparency?.excludedQuarantinedCount || 0);
    const quarantinedSupportCopy = excludedQuarantinedCount > 0
      ? `Some trips are excluded from Insights date filtering because their date is invalid (quarantined): ${excludedQuarantinedCount}.`
      : "";

    const resolvedReportsRange = isHomeMetricDetail && homeScope
      ? homeScope.resolvedRange
      : resolveUnifiedRange(unified);
    const rangeLabel = resolveReportsRangeLabel({
      isHomeMetricDetail,
      homeScope,
      fMode,
      hasValidRange,
      resolvedReportsRange
    });
    const reportsBodyView = activeMetricDetail ? "metric-detail" : reportsSectionKey;

    return {
      rf,
      fMode,
      hasValidRange,
      isAdvancedActive,
      activePresetFilterKey,
      reportsSectionKey,
      reportsMetricDetail,
      reportsMetricDetailContext,
      homeMetricDetail,
      homeMetricDetailContext,
      isHomeMetricDetail,
      activeMetricDetail,
      metricDetailContext,
      homeScope,
      unified,
      trips,
      seasonalityTrips,
      quarantinedSupportCopy,
      resolvedReportsRange,
      rangeLabel,
      reportsBodyView
    };
  }

  return {
    clearStaleHomeDetailForReports,
    mapHomeModeToUnifiedRange,
    buildHomeMetricScope,
    resolveMetricRouteContext
  };
}

function createMemoizedFilteredTrips(applyUnifiedTripFilter){
  let lastRowsRef = null;
  let lastFilterKey = "";
  let lastResult = null;
  return function memoized(rows, filter){
    const safeRows = Array.isArray(rows) ? rows : [];
    const filterKey = JSON.stringify(filter || {});
    if(safeRows === lastRowsRef && filterKey === lastFilterKey && lastResult) return lastResult;
    const next = applyUnifiedTripFilter(safeRows, filter);
    lastRowsRef = safeRows;
    lastFilterKey = filterKey;
    lastResult = next;
    return next;
  };
}
