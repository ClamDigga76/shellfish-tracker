import { buildEntityPeriodRows, buildMonthWindowValueSeries, summarizeTripsByMonthWindow } from "./reports_aggregation_v5.js";

export function buildReportsCompareFoundation({ trips, monthRows, dealerRows, areaRows }){
  const safeTrips = Array.isArray(trips) ? trips : [];
  const safeMonths = Array.isArray(monthRows) ? monthRows : [];
  const latestMonth = safeMonths[safeMonths.length - 1] || null;
  const priorMonth = safeMonths[safeMonths.length - 2] || null;

  const missingPeriod = buildSuppressedPeriod({
    reason: "Need at least two months for comparison.",
    suppressionCode: "missing-periods"
  });

  if(!latestMonth || !priorMonth){
    return {
      period: missingPeriod,
      metrics: {},
      detailCharts: buildDetailCharts({ period: missingPeriod, monthRows: safeMonths, trips: safeTrips }),
      dealer: buildSuppressedEntityPayload({ entityType: "dealer", reason: missingPeriod.reason, suppressionCode: missingPeriod.suppressionCode }),
      area: buildSuppressedEntityPayload({ entityType: "area", reason: missingPeriod.reason, suppressionCode: missingPeriod.suppressionCode })
    };
  }

  const latestKey = String(latestMonth.monthKey || "");
  const priorKey = String(priorMonth.monthKey || "");
  const monthAdjacent = isPriorMonth(latestKey, priorKey);
  if(!monthAdjacent){
    const reason = "Comparison suppressed: missing adjacent prior month.";
    const period = buildSuppressedPeriod({
      reason,
      suppressionCode: "non-adjacent-months",
      currentLabel: latestMonth.label,
      previousLabel: priorMonth.label
    });
    return {
      period,
      metrics: {},
      detailCharts: buildDetailCharts({ period, monthRows: safeMonths, trips: safeTrips }),
      dealer: buildSuppressedEntityPayload({ entityType: "dealer", reason, suppressionCode: period.suppressionCode }),
      area: buildSuppressedEntityPayload({ entityType: "area", reason, suppressionCode: period.suppressionCode })
    };
  }

  const periodRules = getPeriodRules(latestKey, safeTrips);
  const current = summarizeTripsByMonthWindow(safeTrips, latestKey, periodRules.dayLimit);
  const previous = summarizeTripsByMonthWindow(safeTrips, priorKey, periodRules.dayLimit);
  const periodSupport = buildPeriodSupport({ current, previous });
  const periodComparable = periodSupport.comparable;
  const period = {
    comparable: periodComparable,
    suppressed: !periodComparable,
    confidence: periodComparable ? classifyConfidenceFromScore(periodSupport.score) : "none",
    confidenceLabel: periodComparable ? confidenceLabelFromScore(periodSupport.score) : "suppressed",
    trustLabel: periodComparable ? confidenceLabelFromScore(periodSupport.score) : "suppressed",
    reason: periodComparable ? "" : periodSupport.reason,
    suppressionCode: periodComparable ? "" : periodSupport.suppressionCode,
    explanation: periodComparable ? periodSupport.explanation : periodSupport.reason,
    currentLabel: latestMonth.label,
    previousLabel: priorMonth.label,
    fairWindowLabel: periodRules.dayLimit < periodRules.daysInCurrent
      ? `Days 1-${periodRules.dayLimit} in each month`
      : "Full month totals",
    support: periodSupport.summary,
    current,
    previous
  };

  const metrics = {
    amount: buildMetricComparePayload({
      metricKey: "amount",
      label: "Amount",
      currentValue: current.amount,
      previousValue: previous.amount,
      period,
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
      period,
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
      period,
      minBaseline: 0.1,
      epsilonPct: 0.035,
      minTrips: 2,
      minUniqueDays: 2,
      requiredBaselineText: "at least 10 lbs in each period",
      baselineOk: current.lbs >= 10 && previous.lbs >= 10,
      baselineReason: `Suppressed: average $/lb needs at least 10 lbs in each period (now ${toWholeOrTwo(current.lbs)} lbs, before ${toWholeOrTwo(previous.lbs)} lbs).`
    }),
    trips: buildMetricComparePayload({
      metricKey: "trips",
      label: "Trips",
      currentValue: current.trips,
      previousValue: previous.trips,
      period,
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
    minEntityTrips: 2,
    minBaselineAmount: 25
  });

  const area = buildEntityComparePayload({
    entityRows: areaRows,
    safeTrips,
    entityType: "area",
    metricKey: "amount",
    period,
    minEntityTrips: 2,
    minBaselineAmount: 25
  });

  return {
    period,
    metrics,
    detailCharts: buildDetailCharts({ period, monthRows: safeMonths, trips: safeTrips }),
    dealer,
    area
  };
}

function buildMetricComparePayload({ metricKey, label, currentValue, previousValue, period, minBaseline, epsilonPct, minTrips, minUniqueDays, baselineOk, baselineReason, requiredBaselineText }){
  const cur = safeNum(currentValue);
  const prev = safeNum(previousValue);
  const delta = cur - prev;
  const hasBaseline = typeof baselineOk === "boolean" ? baselineOk : prev >= minBaseline;
  const canCompare = !!period?.comparable && hasBaseline;
  const deltaPct = prev > 0 ? (delta / prev) : null;
  const supportScore = scoreSupport({
    currentTrips: period?.current?.trips,
    previousTrips: period?.previous?.trips,
    currentDays: period?.current?.uniqueDays,
    previousDays: period?.previous?.uniqueDays,
    baselineRatio: minBaseline > 0 ? Math.min(cur, prev) / minBaseline : 1
  });
  const reason = !period?.comparable
    ? (period.reason || `Suppressed: need at least ${minTrips} trips and ${minUniqueDays} fishing days in each period.`)
    : (!hasBaseline
      ? (baselineReason || `Suppressed: ${label} needs a stronger baseline${requiredBaselineText ? ` (${requiredBaselineText})` : ""}.`)
      : "");

  return {
    metricKey,
    label,
    currentValue: cur,
    previousValue: prev,
    deltaValue: delta,
    deltaPct,
    compareTone: canCompare ? toneFromDelta(deltaPct, epsilonPct) : "steady",
    suppressed: !canCompare,
    reason,
    explanation: canCompare
      ? `${label} compare uses ${period?.fairWindowLabel || "the same fair window"}. ${confidenceLabelFromScore(supportScore) === "strong" ? "Support is solid in both periods." : (confidenceLabelFromScore(supportScore) === "early" ? "Read as an early signal while the sample builds." : "Support is lighter, so read this carefully.")}`
      : reason,
    suppressionCode: !canCompare
      ? (!period?.comparable ? (period.suppressionCode || "period-low-data") : "baseline-too-weak")
      : "",
    confidence: canCompare ? classifyConfidenceFromScore(supportScore) : "none",
    confidenceLabel: canCompare ? confidenceLabelFromScore(supportScore) : "suppressed",
    trustLabel: canCompare ? confidenceLabelFromScore(supportScore) : "suppressed",
    percentValid: canCompare && deltaPct != null,
    support: {
      currentTrips: safeNum(period?.current?.trips),
      previousTrips: safeNum(period?.previous?.trips),
      currentUniqueDays: safeNum(period?.current?.uniqueDays),
      previousUniqueDays: safeNum(period?.previous?.uniqueDays),
      baselineFloor: minBaseline,
      baselineMet: hasBaseline
    }
  };
}

function buildEntityComparePayload({ entityRows, safeTrips, entityType, period, minEntityTrips, minBaselineAmount }){
  if(!period.comparable){
    return buildSuppressedEntityPayload({
      entityType,
      reason: period.reason || `No ${entityType} data for comparable periods.`,
      suppressionCode: period.suppressionCode || "period-low-data"
    });
  }

  const entityStats = buildEntityPeriodRows({ trips: safeTrips, entityType, period });
  const movement = buildEntityMovementModel({
    entityStats,
    entityType,
    minEntityTrips,
    minBaselineAmount,
    period
  });
  const ranked = movement.ranked;
  const viable = movement.compareTarget;
  const fallbackLeader = (Array.isArray(entityRows) ? entityRows[0] : null) || movement.currentLeader || ranked[0] || null;

  if(!viable){
    const entityName = String(fallbackLeader?.name || "").trim();
    const curTrips = safeNum(fallbackLeader?.current?.trips);
    const prevTrips = safeNum(fallbackLeader?.previous?.trips);
    const prevAmount = safeNum(fallbackLeader?.previous?.amount);
    return {
      ...buildSuppressedEntityPayload({
        entityType,
        entityName,
        confidence: "none",
        confidenceLabel: "suppressed",
        suppressionCode: "entity-baseline-too-sparse",
        reason: `${capitalize(entityType)} compare suppressed: no ${entityType} has at least ${minEntityTrips} trips in both periods and ${formatAmountFloor(minBaselineAmount)} in the earlier period.${entityName ? ` Closest candidate: ${entityName} (${curTrips}/${prevTrips} trips, ${formatAmountFloor(prevAmount)} earlier).` : ""}`
      }),
      leaders: buildLeadersPayload(movement),
      movement: buildMovementPayload(movement),
      shareShift: buildShareShiftPayload(movement),
      leaderChange: buildLeaderChangePayload(movement)
    };
  }

  const metric = buildMetricComparePayload({
    metricKey: `${entityType}-amount`,
    label: `${capitalize(entityType)} amount`,
    currentValue: viable.current.amount,
    previousValue: viable.previous.amount,
    period,
    minBaseline: minBaselineAmount,
    epsilonPct: 0.06,
    minTrips: minEntityTrips,
    minUniqueDays: 1,
    baselineOk: viable.previous.amount >= minBaselineAmount,
    baselineReason: `${capitalize(entityType)} compare suppressed: ${viable.name} needs at least ${formatAmountFloor(minBaselineAmount)} in the earlier period for a fair % compare.`
  });

  return {
    ...metric,
    suppressed: false,
    reason: "",
    explanation: buildEntityExplanation({ entityType, viable, movement }),
    entityName: viable.name,
    currentTrips: viable.current.trips,
    previousTrips: viable.previous.trips,
    currentUniqueDays: viable.current.uniqueDays,
    previousUniqueDays: viable.previous.uniqueDays,
    compareTarget: viable.name,
    candidateCount: ranked.length,
    confidence: viable.confidence,
    confidenceLabel: viable.confidenceLabel,
    trustLabel: viable.confidenceLabel,
    currentSharePct: viable.currentSharePct,
    previousSharePct: viable.previousSharePct,
    shareDeltaPct: viable.shareDeltaPct,
    leaders: buildLeadersPayload(movement),
    movement: buildMovementPayload(movement),
    shareShift: buildShareShiftPayload(movement),
    leaderChange: buildLeaderChangePayload(movement)
  };
}

function buildEntityMovementModel({ entityStats, entityType, minEntityTrips, minBaselineAmount, period }){
  const currentTotal = safeNum(period?.current?.amount);
  const previousTotal = safeNum(period?.previous?.amount);
  const enriched = (Array.isArray(entityStats) ? entityStats : []).map((row)=> enrichEntityMovementRow({
    row,
    currentTotal,
    previousTotal,
    minEntityTrips,
    minBaselineAmount
  }));
  const ranked = enriched
    .filter((row)=> row.current.trips > 0 || row.previous.trips > 0)
    .sort((a, b)=> compareEntityRows(a, b));
  const compareCandidates = ranked.filter((row)=> row.compareEligible);
  const compareTarget = compareCandidates[0] || null;
  const currentLeader = ranked.filter((row)=> row.current.amount > 0).sort((a, b)=> b.current.amount - a.current.amount)[0] || null;
  const previousLeader = ranked.filter((row)=> row.previous.amount > 0).sort((a, b)=> b.previous.amount - a.previous.amount)[0] || null;
  const positiveMovers = ranked.filter((row)=> row.movementEligible && row.deltaValue > 0).sort((a, b)=> compareMovementRows(a, b));
  const negativeMovers = ranked.filter((row)=> row.movementEligible && row.deltaValue < 0).sort((a, b)=> compareMovementRows(a, b));
  const shareGainers = ranked.filter((row)=> row.shareShiftEligible && row.shareDeltaPct > 0).sort((a, b)=> compareShareShiftRows(a, b));
  const shareDecliners = ranked.filter((row)=> row.shareShiftEligible && row.shareDeltaPct < 0).sort((a, b)=> compareShareShiftRows(a, b));
  const leaderChangeSupported = !!currentLeader && !!previousLeader && currentLeader.name !== previousLeader.name
    && currentLeader.movementEligible && previousLeader.movementEligible;

  return {
    entityType,
    ranked,
    compareTarget,
    currentLeader,
    previousLeader,
    topGainer: positiveMovers[0] || null,
    topDecliner: negativeMovers[0] || null,
    topShareGainer: shareGainers[0] || null,
    topShareDecliner: shareDecliners[0] || null,
    leaderChangeSupported,
    currentTotal,
    previousTotal
  };
}

function enrichEntityMovementRow({ row, currentTotal, previousTotal, minEntityTrips, minBaselineAmount }){
  const currentAmount = safeNum(row?.current?.amount);
  const previousAmount = safeNum(row?.previous?.amount);
  const deltaValue = currentAmount - previousAmount;
  const deltaPct = previousAmount >= minBaselineAmount ? (deltaValue / previousAmount) : null;
  const currentSharePct = currentTotal > 0 ? (currentAmount / currentTotal) * 100 : 0;
  const previousSharePct = previousTotal > 0 ? (previousAmount / previousTotal) * 100 : 0;
  const shareDeltaPct = currentSharePct - previousSharePct;
  const supportScore = scoreSupport({
    currentTrips: row?.current?.trips,
    previousTrips: row?.previous?.trips,
    currentDays: row?.current?.uniqueDays,
    previousDays: row?.previous?.uniqueDays,
    baselineRatio: previousAmount / Math.max(1, minBaselineAmount)
  });
  const supportConfidence = classifyConfidenceFromScore(supportScore);
  const movementBaselineAmount = Math.max(15, minBaselineAmount * 0.6);
  const movementEligible = row?.current?.trips >= 1
    && row?.previous?.trips >= 1
    && row?.current?.uniqueDays >= 1
    && row?.previous?.uniqueDays >= 1
    && (safeNum(row?.current?.trips) + safeNum(row?.previous?.trips)) >= Math.max(3, minEntityTrips + 1)
    && (currentAmount >= movementBaselineAmount || previousAmount >= movementBaselineAmount);
  const compareEligible = row?.current?.trips >= minEntityTrips
    && row?.previous?.trips >= minEntityTrips
    && previousAmount >= minBaselineAmount;
  const shareShiftEligible = movementEligible && currentTotal >= minBaselineAmount * 3 && previousTotal >= minBaselineAmount * 3;
  const movementStrength = Math.abs(deltaValue) + (Math.abs(shareDeltaPct) * 2) + (supportScore * 10);

  return {
    name: String(row?.name || "").trim() || "(Unspecified)",
    current: row?.current || { amount: 0, trips: 0, uniqueDays: 0 },
    previous: row?.previous || { amount: 0, trips: 0, uniqueDays: 0 },
    deltaValue,
    deltaPct,
    currentSharePct,
    previousSharePct,
    shareDeltaPct,
    compareTone: deltaPct == null ? toneFromDelta(deltaValue === 0 ? 0 : (deltaValue > 0 ? 1 : -1), 0.06) : toneFromDelta(deltaPct, 0.06),
    movementEligible,
    compareEligible,
    shareShiftEligible,
    supportScore,
    confidence: supportConfidence,
    confidenceLabel: confidenceLabelFromScore(supportScore),
    movementStrength
  };
}

function buildMovementPayload(movement){
  return {
    topGainer: buildMovementEntitySummary(movement?.topGainer),
    topDecliner: buildMovementEntitySummary(movement?.topDecliner),
    topShareGainer: buildMovementEntitySummary(movement?.topShareGainer),
    topShareDecliner: buildMovementEntitySummary(movement?.topShareDecliner),
    insightCount: [movement?.topGainer, movement?.topDecliner, movement?.topShareGainer, movement?.topShareDecliner].filter(Boolean).length
  };
}

function buildLeadersPayload(movement){
  return {
    current: buildMovementEntitySummary(movement?.currentLeader),
    previous: buildMovementEntitySummary(movement?.previousLeader)
  };
}

function buildLeaderChangePayload(movement){
  const currentLeader = movement?.currentLeader;
  const previousLeader = movement?.previousLeader;
  const changed = !!movement?.leaderChangeSupported;
  return {
    supported: !!currentLeader && !!previousLeader,
    changed,
    currentLeader: buildMovementEntitySummary(currentLeader),
    previousLeader: buildMovementEntitySummary(previousLeader)
  };
}

function buildShareShiftPayload(movement){
  return {
    gainer: buildMovementEntitySummary(movement?.topShareGainer),
    decliner: buildMovementEntitySummary(movement?.topShareDecliner)
  };
}

function buildMovementEntitySummary(row){
  if(!row) return null;
  return {
    name: row.name,
    currentAmount: row.current.amount,
    previousAmount: row.previous.amount,
    deltaValue: row.deltaValue,
    deltaPct: row.deltaPct,
    compareTone: row.compareTone,
    currentTrips: row.current.trips,
    previousTrips: row.previous.trips,
    currentUniqueDays: row.current.uniqueDays,
    previousUniqueDays: row.previous.uniqueDays,
    currentSharePct: row.currentSharePct,
    previousSharePct: row.previousSharePct,
    shareDeltaPct: row.shareDeltaPct,
    confidence: row.confidence,
    confidenceLabel: row.confidenceLabel
  };
}

function buildEntityExplanation({ entityType, viable, movement }){
  const leaderChange = buildLeaderChangePayload(movement);
  const shareShift = buildShareShiftPayload(movement);
  const parts = [
    `${viable.name} was picked as the fairest ${entityType} compare target because it has support in both periods.`
  ];
  if(leaderChange.changed && leaderChange.currentLeader && leaderChange.previousLeader){
    parts.push(`${leaderChange.currentLeader.name} took the lead from ${leaderChange.previousLeader.name}.`);
  }
  if(shareShift.gainer && Math.abs(safeNum(shareShift.gainer.shareDeltaPct)) >= 3){
    parts.push(`${shareShift.gainer.name} gained ${formatShareDelta(shareShift.gainer.shareDeltaPct)} of ${entityType} dollars.`);
  }
  if(shareShift.decliner && Math.abs(safeNum(shareShift.decliner.shareDeltaPct)) >= 3 && shareShift.decliner.name !== shareShift.gainer?.name){
    parts.push(`${shareShift.decliner.name} gave back ${formatShareDelta(shareShift.decliner.shareDeltaPct)}.`);
  }
  return parts.join(" ");
}

function compareEntityRows(a, b){
  const aScore = scoreSupport({
    currentTrips: a.current.trips,
    previousTrips: a.previous.trips,
    currentDays: a.current.uniqueDays,
    previousDays: a.previous.uniqueDays,
    baselineRatio: a.previous.amount / 25
  }) + ((a.current.amount + a.previous.amount) / 1000) + (Math.abs(a.shareDeltaPct) / 20);
  const bScore = scoreSupport({
    currentTrips: b.current.trips,
    previousTrips: b.previous.trips,
    currentDays: b.current.uniqueDays,
    previousDays: b.previous.uniqueDays,
    baselineRatio: b.previous.amount / 25
  }) + ((b.current.amount + b.previous.amount) / 1000) + (Math.abs(b.shareDeltaPct) / 20);
  return bScore - aScore;
}

function compareMovementRows(a, b){
  return b.movementStrength - a.movementStrength;
}

function compareShareShiftRows(a, b){
  return Math.abs(b.shareDeltaPct) - Math.abs(a.shareDeltaPct) || compareMovementRows(a, b);
}

function buildPeriodSupport({ current, previous }){
  const currentTrips = safeNum(current?.trips);
  const previousTrips = safeNum(previous?.trips);
  const currentDays = safeNum(current?.uniqueDays);
  const previousDays = safeNum(previous?.uniqueDays);
  const deficits = [];
  if(currentTrips < 2) deficits.push(`current period has ${currentTrips} trip${currentTrips === 1 ? "" : "s"}`);
  if(previousTrips < 2) deficits.push(`previous period has ${previousTrips} trip${previousTrips === 1 ? "" : "s"}`);
  if(currentDays < 2) deficits.push(`current period has ${currentDays} unique day${currentDays === 1 ? "" : "s"}`);
  if(previousDays < 2) deficits.push(`previous period has ${previousDays} unique day${previousDays === 1 ? "" : "s"}`);
  const comparable = !deficits.length;
  const score = scoreSupport({ currentTrips, previousTrips, currentDays, previousDays, baselineRatio: 1 });
  return {
    comparable,
    score,
    suppressionCode: comparable ? "" : "period-low-data",
    reason: comparable
      ? ""
      : `Comparison suppressed: ${joinReasonList(deficits)}. Need at least 2 trips and 2 unique days in each period.`,
    explanation: comparable
      ? `${confidenceLabelFromScore(score) === "strong" ? "Strong" : (confidenceLabelFromScore(score) === "early" ? "Early" : "Weak")} compare window using ${currentTrips} vs ${previousTrips} trips across ${currentDays} vs ${previousDays} fishing days.`
      : `Suppressed because ${joinReasonList(deficits)}.`,
    summary: {
      currentTrips,
      previousTrips,
      currentUniqueDays: currentDays,
      previousUniqueDays: previousDays
    }
  };
}

function buildSuppressedPeriod({ reason, suppressionCode, currentLabel = "", previousLabel = "" }){
  return {
    comparable: false,
    suppressed: true,
    reason,
    suppressionCode,
    explanation: reason,
    confidence: "none",
    confidenceLabel: "suppressed",
    trustLabel: "suppressed",
    currentLabel,
    previousLabel,
    support: {
      currentTrips: 0,
      previousTrips: 0,
      currentUniqueDays: 0,
      previousUniqueDays: 0
    }
  };
}

function buildSuppressedEntityPayload({ entityType, reason, suppressionCode, entityName = "", confidence = "none", confidenceLabel = "suppressed" }){
  return {
    suppressed: true,
    reason,
    explanation: reason,
    confidence,
    confidenceLabel,
    trustLabel: confidenceLabel,
    suppressionCode,
    entityName,
    entityType
  };
}

function buildDetailCharts({ period, monthRows, trips }){
  const current = period?.current || null;
  const previous = period?.previous || null;
  const labels = [
    String(period?.currentLabel || "Current"),
    String(period?.previousLabel || "Previous")
  ];
  return {
    trips: buildMetricDetailCompareChart({ labels, currentValue: current?.trips, previousValue: previous?.trips, metricKey: "trips" }),
    pounds: buildMetricDetailCompareChart({ labels, currentValue: current?.lbs, previousValue: previous?.lbs, metricKey: "pounds" }),
    amount: buildMetricDetailAmountCharts({ period, monthRows, trips }),
    ppl: buildMetricDetailCompareChart({ labels, currentValue: current?.ppl, previousValue: previous?.ppl, metricKey: "ppl" })
  };
}

function buildMetricDetailCompareChart({ labels, currentValue, previousValue, metricKey }){
  return {
    chartType: "compare-bars",
    metricKey,
    basisLabel: String(labels?.length ? `Fair compare window • ${labels.join(" vs ")}` : "Fair compare window"),
    labels: Array.isArray(labels) ? labels.slice(0, 2) : ["Current", "Previous"],
    values: [safeNum(currentValue), safeNum(previousValue)]
  };
}

function buildMetricDetailAmountCharts({ period, monthRows, trips }){
  const dayLimit = safeNum(period?.current?.dayLimit) || safeNum(period?.previous?.dayLimit) || 0;
  const trendRows = buildMonthWindowValueSeries({ monthRows, trips, dayLimit, metricKey: "amount" });
  return {
    chartType: "time-series",
    metricKey: "amount",
    basisLabel: dayLimit ? `Amount by month using days 1-${dayLimit} in each month` : "Amount by month using the same compare basis",
    labels: trendRows.map((row)=> row.label),
    values: trendRows.map((row)=> row.value),
    compareLabels: [String(period?.currentLabel || "Current"), String(period?.previousLabel || "Previous")],
    compareValues: [safeNum(period?.current?.amount), safeNum(period?.previous?.amount)]
  };
}

function scoreSupport({ currentTrips, previousTrips, currentDays, previousDays, baselineRatio }){
  const tripsFloor = Math.min(safeNum(currentTrips), safeNum(previousTrips));
  const daysFloor = Math.min(safeNum(currentDays), safeNum(previousDays));
  const tripScore = Math.min(1.5, tripsFloor / 4);
  const dayScore = Math.min(1.25, daysFloor / 3);
  const baselineScore = Math.min(1.25, safeNum(baselineRatio));
  return tripScore + dayScore + baselineScore;
}

function classifyConfidenceFromScore(score){
  if(score >= 3.35) return "high";
  if(score >= 2.45) return "medium";
  return "low";
}

function confidenceLabelFromScore(score){
  if(score >= 3.35) return "strong";
  if(score >= 2.45) return "early";
  return "weak";
}

function joinReasonList(items){
  const safeItems = (Array.isArray(items) ? items : []).filter(Boolean);
  if(!safeItems.length) return "not enough data";
  if(safeItems.length === 1) return safeItems[0];
  if(safeItems.length === 2) return `${safeItems[0]} and ${safeItems[1]}`;
  return `${safeItems.slice(0, -1).join(", ")}, and ${safeItems[safeItems.length - 1]}`;
}

function formatAmountFloor(value){
  return `$${Math.round(safeNum(value))}`;
}

function formatShareDelta(value){
  const rounded = Math.abs(Math.round(safeNum(value)));
  return `${rounded} share pt${rounded === 1 ? "" : "s"}`;
}

function toWholeOrTwo(value){
  const v = safeNum(value);
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
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
