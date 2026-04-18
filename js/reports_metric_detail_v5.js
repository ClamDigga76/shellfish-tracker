import { buildRollingSeriesFromMonthRows, describeRollingContext, getRollingWindowForMetric } from "./reports_rolling_trends_v5.js";

const HOME_METRIC_DETAIL_COMPARE_CONTRACT = Object.freeze({
  fairWindowLabel: "Visible Home month view",
  compareModel: "home-full-month",
  compareModelLabel: "Month view",
  supportLabel: "Visible Home month view",
  support: "Comparing the latest two visible Home months.",
  explanation: "",
  missingReason: "Show one more visible month to unlock month-to-month detail.",
  missingSuppressionCode: "missing-home-months",
  missingExplanation: "Add one more visible Home month and this comparison will appear.",
  metricExplanation: ()=> "Uses the same visible month pair in the compare card and chart."
});

function normalizeChronologicalRows(rows){
  const list = Array.isArray(rows) ? rows.slice() : [];
  return list.sort((a,b)=> {
    const keyA = String(a?.monthKey || a?.key || "").trim();
    const keyB = String(b?.monthKey || b?.key || "").trim();
    if(/^\d{4}-\d{2}$/.test(keyA) && /^\d{4}-\d{2}$/.test(keyB)) return keyA.localeCompare(keyB);
    if(/^\d{4}-\d{2}$/.test(keyA)) return -1;
    if(/^\d{4}-\d{2}$/.test(keyB)) return 1;
    return 0;
  });
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
  return {
    trips,
    lbs: pounds,
    amount,
    ppl: pounds > 0 ? (Number(row?.avg) || 0) : 0,
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
    currentLabel: currentMonth.label || currentMonth.monthKey,
    previousLabel: previousMonth.label || previousMonth.monthKey,
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
    currentLabel: currentMonth?.label || "Current month",
    previousLabel: previousMonth?.label || "Previous month",
    ...buildHomeCompareContractFields({ support: "Visible Home months" }),
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
      label: "Price Per Pound",
      currentValue: current.ppl,
      previousValue: previous.ppl,
      period,
      suppressed: !(current.lbs > 0 && previous.lbs > 0),
      reason: "Log pounds in both visible Home months to compare Price Per Pound."
    })
  };
}

function buildHomeCompareBarChart({ labels, metricKey, currentValue, previousValue }){
  return {
    chartType: "compare-bars",
    metricKey,
    basisLabel: String(labels?.length ? labels.join(" vs ") : "Visible Home month view"),
    showBarValueLabels: true,
    categoryLabelsBelowBars: true,
    labels: Array.isArray(labels) ? labels.slice(0, 2) : ["Previous month", "Current month"],
    values: [Number(previousValue) || 0, Number(currentValue) || 0]
  };
}

function buildHomeTimeSeriesChart({ monthRows, metricKey, valueKey, basisLabel = "Visible Home month view" }){
  const safeMonths = normalizeChronologicalRows(Array.isArray(monthRows) ? monthRows : []);
  return {
    chartType: "time-series",
    metricKey,
    basisLabel,
    monthKeys: safeMonths.map((row)=> String(row?.monthKey || "")),
    labels: safeMonths.map((row)=> String(row?.label || row?.monthKey || "")),
    values: safeMonths.map((row)=> Number(row?.[valueKey]) || 0)
  };
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
    basisLabel: String(basisLabel || "Visible Home month view"),
    labelMode: String(labelMode || ""),
    showBarValueLabels: true,
    categoryLabelsBelowBars: true,
    labels: safeRows.map((row)=> String(row?.name || "—")),
    values: safeRows.map((row)=> Number(row?.[valueKey]) || 0)
  };
}

function buildHomeDetailCharts({ monthRows, dealerRows, areaRows, period }){
  const safeMonths = normalizeChronologicalRows(Array.isArray(monthRows) ? monthRows : []);
  const labels = [
    String(period?.previousLabel || "Previous month"),
    String(period?.currentLabel || "Current month")
  ];
  const AVG_RATE_MIN_TRIPS = 2;
  const AVG_RATE_MIN_POUNDS = 150;
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
    poundsMonthlyTrend: buildHomeTimeSeriesChart({ monthRows: safeMonths, metricKey: "pounds", valueKey: "lbs" }),
    poundsPerTripTrend: buildHomeTimeSeriesChart({ monthRows: safeMonths, metricKey: "pounds", valueKey: "poundsPerTrip" }),
    poundsDealerMix: buildHomeTopRowsBarChart({
      rows: dealerRowsByPounds,
      metricKey: "pounds",
      valueKey: "lbs",
      basisLabel: "Top dealers by pounds",
      maxItems: 6,
      labelMode: "home-dealer-direct"
    }),
    amount: buildHomeCompareBarChart({ labels, metricKey: "amount", currentValue: period?.current?.amount, previousValue: period?.previous?.amount }),
    amountTrend: buildHomeTimeSeriesChart({ monthRows: safeMonths, metricKey: "amount", valueKey: "amt" }),
    amountPerTripTrend: buildHomeTimeSeriesChart({ monthRows: safeMonths, metricKey: "amount", valueKey: "amountPerTrip" }),
    amountDealerMix: buildHomeTopRowsBarChart({ rows: dealerRows, metricKey: "amount", valueKey: "amt", basisLabel: "Top dealers by amount" }),
    amountAreaMix: buildHomeTopRowsBarChart({
      rows: areaRowsByAmount,
      metricKey: "amount",
      valueKey: "amt",
      basisLabel: "Strongest areas by amount",
      labelMode: "home-area-direct"
    }),
    ppl: buildHomeCompareBarChart({ labels, metricKey: "ppl", currentValue: period?.current?.ppl, previousValue: period?.previous?.ppl }),
    pplMonthlyTrend: buildHomeTimeSeriesChart({ monthRows: safeMonths, metricKey: "ppl", valueKey: "avg" }),
    tripsRollingTrend: buildRollingSeriesFromMonthRows({
      monthRows: safeMonths,
      metricKey: "trips",
      windowSize: getRollingWindowForMetric("trips", { surface: "home" }),
      basisLabel: "Rolling trips trend • visible Home months"
    }),
    poundsRollingTrend: buildRollingSeriesFromMonthRows({
      monthRows: safeMonths,
      metricKey: "pounds",
      windowSize: getRollingWindowForMetric("pounds", { surface: "home" }),
      basisLabel: "Rolling pounds trend • visible Home months"
    }),
    amountRollingTrend: buildRollingSeriesFromMonthRows({
      monthRows: safeMonths,
      metricKey: "amount",
      windowSize: getRollingWindowForMetric("amount", { surface: "home" }),
      basisLabel: "Rolling amount trend • visible Home months"
    }),
    pplRollingTrend: buildRollingSeriesFromMonthRows({
      monthRows: safeMonths,
      metricKey: "ppl",
      windowSize: getRollingWindowForMetric("ppl", { surface: "home" }),
      basisLabel: "Rolling Price Per Pound trend • visible Home months"
    }),
    pplAreaLeaders: buildHomeTopRowsBarChart({
      rows: areaRowsByRate,
      metricKey: "ppl",
      valueKey: "avg",
      basisLabel: `Min ${AVG_RATE_MIN_TRIPS} trips + ${AVG_RATE_MIN_POUNDS} lbs to rank`,
      maxItems: 6,
      labelMode: "home-area-direct"
    }),
    pplDealerLeaders: buildHomeTopRowsBarChart({ rows: dealerRowsByRate, metricKey: "ppl", valueKey: "avg", basisLabel: "Dealer pay-rate leaders" }),
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
  const defaultBasisLabel = String(safePeriod.supportLabel || safePeriod.support || safePeriod.fairWindowLabel || (source === "home" ? "Visible Home month view" : "Matched date range"));
  const currentLabel = String(safePeriod.currentLabel || "Current");
  const previousLabel = String(safePeriod.previousLabel || "Previous");

  return {
    trips: buildMetricPrimaryBasis({ metricKey: "trips", metricPayload: safeMetrics.trips, primaryChart: safeCharts.trips, period: safePeriod, basisLabel: defaultBasisLabel, currentLabel, previousLabel }),
    pounds: buildMetricPrimaryBasis({ metricKey: "pounds", metricPayload: safeMetrics.pounds, primaryChart: safeCharts.pounds, period: safePeriod, basisLabel: defaultBasisLabel, currentLabel, previousLabel }),
    amount: buildMetricPrimaryBasis({ metricKey: "amount", metricPayload: safeMetrics.amount, primaryChart: safeCharts.amountCompare || safeCharts.amount, period: safePeriod, basisLabel: defaultBasisLabel, currentLabel, previousLabel }),
    ppl: buildMetricPrimaryBasis({ metricKey: "ppl", metricPayload: safeMetrics.ppl, primaryChart: safeCharts.ppl, period: safePeriod, basisLabel: defaultBasisLabel, currentLabel, previousLabel })
  };
}

function buildHomeMetricDetailFoundation({ monthRows, dealerRows, areaRows }){
  const safeMonths = normalizeChronologicalRows(Array.isArray(monthRows) ? monthRows.filter((row)=> row?.monthKey) : []);
  const currentMonth = safeMonths[safeMonths.length - 1] || null;
  const previousMonth = safeMonths[safeMonths.length - 2] || null;
  const current = summarizeHomeMonthRow(currentMonth);
  const previous = summarizeHomeMonthRow(previousMonth);

  const period = currentMonth && previousMonth
    ? buildHomeComparablePeriod({ currentMonth, previousMonth, current, previous })
    : buildHomeSuppressedPeriod({ currentMonth, previousMonth, current, previous });
  const metrics = buildHomeMetricPayloads(period);
  const detailCharts = buildHomeDetailCharts({ monthRows: safeMonths, dealerRows, areaRows, period });

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

  const PERCENT_TOKEN_RE = /([+-]?\d+%)/g;
  const renderPercentEmphasisText = (text)=> escapeHtml(String(text || "")).replace(PERCENT_TOKEN_RE, '<span class="reportsPercentEmphasis">$1</span>');
  const formatPeriodPair = (previousLabel, currentLabel)=> `${String(previousLabel || "Previous")} → ${String(currentLabel || "Current")}`;
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
    const pctText = (value)=> `${Math.abs(Math.round((Number(value) || 0) * 100))}%`;
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
            ? "stronger Price Per Pound"
            : (poundsPayload?.compareTone === "down" && pplPayload?.compareTone !== "down"
              ? "lighter pounds landed"
              : (pplPayload?.compareTone === "down" && poundsPayload?.compareTone !== "down"
                ? "softer Price Per Pound"
                : "a combined shift in pounds and Price Per Pound")));
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
        return `${metricMoveLead("Price Per Pound")}${pctMove} mainly from ${cause}. Evidence: amount was ${amountDirection} while pounds were ${poundsDirection}.`;
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
    return {
      tone,
      text: `${summaryText}${rollingContextText ? ` ${rollingContextText}` : ""}${trustNote}`.trim(),
      currentValue: formatMetricCompareValue(metricKey, payload.currentValue),
      previousValue: formatMetricCompareValue(metricKey, payload.previousValue)
    };
  };

  const renderMetricDetailSection = ({ meta, compareSummary, viewModel })=> {
    const homeRangeLabel = String(viewModel.homeScope?.rangeLabel || viewModel.rangeLabel || "").trim();
    const homeTripCount = Number(viewModel.homeScope?.tripCount ?? viewModel.trips?.length) || 0;
    const detailContext = viewModel.isHomeMetricDetail
      ? `Range ${homeRangeLabel || "Active"} • ${homeTripCount} trips`
      : `Range ${viewModel.rangeLabel} • ${viewModel.trips.length} trips`;
    const detailChartTitle = viewModel.isHomeMetricDetail ? meta.homeChartTitle : meta.chartTitle;
    const detailChartContext = meta.primaryBasis?.basisLabel || (viewModel.isHomeMetricDetail ? meta.homeChartContext : meta.chartContext);
    const detailInsight = viewModel.isHomeMetricDetail ? meta.homeInsight : meta.insight;
    const compareContractLabel = viewModel.compareFoundation.period?.compareModelLabel || "Comparison";
    const compareContractBasis = viewModel.compareFoundation.period?.currentLabel && viewModel.compareFoundation.period?.previousLabel
      ? formatPeriodPair(viewModel.compareFoundation.period.previousLabel, viewModel.compareFoundation.period.currentLabel)
      : (meta.primaryBasis?.basisLabel || viewModel.compareFoundation.period?.supportLabel || viewModel.compareFoundation.period?.support || viewModel.compareFoundation.period?.fairWindowLabel || "Matched date range");
    const compareContractText = viewModel.compareFoundation.period?.suppressed
      ? (viewModel.compareFoundation.period?.explanation || "")
      : "";
    const supportAnalysisText = viewModel.isHomeMetricDetail
      ? (toMaxTwoSentences(compareSummary.text) || String(compareSummary.text || ""))
      : String(compareSummary.text || "");
    const secondaryCharts = Array.isArray(meta.secondaryCharts) ? meta.secondaryCharts.filter(Boolean) : [];
    const renderStandardSupportCard = ()=> `
      <div class="${viewModel.detailCompareClass} tone-${escapeHtml(compareSummary.tone)}">
        <div class="${viewModel.detailCompareTextClass}">${renderPercentEmphasisText(supportAnalysisText)}</div>
        <div class="${viewModel.detailCompareRowsClass}">
          <div class="reportsMetricCompareRow"><span class="reportsMetricCompareLabel">${escapeHtml(meta.primaryBasis?.previousLabel || viewModel.compareFoundation.period?.previousLabel || "Previous")}</span><b class="reportsMetricCompareValue">${escapeHtml(compareSummary.previousValue)}</b></div>
          <div class="reportsMetricCompareRow"><span class="reportsMetricCompareLabel">${escapeHtml(meta.primaryBasis?.currentLabel || viewModel.compareFoundation.period?.currentLabel || "Current")}</span><b class="reportsMetricCompareValue">${escapeHtml(compareSummary.currentValue)}</b></div>
        </div>
        <div class="reportsMetricSupportMetaBlock" aria-label="Support metadata">
          <div class="${viewModel.detailChartContextClass} reportsMetricSupportMeta reportsMetricSupportMeta--model">Comparison model • <b>${escapeHtml(compareContractLabel)}</b></div>
          <div class="${viewModel.detailChartContextClass} reportsMetricSupportMeta reportsMetricSupportMeta--basis">${escapeHtml(compareContractBasis)}</div>
          ${compareContractText ? `<div class="${viewModel.detailChartContextClass} reportsMetricSupportMeta reportsMetricSupportMeta--note">${escapeHtml(compareContractText)}</div>` : ""}
        </div>
      </div>
    `;
    return `
    <section class="${viewModel.detailSurfaceClass}" aria-label="${escapeHtml(meta.title)}">
      <div class="${viewModel.detailCardClass}">
        ${viewModel.isHomeMetricDetail ? `
          <div class="homeMetricTitleHeader" aria-label="Metric title">
            <h2 class="homeMetricSimpleTitle ${escapeHtml(meta.homeTitleToneClass || "")}">${escapeHtml(meta.homeTitle)}</h2>
          </div>
        ` : `
          <button class="btn btn-ghost affordanceBtn ${viewModel.detailBackClass}" type="button" id="reportsMetricBack">← Back to reports</button>
          <div class="${viewModel.detailEyebrowClass}">${escapeHtml(meta.eyebrow)}</div>
          <h2 class="${viewModel.detailTitleClass}">${escapeHtml(meta.title)}</h2>
          <div class="${viewModel.detailContextClass}">${escapeHtml(detailContext)}</div>
          <div class="reportsMetricSectionRail" aria-hidden="true">
          <span class="reportsMetricSectionPill">Compare basis • ${escapeHtml(compareContractBasis)}</span>
          </div>
        `}

        ${viewModel.isHomeMetricDetail ? "" : `
        <div class="reportsMetricStoryStack">
          <div class="${viewModel.detailHeroWrapClass}">
            <div class="${viewModel.detailHeroLabelClass}">${escapeHtml(meta.heroLabel)}</div>
            <div class="${viewModel.detailHeroValueClass} ${escapeHtml(meta.heroClass)}">${escapeHtml(meta.heroValue)}</div>
          </div>

          ${renderStandardSupportCard()}
        </div>
        `}

        <div class="reportsMetricChartsStack">
          <div class="${viewModel.detailChartClass}">
            <b>${escapeHtml(detailChartTitle)}</b>
            <div class="${viewModel.detailChartContextClass}">${escapeHtml(detailChartContext)}</div>
            <canvas class="chart" id="${escapeHtml(meta.chartCanvasId)}" height="220"></canvas>
          </div>

          ${secondaryCharts.map((chart)=> `
            <div class="${viewModel.detailChartClass}">
              <b>${escapeHtml(chart.title)}</b>
              <div class="${viewModel.detailChartContextClass}">${escapeHtml(chart.context)}</div>
              <canvas class="chart" id="${escapeHtml(chart.canvasId)}" height="220"></canvas>
            </div>
          `).join("")}
        </div>

        <div class="${viewModel.detailInsightClass}">${escapeHtml(detailInsight)}</div>
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
      if(targetMetric === "trips") return `${tripCount} trips`;
      if(targetMetric === "pounds") return `${to2(pounds)} lbs`;
      if(targetMetric === "amount") return formatMoney(to2(amount));
      if(targetMetric === "ppl") return pounds > 0 ? `${formatMoney(to2(amount / pounds))}/lb` : "—";
      return "—";
    };
    const resolveHeroValue = (targetMetric)=> (
      isHomeMetricDetail
        ? formatHomeKpiHeroValue(targetMetric, viewModel.trips)
        : formatHeroFromPrimaryBasis(targetMetric, primaryBasis)
    );
    const homeSecondaryChartsByMetric = {
      trips: [
        detailCharts.tripsAreaMix?.labels?.length ? {
          title: "Trips by area",
          context: "Where you fished most in this Home range",
          canvasId: "c_trips_area_mix",
          chartModel: detailCharts.tripsAreaMix,
          metricKey: "trips"
        } : null,
        detailCharts.tripsDealerMix?.labels?.length ? {
          title: "Trips by dealer",
          context: "Who you sold to most in this Home range",
          canvasId: "c_trips_dealer_mix",
          chartModel: detailCharts.tripsDealerMix,
          metricKey: "trips"
        } : null,
        detailCharts.tripsMonthlyTrend ? {
          title: "Trips by month",
          context: "Monthly trip counts",
          canvasId: "c_trips_monthly_trend",
          chartModel: detailCharts.tripsMonthlyTrend,
          metricKey: "trips"
        } : null,
        detailCharts.tripsPoundsPerTripTrend ? {
          title: "Average pounds per trip by month",
          context: "How much each trip landed each month",
          canvasId: "c_trips_pounds_per_trip",
          chartModel: detailCharts.tripsPoundsPerTripTrend,
          metricKey: "pounds"
        } : null
      ],
      pounds: [
        detailCharts.poundsMonthlyTrend ? {
          title: "Total pounds by month",
          context: "Monthly pounds landed",
          canvasId: "c_pounds_monthly_trend",
          chartModel: detailCharts.poundsMonthlyTrend,
          metricKey: "pounds"
        } : null,
        detailCharts.poundsPerTripTrend ? {
          title: "Average pounds per trip by month",
          context: "Catch per trip by month",
          canvasId: "c_pounds_per_trip_trend",
          chartModel: detailCharts.poundsPerTripTrend,
          metricKey: "pounds"
        } : null,
        detailCharts.poundsDealerMix?.labels?.length ? {
          title: "Top dealers by pounds",
          context: "Dealers with the most landed pounds",
          canvasId: "c_pounds_dealer_mix",
          chartModel: detailCharts.poundsDealerMix,
          metricKey: "pounds"
        } : null
      ],
      amount: [
        detailCharts.amountTrend ? {
          title: "Total amount by month",
          context: "Monthly earnings",
          canvasId: "c_amount_trend",
          chartModel: detailCharts.amountTrend,
          metricKey: "amount"
        } : null,
        detailCharts.amountPerTripTrend ? {
          title: "Average amount per trip by month",
          context: "Average earnings per trip by month",
          canvasId: "c_amount_per_trip_trend",
          chartModel: detailCharts.amountPerTripTrend,
          metricKey: "amount"
        } : null,
        detailCharts.amountDealerMix?.labels?.length ? {
          title: "Top dealers by amount",
          context: "Dealers paying the most",
          canvasId: "c_amount_dealer_mix",
          chartModel: detailCharts.amountDealerMix,
          metricKey: "amount"
        } : null,
        detailCharts.amountAreaMix?.labels?.length ? {
          title: "Strongest areas by amount",
          context: "Areas earning the most",
          canvasId: "c_amount_area_mix",
          chartModel: detailCharts.amountAreaMix,
          metricKey: "amount"
        } : null
      ],
      ppl: [
        detailCharts.pplMonthlyTrend ? {
          title: "Average pay rate by month",
          context: "Price Per Pound each month",
          canvasId: "c_ppl_monthly_trend",
          chartModel: detailCharts.pplMonthlyTrend,
          metricKey: "ppl"
        } : null,
        detailCharts.pplRateVsPoundsTrend ? {
          title: "Monthly pounds landed",
          context: "Pounds by month to pair with pay-rate movement",
          canvasId: "c_ppl_rate_vs_pounds",
          chartModel: detailCharts.pplRateVsPoundsTrend,
          metricKey: "pounds"
        } : null,
        detailCharts.pplAreaLeaders?.labels?.length ? {
          title: "Price Per Pound by area",
          context: "Min 2 trips + 150 lbs to rank",
          canvasId: "c_ppl_area_leaders",
          chartModel: detailCharts.pplAreaLeaders,
          metricKey: "ppl"
        } : null,
        detailCharts.pplDealerLeaders?.labels?.length ? {
          title: "Price Per Pound by dealer",
          context: "Min 2 trips + 150 lbs to rank",
          canvasId: "c_ppl_dealer_leaders",
          chartModel: detailCharts.pplDealerLeaders,
          metricKey: "ppl"
        } : null
      ]
    };
    const detailMeta = {
      trips: {
        title: "Trips breakdown",
        homeTitle: "Trips",
        homeTitleToneClass: "homeMetricSimpleTitle--trips",
        eyebrow: "Metric breakdown",
        heroLabel: "Trips this range",
        heroValue: resolveHeroValue("trips"),
        heroClass: "trips",
        comparePayload: primaryPayload,
        primaryBasis,
        chartTitle: "Trips • Compare",
        homeChartTitle: "Trips",
        chartContext: primaryChart?.basisLabel || "Bars • latest comparable-month window trip totals",
        homeChartContext: primaryChart?.basisLabel || "Latest visible month vs the month before",
        chartCanvasId: "c_trips",
        secondaryCharts: isHomeMetricDetail
          ? homeSecondaryChartsByMetric.trips
          : [
            detailCharts.tripsRollingTrend ? {
              title: `Trips • ${detailCharts.tripsRollingTrend.windowSize}-month rolling`,
              context: "Line • rolling window with current marker",
              canvasId: "c_trips_rolling_trend",
              chartModel: detailCharts.tripsRollingTrend,
              metricKey: "trips"
            } : null
          ],
        insight: "Read this compare card with the chart to confirm trip movement in the same latest comparable-month window.",
        homeInsight: "Start with the month-to-month compare, then scan monthly charts for quick context."
      },
      pounds: {
        title: "Pounds breakdown",
        homeTitle: "Pounds",
        homeTitleToneClass: "homeMetricSimpleTitle--pounds",
        eyebrow: "Metric breakdown",
        heroLabel: "Pounds this range",
        heroValue: resolveHeroValue("pounds"),
        heroClass: "lbsBlue",
        comparePayload: primaryPayload,
        primaryBasis,
        chartTitle: "Pounds • Compare",
        homeChartTitle: "Pounds",
        chartContext: primaryChart?.basisLabel || "Bars • latest comparable-month window pound totals",
        homeChartContext: primaryChart?.basisLabel || "Latest visible month vs the month before",
        chartCanvasId: "c_lbs",
        secondaryCharts: isHomeMetricDetail
          ? homeSecondaryChartsByMetric.pounds
          : [
            detailCharts.poundsRollingTrend ? {
              title: `Pounds • ${detailCharts.poundsRollingTrend.windowSize}-month rolling`,
              context: "Line • rolling window with current marker",
              canvasId: "c_pounds_rolling_trend",
              chartModel: detailCharts.poundsRollingTrend,
              metricKey: "pounds"
            } : null
          ],
        insight: "Use this compare card and chart together so the headline and values stay aligned to one latest comparable-month window.",
        homeInsight: "Start with the compare chart, then use monthly and area charts to see what drove the change."
      },
      amount: {
        title: "Amount breakdown",
        homeTitle: "Amount",
        homeTitleToneClass: "homeMetricSimpleTitle--amount",
        eyebrow: "Metric breakdown",
        heroLabel: "Amount this range",
        heroValue: resolveHeroValue("amount"),
        heroClass: "money",
        comparePayload: primaryPayload,
        primaryBasis,
        chartTitle: "Amount • Compare",
        homeChartTitle: "Amount",
        chartContext: primaryChart?.basisLabel || "Bars • latest comparable-month window amount totals",
        homeChartContext: primaryChart?.basisLabel || "Latest visible month vs the month before",
        chartCanvasId: "c_amount_detail",
        secondaryCharts: isHomeMetricDetail
          ? homeSecondaryChartsByMetric.amount
          : [
            detailCharts.amountRollingTrend ? {
              title: `Amount • ${detailCharts.amountRollingTrend.windowSize}-month rolling`,
              context: "Line • rolling window with current marker",
              canvasId: "c_amount_rolling_trend",
              chartModel: detailCharts.amountRollingTrend,
              metricKey: "amount"
            } : null,
            detailCharts.amountTrend ? {
              title: "Amount • Monthly",
              context: "Bars • full months in this active Reports range",
              canvasId: "c_amount_trend",
              chartModel: detailCharts.amountTrend,
              metricKey: "amount"
            } : null,
            {
              title: "Amount • Dealer Mix",
              context: "Bars • this same active filter range",
              canvasId: "c_dealer"
            }
          ],
        insight: "Start with the compare chart, then use trend and dealer mix for added context.",
        homeInsight: "Start with compare, then check monthly, dealer, and area charts for where earnings came from."
      },
      ppl: {
        title: "Price Per Pound breakdown",
        homeTitle: "Price Per Pound",
        homeTitleToneClass: "homeMetricSimpleTitle--ppl",
        eyebrow: "Metric breakdown",
        heroLabel: "Average Price Per Pound this range",
        heroValue: resolveHeroValue("ppl"),
        heroClass: "rate ppl",
        comparePayload: primaryPayload,
        primaryBasis,
        chartTitle: "Price Per Pound • Compare",
        homeChartTitle: "Price Per Pound",
        chartContext: primaryChart?.basisLabel || "Bars • latest comparable-month window average Price Per Pound",
        homeChartContext: primaryChart?.basisLabel || "Latest visible month vs the month before",
        chartCanvasId: "c_ppl",
        secondaryCharts: isHomeMetricDetail
          ? homeSecondaryChartsByMetric.ppl
          : [
            detailCharts.pplRollingTrend ? {
              title: `Price Per Pound • ${detailCharts.pplRollingTrend.windowSize}-month rolling`,
              context: "Line • rolling window with current marker",
              canvasId: "c_ppl_rolling_trend",
              chartModel: detailCharts.pplRollingTrend,
              metricKey: "ppl"
            } : null
          ],
        insight: "Use this compare card and chart to read latest comparable-month window pricing without mixing full-range averages.",
        homeInsight: "Start with compare, then scan monthly pounds and dealer-rate charts for pricing context."
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
      compareChart: primaryBasisByMetric?.[metricKey]?.primaryChart || detailCharts?.[metricKey] || null,
      secondaryCharts
    };
  };

  return {
    buildHomeMetricDetailFoundation,
    buildMetricDetailView,
    buildMetricDetailChartConfig
  };
}
