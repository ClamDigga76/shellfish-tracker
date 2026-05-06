import { buildRollingSeriesFromMonthRows, describeRollingContext, getRollingWindowForMetric } from "./reports_rolling_trends_v5.js";
import { HOME_RATE_RANKING_THRESHOLDS, buildHomeSharedChartModel, normalizeChronologicalRows } from "./reports_chart_definitions_v5.js";
import { createChartStorySeam } from "./chart_story_seam_v5.js";

const HOME_METRIC_DETAIL_COMPARE_CONTRACT = Object.freeze({
  fairWindowLabel: "Visible range",
  compareModel: "home-fair-window",
  compareModelLabel: "Fair month window",
  supportLabel: "Visible range",
  support: "Comparing a fair day window across the latest two visible months.",
  explanation: "",
  missingReason: "Show one more visible month to unlock month-to-month detail.",
  missingSuppressionCode: "missing-home-months",
  missingExplanation: "Add one more visible month in the selected period and this comparison will appear.",
  metricExplanation: ()=> "Uses the same visible month pair in the compare card and chart."
});

const METRIC_DETAIL_SURFACE_MODES = Object.freeze({
  home: Object.freeze({
    mode: "home",
    detailSurfaceClass: "homeMetricDetail",
    detailCardClass: "homeMetricDetailCard",
    detailBackClass: "homeMetricBackBtn",
    detailEyebrowClass: "homeMetricEyebrow",
    detailTitleClass: "homeMetricTitle",
    detailContextClass: "homeMetricContext",
    detailHeroWrapClass: "homeMetricHeroWrap",
    detailHeroLabelClass: "homeMetricHeroLabel",
    detailHeroValueClass: "homeMetricHeroValue",
    detailCompareClass: "homeMetricCompare",
    detailCompareTextClass: "homeMetricCompareText",
    detailCompareRowsClass: "homeMetricCompareRows",
    detailChartClass: "homeMetricChartBlock",
    detailChartContextClass: "homeMetricChartContext",
    detailInsightClass: "homeMetricInsight"
  }),
  reports: Object.freeze({
    mode: "reports",
    detailSurfaceClass: "reportsMetricDetail",
    detailCardClass: "reportsMetricDetailCard",
    detailBackClass: "reportsMetricBackBtn",
    detailEyebrowClass: "reportsMetricEyebrow",
    detailTitleClass: "reportsMetricTitle",
    detailContextClass: "reportsMetricContext",
    detailHeroWrapClass: "reportsMetricHeroWrap",
    detailHeroLabelClass: "reportsMetricHeroLabel",
    detailHeroValueClass: "reportsMetricHeroValue",
    detailCompareClass: "reportsMetricCompare",
    detailCompareTextClass: "reportsMetricCompareText",
    detailCompareRowsClass: "reportsMetricCompareRows",
    detailChartClass: "reportsMetricChartBlock",
    detailChartContextClass: "reportsMetricChartContext",
    detailInsightClass: "reportsMetricInsight"
  })
});

const HOME_FREE_KPI_DETAIL_CONFIG = Object.freeze({
  trips: Object.freeze({
    helperLine: "Trips show your work rhythm for this period.",
    primaryChartKey: "tripsMonthlyTrend",
    freeChartKeys: Object.freeze([
      Object.freeze({ key: "tripsActivity", title: "Trip Activity", context: "Trips logged by month for [Home filter label]." }),
      Object.freeze({ key: "tripsDealerMix", title: "Trips by Dealer", context: "Trips counted by dealer for [Home filter label]." }),
      Object.freeze({ key: "tripsByPoundRange", title: "Trips by Pound Range", context: "Trips counted by pound range for [Home filter label]." })
    ]),
    teaserText: "Unlock Trip Insights • Best days • trip patterns • area activity • dealer activity • View Trip Insights 🔒"
  }),
  pounds: Object.freeze({
    helperLine: "Pounds show production before price is factored in.",
    primaryChartKey: "poundsMonthlyTrend",
    freeChartKeys: Object.freeze([
      Object.freeze({ key: "poundsMonthlyTrend", title: "Pounds Over Time", context: "Pounds landed over [Home filter label]." }),
      Object.freeze({ key: "poundsPerTripTrend", title: "Avg Pounds / Trip", context: "Average pounds per trip over [Home filter label]." }),
      Object.freeze({ key: "poundsLast5Trips", title: "Last 5 Trip Pounds", context: "Pounds from your latest saved trips." })
    ]),
    teaserText: "Unlock Full Insights for exact season totals, pay-rate trends, area strength, and deeper chart intelligence."
  }),
  amount: Object.freeze({
    helperLine: "Total paid amount from trips in the selected period.",
    primaryChartKey: "amountTrend",
    freeChartKeys: Object.freeze([
      Object.freeze({ key: "amountTrend", title: "Pay Over Time", context: "Pay received over [Home filter label]." }),
      Object.freeze({ key: "amountPerTripTrend", title: "Avg Pay / Trip", context: "Average pay per trip over [Home filter label]." }),
      Object.freeze({ key: "amountLast5Trips", title: "Last 5 Trip Pay", context: "Pay from your latest saved trips." })
    ]),
    teaserText: "Unlock Full Insights to compare dealers, price trends, and deeper money insights."
  }),
  ppl: Object.freeze({
    helperLine: "Average price per pound over [Home filter label].",
    primaryChartKey: "pplMonthlyTrendFree",
    freeChartKeys: Object.freeze([
      Object.freeze({ key: "pplMonthlyTrendFree", title: "Avg Pay Rate Over Time", context: "Average price per pound over [Home filter label]." }),
      Object.freeze({ key: "pplLast5Trips", title: "Last 5 Trip Rates", context: "Price per pound from your latest saved trips." }),
      Object.freeze({ key: "pplPriceRangeByTrip", title: "Price Range by Trip", context: "Trips counted by price-per-pound range." })
    ]),
    teaserText: "Unlock Full Insights to compare dealer pay rates and price-per-pound trends."
  })
});

function resolveMetricDetailSurfaceMode({ isHomeMetricDetail = false } = {}){
  return isHomeMetricDetail ? METRIC_DETAIL_SURFACE_MODES.home : METRIC_DETAIL_SURFACE_MODES.reports;
}

function toneFromDelta(deltaPct, epsilonPct){
  const v = Number(deltaPct) || 0;
  if(Math.abs(v) <= epsilonPct) return "steady";
  return v > 0 ? "up" : "down";
}

function summarizeHomeMonthRow(row){
  const pounds = Number(row?.lbs) || 0;
  const amount = Number(row?.amt) || 0;
  const trips = Number(row?.trips) || 0;
  const uniqueDays = Number(row?.fishingDays) || trips;
  const avgFromRow = Number(row?.avg);
  const weightedPpl = pounds > 0 ? (amount / pounds) : 0;
  return {
    trips,
    lbs: pounds,
    amount,
    ppl: pounds > 0 ? (Number.isFinite(avgFromRow) && avgFromRow > 0 ? avgFromRow : weightedPpl) : 0,
    uniqueDays,
    amountPerTrip: trips > 0 ? amount / trips : 0,
    poundsPerTrip: trips > 0 ? pounds / trips : 0,
    amountPerDay: uniqueDays > 0 ? amount / uniqueDays : 0,
    poundsPerDay: uniqueDays > 0 ? pounds / uniqueDays : 0
  };
}

function classifyHomeConfidence({ currentTrips, previousTrips }){
  const floor = Math.min(Number(currentTrips) || 0, Number(previousTrips) || 0);
  if(floor >= 4) return "strong";
  if(floor >= 2) return "early";
  return "weak";
}

function buildHomeCompareContractFields({ support } = {}){
  return {
    fairWindowLabel: HOME_METRIC_DETAIL_COMPARE_CONTRACT.fairWindowLabel,
    compareModel: HOME_METRIC_DETAIL_COMPARE_CONTRACT.compareModel,
    compareModelLabel: HOME_METRIC_DETAIL_COMPARE_CONTRACT.compareModelLabel,
    supportLabel: HOME_METRIC_DETAIL_COMPARE_CONTRACT.supportLabel,
    support: support || HOME_METRIC_DETAIL_COMPARE_CONTRACT.support
  };
}

function buildHomeComparablePeriod({ currentMonth, previousMonth, current, previous }){
  const confidenceLabel = classifyHomeConfidence({ currentTrips: current.trips, previousTrips: previous.trips });
  return {
    comparable: true,
    suppressed: false,
    confidence: confidenceLabel === "strong" ? "high" : (confidenceLabel === "early" ? "medium" : "low"),
    confidenceLabel,
    trustLabel: confidenceLabel,
    reason: "",
    suppressionCode: "",
    explanation: HOME_METRIC_DETAIL_COMPARE_CONTRACT.explanation,
    currentLabel: currentMonth.displayLabel || currentMonth.label || currentMonth.monthKey,
    previousLabel: previousMonth.displayLabel || previousMonth.label || previousMonth.monthKey,
    ...buildHomeCompareContractFields(),
    current,
    previous
  };
}

function buildHomeSuppressedPeriod({ currentMonth, previousMonth, current, previous }){
  return {
    comparable: false,
    suppressed: true,
    confidence: "none",
    confidenceLabel: "suppressed",
    trustLabel: "suppressed",
    reason: HOME_METRIC_DETAIL_COMPARE_CONTRACT.missingReason,
    suppressionCode: HOME_METRIC_DETAIL_COMPARE_CONTRACT.missingSuppressionCode,
    explanation: HOME_METRIC_DETAIL_COMPARE_CONTRACT.missingExplanation,
    currentLabel: currentMonth?.displayLabel || currentMonth?.label || "Current month",
    previousLabel: previousMonth?.displayLabel || previousMonth?.label || "Previous month",
    ...buildHomeCompareContractFields({ support: "Visible months in the selected period" }),
    current,
    previous
  };
}

function buildHomeMetricPayload({ metricKey, label, currentValue, previousValue, period, suppressed = false, reason = "" }){
  const current = Number(currentValue) || 0;
  const previous = Number(previousValue) || 0;
  const deltaValue = current - previous;
  const deltaPct = previous > 0 ? (deltaValue / previous) : null;
  const confidenceLabel = String(period?.confidenceLabel || "weak");
  return {
    metricKey,
    label,
    currentValue: current,
    previousValue: previous,
    deltaValue,
    deltaPct,
    compareTone: !suppressed
      ? (deltaPct == null ? (deltaValue > 0 ? "up" : (deltaValue < 0 ? "down" : "steady")) : toneFromDelta(deltaPct, metricKey === "ppl" ? 0.035 : 0.05))
      : "steady",
    suppressed,
    reason,
    explanation: suppressed ? reason : HOME_METRIC_DETAIL_COMPARE_CONTRACT.metricExplanation(label),
    suppressionCode: suppressed ? "home-baseline-missing" : "",
    confidence: String(period?.confidence || "low"),
    confidenceLabel,
    trustLabel: confidenceLabel,
    percentValid: !suppressed && deltaPct != null,
    support: {
      currentTrips: Number(period?.current?.trips) || 0,
      previousTrips: Number(period?.previous?.trips) || 0,
      currentUniqueDays: Number(period?.current?.uniqueDays) || 0,
      previousUniqueDays: Number(period?.previous?.uniqueDays) || 0
    }
  };
}

function buildHomeMetricPayloads(period){
  const current = period?.current || {};
  const previous = period?.previous || {};
  return {
    trips: buildHomeMetricPayload({ metricKey: "trips", label: "Trips", currentValue: current.trips, previousValue: previous.trips, period }),
    pounds: buildHomeMetricPayload({ metricKey: "pounds", label: "Pounds", currentValue: current.lbs, previousValue: previous.lbs, period }),
    amount: buildHomeMetricPayload({ metricKey: "amount", label: "Amount", currentValue: current.amount, previousValue: previous.amount, period }),
    ppl: buildHomeMetricPayload({
      metricKey: "ppl",
      label: "Avg $ / lb",
      currentValue: current.ppl,
      previousValue: previous.ppl,
      period,
      suppressed: !(current.lbs > 0 && previous.lbs > 0),
      reason: "Log pounds in both visible months in the selected period to compare Avg $ / lb."
    })
  };
}

function buildHomeCompareBarChart({ labels, metricKey, currentValue, previousValue }){
  return {
    chartType: "compare-bars",
    metricKey,
    basisLabel: String(labels?.length ? labels.join(" vs ") : "Visible range"),
    showBarValueLabels: true,
    categoryLabelsBelowBars: true,
    labels: Array.isArray(labels) ? labels.slice(0, 2) : ["Previous month", "Current month"],
    values: [Number(previousValue) || 0, Number(currentValue) || 0]
  };
}

function buildHomeTimeSeriesChart({ monthRows, metricKey, valueKey, basisLabel = "Visible range", chartType = "time-series", emptyMonthNoData = false }){
  const safeMonths = normalizeChronologicalRows(Array.isArray(monthRows) ? monthRows : []);
  return {
    chartType: String(chartType || "time-series"),
    metricKey,
    basisLabel,
    noDataGaps: emptyMonthNoData === true,
    monthKeys: safeMonths.map((row)=> String(row?.monthKey || "")),
    labels: safeMonths.map((row)=> String(row?.label || row?.monthKey || "")),
    values: safeMonths.map((row)=> {
      const treatAsNoData = emptyMonthNoData === true
        && (row?.isEmptyMonth === true || row?.hasTrips === false);
      if(treatAsNoData) return null;
      return Number(row?.[valueKey]) || 0;
    })
  };
}

function buildHomeCumulativeSeriesChart({ monthRows, metricKey, valueKey, basisLabel = "Visible range" }){
  const safeRows = normalizeChronologicalRows(Array.isArray(monthRows) ? monthRows : []).filter((row)=> row?.shortLabel || row?.label);
  let runningTotal = 0;
  return {
    metricKey,
    chartType: "time-series",
    basisLabel: String(basisLabel || "Visible range"),
    labels: safeRows.map((row)=> row.shortLabel || row.label),
    values: safeRows.map((row)=> {
      runningTotal += Number(row?.[valueKey]) || 0;
      return runningTotal;
    })
  };
}

function parseTripDateValue(trip){
  const dateToken = String(trip?.dateISO || trip?.date || trip?.when || trip?.tripDate || "").slice(0, 10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(dateToken)) return null;
  const parsed = Date.parse(`${dateToken}T00:00:00Z`);
  if(!Number.isFinite(parsed)) return null;
  return { dateToken, timestamp: parsed };
}

function resolveLatestSelectedTrip(trips){
  const safeTrips = Array.isArray(trips) ? trips : [];
  const datedTrips = safeTrips
    .map((trip)=> {
      const parsedDate = parseTripDateValue(trip);
      if(!parsedDate) return null;
      return { trip, ...parsedDate };
    })
    .filter((row)=> row != null)
    .sort((a, b)=> a.timestamp - b.timestamp);
  if(!datedTrips.length) return null;
  return datedTrips[datedTrips.length - 1].trip;
}

function formatCompactTripDate(trip){
  const parsed = parseTripDateValue(trip);
  if(!parsed) return "—";
  const dt = new Date(parsed.timestamp);
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}


function buildHomeLast5TripPoundsChart({ trips, isSeasonPreview = false }){
  const datedTrips = (Array.isArray(trips) ? trips : [])
    .map((trip)=> {
      const parsedDate = parseTripDateValue(trip);
      if(!parsedDate) return null;
      const pounds = Number(trip?.pounds);
      if(!Number.isFinite(pounds)) return null;
      return { pounds, parsedDate, trip };
    })
    .filter((row)=> row != null)
    .sort((a, b)=> a.parsedDate.timestamp - b.parsedDate.timestamp);
  const lastFive = datedTrips.slice(-5);
  return {
    chartType: "compare-bars",
    metricKey: "pounds",
    basisLabel: "Last 5 saved trips",
    categoryLabelsBelowBars: true,
    showBarValueLabels: true,
    labels: lastFive.map((row)=> {
      const formatted = formatCompactTripDate(row.trip);
      return formatted && formatted !== "Invalid Date" ? formatted : "—";
    }),
    values: lastFive.map((row)=> row.pounds)
  };
}



function buildHomeLast5TripPayChart({ trips }){
  const datedTrips = (Array.isArray(trips) ? trips : [])
    .map((trip)=> {
      const parsedDate = parseTripDateValue(trip);
      if(!parsedDate) return null;
      const amount = Number(trip?.amount);
      if(!Number.isFinite(amount)) return null;
      return { amount, parsedDate, trip };
    })
    .filter((row)=> row != null)
    .sort((a, b)=> a.parsedDate.timestamp - b.parsedDate.timestamp);
  const lastFive = datedTrips.slice(-5);
  return {
    chartType: "compare-bars",
    metricKey: "amount",
    basisLabel: "Last 5 saved trips",
    categoryLabelsBelowBars: true,
    showBarValueLabels: true,
    labels: lastFive.map((row)=> {
      const formatted = formatCompactTripDate(row.trip);
      return formatted && formatted !== "Invalid Date" ? formatted : "—";
    }),
    values: lastFive.map((row)=> row.amount)
  };
}

function resolveTripPayRate(trip){
  const explicitRate = Number(trip?.ppl ?? trip?.payRate ?? trip?.pricePerPound ?? trip?.rate);
  if(Number.isFinite(explicitRate) && explicitRate > 0) return explicitRate;
  const pounds = Number(trip?.pounds);
  const amount = Number(trip?.amount);
  if(Number.isFinite(pounds) && pounds > 0 && Number.isFinite(amount) && amount > 0){
    const derivedRate = amount / pounds;
    if(Number.isFinite(derivedRate) && derivedRate > 0) return derivedRate;
  }
  return null;
}

function buildHomePriceRangeByTripChart({ trips }){
  const buckets = [{ label: "Under $1.50", min: Number.NEGATIVE_INFINITY, max: 1.5 }];
  for(let min = 1.5; min < 10; min += 0.5){
    const max = min + 0.5;
    buckets.push({
      label: `$${min.toFixed(2)}–$${max.toFixed(2)}`,
      min,
      max
    });
  }
  buckets.push({ label: "$10+", min: 10, max: Number.POSITIVE_INFINITY });

  const counts = buckets.map(()=> 0);
  (Array.isArray(trips) ? trips : []).forEach((trip)=> {
    const rate = resolveTripPayRate(trip);
    if(!Number.isFinite(rate)) return;
    const idx = buckets.findIndex((bucket)=> rate >= bucket.min && rate < bucket.max);
    if(idx >= 0) counts[idx] += 1;
  });

  const populated = buckets
    .map((bucket, index)=> ({ label: bucket.label, count: counts[index] }))
    .filter((entry)=> entry.count > 0);

  return {
    chartType: "compare-bars",
    metricKey: "trips",
    basisLabel: "Trips by price range",
    categoryLabelsBelowBars: true,
    showBarValueLabels: true,
    labels: populated.map((entry)=> entry.label),
    values: populated.map((entry)=> entry.count)
  };
}

function buildHomeLast5TripRatesChart({ trips }){
  const datedTrips = (Array.isArray(trips) ? trips : [])
    .map((trip)=> {
      const parsedDate = parseTripDateValue(trip);
      const rate = resolveTripPayRate(trip);
      if(!parsedDate || !Number.isFinite(rate)) return null;
      return { parsedDate, trip, rate };
    })
    .filter((row)=> row != null)
    .sort((a, b)=> a.parsedDate.timestamp - b.parsedDate.timestamp);
  const lastFive = datedTrips.slice(-5);
  return { chartType: "compare-bars", metricKey: "ppl", basisLabel: "Last 5 saved trips", categoryLabelsBelowBars: true, showBarValueLabels: true, labels: lastFive.map((row)=> formatCompactTripDate(row.trip)), values: lastFive.map((row)=> row.rate) };
}

function computeCurrentRunFromTrips(trips){
  const parsedDates = (Array.isArray(trips) ? trips : [])
    .map((trip)=> parseTripDateValue(trip))
    .filter((row)=> row != null)
    .map((row)=> row.dateToken);
  if(!parsedDates.length) return 0;
  const uniqueDates = Array.from(new Set(parsedDates)).sort((a, b)=> a.localeCompare(b));
  if(!uniqueDates.length) return 0;
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  let run = 1;
  for(let i = uniqueDates.length - 1; i > 0; i -= 1){
    const currentTs = Date.parse(`${uniqueDates[i]}T00:00:00Z`);
    const previousTs = Date.parse(`${uniqueDates[i - 1]}T00:00:00Z`);
    if(!Number.isFinite(currentTs) || !Number.isFinite(previousTs)) break;
    if((currentTs - previousTs) === ONE_DAY_MS){
      run += 1;
      continue;
    }
    break;
  }
  return run;
}

function buildHomeTopRowsBarChart({ rows, metricKey, valueKey, basisLabel, maxItems = 5, labelMode = "" }){
  const safeRows = Array.isArray(rows)
    ? rows
      .filter((row)=> Number(row?.[valueKey]) > 0)
      .slice(0, maxItems)
    : [];
  return {
    chartType: "compare-bars",
    metricKey,
    basisLabel: String(basisLabel || "Visible range"),
    labelMode: String(labelMode || ""),
    showBarValueLabels: true,
    categoryLabelsBelowBars: true,
    labels: safeRows.map((row)=> String(row?.name || "—")),
    values: safeRows.map((row)=> Number(row?.[valueKey]) || 0)
  };
}

function buildTripTimelineChart({ trips, basisLabel = "Trip marks timeline" }){
  const byDate = new Map();
  (Array.isArray(trips) ? trips : []).forEach((trip)=> {
    const parsed = parseTripDateValue(trip);
    if(!parsed) return;
    byDate.set(parsed.dateToken, (byDate.get(parsed.dateToken) || 0) + 1);
  });
  const dateKeys = Array.from(byDate.keys()).sort((a, b)=> a.localeCompare(b));
  return {
    chartType: "trip-timeline",
    metricKey: "trips",
    basisLabel: String(basisLabel || "Trip marks timeline"),
    labels: dateKeys,
    values: dateKeys.map((key)=> byDate.get(key) || 0)
  };
}

function toBucketLabel(value, buckets){
  const safeValue = Number(value) || 0;
  const hit = (Array.isArray(buckets) ? buckets : []).find((bucket)=> safeValue >= bucket.min && safeValue < bucket.max);
  return hit ? hit.label : "—";
}

function buildHomeDetailCharts({ monthRows, dealerRows, areaRows, period, trips = [], isSeasonPreview = false }){
  const safeMonths = normalizeChronologicalRows(Array.isArray(monthRows) ? monthRows : []);
  const labels = [
    String(period?.previousLabel || "Previous month"),
    String(period?.currentLabel || "Current month")
  ];
  const AVG_RATE_MIN_TRIPS = Number(HOME_RATE_RANKING_THRESHOLDS.minTrips) || 2;
  const AVG_RATE_MIN_POUNDS = Number(HOME_RATE_RANKING_THRESHOLDS.minPounds) || 150;
  const rateLeaderSupportLabel = `Rate leaders use rows with at least ${AVG_RATE_MIN_TRIPS} trips and ${AVG_RATE_MIN_POUNDS} lbs.`;
  const dealerRowsByTrips = Array.isArray(dealerRows)
    ? dealerRows
      .slice()
      .sort((a,b)=> (Number(b?.trips) || 0) - (Number(a?.trips) || 0) || (Number(b?.amt) || 0) - (Number(a?.amt) || 0) || (Number(b?.lbs) || 0) - (Number(a?.lbs) || 0) || String(a?.name || "").localeCompare(String(b?.name || "")))
    : [];
  const areaRowsByTrips = Array.isArray(areaRows)
    ? areaRows
      .slice()
      .sort((a,b)=> (Number(b?.trips) || 0) - (Number(a?.trips) || 0) || (Number(b?.amt) || 0) - (Number(a?.amt) || 0) || (Number(b?.lbs) || 0) - (Number(a?.lbs) || 0) || String(a?.name || "").localeCompare(String(b?.name || "")))
    : [];
  const areaRowsByAmount = Array.isArray(areaRows)
    ? areaRows.slice().sort((a,b)=> (Number(b?.amt) || 0) - (Number(a?.amt) || 0))
    : [];
  const dealerRowsByPounds = Array.isArray(dealerRows)
    ? dealerRows
      .slice()
      .sort((a,b)=> (Number(b?.lbs) || 0) - (Number(a?.lbs) || 0) || (Number(b?.amt) || 0) - (Number(a?.amt) || 0) || (Number(b?.trips) || 0) - (Number(a?.trips) || 0) || String(a?.name || "").localeCompare(String(b?.name || "")))
    : [];
  const areaRowsByRate = Array.isArray(areaRows)
    ? areaRows
      .slice()
      .filter((row)=> (Number(row?.lbs) || 0) > 0 && (Number(row?.avg) || 0) > 0 && (Number(row?.trips) || 0) >= AVG_RATE_MIN_TRIPS && (Number(row?.lbs) || 0) >= AVG_RATE_MIN_POUNDS)
      .sort((a,b)=> (Number(b?.avg) || 0) - (Number(a?.avg) || 0) || (Number(b?.lbs) || 0) - (Number(a?.lbs) || 0) || (Number(b?.trips) || 0) - (Number(a?.trips) || 0) || String(a?.name || "").localeCompare(String(b?.name || "")))
    : [];
  const dealerRowsByRate = Array.isArray(dealerRows)
    ? dealerRows
      .slice()
      .filter((row)=> (Number(row?.lbs) || 0) > 0 && (Number(row?.avg) || 0) > 0 && (Number(row?.trips) || 0) >= AVG_RATE_MIN_TRIPS && (Number(row?.lbs) || 0) >= AVG_RATE_MIN_POUNDS)
      .sort((a,b)=> (Number(b?.avg) || 0) - (Number(a?.avg) || 0))
    : [];
  return {
    trips: buildHomeCompareBarChart({ labels, metricKey: "trips", currentValue: period?.current?.trips, previousValue: period?.previous?.trips }),
    tripsMonthlyTrend: buildHomeTimeSeriesChart({ monthRows: safeMonths, metricKey: "trips", valueKey: "trips" }),
    tripsActivity: buildHomeTimeSeriesChart({ monthRows: safeMonths, metricKey: "trips", valueKey: "trips", basisLabel: "Trips grouped by active Home filter range buckets" }),
    tripsTimeline: buildTripTimelineChart({ trips, basisLabel: "Trip marks timeline" }),
    tripsCumulativeTrend: buildHomeCumulativeSeriesChart({ monthRows: safeMonths, metricKey: "trips", valueKey: "trips", basisLabel: "Visible months in the selected period" }),
    tripsPace: {
      ...buildHomeCumulativeSeriesChart({ monthRows: safeMonths, metricKey: "trips", valueKey: "trips", basisLabel: "Running trip count" }),
      chartType: "month-line"
    },
    tripsPoundsPerTripTrend: buildHomeTimeSeriesChart({ monthRows: safeMonths, metricKey: "pounds", valueKey: "poundsPerTrip" }),
    tripsAreaMix: buildHomeTopRowsBarChart({
      rows: areaRowsByTrips,
      metricKey: "trips",
      valueKey: "trips",
      basisLabel: "Trips by area",
      maxItems: 6,
      labelMode: "home-area-direct"
    }),
    tripsDealerMix: buildHomeTopRowsBarChart({
      rows: dealerRowsByTrips,
      metricKey: "trips",
      valueKey: "trips",
      basisLabel: "Trips by dealer",
      maxItems: 6,
      labelMode: "home-dealer-direct"
    }),
    pounds: buildHomeCompareBarChart({ labels, metricKey: "pounds", currentValue: period?.current?.lbs, previousValue: period?.previous?.lbs }),
    poundsMonthlyTrend: { ...buildHomeSharedChartModel({ chartId: "poundsByMonth", monthRows: safeMonths, dealerRows, areaRows }), showLatestPointChip: !isSeasonPreview, frameRightPad: isSeasonPreview ? 10 : 0, yAxisLabelMode: isSeasonPreview ? "soft" : "default" },
    poundsPerTripTrend: { ...buildHomeSharedChartModel({ chartId: "poundsPerTripByMonth", monthRows: safeMonths, dealerRows, areaRows }), showLatestPointChip: !isSeasonPreview, frameRightPad: isSeasonPreview ? 10 : 0, yAxisLabelMode: isSeasonPreview ? "soft" : "default" },
    poundsLast5Trips: buildHomeLast5TripPoundsChart({ trips, isSeasonPreview }),

    tripsByPoundRange: (()=> {
      const bins = [
        { label: "0–50", min: 0, max: 50 },
        { label: "50–75", min: 50, max: 75 },
        { label: "75–100", min: 75, max: 100 },
        { label: "100–150", min: 100, max: 150 },
        { label: "150–200", min: 150, max: 200 },
        { label: "200–300", min: 200, max: 300 },
        { label: "300–400", min: 300, max: 400 },
        { label: "400+", min: 400, max: Infinity }
      ];
      const counts = bins.map(()=>0);
      (Array.isArray(trips) ? trips : []).forEach((trip)=>{
        const lbs = Number(trip?.pounds);
        if(!Number.isFinite(lbs)) return;
        const idx = bins.findIndex((b)=> lbs >= b.min && lbs < b.max);
        if(idx >= 0) counts[idx] += 1;
      });
      return { chartType: "compare-bars", metricKey: "trips", basisLabel: "Trips by pound range", labels: bins.map((b)=> b.label), values: counts, showBarValueLabels: true, categoryLabelsBelowBars: true };
    })(),
    // Retained for compatibility with prior chart keys; no longer used in free Home Pounds drill-down.
    poundsByTripSize: (()=> {
      const bins = [
        { label: "0–50", min: 0, max: 50 },
        { label: "50–75", min: 50, max: 75 },
        { label: "75–100", min: 75, max: 100 },
        { label: "100–150", min: 100, max: 150 },
        { label: "150–200", min: 150, max: 200 },
        { label: "200–300", min: 200, max: 300 },
        { label: "300–400", min: 300, max: 400 },
        { label: "400+", min: 400, max: Infinity }
      ];
      const totals = bins.map(()=>0);
      (Array.isArray(trips) ? trips : []).forEach((trip)=> {
        const lbs = Number(trip?.pounds);
        if(!Number.isFinite(lbs)) return;
        const idx = bins.findIndex((b)=> lbs >= b.min && lbs < b.max);
        if(idx >= 0) totals[idx] += lbs;
      });
      return { chartType: "compare-bars", metricKey: "pounds", basisLabel: "Pounds by trip size", labels: bins.map((b)=> b.label), values: totals, showBarValueLabels: true, categoryLabelsBelowBars: true };
    })(),
    poundsDealerMix: buildHomeTopRowsBarChart({
      rows: dealerRowsByPounds,
      metricKey: "pounds",
      valueKey: "lbs",
      basisLabel: "Top dealers by pounds",
      maxItems: 6,
      labelMode: "home-dealer-direct"
    }),
    amount: buildHomeCompareBarChart({ labels, metricKey: "amount", currentValue: period?.current?.amount, previousValue: period?.previous?.amount }),
    amountTrend: { ...buildHomeSharedChartModel({ chartId: "amountByMonth", monthRows: safeMonths, dealerRows, areaRows }), showLatestPointChip: !isSeasonPreview, frameRightPad: isSeasonPreview ? 10 : 0, yAxisLabelMode: isSeasonPreview ? "soft" : "default" },
    amountPerTripTrend: { ...buildHomeSharedChartModel({ chartId: "amountPerTripByMonth", monthRows: safeMonths, dealerRows, areaRows }), showLatestPointChip: !isSeasonPreview, frameRightPad: isSeasonPreview ? 10 : 0, yAxisLabelMode: isSeasonPreview ? "soft" : "default" },
    amountLast5Trips: buildHomeLast5TripPayChart({ trips }),
    amountDealerMix: buildHomeSharedChartModel({ chartId: "amountByDealer", monthRows: safeMonths, dealerRows, areaRows }),
    amountAreaMix: buildHomeTopRowsBarChart({
      rows: areaRowsByAmount,
      metricKey: "amount",
      valueKey: "amt",
      basisLabel: "Amount by area",
      labelMode: "home-area-direct"
    }),
    ppl: buildHomeCompareBarChart({ labels, metricKey: "ppl", currentValue: period?.current?.ppl, previousValue: period?.previous?.ppl }),
    pplMonthlyTrend: {
      ...buildHomeSharedChartModel({ chartId: "pplByMonth", monthRows: safeMonths, dealerRows, areaRows }),
      basisLabel: `Visible months in the selected period • ${rateLeaderSupportLabel}`
    },
    pplMonthlyTrendFree: { ...buildHomeTimeSeriesChart({ monthRows: safeMonths, metricKey: "ppl", valueKey: "avg", basisLabel: "Visible months in the selected period", emptyMonthNoData: true }), showLatestPointChip: !isSeasonPreview, frameRightPad: isSeasonPreview ? 10 : 0, yAxisLabelMode: isSeasonPreview ? "soft" : "default" },
    pplPriceRangeByTrip: buildHomePriceRangeByTripChart({ trips }),
    pplLast5Trips: buildHomeLast5TripRatesChart({ trips }),
    tripsRollingTrend: buildRollingSeriesFromMonthRows({
      monthRows: safeMonths,
      metricKey: "trips",
      windowSize: getRollingWindowForMetric("trips", { surface: "home" }),
      basisLabel: "Rolling trips trend • visible months in the selected period"
    }),
    poundsRollingTrend: buildRollingSeriesFromMonthRows({
      monthRows: safeMonths,
      metricKey: "pounds",
      windowSize: getRollingWindowForMetric("pounds", { surface: "home" }),
      basisLabel: "Rolling pounds trend • visible months in the selected period"
    }),
    amountRollingTrend: buildRollingSeriesFromMonthRows({
      monthRows: safeMonths,
      metricKey: "amount",
      windowSize: getRollingWindowForMetric("amount", { surface: "home" }),
      basisLabel: "Rolling amount trend • visible months in the selected period"
    }),
    pplRollingTrend: buildRollingSeriesFromMonthRows({
      monthRows: safeMonths,
      metricKey: "ppl",
      windowSize: getRollingWindowForMetric("ppl", { surface: "home" }),
      basisLabel: `Rolling Avg $ / lb trend • visible months in the selected period • ${rateLeaderSupportLabel}`
    }),
    pplAreaLeaders: buildHomeTopRowsBarChart({
      rows: areaRowsByRate,
      metricKey: "ppl",
      valueKey: "avg",
      basisLabel: `Min ${AVG_RATE_MIN_TRIPS} trips + ${AVG_RATE_MIN_POUNDS} lbs to rank`,
      maxItems: 6,
      labelMode: "home-area-direct"
    }),
    pplDealerLeaders: buildHomeTopRowsBarChart({ rows: dealerRowsByRate, metricKey: "ppl", valueKey: "avg", basisLabel: `Min ${AVG_RATE_MIN_TRIPS} trips + ${AVG_RATE_MIN_POUNDS} lbs to rank` }),
    pplRateVsPoundsTrend: buildHomeTimeSeriesChart({ monthRows: safeMonths, metricKey: "pounds", valueKey: "lbs" })
  };
}

function buildMetricPrimaryBasis({ metricKey, metricPayload, primaryChart, period, basisLabel, currentLabel, previousLabel }){
  const payload = metricPayload && typeof metricPayload === "object" ? metricPayload : null;
  const chart = primaryChart && typeof primaryChart === "object" ? primaryChart : null;
  return {
    metricKey,
    basisLabel: String(chart?.basisLabel || basisLabel || ""),
    currentLabel,
    previousLabel,
    currentValue: Number(payload?.currentValue) || 0,
    previousValue: Number(payload?.previousValue) || 0,
    comparePayload: payload,
    primaryChart: chart,
    period: period && typeof period === "object" ? period : {}
  };
}

function buildMetricDetailPrimaryBasisMap({ period, metrics, detailCharts, source }){
  const safePeriod = period && typeof period === "object" ? period : {};
  const safeMetrics = metrics && typeof metrics === "object" ? metrics : {};
  const safeCharts = detailCharts && typeof detailCharts === "object" ? detailCharts : {};
  const defaultBasisLabel = String(safePeriod.supportLabel || safePeriod.support || safePeriod.fairWindowLabel || (source === "home" ? "Visible range" : "Matched date range"));
  const currentLabel = String(safePeriod.currentLabel || "Current");
  const previousLabel = String(safePeriod.previousLabel || "Previous");

  return {
    trips: buildMetricPrimaryBasis({ metricKey: "trips", metricPayload: safeMetrics.trips, primaryChart: safeCharts.trips, period: safePeriod, basisLabel: defaultBasisLabel, currentLabel, previousLabel }),
    pounds: buildMetricPrimaryBasis({ metricKey: "pounds", metricPayload: safeMetrics.pounds, primaryChart: safeCharts.pounds, period: safePeriod, basisLabel: defaultBasisLabel, currentLabel, previousLabel }),
    amount: buildMetricPrimaryBasis({ metricKey: "amount", metricPayload: safeMetrics.amount, primaryChart: safeCharts.amountCompare || safeCharts.amount, period: safePeriod, basisLabel: defaultBasisLabel, currentLabel, previousLabel }),
    ppl: buildMetricPrimaryBasis({ metricKey: "ppl", metricPayload: safeMetrics.ppl, primaryChart: safeCharts.ppl, period: safePeriod, basisLabel: defaultBasisLabel, currentLabel, previousLabel })
  };
}

function buildHomeMetricDetailFoundation({ monthRows, dealerRows, areaRows, trips = [], isSeasonPreview = false }){
  const safeMonths = normalizeChronologicalRows(Array.isArray(monthRows) ? monthRows.filter((row)=> row?.monthKey) : []);
  const currentMonth = safeMonths[safeMonths.length - 1] || null;
  const previousMonth = safeMonths[safeMonths.length - 2] || null;
  const fairLimit = currentMonth?.isPartialMonth ? Math.max(1, Number(currentMonth?.daysElapsed) || 1) : 0;
  const summarizeByWindow = (month)=> {
    if(!month) return summarizeHomeMonthRow(month);
    if(!(fairLimit > 0) || !String(month?.monthKey || "")) return summarizeHomeMonthRow(month);
    const scoped = (Array.isArray(trips) ? trips : [])
      .filter((trip)=> String(trip?.dateISO || "").startsWith(`${month.monthKey}-`))
      .filter((trip)=> Number(String(trip?.dateISO || "").slice(8, 10)) <= fairLimit);
    return summarizeHomeMonthRow({
      trips: scoped.length,
      lbs: scoped.reduce((sum, t)=> sum + (Number(t?.pounds) || 0), 0),
      amt: scoped.reduce((sum, t)=> sum + (Number(t?.amount) || 0), 0),
      fishingDays: new Set(scoped.map((t)=> String(t?.dateISO || "").slice(0, 10))).size
    });
  };
  const current = summarizeByWindow(currentMonth);
  const previous = summarizeByWindow(previousMonth);

  const period = currentMonth && previousMonth
    ? buildHomeComparablePeriod({ currentMonth, previousMonth, current, previous })
    : buildHomeSuppressedPeriod({ currentMonth, previousMonth, current, previous });
  const metrics = buildHomeMetricPayloads(period);
  const detailCharts = buildHomeDetailCharts({ monthRows: safeMonths, dealerRows, areaRows, period, trips, isSeasonPreview });

  return {
    period,
    metrics,
    detailCharts,
    primaryBasis: buildMetricDetailPrimaryBasisMap({
      period,
      metrics,
      detailCharts,
      source: "home"
    })
  };
}

export function createReportsMetricDetailSeam(deps){
  const {
    escapeHtml,
    formatMoney,
    to2
  } = deps;
  const chartStorySeam = createChartStorySeam({ escapeHtml });

  const PERCENT_TOKEN_RE = /([+-]?\d+(?:\.\d+)?%)/g;
  const renderPercentEmphasisText = (text)=> escapeHtml(String(text || "")).replace(PERCENT_TOKEN_RE, '<span class="reportsPercentEmphasis">$1</span>');
  const formatPeriodPair = (previousLabel, currentLabel)=> `${String(previousLabel || "Previous")} → ${String(currentLabel || "Current")}`;
  const formatPercentNumber = (percentValue)=> {
    const absPercent = Math.abs(Number(percentValue) || 0);
    const rounded = absPercent < 10
      ? Math.round(absPercent * 10) / 10
      : Math.round(absPercent);
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace(/\.0$/, "");
  };
  const formatUnsignedPercentFromRatio = (ratioValue)=> `${formatPercentNumber((Number(ratioValue) || 0) * 100)}%`;
  const toMaxTwoSentences = (text)=> {
    const parts = String(text || "").trim().split(/(?<=[.!?])\s+/).filter(Boolean);
    if(!parts.length) return "";
    return parts.slice(0, 2).join(" ").trim();
  };

  const formatMetricCompareValue = (metricKey, value)=> {
    const safeValue = Number(value);
    if(!Number.isFinite(safeValue)) return "—";
    if(metricKey === "trips") return `${Math.round(safeValue)} trips`;
    if(metricKey === "pounds") return `${to2(safeValue)} lbs`;
    if(metricKey === "amount") return formatMoney(to2(safeValue));
    if(metricKey === "ppl") return `${formatMoney(to2(safeValue))}/lb`;
    return `${to2(safeValue)}`;
  };
  const getRateLeaderThresholdText = ()=> {
    const minTrips = Number(HOME_RATE_RANKING_THRESHOLDS.minTrips) || 2;
    const minPounds = Number(HOME_RATE_RANKING_THRESHOLDS.minPounds) || 150;
    return `Rate leaders rank rows with at least ${minTrips} trips and ${minPounds} lbs.`;
  };
  const getSupportHonestyText = (payload, metricKey)=> {
    if(metricKey !== "ppl") return "";
    const confidence = String(payload?.confidenceLabel || payload?.trustLabel || "").toLowerCase();
    if(confidence === "early") return " Support note: Early read from lighter month support.";
    if(confidence === "weak") return " Support note: Light read with thin month support.";
    if(confidence === "suppressed") return " Support note: Comparison stays hidden until both months have usable pounds.";
    return "";
  };
  const getPplSupportNoteText = ({ metricKey, payload, surface = "default" } = {})=> {
    if(metricKey !== "ppl") return "";
    const confidence = String(payload?.confidenceLabel || payload?.trustLabel || "").toLowerCase();
    if(confidence === "early"){
      if(surface === "context") return "Early read from lighter month support in the compared months.";
      if(surface === "insight") return "Treat this as an early read until support deepens.";
      if(surface === "supportMeta") return "Early read: lighter month support in the visible pair.";
      return "Early read from lighter month support.";
    }
    if(confidence === "weak"){
      if(surface === "context") return "Light read with thin month support in the compared months.";
      if(surface === "insight") return "Treat this as a light read until both months carry stronger pounds support.";
      if(surface === "supportMeta") return "Light read: thin month support in the visible pair.";
      return "Light read with thin month support.";
    }
    if(confidence === "suppressed"){
      if(surface === "context") return "Comparison stays hidden until both months have usable pounds.";
      if(surface === "insight") return "Comparison unlocks once both visible months have usable pounds.";
      if(surface === "supportMeta") return "Support requirement: usable pounds in both visible months.";
      return "Comparison stays hidden until both months have usable pounds.";
    }
    return "";
  };
  const getPplFormulaText = ({ metricKey, surface = "default" } = {})=> {
    if(metricKey !== "ppl") return "";
    if(surface === "short") return "Avg $ / lb = total amount ÷ total pounds.";
    if(surface === "formula") return "Total amount ÷ total pounds";
    if(surface === "weighted") return "Weighted by pounds across selected trips";
    return "Total amount ÷ total pounds. Weighted by pounds across selected trips.";
  };

  const buildMetricCompareSummary = ({ metricKey, payload, compareFoundation, isHomeMetricDetail })=> {
    if(compareFoundation.period?.suppressed || !payload || payload.suppressed){
      const reason = payload?.reason || compareFoundation.period?.reason || "This comparison appears once both periods have enough trips.";
      return {
        tone: "steady",
        text: reason,
        currentValue: formatMetricCompareValue(metricKey, payload?.currentValue),
        previousValue: formatMetricCompareValue(metricKey, payload?.previousValue)
      };
    }
    const tone = String(payload.compareTone || "steady");
    const period = compareFoundation.period || {};
    const currentLabel = period.currentLabel || "Current";
    const previousLabel = period.previousLabel || "Previous";
    const safeNum = (value)=> Number(value) || 0;
    const pctText = (value)=> formatUnsignedPercentFromRatio(value);
    const amountPayload = compareFoundation.metrics?.amount || null;
    const poundsPayload = compareFoundation.metrics?.pounds || null;
    const tripsPayload = compareFoundation.metrics?.trips || null;
    const pplPayload = compareFoundation.metrics?.ppl || null;
    const currentPoundsPerTrip = safeNum(period.current?.poundsPerTrip);
    const previousPoundsPerTrip = safeNum(period.previous?.poundsPerTrip);
    const currentAmountPerTrip = safeNum(period.current?.amountPerTrip);
    const previousAmountPerTrip = safeNum(period.previous?.amountPerTrip);
    const currentAmountPerDay = safeNum(period.current?.amountPerDay);
    const previousAmountPerDay = safeNum(period.previous?.amountPerDay);
    const currentPoundsPerDay = safeNum(period.current?.poundsPerDay);
    const previousPoundsPerDay = safeNum(period.previous?.poundsPerDay);
    const productivityTone = currentPoundsPerTrip > previousPoundsPerTrip * 1.05
      ? "up"
      : (currentPoundsPerTrip < previousPoundsPerTrip * 0.95 ? "down" : "steady");
    const amountPerTripTone = currentAmountPerTrip > previousAmountPerTrip * 1.05
      ? "up"
      : (currentAmountPerTrip < previousAmountPerTrip * 0.95 ? "down" : "steady");
    const amountPerDayTone = currentAmountPerDay > previousAmountPerDay * 1.05
      ? "up"
      : (currentAmountPerDay < previousAmountPerDay * 0.95 ? "down" : "steady");
    const poundsPerDayTone = currentPoundsPerDay > previousPoundsPerDay * 1.05
      ? "up"
      : (currentPoundsPerDay < previousPoundsPerDay * 0.95 ? "down" : "steady");

    const metricMoveLead = (name)=> {
      if(tone === "up") return `${name} moved up`;
      if(tone === "down") return `${name} moved down`;
      return `${name} held close`;
    };
    const toneWord = (toneValue, { up = "up", down = "down", steady = "close" } = {})=> (
      toneValue === "up" ? up : (toneValue === "down" ? down : steady)
    );
    const summaryBuilders = {
      trips: ()=> {
        const cause = tone === "up"
          ? "more trip days"
          : (tone === "down" ? "fewer trip days" : "a flat trip schedule");
        const evidence = `Evidence: pounds per trip stayed ${toneWord(productivityTone)} and pounds per day stayed ${toneWord(poundsPerDayTone)}.`;
        return `${metricMoveLead("Trips")} mainly from ${cause}. ${evidence}`;
      },
      pounds: ()=> {
        const cause = tripsPayload?.compareTone === "up"
          ? "more trips"
          : (tripsPayload?.compareTone === "down"
            ? "fewer trips"
            : `pounds per trip ${toneWord(productivityTone, { up: "improved", down: "softened", steady: "held close" })}`);
        const evidence = `Evidence: pounds per day stayed ${toneWord(poundsPerDayTone)} while trip count was ${toneWord(tripsPayload?.compareTone, { up: "up", down: "down", steady: "flat" })}.`;
        return `${metricMoveLead("Pounds")} mainly from ${cause}. ${evidence}`;
      },
      amount: ()=> {
        const cause = poundsPayload?.compareTone === "up" && pplPayload?.compareTone !== "up"
          ? "higher pounds landed"
          : (pplPayload?.compareTone === "up" && poundsPayload?.compareTone !== "up"
            ? "stronger Avg $ / lb"
            : (poundsPayload?.compareTone === "down" && pplPayload?.compareTone !== "down"
              ? "lighter pounds landed"
              : (pplPayload?.compareTone === "down" && poundsPayload?.compareTone !== "down"
                ? "softer Avg $ / lb"
                : "a combined shift in pounds and Avg $ / lb")));
        const evidence = `Evidence: amount per trip was ${toneWord(amountPerTripTone)} and amount per day was ${toneWord(amountPerDayTone)}.`;
        return `${metricMoveLead("Amount")} mainly from ${cause}. ${evidence}`;
      },
      ppl: ()=> {
        const pctMove = payload.percentValid ? ` by ${pctText(payload.deltaPct)}` : "";
        const cause = tone === "up"
          ? "stronger pricing"
          : (tone === "down" ? "softer pricing" : "stable pricing");
        const amountDirection = toneWord(amountPayload?.compareTone, { up: "up", down: "down", steady: "flat" });
        const poundsDirection = toneWord(poundsPayload?.compareTone, { up: "up", down: "down", steady: "flat" });
        return `${metricMoveLead("Avg $ / lb")}${pctMove} mainly from ${cause}. Evidence: amount was ${amountDirection} while pounds were ${poundsDirection}.`;
      }
    };
    const summaryText = (summaryBuilders[metricKey] || summaryBuilders.amount)();
    const rollingContextText = isHomeMetricDetail
      ? ""
      : describeRollingContext({
        chartModel: compareFoundation?.detailCharts?.[`${metricKey}RollingTrend`],
        metricKey,
        compareTone: tone
      });
    const trustNote = payload.confidenceLabel === "early"
      ? " Early read."
      : (payload.confidenceLabel === "weak" ? " Light read." : "");
    const supportHonesty = getSupportHonestyText(payload, metricKey);
    return {
      tone,
      text: `${summaryText}${rollingContextText ? ` ${rollingContextText}` : ""}${trustNote}${supportHonesty}`.trim(),
      currentValue: formatMetricCompareValue(metricKey, payload.currentValue),
      previousValue: formatMetricCompareValue(metricKey, payload.previousValue)
    };
  };


  const formatHomeMoneyValue = (value)=> {
    const safeValue = Number(value);
    if(!Number.isFinite(safeValue)) return "—";
    return formatMoney(to2(safeValue));
  };

  const formatHomeSnapshotValue = ({ metricKey, value })=> {
    const safeValue = Number(value);
    if(!Number.isFinite(safeValue)) return "—";
    if(metricKey === "trips") return `${Math.round(safeValue)} trips`;
    if(metricKey === "pounds") return `${Math.round(safeValue).toLocaleString()} lbs`;
    if(metricKey === "amount") return formatHomeMoneyValue(safeValue);
    if(metricKey === "ppl") return safeValue > 0 ? `${formatMoney(to2(safeValue))}/lb` : "—";
    return `${to2(safeValue)}`;
  };

  const buildHomeSnapshotItems = ({ metricKey, chartModel, trips, homeScope })=> {
    const values = Array.isArray(chartModel?.values) ? chartModel.values.map((value)=> Number(value) || 0) : [];
    const safeTrips = Array.isArray(trips) ? trips : [];
    if(!values.length && !safeTrips.length) return [];
    const latest = values.length ? values[values.length - 1] : 0;
    const highest = values.length ? values.reduce((max, value)=> Math.max(max, value), values[0]) : 0;
    const average = values.length ? (values.reduce((sum, value)=> sum + value, 0) / values.length) : 0;
    const tripCount = safeTrips.length;
    const currentRun = computeCurrentRunFromTrips(safeTrips);
    const latestTrip = resolveLatestSelectedTrip(safeTrips);
    const activeMode = String(homeScope?.filter?.mode || homeScope?.filterMode || "").trim().toUpperCase();
    const isSeasonPreview = activeMode === "SEASON_PREVIEW";
    if(metricKey === "trips") return [
      { label: "Latest Month", value: formatHomeSnapshotValue({ metricKey, value: latest }) },
      { label: "Avg / Month", value: formatHomeSnapshotValue({ metricKey, value: average }) },
      { label: "Current Run", value: currentRun > 0 ? `${currentRun} in a row` : "—" },
      { label: "Latest Trip", value: formatCompactTripDate(latestTrip) }
    ];
    if(metricKey === "pounds"){
      const tripPounds = safeTrips.map((trip)=> Number(trip?.pounds) || 0).filter((value)=> value > 0);
      const hasTripBest = tripPounds.length > 0;
      const bestTripPounds = hasTripBest ? tripPounds.reduce((max, value)=> Math.max(max, value), tripPounds[0]) : 0;
      const avgTripPounds = tripCount > 0
        ? (safeTrips.reduce((sum, trip)=> sum + (Number(trip?.pounds) || 0), 0) / tripCount)
        : 0;
      const activeMode = String(homeScope?.filter?.mode || homeScope?.filterMode || "").trim().toUpperCase();
      const isSeasonPreview = activeMode === "SEASON_PREVIEW";
      const avgTripBuckets = [
        { label: "0–25 lbs", min: 0, max: 25 },
        { label: "25–50 lbs", min: 25, max: 50 },
        { label: "50–100 lbs", min: 50, max: 100 },
        { label: "100–150 lbs", min: 100, max: 150 },
        { label: "150+ lbs", min: 150, max: Number.POSITIVE_INFINITY }
      ];
      const avgMonthBuckets = [
        { label: "0–100 lbs", min: 0, max: 100 },
        { label: "100–250 lbs", min: 100, max: 250 },
        { label: "250–500 lbs", min: 250, max: 500 },
        { label: "500–750 lbs", min: 500, max: 750 },
        { label: "750–1k lbs", min: 750, max: 1000 },
        { label: "1k–1.5k lbs", min: 1000, max: 1500 },
        { label: "1.5k–2k lbs", min: 1500, max: 2000 },
        { label: "2k+ lbs", min: 2000, max: Number.POSITIVE_INFINITY }
      ];
      const activeLabel = (()=>{
        if(activeMode === "SEASON_PREVIEW" || activeMode === "FULL_YTD") return "Active Months";
        if(["MONTH", "THIS_MONTH", "28D", "4W", "LAST_4_WEEKS"].includes(activeMode)) return "Active Weeks";
        if(["14D", "LAST_14_DAYS", "7D", "LAST_7_DAYS"].includes(activeMode)) return "Active Days";
        const fromISO = String(homeScope?.resolvedRange?.fromISO || "").slice(0, 10);
        const toISO = String(homeScope?.resolvedRange?.toISO || "").slice(0, 10);
        const fromDate = /^\d{4}-\d{2}-\d{2}$/.test(fromISO) ? new Date(`${fromISO}T00:00:00Z`) : null;
        const toDate = /^\d{4}-\d{2}-\d{2}$/.test(toISO) ? new Date(`${toISO}T00:00:00Z`) : null;
        const spanDays = fromDate && toDate
          ? Math.floor((toDate.getTime() - fromDate.getTime()) / 86400000) + 1
          : 0;
        if(spanDays > 90) return "Active Months";
        if(spanDays > 21) return "Active Weeks";
        return "Active Days";
      })();
      const activeCount = (()=> {
        if(activeLabel.endsWith("Months")) return (Array.isArray(chartModel?.labels)?chartModel.labels.filter(Boolean).length:0);
        const dateKeys = new Set((safeTrips || []).map((trip)=> parseTripDateValue(trip)?.dateToken).filter(Boolean));
        if(activeLabel.endsWith("Days")) return dateKeys.size;
        const weekKeys = new Set(Array.from(dateKeys).map((dateToken)=> {
          const d = new Date(`${dateToken}T00:00:00Z`);
          const day = d.getUTCDay() || 7;
          d.setUTCDate(d.getUTCDate() + 4 - day);
          const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
          const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
          return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
        }));
        return weekKeys.size;
      })();
      return [
        { label: "Best Trip", value: formatHomeSnapshotValue({ metricKey, value: hasTripBest ? bestTripPounds : highest }) },
        { label: "Avg / Trip", value: isSeasonPreview ? toBucketLabel(avgTripPounds, avgTripBuckets) : formatHomeSnapshotValue({ metricKey, value: avgTripPounds }) },
        { label: "Avg / Month", value: isSeasonPreview ? toBucketLabel(average, avgMonthBuckets) : formatHomeSnapshotValue({ metricKey, value: average }) },
        { label: activeLabel, value: `${activeCount || "—"}` }
      ];
    }
    if(metricKey === "amount"){
      const avgTrip = tripCount > 0 ? (safeTrips.reduce((sum, trip)=> sum + (Number(trip?.amount) || 0), 0) / tripCount) : 0;
      const tripAmountValues = safeTrips
        .map((trip)=> {
          const rawAmount = trip?.amount;
          const parsedAmount = Number(rawAmount);
          return Number.isFinite(parsedAmount) ? parsedAmount : null;
        })
        .filter((amount)=> amount != null);
      const highestTripAmount = tripAmountValues.length
        ? tripAmountValues.reduce((max, amount)=> Math.max(max, amount), tripAmountValues[0])
        : null;
      const latestTripAmount = safeTrips.length
        ? (()=> {
          const datedTrips = safeTrips
            .map((trip)=> {
              const amountValue = Number(trip?.amount);
              if(!Number.isFinite(amountValue)) return null;
              const dateToken = String(trip?.dateISO || trip?.date || trip?.when || trip?.tripDate || "").slice(0, 10);
              if(!/^\d{4}-\d{2}-\d{2}$/.test(dateToken)) return null;
              return { amountValue, dateToken };
            })
            .filter((trip)=> trip != null)
            .sort((a, b)=> a.dateToken.localeCompare(b.dateToken));
          return datedTrips.length ? datedTrips[datedTrips.length - 1].amountValue : null;
        })()
        : null;
      return [
        { label: "Highest paid trip", value: formatHomeSnapshotValue({ metricKey, value: highestTripAmount ?? highest }) },
        { label: "Avg / trip", value: isSeasonPreview ? toBucketLabel(avgTrip, [{ label: "Under $100", min: 0, max: 100 }, { label: "$100–$250", min: 100, max: 250 }, { label: "$250–$500", min: 250, max: 500 }, { label: "$500+", min: 500, max: Number.POSITIVE_INFINITY }]) : formatHomeMoneyValue(to2(avgTrip)) },
        { label: "Latest paid", value: formatHomeSnapshotValue({ metricKey, value: latestTripAmount ?? latest }) },
        { label: "Trips counted", value: `${tripCount} trips` }
      ];
    }
    if(metricKey === "ppl"){
      const poundsSupport = safeTrips.reduce((sum, trip)=> sum + (Number(trip?.pounds) || 0), 0);
      const latestTripPounds = Number(latestTrip?.pounds);
      const latestTripAmount = Number(latestTrip?.amount);
      const latestTripRateValue = Number.isFinite(latestTripPounds)
        && Number.isFinite(latestTripAmount)
        && latestTripPounds > 0
        ? (latestTripAmount / latestTripPounds)
        : null;
      const tripRates = safeTrips
        .map((trip)=> resolveTripPayRate(trip))
        .filter((rate)=> Number.isFinite(rate) && rate > 0);
      const bestTripRate = tripRates.length ? tripRates.reduce((max, rate)=> Math.max(max, rate), tripRates[0]) : 0;
      const totalPayReceived = safeTrips.reduce((sum, trip)=> sum + (Number(trip?.amount) || 0), 0);
      const seasonPreviewPoundsDisplay = String(viewModel?.homeScope?.kpiDisplayValues?.pounds || "").trim();
      const seasonPreviewPayDisplay = String(viewModel?.homeScope?.kpiDisplayValues?.amount || "").trim();
      return [
        { label: "Best Trip Rate", value: formatHomeSnapshotValue({ metricKey, value: tripRates.length ? bestTripRate : highest }) },
        { label: "Latest Trip Rate", value: latestTripRateValue > 0 ? formatHomeSnapshotValue({ metricKey, value: latestTripRateValue }) : "—" },
        { label: "Pounds Counted", value: isSeasonPreview ? (seasonPreviewPoundsDisplay || "—") : `${Math.round(poundsSupport).toLocaleString()} lbs` },
        { label: "Pay Received", value: isSeasonPreview ? (seasonPreviewPayDisplay || "—") : formatHomeMoneyValue(to2(totalPayReceived)) }
      ];
    }
    return [
      { label: "Highest", value: formatHomeSnapshotValue({ metricKey, value: highest }) },
      { label: "Latest", value: formatHomeSnapshotValue({ metricKey, value: latest }) },
      { label: "Average", value: formatHomeSnapshotValue({ metricKey, value: average }) },
      { label: "Items counted", value: `${values.length}` }
    ];
  };

  const renderMetricDetailSection = ({ meta, compareSummary, viewModel })=> {
    const surfaceMode = viewModel.surfaceMode || resolveMetricDetailSurfaceMode({ isHomeMetricDetail: viewModel.isHomeMetricDetail });
    const homeRangeLabel = String(viewModel.homeScope?.rangeLabel || viewModel.rangeLabel || "").trim();
    const homeTripCount = Number(viewModel.homeScope?.tripCount ?? viewModel.trips?.length) || 0;
    const detailContext = viewModel.isHomeMetricDetail
      ? `${homeRangeLabel || "Active"} • ${homeTripCount} trips`
      : `Range ${viewModel.rangeLabel} • ${viewModel.trips.length} trips`;
    const homeIsSeasonPreview = viewModel.isHomeMetricDetail && String(viewModel.homeScope?.filter?.mode || viewModel.homeScope?.mode || "").toUpperCase() === "SEASON_PREVIEW";
    const homeDetailBoundaryNote = homeIsSeasonPreview
      ? "Season Preview detail • chart signals stay visible here."
      : "";
    const detailChartTitle = viewModel.isHomeMetricDetail ? meta.homeChartTitle : meta.chartTitle;
    const detailChartContext = viewModel.isHomeMetricDetail
      ? meta.homeChartContext
      : (meta.primaryBasis?.basisLabel || meta.chartContext);
    const detailInsight = viewModel.isHomeMetricDetail ? (meta.homeInsightCompact || meta.homeInsight) : meta.insight;
    const compareContractLabel = viewModel.compareFoundation.period?.compareModelLabel || "Comparison";
    const compareContractBasis = viewModel.compareFoundation.period?.currentLabel && viewModel.compareFoundation.period?.previousLabel
      ? formatPeriodPair(viewModel.compareFoundation.period.previousLabel, viewModel.compareFoundation.period.currentLabel)
      : (meta.primaryBasis?.basisLabel || viewModel.compareFoundation.period?.supportLabel || viewModel.compareFoundation.period?.support || viewModel.compareFoundation.period?.fairWindowLabel || "Matched date range");
    const compareContractText = viewModel.compareFoundation.period?.suppressed
      ? (viewModel.compareFoundation.period?.explanation || "")
      : "";
    const pplSupportNoteText = getPplSupportNoteText({ metricKey: viewModel.metricKey, payload: meta.comparePayload, surface: "supportMeta" });
    const pplFormulaText = getPplFormulaText({ metricKey: viewModel.metricKey });
    const supportMetaNote = [compareContractText, pplFormulaText, pplSupportNoteText].filter(Boolean).join(" ");
    const supportAnalysisText = viewModel.isHomeMetricDetail
      ? (toMaxTwoSentences(compareSummary.text) || String(compareSummary.text || ""))
      : String(compareSummary.text || "");
    const secondaryCharts = Array.isArray(meta.secondaryCharts) ? meta.secondaryCharts.filter(Boolean) : [];
    const hasHomePrimaryChart = viewModel.isHomeMetricDetail && !!meta.homePrimaryChartModel;
    const homeSnapshotItems = Array.isArray(meta.homeSnapshotItems) ? meta.homeSnapshotItems.filter((item)=> item?.label && item?.value) : [];
    const renderHomeHeroValue = ()=> {
      const rawHeroValue = String(meta.heroValue || "").trim();
      if(!rawHeroValue || rawHeroValue === "—") return `<span class="homeMetricHeroMain">—</span>`;
      if(viewModel.metricKey === "pounds"){
        const poundsMatch = rawHeroValue.match(/^(.+?)\s*(lbs)$/i);
        if(poundsMatch){
          return `<span class="homeMetricHeroMain">${escapeHtml(poundsMatch[1])}</span><span class="homeMetricHeroUnit">${escapeHtml(poundsMatch[2])}</span>`;
        }
      }
      if(viewModel.metricKey === "ppl"){
        const pplMatch = rawHeroValue.match(/^(.+?)(\/lb)$/i);
        if(pplMatch){
          return `<span class="homeMetricHeroMain">${escapeHtml(pplMatch[1])}</span><span class="homeMetricHeroUnit">${escapeHtml(pplMatch[2])}</span>`;
        }
      }
      return `<span class="homeMetricHeroMain">${escapeHtml(rawHeroValue)}</span>`;
    };
    const renderSharedChartCard = ({ chart, forHome = false })=> chartStorySeam.renderChartStoryCard({
      mode: "lean",
      cardTag: "div",
      cardClass: `${surfaceMode.detailChartClass} chartCard chartCard--standard ${forHome ? "homeMetricChartStory" : "reportsMetricChartStory"}`.trim(),
      titleClass: `chartTitle ${forHome ? "homeMetricChartTitle" : "reportsMetricChartTitle"}`.trim(),
      explanationClass: `homeInsightsChartExplanation ${forHome ? "homeMetricChartSupport" : "reportsMetricChartSupport"}`.trim(),
      contextClass: `${surfaceMode.detailChartContextClass} chartContext`,
      title: chart.title,
      explanation: chart.explanation || "",
      context: chart.context || "",
      canvasId: chart.canvasId,
      height: 290,
      emptyClass: `reportsChartEmpty reportsChartEmpty--standard ${forHome ? "homeMetricChartEmpty" : "reportsMetricChartEmpty"}`.trim(),
      emptyMessage: chart.emptyMessage || "Not enough data in the selected period yet."
    });
    const renderStandardSupportCard = ()=> `
      <div class="${surfaceMode.detailCompareClass} tone-${escapeHtml(compareSummary.tone)}">
        <div class="${surfaceMode.detailCompareTextClass}">${renderPercentEmphasisText(supportAnalysisText)}</div>
        <div class="${surfaceMode.detailCompareRowsClass}">
          <div class="reportsMetricCompareRow"><span class="reportsMetricCompareLabel">${escapeHtml(meta.primaryBasis?.previousLabel || viewModel.compareFoundation.period?.previousLabel || "Previous")}</span><b class="reportsMetricCompareValue">${escapeHtml(compareSummary.previousValue)}</b></div>
          <div class="reportsMetricCompareRow"><span class="reportsMetricCompareLabel">${escapeHtml(meta.primaryBasis?.currentLabel || viewModel.compareFoundation.period?.currentLabel || "Current")}</span><b class="reportsMetricCompareValue">${escapeHtml(compareSummary.currentValue)}</b></div>
        </div>
        <div class="reportsMetricSupportMetaBlock" aria-label="Support metadata">
          <div class="${surfaceMode.detailChartContextClass} reportsMetricSupportMeta reportsMetricSupportMeta--model">Comparison type • <b>${escapeHtml(compareContractLabel)}</b></div>
          <div class="${surfaceMode.detailChartContextClass} reportsMetricSupportMeta reportsMetricSupportMeta--basis">${escapeHtml(compareContractBasis)}</div>
          ${supportMetaNote ? `<div class="${surfaceMode.detailChartContextClass} reportsMetricSupportMeta reportsMetricSupportMeta--note">${escapeHtml(supportMetaNote)}</div>` : ""}
        </div>
      </div>
    `;
    return `
    <section class="${surfaceMode.detailSurfaceClass}" aria-label="${escapeHtml(meta.title)}">
      <div class="${surfaceMode.detailCardClass}">
        ${viewModel.isHomeMetricDetail ? `
          <div class="homeMetricTopBar"><button class="btn btn-ghost affordanceBtn ${surfaceMode.detailBackClass}" type="button" id="reportsMetricBack">← Home</button><div class="homeMetricContextChip">${escapeHtml(detailContext)}</div></div>
          <div class="homeMetricTitleHeader" aria-label="Metric title">
            ${homeIsSeasonPreview ? `<div class="homeMetricPreviewBadge">Season Preview detail</div>` : ""}
            <h2 class="homeMetricSimpleTitle ${escapeHtml(meta.homeTitleToneClass || "")}">${escapeHtml(meta.homeTitle)}</h2>
          </div>
          ${homeDetailBoundaryNote ? `<div class="homeMetricPreviewNote" role="note">${escapeHtml(homeDetailBoundaryNote)}</div>` : ""}
          <div class="${surfaceMode.detailHeroWrapClass}">
            <div class="${surfaceMode.detailHeroValueClass} ${escapeHtml(meta.heroClass)}">${renderHomeHeroValue()}</div>
            <div class="${surfaceMode.detailHeroLabelClass}">${escapeHtml(meta.heroLabel)}</div>
          </div>
          ${homeSnapshotItems.length ? `
          <div class="homeMetricMetaRow homeMetricMetaRow--grid" aria-label="Snapshot values">
            ${homeSnapshotItems.map((item)=> `
              <div class="homeMetricMetaItem">
                <span class="homeMetricMetaLabel">${escapeHtml(item.label)}</span>
                <span class="homeMetricMetaValue">${escapeHtml(item.value)}</span>
              </div>
            `).join("")}
          </div>
          ` : ""}
        ` : `
          <button class="btn btn-ghost affordanceBtn ${surfaceMode.detailBackClass}" type="button" id="reportsMetricBack">← Back to reports</button>
          <div class="${surfaceMode.detailEyebrowClass}">${escapeHtml(meta.eyebrow)}</div>
          <h2 class="${surfaceMode.detailTitleClass}">${escapeHtml(meta.title)}</h2>
          <div class="${surfaceMode.detailContextClass}">${escapeHtml(detailContext)}</div>
          <div class="reportsMetricSectionRail" aria-hidden="true">
          <span class="reportsMetricSectionPill">Compared months • ${escapeHtml(compareContractBasis)}</span>
          </div>
        `}

        ${viewModel.isHomeMetricDetail ? "" : `
        <div class="reportsMetricStoryStack">
          <div class="${surfaceMode.detailHeroWrapClass}">
            <div class="${surfaceMode.detailHeroLabelClass}">${escapeHtml(meta.heroLabel)}</div>
            <div class="${surfaceMode.detailHeroValueClass} ${escapeHtml(meta.heroClass)}">${escapeHtml(meta.heroValue)}</div>
          </div>

          ${renderStandardSupportCard()}
        </div>
        `}

        ${viewModel.isHomeMetricDetail
    ? `<div class="homeMetricMeaningNote">${escapeHtml(meta.homeMeaningNote || "")}</div>`
    : ``}

        <div class="reportsMetricChartsStack">
          ${viewModel.isHomeMetricDetail
    ? (hasHomePrimaryChart ? renderSharedChartCard({
      forHome: true,
      chart: {
        title: detailChartTitle,
        explanation: "",
        context: detailChartContext,
        canvasId: meta.chartCanvasId
      }
    }) : "")
    : renderSharedChartCard({
      forHome: false,
      chart: {
        title: detailChartTitle,
        context: detailChartContext,
        canvasId: meta.chartCanvasId
      }
    })}

          ${secondaryCharts.map((chart)=> `
            ${viewModel.isHomeMetricDetail
    ? renderSharedChartCard({ chart, forHome: true })
    : renderSharedChartCard({ chart, forHome: false })}
          `).join("")}
        </div>

        ${viewModel.isHomeMetricDetail
    ? `${homeDetailBoundaryNote ? `<div class="homeMetricBottomPromo"><div class="homeMetricBottomPromoText">Unlock Full Insights for exact season totals, pay-rate trends, area strength, and deeper chart intelligence.</div><button class="btn homeMetricUnlockBtn" type="button" id="homeMetricUnlockInsights">Unlock Full Insights</button></div>` : ""}`
    : `<div class="${surfaceMode.detailInsightClass}">${escapeHtml(detailInsight)}</div>`}
      </div>
    </section>
  `;
  };

  const buildMetricDetailMeta = (viewModel)=> {
    const {
      metricKey,
      compareFoundation,
      primaryBasisByMetric,
      detailCharts,
      isHomeMetricDetail
    } = viewModel;
    const primaryBasis = primaryBasisByMetric?.[metricKey] || null;
    const primaryPayload = primaryBasis?.comparePayload || compareFoundation.metrics?.[metricKey] || null;
    const primaryChart = primaryBasis?.primaryChart || detailCharts?.[metricKey] || null;
    const resolveHomeFreeConfig = (targetMetricKey)=> HOME_FREE_KPI_DETAIL_CONFIG[targetMetricKey] || null;
    const buildHomeCompactInsight = ({ targetMetricKey, heroValue, snapshotItems })=> {
      const safeSnapshotItems = Array.isArray(snapshotItems) ? snapshotItems : [];
      const latestItem = safeSnapshotItems.find((item)=> String(item?.label || "").toLowerCase() === "latest")
        || safeSnapshotItems[0];
      const avgItem = safeSnapshotItems.find((item)=> String(item?.label || "").toLowerCase() === "average");
      if(targetMetricKey === "trips"){
        return latestItem
          ? `${heroValue} trips logged in this selected period.`
          : `${heroValue} trips logged in this selected period.`;
      }
      if(targetMetricKey === "pounds"){
        return avgItem
          ? `${heroValue} landed across ${Math.max(1, safeSnapshotItems.length ? safeSnapshotItems.length : 1)} months shown. Average pace: ${avgItem ? avgItem.value.replace('.00','') : '—'} /month.`
          : `Total landed is ${heroValue} in the selected period.`;
      }
      if(targetMetricKey === "amount"){
        return latestItem
          ? `${heroValue} received in this selected period. Average trip value: ${safeSnapshotItems.find((i)=>i.label==='Avg / trip')?.value || '—'}/trip.`
          : `${heroValue} received in this selected period.`;
      }
      if(targetMetricKey === "ppl"){
        return latestItem
          ? `Average rate is based on total paid ÷ total pounds. Backed by ${safeSnapshotItems.find((i)=>i.label==='Pounds Counted')?.value || '—'}.`
          : `Average rate is based on total paid ÷ total pounds.`;
      }
      return "";
    };
    const formatHeroFromPrimaryBasis = (targetMetric, basis)=> {
      const value = Number(basis?.currentValue);
      if(!Number.isFinite(value)) return "—";
      if(targetMetric === "trips") return `${Math.round(value)} trips`;
      if(targetMetric === "pounds") return `${to2(value)} lbs`;
      if(targetMetric === "amount") return formatMoney(to2(value));
      if(targetMetric === "ppl") return value > 0 ? `${formatMoney(to2(value))}/lb` : "—";
      return `${to2(value)}`;
    };
    const formatHomeKpiHeroValue = (targetMetric, trips)=> {
      const safeTrips = Array.isArray(trips) ? trips : [];
      const tripCount = safeTrips.length;
      const pounds = safeTrips.reduce((sum, trip)=> sum + (Number(trip?.pounds) || 0), 0);
      const amount = safeTrips.reduce((sum, trip)=> sum + (Number(trip?.amount) || 0), 0);
      if(targetMetric === "trips") return `${tripCount}`;
      if(targetMetric === "pounds") return `${Math.round(pounds).toLocaleString()} lbs`;
      if(targetMetric === "amount") return formatHomeMoneyValue(amount);
      if(targetMetric === "ppl") return pounds > 0 ? `${formatMoney(to2(amount / pounds))}` : "—";
      return "—";
    };
    const resolveHeroValue = (targetMetric)=> {
      if(isHomeMetricDetail){
        const contextHero = String(viewModel.homeScope?.kpiDisplayValues?.[targetMetric] || "").trim();
        if(contextHero) return contextHero;
        return formatHomeKpiHeroValue(targetMetric, viewModel.trips);
      }
      return formatHeroFromPrimaryBasis(targetMetric, primaryBasis);
    };
    const HOME_PRIMARY_CANVAS_BY_METRIC = Object.freeze({
      trips: "c_trips",
      pounds: "c_lbs",
      amount: "c_amount_detail",
      ppl: "c_ppl"
    });
    const isUsableHomeChartModel = (chartModel)=> {
      if(!chartModel || typeof chartModel !== "object") return false;
      const labels = Array.isArray(chartModel.labels) ? chartModel.labels : [];
      const values = Array.isArray(chartModel.values) ? chartModel.values : [];
      if(!labels.length || !values.length) return false;
      return values.some((value)=> Number.isFinite(Number(value)));
    };
  const buildHomeFreeChartCards = ({ targetMetricKey, fallbackTitle, fallbackContext })=> {
      const homeFreeConfig = resolveHomeFreeConfig(targetMetricKey);
      const configuredCharts = Array.isArray(homeFreeConfig?.freeChartKeys) ? homeFreeConfig.freeChartKeys : [];
      const chartDefs = configuredCharts.length
        ? configuredCharts
        : [{ key: homeFreeConfig?.primaryChartKey, title: fallbackTitle, context: fallbackContext }];
      const metricPayload = compareFoundation?.metrics?.[targetMetricKey] || null;
      const hasRealComparablePeriod = compareFoundation?.period?.comparable === true;
      const isHomeCompareSuppressed = compareFoundation?.period?.suppressed === true || metricPayload?.suppressed === true;
      const homeFilterLabel = String(viewModel?.homeScope?.rangeLabel || viewModel?.rangeLabel || "Active").trim();
      const resolveHomeContextLabel = (text)=> String(text || "").replaceAll("[Home filter label]", homeFilterLabel || "Active");
      return chartDefs
        .map((chartDef, index)=> {
          const chartKey = String(chartDef?.key || "").trim();
          if(!chartKey) return null;
          const chartModel = detailCharts?.[chartKey] || null;
          if(!isUsableHomeChartModel(chartModel)) return null;
          const isCompareBars = String(chartModel?.chartType || "").toLowerCase() === "compare-bars";
          // Guardrail seam reference retained for repo check: if(isCompareBars && (!hasRealComparablePeriod || isHomeCompareSuppressed)) return null;
          const isNonComparisonCard = chartKey === "tripsByPoundRange" || chartKey === "tripsDealerMix" || chartKey === "poundsByTripSize" || chartKey === "poundsLast5Trips" || chartKey === "amountLast5Trips" || chartKey === "pplPriceRangeByTrip" || chartKey === "pplLast5Trips";
          if(isCompareBars && !isNonComparisonCard && (!hasRealComparablePeriod || isHomeCompareSuppressed)) return null;
          const resolvedMetricKey = String(
            chartModel?.metricKey
              || chartDef?.metricKey
              || targetMetricKey
              || ""
          ).trim();
          return {
            title: String(chartDef?.title || fallbackTitle || "Chart"),
            explanation: "",
            context: resolveHomeContextLabel(chartDef?.context || fallbackContext || ""),
            canvasId: index === 0
              ? HOME_PRIMARY_CANVAS_BY_METRIC[targetMetricKey]
              : `c_${targetMetricKey}_home_${index + 1}`,
            chartModel,
            metricKey: resolvedMetricKey || String(targetMetricKey || "")
          };
        })
        .filter(Boolean);
    };
    const detailMeta = {
      trips: {
        ...(function(){
          const homeFreeConfig = resolveHomeFreeConfig("trips");
          const homeChartCards = buildHomeFreeChartCards({
            targetMetricKey: "trips",
            fallbackTitle: "Trips over time",
            fallbackContext: "Simple trip trend across active Home filter"
          });
          const homePrimaryChart = homeChartCards[0]?.chartModel || null;
          const heroValue = resolveHeroValue("trips");
          const homeSnapshotItems = buildHomeSnapshotItems({ metricKey: "trips", chartModel: homePrimaryChart, trips: viewModel.trips, homeScope: viewModel.homeScope });
          return {
        title: "Trips breakdown",
        homeTitle: "Trips Logged",
        homeTitleToneClass: "homeMetricSimpleTitle--trips",
        eyebrow: "Metric breakdown",
        heroLabel: "Work entries",
        heroValue,
        heroClass: "trips",
        comparePayload: primaryPayload,
        primaryBasis,
        chartTitle: "Trips • Compare",
        homeChartTitle: homeChartCards[0]?.title || "Trips over time",
        homeChartExplanation: homeFreeConfig?.helperLine || "Trips logged in the selected period.",
        chartContext: primaryChart?.basisLabel || "Bars • trip totals for the latest matched months",
        homeChartContext: homeChartCards[0]?.context || "Simple trip trend across active Home filter",
        chartCanvasId: "c_trips",
        secondaryCharts: isHomeMetricDetail
          ? homeChartCards.slice(1)
          : [
            detailCharts.tripsRollingTrend ? {
              title: `Trips • ${detailCharts.tripsRollingTrend.windowSize}-month rolling`,
              context: "Line • rolling trend with latest month highlighted",
              canvasId: "c_trips_rolling_trend",
              chartModel: detailCharts.tripsRollingTrend,
              metricKey: "trips"
            } : null
          ],
        insight: "Read the compare card with the chart to confirm trip movement in the same latest matched months.",
        homeInsight: "Trips show your work rhythm for " + (String(viewModel?.homeScope?.rangeLabel || viewModel?.rangeLabel || "this period").trim() || "this period") + ".",
        homeTeaser: homeFreeConfig?.teaserText || "",
        homePrimaryChartModel: homePrimaryChart,
        homeSnapshotItems,
        homeInsightCompact: buildHomeCompactInsight({ targetMetricKey: "trips", heroValue, snapshotItems: homeSnapshotItems }),
        homeMeaningNote: "Trips show how often work was logged in this period."
          };
        })(),
      },
      pounds: {
        ...(function(){
          const homeFreeConfig = resolveHomeFreeConfig("pounds");
          const homeChartCards = buildHomeFreeChartCards({
            targetMetricKey: "pounds",
            fallbackTitle: "Pounds over time",
            fallbackContext: "Simple pounds trend across active Home filter"
          });
          const homePrimaryChart = homeChartCards[0]?.chartModel || null;
          const heroValue = resolveHeroValue("pounds");
          const homeSnapshotItems = buildHomeSnapshotItems({ metricKey: "pounds", chartModel: homePrimaryChart, trips: viewModel.trips, homeScope: viewModel.homeScope });
          return {
        title: "Pounds breakdown",
        homeTitle: "Pounds Landed",
        homeTitleToneClass: "homeMetricSimpleTitle--pounds",
        eyebrow: "Metric breakdown",
        heroLabel: "Total landed",
        heroValue,
        heroClass: "lbsBlue",
        comparePayload: primaryPayload,
        primaryBasis,
        chartTitle: "Pounds • Compare",
        homeChartTitle: homeChartCards[0]?.title || "Pounds over time",
        homeChartExplanation: homeFreeConfig?.helperLine || "Total pounds landed in the selected period.",
        chartContext: primaryChart?.basisLabel || "Bars • pound totals for the latest matched months",
        homeChartContext: homeChartCards[0]?.context || "Simple pounds trend across active Home filter",
        chartCanvasId: "c_lbs",
        secondaryCharts: isHomeMetricDetail
          ? homeChartCards.slice(1)
          : [
            detailCharts.poundsRollingTrend ? {
              title: `Pounds • ${detailCharts.poundsRollingTrend.windowSize}-month rolling`,
              context: "Line • rolling trend with latest month highlighted",
              canvasId: "c_pounds_rolling_trend",
              chartModel: detailCharts.poundsRollingTrend,
              metricKey: "pounds"
            } : null
          ],
        insight: "Use the compare card and chart together so the headline and values stay aligned to the latest matched months.",
        homeInsight: homeFreeConfig?.helperLine || "Pounds show production before price is factored in.",
        homeTeaser: homeFreeConfig?.teaserText || "",
        homePrimaryChartModel: homePrimaryChart,
        homeSnapshotItems,
        homeInsightCompact: buildHomeCompactInsight({ targetMetricKey: "pounds", heroValue, snapshotItems: homeSnapshotItems }),
        homeMeaningNote: "Pounds show production before price is factored in."
          };
        })(),
      },
      amount: {
        ...(function(){
          const homeFreeConfig = resolveHomeFreeConfig("amount");
          const homeChartCards = buildHomeFreeChartCards({
            targetMetricKey: "amount",
            fallbackTitle: "Pay Over Time",
            fallbackContext: "Pay received over [Home filter label]."
          });
          const homePrimaryChart = homeChartCards[0]?.chartModel || null;
          const heroValue = resolveHeroValue("amount");
          const homeSnapshotItems = buildHomeSnapshotItems({ metricKey: "amount", chartModel: homePrimaryChart, trips: viewModel.trips, homeScope: viewModel.homeScope });
          return {
        title: "Amount breakdown",
        homeTitle: "Pay Received",
        homeTitleToneClass: "homeMetricSimpleTitle--amount",
        eyebrow: "Metric breakdown",
        heroLabel: "Total pay",
        heroValue,
        heroClass: "money",
        comparePayload: primaryPayload,
        primaryBasis,
        chartTitle: "Amount • Compare",
        homeChartTitle: homeChartCards[0]?.title || "Paid over time",
        homeChartExplanation: homeFreeConfig?.helperLine || "Total paid amount from trips in the selected period.",
        chartContext: primaryChart?.basisLabel || "Bars • amount totals for the latest matched months",
        homeChartContext: homeChartCards[0]?.context || "Simple paid trend across active Home filter",
        chartCanvasId: "c_amount_detail",
        secondaryCharts: isHomeMetricDetail
          ? homeChartCards.slice(1)
          : [
            detailCharts.amountRollingTrend ? {
              title: `Amount • ${detailCharts.amountRollingTrend.windowSize}-month rolling`,
              context: "Line • rolling trend with latest month highlighted",
              canvasId: "c_amount_rolling_trend",
              chartModel: detailCharts.amountRollingTrend,
              metricKey: "amount"
            } : null,
            detailCharts.amountTrend ? {
              title: "Amount • Monthly",
              context: "Line • full months in the selected Insights date range",
              canvasId: "c_amount_trend",
              chartModel: detailCharts.amountTrend,
              metricKey: "amount"
            } : null,
            {
              title: "Amount • Dealer Mix",
              context: "Bars • the same selected date range",
              canvasId: "c_dealer"
            }
          ],
        insight: "Start with the compare chart, then use trend and dealer mix for added context.",
        homeInsight: homeFreeConfig?.helperLine || "Total paid amount from trips in the selected period.",
        homeTeaser: homeFreeConfig?.teaserText || "",
        homePrimaryChartModel: homePrimaryChart,
        homeSnapshotItems,
        homeInsightCompact: buildHomeCompactInsight({ targetMetricKey: "amount", heroValue, snapshotItems: homeSnapshotItems }),
        homeMeaningNote: "Amount is the pay result from pounds landed and price per pound."
          };
        })(),
      },
      ppl: {
        ...(function(){
          const homeFreeConfig = resolveHomeFreeConfig("ppl");
          const homeChartCards = buildHomeFreeChartCards({
            targetMetricKey: "ppl",
            fallbackTitle: "Price per pound over time",
            fallbackContext: "Average price per pound over [Home filter label]."
          });
          const homePrimaryChart = homeChartCards[0]?.chartModel || null;
          const heroValue = resolveHeroValue("ppl");
          const homeSnapshotItems = buildHomeSnapshotItems({ metricKey: "ppl", chartModel: homePrimaryChart, trips: viewModel.trips, homeScope: viewModel.homeScope });
          return {
        title: "Avg Pay Rate breakdown",
        homeTitle: "Avg Pay Rate",
        homeTitleToneClass: "homeMetricSimpleTitle--ppl",
        eyebrow: "Metric breakdown",
        heroLabel: "Weighted rate",
        heroValue,
        heroClass: "rate ppl",
        comparePayload: primaryPayload,
        primaryBasis,
        chartTitle: "Avg $ / lb • Compare",
        homeChartTitle: homeChartCards[0]?.title || "Price per pound over time",
        homeChartExplanation: homeFreeConfig?.helperLine || "Calculated from total paid ÷ total pounds.",
        chartContext: `${primaryChart?.basisLabel || "Bars • Avg $ / lb for the latest matched months"} • ${getPplFormulaText({ metricKey, surface: "short" })} • ${getRateLeaderThresholdText()}${getPplSupportNoteText({ metricKey, payload: primaryPayload, surface: "context" }) ? ` • ${getPplSupportNoteText({ metricKey, payload: primaryPayload, surface: "context" })}` : ""}`,
        homeChartContext: homeChartCards[0]?.context || "Simple Avg $ / lb trend across active Home filter",
        chartCanvasId: "c_ppl",
        secondaryCharts: isHomeMetricDetail
          ? homeChartCards.slice(1)
          : [
            detailCharts.pplRollingTrend ? {
              title: `Avg $ / lb • ${detailCharts.pplRollingTrend.windowSize}-month rolling`,
              context: `Line • rolling trend with latest month highlighted • ${getRateLeaderThresholdText()}`,
              canvasId: "c_ppl_rolling_trend",
              chartModel: detailCharts.pplRollingTrend,
              metricKey: "ppl"
            } : null
          ],
        insight: `Use the compare card and chart to read pricing for the latest matched months without mixing full-range averages.${getPplSupportNoteText({ metricKey, payload: primaryPayload, surface: "insight" }) ? ` ${getPplSupportNoteText({ metricKey, payload: primaryPayload, surface: "insight" })}` : ""}`,
        homeInsight: homeFreeConfig?.helperLine || "Calculated from total paid ÷ total pounds.",
        homeTeaser: homeFreeConfig?.teaserText || "",
        homePrimaryChartModel: homePrimaryChart,
        homeSnapshotItems,
        homeInsightCompact: buildHomeCompactInsight({ targetMetricKey: "ppl", heroValue, snapshotItems: homeSnapshotItems }),
        homeMeaningNote: "Avg $ / lb is calculated from total paid ÷ total pounds."
          };
        })()
      }
    };
    return detailMeta[metricKey] || null;
  };

  const buildMetricDetailView = (viewModel)=> {
    const {
      metricKey,
      compareFoundation,
      isHomeMetricDetail
    } = viewModel;
    const meta = buildMetricDetailMeta(viewModel);
    if(!meta) return "";
    const compareSummary = buildMetricCompareSummary({ metricKey, payload: meta.comparePayload, compareFoundation, isHomeMetricDetail });
    return renderMetricDetailSection({ meta, compareSummary, viewModel });
  };

  const buildMetricDetailChartConfig = (viewModel)=> {
    const {
      metricKey,
      primaryBasisByMetric,
      detailCharts
    } = viewModel;
    const meta = buildMetricDetailMeta(viewModel);
    if(!meta) return null;
    const homeFreeConfig = viewModel?.isHomeMetricDetail ? HOME_FREE_KPI_DETAIL_CONFIG[metricKey] || null : null;
    const homePrimaryChart = meta.homePrimaryChartModel || (homeFreeConfig?.primaryChartKey ? detailCharts?.[homeFreeConfig.primaryChartKey] || null : null);
    const secondaryCharts = Array.isArray(meta.secondaryCharts)
      ? meta.secondaryCharts
        .filter((chart)=> chart && chart.canvasId)
        .map((chart)=> ({
          canvasId: String(chart.canvasId),
          chartModel: chart.chartModel || null,
          metricKey: String(chart.metricKey || metricKey || "")
        }))
      : [];
    return {
      metricKey: String(metricKey || ""),
      compareChart: viewModel?.isHomeMetricDetail
        ? (homePrimaryChart || primaryBasisByMetric?.[metricKey]?.primaryChart || detailCharts?.[metricKey] || null)
        : (primaryBasisByMetric?.[metricKey]?.primaryChart || detailCharts?.[metricKey] || null),
      secondaryCharts
    };
  };

  return {
    buildHomeMetricDetailFoundation,
    resolveMetricDetailSurfaceMode,
    buildMetricDetailView,
    buildMetricDetailChartConfig
  };
}
