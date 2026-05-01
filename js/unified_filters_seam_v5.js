export function createUnifiedFiltersSeam({
  getState,
  parseUsDateToISODate,
  parseReportDateToISO,
  isoToday,
  ensureAreas,
  resolveAreaValue,
  resolveTripArea,
  normalizeTripRow,
  canonicalizeTripArea,
  isValidISODate
} = {}){
  function formatCorrectionDateLabel(iso){
    const safeISO = String(iso || "").slice(0,10);
    if(!isValidISODate?.(safeISO)) return safeISO || "today";
    try{
      const dt = new Date(`${safeISO}T00:00:00Z`);
      return new Intl.DateTimeFormat("en-US", { month:"short", day:"numeric", year:"numeric", timeZone:"UTC" }).format(dt);
    }catch(_){
      return safeISO;
    }
  }

  function normalizeCustomRangeWithFeedback({ fromISO, toISO } = {}){
    const now = isoToday();
    const y = now.slice(0,4);
    const defaultFromISO = `${y}-01-01`;
    const rawFromISO = String(fromISO || "").slice(0,10);
    const rawToISO = String(toISO || "").slice(0,10);
    let normalizedFromISO = rawFromISO;
    let normalizedToISO = rawToISO;
    const messages = [];

    if(!isValidISODate?.(normalizedFromISO)){
      normalizedFromISO = defaultFromISO;
      messages.push(`Start date was missing, so this range begins on ${formatCorrectionDateLabel(normalizedFromISO)}.`);
    }
    if(!isValidISODate?.(normalizedToISO)){
      normalizedToISO = now;
      messages.push(`End date was missing, so this range ends on ${formatCorrectionDateLabel(normalizedToISO)}.`);
    }
    if(normalizedFromISO > normalizedToISO){
      const tmp = normalizedFromISO;
      normalizedFromISO = normalizedToISO;
      normalizedToISO = tmp;
      messages.push("From and To were reversed, so the dates were swapped.");
    }

    return {
      fromISO: normalizedFromISO,
      toISO: normalizedToISO,
      messages,
      didCorrect: messages.length > 0
    };
  }

  function ensureUnifiedFilters(){
    const state = getState?.() || {};

    if(!state.filters || typeof state.filters !== "object") state.filters = {};
    if(!state.filters.active || typeof state.filters.active !== "object"){
      const pick = state.reportsFilter || state.homeFilter || state.tripsFilter || (state.filter ? { mode: String(state.filter).toUpperCase(), from:"", to:"" } : { mode:"YTD", from:"", to:"" });
      const legacyMode = String(pick?.mode || "YTD").toUpperCase();

      let range = "ytd";
      let fromISO = "";
      let toISO = "";

      if(legacyMode === "ALL") range = "all";
      else if(legacyMode === "YTD" || legacyMode === "SEASON_PREVIEW") range = "ytd";
      else if(legacyMode === "MONTH" || legacyMode === "THIS_MONTH") range = "mtd";
      else if(legacyMode === "LAST_MONTH") range = "last_month";
      else if(legacyMode === "LAST_YEAR") range = "last_year";
      else if(legacyMode === "7D") range = "7d";
      else if(legacyMode === "30D") range = "30d";
      else if(legacyMode === "90D") range = "90d";
      else if(legacyMode === "12M") range = "12m";
      else if(legacyMode === "RANGE" || legacyMode === "CUSTOM") {
        range = "custom";
        fromISO = parseUsDateToISODate?.(String(pick?.from||"")) || "";
        toISO = parseUsDateToISODate?.(String(pick?.to||"")) || "";
      }

      state.filters.active = {
        range,
        fromISO,
        toISO,
        dealer: "all",
        area: "all",
        species: "all",
        text: "",
        customRangeCorrectionMessages: []
      };
    }

    const f = state.filters.active;

    if(!f.range) f.range = "ytd";
    if(f.dealer == null) f.dealer = "all";
    if(f.area == null) f.area = "all";
    if(f.species == null) f.species = "all";
    if(f.text == null) f.text = "";
    if(f.fromISO == null) f.fromISO = "";
    if(f.toISO == null) f.toISO = "";
    if(!Array.isArray(f.customRangeCorrectionMessages)) f.customRangeCorrectionMessages = [];

    if(f.range === "custom"){
      const normalized = normalizeCustomRangeWithFeedback({ fromISO: f.fromISO, toISO: f.toISO });
      f.fromISO = normalized.fromISO;
      f.toISO = normalized.toISO;
    }
  }

  function resolveUnifiedRange(filter = {}){
    const now = isoToday();
    const y = now.slice(0,4);

    const backDays = (n)=>{
      const d = new Date();
      d.setDate(d.getDate() - n);
      return d.toISOString().slice(0,10);
    };

    if(filter.range === "all") return { fromISO:"1900-01-01", toISO:now, label:"All Time" };
    if(filter.range === "ytd") return { fromISO:`${y}-01-01`, toISO:now, label:"YTD" };
    if(filter.range === "last_year") return { fromISO:`${Number(y)-1}-01-01`, toISO:`${Number(y)-1}-12-31`, label:"Previous Year" };
    if(filter.range === "mtd") return { fromISO:`${y}-${String(new Date().getMonth()+1).padStart(2,"0")}-01`, toISO:now, label:"This Month" };
    if(filter.range === "last_month"){
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth()-1);
      const fromISO = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`;
      const toISO = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(new Date(d.getFullYear(), d.getMonth()+1, 0).getDate()).padStart(2,"0")}`;
      return { fromISO, toISO, label:"Last Month" };
    }
    if(filter.range === "7d") return { fromISO:backDays(6), toISO:now, label:"Last 7 Days" };
    if(filter.range === "14d") return { fromISO:backDays(13), toISO:now, label:"Last 14 Days" };
    if(filter.range === "28d") return { fromISO:backDays(27), toISO:now, label:"Last 4 Weeks" };
    if(filter.range === "12m"){
      const d = new Date();
      d.setFullYear(d.getFullYear()-1);
      return { fromISO:d.toISOString().slice(0,10), toISO:now, label:"Last 12 months" };
    }
    if(filter.range === "90d") return { fromISO:backDays(89), toISO:now, label:"Last 90 days" };
    if(filter.range === "30d") return { fromISO:backDays(29), toISO:now, label:"Last 30 days" };

    const normalized = normalizeCustomRangeWithFeedback({ fromISO: filter.fromISO, toISO: filter.toISO });
    const fromISO = normalized.fromISO;
    const toISO = normalized.toISO;
    return { fromISO, toISO, label: `${fromISO} → ${toISO}` };
  }

  function buildUnifiedFilterLabel(filter, rangeLabel){
    const parts = [rangeLabel];
    if(filter.dealer && filter.dealer !== "all") parts.push(`Dealer: ${filter.dealer}`);
    if(filter.area && filter.area !== "all") parts.push(`Area: ${resolveAreaValue(filter.area).canonicalName || filter.area}`);
    if(filter.species && filter.species !== "all") parts.push(`Species: ${filter.species}`);
    if(filter.text && String(filter.text).trim()) parts.push(`Search: "${String(filter.text).trim()}"`);
    return parts.join(" • ");
  }

  function legacyModeToUnifiedRange(mode){
    const m = String(mode || "").toUpperCase();
    if(m === "ALL") return "all";
    if(m === "YTD" || m === "SEASON_PREVIEW") return "ytd";
    if(m === "MONTH" || m === "THIS_MONTH") return "mtd";
    if(m === "LAST_MONTH") return "last_month";
    if(m === "LAST_YEAR") return "last_year";
    if(m === "7D") return "7d";
    if(m === "14D") return "14d";
    if(m === "28D" || m === "4W") return "28d";
    if(m === "12M") return "12m";
    if(m === "90D") return "90d";
    if(m === "30D") return "30d";
    if(m === "RANGE" || m === "CUSTOM") return "custom";
    return "ytd";
  }

  function makeUnifiedFilter(partial){
    const f = {
      range: partial?.range || "ytd",
      fromISO: partial?.fromISO || "",
      toISO: partial?.toISO || "",
      dealer: partial?.dealer || "all",
      area: partial?.area || "all",
      species: partial?.species || "all",
      text: partial?.text || "",
      customRangeCorrectionMessages: Array.isArray(partial?.customRangeCorrectionMessages) ? partial.customRangeCorrectionMessages : []
    };
    const resolved = resolveUnifiedRange(f);
    return { ...f, fromISO: resolved.fromISO, toISO: resolved.toISO };
  }

  function buildUnifiedFilterFromHomeFilter(hf){
    return makeUnifiedFilter({
      range: legacyModeToUnifiedRange(hf?.mode || "YTD"),
      fromISO: parseReportDateToISO?.(hf?.from || "") || "",
      toISO: parseReportDateToISO?.(hf?.to || "") || "",
      dealer: "all",
      area: "all",
      customRangeCorrectionMessages: Array.isArray(hf?.customRangeCorrectionMessages) ? hf.customRangeCorrectionMessages : []
    });
  }

  function buildUnifiedFilterFromReportsFilter(rf){
    const rawArea = rf?.area ? String(rf.area) : "all";
    return makeUnifiedFilter({
      range: legacyModeToUnifiedRange(rf?.mode || "YTD"),
      fromISO: parseReportDateToISO?.(rf?.from || "") || "",
      toISO: parseReportDateToISO?.(rf?.to || "") || "",
      dealer: rf?.dealer ? String(rf.dealer) : "all",
      area: rawArea,
      customRangeCorrectionMessages: Array.isArray(rf?.customRangeCorrectionMessages) ? rf.customRangeCorrectionMessages : []
    });
  }

  function applyUnifiedTripFilter(rawTrips, filter = {}){
    ensureAreas();
    const trips = (rawTrips || []).map((trip)=> canonicalizeTripArea(normalizeTripRow(trip))).filter(Boolean);
    const r = resolveUnifiedRange(filter);
    const areaFilterId = filter.area && filter.area !== "all"
      ? String(filter.area)
      : "all";
    const textQuery = filter.text && String(filter.text).trim()
      ? String(filter.text).trim().toLowerCase()
      : "";
    const matchesNonDateCriteria = (trip)=>{
      if(filter.dealer && filter.dealer !== "all" && trip.dealer !== filter.dealer) return false;
      if(areaFilterId && areaFilterId !== "all"){
        const resolved = resolveTripArea(trip);
        if(resolved.canonicalName !== areaFilterId) return false;
      }
      if(filter.species && filter.species !== "all" && trip.species !== filter.species) return false;
      if(textQuery){
        const resolvedArea = resolveTripArea(trip);
        const hasTextMatch = (trip.dealer||"").toLowerCase().includes(textQuery) ||
          (resolvedArea.canonicalName||trip.area||"").toLowerCase().includes(textQuery) ||
          (trip.species||"").toLowerCase().includes(textQuery) ||
          (trip.notes||"").toLowerCase().includes(textQuery);
        if(!hasTextMatch) return false;
      }
      return true;
    };

    const quarantinedTotalCount = trips.filter((t)=> Boolean(t?.invalidDateQuarantined) || !isValidISODate(t?.dateISO)).length;
    const excludedQuarantinedCount = trips.filter((t)=> !isValidISODate(t?.dateISO) && matchesNonDateCriteria(t)).length;
    const rows = trips.filter((t)=> isValidISODate(t.dateISO) && t.dateISO >= r.fromISO && t.dateISO <= r.toISO && matchesNonDateCriteria(t));

    const totalLbs = rows.reduce((a,t)=> a + (Number(t.pounds)||0), 0);
    const totalAmount = rows.reduce((a,t)=> a + (Number(t.amount)||0), 0);

    return {
      rows,
      stats: {
        count: rows.length,
        totalLbs,
        totalAmount,
        avgPPL: (totalLbs > 0 ? (totalAmount/totalLbs) : 0)
      },
      range: { fromISO:r.fromISO, toISO:r.toISO },
      label: buildUnifiedFilterLabel(filter, r.label),
      transparency: {
        excludedQuarantinedCount,
        quarantinedTotalCount,
        hasExcludedQuarantined: excludedQuarantinedCount > 0
      }
    };
  }

  function getFilteredTrips(){
    ensureUnifiedFilters();
    const state = getState?.() || {};
    const tripsAll = Array.isArray(state.trips) ? state.trips : [];
    return applyUnifiedTripFilter(tripsAll, state.filters.active);
  }

  return {
    ensureUnifiedFilters,
    resolveUnifiedRange,
    buildUnifiedFilterLabel,
    legacyModeToUnifiedRange,
    makeUnifiedFilter,
    buildUnifiedFilterFromHomeFilter,
    buildUnifiedFilterFromReportsFilter,
    applyUnifiedTripFilter,
    getFilteredTrips,
    normalizeCustomRangeWithFeedback
  };
}
