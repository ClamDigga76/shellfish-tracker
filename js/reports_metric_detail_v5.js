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
      label: "Avg $/lb",
      currentValue: current.ppl,
      previousValue: previous.ppl,
      period,
      suppressed: !(current.lbs > 0 && previous.lbs > 0),
      reason: "Log pounds in both visible Home months to compare average $/lb."
    })
  };
}

function buildHomeCompareBarChart({ labels, metricKey, currentValue, previousValue }){
  return {
    chartType: "compare-bars",
    metricKey,
    basisLabel: String(labels?.length ? labels.join(" vs ") : "Visible Home month view"),
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

function buildHomeTopRowsBarChart({ rows, metricKey, valueKey, basisLabel, maxItems = 5 }){
  const safeRows = Array.isArray(rows)
    ? rows
      .filter((row)=> Number(row?.[valueKey]) > 0)
      .slice(0, maxItems)
    : [];
  return {
    chartType: "compare-bars",
    metricKey,
    basisLabel: String(basisLabel || "Visible Home month view"),
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
  const areaRowsByPounds = Array.isArray(areaRows)
    ? areaRows.slice().sort((a,b)=> (Number(b?.lbs) || 0) - (Number(a?.lbs) || 0))
    : [];
  const areaRowsByAmount = Array.isArray(areaRows)
    ? areaRows.slice().sort((a,b)=> (Number(b?.amt) || 0) - (Number(a?.amt) || 0))
    : [];
  const dealerRowsByRate = Array.isArray(dealerRows)
    ? dealerRows
      .slice()
      .filter((row)=> (Number(row?.lbs) || 0) > 0 && (Number(row?.avg) || 0) > 0)
      .sort((a,b)=> (Number(b?.avg) || 0) - (Number(a?.avg) || 0))
    : [];
  return {
    trips: buildHomeCompareBarChart({ labels, metricKey: "trips", currentValue: period?.current?.trips, previousValue: period?.previous?.trips }),
    tripsMonthlyTrend: buildHomeTimeSeriesChart({ monthRows: safeMonths, metricKey: "trips", valueKey: "trips" }),
    tripsPoundsPerTripTrend: buildHomeTimeSeriesChart({ monthRows: safeMonths, metricKey: "pounds", valueKey: "poundsPerTrip" }),
    pounds: buildHomeCompareBarChart({ labels, metricKey: "pounds", currentValue: period?.current?.lbs, previousValue: period?.previous?.lbs }),
    poundsMonthlyTrend: buildHomeTimeSeriesChart({ monthRows: safeMonths, metricKey: "pounds", valueKey: "lbs" }),
    poundsPerTripTrend: buildHomeTimeSeriesChart({ monthRows: safeMonths, metricKey: "pounds", valueKey: "poundsPerTrip" }),
    poundsAreaMix: buildHomeTopRowsBarChart({ rows: areaRowsByPounds, metricKey: "pounds", valueKey: "lbs", basisLabel: "Strongest areas by pounds in this Home filter" }),
    amount: buildHomeCompareBarChart({ labels, metricKey: "amount", currentValue: period?.current?.amount, previousValue: period?.previous?.amount }),
    amountTrend: buildHomeTimeSeriesChart({ monthRows: safeMonths, metricKey: "amount", valueKey: "amt" }),
    amountPerTripTrend: buildHomeTimeSeriesChart({ monthRows: safeMonths, metricKey: "amount", valueKey: "amountPerTrip" }),
    amountDealerMix: buildHomeTopRowsBarChart({ rows: dealerRows, metricKey: "amount", valueKey: "amt", basisLabel: "Top dealers by amount in this Home filter" }),
    amountAreaMix: buildHomeTopRowsBarChart({ rows: areaRowsByAmount, metricKey: "amount", valueKey: "amt", basisLabel: "Strongest areas by amount in this Home filter" }),
    ppl: buildHomeCompareBarChart({ labels, metricKey: "ppl", currentValue: period?.current?.ppl, previousValue: period?.previous?.ppl }),
    pplMonthlyTrend: buildHomeTimeSeriesChart({ monthRows: safeMonths, metricKey: "ppl", valueKey: "avg" }),
    pplDealerLeaders: buildHomeTopRowsBarChart({ rows: dealerRowsByRate, metricKey: "ppl", valueKey: "avg", basisLabel: "Dealer pay-rate leaders in this Home filter" }),
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

    const homePrefix = isHomeMetricDetail ? "" : `${currentLabel} `;

    const summaryBuilders = {
      trips: ()=> {
        if(tone === "up") return `${homePrefix}${isHomeMetricDetail ? "Trips rose." : `ran more trips than ${previousLabel}.`} ${productivityTone === "down" ? "Pounds per trip slipped." : (productivityTone === "up" ? "Pounds per trip improved." : "Pounds per trip stayed close.")} ${poundsPerDayTone === "up" ? "Pounds per fishing day improved too." : (poundsPerDayTone === "down" ? "Pounds per fishing day softened too." : "")}`.trim();
        if(tone === "down") return `${homePrefix}${isHomeMetricDetail ? "Trips fell." : `ran fewer trips than ${previousLabel}.`} ${productivityTone === "up" ? "Pounds per trip improved." : (productivityTone === "down" ? "Pounds per trip softened." : "Pounds per trip stayed close.")} ${poundsPerDayTone === "up" ? "Pounds per fishing day still improved." : (poundsPerDayTone === "down" ? "Pounds per fishing day eased too." : "")}`.trim();
        return `${isHomeMetricDetail ? "Trip count held close" : `${currentLabel} matched ${previousLabel} on trip count`}, with pounds per trip ${productivityTone === "up" ? "improving" : (productivityTone === "down" ? "slipping" : "holding steady")}${poundsPerDayTone === "steady" ? "." : ` and pounds per fishing day ${poundsPerDayTone === "up" ? "improving" : "slipping"}.`}`;
      },
      pounds: ()=> {
        if(tone === "up") return `${homePrefix}${isHomeMetricDetail ? "Pounds rose." : `landed more pounds than ${previousLabel} in this matched range.`} ${tripsPayload?.compareTone === "up" ? "More trips helped drive the gain." : (productivityTone === "up" ? "The gain came from stronger pounds per trip." : "Trip count stayed close while pounds climbed.")} ${poundsPerDayTone === "up" ? "Pounds per fishing day improved too." : ""}`.trim();
        if(tone === "down") return `${homePrefix}${isHomeMetricDetail ? "Pounds fell." : `landed fewer pounds than ${previousLabel} in this matched range.`} ${tripsPayload?.compareTone === "down" ? "Fewer trips were part of the drop." : (productivityTone === "down" ? "Average pounds per trip also declined." : "Trip count stayed close while pounds fell.")} ${poundsPerDayTone === "down" ? "Pounds per fishing day also declined." : ""}`.trim();
        return `${isHomeMetricDetail ? "Pounds held close" : `${currentLabel} held close to ${previousLabel} on pounds`}, with ${productivityTone === "up" ? "better" : (productivityTone === "down" ? "softer" : "steady")} pounds per trip${poundsPerDayTone === "steady" ? "." : ` and pounds per fishing day ${poundsPerDayTone === "up" ? "up" : "down"}.`}`;
      },
      amount: ()=> {
        if(tone === "up") return `${homePrefix}${isHomeMetricDetail ? "Amount rose." : `earned more than ${previousLabel} in this matched range.`} ${poundsPayload?.compareTone === "up" && pplPayload?.compareTone === "up" ? "Both pounds and $/lb moved up." : (poundsPayload?.compareTone === "up" ? "Heavier pounds carried most of the gain." : (pplPayload?.compareTone === "up" ? "Stronger $/lb did most of the lifting." : "Volume and rate both stayed fairly close."))} ${amountPerTripTone === "up" ? "Amount per trip improved." : ""} ${amountPerDayTone === "up" ? "Amount per fishing day improved too." : ""}`.trim();
        if(tone === "down") return `${homePrefix}${isHomeMetricDetail ? "Amount fell." : `earned less than ${previousLabel} in this matched range.`} ${poundsPayload?.compareTone === "down" && pplPayload?.compareTone === "down" ? "Lighter pounds and softer $/lb both contributed." : (poundsPayload?.compareTone === "down" ? "The drop came mostly from lighter pounds." : (pplPayload?.compareTone === "down" ? "Softer $/lb did most of the damage." : "Volume and rate both stayed fairly close."))} ${amountPerTripTone === "down" ? "Amount per trip also softened." : ""} ${amountPerDayTone === "down" ? "Amount per fishing day softened too." : ""}`.trim();
        return `${isHomeMetricDetail ? "Amount held close." : `${currentLabel} stayed close to ${previousLabel} on amount in this matched range,`} ${isHomeMetricDetail ? `Pounds were ${poundsPayload?.compareTone === "up" ? "up" : (poundsPayload?.compareTone === "down" ? "down" : "steady")} and $/lb was ${pplPayload?.compareTone === "up" ? "up" : (pplPayload?.compareTone === "down" ? "down" : "steady")}.` : `while pounds were ${poundsPayload?.compareTone === "up" ? "up" : (poundsPayload?.compareTone === "down" ? "down" : "steady")} and $/lb was ${pplPayload?.compareTone === "up" ? "up" : (pplPayload?.compareTone === "down" ? "down" : "steady")}.`} ${amountPerTripTone === "steady" ? "Amount per trip stayed close." : `Amount per trip moved ${amountPerTripTone}.`} ${amountPerDayTone === "steady" ? "Amount per fishing day stayed close." : `Amount per fishing day moved ${amountPerDayTone}.`}`.trim();
      },
      ppl: ()=> {
        if(tone === "up") return `${isHomeMetricDetail ? "Avg $/lb improved" : `${currentLabel} improved average $/lb over ${previousLabel}`}${payload.percentValid ? ` by ${pctText(payload.deltaPct)}` : ""}. ${poundsPayload?.compareTone === "down" ? "It improved even with lighter pounds." : (isHomeMetricDetail ? "Pricing strengthened." : "Pricing strengthened versus the prior period.")}`;
        if(tone === "down") return `${isHomeMetricDetail ? "Avg $/lb softened" : `${currentLabel} came in below ${previousLabel} on average $/lb`}${payload.percentValid ? ` by ${pctText(payload.deltaPct)}` : ""}. ${poundsPayload?.compareTone === "up" ? "Heavier pounds did not fully offset the softer rate." : (isHomeMetricDetail ? "Pricing softened." : "Pricing softened versus the prior period.")}`;
        return `${isHomeMetricDetail ? "Average $/lb held close." : `${currentLabel} held close to ${previousLabel} on average $/lb in this matched range,`} ${isHomeMetricDetail ? `Amount was ${amountPayload?.compareTone === "up" ? "still up" : (amountPayload?.compareTone === "down" ? "still down" : "also holding steady")}.` : `with amount ${amountPayload?.compareTone === "up" ? "still up" : (amountPayload?.compareTone === "down" ? "still down" : "also holding steady")}.`}`;
      }
    };
    const summaryText = (summaryBuilders[metricKey] || summaryBuilders.amount)();
    const trustNote = payload.confidenceLabel === "early"
      ? "Early read."
      : (payload.confidenceLabel === "weak" ? "Light read." : "");
    return {
      tone,
      text: `${summaryText} ${trustNote}`.trim(),
      currentValue: formatMetricCompareValue(metricKey, payload.currentValue),
      previousValue: formatMetricCompareValue(metricKey, payload.previousValue)
    };
  };

  const renderMetricDetailSection = ({ meta, compareSummary, viewModel })=> {
    const detailBackLabel = viewModel.isHomeMetricDetail ? "← Home KPIs" : "← Back to reports";
    const detailEyebrow = viewModel.isHomeMetricDetail ? "Home insight" : meta.eyebrow;
    const detailContext = viewModel.isHomeMetricDetail
      ? String(viewModel.homeScope?.contextText || `Home range ${viewModel.rangeLabel}`)
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
    const secondaryCharts = Array.isArray(meta.secondaryCharts) ? meta.secondaryCharts.filter(Boolean) : [];
    return `
    <section class="${viewModel.detailSurfaceClass}" aria-label="${escapeHtml(meta.title)}">
      <div class="${viewModel.detailCardClass}">
        <button class="btn btn-ghost affordanceBtn ${viewModel.detailBackClass}" type="button" id="reportsMetricBack">${detailBackLabel}</button>
        <div class="${viewModel.detailEyebrowClass}">${escapeHtml(detailEyebrow)}</div>
        <h2 class="${viewModel.detailTitleClass}">${escapeHtml(viewModel.isHomeMetricDetail ? meta.homeTitle : meta.title)}</h2>
        <div class="${viewModel.detailContextClass}">${escapeHtml(detailContext)}</div>
        <div class="reportsMetricSectionRail" aria-hidden="true">
          <span class="reportsMetricSectionPill">Compare basis • ${escapeHtml(compareContractBasis)}</span>
        </div>

        <div class="reportsMetricStoryStack">
          <div class="${viewModel.detailHeroWrapClass}">
            <div class="${viewModel.detailHeroLabelClass}">${escapeHtml(viewModel.isHomeMetricDetail ? meta.homeHeroLabel : meta.heroLabel)}</div>
            <div class="${viewModel.detailHeroValueClass} ${escapeHtml(meta.heroClass)}">${escapeHtml(meta.heroValue)}</div>
          </div>

          <div class="${viewModel.detailCompareClass} tone-${escapeHtml(compareSummary.tone)}">
            <div class="${viewModel.detailCompareTextClass}">${renderPercentEmphasisText(compareSummary.text)}</div>
            <div class="${viewModel.detailCompareRowsClass}">
              <div><span>${escapeHtml(meta.primaryBasis?.previousLabel || viewModel.compareFoundation.period?.previousLabel || "Previous")}</span><b>${escapeHtml(compareSummary.previousValue)}</b></div>
              <div><span>${escapeHtml(meta.primaryBasis?.currentLabel || viewModel.compareFoundation.period?.currentLabel || "Current")}</span><b>${escapeHtml(compareSummary.currentValue)}</b></div>
            </div>
            <div class="${viewModel.detailChartContextClass}">Comparison model • <b>${escapeHtml(compareContractLabel)}</b> • ${escapeHtml(compareContractBasis)}</div>
            ${compareContractText ? `<div class="${viewModel.detailChartContextClass}">${escapeHtml(compareContractText)}</div>` : ""}
          </div>
        </div>

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
    const homeSecondaryChartsByMetric = {
      trips: [
        detailCharts.tripsMonthlyTrend ? {
          title: "Trips by month",
          context: "Bars • visible Home months in this filter",
          canvasId: "c_trips_monthly_trend",
          chartModel: detailCharts.tripsMonthlyTrend,
          metricKey: "trips"
        } : null,
        detailCharts.tripsPoundsPerTripTrend ? {
          title: "Average pounds per trip by month",
          context: "Bars • productivity by visible Home month",
          canvasId: "c_trips_pounds_per_trip",
          chartModel: detailCharts.tripsPoundsPerTripTrend,
          metricKey: "pounds"
        } : null
      ],
      pounds: [
        detailCharts.poundsMonthlyTrend ? {
          title: "Total pounds by month",
          context: "Bars • visible Home months in this filter",
          canvasId: "c_pounds_monthly_trend",
          chartModel: detailCharts.poundsMonthlyTrend,
          metricKey: "pounds"
        } : null,
        detailCharts.poundsAreaMix?.labels?.length ? {
          title: "Strongest areas by pounds",
          context: "Bars • top areas in this Home filter",
          canvasId: "c_pounds_area_mix",
          chartModel: detailCharts.poundsAreaMix,
          metricKey: "pounds"
        } : null,
        detailCharts.poundsPerTripTrend ? {
          title: "Average pounds per trip by month",
          context: "Bars • productivity by visible Home month",
          canvasId: "c_pounds_per_trip_trend",
          chartModel: detailCharts.poundsPerTripTrend,
          metricKey: "pounds"
        } : null
      ],
      amount: [
        detailCharts.amountTrend ? {
          title: "Total amount by month",
          context: "Bars • visible Home months in this filter",
          canvasId: "c_amount_trend",
          chartModel: detailCharts.amountTrend,
          metricKey: "amount"
        } : null,
        detailCharts.amountDealerMix?.labels?.length ? {
          title: "Total amount by dealer",
          context: "Bars • top dealers in this Home filter",
          canvasId: "c_amount_dealer_mix",
          chartModel: detailCharts.amountDealerMix,
          metricKey: "amount"
        } : null,
        detailCharts.amountAreaMix?.labels?.length ? {
          title: "Strongest areas by amount",
          context: "Bars • top areas in this Home filter",
          canvasId: "c_amount_area_mix",
          chartModel: detailCharts.amountAreaMix,
          metricKey: "amount"
        } : null,
        detailCharts.amountPerTripTrend ? {
          title: "Average amount per trip by month",
          context: "Bars • average amount per trip by visible Home month",
          canvasId: "c_amount_per_trip_trend",
          chartModel: detailCharts.amountPerTripTrend,
          metricKey: "amount"
        } : null
      ],
      ppl: [
        detailCharts.pplMonthlyTrend ? {
          title: "Average pay rate by month",
          context: "Bars • visible Home months in this filter",
          canvasId: "c_ppl_monthly_trend",
          chartModel: detailCharts.pplMonthlyTrend,
          metricKey: "ppl"
        } : null,
        detailCharts.pplDealerLeaders?.labels?.length ? {
          title: "Dealer pay-rate leaders",
          context: "Bars • top dealer rates in this Home filter",
          canvasId: "c_ppl_dealer_leaders",
          chartModel: detailCharts.pplDealerLeaders,
          metricKey: "ppl"
        } : null,
        detailCharts.pplRateVsPoundsTrend ? {
          title: "Pounds • Monthly Context",
          context: "Bars • pounds trend beside pay-rate movement",
          canvasId: "c_ppl_rate_vs_pounds",
          chartModel: detailCharts.pplRateVsPoundsTrend,
          metricKey: "pounds"
        } : null
      ]
    };
    const detailMeta = {
      trips: {
        title: "Trips breakdown",
        homeTitle: "Trips",
        eyebrow: "Metric breakdown",
        heroLabel: "Trips this range",
        homeHeroLabel: "Latest visible Home month",
        heroValue: formatHeroFromPrimaryBasis("trips", primaryBasis),
        heroClass: "trips",
        comparePayload: primaryPayload,
        primaryBasis,
        chartTitle: "Trips • Compare",
        homeChartTitle: "Trips",
        chartContext: primaryChart?.basisLabel || "Bars • matched range trip totals",
        homeChartContext: primaryChart?.basisLabel || "Bars • latest visible month vs previous visible month",
        chartCanvasId: "c_trips",
        secondaryCharts: isHomeMetricDetail ? homeSecondaryChartsByMetric.trips : [],
        insight: "Read this compare card with the chart to confirm trip movement in the same matched range.",
        homeInsight: "Use compare first, then trend and activity context charts to confirm the trip story."
      },
      pounds: {
        title: "Pounds breakdown",
        homeTitle: "Pounds",
        eyebrow: "Metric breakdown",
        heroLabel: "Pounds this range",
        homeHeroLabel: "Latest visible Home month",
        heroValue: formatHeroFromPrimaryBasis("pounds", primaryBasis),
        heroClass: "lbsBlue",
        comparePayload: primaryPayload,
        primaryBasis,
        chartTitle: "Pounds • Compare",
        homeChartTitle: "Pounds",
        chartContext: primaryChart?.basisLabel || "Bars • matched range pound totals",
        homeChartContext: primaryChart?.basisLabel || "Bars • latest visible month vs previous visible month",
        chartCanvasId: "c_lbs",
        secondaryCharts: isHomeMetricDetail ? homeSecondaryChartsByMetric.pounds : [],
        insight: "Use this compare card and chart together so the headline and values stay aligned to one matched range.",
        homeInsight: "Use compare first, then productivity and area context charts for a fuller pounds read."
      },
      amount: {
        title: "Amount breakdown",
        homeTitle: "Amount",
        eyebrow: "Metric breakdown",
        heroLabel: "Amount this range",
        homeHeroLabel: "Latest visible Home month",
        heroValue: formatHeroFromPrimaryBasis("amount", primaryBasis),
        heroClass: "money",
        comparePayload: primaryPayload,
        primaryBasis,
        chartTitle: "Amount • Compare",
        homeChartTitle: "Amount",
        chartContext: primaryChart?.basisLabel || "Bars • matched range amount totals",
        homeChartContext: primaryChart?.basisLabel || "Bars • latest visible month vs previous visible month",
        chartCanvasId: "c_amount_detail",
        secondaryCharts: isHomeMetricDetail
          ? homeSecondaryChartsByMetric.amount
          : [
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
        homeInsight: "Read compare first, then use trend, mix, and unit-output context for amount depth."
      },
      ppl: {
        title: "$/lb breakdown",
        homeTitle: "Avg $/lb",
        eyebrow: "Metric breakdown",
        heroLabel: "Average $/lb this range",
        homeHeroLabel: "Latest visible Home month",
        heroValue: formatHeroFromPrimaryBasis("ppl", primaryBasis),
        heroClass: "rate ppl",
        comparePayload: primaryPayload,
        primaryBasis,
        chartTitle: "$/lb • Compare",
        homeChartTitle: "Avg $/lb",
        chartContext: primaryChart?.basisLabel || "Bars • matched range average $/lb",
        homeChartContext: primaryChart?.basisLabel || "Bars • latest visible month vs previous visible month",
        chartCanvasId: "c_ppl",
        secondaryCharts: isHomeMetricDetail ? homeSecondaryChartsByMetric.ppl : [],
        insight: "Use this compare card and chart to read matched-range pricing without mixing full-range averages.",
        homeInsight: "Use compare first, then trend and dealer-rate context to judge pricing depth."
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
