export const HOME_RATE_RANKING_THRESHOLDS = Object.freeze({
  minTrips: 2,
  minPounds: 150
});

export const HOME_SHARED_CHART_IDS = Object.freeze([
  "amountByArea",
  "poundsByArea",
  "tripsByArea",
  "amountPerTripByArea",
  "poundsPerTripByArea",
  "amountByDealer",
  "tripsByDealer",
  "poundsByDealer",
  "poundsPerTripByDealer",
  "amountPerTripByDealer",
  "pplByDealer",
  "pplByArea",
  "tripsByMonth",
  "pplByMonth",
  "amountByMonth",
  "poundsByMonth",
  "amountPerTripByMonth",
  "poundsPerTripByMonth"
]);

export const HOME_SHARED_CHART_DEFINITIONS = Object.freeze({
  amountByArea: Object.freeze({
    chartId: "amountByArea",
    datasetKey: "areaRows",
    chartType: "compare-bars",
    metricKey: "amount",
    valueKey: "amt",
    labelMode: "home-area-direct",
    maxItems: 6,
    title: "Amount by area",
    explanation: "Shows which fishing areas are making you the most money."
  }),
  poundsByArea: Object.freeze({
    chartId: "poundsByArea",
    datasetKey: "areaRows",
    chartType: "compare-bars",
    metricKey: "pounds",
    valueKey: "lbs",
    labelMode: "home-area-direct",
    maxItems: 6,
    title: "Pounds by area",
    explanation: "Shows which areas are producing the most total catch volume."
  }),

  tripsByArea: Object.freeze({
    chartId: "tripsByArea",
    datasetKey: "areaRows",
    chartType: "compare-bars",
    metricKey: "trips",
    valueKey: "trips",
    labelMode: "home-area-direct",
    maxItems: 6,
    title: "Trips by area",
    explanation: "Shows which areas have the most logged work activity."
  }),
  amountPerTripByArea: Object.freeze({
    chartId: "amountPerTripByArea",
    datasetKey: "areaRows",
    chartType: "compare-bars",
    metricKey: "amount",
    valueKey: "amountPerTrip",
    labelMode: "home-area-direct",
    maxItems: 6,
    title: "Average Amount Per Trip by area",
    explanation: "Shows which areas give you the best average money return for each trip."
  }),
  amountByDealer: Object.freeze({
    chartId: "amountByDealer",
    datasetKey: "dealerRows",
    chartType: "compare-bars",
    metricKey: "amount",
    valueKey: "amt",
    labelMode: "home-dealer-direct",
    maxItems: 6,
    title: "Amount by dealer",
    explanation: "Shows which dealers have paid you the most overall."
  }),

  tripsByDealer: Object.freeze({
    chartId: "tripsByDealer",
    datasetKey: "dealerRows",
    chartType: "compare-bars",
    metricKey: "trips",
    valueKey: "trips",
    labelMode: "home-dealer-direct",
    maxItems: 6,
    title: "Trips by dealer",
    explanation: "Shows which dealers are tied to the most logged trips."
  }),
  poundsByDealer: Object.freeze({
    chartId: "poundsByDealer",
    datasetKey: "dealerRows",
    chartType: "compare-bars",
    metricKey: "pounds",
    valueKey: "lbs",
    labelMode: "home-dealer-direct",
    maxItems: 6,
    title: "Pounds by dealer",
    explanation: "Shows which dealers received the most total pounds."
  }),
  poundsPerTripByDealer: Object.freeze({
    chartId: "poundsPerTripByDealer",
    datasetKey: "dealerRows",
    chartType: "compare-bars",
    metricKey: "pounds",
    valueKey: "poundsPerTrip",
    labelMode: "home-dealer-direct",
    maxItems: 6,
    title: "Average Pounds Per Trip by dealer",
    explanation: "Shows which dealers are tied to the strongest average pounds per trip."
  }),
  amountPerTripByDealer: Object.freeze({
    chartId: "amountPerTripByDealer",
    datasetKey: "dealerRows",
    chartType: "compare-bars",
    metricKey: "amount",
    valueKey: "amountPerTrip",
    labelMode: "home-dealer-direct",
    maxItems: 6,
    title: "Average Amount Per Trip by dealer",
    explanation: "Shows which dealers are tied to the strongest average payout per trip."
  }),
  pplByDealer: Object.freeze({
    chartId: "pplByDealer",
    datasetKey: "dealerRows",
    chartType: "compare-bars",
    metricKey: "ppl",
    valueKey: "avg",
    labelMode: "home-dealer-direct",
    maxItems: 6,
    rateRanked: true,
    title: "Avg $ / lb by dealer",
    explanation: "Shows which dealers are paying the strongest Avg $ / lb (total amount ÷ total pounds), ranked for groups with at least 2 trips and 150 lbs."
  }),
  pplByArea: Object.freeze({
    chartId: "pplByArea",
    datasetKey: "areaRows",
    chartType: "compare-bars",
    metricKey: "ppl",
    valueKey: "avg",
    labelMode: "home-area-direct",
    maxItems: 6,
    rateRanked: true,
    title: "Avg $ / lb by area",
    explanation: "Shows which areas are producing the strongest Avg $ / lb (total amount ÷ total pounds), ranked for groups with at least 2 trips and 150 lbs."
  }),
  poundsPerTripByArea: Object.freeze({
    chartId: "poundsPerTripByArea",
    datasetKey: "areaRows",
    chartType: "compare-bars",
    metricKey: "pounds",
    valueKey: "poundsPerTrip",
    labelMode: "home-area-direct",
    maxItems: 6,
    title: "Average Pounds Per Trip by area",
    explanation: "Shows which areas give you the strongest average catch volume per trip."
  }),

  tripsByMonth: Object.freeze({
    chartId: "tripsByMonth",
    datasetKey: "monthRows",
    chartType: "month-line",
    metricKey: "trips",
    valueKey: "trips",
    title: "Trips by month",
    explanation: "Shows how many work entries were logged each month. Current month is shown as so far when incomplete."
  }),
  pplByMonth: Object.freeze({
    chartId: "pplByMonth",
    datasetKey: "monthRows",
    chartType: "month-line",
    metricKey: "ppl",
    valueKey: "avg",
    title: "Avg $ / lb by month",
    explanation: "Shows weighted Avg $ / lb by month (total amount ÷ total pounds). The current month is shown as so far when incomplete."
  }),
  amountByMonth: Object.freeze({
    chartId: "amountByMonth",
    datasetKey: "monthRows",
    chartType: "month-line",
    metricKey: "amount",
    valueKey: "amt",
    title: "Amount by month",
    explanation: "Shows total earnings by month. If the current month is incomplete it is labeled so far and should be treated as in progress."
  }),
  poundsByMonth: Object.freeze({
    chartId: "poundsByMonth",
    datasetKey: "monthRows",
    chartType: "month-line",
    metricKey: "pounds",
    valueKey: "lbs",
    title: "Pounds by month",
    explanation: "Shows total catch volume by month. If the current month is incomplete it is labeled so far and should be treated as in progress."
  }),
  amountPerTripByMonth: Object.freeze({
    chartId: "amountPerTripByMonth",
    datasetKey: "monthRows",
    chartType: "month-line",
    metricKey: "amount",
    valueKey: "amountPerTrip",
    title: "Average Amount Per Trip by month",
    explanation: "Shows average amount per trip by month; the current month is labeled so far when still building."
  }),
  poundsPerTripByMonth: Object.freeze({
    chartId: "poundsPerTripByMonth",
    datasetKey: "monthRows",
    chartType: "month-line",
    metricKey: "pounds",
    valueKey: "poundsPerTrip",
    title: "Average Pounds Per Trip by month",
    explanation: "Shows average pounds per trip by month; the current month is labeled so far when still building."
  })
});

export function getHomeSharedChartDefinition(chartId) {
  return HOME_SHARED_CHART_DEFINITIONS[String(chartId || "")] || null;
}

export function normalizeChronologicalRows(rows) {
  const list = Array.isArray(rows) ? rows.slice() : [];
  return list.sort((a, b) => {
    const keyA = String(a?.monthKey || a?.key || "").trim();
    const keyB = String(b?.monthKey || b?.key || "").trim();
    if (/^\d{4}-\d{2}$/.test(keyA) && /^\d{4}-\d{2}$/.test(keyB)) return keyA.localeCompare(keyB);
    if (/^\d{4}-\d{2}$/.test(keyA)) return -1;
    if (/^\d{4}-\d{2}$/.test(keyB)) return 1;
    return 0;
  });
}

function buildTopRowsChart({ definition, rows, maxItems, sortComparator }) {
  const valueKey = String(definition?.valueKey || "");
  const safeRows = (Array.isArray(rows) ? rows : [])
    .filter((row) => Number(row?.[valueKey]) > 0);
  const sortedRows = sortComparator
    ? safeRows.slice().sort(sortComparator)
    : safeRows.slice().sort((a, b) => (Number(b?.[valueKey]) || 0) - (Number(a?.[valueKey]) || 0));
  const chartRows = sortedRows.slice(0, Number(maxItems) || Number(definition?.maxItems) || 6);
  return {
    chartType: "compare-bars",
    metricKey: String(definition?.metricKey || ""),
    basisLabel: String(definition?.basisLabel || "Visible range"),
    labelMode: String(definition?.labelMode || ""),
    showBarValueLabels: true,
    categoryLabelsBelowBars: true,
    labels: chartRows.map((row) => String(row?.name || "—")),
    values: chartRows.map((row) => Number(row?.[valueKey]) || 0)
  };
}

function buildMonthSeriesChart({ definition, rows }) {
  const valueKey = String(definition?.valueKey || "");
  const safeRows = normalizeChronologicalRows(Array.isArray(rows) ? rows : []);
  return {
    chartType: String(definition?.chartType || "time-series"),
    metricKey: String(definition?.metricKey || ""),
    basisLabel: String(definition?.basisLabel || "Visible range"),
    monthKeys: safeRows.map((row) => String(row?.monthKey || "")),
    labels: safeRows.map((row) => String(row?.displayLabel || row?.label || row?.monthKey || "—")),
    values: safeRows.map((row) => Number(row?.[valueKey]) || 0)
  };
}

function applyRateRankingThreshold(rows) {
  const minTrips = Number(HOME_RATE_RANKING_THRESHOLDS.minTrips) || 0;
  const minPounds = Number(HOME_RATE_RANKING_THRESHOLDS.minPounds) || 0;
  return (Array.isArray(rows) ? rows : []).filter((row) =>
    (Number(row?.trips) || 0) >= minTrips && (Number(row?.lbs) || 0) >= minPounds
  );
}

export function buildHomeSharedChartModel({
  chartId,
  monthRows,
  dealerRows,
  areaRows,
  maxItems,
  sortComparator
}) {
  const definition = getHomeSharedChartDefinition(chartId);
  if (!definition) return null;
  const dataset = definition.datasetKey === "monthRows"
    ? monthRows
    : (definition.datasetKey === "dealerRows" ? dealerRows : areaRows);
  const rankedDataset = definition.rateRanked ? applyRateRankingThreshold(dataset) : dataset;
  if (definition.chartType === "time-series" || definition.chartType === "month-line" || definition.chartType === "rolling-line") {
    return buildMonthSeriesChart({ definition, rows: rankedDataset });
  }
  return buildTopRowsChart({
    definition,
    rows: rankedDataset,
    maxItems,
    sortComparator
  });
}
