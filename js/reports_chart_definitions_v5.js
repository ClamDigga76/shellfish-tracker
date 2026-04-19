export const HOME_RATE_RANKING_THRESHOLDS = Object.freeze({
  minTrips: 2,
  minPounds: 150
});

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
  amountPerTripByArea: Object.freeze({
    chartId: "amountPerTripByArea",
    datasetKey: "areaRows",
    chartType: "compare-bars",
    metricKey: "amount",
    valueKey: "amountPerTrip",
    labelMode: "home-area-direct",
    maxItems: 6,
    title: "Amount Per Trip by area",
    explanation: "Shows which areas give you the best money return for each trip."
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
  pplByDealer: Object.freeze({
    chartId: "pplByDealer",
    datasetKey: "dealerRows",
    chartType: "compare-bars",
    metricKey: "ppl",
    valueKey: "avg",
    labelMode: "home-dealer-direct",
    maxItems: 6,
    rateRanked: true,
    title: "Price Per Pound by dealer",
    explanation: "Shows which dealers are paying the best average rate among groups with at least 2 trips and 150 lbs."
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
    title: "Price Per Pound by area",
    explanation: "Shows which areas are producing the highest-value catch among groups with at least 2 trips and 150 lbs."
  }),
  poundsPerTripByArea: Object.freeze({
    chartId: "poundsPerTripByArea",
    datasetKey: "areaRows",
    chartType: "compare-bars",
    metricKey: "pounds",
    valueKey: "poundsPerTrip",
    labelMode: "home-area-direct",
    maxItems: 6,
    title: "Pounds Per Trip by area",
    explanation: "Shows which areas give you the strongest catch volume per trip."
  }),
  pplByMonth: Object.freeze({
    chartId: "pplByMonth",
    datasetKey: "monthRows",
    chartType: "time-series",
    metricKey: "ppl",
    valueKey: "avg",
    title: "Average Price Per Pound by month",
    explanation: "Shows whether your average pay rate is improving or softening over time."
  }),
  amountByMonth: Object.freeze({
    chartId: "amountByMonth",
    datasetKey: "monthRows",
    chartType: "time-series",
    metricKey: "amount",
    valueKey: "amt",
    title: "Amount by month",
    explanation: "Shows whether your total earnings are rising, falling, or holding steady over time."
  }),
  poundsByMonth: Object.freeze({
    chartId: "poundsByMonth",
    datasetKey: "monthRows",
    chartType: "time-series",
    metricKey: "pounds",
    valueKey: "lbs",
    title: "Pounds by month",
    explanation: "Shows whether your total catch volume is rising, falling, or holding steady over time."
  }),
  amountPerTripByMonth: Object.freeze({
    chartId: "amountPerTripByMonth",
    datasetKey: "monthRows",
    chartType: "time-series",
    metricKey: "amount",
    valueKey: "amountPerTrip",
    title: "Average Amount Per Trip by month",
    explanation: "Shows whether each trip is earning more or less on average over time."
  }),
  poundsPerTripByMonth: Object.freeze({
    chartId: "poundsPerTripByMonth",
    datasetKey: "monthRows",
    chartType: "time-series",
    metricKey: "pounds",
    valueKey: "poundsPerTrip",
    title: "Average Pounds Per Trip by month",
    explanation: "Shows whether each trip is becoming more or less productive over time."
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
    chartType: "time-series",
    metricKey: String(definition?.metricKey || ""),
    basisLabel: String(definition?.basisLabel || "Visible range"),
    monthKeys: safeRows.map((row) => String(row?.monthKey || "")),
    labels: safeRows.map((row) => String(row?.label || row?.monthKey || "—")),
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
  if (definition.chartType === "time-series") {
    return buildMonthSeriesChart({ definition, rows: rankedDataset });
  }
  return buildTopRowsChart({
    definition,
    rows: rankedDataset,
    maxItems,
    sortComparator
  });
}
