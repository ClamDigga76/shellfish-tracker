import { computeAggregatePPL, resolveTripPayRate } from "./utils_v5.js";

export function buildReportsAggregationState({ trips, canonicalDealerGroupKey, normalizeDealerDisplay, resolveTripArea }){
  const safeTrips = Array.isArray(trips) ? trips : [];

  const byDealer = new Map();
  const byArea = new Map();
  const byMonth = new Map();
  const byWeek = new Map();
  const bySeason = new Map();
  const allTimePrice = createPriceRangeBucket();

  safeTrips.forEach((t)=>{
    const dealerRaw = (t?.dealer || "").toString();
    const dealerName = normalizeDealerDisplay(dealerRaw) || "(Unspecified)";
    const dealerKey = canonicalDealerGroupKey(dealerRaw) || "(unspecified)";
    const areaResolved = typeof resolveTripArea === "function" ? resolveTripArea(t) : null;
    const area = (areaResolved?.canonicalName || (t?.area || "").toString().trim()) || "(Unspecified)";
    const areaKey = area.toLowerCase();

    const lbs = Number(t?.pounds) || 0;
    const amt = Number(t?.amount) || 0;
    const rate = resolveTripPayRate(t);
    const iso = String(t?.dateISO || "");

    const dealerAgg = byDealer.get(dealerKey) || { name: dealerName, trips: 0, lbs: 0, amt: 0, _days: new Set() };
    dealerAgg.trips += 1;
    dealerAgg.lbs += lbs;
    dealerAgg.amt += amt;
    if(/^\d{4}-\d{2}-\d{2}$/.test(iso)) dealerAgg._days.add(iso);
    byDealer.set(dealerKey, dealerAgg);

    const areaAgg = byArea.get(areaKey) || { name: area, trips: 0, lbs: 0, amt: 0, _days: new Set() };
    areaAgg.trips += 1;
    areaAgg.lbs += lbs;
    areaAgg.amt += amt;
    if(/^\d{4}-\d{2}-\d{2}$/.test(iso)) areaAgg._days.add(iso);
    byArea.set(areaKey, areaAgg);

    if(/^\d{4}-\d{2}-\d{2}$/.test(iso)){
      const monthKey = iso.slice(0, 7);
      const monthAgg = byMonth.get(monthKey) || { trips: 0, lbs: 0, amt: 0, _days: new Set() };
      monthAgg.trips += 1;
      monthAgg.lbs += lbs;
      monthAgg.amt += amt;
      monthAgg._days.add(iso);
      byMonth.set(monthKey, monthAgg);

      const weekKey = resolveIsoWeekKey(iso);
      if(weekKey){
        const weekAgg = byWeek.get(weekKey) || { weekKey, trips: 0, _days: new Set(), ...createPriceRangeBucket() };
        weekAgg.trips += 1;
        weekAgg._days.add(iso);
        capturePriceRate(weekAgg, rate);
        byWeek.set(weekKey, weekAgg);
      }

      const seasonKey = resolveSeasonKey(iso);
      if(seasonKey){
        const seasonAgg = bySeason.get(seasonKey) || { seasonKey, ...createPriceRangeBucket() };
        capturePriceRate(seasonAgg, rate);
        bySeason.set(seasonKey, seasonAgg);
      }
    }

    capturePriceRate(allTimePrice, rate);
    capturePriceRate(dealerAgg, rate);
    capturePriceRate(areaAgg, rate);
  });

  const dealerRows = Array.from(byDealer.values())
    .map((x)=> finalizeAggregateRow(x))
    .sort((a,b)=> b.amt - a.amt);

  const areaRows = Array.from(byArea.values())
    .map((x)=> finalizeAggregateRow(x))
    .sort((a,b)=> b.amt - a.amt);

  const today = new Date();
  const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const currentDay = today.getDate();
  const monthRows = normalizeChronologicalRows(Array.from(byMonth.entries())
    .sort((a,b)=> a[0].localeCompare(b[0]))
    .map(([monthKey, x])=>{
      const year = Number(monthKey.slice(0, 4));
      const month = Number(monthKey.slice(5, 7));
      const dt = new Date(year, month - 1, 1);
      const daysInMonth = new Date(year, month, 0).getDate();
      const isCurrentMonth = monthKey === currentMonthKey;
      const daysElapsed = isCurrentMonth ? Math.min(daysInMonth, currentDay) : daysInMonth;
      const isPartialMonth = isCurrentMonth && daysElapsed < daysInMonth;
      const shortLabel = `${dt.toLocaleString(undefined, { month: "short" })} '${String(year).slice(-2)}`;
      return {
        monthKey,
        month,
        year,
        label: isPartialMonth ? `${dt.toLocaleString(undefined, { month: "short" })} so far` : `${dt.toLocaleString(undefined, { month: "short" })} ${year}`,
        displayLabel: isPartialMonth ? `${dt.toLocaleString(undefined, { month: "short" })} so far` : `${dt.toLocaleString(undefined, { month: "short" })} ${year}`,
        shortLabel: isPartialMonth ? `${dt.toLocaleString(undefined, { month: "short" })} so far` : shortLabel,
        isCurrentMonth,
        isPartialMonth,
        daysElapsed,
        daysInMonth,
        trustLabel: isPartialMonth ? "partial-month-so-far" : "completed-month",
        ...finalizeAggregateRow(x)
      };
    }));
  const weeklyRangeRows = Array.from(byWeek.values())
    .map((row)=> finalizePriceRangeRow(row))
    .filter((row)=> row.sampleCount > 0)
    .sort((a,b)=> String(a.weekKey || "").localeCompare(String(b.weekKey || "")));
  const seasonalRangeRows = Array.from(bySeason.values())
    .map((row)=> finalizePriceRangeRow(row))
    .filter((row)=> row.sampleCount > 0)
    .sort((a,b)=> {
      const rankA = seasonSortRank(String(a?.seasonKey || ""));
      const rankB = seasonSortRank(String(b?.seasonKey || ""));
      return rankA - rankB;
    });
  const dealerRangeRows = dealerRows
    .filter((row)=> (Number(row?.sampleCount) || 0) > 0)
    .slice()
    .sort((a,b)=> {
      const spreadDiff = (Number(b?.spread) || 0) - (Number(a?.spread) || 0);
      if(spreadDiff !== 0) return spreadDiff;
      return (Number(b?.rateHigh) || 0) - (Number(a?.rateHigh) || 0);
    });
  const latestWeeklyRange = weeklyRangeRows[weeklyRangeRows.length - 1] || null;
  const latestMonthlyRange = monthRows
    .filter((row)=> (Number(row?.sampleCount) || 0) > 0)
    .slice(-1)[0] || null;
  const allTimeRange = finalizePriceRangeRow(allTimePrice);

  const maxLbs = pickExtremeTrip(safeTrips, (t)=> Number(t?.pounds) || 0, "max");
  const maxAmt = pickExtremeTrip(safeTrips, (t)=> Number(t?.amount) || 0, "max");

  const lowLbsRows = buildMeaningfulLowRecordPool({
    rows: safeTrips,
    valueFromTrip: (t)=> Number(t?.pounds) || 0,
    highTrip: maxLbs,
    highValueFromTrip: (t)=> Number(t?.pounds) || 0,
    absoluteFloor: 1,
    ratioFloor: 0.05
  });
  const lowAmtRows = buildMeaningfulLowRecordPool({
    rows: safeTrips,
    valueFromTrip: (t)=> Number(t?.amount) || 0,
    highTrip: maxAmt,
    highValueFromTrip: (t)=> Number(t?.amount) || 0,
    absoluteFloor: 10,
    ratioFloor: 0.05
  });

  const minLbs = pickExtremeTrip(lowLbsRows, (t)=> Number(t?.pounds) || 0, "min");
  const minAmt = pickExtremeTrip(lowAmtRows, (t)=> Number(t?.amount) || 0, "min");

  const pplRows = safeTrips.filter((t)=> {
    const lbs = Number(t?.pounds) || 0;
    const rate = resolveTripPayRate(t);
    return lbs > 0 && rate > 0;
  });
  const maxPpl = pickExtremeTrip(pplRows, (t)=> resolveTripPayRate(t), "max");
  const lowPplRows = pplRows.filter((t)=>{
    const lbs = Number(t?.pounds) || 0;
    const rate = resolveTripPayRate(t);
    const earnedAmount = Number(t?.amount) || (rate * lbs);
    return lbs >= 5 && earnedAmount >= 20 && rate > 0;
  });
  const minPpl = pickExtremeTrip(lowPplRows, (t)=> resolveTripPayRate(t), "min");

  const tripsTimeline = buildTripsTimeline(safeTrips);
  const recordPools = {
    lbs: { max: safeTrips, min: lowLbsRows },
    amount: { max: safeTrips, min: lowAmtRows },
    ppl: { max: pplRows, min: lowPplRows }
  };

  return {
    dealerRows,
    areaRows,
    monthRows,
    maxLbs,
    minLbs,
    maxAmt,
    minAmt,
    pplRows,
    maxPpl,
    minPpl,
    tripsTimeline,
    recordPools,
    priceRangeSummary: {
      allTime: allTimeRange,
      latestWeek: latestWeeklyRange,
      latestMonth: latestMonthlyRange,
      weeklyRangeRows,
      monthlyRangeRows: monthRows.filter((row)=> (Number(row?.sampleCount) || 0) > 0),
      seasonalRangeRows
    },
    dealerRangeRows
  };
}

function finalizeAggregateRow(row){
  const trips = Number(row?.trips) || 0;
  const lbs = Number(row?.lbs) || 0;
  const amt = Number(row?.amt) || 0;
  const fishingDays = row?._days instanceof Set ? row._days.size : (Number(row?.fishingDays) || 0);
  return {
    ...row,
    fishingDays,
    avg: computeAggregatePPL(lbs, amt),
    poundsPerTrip: trips > 0 ? lbs / trips : 0,
    amountPerTrip: trips > 0 ? amt / trips : 0,
    poundsPerDay: fishingDays > 0 ? lbs / fishingDays : 0,
    amountPerDay: fishingDays > 0 ? amt / fishingDays : 0,
    ...finalizePriceRangeRow(row)
  };
}

function createPriceRangeBucket(){
  return {
    rateLow: null,
    rateHigh: null,
    spread: 0,
    sampleCount: 0
  };
}

function capturePriceRate(target, rate){
  if(!target || typeof target !== "object") return;
  const safeRate = Number(rate);
  if(!(safeRate > 0)) return;
  target.sampleCount = (Number(target.sampleCount) || 0) + 1;
  const low = Number(target.rateLow);
  const high = Number(target.rateHigh);
  target.rateLow = Number.isFinite(low) && low > 0 ? Math.min(low, safeRate) : safeRate;
  target.rateHigh = Number.isFinite(high) && high > 0 ? Math.max(high, safeRate) : safeRate;
  target.spread = Math.max(0, (Number(target.rateHigh) || 0) - (Number(target.rateLow) || 0));
}

function finalizePriceRangeRow(row){
  const low = Number(row?.rateLow);
  const high = Number(row?.rateHigh);
  const hasRange = Number.isFinite(low) && Number.isFinite(high) && low > 0 && high > 0;
  return {
    rateLow: hasRange ? low : 0,
    rateHigh: hasRange ? high : 0,
    spread: hasRange ? Math.max(0, high - low) : 0,
    sampleCount: Number(row?.sampleCount) || 0
  };
}

function resolveIsoWeekKey(iso){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ""))) return "";
  const dt = new Date(`${iso}T00:00:00Z`);
  if(Number.isNaN(dt.getTime())) return "";
  const day = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - day);
  const weekYear = dt.getUTCFullYear();
  const yearStart = new Date(Date.UTC(weekYear, 0, 1));
  const week = Math.ceil((((dt - yearStart) / 86400000) + 1) / 7);
  return `${weekYear}-W${String(week).padStart(2, "0")}`;
}

function resolveSeasonKey(iso){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ""))) return "";
  const month = Number(String(iso).slice(5, 7));
  if(month >= 3 && month <= 5) return "Spring";
  if(month >= 6 && month <= 8) return "Summer";
  if(month >= 9 && month <= 11) return "Fall";
  return "Winter";
}

function seasonSortRank(key){
  if(key === "Spring") return 1;
  if(key === "Summer") return 2;
  if(key === "Fall") return 3;
  if(key === "Winter") return 4;
  return 99;
}

function pickExtremeTrip(rows, valueFromTrip, direction){
  const safeRows = Array.isArray(rows) ? rows : [];
  if(!safeRows.length) return null;
  return safeRows.reduce((best, trip)=>{
    if(!best) return trip;
    const tripValue = Number(valueFromTrip(trip)) || 0;
    const bestValue = Number(valueFromTrip(best)) || 0;
    return direction === "min"
      ? (tripValue < bestValue ? trip : best)
      : (tripValue > bestValue ? trip : best);
  }, safeRows[0] || null);
}

function buildMeaningfulLowRecordPool({ rows, valueFromTrip, highTrip, highValueFromTrip, absoluteFloor, ratioFloor }){
  const positiveRows = (Array.isArray(rows) ? rows : []).filter((trip)=> (Number(valueFromTrip(trip)) || 0) > 0);
  if(!positiveRows.length) return [];
  const highValue = Number(highValueFromTrip(highTrip)) || 0;
  const threshold = Math.max(Number(absoluteFloor) || 0, highValue > 0 ? highValue * (Number(ratioFloor) || 0) : 0);
  return positiveRows.filter((trip)=> (Number(valueFromTrip(trip)) || 0) >= threshold);
}



export function summarizeTripsByMonthWindow(rows, monthKey, dayLimit){
  let amount = 0;
  let lbs = 0;
  let tripsCount = 0;
  const days = new Set();

  (Array.isArray(rows) ? rows : []).forEach((t)=>{
    const iso = String(t?.dateISO || "");
    if(!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return;
    if(iso.slice(0, 7) !== monthKey) return;
    const day = Number(iso.slice(8, 10));
    if(dayLimit && day > dayLimit) return;
    amount += Number(t?.amount) || 0;
    lbs += Number(t?.pounds) || 0;
    tripsCount += 1;
    days.add(iso);
  });

  return {
    monthKey,
    dayLimit: Number(dayLimit) || 0,
    amount,
    lbs,
    trips: tripsCount,
    uniqueDays: days.size,
    ppl: computeAggregatePPL(lbs, amount),
    amountPerTrip: tripsCount > 0 ? amount / tripsCount : 0,
    poundsPerTrip: tripsCount > 0 ? lbs / tripsCount : 0,
    amountPerDay: days.size > 0 ? amount / days.size : 0,
    poundsPerDay: days.size > 0 ? lbs / days.size : 0
  };
}

export function buildEntityPeriodRows({ trips, entityType, period }){
  const keyName = entityType === "dealer" ? "dealer" : "area";
  const map = new Map();

  (Array.isArray(trips) ? trips : []).forEach((t)=>{
    const iso = String(t?.dateISO || "");
    if(!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return;
    const rawName = String(t?.[keyName] || "").trim();
    const name = rawName || "(Unspecified)";
    const bucket = iso.slice(0, 7) === period.current?.monthKey
      ? "current"
      : (iso.slice(0, 7) === period.previous?.monthKey ? "previous" : "");
    if(!bucket) return;
    const day = Number(iso.slice(8, 10));
    const dayLimit = period?.[bucket]?.dayLimit;
    if(dayLimit && day > dayLimit) return;
    const key = name.toLowerCase();
    if(!map.has(key)){
      map.set(key, {
        name,
        current: { amount: 0, lbs: 0, trips: 0, uniqueDays: 0, _days: new Set() },
        previous: { amount: 0, lbs: 0, trips: 0, uniqueDays: 0, _days: new Set() }
      });
    }
    const row = map.get(key);
    const lbs = Number(t?.pounds) || 0;
    row[bucket].amount += Number(t?.amount) || 0;
    row[bucket].lbs += lbs;
    row[bucket].trips += 1;
    row[bucket]._days.add(iso);
  });

  return Array.from(map.values()).map((row)=>({
    name: row.name,
    current: finalizeEntityPeriodBucket(row.current),
    previous: finalizeEntityPeriodBucket(row.previous)
  }));
}

export function buildMonthWindowValueSeries({ monthRows, trips, dayLimit, metricKey = "amount" }){
  return normalizeChronologicalRows((Array.isArray(monthRows) ? monthRows : []).map((row)=>{
    const monthKey = String(row?.monthKey || "");
    const summary = dayLimit
      ? summarizeTripsByMonthWindow(trips, monthKey, dayLimit)
      : { amount: Number(row?.amt) || 0, lbs: Number(row?.lbs) || 0, trips: Number(row?.trips) || 0, ppl: Number(row?.avg) || 0 };
    const value = metricKey === "amount"
      ? Number(summary.amount) || 0
      : (metricKey === "pounds"
        ? Number(summary.lbs) || 0
        : (metricKey === "trips"
          ? Number(summary.trips) || 0
          : Number(summary.ppl) || 0));
    return {
      monthKey,
      label: String(row?.label || monthKey),
      value
    };
  }).filter((row)=> row.monthKey));
}

function finalizeEntityPeriodBucket(bucket){
  const lbs = Number(bucket?.lbs) || 0;
  const amount = Number(bucket?.amount) || 0;
  return {
    amount,
    lbs,
    ppl: computeAggregatePPL(lbs, amount),
    trips: Number(bucket?.trips) || 0,
    uniqueDays: bucket?._days instanceof Set ? bucket._days.size : (Number(bucket?.uniqueDays) || 0),
    amountPerTrip: bucket?.trips > 0 ? amount / bucket.trips : 0
  };
}

export function buildTripsTimeline(rows){
  const byKey = new Map();
  rows.forEach((t)=>{
    const iso = String(t?.dateISO || "");
    if(!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return;
    const key = iso.slice(0, 7);
    byKey.set(key, (byKey.get(key) || 0) + 1);
  });
  return normalizeChronologicalRows(Array.from(byKey.entries())
    .sort((a,b)=> a[0].localeCompare(b[0]))
    .map(([key, count])=>{
      const year = Number(key.slice(0, 4));
      const month = Number(key.slice(5, 7));
      const dt = new Date(year, month - 1, 1);
      return {
        key,
        count,
        label: dt.toLocaleString(undefined, { month: "short" }),
        shortLabel: `${dt.toLocaleString(undefined, { month: "short" })} ${String(year).slice(-2)}`
      };
    }));
}

export function normalizeChronologicalRows(rows){
  const list = Array.isArray(rows) ? rows.slice() : [];
  return list.sort((a,b)=> {
    const keyA = resolveChronologyMonthKey(a);
    const keyB = resolveChronologyMonthKey(b);
    if(keyA && keyB) return keyA.localeCompare(keyB);
    if(keyA) return -1;
    if(keyB) return 1;
    return 0;
  });
}

function resolveChronologyMonthKey(row){
  const monthKey = String(row?.monthKey || row?.key || "").trim();
  if(/^\d{4}-\d{2}$/.test(monthKey)) return monthKey;
  const iso = String(row?.dateISO || "").trim();
  if(/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso.slice(0, 7);
  return "";
}
