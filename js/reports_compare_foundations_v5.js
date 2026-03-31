import { buildEntityPeriodRows, buildMonthWindowValueSeries, normalizeChronologicalRows, summarizeTripsByMonthWindow } from "./reports_aggregation_v5.js";

export function buildReportsCompareFoundation({ trips, monthRows, dealerRows, areaRows }){
  const safeTrips = Array.isArray(trips) ? trips : [];
  const safeMonths = normalizeChronologicalRows(Array.isArray(monthRows) ? monthRows : []);
  const latestMonth = safeMonths[safeMonths.length - 1] || null;
  const priorMonth = safeMonths[safeMonths.length - 2] || null;

  const missingPeriod = buildSuppressedPeriod({
    reason: "Need at least two months for comparison.",
    suppressionCode: "missing-periods"
  });

  if(!latestMonth || !priorMonth){
    const detailCharts = buildDetailCharts({ period: missingPeriod, monthRows: safeMonths, trips: safeTrips });
    return {
      period: missingPeriod,
      metrics: {},
      detailCharts,
      primaryBasis: buildMetricDetailPrimaryBasisMap({ period: missingPeriod, metrics: {}, detailCharts }),
      dealer: buildSuppressedEntityPayload({ entityType: "dealer", reason: missingPeriod.reason, suppressionCode: missingPeriod.suppressionCode }),
      area: buildSuppressedEntityPayload({ entityType: "area", reason: missingPeriod.reason, suppressionCode: missingPeriod.suppressionCode })
    };
  }

  const latestKey = String(latestMonth.monthKey || "");
  const priorKey = String(priorMonth.monthKey || "");
  const monthAdjacent = isPriorMonth(latestKey, priorKey);
  if(!monthAdjacent){
    const reason = "Compare held back because the previous month is missing.";
    const period = buildSuppressedPeriod({
      reason,
      suppressionCode: "non-adjacent-months",
      currentLabel: latestMonth.label,
      previousLabel: priorMonth.label
    });
    const detailCharts = buildDetailCharts({ period, monthRows: safeMonths, trips: safeTrips });
    return {
      period,
      metrics: {},
      detailCharts,
      primaryBasis: buildMetricDetailPrimaryBasisMap({ period, metrics: {}, detailCharts }),
      dealer: buildSuppressedEntityPayload({ entityType: "dealer", reason, suppressionCode: period.suppressionCode }),
      area: buildSuppressedEntityPayload({ entityType: "area", reason, suppressionCode: period.suppressionCode })
    };
  }

  const periodRules = getPeriodRules(latestKey, safeTrips);
  const current = summarizeTripsByMonthWindow(safeTrips, latestKey, periodRules.dayLimit);
  const previous = summarizeTripsByMonthWindow(safeTrips, priorKey, periodRules.dayLimit);
  const periodSupport = buildPeriodSupport({ current, previous });
  const periodComparable = periodSupport.comparable;
  const compareDayRangeLabel = buildCompareDayRangeLabel({
    currentMonthKey: latestKey,
    previousMonthKey: priorKey,
    dayLimit: periodRules.dayLimit,
    isPartial: periodRules.dayLimit < periodRules.daysInCurrent
  });
  const fairWindowLabel = periodRules.dayLimit < periodRules.daysInCurrent
    ? `Days 1-${periodRules.dayLimit} in each month`
    : "Full month totals";
  const period = {
    comparable: periodComparable,
    suppressed: !periodComparable,
    confidence: periodComparable ? classifyConfidenceFromScore(periodSupport.score) : "none",
    confidenceLabel: periodComparable ? confidenceLabelFromScore(periodSupport.score) : "suppressed",
    trustLabel: periodComparable ? confidenceLabelFromScore(periodSupport.score) : "suppressed",
    reason: periodComparable ? "" : periodSupport.reason,
    suppressionCode: periodComparable ? "" : periodSupport.suppressionCode,
    explanation: periodComparable
      ? `${latestMonth.label} vs ${priorMonth.label}. ${periodSupport.explanation}`
      : periodSupport.reason,
    currentLabel: latestMonth.label,
    previousLabel: priorMonth.label,
    fairWindowLabel,
    compareDayRangeLabel,
    compareModel: "reports-fair-window",
    compareModelLabel: "Comparison",
    supportLabel: `${latestMonth.label} vs ${priorMonth.label}`,
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
      baselineReason: `Average $/lb is held back until each period has at least 10 lbs (now ${toWholeOrTwo(current.lbs)} lbs, before ${toWholeOrTwo(previous.lbs)} lbs).`
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
    period,
    minEntityTrips: 2,
    minBaselineAmount: 25
  });

  const area = buildEntityComparePayload({
    entityRows: areaRows,
    safeTrips,
    entityType: "area",
    period,
    minEntityTrips: 2,
    minBaselineAmount: 25
  });

  const detailCharts = buildDetailCharts({ period, monthRows: safeMonths, trips: safeTrips });
  return {
    period,
    metrics,
    detailCharts,
    primaryBasis: buildMetricDetailPrimaryBasisMap({ period, metrics, detailCharts }),
    dealer,
    area
  };
}


function buildMetricDetailPrimaryBasisMap({ period, metrics, detailCharts }){
  const safePeriod = period && typeof period === "object" ? period : {};
  const safeMetrics = metrics && typeof metrics === "object" ? metrics : {};
  const safeCharts = detailCharts && typeof detailCharts === "object" ? detailCharts : {};
  const basisLabel = String(safePeriod.supportLabel || safePeriod.support || safePeriod.fairWindowLabel || "Comparable window");
  const currentLabel = String(safePeriod.currentLabel || "Current");
  const previousLabel = String(safePeriod.previousLabel || "Previous");
  return {
    trips: buildMetricPrimaryBasis({ metricKey: "trips", metricPayload: safeMetrics.trips, primaryChart: safeCharts.trips, basisLabel, currentLabel, previousLabel, period: safePeriod }),
    pounds: buildMetricPrimaryBasis({ metricKey: "pounds", metricPayload: safeMetrics.pounds, primaryChart: safeCharts.pounds, basisLabel, currentLabel, previousLabel, period: safePeriod }),
    amount: buildMetricPrimaryBasis({ metricKey: "amount", metricPayload: safeMetrics.amount, primaryChart: safeCharts.amountCompare || safeCharts.amount, basisLabel, currentLabel, previousLabel, period: safePeriod }),
    ppl: buildMetricPrimaryBasis({ metricKey: "ppl", metricPayload: safeMetrics.ppl, primaryChart: safeCharts.ppl, basisLabel, currentLabel, previousLabel, period: safePeriod })
  };
}

function buildMetricPrimaryBasis({ metricKey, metricPayload, primaryChart, basisLabel, currentLabel, previousLabel, period }){
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
    period
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
    ? (period.reason || `Compare held back until each period has at least ${minTrips} trips and ${minUniqueDays} fishing days.`)
    : (!hasBaseline
      ? (baselineReason || `${label} is held back until the baseline is stronger${requiredBaselineText ? ` (${requiredBaselineText})` : ""}.`)
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
      ? `${label} is compared with ${period?.previousLabel || "the earlier period"} and ${period?.currentLabel || "the current period"}. ${confidenceLabelFromScore(supportScore) === "strong" ? "Both periods have enough data for a steadier read." : (confidenceLabelFromScore(supportScore) === "early" ? "Treat this as an early read while more trips build." : "This is a lighter read, so keep the sample size in mind.")}`
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
  const metricConfig = getEntityMetricConfig(entityType);
  const movement = buildEntityMovementModel({
    entityStats,
    entityType,
    metricConfig,
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
        reason: `No ${entityType} compare yet: no ${entityType} has enough support in both periods for ${metricConfig.primaryLabel.toLowerCase()} compare.${entityName ? ` Closest option: ${entityName} (${curTrips}/${prevTrips} trips, ${formatAmountFloor(prevAmount)} earlier).` : ""}`
      }),
      leaders: buildLeadersPayload(movement),
      movement: buildMovementPayload(movement),
      shareShift: buildShareShiftPayload(movement),
      leaderChange: buildLeaderChangePayload(movement)
    };
  }

  const metric = buildMetricComparePayload({
    metricKey: `${entityType}-${metricConfig.primaryMetricKey}`,
    label: `${capitalize(entityType)} ${metricConfig.primaryLabel.toLowerCase()}`,
    currentValue: safeNum(viable.current?.[metricConfig.primaryMetricKey]),
    previousValue: safeNum(viable.previous?.[metricConfig.primaryMetricKey]),
    period,
    minBaseline: metricConfig.primaryBaseline,
    epsilonPct: metricConfig.primaryEpsilonPct,
    minTrips: minEntityTrips,
    minUniqueDays: 1,
    baselineOk: metricConfig.baselineOk(viable, minEntityTrips, minBaselineAmount),
    baselineReason: metricConfig.baselineReason(viable, minEntityTrips, minBaselineAmount)
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
    compareMetric: metricConfig.primaryMetricKey,
    compareMetricLabel: metricConfig.primaryLabel,
    shareMetric: metricConfig.shareMetricKey,
    shareLabel: metricConfig.shareLabel,
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

function buildEntityMovementModel({ entityStats, entityType, metricConfig, minEntityTrips, minBaselineAmount, period }){
  const currentTotal = safeNum(period?.current?.[metricConfig.shareMetricPeriodKey]);
  const previousTotal = safeNum(period?.previous?.[metricConfig.shareMetricPeriodKey]);
  const enriched = (Array.isArray(entityStats) ? entityStats : []).map((row)=> enrichEntityMovementRow({
    row,
    metricConfig,
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
  const currentLeader = ranked.filter((row)=> safeNum(row.current?.[metricConfig.leaderMetricKey]) > 0).sort((a, b)=> safeNum(b.current?.[metricConfig.leaderMetricKey]) - safeNum(a.current?.[metricConfig.leaderMetricKey]))[0] || null;
  const previousLeader = ranked.filter((row)=> safeNum(row.previous?.[metricConfig.leaderMetricKey]) > 0).sort((a, b)=> safeNum(b.previous?.[metricConfig.leaderMetricKey]) - safeNum(a.previous?.[metricConfig.leaderMetricKey]))[0] || null;
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
    previousTotal,
    shareLabel: metricConfig.shareLabel,
    shareMetricKey: metricConfig.shareMetricKey,
    primaryMetricKey: metricConfig.primaryMetricKey,
    primaryLabel: metricConfig.primaryLabel
  };
}

function enrichEntityMovementRow({ row, metricConfig, currentTotal, previousTotal, minEntityTrips, minBaselineAmount }){
  const currentAmount = safeNum(row?.current?.amount);
  const previousAmount = safeNum(row?.previous?.amount);
  const currentPrimary = safeNum(row?.current?.[metricConfig.primaryMetricKey]);
  const previousPrimary = safeNum(row?.previous?.[metricConfig.primaryMetricKey]);
  const deltaValue = currentPrimary - previousPrimary;
  const deltaPct = metricConfig.percentBaselineOk(row, minBaselineAmount) ? (deltaValue / Math.max(previousPrimary, 0.0001)) : null;
  const currentShareValue = safeNum(row?.current?.[metricConfig.shareMetricKey]);
  const previousShareValue = safeNum(row?.previous?.[metricConfig.shareMetricKey]);
  const currentSharePct = currentTotal > 0 ? (currentShareValue / currentTotal) * 100 : 0;
  const previousSharePct = previousTotal > 0 ? (previousShareValue / previousTotal) * 100 : 0;
  const shareDeltaPct = currentSharePct - previousSharePct;
  const supportScore = scoreSupport({
    currentTrips: row?.current?.trips,
    previousTrips: row?.previous?.trips,
    currentDays: row?.current?.uniqueDays,
    previousDays: row?.previous?.uniqueDays,
    baselineRatio: metricConfig.supportBaselineRatio(row, minBaselineAmount)
  });
  const supportConfidence = classifyConfidenceFromScore(supportScore);
  const movementEligible = metricConfig.movementEligible(row, minEntityTrips, minBaselineAmount);
  const compareEligible = metricConfig.compareEligible(row, minEntityTrips, minBaselineAmount);
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
    currentLbs: row.current.lbs,
    previousLbs: row.previous.lbs,
    currentPpl: row.current.ppl,
    previousPpl: row.previous.ppl,
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
    `${viable.name} is the best ${entityType} to compare because it has enough support in both periods.`
  ];
  if(leaderChange.changed && leaderChange.currentLeader && leaderChange.previousLeader){
    parts.push(`${leaderChange.currentLeader.name} took the lead from ${leaderChange.previousLeader.name}.`);
  }
  if(shareShift.gainer && Math.abs(safeNum(shareShift.gainer.shareDeltaPct)) >= 3){
    parts.push(`${shareShift.gainer.name} gained ${formatShareDelta(shareShift.gainer.shareDeltaPct)} of ${movement?.shareLabel || "share"}.`);
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
    baselineRatio: Math.max(a.previous.amount / 25, a.previous.lbs / 10, a.previous.ppl / 1)
  }) + ((a.current.amount + a.previous.amount) / 1000) + ((a.current.lbs + a.previous.lbs) / 120) + ((a.current.ppl + a.previous.ppl) * 2) + (Math.abs(a.shareDeltaPct) / 20);
  const bScore = scoreSupport({
    currentTrips: b.current.trips,
    previousTrips: b.previous.trips,
    currentDays: b.current.uniqueDays,
    previousDays: b.previous.uniqueDays,
    baselineRatio: Math.max(b.previous.amount / 25, b.previous.lbs / 10, b.previous.ppl / 1)
  }) + ((b.current.amount + b.previous.amount) / 1000) + ((b.current.lbs + b.previous.lbs) / 120) + ((b.current.ppl + b.previous.ppl) * 2) + (Math.abs(b.shareDeltaPct) / 20);
  return bScore - aScore;
}

function getEntityMetricConfig(entityType){
  if(entityType === "area"){
    return {
      primaryMetricKey: "lbs",
      primaryLabel: "Pounds",
      leaderMetricKey: "lbs",
      shareMetricKey: "lbs",
      shareMetricPeriodKey: "lbs",
      shareLabel: "area pounds share",
      primaryBaseline: 10,
      primaryEpsilonPct: 0.05,
      baselineOk: (row, minEntityTrips)=> row?.current?.trips >= minEntityTrips && row?.previous?.trips >= minEntityTrips && safeNum(row?.previous?.lbs) >= 10,
      baselineReason: (row, minEntityTrips)=> `Area compare is held back: ${row?.name || "this area"} needs at least ${minEntityTrips} trips in both periods and 10 lbs in the earlier period.`,
      compareEligible: (row, minEntityTrips)=> row?.current?.trips >= minEntityTrips && row?.previous?.trips >= minEntityTrips && safeNum(row?.previous?.lbs) >= 10,
      movementEligible: (row, minEntityTrips)=> row?.current?.trips >= 1
        && row?.previous?.trips >= 1
        && row?.current?.uniqueDays >= 1
        && row?.previous?.uniqueDays >= 1
        && (safeNum(row?.current?.trips) + safeNum(row?.previous?.trips)) >= Math.max(3, minEntityTrips + 1)
        && (safeNum(row?.current?.lbs) >= 8 || safeNum(row?.previous?.lbs) >= 8),
      percentBaselineOk: (row)=> safeNum(row?.previous?.lbs) >= 10,
      supportBaselineRatio: (row)=> safeNum(row?.previous?.lbs) / 10
    };
  }
  return {
    primaryMetricKey: "ppl",
    primaryLabel: "Pay rate ($/lb)",
    leaderMetricKey: "ppl",
    shareMetricKey: "amount",
    shareMetricPeriodKey: "amount",
    shareLabel: "dealer dollars share",
    primaryBaseline: 0.1,
    primaryEpsilonPct: 0.035,
    baselineOk: (row, minEntityTrips)=> row?.current?.trips >= minEntityTrips
      && row?.previous?.trips >= minEntityTrips
      && safeNum(row?.current?.lbs) >= 10
      && safeNum(row?.previous?.lbs) >= 10
      && safeNum(row?.previous?.ppl) > 0,
    baselineReason: (row, minEntityTrips)=> `Dealer compare is held back: ${row?.name || "this dealer"} needs at least ${minEntityTrips} trips in both periods and 10 lbs in each period before $/lb compare.`,
    compareEligible: (row, minEntityTrips)=> row?.current?.trips >= minEntityTrips
      && row?.previous?.trips >= minEntityTrips
      && safeNum(row?.current?.lbs) >= 10
      && safeNum(row?.previous?.lbs) >= 10
      && safeNum(row?.previous?.ppl) > 0,
    movementEligible: (row, minEntityTrips)=> row?.current?.trips >= 1
      && row?.previous?.trips >= 1
      && row?.current?.uniqueDays >= 1
      && row?.previous?.uniqueDays >= 1
      && (safeNum(row?.current?.trips) + safeNum(row?.previous?.trips)) >= Math.max(3, minEntityTrips + 1)
      && (safeNum(row?.current?.lbs) >= 5 || safeNum(row?.previous?.lbs) >= 5)
      && (safeNum(row?.current?.ppl) > 0 || safeNum(row?.previous?.ppl) > 0),
    percentBaselineOk: (row)=> safeNum(row?.previous?.lbs) >= 10 && safeNum(row?.previous?.ppl) > 0,
    supportBaselineRatio: (row)=> Math.min(safeNum(row?.previous?.lbs) / 10, safeNum(row?.previous?.ppl) / 1)
  };
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
      : `Comparison held back for fairness: ${joinReasonList(deficits)}. Need at least 2 trips and 2 fishing days in each period.`,
    explanation: comparable
      ? `${confidenceLabelFromScore(score) === "strong" ? "Steadier" : (confidenceLabelFromScore(score) === "early" ? "Early" : "Light")} read using ${currentTrips} vs ${previousTrips} trips across ${currentDays} vs ${previousDays} fishing days in the same part of each month.`
      : `Held back because ${joinReasonList(deficits)}.`,
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
    String(period?.previousLabel || "Previous"),
    String(period?.currentLabel || "Current")
  ];
  const amountTrend = buildMetricDetailAmountTrendChart({ period, monthRows, trips });
  return {
    trips: buildMetricDetailCompareChart({ labels, currentValue: current?.trips, previousValue: previous?.trips, metricKey: "trips" }),
    pounds: buildMetricDetailCompareChart({ labels, currentValue: current?.lbs, previousValue: previous?.lbs, metricKey: "pounds" }),
    amount: buildMetricDetailCompareChart({ labels, currentValue: current?.amount, previousValue: previous?.amount, metricKey: "amount", basisLabel: labels?.length ? labels.join(" vs ") : "Comparison" }),
    amountCompare: buildMetricDetailCompareChart({ labels, currentValue: current?.amount, previousValue: previous?.amount, metricKey: "amount", basisLabel: labels?.length ? labels.join(" vs ") : "Comparison" }),
    amountTrend,
    ppl: buildMetricDetailCompareChart({ labels, currentValue: current?.ppl, previousValue: previous?.ppl, metricKey: "ppl" })
  };
}

function buildMetricDetailCompareChart({ labels, currentValue, previousValue, metricKey, basisLabel }){
  return {
    chartType: "compare-bars",
    metricKey,
    basisLabel: String(basisLabel || (labels?.length ? `Matched compare window • ${labels.join(" vs ")}` : "Matched compare window")),
    labels: Array.isArray(labels) ? labels.slice(0, 2) : ["Previous", "Current"],
    values: [safeNum(previousValue), safeNum(currentValue)]
  };
}

function buildMetricDetailAmountTrendChart({ period, monthRows, trips }){
  const dayLimit = safeNum(period?.current?.dayLimit) || safeNum(period?.previous?.dayLimit) || 0;
  const trendRows = buildMonthWindowValueSeries({ monthRows, trips, dayLimit, metricKey: "amount" });
  return {
    chartType: "time-series",
    metricKey: "amount",
    basisLabel: dayLimit ? `Amount trend • same days in each month (days 1-${dayLimit})` : "Amount trend across the range",
    monthKeys: trendRows.map((row)=> row.monthKey),
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

function buildCompareDayRangeLabel({ currentMonthKey, previousMonthKey, dayLimit, isPartial }){
  if(!isPartial) return "";
  const safeDayLimit = Math.max(1, Number(dayLimit) || 0);
  const currentRange = formatMonthDayWindowLabel(currentMonthKey, safeDayLimit);
  const previousRange = formatMonthDayWindowLabel(previousMonthKey, safeDayLimit);
  return currentRange && previousRange ? `${currentRange} vs ${previousRange}` : "";
}

function formatMonthDayWindowLabel(monthKey, dayLimit){
  const [year, month] = String(monthKey || "").split("-").map(Number);
  if(!year || !month) return "";
  const monthLabel = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1)));
  return `${monthLabel} 1–${dayLimit}`;
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
