export function createTripsUnifiedFilterBridge({
  ensureUnifiedFilters,
  applyUnifiedTripFilter,
  resolveUnifiedRange,
  getTripsNewestFirst,
  resolveAreaValue
} = {}){
  function ensureTripsFilter(state){
    // Trips now uses the unified filter object as its source of truth.
    ensureUnifiedFilters();
    state.tripsFilter = state.filters.active;

    // Guardrails for Trips-visible selectors and free-tier legacy state cleanup.
    if(state.tripsFilter.dealer == null) state.tripsFilter.dealer = "all";
    if(state.tripsFilter.area == null) state.tripsFilter.area = "all";

    const allowedRanges = new Set(["mtd", "ytd", "all", "custom"]);
    if(!allowedRanges.has(state.tripsFilter.range)) state.tripsFilter.range = "ytd";

    // Unsupported free-tier legacy fields should not silently filter Trips.
    state.tripsFilter.species = "all";
    state.tripsFilter.text = "";

    // Preserve legacy custom date path only when explicitly in custom range mode.
    if(state.tripsFilter.range !== "custom") {
      state.tripsFilter.fromISO = "";
      state.tripsFilter.toISO = "";
      state.tripsFilter.customRangeCorrectionMessages = [];
    }

    // Stable sort: only oldest is non-default.
    if(state.tripsFilter.sort !== "oldest") state.tripsFilter.sort = "newest";
  }

  function getTripsFilteredRows(state){
    ensureTripsFilter(state);
    const tf = state.tripsFilter;
    const tripsAll = Array.isArray(state.trips) ? state.trips : [];
    const filtered = applyUnifiedTripFilter(tripsAll, tf);

    const rangeMap = {
      "All Time": "All Time",
      "YTD": "YTD",
      "Previous Year": "Previous Year",
      "Last 12 months": "Last 12 Months",
      "Last 90 days": "Last 90 Days",
      "Last 30 days": "Last 30 Days",
      "Last 7 Days": "Last 7 Days",
      "This Month": "Current Month"
    };
    const r = {
      startISO: filtered.range.fromISO,
      endISO: filtered.range.toISO,
      label: (tf.range === "custom")
        ? `${filtered.range.fromISO} → ${filtered.range.toISO}`
        : (rangeMap[resolveUnifiedRange(tf).label] || "YTD")
    };

    let rows = filtered.rows;

    // Stable sort: newest first (shared with Home and other trip views)
    rows = getTripsNewestFirst(rows);
    if(tf.sort === "oldest") rows = rows.slice().reverse();

    return { rows, range:r, tf, transparency: filtered.transparency || { excludedQuarantinedCount: 0, quarantinedTotalCount: 0, hasExcludedQuarantined: false } };
  }

  function tripsActiveLabel(tf, rangeLabel){
    const parts = [];
    parts.push(rangeLabel || "YTD");
    if(tf?.dealer && tf.dealer !== "all") parts.push(`Dealer: ${tf.dealer}`);
    if(tf?.area && tf.area !== "all") parts.push(`Area: ${resolveAreaValue(tf.area).canonicalName || tf.area}`);
    return parts.join(" • ");
  }

  function resetTripsFilters(state){
    state.filters = state.filters || {};
    state.filters.active = { range:"ytd", fromISO:"", toISO:"", dealer:"all", area:"all", sort:"newest", species:"all", text:"", customRangeCorrectionMessages:[] };
    state.tripsFilter = state.filters.active;
  }

  return {
    ensureTripsFilter,
    getTripsFilteredRows,
    tripsActiveLabel,
    resetTripsFilters
  };
}
