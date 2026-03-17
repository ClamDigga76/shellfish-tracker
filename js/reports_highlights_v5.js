import { buildReportsCompareFoundation } from "./reports_compare_foundations_v5.js";

export function createReportsHighlightsSeam(deps){
  const {
    escapeHtml,
    formatMoney,
    to2
  } = deps;

  function renderHighlightsStrip({ dealerRows, monthRows, areaRows, trips }){
    const topDealer = dealerRows[0] || null;
    const strongestArea = areaRows[0] || null;
    const latestMonth = monthRows[monthRows.length - 1] || null;
    const priorMonth = monthRows[monthRows.length - 2] || null;
    const safeNum = (v)=> Number(v) || 0;
    const compare = buildReportsCompareFoundation({ trips, monthRows, dealerRows, areaRows });

    const metricCompareCards = [
      buildMetricCard({
        payload: compare.metrics.pounds,
        headlineLabel: "Total pounds",
        formatter: (v)=> `${to2(v)} lbs`,
        period: compare.period
      }),
      buildMetricCard({
        payload: compare.metrics.ppl,
        headlineLabel: "Average price per lb",
        formatter: (v)=> `${formatMoney(to2(v))}/lb`,
        period: compare.period
      }),
      buildMetricCard({
        payload: compare.metrics.trips,
        headlineLabel: "Trip count",
        formatter: (v)=> `${Math.round(v)} trips`,
        period: compare.period
      }),
      buildMetricCard({
        payload: compare.metrics.amount,
        headlineLabel: "Total amount",
        formatter: (v)=> formatMoney(to2(v)),
        period: compare.period
      })
    ].filter(Boolean);

    const weakestDealer = dealerRows.length >= 3 ? dealerRows[dealerRows.length - 1] : null;
    const weakestArea = areaRows.length >= 3 ? areaRows[areaRows.length - 1] : null;

    const buildEntityMovementInsight = ({ entityType, label, minRatio = 0.2 })=>{
      if(!latestMonth || !priorMonth) return null;
      const data = Array.isArray(trips) ? trips : [];
      if(data.length < 4) return null;
      const byEntity = new Map();

      data.forEach((t)=>{
        const dateISO = String(t?.dateISO || "");
        if(!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return;
        const monthKey = dateISO.slice(0, 7);
        const monthLabel = monthRows.find((m)=> m.monthKey === monthKey)?.label;
        if(monthLabel !== latestMonth.label && monthLabel !== priorMonth.label) return;

        const rawName = entityType === "dealer" ? String(t?.dealer || "") : String(t?.area || "");
        const name = rawName.trim() || "(Unspecified)";
        const key = name.toLowerCase();

        const slot = byEntity.get(key) || { name, latest: 0, prior: 0 };
        const amt = safeNum(t?.amount);
        if(monthLabel === latestMonth.label) slot.latest += amt;
        if(monthLabel === priorMonth.label) slot.prior += amt;
        byEntity.set(key, slot);
      });

      let best = null;
      byEntity.forEach((slot)=>{
        if(slot.latest <= 0 && slot.prior <= 0) return;
        const baseline = Math.max(slot.prior, 1);
        const delta = slot.latest - slot.prior;
        const ratio = Math.abs(delta) / baseline;
        if(ratio < minRatio) return;
        if(!best || ratio > best.ratio){
          best = { ...slot, delta, ratio };
        }
      });

      if(!best) return null;
      return {
        type: "summary",
        label,
        headline: `${best.name} ${best.delta > 0 ? "improved" : "cooled off"} versus last month.`,
        value: `${best.delta > 0 ? "+" : ""}${Math.round(best.ratio * 100)}%`,
        statusTone: best.delta > 0 ? "up" : "down",
        statusText: `${latestMonth.label} ${formatMoney(to2(best.latest))} vs ${priorMonth.label} ${formatMoney(to2(best.prior))}`
      };
    };

    const dealerMovement = buildEntityMovementInsight({ entityType: "dealer", label: "Dealer movement" });
    const areaMovement = buildEntityMovementInsight({ entityType: "area", label: "Area movement" });

    const trendCue = (()=>{
      if(monthRows.length < 3) return null;
      const recent = monthRows.slice(-3);
      const lbs = recent.map((r)=> safeNum(r.lbs));
      const tripsVals = recent.map((r)=> safeNum(r.trips));
      const isUp = (arr)=> arr[2] > arr[1] && arr[1] > arr[0];
      const isDown = (arr)=> arr[2] < arr[1] && arr[1] < arr[0];
      if(isUp(lbs)) return { headline: "Pounds have climbed for three months.", tone: "up" };
      if(isDown(lbs)) return { headline: "Pounds have softened for three months.", tone: "down" };
      if(isUp(tripsVals)) return { headline: "Trips are trending up across recent months.", tone: "up" };
      if(isDown(tripsVals)) return { headline: "Trips are trending down across recent months.", tone: "down" };
      return { headline: "No strong rolling trend yet in this range.", tone: "steady" };
    })();

    const summaryCards = [
      topDealer ? {
        type: "summary",
        label: "Top dealer",
        headline: `${topDealer.name} led dealer totals in this range.`,
        value: formatMoney(to2(topDealer.amt)),
        valueClass: "money",
        statusTone: "up",
        statusText: `${topDealer.trips} trips • ${to2(topDealer.lbs)} lbs`
      } : null,
      compare.dealer && !compare.dealer.suppressed ? {
        type: "summary",
        label: "Dealer compare",
        headline: `${compare.dealer.entityName} changed versus prior comparable month.`,
        value: compare.dealer.percentValid ? `${Math.round(compare.dealer.deltaPct * 100)}%` : formatMoney(to2(compare.dealer.deltaValue)),
        valueClass: "money",
        statusTone: compare.dealer.compareTone,
        statusText: `${compare.period.currentLabel} vs ${compare.period.previousLabel}`
      } : null,
      weakestDealer && safeNum(topDealer?.amt) > 0 && (safeNum(weakestDealer.amt) / safeNum(topDealer.amt)) <= 0.7 ? {
        type: "summary",
        label: "Weakest dealer",
        headline: `${weakestDealer.name} is trailing this range.`,
        value: formatMoney(to2(weakestDealer.amt)),
        valueClass: "money",
        statusTone: "down",
        statusText: `${weakestDealer.trips} trips • ${to2(weakestDealer.lbs)} lbs`
      } : null,
      strongestArea ? {
        type: "summary",
        label: "Strongest area",
        headline: `${strongestArea.name} led area totals in this range.`,
        value: formatMoney(to2(strongestArea.amt)),
        valueClass: "money",
        statusTone: "neutral",
        statusText: `${strongestArea.trips} trips • ${to2(strongestArea.lbs)} lbs`
      } : null,
      compare.area && !compare.area.suppressed ? {
        type: "summary",
        label: "Area compare",
        headline: `${compare.area.entityName} changed versus prior comparable month.`,
        value: compare.area.percentValid ? `${Math.round(compare.area.deltaPct * 100)}%` : formatMoney(to2(compare.area.deltaValue)),
        valueClass: "money",
        statusTone: compare.area.compareTone,
        statusText: `${compare.period.currentLabel} vs ${compare.period.previousLabel}`
      } : null,
      weakestArea && safeNum(strongestArea?.amt) > 0 && (safeNum(weakestArea.amt) / safeNum(strongestArea.amt)) <= 0.7 ? {
        type: "summary",
        label: "Weakest area",
        headline: `${weakestArea.name} is trailing this range.`,
        value: formatMoney(to2(weakestArea.amt)),
        valueClass: "money",
        statusTone: "down",
        statusText: `${weakestArea.trips} trips • ${to2(weakestArea.lbs)} lbs`
      } : null,
      dealerMovement,
      areaMovement,
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
        statusText: compare.period.reason || "Low-data baseline"
      } : null
    ].filter(Boolean);

    const highlights = [];
    if(metricCompareCards.length >= 2 && summaryCards.length){
      highlights.push(summaryCards[0], metricCompareCards[0], metricCompareCards[1], ...summaryCards.slice(1, 4));
    }else if(metricCompareCards.length === 1){
      highlights.push(metricCompareCards[0], ...summaryCards.slice(0, 4));
    }else{
      highlights.push(...summaryCards.slice(0, 6));
    }

    if(!highlights.length) return "";

    return `
      <div class="card reportsHighlightsCard">
        <div class="reportsHighlightsHdr">Range insights</div>
        <div class="reportsHighlightsGrid">
          ${highlights.map(item=>`
            <div class="reportsHighlightItem reportsHighlightItem--${item.type === "compare" ? "compare" : "summary"}">
              <div class="reportsHighlightLabel">${escapeHtml(item.label)}</div>
              <div class="reportsHighlightHeadline">${escapeHtml(item.headline)}</div>
              ${item.type === "compare" ? `
                <div class="reportsHighlightMetricRow">
                  <div class="reportsHighlightValue ${item.valueClass || ""}">${escapeHtml(item.value)}</div>
                  <div class="reportsMiniPreview" role="presentation" aria-hidden="true">
                    <span class="reportsMiniPreviewBar"><span class="reportsMiniPreviewFill" style="width:${item.aPct}%"></span></span>
                    <span class="reportsMiniPreviewBar muted"><span class="reportsMiniPreviewFill" style="width:${item.bPct}%"></span></span>
                  </div>
                </div>
                <div class="reportsCompareRow tone-${escapeHtml(item.compareTone)}">${item.compareText}</div>
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
                  <div class="reportsHighlightValue ${item.valueClass || ""}">${escapeHtml(item.value)}</div>
                </div>
                <div class="reportsCompareRow tone-${escapeHtml(item.statusTone)}">${escapeHtml(item.statusText)}</div>
              `}
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  function buildMetricCard({ payload, headlineLabel, formatter, period }){
    if(!payload || payload.suppressed) return null;
    const cur = payload.currentValue;
    const prev = payload.previousValue;
    const maxVal = Math.max(cur, prev, 1);
    const deltaPctText = payload.percentValid ? `${Math.abs(Math.round(payload.deltaPct * 100))}%` : "updated";
    const comparisonPhrase = payload.compareTone === "steady"
      ? "about the same as"
      : (payload.compareTone === "up" ? `${deltaPctText} higher than` : `${deltaPctText} lower than`);

    return {
      type: "compare",
      label: payload.label,
      headline: `${headlineLabel} is ${comparisonPhrase} prior comparable period.`,
      value: formatter(cur),
      valueClass: payload.metricKey === "amount"
        ? "money"
        : (payload.metricKey === "pounds" ? "lbsBlue" : (payload.metricKey === "ppl" ? "rate ppl" : "")),
      compareTone: payload.compareTone,
      compareText: `${escapeHtml(period.currentLabel || "Current")} vs ${escapeHtml(period.previousLabel || "Prior")} • ${escapeHtml(period.fairWindowLabel || "Comparable window")}`,
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
