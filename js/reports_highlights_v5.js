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

  function buildAmountDriverText(compare){
    const pounds = compare?.metrics?.pounds;
    const ppl = compare?.metrics?.ppl;
    const period = compare?.period || {};
    const tripTone = compareToneForRatio(period.current?.amountPerTrip, period.previous?.amountPerTrip);
    const dayTone = compareToneForRatio(period.current?.amountPerDay, period.previous?.amountPerDay);
    if(!pounds || !ppl || pounds.suppressed || ppl.suppressed){
      return "compared with the earlier period.";
    }
    if(pounds.compareTone === "up" && ppl.compareTone === "up") return "with both pounds and $/lb up.";
    if(pounds.compareTone === "down" && ppl.compareTone === "down") return "with lighter pounds and a softer $/lb.";
    if(pounds.compareTone === "up" && ppl.compareTone === "down") return "$ grew on heavier pounds even with a softer rate.";
    if(pounds.compareTone === "down" && ppl.compareTone === "up") return "$ changed on stronger $/lb despite lighter pounds.";
    if(pounds.compareTone === "steady" && ppl.compareTone === "up") return "mostly because $/lb improved.";
    if(pounds.compareTone === "steady" && ppl.compareTone === "down") return "mostly because $/lb eased.";
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
    if(payload.metricKey === "trips"){
      return `${buildTripsDriverText(compare)} • matched against ${windowText}${trustText}`;
    }
    if(payload.metricKey === "amount"){
      return `${buildAmountDriverText(compare).replace(/\.$/, "")} • matched against ${windowText}${trustText}`;
    }
    if(payload.metricKey === "pounds"){
      return `${buildPoundsDriverText(compare).replace(/\.$/, "")} • matched against ${windowText}${trustText}`;
    }
    if(payload.metricKey === "ppl"){
      return `${buildPplDriverText(compare).replace(/\.$/, "")} • matched against ${windowText}${trustText}`;
    }
    return `${buildPeriodLabel(period)} • compared on ${windowText}${trustText}`;
  }

  function buildLeaderSummary({ label, entity, totalAmount, noun }){
    if(!entity) return null;
    const share = totalAmount > 0 ? Math.round((safeNum(entity.amt) / totalAmount) * 100) : 0;
    const headline = share >= 50
      ? `${entity.name} carried most ${noun} dollars in this range.`
      : `${entity.name} finished on top for ${noun} dollars in this range.`;
    const statusText = share > 0
      ? `${entity.trips} trips • ${to2(entity.lbs)} lbs • ${share}% of range $`
      : `${entity.trips} trips • ${to2(entity.lbs)} lbs`;
    return {
      type: "summary",
      label,
      headline,
      value: formatMoney(to2(entity.amt)),
      valueClass: "money",
      statusTone: "up",
      statusText
    };
  }

  function buildTrailingSummary({ label, entity, leader, noun }){
    if(!entity || !leader) return null;
    const leaderAmt = safeNum(leader.amt);
    const entityAmt = safeNum(entity.amt);
    if(leaderAmt <= 0 || (entityAmt / leaderAmt) > 0.7) return null;
    return {
      type: "summary",
      label,
      headline: `${entity.name} lagged the ${noun} pack in this range.`,
      value: formatMoney(to2(entityAmt)),
      valueClass: "money",
      statusTone: "down",
      statusText: `${entity.trips} trips • ${to2(entity.lbs)} lbs`
    };
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
      headline = `${payload.entityName} earned more than in ${previousLabel}${share >= 45 ? " and drove much of the gain" : ""}.`;
    }else if(payload.compareTone === "down"){
      headline = `${payload.entityName} came in below ${previousLabel}${share >= 45 ? ", which pulled on the overall result" : ""}.`;
    }
    const value = payload.percentValid ? signedPctText(payload.deltaPct) : signedMoneyText(payload.deltaValue);
    const statusBits = [`${currentLabel} ${payload.currentTrips || 0} trips`, `${previousLabel} ${payload.previousTrips || 0} trips`];
    if(share > 0) statusBits.push(`${share}% of ${noun} $ now`);
    if(Math.abs(safeNum(payload.shareDeltaPct)) >= 3) statusBits.push(`${Math.round(payload.shareDeltaPct)} share pts`);
    return {
      type: "summary",
      label: `${noun[0].toUpperCase()}${noun.slice(1)} compare`,
      headline,
      value,
      valueClass: "money",
      statusTone: payload.compareTone,
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
    const headline = `${best.name} ${best.compareTone === "down" ? "fell back the most" : "gained the most"} compared with the earlier period.`;
    const value = best.deltaPct != null ? signedPctText(best.deltaPct) : signedMoneyText(best.deltaValue);
    return {
      type: "summary",
      label,
      headline,
      value,
      valueClass: "money",
      statusTone: best.compareTone,
      statusText: `${formatMoney(to2(best.currentAmount))} now vs ${formatMoney(to2(best.previousAmount))} before • ${best.confidenceLabel === "early" ? "early read" : ((best.confidenceLabel || "weak") === "weak" ? "light read" : "strong read")}`
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
      statusTone: "up",
      statusText: `${leaderChange.currentLeader.name} now • ${leaderChange.previousLeader.name} before`
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
      headline: `${strongest.name} ${direction} the most ${noun} dollar share.`,
      value: `${Math.round(strongest.shareDeltaPct)} pts`,
      valueClass: "money",
      statusTone: strongest.shareDeltaPct > 0 ? "up" : "down",
      statusText: `${Math.round(safeNum(strongest.currentSharePct))}% now vs ${Math.round(safeNum(strongest.previousSharePct))}% before`
    };
  }

  function renderHighlightsStrip({ dealerRows, monthRows, areaRows, trips, compareFoundation }){
    const topDealer = dealerRows[0] || null;
    const strongestArea = areaRows[0] || null;
    const latestMonth = monthRows[monthRows.length - 1] || null;
    const priorMonth = monthRows[monthRows.length - 2] || null;
    const compare = compareFoundation || buildReportsCompareFoundation({ trips, monthRows, dealerRows, areaRows });
    const totalDealerAmount = dealerRows.reduce((sum, row)=> sum + safeNum(row?.amt), 0);
    const totalAreaAmount = areaRows.reduce((sum, row)=> sum + safeNum(row?.amt), 0);

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

    const weakestDealer = dealerRows.length >= 3 ? dealerRows[dealerRows.length - 1] : null;
    const weakestArea = areaRows.length >= 3 ? areaRows[areaRows.length - 1] : null;
    const dealerMovement = buildEntityMovementSummary({ movement: compare.dealer?.movement, label: "Dealer movement", noun: "dealer" });
    const areaMovement = buildEntityMovementSummary({ movement: compare.area?.movement, label: "Area movement", noun: "area" });
    const dealerLeaderChange = buildLeaderChangeSummary({ leaderChange: compare.dealer?.leaderChange, noun: "dealer" });
    const areaLeaderChange = buildLeaderChangeSummary({ leaderChange: compare.area?.leaderChange, noun: "area" });
    const dealerShareShift = buildShareShiftSummary({ shareShift: compare.dealer?.shareShift, noun: "dealer" });
    const areaShareShift = buildShareShiftSummary({ shareShift: compare.area?.shareShift, noun: "area" });

    const trendCue = (()=>{
      if(monthRows.length < 3) return null;
      const recent = monthRows.slice(-3);
      const lbs = recent.map((r)=> safeNum(r.lbs));
      const tripsVals = recent.map((r)=> safeNum(r.trips));
      const isUp = (arr)=> arr[2] > arr[1] && arr[1] > arr[0];
      const isDown = (arr)=> arr[2] < arr[1] && arr[1] < arr[0];
      if(isUp(lbs)) return { headline: "Pounds have climbed for three months.", tone: "up" };
      if(isDown(lbs)) return { headline: "Pounds have softened for three months.", tone: "down" };
      if(isUp(tripsVals)) return { headline: "Trips have climbed across the last three months.", tone: "up" };
      if(isDown(tripsVals)) return { headline: "Trips have eased across the last three months.", tone: "down" };
      return { headline: "No clear three-month trend yet in this range.", tone: "steady" };
    })();

    const dealerShare = totalDealerAmount > 0 ? Math.round((safeNum(topDealer?.amt) / totalDealerAmount) * 100) : 0;
    const areaShare = totalAreaAmount > 0 ? Math.round((safeNum(strongestArea?.amt) / totalAreaAmount) * 100) : 0;

    const summaryCards = [
      buildLeaderSummary({ label: "Top dealer", entity: topDealer, totalAmount: totalDealerAmount, noun: "dealer" }),
      buildEntityCompareSummary({ payload: compare.dealer, period: compare.period, share: dealerShare, noun: "dealer" }),
      buildTrailingSummary({ label: "Weakest dealer", entity: weakestDealer, leader: topDealer, noun: "dealer" }),
      buildLeaderSummary({ label: "Strongest area", entity: strongestArea, totalAmount: totalAreaAmount, noun: "area" }),
      buildEntityCompareSummary({ payload: compare.area, period: compare.period, share: areaShare, noun: "area" }),
      buildTrailingSummary({ label: "Weakest area", entity: weakestArea, leader: strongestArea, noun: "area" }),
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
        value: latestMonth ? `${to2(latestMonth.lbs)} lbs` : "—",
        valueClass: "lbsBlue",
        statusTone: trendCue.tone,
        statusText: latestMonth && priorMonth ? `${latestMonth.label} vs ${priorMonth.label}` : "Gathering trend context"
      } : null,
      compare.period?.suppressed ? {
        type: "summary",
        label: "Compare guardrail",
        headline: "Comparison held back for fairness.",
        value: "Suppressed",
        statusTone: "steady",
        statusText: compare.period.reason || compare.period.explanation || "Not enough data yet"
      } : null
    ].filter(Boolean);

    const featuredSummaries = summaryCards.filter(Boolean).slice(0, 8);
    const highlights = [];
    if(metricCompareCards.length >= 2 && featuredSummaries.length){
      highlights.push(featuredSummaries[0], metricCompareCards[0], metricCompareCards[1], ...featuredSummaries.slice(1));
    }else if(metricCompareCards.length === 1){
      highlights.push(metricCompareCards[0], ...featuredSummaries);
    }else{
      highlights.push(...featuredSummaries);
    }

    if(!highlights.length) return "";

    return `
      <div class="reportsHighlightsCard">
        <div class="reportsHighlightsHdr">Range insights</div>
        <div class="reportsHighlightsGrid">
          ${highlights.map(item=>`
            <div class="reportsHighlightItem reportsHighlightItem--${item.type === "compare" ? "compare" : "summary"}">
              <div class="reportsHighlightLabel">${escapeHtml(item.label)}</div>
              <div class="reportsHighlightHeadline">${renderPercentEmphasisText(item.headline)}</div>
              ${item.type === "compare" ? `
                <div class="reportsHighlightMetricRow">
                  <div class="reportsHighlightValue ${item.valueClass || ""}">${renderPercentEmphasisText(item.value)}</div>
                  <div class="reportsMiniPreview" role="presentation" aria-hidden="true">
                    <span class="reportsMiniPreviewBar"><span class="reportsMiniPreviewFill" style="width:${item.aPct}%"></span></span>
                    <span class="reportsMiniPreviewBar muted"><span class="reportsMiniPreviewFill" style="width:${item.bPct}%"></span></span>
                  </div>
                </div>
                <div class="reportsCompareRow tone-${escapeHtml(item.compareTone)}">${renderPercentEmphasisText(item.compareText)}</div>
                <div class="reportsCompareBars" role="presentation">
                  <div class="reportsCompareLine">
                    <div class="reportsCompareMeta"><span>${escapeHtml(item.aLabel)}</span><b class="${item.valueClass || ""}">${escapeHtml(item.aValue)}</b></div>
                    <div class="reportsCompareBarTrack"><span style="width:${item.aPct}%"></span></div>
                  </div>
                  <div class="reportsCompareLine">
                    <div class="reportsCompareMeta"><span>${escapeHtml(item.bLabel)}</span><b class="${item.valueClass || ""}">${escapeHtml(item.bValue)}</b></div>
                    <div class="reportsCompareBarTrack muted"><span style="width:${item.bPct}%"></span></div>
                  </div>
                </div>
              ` : `
                <div class="reportsHighlightMetricRow reportsHighlightMetricRow--summary">
                  <div class="reportsHighlightValue ${item.valueClass || ""}">${renderPercentEmphasisText(item.value)}</div>
                </div>
                <div class="reportsCompareRow tone-${escapeHtml(item.statusTone)}">${renderPercentEmphasisText(item.statusText)}</div>
              `}
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  function buildMetricCard({ payload, headlineLabel, formatter, period, compare }){
    if(!payload || payload.suppressed) return null;
    const cur = payload.currentValue;
    const prev = payload.previousValue;
    const maxVal = Math.max(cur, prev, 1);

    return {
      type: "compare",
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
