import { buildReportsCompareFoundation } from "./reports_compare_foundations_v5.js";

export function createReportsHighlightsSeam(deps){
  const {
    escapeHtml,
    formatMoney,
    to2
  } = deps;

  const safeNum = (v)=> Number(v) || 0;
  const pctText = (value)=> `${Math.abs(Math.round(safeNum(value) * 100))}%`;
  const signedPctText = (value)=> `${safeNum(value) > 0 ? "+" : ""}${Math.round(safeNum(value) * 100)}%`;
  const signedMoneyText = (value)=> `${safeNum(value) > 0 ? "+" : ""}${formatMoney(to2(safeNum(value)))}`;
  const signedRateText = (value)=> `${safeNum(value) > 0 ? "+" : ""}${formatMoney(to2(safeNum(value)))}/lb`;
  const signedLbsText = (value)=> `${safeNum(value) > 0 ? "+" : ""}${to2(safeNum(value))} lbs`;
  const PERCENT_TOKEN_RE = /([+-]?\d+%)/g;
  const renderPercentEmphasisText = (text)=> escapeHtml(String(text || "")).replace(PERCENT_TOKEN_RE, '<span class="reportsPercentEmphasis">$1</span>');
  const buildPeriodLabel = (period)=> `${period?.currentLabel || "Current"} vs ${period?.previousLabel || "Prior"}`;
  const buildComparableWindowLabel = (period)=> period?.compareDayRangeLabel
    || (period?.currentLabel && period?.previousLabel
      ? `${period.currentLabel} vs ${period.previousLabel}`
      : (period?.fairWindowLabel || "Comparable window"));
  const compareToneForRatio = (current, previous, epsilon = 0.05)=>{
    if(!current && !previous) return "steady";
    if(previous <= 0) return current > 0 ? "up" : "steady";
    const delta = (safeNum(current) - safeNum(previous)) / previous;
    if(Math.abs(delta) <= epsilon) return "steady";
    return delta > 0 ? "up" : "down";
  };
  const metricLabelFromMovement = (movement)=> {
    const key = String(movement?.primaryMetricKey || "");
    const label = String(movement?.primaryLabel || "").trim();
    if(label) return label;
    if(key === "ppl") return "Price Per Pound";
    if(key === "lbs") return "Pounds";
    return "compare metric";
  };
  const compareContextFromMetric = (metricKey)=> {
    const key = String(metricKey || "").toLowerCase();
    if(key === "lbs" || key === "pounds") return "Pounds";
    if(key === "ppl" || key === "rate" || key === "pay_rate") return "Price Per Pound";
    if(key === "share" || key === "sharepct") return "Share";
    if(key === "amount" || key === "amt" || key === "money") return "Amount";
    return "";
  };
  const compareContextFromLabel = (label)=> {
    const text = String(label || "").trim();
    if(!text) return "";
    const normalized = text.toLowerCase();
    if(normalized.includes("pound") || normalized === "lbs") return "Pounds";
    if(normalized.includes("rate") || normalized.includes("$/lb")) return "Price Per Pound";
    if(normalized.includes("share")) return "Share";
    if(normalized.includes("amount") || normalized.includes("dollar") || normalized.includes("sales")) return "Amount";
    return text;
  };

  function buildAmountDriverText(compare){
    const pounds = compare?.metrics?.pounds;
    const ppl = compare?.metrics?.ppl;
    const period = compare?.period || {};
    const tripTone = compareToneForRatio(period.current?.amountPerTrip, period.previous?.amountPerTrip);
    const dayTone = compareToneForRatio(period.current?.amountPerDay, period.previous?.amountPerDay);
    if(!pounds || !ppl || pounds.suppressed || ppl.suppressed){
      return "compared with the earlier period.";
    }
    if(pounds.compareTone === "up" && ppl.compareTone === "up") return "with both pounds and Price Per Pound up.";
    if(pounds.compareTone === "down" && ppl.compareTone === "down") return "with lighter pounds and a softer Price Per Pound.";
    if(pounds.compareTone === "up" && ppl.compareTone === "down") return "$ grew on heavier pounds even with a softer rate.";
    if(pounds.compareTone === "down" && ppl.compareTone === "up") return "$ changed on stronger Price Per Pound despite lighter pounds.";
    if(pounds.compareTone === "steady" && ppl.compareTone === "up") return "mostly because Price Per Pound improved.";
    if(pounds.compareTone === "steady" && ppl.compareTone === "down") return "mostly because Price Per Pound eased.";
    if(pounds.compareTone === "up" && ppl.compareTone === "steady") return "mostly because pounds increased.";
    if(pounds.compareTone === "down" && ppl.compareTone === "steady") return "mostly because pounds fell.";
    if(tripTone === "up" && dayTone === "up") return "with both $ per trip and $ per fishing day up.";
    if(tripTone === "down" && dayTone === "down") return "with both $ per trip and $ per fishing day softer.";
    return "with pounds and pricing staying close.";
  }

  function buildTripsDriverText(compare){
    const period = compare?.period || {};
    const currentRate = safeNum(period.current?.poundsPerTrip);
    const previousRate = safeNum(period.previous?.poundsPerTrip);
    const currentDayRate = safeNum(period.current?.poundsPerDay);
    const previousDayRate = safeNum(period.previous?.poundsPerDay);
    if(!currentRate && !previousRate) return "";
    if(currentRate > previousRate * 1.05) return `Average pounds per trip improved to ${to2(currentRate)} lbs.`;
    if(currentRate < previousRate * 0.95) return `Average pounds per trip slipped to ${to2(currentRate)} lbs.`;
    if(currentDayRate > previousDayRate * 1.05) return `Pounds per trip held near ${to2(currentRate)} lbs while pounds per day improved.`;
    if(currentDayRate < previousDayRate * 0.95) return `Pounds per trip held near ${to2(currentRate)} lbs while pounds per day slipped.`;
    return `Average pounds per trip held near ${to2(currentRate)} lbs.`;
  }

  function buildPoundsDriverText(compare){
    const trips = compare?.metrics?.trips;
    if(!trips || trips.suppressed){
      return "compared with the earlier period.";
    }
    const period = compare?.period || {};
    const currentRate = safeNum(period.current?.poundsPerTrip);
    const previousRate = safeNum(period.previous?.poundsPerTrip);
    const currentDayRate = safeNum(period.current?.poundsPerDay);
    const previousDayRate = safeNum(period.previous?.poundsPerDay);
    const productivityTone = currentRate > previousRate * 1.05
      ? "up"
      : (currentRate < previousRate * 0.95 ? "down" : "steady");
    const dayTone = compareToneForRatio(currentDayRate, previousDayRate);

    if(trips.compareTone === "up" && productivityTone === "up") return "with more trips and more pounds per trip.";
    if(trips.compareTone === "down" && productivityTone === "down") return "with fewer trips and less per trip.";
    if(trips.compareTone === "up" && productivityTone === "down") return "because more trips offset softer pounds per trip.";
    if(trips.compareTone === "down" && productivityTone === "up") return "because stronger pounds per trip partly covered fewer trips.";
    if(trips.compareTone === "up") return "mostly on more trips.";
    if(trips.compareTone === "down") return "mostly on fewer trips.";
    if(productivityTone === "up") return "mostly on stronger pounds per trip.";
    if(productivityTone === "down") return "mostly on weaker pounds per trip.";
    if(dayTone === "up") return "with pounds per day still improving.";
    if(dayTone === "down") return "with pounds per day still easing.";
    return "with trip count and productivity staying close.";
  }

  function buildPplDriverText(compare){
    const pounds = compare?.metrics?.pounds;
    const amount = compare?.metrics?.amount;
    if(!pounds || !amount || pounds.suppressed || amount.suppressed){
      return "compared with the earlier period.";
    }
    if(amount.compareTone === "up" && pounds.compareTone !== "up") return "even without heavier pounds.";
    if(amount.compareTone === "down" && pounds.compareTone !== "down") return "even without lighter pounds.";
    if(amount.compareTone === "up" && pounds.compareTone === "up") return "while both sales and pounds climbed.";
    if(amount.compareTone === "down" && pounds.compareTone === "down") return "while both sales and pounds softened.";
    return "relative to how much weight moved.";
  }

  function buildMetricHeadline({ payload, headlineLabel, compare, period }){
    const currentLabel = period?.currentLabel || "Current";
    const previousLabel = period?.previousLabel || "prior period";
    if(payload.compareTone === "steady"){
      return `${headlineLabel} stayed close to ${previousLabel}.`;
    }

    const direction = payload.compareTone === "up" ? "rose" : "fell";
    const magnitude = payload.percentValid ? signedPctText(payload.deltaPct) : (payload.metricKey === "amount" ? signedMoneyText(payload.deltaValue) : "updated");
    let driverText = "";
    if(payload.metricKey === "amount") driverText = buildAmountDriverText(compare);
    if(payload.metricKey === "pounds") driverText = buildPoundsDriverText(compare);
    if(payload.metricKey === "trips") driverText = buildTripsDriverText(compare);
    if(payload.metricKey === "ppl") driverText = buildPplDriverText(compare);
    return `${currentLabel} ${headlineLabel.toLowerCase()} ${direction} ${magnitude} from ${previousLabel}${driverText ? ` ${driverText}` : ""}`;
  }

  function buildMetricCompareText({ payload, compare, period }){
    const windowText = buildComparableWindowLabel(period);
    const trustText = payload?.confidenceLabel === "early"
      ? " • early read"
      : (payload?.confidenceLabel === "weak" ? " • light read" : "");
    return `Latest comparable-month window: ${windowText}${trustText}`;
  }

  function buildMetricUnavailableCard({ payload, headlineLabel, formatter, period }){
    const suppressionCode = String(payload?.suppressionCode || period?.suppressionCode || "");
    const reason = String(payload?.reason || period?.reason || "").trim();
    const currentLabel = period?.currentLabel || "Current";
    const previousLabel = period?.previousLabel || "Prior";
    const currentValue = Number(payload?.currentValue) || 0;
    const previousValue = Number(payload?.previousValue) || 0;
    let headline = `${headlineLabel} compare is unavailable in this range.`;
    let compareText = "Compare paused for this range.";

    if(suppressionCode === "missing-periods"){
      headline = "Need one more month to compare this metric.";
      compareText = "Not enough months yet.";
    }else if(suppressionCode === "non-adjacent-months"){
      headline = "Compare is paused until months are back-to-back.";
      compareText = "Previous month is missing.";
    }else if(suppressionCode === "baseline-too-weak"){
      headline = `${headlineLabel} compare is waiting on a stronger baseline.`;
      compareText = "Baseline too weak for this metric.";
    }else if(reason){
      headline = "Compare is held back to keep this read fair.";
      compareText = "Held back for fairness/support.";
    }

    return {
      type: "compare",
      unavailable: true,
      metricKey: payload?.metricKey || "",
      label: payload?.label || headlineLabel,
      headline,
      value: formatter(currentValue),
      valueClass: payload?.metricKey === "amount"
        ? "money"
        : (payload?.metricKey === "pounds" ? "lbsBlue" : (payload?.metricKey === "ppl" ? "rate ppl" : (payload?.metricKey === "trips" ? "trips" : ""))),
      compareTone: "steady",
      compareText,
      aLabel: currentLabel,
      bLabel: previousLabel,
      aValue: formatter(currentValue),
      bValue: formatter(previousValue),
      aPct: 100,
      bPct: 100,
      statusText: reason || "Compare returns automatically when support is strong enough."
    };
  }

  function buildLeaderSummary({ label, entity, totalValue, noun, shareLabel, valueType = "money" }){
    if(!entity) return null;
    const entityValue = valueType === "pounds"
      ? safeNum(entity.lbs)
      : (valueType === "rate" ? safeNum(entity.avg) : safeNum(entity.amt));
    const share = totalValue > 0 ? Math.round((entityValue / totalValue) * 100) : 0;
    const valueText = valueType === "pounds"
      ? `${to2(entityValue)} lbs`
      : (valueType === "rate" ? `${formatMoney(to2(entityValue))}/lb` : formatMoney(to2(entityValue)));
    const headline = valueType === "rate"
      ? `${entity.name} led dealer pay rate in this range.`
      : (share >= 50
        ? `${entity.name} carried most ${shareLabel} in this range.`
        : `${entity.name} finished on top for ${shareLabel} in this range.`);
    const statusText = valueType === "rate"
      ? `${entity.trips} trips • ${to2(entity.lbs)} lbs • ${formatMoney(to2(entity.amt))} outcome`
      : (share > 0
        ? `${entity.trips} trips • ${to2(entity.lbs)} lbs • ${share}% of ${shareLabel}`
        : `${entity.trips} trips • ${to2(entity.lbs)} lbs`);
    return {
      type: "summary",
      label,
      headline,
      value: valueText,
      valueClass: valueType === "pounds" ? "lbsBlue" : (valueType === "rate" ? "rate ppl" : "money"),
      statusTone: "steady",
      statusText
    };
  }

  function buildTrailingSummary({ label, entity, leader, noun, valueType = "money" }){
    if(!entity || !leader) return null;
    const leaderValue = valueType === "pounds"
      ? safeNum(leader.lbs)
      : (valueType === "rate" ? safeNum(leader.avg) : safeNum(leader.amt));
    const entityValue = valueType === "pounds"
      ? safeNum(entity.lbs)
      : (valueType === "rate" ? safeNum(entity.avg) : safeNum(entity.amt));
    if(leaderValue <= 0 || entityValue <= 0 || (entityValue / leaderValue) > 0.85) return null;
    return {
      type: "summary",
      label,
      headline: `${entity.name} lagged the ${noun} pack in this range.`,
      value: valueType === "pounds"
        ? `${to2(entityValue)} lbs`
        : (valueType === "rate" ? `${formatMoney(to2(entityValue))}/lb` : formatMoney(to2(entityValue))),
      valueClass: valueType === "pounds" ? "lbsBlue" : (valueType === "rate" ? "rate ppl" : "money"),
      statusTone: "steady",
      statusText: `${entity.trips} trips • ${to2(entity.lbs)} lbs • ${formatMoney(to2(entity.amt))} outcome`
    };
  }

  function rankDealerRowsByPayRate(rows){
    const safeRows = Array.isArray(rows) ? rows.filter(Boolean) : [];
    const byRateDesc = (a, b)=> {
      const rateDiff = safeNum(b?.avg) - safeNum(a?.avg);
      if(rateDiff !== 0) return rateDiff;
      const lbsDiff = safeNum(b?.lbs) - safeNum(a?.lbs);
      if(lbsDiff !== 0) return lbsDiff;
      return safeNum(b?.amt) - safeNum(a?.amt);
    };
    const strongSupport = safeRows.filter((row)=> safeNum(row?.avg) > 0 && safeNum(row?.lbs) >= 20 && safeNum(row?.trips) >= 2 && safeNum(row?.sampleCount) >= 2);
    if(strongSupport.length >= 2) return strongSupport.sort(byRateDesc);
    const mediumSupport = safeRows.filter((row)=> safeNum(row?.avg) > 0 && safeNum(row?.lbs) >= 5 && safeNum(row?.sampleCount) >= 1);
    if(mediumSupport.length >= 2) return mediumSupport.sort(byRateDesc);
    return safeRows.filter((row)=> safeNum(row?.avg) > 0).sort(byRateDesc);
  }

  function rankAreaRowsByPounds(rows){
    return (Array.isArray(rows) ? rows.filter(Boolean) : [])
      .slice()
      .sort((a, b)=> {
        const lbsDiff = safeNum(b?.lbs) - safeNum(a?.lbs);
        if(lbsDiff !== 0) return lbsDiff;
        return safeNum(b?.amt) - safeNum(a?.amt);
      });
  }

  function buildEntityCompareSummary({ payload, period, share, noun }){
    if(!payload || payload.suppressed) return null;
    const currentLabel = period?.currentLabel || "Current";
    const previousLabel = period?.previousLabel || "prior period";
    const leaderChange = payload?.leaderChange || {};
    let headline = `${payload.entityName} held close to ${previousLabel}.`;
    if(leaderChange.changed && leaderChange.currentLeader?.name === payload.entityName){
      headline = `${payload.entityName} moved into the ${noun} lead ahead of ${leaderChange.previousLeader?.name || previousLabel}.`;
    }else if(payload.compareTone === "up"){
      headline = `${payload.entityName} improved vs ${previousLabel} on ${payload.compareMetricLabel || "compare metric"}${share >= 45 ? " and drove much of the outcome" : ""}.`;
    }else if(payload.compareTone === "down"){
      headline = `${payload.entityName} softened vs ${previousLabel} on ${payload.compareMetricLabel || "compare metric"}${share >= 45 ? ", which pulled on the overall result" : ""}.`;
    }
    const metricKey = String(payload.compareMetric || "");
    const value = payload.percentValid
      ? signedPctText(payload.deltaPct)
      : (metricKey === "ppl" ? signedRateText(payload.deltaValue) : (metricKey === "lbs" ? signedLbsText(payload.deltaValue) : signedMoneyText(payload.deltaValue)));
    const statusBits = [`${currentLabel} ${payload.currentTrips || 0} trips`, `${previousLabel} ${payload.previousTrips || 0} trips`];
    if(share > 0) statusBits.push(`${share}% of ${payload.shareLabel || `${noun} share`} now`);
    return {
      type: "summary",
      label: `${noun[0].toUpperCase()}${noun.slice(1)} compare`,
      headline,
      value,
      valueClass: metricKey === "ppl" ? "rate ppl" : (metricKey === "lbs" ? "lbsBlue" : "money"),
      compareValueTone: payload.compareTone || "",
      compareContextLabel: payload.percentValid
        ? (compareContextFromMetric(metricKey) || compareContextFromLabel(payload.compareMetricLabel))
        : "",
      statusTone: payload.compareTone || "steady",
      statusText: statusBits.join(" • ")
    };
  }

  function buildEntityMovementSummary({ movement, label, noun }){
    if(!movement) return null;
    const topGainer = movement.topGainer;
    const topDecliner = movement.topDecliner;
    if(!topGainer && !topDecliner) return null;
    const best = (()=>{
      if(topGainer && topDecliner){
        return Math.abs(safeNum(topGainer.deltaValue)) >= Math.abs(safeNum(topDecliner.deltaValue)) ? topGainer : topDecliner;
      }
      return topGainer || topDecliner;
    })();
    if(!best) return null;
    const primaryMetricLabel = metricLabelFromMovement(movement);
    const headline = `${best.name} ${best.compareTone === "down" ? "fell back the most" : "gained the most"} on ${primaryMetricLabel} versus the earlier period.`;
    const value = best.deltaPct != null
      ? signedPctText(best.deltaPct)
      : (movement.primaryMetricKey === "ppl" ? signedRateText(best.deltaValue) : (movement.primaryMetricKey === "lbs" ? signedLbsText(best.deltaValue) : signedMoneyText(best.deltaValue)));
    const movementSupportLines = [
      {
        label: "Pounds",
        text: `${to2(best.currentLbs)} lbs now vs ${to2(best.previousLbs)} lbs before`,
        tone: compareToneForRatio(best.currentLbs, best.previousLbs)
      },
      {
        label: "Price Per Pound",
        text: `${formatMoney(to2(best.currentPpl))}/lb now vs ${formatMoney(to2(best.previousPpl))}/lb before`,
        tone: compareToneForRatio(best.currentPpl, best.previousPpl, 0.035)
      },
      {
        label: "Amount",
        text: `${formatMoney(to2(best.currentAmount))} now vs ${formatMoney(to2(best.previousAmount))} before`,
        tone: compareToneForRatio(best.currentAmount, best.previousAmount)
      }
    ];
    return {
      type: "summary",
      label,
      headline,
      value,
      valueClass: movement.primaryMetricKey === "ppl" ? "rate ppl" : (movement.primaryMetricKey === "lbs" ? "lbsBlue" : "money"),
      compareValueTone: best.compareTone || "",
      compareContextLabel: best.deltaPct != null ? (compareContextFromMetric(movement.primaryMetricKey) || compareContextFromLabel(primaryMetricLabel)) : "",
      statusTone: "steady",
      statusText: "",
      statusLines: movementSupportLines
    };
  }

  function buildLeaderChangeSummary({ leaderChange, noun }){
    if(!leaderChange?.changed || !leaderChange?.currentLeader || !leaderChange?.previousLeader) return null;
    return {
      type: "summary",
      label: `${noun[0].toUpperCase()}${noun.slice(1)} lead change`,
      headline: `${leaderChange.currentLeader.name} replaced ${leaderChange.previousLeader.name} at the top ${noun} spot.`,
      value: `${Math.round(safeNum(leaderChange.currentLeader.currentSharePct))}%`,
      valueClass: "money",
      compareValueTone: "up",
      compareContextLabel: "Share",
      statusTone: "steady",
      statusText: `${leaderChange.currentLeader.name} now • ${leaderChange.previousLeader.name} before • ${noun} share metric`
    };
  }

  function buildShareShiftSummary({ shareShift, noun }){
    const gainer = shareShift?.gainer;
    const decliner = shareShift?.decliner;
    const strongest = (()=>{
      if(gainer && decliner){
        return Math.abs(safeNum(gainer.shareDeltaPct)) >= Math.abs(safeNum(decliner.shareDeltaPct)) ? gainer : decliner;
      }
      return gainer || decliner;
    })();
    if(!strongest || Math.abs(safeNum(strongest.shareDeltaPct)) < 3) return null;
    const direction = strongest.shareDeltaPct > 0 ? "gained" : "gave back";
    return {
      type: "summary",
      label: `${noun[0].toUpperCase()}${noun.slice(1)} share shift`,
      headline: `${strongest.name} ${direction} the most ${noun} share (${noun === "area" ? "pounds" : "dollars"}).`,
      value: `${Math.round(strongest.shareDeltaPct)} pts`,
      valueClass: "money",
      compareValueTone: strongest.shareDeltaPct > 0 ? "up" : "down",
      compareContextLabel: "Share",
      statusTone: "steady",
      statusText: `${Math.round(safeNum(strongest.currentSharePct))}% now vs ${Math.round(safeNum(strongest.previousSharePct))}% before`
    };
  }

  function renderHighlightsStrip({ dealerRows, monthRows, areaRows, trips, compareFoundation }){
    const dealerRowsByRate = rankDealerRowsByPayRate(dealerRows);
    const areaRowsByPounds = rankAreaRowsByPounds(areaRows);
    const topDealer = dealerRowsByRate[0] || null;
    const strongestArea = areaRowsByPounds[0] || null;
    const latestMonth = monthRows[monthRows.length - 1] || null;
    const priorMonth = monthRows[monthRows.length - 2] || null;
    const compare = compareFoundation || buildReportsCompareFoundation({ trips, monthRows, dealerRows, areaRows });
    const totalDealerAmount = dealerRows.reduce((sum, row)=> sum + safeNum(row?.amt), 0);
    const totalAreaPounds = areaRows.reduce((sum, row)=> sum + safeNum(row?.lbs), 0);

    const metricCompareCards = [
      buildMetricCard({
        payload: compare.metrics.pounds,
        headlineLabel: "Total pounds",
        formatter: (v)=> `${to2(v)} lbs`,
        period: compare.period,
        compare
      }),
      buildMetricCard({
        payload: compare.metrics.ppl,
        headlineLabel: "Average price per lb",
        formatter: (v)=> `${formatMoney(to2(v))}/lb`,
        period: compare.period,
        compare
      }),
      buildMetricCard({
        payload: compare.metrics.trips,
        headlineLabel: "Trip count",
        formatter: (v)=> `${Math.round(v)} trips`,
        period: compare.period,
        compare
      }),
      buildMetricCard({
        payload: compare.metrics.amount,
        headlineLabel: "Total amount",
        formatter: (v)=> formatMoney(to2(v)),
        period: compare.period,
        compare
      })
    ].filter(Boolean);

    const weakestDealer = dealerRowsByRate.length >= 3 ? dealerRowsByRate[dealerRowsByRate.length - 1] : null;
    const weakestArea = areaRowsByPounds.length >= 3 ? areaRowsByPounds[areaRowsByPounds.length - 1] : null;
    const dealerMovement = buildEntityMovementSummary({ movement: compare.dealer?.movement, label: "Dealer movement", noun: "dealer" });
    const areaMovement = buildEntityMovementSummary({ movement: compare.area?.movement, label: "Area movement", noun: "area" });
    const dealerLeaderChange = buildLeaderChangeSummary({ leaderChange: compare.dealer?.leaderChange, noun: "dealer" });
    const areaLeaderChange = buildLeaderChangeSummary({ leaderChange: compare.area?.leaderChange, noun: "area" });
    const dealerShareShift = buildShareShiftSummary({ shareShift: compare.dealer?.shareShift, noun: "dealer" });
    const areaShareShift = buildShareShiftSummary({ shareShift: compare.area?.shareShift, noun: "area" });

    const trendCue = (()=>{
      if(monthRows.length < 3){
        return {
          unavailable: true,
          headline: "Rolling trend needs at least three months.",
          tone: "steady"
        };
      }
      const recent = monthRows.slice(-3);
      const lbs = recent.map((r)=> safeNum(r.lbs));
      const tripsVals = recent.map((r)=> safeNum(r.trips));
      const isUp = (arr)=> arr[2] > arr[1] && arr[1] > arr[0];
      const isDown = (arr)=> arr[2] < arr[1] && arr[1] < arr[0];
      if(isUp(lbs)) return { headline: "Pounds have climbed for three straight months.", tone: "up" };
      if(isDown(lbs)) return { headline: "Pounds have softened for three straight months.", tone: "down" };
      if(isUp(tripsVals)) return { headline: "Trips have climbed across the last three months.", tone: "up" };
      if(isDown(tripsVals)) return { headline: "Trips have eased across the last three months.", tone: "down" };
      return { headline: "No clear three-month trend yet in this range.", tone: "steady" };
    })();

    const dealerShare = totalDealerAmount > 0 ? Math.round((safeNum(topDealer?.amt) / totalDealerAmount) * 100) : 0;
    const areaShare = totalAreaPounds > 0 ? Math.round((safeNum(strongestArea?.lbs) / totalAreaPounds) * 100) : 0;

    const summaryCards = [
      buildLeaderSummary({ label: "Top dealer", entity: topDealer, totalValue: 0, noun: "dealer", shareLabel: "dealer pay-rate share", valueType: "rate" }),
      buildEntityCompareSummary({ payload: compare.dealer, period: compare.period, share: dealerShare, noun: "dealer" }),
      buildTrailingSummary({ label: "Weakest dealer", entity: weakestDealer, leader: topDealer, noun: "dealer", valueType: "rate" }),
      buildLeaderSummary({ label: "Top area by pounds", entity: strongestArea, totalValue: totalAreaPounds, noun: "area", shareLabel: "area pounds share", valueType: "pounds" }),
      buildEntityCompareSummary({ payload: compare.area, period: compare.period, share: areaShare, noun: "area" }),
      buildTrailingSummary({ label: "Weakest area", entity: weakestArea, leader: strongestArea, noun: "area", valueType: "pounds" }),
      dealerMovement,
      dealerLeaderChange,
      dealerShareShift,
      areaMovement,
      areaLeaderChange,
      areaShareShift,
      trendCue ? {
        type: "summary",
        label: "Rolling trend",
        headline: trendCue.headline,
        value: trendCue.unavailable ? "Unavailable" : (latestMonth ? `${to2(latestMonth.lbs)} lbs` : "—"),
        valueClass: "lbsBlue",
        statusTone: "steady",
        statusText: trendCue.unavailable
          ? "Not enough months yet."
          : (latestMonth && priorMonth ? `${latestMonth.label} vs ${priorMonth.label}` : "Gathering trend context")
      } : null,
      compare.period?.suppressed ? {
        type: "summary",
        label: "Compare guardrail",
        headline: "Comparison paused to keep this read fair.",
        value: "Suppressed",
        statusTone: "steady",
        statusText: compare.period.reason || compare.period.explanation || "Not enough data yet"
      } : null
    ].filter(Boolean);

    const featuredSummaries = summaryCards.filter(Boolean).slice(0, 8);
    const groupedSummaries = featuredSummaries;
    const groupedCompareCards = metricCompareCards;
    if(!groupedSummaries.length && !groupedCompareCards.length) return "";

    return `
      <div class="reportsHighlightsCard">
        <div class="reportsHighlightsHdr">Insights</div>
        <div class="reportsHighlightsGuide">Range summaries stay range-wide. Compare cards use only the latest comparable-month window.</div>
        ${groupedSummaries.length ? `
          <div class="reportsHighlightsHdr">Range-wide summaries</div>
          <div class="reportsHighlightsGrid">
            ${groupedSummaries.map(item=>`
              <div class="reportsHighlightItem reportsHighlightItem--summary">
                <div class="reportsHighlightLabel">${escapeHtml(item.label)}</div>
                <div class="reportsHighlightHeadline">${renderPercentEmphasisText(item.headline)}</div>
                <div class="reportsHighlightMetricRow reportsHighlightMetricRow--summary">
                  <div class="reportsHighlightValueWrap">
                    <div class="reportsHighlightValue ${item.valueClass || ""} ${item.compareValueTone ? `reportsHighlightValue--tone-${escapeHtml(item.compareValueTone)}` : ""}">${renderPercentEmphasisText(item.value)}</div>
                    ${item.compareContextLabel ? `<span class="reportsHighlightContextTag">${escapeHtml(item.compareContextLabel)}</span>` : ""}
                  </div>
                </div>
                ${Array.isArray(item.statusLines) && item.statusLines.length
                  ? `<div class="reportsMovementSupportRows">${item.statusLines.map((line)=> `
                    <div class="reportsMovementSupportLine tone-${escapeHtml(line.tone || "steady")}">
                      <span class="reportsMovementSupportLabel">${escapeHtml(line.label || "")}</span>
                      <span class="reportsMovementSupportValue">${renderPercentEmphasisText(line.text || "")}</span>
                    </div>
                  `).join("")}</div>`
                  : `<div class="reportsCompareRow reportsCompareRow--support tone-${escapeHtml(item.statusTone || "steady")}">${renderPercentEmphasisText(item.statusText)}</div>`
                }
              </div>
            `).join("")}
          </div>
        ` : ""}
        ${groupedCompareCards.length ? `
          <div class="reportsHighlightsHdr">Latest comparable-month window cards</div>
          <div class="reportsHighlightsGuide">Tap <b>View breakdown</b> to open metric detail for this compare window.</div>
          <div class="reportsHighlightsGrid">
            ${groupedCompareCards.map(item=>`
            <${item.type === "compare" && !item.unavailable ? "button" : "div"} class="reportsHighlightItem reportsHighlightItem--${item.type === "compare" ? "compare" : "summary"} ${item.type === "compare" && !item.unavailable ? "reportsHighlightItem--drilldown" : ""}" ${item.type === "compare" && !item.unavailable ? `type="button" data-metric-detail="${escapeHtml(item.metricKey)}" aria-label="View ${escapeHtml(item.label)} breakdown"` : ""}>
              <div class="reportsHighlightLabel">${escapeHtml(item.label)}</div>
              <div class="reportsHighlightHeadline">${renderPercentEmphasisText(item.headline)}</div>
              <div class="reportsHighlightMetricRow">
                <div class="reportsHighlightValue ${item.valueClass || ""}">${renderPercentEmphasisText(item.value)}</div>
                <div class="reportsMiniPreview" role="presentation" aria-hidden="true">
                  <span class="reportsMiniPreviewBar"><span class="reportsMiniPreviewFill" style="width:${item.aPct}%"></span></span>
                  <span class="reportsMiniPreviewBar muted"><span class="reportsMiniPreviewFill" style="width:${item.bPct}%"></span></span>
                </div>
              </div>
              <div class="reportsCompareRow reportsCompareRow--context tone-${escapeHtml(item.compareTone)}">${renderPercentEmphasisText(item.compareText)}</div>
              ${item.unavailable ? `
                <div class="reportsCompareRow reportsCompareRow--support tone-steady">${renderPercentEmphasisText(item.statusText || "Compare unavailable in this range.")}</div>
              ` : `
                <div class="reportsCompareBars" role="presentation">
                  <div class="reportsCompareLine">
                    <div class="reportsCompareMeta"><span class="reportsCompareMetaLabel">${escapeHtml(item.aLabel)}</span><b class="reportsCompareMetaValue ${item.valueClass || ""}">${escapeHtml(item.aValue)}</b></div>
                    <div class="reportsCompareBarTrack"><span style="width:${item.aPct}%"></span></div>
                  </div>
                  <div class="reportsCompareLine">
                    <div class="reportsCompareMeta"><span class="reportsCompareMetaLabel">${escapeHtml(item.bLabel)}</span><b class="reportsCompareMetaValue ${item.valueClass || ""}">${escapeHtml(item.bValue)}</b></div>
                    <div class="reportsCompareBarTrack muted"><span style="width:${item.bPct}%"></span></div>
                  </div>
                </div>
                <div class="reportsHighlightAction" aria-hidden="true">View breakdown →</div>
              `}
            </${item.type === "compare" && !item.unavailable ? "button" : "div"}>
          `).join("")}
          </div>
        ` : ""}
      </div>
    `;
  }

  function buildMetricCard({ payload, headlineLabel, formatter, period, compare }){
    if(!payload) return null;
    if(payload.suppressed){
      return buildMetricUnavailableCard({ payload, headlineLabel, formatter, period });
    }
    const cur = payload.currentValue;
    const prev = payload.previousValue;
    const maxVal = Math.max(cur, prev, 1);

    return {
      type: "compare",
      metricKey: payload.metricKey,
      label: payload.label,
      headline: buildMetricHeadline({ payload, headlineLabel, compare, period }),
      value: formatter(cur),
      valueClass: payload.metricKey === "amount"
        ? "money"
        : (payload.metricKey === "pounds" ? "lbsBlue" : (payload.metricKey === "ppl" ? "rate ppl" : (payload.metricKey === "trips" ? "trips" : ""))),
      compareTone: payload.compareTone,
      compareText: buildMetricCompareText({ payload, compare, period }),
      aLabel: period.currentLabel || "Current",
      bLabel: period.previousLabel || "Prior",
      aValue: formatter(cur),
      bValue: formatter(prev),
      aPct: Math.max(10, Math.round((cur / maxVal) * 100)),
      bPct: Math.max(10, Math.round((prev / maxVal) * 100))
    };
  }

  return {
    renderHighlightsStrip
  };
}
