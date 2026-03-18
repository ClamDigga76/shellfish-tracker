export function buildReportsCompareFoundation({ trips, monthRows, dealerRows, areaRows }){
  const safeTrips = Array.isArray(trips) ? trips : [];
  const safeMonths = Array.isArray(monthRows) ? monthRows : [];
  const latestMonth = safeMonths[safeMonths.length - 1] || null;
  const priorMonth = safeMonths[safeMonths.length - 2] || null;

  const missingPeriod = {
    comparable: false,
    suppressed: true,
    reason: "Need at least two months for comparison.",
    confidence: "none"
  };

  if(!latestMonth || !priorMonth){
    return {
      period: missingPeriod,
      metrics: {},
      dealer: { suppressed: true, reason: missingPeriod.reason },
      area: { suppressed: true, reason: missingPeriod.reason }
    };
  }

  const latestKey = String(latestMonth.monthKey || "");
  const priorKey = String(priorMonth.monthKey || "");
  const monthAdjacent = isPriorMonth(latestKey, priorKey);
  if(!monthAdjacent){
    const reason = "Comparison suppressed: missing adjacent prior month.";
    return {
      period: {
        comparable: false,
        suppressed: true,
        reason,
        confidence: "none",
        currentLabel: latestMonth.label,
        previousLabel: priorMonth.label
      },
      metrics: {},
      dealer: { suppressed: true, reason },
      area: { suppressed: true, reason }
    };
  }

  const periodRules = getPeriodRules(latestKey, safeTrips);
  const current = summarizePeriod(safeTrips, latestKey, periodRules.dayLimit);
  const previous = summarizePeriod(safeTrips, priorKey, periodRules.dayLimit);

  const periodComparable = current.trips >= 2 && previous.trips >= 2 && current.uniqueDays >= 2 && previous.uniqueDays >= 2;
  const period = {
    comparable: periodComparable,
    suppressed: !periodComparable,
    confidence: periodComparable ? "medium" : "low",
    reason: periodComparable ? "" : "Comparison suppressed: low-data baseline in comparable periods.",
    currentLabel: latestMonth.label,
    previousLabel: priorMonth.label,
    fairWindowLabel: periodRules.dayLimit < periodRules.daysInCurrent
      ? `Days 1-${periodRules.dayLimit} in each month`
      : "Full month totals",
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
    metricKey: "amount",
    period,
    minEntityTrips: 2
  });

  const area = buildEntityComparePayload({
    entityRows: areaRows,
    safeTrips,
    entityType: "area",
    metricKey: "amount",
    period,
    minEntityTrips: 2
  });

  return { period, metrics, dealer, area };
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
  const cur = summarizeEntityPeriod(safeTrips, keyName, leaderName, period.current, period.currentLabel);
  const prev = summarizeEntityPeriod(safeTrips, keyName, leaderName, period.previous, period.previousLabel);

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

function summarizeEntityPeriod(trips, keyName, entityName, periodStats){
  let amount = 0;
  let tripsCount = 0;
  const dayLimit = periodStats.dayLimit;
  const monthKey = periodStats.monthKey;
  (Array.isArray(trips) ? trips : []).forEach((t)=>{
    const iso = String(t?.dateISO || "");
    if(!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return;
    if(iso.slice(0, 7) !== monthKey) return;
    if(dayLimit && Number(iso.slice(8, 10)) > dayLimit) return;
    const name = String(t?.[keyName] || "").trim().toLowerCase();
    if(name !== entityName) return;
    amount += safeNum(t?.amount);
    tripsCount += 1;
  });
  return { amount, trips: tripsCount };
}

function summarizePeriod(trips, monthKey, dayLimit){
  let amount = 0;
  let lbs = 0;
  let tripsCount = 0;
  const days = new Set();

  (Array.isArray(trips) ? trips : []).forEach((t)=>{
    const iso = String(t?.dateISO || "");
    if(!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return;
    if(iso.slice(0, 7) !== monthKey) return;
    const day = Number(iso.slice(8, 10));
    if(dayLimit && day > dayLimit) return;
    amount += safeNum(t?.amount);
    lbs += safeNum(t?.pounds);
    tripsCount += 1;
    days.add(iso);
  });

  return {
    monthKey,
    dayLimit,
    amount,
    lbs,
    trips: tripsCount,
    uniqueDays: days.size,
    ppl: lbs > 0 ? amount / lbs : 0
  };
}

function getPeriodRules(latestKey, trips){
  const now = new Date();
  const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const daysInCurrent = daysInMonth(latestKey);
  if(latestKey !== currentKey){
    return { dayLimit: daysInCurrent, daysInCurrent };
  }

  let maxTripDay = 0;
  (Array.isArray(trips) ? trips : []).forEach((t)=>{
    const iso = String(t?.dateISO || "");
    if(!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return;
    if(iso.slice(0, 7) !== latestKey) return;
    const day = Number(iso.slice(8, 10)) || 0;
    if(day > maxTripDay) maxTripDay = day;
  });
  const safeDayLimit = Math.max(1, Math.min(maxTripDay || now.getDate(), daysInCurrent));
  return { dayLimit: safeDayLimit, daysInCurrent };
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
