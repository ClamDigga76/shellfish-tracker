export function buildReportsSeasonalityFoundation({ trips, nowDate = new Date() } = {}){
  const safeTrips = (Array.isArray(trips) ? trips : [])
    .map((trip)=> normalizeSeasonTrip(trip))
    .filter(Boolean)
    .sort((a, b)=> a.iso.localeCompare(b.iso));

  const yearMap = new Map();
  const monthMap = new Map();
  for(let month = 1; month <= 12; month += 1){
    monthMap.set(month, createMonthBucket(month));
  }

  safeTrips.forEach((trip)=>{
    const yearBucket = yearMap.get(trip.year) || createAggregateBucket();
    accumulateAggregateBucket(yearBucket, trip);
    yearMap.set(trip.year, yearBucket);

    const monthBucket = monthMap.get(trip.month) || createMonthBucket(trip.month);
    accumulateAggregateBucket(monthBucket, trip);
    const perYear = monthBucket.years.get(trip.year) || createAggregateBucket();
    accumulateAggregateBucket(perYear, trip);
    monthBucket.years.set(trip.year, perYear);
    monthMap.set(trip.month, monthBucket);
  });

  const yearBuckets = Array.from(yearMap.entries())
    .sort((a, b)=> a[0] - b[0])
    .map(([year, bucket])=> finalizeYearBucket(year, bucket));

  const monthOfYearBuckets = Array.from(monthMap.values())
    .map((bucket)=> finalizeMonthBucket(bucket))
    .sort((a, b)=> a.month - b.month);

  const sameWindow = buildSameWindowComparison({ safeTrips, nowDate, yearBuckets });
  const bestWindowInsight = buildBestWindowInsight({ monthOfYearBuckets, sameWindow });
  const chartModel = buildSeasonalityChartModel(monthOfYearBuckets);

  return {
    hasHistory: safeTrips.length > 0,
    totalTrips: safeTrips.length,
    yearBuckets,
    monthOfYearBuckets,
    sameWindow,
    bestWindowInsight,
    chartModel,
    suppressed: safeTrips.length < 2,
    reason: safeTrips.length < 2 ? "Add more history to unlock seasonality patterns." : ""
  };
}

function normalizeSeasonTrip(trip){
  const iso = String(trip?.dateISO || "");
  if(!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const year = Number(iso.slice(0, 4));
  const month = Number(iso.slice(5, 7));
  const day = Number(iso.slice(8, 10));
  if(!(year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= 31)) return null;
  return {
    iso,
    year,
    month,
    day,
    pounds: Number(trip?.pounds) || 0,
    amount: Number(trip?.amount) || 0
  };
}

function createAggregateBucket(){
  return { trips: 0, lbs: 0, amt: 0, days: new Set() };
}

function createMonthBucket(month){
  return { month, trips: 0, lbs: 0, amt: 0, days: new Set(), years: new Map() };
}

function accumulateAggregateBucket(bucket, trip){
  bucket.trips += 1;
  bucket.lbs += Number(trip?.pounds) || 0;
  bucket.amt += Number(trip?.amount) || 0;
  bucket.days.add(String(trip?.iso || ""));
}

function finalizeAggregateBucket(bucket){
  const trips = Number(bucket?.trips) || 0;
  const lbs = Number(bucket?.lbs) || 0;
  const amt = Number(bucket?.amt) || 0;
  const fishingDays = bucket?.days instanceof Set ? bucket.days.size : 0;
  return {
    trips,
    lbs,
    amt,
    fishingDays,
    avgPpl: lbs > 0 ? amt / lbs : 0,
    amountPerTrip: trips > 0 ? amt / trips : 0,
    poundsPerTrip: trips > 0 ? lbs / trips : 0,
    amountPerDay: fishingDays > 0 ? amt / fishingDays : 0,
    poundsPerDay: fishingDays > 0 ? lbs / fishingDays : 0
  };
}

function finalizeYearBucket(year, bucket){
  return {
    year,
    label: String(year),
    ...finalizeAggregateBucket(bucket)
  };
}

function finalizeMonthBucket(bucket){
  const years = Array.from(bucket.years.entries())
    .sort((a, b)=> a[0] - b[0])
    .map(([year, yearBucket])=> ({ year, label: String(year), ...finalizeAggregateBucket(yearBucket) }));
  const finalized = finalizeAggregateBucket(bucket);
  const contributingYears = years.filter((row)=> row.trips > 0).length;
  return {
    month: bucket.month,
    monthLabel: monthLabelFromNumber(bucket.month),
    shortLabel: monthShortLabelFromNumber(bucket.month),
    contributingYears,
    years,
    ...finalized,
    averageMonthlyAmount: contributingYears > 0 ? finalized.amt / contributingYears : 0,
    averageMonthlyPounds: contributingYears > 0 ? finalized.lbs / contributingYears : 0,
    averageTripsPerYear: contributingYears > 0 ? finalized.trips / contributingYears : 0,
    supportStrong: contributingYears >= 2 && finalized.trips >= 4
  };
}

function buildSameWindowComparison({ safeTrips, nowDate, yearBuckets }){
  const latestYear = Number(new Date(nowDate).getUTCFullYear()) || 0;
  const priorYear = latestYear - 1;
  if(!latestYear || priorYear <= 0){
    return buildSuppressedSameWindow("Need current-year history to compare the same seasonal window.");
  }
  const month = new Date(nowDate).getUTCMonth() + 1;
  const day = new Date(nowDate).getUTCDate();
  const currentRows = safeTrips.filter((trip)=> trip.year === latestYear && isWithinSameWindow(trip, month, day));
  const priorRows = safeTrips.filter((trip)=> trip.year === priorYear && isWithinSameWindow(trip, month, day));
  const current = summarizeRows(currentRows, latestYear, month, day);
  const previous = summarizeRows(priorRows, priorYear, month, day);
  const yearSet = new Set(yearBuckets.map((row)=> row.year));
  if(!yearSet.has(latestYear) || !yearSet.has(priorYear)){
    return buildSuppressedSameWindow(`Need both ${latestYear} and ${priorYear} history for an aligned same-window read.`, latestYear, priorYear, month, day);
  }
  const enoughSupport = current.trips >= 2 && previous.trips >= 2;
  const sameWindowLabel = `${latestYear} through ${monthShortLabelFromNumber(month)} ${day} vs ${priorYear} through ${monthShortLabelFromNumber(month)} ${day}`;
  const deltaAmount = current.amount - previous.amount;
  const deltaTrips = current.trips - previous.trips;
  const deltaPounds = current.lbs - previous.lbs;
  const deltaPct = previous.amount > 0 ? deltaAmount / previous.amount : null;
  return {
    suppressed: !enoughSupport,
    reason: enoughSupport ? "" : `Need at least 2 trips in both ${latestYear} and ${priorYear} through ${monthShortLabelFromNumber(month)} ${day}.`,
    label: sameWindowLabel,
    shortLabel: `${monthShortLabelFromNumber(month)} ${day} aligned window`,
    currentYear: latestYear,
    priorYear,
    cutoffMonth: month,
    cutoffDay: day,
    current,
    previous,
    deltaAmount,
    deltaPounds,
    deltaTrips,
    deltaPct,
    tone: deltaAmount > 0 ? "up" : (deltaAmount < 0 ? "down" : "neutral"),
    supportStrong: enoughSupport && current.trips >= 3 && previous.trips >= 3
  };
}

function buildSuppressedSameWindow(reason, latestYear = 0, priorYear = 0, month = 0, day = 0){
  return {
    suppressed: true,
    reason,
    label: latestYear && priorYear && month && day
      ? `${latestYear} through ${monthShortLabelFromNumber(month)} ${day} vs ${priorYear} through ${monthShortLabelFromNumber(month)} ${day}`
      : "Aligned same-window comparison",
    shortLabel: "Aligned same-window comparison",
    currentYear: latestYear,
    priorYear,
    cutoffMonth: month,
    cutoffDay: day,
    current: summarizeRows([], latestYear, month, day),
    previous: summarizeRows([], priorYear, month, day),
    deltaAmount: 0,
    deltaPounds: 0,
    deltaTrips: 0,
    deltaPct: null,
    tone: "neutral",
    supportStrong: false
  };
}

function summarizeRows(rows, year, month, day){
  const summary = rows.reduce((bucket, trip)=>{
    bucket.amount += Number(trip?.amount) || 0;
    bucket.lbs += Number(trip?.pounds) || 0;
    bucket.trips += 1;
    bucket.days.add(String(trip?.iso || ""));
    return bucket;
  }, { amount: 0, lbs: 0, trips: 0, days: new Set() });
  return {
    year,
    label: year ? `${year} through ${monthShortLabelFromNumber(month)} ${day}` : "",
    amount: summary.amount,
    lbs: summary.lbs,
    trips: summary.trips,
    uniqueDays: summary.days.size,
    ppl: summary.lbs > 0 ? summary.amount / summary.lbs : 0,
    amountPerTrip: summary.trips > 0 ? summary.amount / summary.trips : 0
  };
}

function buildBestWindowInsight({ monthOfYearBuckets, sameWindow }){
  const supported = monthOfYearBuckets.filter((row)=> row.supportStrong);
  if(!supported.length){
    return {
      suppressed: true,
      reason: "Need at least two years with a few trips before calling out a best seasonal window.",
      title: "Best seasonal window",
      summary: "Seasonality insight unlocks after more repeat history builds.",
      monthLabel: "",
      metricLabel: "Best month-of-year by average amount",
      tone: "neutral"
    };
  }
  const best = supported.reduce((top, row)=> (row.averageMonthlyAmount > top.averageMonthlyAmount ? row : top), supported[0]);
  const yoyNote = sameWindow?.suppressed
    ? "Aligned year-over-year support is still building."
    : `Aligned window: ${sameWindow.label}.`;
  return {
    suppressed: false,
    title: "Best seasonal window",
    metricLabel: "Best month-of-year by average amount",
    monthLabel: best.monthLabel,
    tone: "up",
    summary: `${best.monthLabel} is the best month-of-year by average amount across ${best.contributingYears} years. ${yoyNote}`,
    amount: best.averageMonthlyAmount,
    trips: best.averageTripsPerYear,
    pounds: best.averageMonthlyPounds,
    supportText: `${best.contributingYears} years • ${best.trips} trips total`
  };
}

function buildSeasonalityChartModel(monthOfYearBuckets){
  const supported = monthOfYearBuckets.filter((row)=> row.contributingYears > 0);
  if(supported.length < 2) return null;
  return {
    chartType: "seasonality-bars",
    metricKey: "amount",
    basisLabel: "Average amount by month-of-year across all years",
    labels: supported.map((row)=> row.shortLabel),
    values: supported.map((row)=> row.averageMonthlyAmount)
  };
}

function isWithinSameWindow(trip, cutoffMonth, cutoffDay){
  if(trip.month < cutoffMonth) return true;
  if(trip.month > cutoffMonth) return false;
  return trip.day <= cutoffDay;
}

function monthLabelFromNumber(month){
  return new Date(Date.UTC(2020, Math.max(0, month - 1), 1)).toLocaleString(undefined, { month: "long", timeZone: "UTC" });
}

function monthShortLabelFromNumber(month){
  return new Date(Date.UTC(2020, Math.max(0, month - 1), 1)).toLocaleString(undefined, { month: "short", timeZone: "UTC" });
}
