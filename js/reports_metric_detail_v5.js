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
  metricExplanation: (label)=> `${label} uses the same month pair shown in the compare card and chart.`
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

function buildHomeDetailCharts({ monthRows, period }){
  const safeMonths = normalizeChronologicalRows(Array.isArray(monthRows) ? monthRows : []);
  const labels = [
    String(period?.previousLabel || "Previous month"),
    String(period?.currentLabel || "Current month")
  ];
  const amountTrendChart = {
    chartType: "time-series",
    metricKey: "amount",
    basisLabel: "Visible Home month view",
    monthKeys: safeMonths.map((row)=> String(row?.monthKey || "")),
    labels: safeMonths.map((row)=> String(row?.label || row?.monthKey || "")),
    values: safeMonths.map((row)=> Number(row?.amt) || 0)
  };
  return {
    trips: buildHomeCompareBarChart({ labels, metricKey: "trips", currentValue: period?.current?.trips, previousValue: period?.previous?.trips }),
    pounds: buildHomeCompareBarChart({ labels, metricKey: "pounds", currentValue: period?.current?.lbs, previousValue: period?.previous?.lbs }),
    amount: buildHomeCompareBarChart({ labels, metricKey: "amount", currentValue: period?.current?.amount, previousValue: period?.previous?.amount }),
    amountTrend: amountTrendChart,
    ppl: buildHomeCompareBarChart({ labels, metricKey: "ppl", currentValue: period?.current?.ppl, previousValue: period?.previous?.ppl })
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

function buildHomeMetricDetailFoundation({ monthRows }){
  const safeMonths = normalizeChronologicalRows(Array.isArray(monthRows) ? monthRows.filter((row)=> row?.monthKey) : []);
  const currentMonth = safeMonths[safeMonths.length - 1] || null;
  const previousMonth = safeMonths[safeMonths.length - 2] || null;
  const current = summarizeHomeMonthRow(currentMonth);
  const previous = summarizeHomeMonthRow(previousMonth);

  const period = currentMonth && previousMonth
    ? buildHomeComparablePeriod({ currentMonth, previousMonth, current, previous })
    : buildHomeSuppressedPeriod({ currentMonth, previousMonth, current, previous });
  const metrics = buildHomeMetricPayloads(period);
  const detailCharts = buildHomeDetailCharts({ monthRows: safeMonths, period });

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
    formatReportDateValue,
    getTripMetricValue,
    resolveTripArea,
    to2
  } = deps;

  const PERCENT_TOKEN_RE = /([+-]?\d+%)/g;
  const renderPercentEmphasisText = (text)=> escapeHtml(String(text || "")).replace(PERCENT_TOKEN_RE, '<span class="reportsPercentEmphasis">$1</span>');

  const formatMetricCompareValue = (metricKey, value)=> {
    const safeValue = Number(value);
    if(!Number.isFinite(safeValue)) return "—";
    if(metricKey === "trips") return `${Math.round(safeValue)} trips`;
    if(metricKey === "pounds") return `${to2(safeValue)} lbs`;
    if(metricKey === "amount") return formatMoney(to2(safeValue));
    if(metricKey === "ppl") return `${formatMoney(to2(safeValue))}/lb`;
    return `${to2(safeValue)}`;
  };

  const formatHomeRecordMetricValue = (metric, trip)=> {
    if(!trip) return "—";
    const lbsNum = Number(trip?.pounds) || 0;
    const amtNum = Number(trip?.amount) || 0;
    if(metric === "lbs") return `${to2(lbsNum)} lbs`;
    if(metric === "amount") return formatMoney(to2(amtNum));
    if(metric === "ppl"){
      const value = (lbsNum > 0 && amtNum > 0) ? (amtNum / lbsNum) : 0;
      return value > 0 ? `${formatMoney(to2(value))}/lb` : "—";
    }
    return "—";
  };

  const findMetricRecordTrip = ({ metric, direction = "max", recordPools, trips })=> {
    const sourceTrips = recordPools?.[metric]?.[direction] || trips;
    const ordered = sourceTrips
      .map((trip)=> ({ trip, value: getTripMetricValue(trip, metric) }))
      .filter((row)=> Number.isFinite(row.value) && row.value > 0)
      .sort((a,b)=> direction === "max" ? (b.value - a.value) : (a.value - b.value));
    return ordered[0]?.trip || null;
  };

  const renderHomeRecordRow = ({ label, metric, trip })=> {
    if(!trip){
      return `
        <div class="homeMetricRecordRow">
          <div class="homeMetricRecordTop">
            <b>${escapeHtml(label)}</b>
            <span>—</span>
          </div>
          <div class="homeMetricRecordMeta">No qualifying trip yet in this Home view.</div>
        </div>
      `;
    }
    const dateText = formatReportDateValue(trip?.date) || "Date not set";
    const dealerText = String(trip?.dealer || "Unknown dealer");
    const areaText = String(resolveTripArea(trip) || "Unknown area");
    return `
      <div class="homeMetricRecordRow">
        <div class="homeMetricRecordTop">
          <b>${escapeHtml(label)}</b>
          <span>${escapeHtml(formatHomeRecordMetricValue(metric, trip))}</span>
        </div>
        <div class="homeMetricRecordMeta">${escapeHtml(dateText)} • ${escapeHtml(dealerText)} • ${escapeHtml(areaText)}</div>
      </div>
    `;
  };

  const renderHomeMetricRecordContext = ({ metricKey, recordPools, trips })=> {
    const entriesByMetric = {
      pounds: [
        { label: "High pounds trip", metric: "lbs", trip: findMetricRecordTrip({ metric: "lbs", direction: "max", recordPools, trips }) },
        { label: "Low pounds trip", metric: "lbs", trip: findMetricRecordTrip({ metric: "lbs", direction: "min", recordPools, trips }) }
      ],
      amount: [
        { label: "High amount trip", metric: "amount", trip: findMetricRecordTrip({ metric: "amount", direction: "max", recordPools, trips }) },
        { label: "Low amount trip", metric: "amount", trip: findMetricRecordTrip({ metric: "amount", direction: "min", recordPools, trips }) }
      ],
      ppl: [
        { label: "High $/lb trip", metric: "ppl", trip: findMetricRecordTrip({ metric: "ppl", direction: "max", recordPools, trips }) },
        { label: "Low $/lb trip", metric: "ppl", trip: findMetricRecordTrip({ metric: "ppl", direction: "min", recordPools, trips }) }
      ],
      trips: [
        { label: "Most pounds trip", metric: "lbs", trip: findMetricRecordTrip({ metric: "lbs", direction: "max", recordPools, trips }) },
        { label: "Highest amount trip", metric: "amount", trip: findMetricRecordTrip({ metric: "amount", direction: "max", recordPools, trips }) }
      ]
    };
    const entries = entriesByMetric[metricKey] || [];
    if(!entries.length) return "";
    return `
      <div class="homeMetricRecordContext" aria-label="Home metric records context">
        <div class="homeMetricRecordTitle">Trip context in this Home view</div>
        <div class="homeMetricRecordRows">
          ${entries.map((entry)=> renderHomeRecordRow(entry)).join("")}
        </div>
      </div>
    `;
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
        if(tone === "up") return `${homePrefix}${isHomeMetricDetail ? "Trips rose." : `ran more trips than ${previousLabel}.`} ${productivityTone === "down" ? "Average pounds per trip slipped while effort increased." : (productivityTone === "up" ? "Average pounds per trip improved with the extra effort." : "Average pounds per trip stayed close." )} ${poundsPerDayTone === "up" ? "Pounds per fishing day also improved." : (poundsPerDayTone === "down" ? "Pounds per fishing day also softened." : "")}`.trim();
        if(tone === "down") return `${homePrefix}${isHomeMetricDetail ? "Trips fell." : `ran fewer trips than ${previousLabel}.`} ${productivityTone === "up" ? "Average pounds per trip improved even with less effort." : (productivityTone === "down" ? "Average pounds per trip also softened." : "Average pounds per trip stayed close." )} ${poundsPerDayTone === "up" ? "Pounds per fishing day still improved." : (poundsPerDayTone === "down" ? "Pounds per fishing day also eased." : "")}`.trim();
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
        if(tone === "up") return `${isHomeMetricDetail ? "Average $/lb improved" : `${currentLabel} improved average $/lb over ${previousLabel}`}${payload.percentValid ? ` by ${pctText(payload.deltaPct)}` : ""}. ${poundsPayload?.compareTone === "down" ? "That happened even with lighter pounds." : (isHomeMetricDetail ? "Pricing strengthened." : "Pricing strengthened versus the prior period.")}`;
        if(tone === "down") return `${isHomeMetricDetail ? "Average $/lb softened" : `${currentLabel} came in below ${previousLabel} on average $/lb`}${payload.percentValid ? ` by ${pctText(payload.deltaPct)}` : ""}. ${poundsPayload?.compareTone === "up" ? "Heavier pounds did not fully offset the softer rate." : (isHomeMetricDetail ? "Pricing softened." : "Pricing softened versus the prior period.")}`;
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

  const renderMetricDetailSection = ({ meta, compareSummary, homeRecordsContext = "", viewModel })=> {
    const detailBackLabel = viewModel.isHomeMetricDetail ? "← Home KPIs" : "← Back to reports";
    const detailEyebrow = viewModel.isHomeMetricDetail ? "Home insight" : meta.eyebrow;
    const detailContext = viewModel.isHomeMetricDetail
      ? String(viewModel.homeScope?.contextText || `Home • Range ${viewModel.rangeLabel} • ${viewModel.homeScope?.tripCount ?? viewModel.trips.length} trips`)
      : `Range ${viewModel.rangeLabel} • ${viewModel.trips.length} trips`;
    const detailChartTitle = viewModel.isHomeMetricDetail ? meta.homeChartTitle : meta.chartTitle;
    const detailChartContext = meta.primaryBasis?.basisLabel || (viewModel.isHomeMetricDetail ? meta.homeChartContext : meta.chartContext);
    const detailInsight = viewModel.isHomeMetricDetail ? meta.homeInsight : meta.insight;
    const compareContractLabel = viewModel.compareFoundation.period?.compareModelLabel || "Comparison";
    const compareContractBasis = viewModel.compareFoundation.period?.currentLabel && viewModel.compareFoundation.period?.previousLabel
      ? `${viewModel.compareFoundation.period.currentLabel} vs ${viewModel.compareFoundation.period.previousLabel}`
      : (meta.primaryBasis?.basisLabel || viewModel.compareFoundation.period?.supportLabel || viewModel.compareFoundation.period?.support || viewModel.compareFoundation.period?.fairWindowLabel || "Matched date range");
    const compareContractText = viewModel.compareFoundation.period?.suppressed
      ? (viewModel.compareFoundation.period?.explanation || "")
      : "";
    const detailSectionLabel = viewModel.isHomeMetricDetail ? "Home metric detail" : "Reports metric detail";
    const secondaryCharts = Array.isArray(meta.secondaryCharts) ? meta.secondaryCharts.filter(Boolean) : [];
    return `
    <section class="${viewModel.detailSurfaceClass}" aria-label="${escapeHtml(meta.title)}">
      <div class="${viewModel.detailCardClass}">
        <button class="btn btn-ghost affordanceBtn ${viewModel.detailBackClass}" type="button" id="reportsMetricBack">${detailBackLabel}</button>
        <div class="${viewModel.detailEyebrowClass}">${escapeHtml(detailEyebrow)}</div>
        <h2 class="${viewModel.detailTitleClass}">${escapeHtml(viewModel.isHomeMetricDetail ? meta.homeTitle : meta.title)}</h2>
        <div class="${viewModel.detailContextClass}">${escapeHtml(detailContext)}</div>
        <div class="reportsMetricSectionRail" aria-hidden="true">
          <span class="reportsMetricSectionPill">${escapeHtml(detailSectionLabel)}</span>
          <span class="reportsMetricSectionPill">Compare basis • ${escapeHtml(compareContractBasis)}</span>
        </div>

        <div class="${viewModel.detailHeroWrapClass}">
          <div class="${viewModel.detailHeroLabelClass}">${escapeHtml(viewModel.isHomeMetricDetail ? meta.homeHeroLabel : meta.heroLabel)}</div>
          <div class="${viewModel.detailHeroValueClass} ${escapeHtml(meta.heroClass)}">${escapeHtml(meta.heroValue)}</div>
        </div>

        <div class="${viewModel.detailCompareClass} tone-${escapeHtml(compareSummary.tone)}">
          <div class="${viewModel.detailCompareTextClass}">${renderPercentEmphasisText(compareSummary.text)}</div>
          <div class="${viewModel.detailCompareRowsClass}">
            <div><span>${escapeHtml(meta.primaryBasis?.currentLabel || viewModel.compareFoundation.period?.currentLabel || "Current")}</span><b>${escapeHtml(compareSummary.currentValue)}</b></div>
            <div><span>${escapeHtml(meta.primaryBasis?.previousLabel || viewModel.compareFoundation.period?.previousLabel || "Previous")}</span><b>${escapeHtml(compareSummary.previousValue)}</b></div>
          </div>
          <div class="${viewModel.detailChartContextClass}">Comparison model • <b>${escapeHtml(compareContractLabel)}</b></div>
          ${compareContractText ? `<div class="${viewModel.detailChartContextClass}">${escapeHtml(compareContractText)}</div>` : ""}
        </div>

        ${homeRecordsContext}

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

        <div class="${viewModel.detailInsightClass}">${escapeHtml(detailInsight)}</div>
      </div>
    </section>
  `;
  };

  const buildMetricDetailView = (viewModel)=> {
    const {
      metricKey,
      compareFoundation,
      primaryBasisByMetric,
      detailCharts,
      isHomeMetricDetail,
      recordPools,
      trips
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
    const detailMeta = {
      trips: {
        title: "Trips breakdown",
        homeTitle: "Trips",
        eyebrow: "Metric breakdown",
        heroLabel: "Trips this range",
        homeHeroLabel: "Trips in latest visible Home month",
        heroValue: formatHeroFromPrimaryBasis("trips", primaryBasis),
        heroClass: "trips",
        comparePayload: primaryPayload,
        primaryBasis,
        chartTitle: "Trips comparison",
        homeChartTitle: "Trips",
        chartContext: primaryChart?.basisLabel || "Matched range trip totals",
        homeChartContext: primaryChart?.basisLabel || "Latest visible month vs previous visible month",
        chartCanvasId: "c_trips",
        insight: "Read this compare card with the chart to confirm trip movement in the same matched range.",
        homeInsight: "Use the compare card and chart together for the clearest trip-count read."
      },
      pounds: {
        title: "Pounds breakdown",
        homeTitle: "Pounds",
        eyebrow: "Metric breakdown",
        heroLabel: "Pounds this range",
        homeHeroLabel: "Pounds in latest visible Home month",
        heroValue: formatHeroFromPrimaryBasis("pounds", primaryBasis),
        heroClass: "lbsBlue",
        comparePayload: primaryPayload,
        primaryBasis,
        chartTitle: "Pounds comparison",
        homeChartTitle: "Pounds",
        chartContext: primaryChart?.basisLabel || "Matched range pound totals",
        homeChartContext: primaryChart?.basisLabel || "Latest visible month vs previous visible month",
        chartCanvasId: "c_lbs",
        insight: "Use this compare card and chart together so the headline and values stay aligned to one matched range.",
        homeInsight: "Use the compare card and chart together to judge pound movement."
      },
      amount: {
        title: "Amount breakdown",
        homeTitle: "Amount",
        eyebrow: "Metric breakdown",
        heroLabel: "Amount this range",
        homeHeroLabel: "Amount in latest visible Home month",
        heroValue: formatHeroFromPrimaryBasis("amount", primaryBasis),
        heroClass: "money",
        comparePayload: primaryPayload,
        primaryBasis,
        chartTitle: "Amount comparison",
        homeChartTitle: "Amount",
        chartContext: primaryChart?.basisLabel || "Matched range amount totals",
        homeChartContext: primaryChart?.basisLabel || "Latest visible month vs previous visible month",
        chartCanvasId: "c_amount_detail",
        secondaryCharts: [
          detailCharts.amountTrend ? {
            title: "Amount trend across this range",
            context: isHomeMetricDetail
              ? "Context • visible Home months in this filter"
              : "Context • full months in this active Reports range",
            canvasId: "c_amount_trend",
            chartModel: detailCharts.amountTrend,
            metricKey: "amount"
          } : null,
          {
            title: "Amount by dealer mix",
            context: "Context for this same active filter range",
            canvasId: "c_dealer"
          }
        ],
        insight: "Start with the compare chart, then use trend and dealer mix for added context.",
        homeInsight: "Read the main comparison first, then use trend and dealer mix for added context."
      },
      ppl: {
        title: "$/lb breakdown",
        homeTitle: "Avg $/lb",
        eyebrow: "Metric breakdown",
        heroLabel: "Average $/lb this range",
        homeHeroLabel: "Average $/lb in latest visible Home month",
        heroValue: formatHeroFromPrimaryBasis("ppl", primaryBasis),
        heroClass: "rate ppl",
        comparePayload: primaryPayload,
        primaryBasis,
        chartTitle: "Average $/lb comparison",
        homeChartTitle: "Avg $/lb",
        chartContext: primaryChart?.basisLabel || "Matched range average $/lb",
        homeChartContext: primaryChart?.basisLabel || "Latest visible month vs previous visible month",
        chartCanvasId: "c_ppl",
        insight: "Use this compare card and chart to read matched-range pricing without mixing full-range averages.",
        homeInsight: "Use the compare card and chart together to judge pricing."
      }
    };
    const meta = detailMeta[metricKey];
    if(!meta) return "";
    const compareSummary = buildMetricCompareSummary({ metricKey, payload: meta.comparePayload, compareFoundation, isHomeMetricDetail });
    const homeRecordsContext = isHomeMetricDetail ? renderHomeMetricRecordContext({ metricKey, recordPools, trips }) : "";
    return renderMetricDetailSection({ meta, compareSummary, homeRecordsContext, viewModel });
  };

  return {
    buildHomeMetricDetailFoundation,
    buildMetricDetailView
  };
}
