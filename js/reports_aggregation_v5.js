export function buildReportsAggregationState({ trips, canonicalDealerGroupKey, normalizeDealerDisplay, resolveTripArea }){
  const safeTrips = Array.isArray(trips) ? trips : [];

  const byDealer = new Map();
  const byArea = new Map();
  const byMonth = new Map();

  safeTrips.forEach((t)=>{
    const dealerRaw = (t?.dealer || "").toString();
    const dealerName = normalizeDealerDisplay(dealerRaw) || "(Unspecified)";
    const dealerKey = canonicalDealerGroupKey(dealerRaw) || "(unspecified)";
    const areaResolved = typeof resolveTripArea === "function" ? resolveTripArea(t) : null;
    const area = (areaResolved?.canonicalName || (t?.area || "").toString().trim()) || "(Unspecified)";
    const areaKey = area.toLowerCase();

    const lbs = Number(t?.pounds) || 0;
    const amt = Number(t?.amount) || 0;
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
    }
  });

  const dealerRows = Array.from(byDealer.values())
    .map((x)=> finalizeAggregateRow(x))
    .sort((a,b)=> b.amt - a.amt);

  const areaRows = Array.from(byArea.values())
    .map((x)=> finalizeAggregateRow(x))
    .sort((a,b)=> b.amt - a.amt);

  const monthRows = Array.from(byMonth.entries())
    .sort((a,b)=> a[0].localeCompare(b[0]))
    .map(([monthKey, x])=>{
      const year = Number(monthKey.slice(0, 4));
      const month = Number(monthKey.slice(5, 7));
      const dt = new Date(year, month - 1, 1);
      return {
        monthKey,
        month,
        year,
        label: `${dt.toLocaleString(undefined, { month: "short" })} ${year}`,
        ...finalizeAggregateRow(x)
      };
    });

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

  const pplRows = safeTrips.filter((t)=> (Number(t?.pounds) || 0) > 0 && (Number(t?.amount) || 0) > 0);
  const maxPpl = pickExtremeTrip(pplRows, (t)=> (Number(t?.amount) || 0) / (Number(t?.pounds) || 1), "max");
  const lowPplRows = pplRows.filter((t)=>{
    const lbs = Number(t?.pounds) || 0;
    const amt = Number(t?.amount) || 0;
    return lbs >= 5 && amt >= 20;
  });
  const minPpl = pickExtremeTrip(lowPplRows, (t)=> (Number(t?.amount) || 0) / (Number(t?.pounds) || 1), "min");

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
    recordPools
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
    avg: lbs > 0 ? amt / lbs : 0,
    poundsPerTrip: trips > 0 ? lbs / trips : 0,
    amountPerTrip: trips > 0 ? amt / trips : 0,
    poundsPerDay: fishingDays > 0 ? lbs / fishingDays : 0,
    amountPerDay: fishingDays > 0 ? amt / fishingDays : 0
  };
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
    ppl: lbs > 0 ? amount / lbs : 0,
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
        current: { amount: 0, trips: 0, uniqueDays: 0, _days: new Set() },
        previous: { amount: 0, trips: 0, uniqueDays: 0, _days: new Set() }
      });
    }
    const row = map.get(key);
    row[bucket].amount += Number(t?.amount) || 0;
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
  return (Array.isArray(monthRows) ? monthRows : []).map((row)=>{
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
  }).filter((row)=> row.monthKey);
}

function finalizeEntityPeriodBucket(bucket){
  return {
    amount: Number(bucket?.amount) || 0,
    trips: Number(bucket?.trips) || 0,
    uniqueDays: bucket?._days instanceof Set ? bucket._days.size : (Number(bucket?.uniqueDays) || 0)
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
  return Array.from(byKey.entries())
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
    });
}
