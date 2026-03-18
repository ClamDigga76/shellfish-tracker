export function buildReportsCompareFoundation({ trips, monthRows, dealerRows, areaRows, rangeContext } = {}){
  const safeTrips = Array.isArray(trips) ? trips : [];
  const safeMonths = Array.isArray(monthRows) ? monthRows : [];
  const safeRange = normalizeRangeContext(rangeContext, safeTrips);
  const selection = selectComparePeriods({
    trips: safeTrips,
    monthRows: safeMonths,
    rangeContext: safeRange,
    nowISO: isoToday()
  });

  if(!selection.current || !selection.previous){
    const period = buildMissingPeriod(selection.reason);
    return {
      period,
      metrics: {},
      dealer: { suppressed: true, reason: period.reason },
      area: { suppressed: true, reason: period.reason }
    };
  }

  const current = summarizeWindow(safeTrips, selection.current);
  const previous = summarizeWindow(safeTrips, selection.previous);
  const periodComparable = current.trips >= 2 && previous.trips >= 2 && current.uniqueDays >= 2 && previous.uniqueDays >= 2;
  const period = {
    comparable: periodComparable,
    suppressed: !periodComparable,
    confidence: periodComparable ? "medium" : "low",
    reason: periodComparable ? "" : "Comparison suppressed: low-data baseline in comparable periods.",
    compareType: selection.compareType,
    currentLabel: selection.current.label,
    previousLabel: selection.previous.label,
    fairWindowLabel: selection.fairWindowLabel,
    current,
    previous
  };

  const metrics = {
    amount: buildMetricComparePayload({
      metricKey: "amount",
      label: "Amount",
      currentValue: current.amount,
      previousValue: previous.amount,
      periodComparable,
      minBaseline: 25,
      epsilonPct: 0.05,
      minTrips: 2,
      minUniqueDays: 2
    }),
    pounds: buildMetricComparePayload({
      metricKey: "pounds",
      label: "Pounds",
      currentValue: current.lbs,
      previousValue: previous.lbs,
      periodComparable,
      minBaseline: 10,
      epsilonPct: 0.05,
      minTrips: 2,
      minUniqueDays: 2
    }),
    ppl: buildMetricComparePayload({
      metricKey: "ppl",
      label: "Avg $/lb",
      currentValue: current.ppl,
      previousValue: previous.ppl,
      periodComparable: periodComparable && current.lbs >= 10 && previous.lbs >= 10,
      minBaseline: 0.1,
      epsilonPct: 0.035,
      minTrips: 2,
      minUniqueDays: 2
    }),
    trips: buildMetricComparePayload({
      metricKey: "trips",
      label: "Trips",
      currentValue: current.trips,
      previousValue: previous.trips,
      periodComparable,
      minBaseline: 1,
      epsilonPct: 0,
      minTrips: 2,
      minUniqueDays: 2
    })
  };

  const dealer = buildEntityComparePayload({
    entityRows: dealerRows,
    safeTrips,
    entityType: "dealer",
    period,
    minEntityTrips: 2
  });

  const area = buildEntityComparePayload({
    entityRows: areaRows,
    safeTrips,
    entityType: "area",
    period,
    minEntityTrips: 2
  });

  return { period, metrics, dealer, area };
}

function buildMissingPeriod(reason){
  return {
    comparable: false,
    suppressed: true,
    reason: reason || "Need at least two comparable periods.",
    confidence: "none"
  };
}

function normalizeRangeContext(rangeContext, trips){
  const safeTrips = Array.isArray(trips) ? trips : [];
  const valid = rangeContext && typeof rangeContext === "object" ? rangeContext : {};
  const fromISO = normalizeISO(valid.fromISO || valid.startISO || "");
  const toISO = normalizeISO(valid.toISO || valid.endISO || "");
  const label = String(valid.label || "").trim();
  if(fromISO && toISO){
    return fromISO <= toISO ? { fromISO, toISO, label } : { fromISO: toISO, toISO: fromISO, label };
  }

  const datedTrips = safeTrips
    .map((t)=> normalizeISO(t?.dateISO || ""))
    .filter(Boolean)
    .sort();
  if(!datedTrips.length) return { fromISO: "", toISO: "", label };
  return {
    fromISO: datedTrips[0],
    toISO: datedTrips[datedTrips.length - 1],
    label
  };
}

function selectComparePeriods({ trips, monthRows, rangeContext, nowISO }){
  const safeMonths = Array.isArray(monthRows) ? monthRows : [];
  const safeRange = rangeContext && typeof rangeContext === "object" ? rangeContext : { fromISO: "", toISO: "", label: "" };
  const rangeDays = safeRange.fromISO && safeRange.toISO ? inclusiveDaysBetween(safeRange.fromISO, safeRange.toISO) : 0;
  const currentMonthKey = String(nowISO || "").slice(0, 7);
  const lastFullMonthKey = shiftMonthKey(currentMonthKey, -1);
  const candidates = [];

  if(isYtdRange(safeRange, nowISO)){
    candidates.push(buildYtdCandidate(safeRange));
  }
  if(isRolling30Range(safeRange, nowISO)){
    candidates.push(buildRolling30Candidate(safeRange));
  }
  if(isMonthToDateRange(safeRange, nowISO)){
    candidates.push(buildMonthToDateCandidate(safeRange));
  }
  if(isFullMonthRange(safeRange) && sameMonthKey(safeRange.fromISO, lastFullMonthKey)){
    candidates.push(buildFullMonthCandidate(safeRange));
  }
  if(isSelectedEquivalentRange(safeRange, rangeDays)){
    candidates.push(buildEquivalentRangeCandidate(safeRange));
  }
  if(safeMonths.length >= 2){
    candidates.push(buildLatestDataMonthCandidate(safeMonths, safeRange));
  }

  const seen = new Set();
  for(const candidate of candidates){
    if(!candidate || !candidate.current || !candidate.previous) continue;
    const dedupeKey = [candidate.compareType, candidate.current.startISO, candidate.current.endISO, candidate.previous.startISO, candidate.previous.endISO].join("|");
    if(seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    if(!windowExists(candidate.current) || !windowExists(candidate.previous)) continue;
    return candidate;
  }

  return {
    compareType: "suppressed",
    fairWindowLabel: "Comparable window",
    current: null,
    previous: null,
    reason: safeMonths.length < 2
      ? "Need at least two months for comparison."
      : "Comparison suppressed: no fair prior comparison window matched this range."
  };
}

function buildYtdCandidate(range){
  const prevYear = shiftYear(range.fromISO, -1);
  return {
    compareType: "ytd_vs_prior_ytd",
    fairWindowLabel: `YTD through ${monthDayLabel(range.toISO)}`,
    current: makeWindow({
      label: range.label || `YTD ${String(range.toISO || "").slice(0, 4)}`,
      startISO: range.fromISO,
      endISO: range.toISO,
      mode: "range"
    }),
    previous: makeWindow({
      label: `Prior YTD through ${monthDayLabel(shiftYear(range.toISO, -1))}`,
      startISO: prevYear,
      endISO: shiftYear(range.toISO, -1),
      mode: "range"
    })
  };
}

function buildRolling30Candidate(range){
  const previousEnd = addDays(range.fromISO, -1);
  return {
    compareType: "rolling_30_vs_prior_30",
    fairWindowLabel: "30-day windows",
    current: makeWindow({
      label: range.label || "Last 30 Days",
      startISO: range.fromISO,
      endISO: range.toISO,
      mode: "range"
    }),
    previous: makeWindow({
      label: "Prior 30 Days",
      startISO: addDays(previousEnd, -29),
      endISO: previousEnd,
      mode: "range"
    })
  };
}

function buildMonthToDateCandidate(range){
  const dayOfMonth = Number(String(range.toISO).slice(8, 10)) || 1;
  const previousMonthKey = shiftMonthKey(String(range.fromISO).slice(0, 7), -1);
  const previousEnd = clampMonthDay(previousMonthKey, dayOfMonth);
  return {
    compareType: "month_to_date_vs_prior_same_day",
    fairWindowLabel: `Days 1-${dayOfMonth} in each month`,
    current: makeWindow({
      label: range.label || monthLabelFromISO(range.fromISO),
      startISO: range.fromISO,
      endISO: range.toISO,
      mode: "month_to_date"
    }),
    previous: makeWindow({
      label: `${monthLabelFromKey(previousMonthKey)} days 1-${dayOfMonth}`,
      startISO: `${previousMonthKey}-01`,
      endISO: previousEnd,
      mode: "month_to_date"
    })
  };
}

function buildFullMonthCandidate(range){
  const previousMonthKey = shiftMonthKey(String(range.fromISO).slice(0, 7), -1);
  return {
    compareType: "latest_full_month_vs_previous_full_month",
    fairWindowLabel: "Full month totals",
    current: makeWindow({
      label: range.label || monthLabelFromISO(range.fromISO),
      startISO: range.fromISO,
      endISO: range.toISO,
      mode: "full_month"
    }),
    previous: makeWindow({
      label: monthLabelFromKey(previousMonthKey),
      startISO: `${previousMonthKey}-01`,
      endISO: endOfMonth(previousMonthKey),
      mode: "full_month"
    })
  };
}

function buildLatestDataMonthCandidate(monthRows, range){
  const safeMonths = Array.isArray(monthRows) ? monthRows : [];
  const currentMonthKey = String(isoToday()).slice(0, 7);
  let monthIndex = safeMonths.length - 1;
  while(monthIndex >= 0 && String(safeMonths[monthIndex]?.monthKey || '') === currentMonthKey){
    monthIndex -= 1;
  }
  if(monthIndex < 1){
    monthIndex = safeMonths.length - 1;
  }
  const latestMonth = safeMonths[monthIndex] || null;
  const priorMonth = monthIndex > 0 ? safeMonths[monthIndex - 1] : null;
  if(!latestMonth || !priorMonth) return null;
  const latestKey = String(latestMonth.monthKey || "");
  const priorKey = String(priorMonth.monthKey || "");
  const isCurrentPartial = latestKey === currentMonthKey && String(range?.toISO || '').slice(0, 7) === currentMonthKey;
  if(isCurrentPartial){
    const dayLimit = Number(String(range?.toISO || '').slice(8, 10)) || daysInMonth(currentMonthKey);
    return {
      compareType: isPriorMonth(latestKey, priorKey)
        ? "adjacent_months"
        : "latest_data_month_vs_prior_data_month",
      fairWindowLabel: `Days 1-${dayLimit} in each month`,
      current: makeWindow({
        label: `${latestMonth.label} days 1-${dayLimit}`,
        startISO: `${latestKey}-01`,
        endISO: clampMonthDay(latestKey, dayLimit),
        mode: "month_to_date"
      }),
      previous: makeWindow({
        label: `${priorMonth.label} days 1-${dayLimit}`,
        startISO: `${priorKey}-01`,
        endISO: clampMonthDay(priorKey, dayLimit),
        mode: "month_to_date"
      })
    };
  }
  return {
    compareType: isPriorMonth(latestKey, priorKey)
      ? "adjacent_months"
      : "latest_data_month_vs_prior_data_month",
    fairWindowLabel: "Full month totals",
    current: makeWindow({
      label: latestMonth.label,
      startISO: `${latestKey}-01`,
      endISO: endOfMonth(latestKey),
      mode: "full_month"
    }),
    previous: makeWindow({
      label: priorMonth.label,
      startISO: `${priorKey}-01`,
      endISO: endOfMonth(priorKey),
      mode: "full_month"
    })
  };
}

function buildEquivalentRangeCandidate(range){
  const dayCount = inclusiveDaysBetween(range.fromISO, range.toISO);
  const previousEnd = addDays(range.fromISO, -1);
  return {
    compareType: "selected_range_vs_previous_equivalent",
    fairWindowLabel: `${dayCount}-day equivalent windows`,
    current: makeWindow({
      label: range.label || `${range.fromISO} → ${range.toISO}`,
      startISO: range.fromISO,
      endISO: range.toISO,
      mode: "range"
    }),
    previous: makeWindow({
      label: `Previous ${dayCount}-day window`,
      startISO: addDays(previousEnd, -(dayCount - 1)),
      endISO: previousEnd,
      mode: "range"
    })
  };
}

function buildMetricComparePayload({ metricKey, label, currentValue, previousValue, periodComparable, minBaseline, epsilonPct, minTrips, minUniqueDays }){
  const cur = safeNum(currentValue);
  const prev = safeNum(previousValue);
  const delta = cur - prev;
  const hasBaseline = prev >= minBaseline;
  const canCompare = periodComparable && hasBaseline;
  const deltaPct = prev > 0 ? (delta / prev) : null;
  const lowDataReason = !periodComparable
    ? `Suppressed: need at least ${minTrips} trips and ${minUniqueDays} fishing days in each period.`
    : (!hasBaseline ? "Suppressed: baseline too weak for a fair percent comparison." : "");

  return {
    metricKey,
    label,
    currentValue: cur,
    previousValue: prev,
    deltaValue: delta,
    deltaPct,
    compareTone: canCompare ? toneFromDelta(deltaPct, epsilonPct) : "steady",
    suppressed: !canCompare,
    reason: canCompare ? "" : lowDataReason,
    confidence: canCompare ? "medium" : "low",
    percentValid: canCompare && deltaPct != null
  };
}

function buildEntityComparePayload({ entityRows, safeTrips, entityType, period, minEntityTrips }){
  const leader = (Array.isArray(entityRows) ? entityRows[0] : null) || null;
  if(!period.comparable || !leader){
    return {
      suppressed: true,
      reason: period.reason || `No ${entityType} data for comparable periods.`,
      confidence: "low"
    };
  }

  const keyName = entityType === "dealer" ? "dealer" : "area";
  const leaderName = String(leader.name || "").trim().toLowerCase();
  const cur = summarizeEntityWindow(safeTrips, keyName, leaderName, period.current);
  const prev = summarizeEntityWindow(safeTrips, keyName, leaderName, period.previous);

  if(cur.trips < minEntityTrips || prev.trips < minEntityTrips || prev.amount < 25){
    return {
      suppressed: true,
      reason: `${capitalize(entityType)} compare suppressed: baseline too sparse for ${leader.name}.`,
      confidence: "low",
      entityName: leader.name
    };
  }

  const metric = buildMetricComparePayload({
    metricKey: `${entityType}-amount`,
    label: `${capitalize(entityType)} amount`,
    currentValue: cur.amount,
    previousValue: prev.amount,
    periodComparable: true,
    minBaseline: 25,
    epsilonPct: 0.06,
    minTrips: minEntityTrips,
    minUniqueDays: 1
  });

  return {
    ...metric,
    suppressed: false,
    reason: "",
    entityName: leader.name,
    currentTrips: cur.trips,
    previousTrips: prev.trips,
    confidence: "medium"
  };
}

function summarizeEntityWindow(trips, keyName, entityName, periodStats){
  let amount = 0;
  let tripsCount = 0;
  (Array.isArray(trips) ? trips : []).forEach((t)=>{
    const iso = normalizeISO(t?.dateISO || "");
    if(!iso || !isISOWithinWindow(iso, periodStats)) return;
    const name = String(t?.[keyName] || "").trim().toLowerCase();
    if(name !== entityName) return;
    amount += safeNum(t?.amount);
    tripsCount += 1;
  });
  return { amount, trips: tripsCount };
}

function summarizeWindow(trips, window){
  let amount = 0;
  let lbs = 0;
  let tripsCount = 0;
  const days = new Set();

  (Array.isArray(trips) ? trips : []).forEach((t)=>{
    const iso = normalizeISO(t?.dateISO || "");
    if(!iso || !isISOWithinWindow(iso, window)) return;
    amount += safeNum(t?.amount);
    lbs += safeNum(t?.pounds);
    tripsCount += 1;
    days.add(iso);
  });

  return {
    monthKey: window.startISO.slice(0, 7) === window.endISO.slice(0, 7) ? window.startISO.slice(0, 7) : "",
    dayLimit: window.startISO.slice(0, 7) === window.endISO.slice(0, 7) ? Number(window.endISO.slice(8, 10)) || 0 : 0,
    startISO: window.startISO,
    endISO: window.endISO,
    label: window.label,
    mode: window.mode,
    amount,
    lbs,
    trips: tripsCount,
    uniqueDays: days.size,
    ppl: lbs > 0 ? amount / lbs : 0
  };
}

function makeWindow({ label, startISO, endISO, mode }){
  return {
    label,
    startISO,
    endISO,
    mode: mode || "range"
  };
}

function windowExists(window){
  return !!(window && normalizeISO(window.startISO) && normalizeISO(window.endISO) && window.startISO <= window.endISO);
}

function isISOWithinWindow(iso, window){
  return !!window && iso >= window.startISO && iso <= window.endISO;
}

function isYtdRange(range, nowISO){
  return !!range?.fromISO && !!range?.toISO
    && String(range.fromISO).slice(5) === "01-01"
    && String(range.toISO).slice(0, 4) === String(range.fromISO).slice(0, 4)
    && String(range.toISO).slice(0, 10) === String(nowISO).slice(0, 10);
}

function isRolling30Range(range, nowISO){
  const label = String(range?.label || "").toLowerCase();
  const days = inclusiveDaysBetween(range?.fromISO, range?.toISO);
  return !!range?.fromISO && !!range?.toISO
    && days === 30
    && (label.includes("30") || range.toISO === nowISO);
}

function isMonthToDateRange(range, nowISO){
  return !!range?.fromISO && !!range?.toISO
    && range.fromISO.slice(8, 10) === "01"
    && range.fromISO.slice(0, 7) === String(nowISO).slice(0, 7)
    && range.toISO === nowISO
    && !isFullMonthRange(range);
}

function isSelectedEquivalentRange(range, rangeDays){
  if(!(range?.fromISO && range?.toISO) || rangeDays < 7 || rangeDays > 120) return false;
  const label = String(range?.label || '').toLowerCase();
  const standardLabels = [
    'all time',
    'ytd',
    'this month',
    'last month',
    'last 7 days',
    'last 30 days',
    'last 90 days',
    'last 12 months'
  ];
  if(standardLabels.includes(label)) return false;
  if(label && label.includes('→')) return true;
  return !isFullMonthRange(range) && !label.includes('month');
}

function isFullMonthRange(range){
  return !!range?.fromISO && !!range?.toISO
    && range.fromISO.slice(8, 10) === "01"
    && range.fromISO.slice(0, 7) === range.toISO.slice(0, 7)
    && range.toISO === endOfMonth(range.fromISO.slice(0, 7));
}

function sameMonthKey(iso, monthKey){
  return String(iso || "").slice(0, 7) === String(monthKey || "");
}

function monthLabelFromISO(iso){
  return monthLabelFromKey(String(iso || "").slice(0, 7));
}

function monthLabelFromKey(monthKey){
  const [year, month] = String(monthKey || "").split("-").map(Number);
  if(!year || !month) return "Month";
  const dt = new Date(year, month - 1, 1);
  return `${dt.toLocaleString(undefined, { month: "short" })} ${year}`;
}

function monthDayLabel(iso){
  const normalized = normalizeISO(iso);
  if(!normalized) return "this date";
  const [year, month, day] = normalized.split("-").map(Number);
  const dt = new Date(year, month - 1, day);
  return dt.toLocaleString(undefined, { month: "short", day: "numeric" });
}

function endOfMonth(monthKey){
  const [year, month] = String(monthKey || "").split("-").map(Number);
  if(!year || !month) return "";
  return `${year}-${String(month).padStart(2, "0")}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`;
}

function clampMonthDay(monthKey, day){
  const safeDay = Math.max(1, Math.min(Number(day) || 1, daysInMonth(monthKey)));
  return `${monthKey}-${String(safeDay).padStart(2, "0")}`;
}

function shiftMonthKey(monthKey, delta){
  const [year, month] = String(monthKey || "").split("-").map(Number);
  if(!year || !month) return "";
  const dt = new Date(year, month - 1 + (Number(delta) || 0), 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}

function shiftYear(iso, delta){
  const normalized = normalizeISO(iso);
  if(!normalized) return "";
  const [year, month, day] = normalized.split("-").map(Number);
  const safeYear = year + (Number(delta) || 0);
  const safeDay = Math.min(day, new Date(safeYear, month, 0).getDate());
  return `${safeYear}-${String(month).padStart(2, "0")}-${String(safeDay).padStart(2, "0")}`;
}

function addDays(iso, delta){
  const dt = parseISODate(iso);
  if(!dt) return "";
  dt.setUTCDate(dt.getUTCDate() + (Number(delta) || 0));
  return dt.toISOString().slice(0, 10);
}

function inclusiveDaysBetween(startISO, endISO){
  const start = parseISODate(startISO);
  const end = parseISODate(endISO);
  if(!start || !end || start > end) return 0;
  return Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
}

function parseISODate(iso){
  const normalized = normalizeISO(iso);
  if(!normalized) return null;
  const dt = new Date(`${normalized}T00:00:00Z`);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function normalizeISO(value){
  const iso = String(value || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : "";
}

function isoToday(){
  return new Date().toISOString().slice(0, 10);
}

function isPriorMonth(latest, prior){
  const [yA, mA] = String(latest || "").split("-").map(Number);
  const [yB, mB] = String(prior || "").split("-").map(Number);
  if(!yA || !mA || !yB || !mB) return false;
  const dateA = new Date(yA, mA - 1, 1);
  const dateB = new Date(yB, mB - 1, 1);
  const expectedPrior = new Date(dateA.getFullYear(), dateA.getMonth() - 1, 1);
  return dateB.getFullYear() === expectedPrior.getFullYear() && dateB.getMonth() === expectedPrior.getMonth();
}

function toneFromDelta(deltaPct, epsilonPct){
  const v = safeNum(deltaPct);
  if(Math.abs(v) <= epsilonPct) return "steady";
  return v > 0 ? "up" : "down";
}

function daysInMonth(monthKey){
  const [year, month] = String(monthKey || "").split("-").map(Number);
  if(!year || !month) return 31;
  return new Date(year, month, 0).getDate();
}

function safeNum(v){
  return Number(v) || 0;
}

function capitalize(s){
  const txt = String(s || "");
  return txt ? `${txt[0].toUpperCase()}${txt.slice(1)}` : "";
}
