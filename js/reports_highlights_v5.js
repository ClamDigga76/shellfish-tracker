export function createReportsHighlightsSeam(deps){
  const {
    escapeHtml,
    formatMoney,
    to2
  } = deps;

  function renderHighlightsStrip({ dealerRows, monthRows, areaRows }){
    const topDealer = dealerRows[0] || null;
    const bestPplMonth = monthRows.reduce((best,row)=>{
      if(!best) return row;
      return (Number(row?.avg)||0) > (Number(best?.avg)||0) ? row : best;
    }, null);
    const strongestArea = areaRows[0] || null;
    const latestMonth = monthRows[monthRows.length - 1] || null;
    const priorMonth = monthRows[monthRows.length - 2] || null;

    const relationForDelta = ({ current, previous, epsilon = 0.03 })=>{
      const cur = Number(current) || 0;
      const prev = Number(previous) || 0;
      if(cur === 0 && prev === 0) return { key:"same", text:"about the same", tone:"neutral" };
      const baseline = Math.max(Math.abs(prev), 1e-6);
      const ratio = Math.abs(cur - prev) / baseline;
      if(ratio <= epsilon) return { key:"same", text:"about the same", tone:"neutral" };
      return cur > prev
        ? { key:"higher", text:"higher", tone:"up" }
        : { key:"lower", text:"lower", tone:"down" };
    };

    const compareCards = [];
    if(latestMonth && priorMonth){
      const buildCompareCard = ({ label, headlineLabel, current, previous, formatter, epsilon })=>{
        const relation = relationForDelta({ current, previous, epsilon });
        const curNum = Number(current) || 0;
        const prevNum = Number(previous) || 0;
        const maxVal = Math.max(curNum, prevNum, 1);
        const comparisonPhrase = relation.key === "same"
          ? "about the same as"
          : `${relation.text} than`;
        compareCards.push({
          type: "compare",
          label,
          headline: `${headlineLabel} is ${comparisonPhrase} last month.`,
          value: formatter(curNum),
          compareTone: relation.tone,
          compareText: relation.key === "same"
            ? `${escapeHtml(latestMonth.label)} holding steady vs ${escapeHtml(priorMonth.label)}`
            : `${escapeHtml(latestMonth.label)} ${relation.text} vs ${escapeHtml(priorMonth.label)}`,
          aLabel: latestMonth.label,
          bLabel: priorMonth.label,
          aValue: formatter(curNum),
          bValue: formatter(prevNum),
          aPct: Math.max(10, Math.round((curNum / maxVal) * 100)),
          bPct: Math.max(10, Math.round((prevNum / maxVal) * 100))
        });
      };

      buildCompareCard({
        label: "Monthly pounds",
        headlineLabel: "Total pounds",
        current: latestMonth.lbs,
        previous: priorMonth.lbs,
        formatter: (v)=> `${to2(v)} lbs`,
        epsilon: 0.04
      });

      if((Number(latestMonth.lbs) || 0) > 0 && (Number(priorMonth.lbs) || 0) > 0){
        buildCompareCard({
          label: "Avg $/lb",
          headlineLabel: "Average price per lb",
          current: latestMonth.avg,
          previous: priorMonth.avg,
          formatter: (v)=> `${formatMoney(to2(v))}/lb`,
          epsilon: 0.03
        });
      }

      buildCompareCard({
        label: "Trip count",
        headlineLabel: "Trip count",
        current: latestMonth.trips,
        previous: priorMonth.trips,
        formatter: (v)=> `${Math.round(v)} trips`,
        epsilon: 0
      });
    }

    const summaryCards = [
      topDealer ? {
        type: "summary",
        label: "Top dealer",
        headline: `${topDealer.name} led this range.`,
        value: formatMoney(to2(topDealer.amt)),
        statusTone: "up",
        statusText: `${topDealer.trips} trips • ${to2(topDealer.lbs)} lbs`
      } : null,
      strongestArea ? {
        type: "summary",
        label: "Strongest area",
        headline: `${strongestArea.name} produced the strongest total.`,
        value: formatMoney(to2(strongestArea.amt)),
        statusTone: "neutral",
        statusText: `${strongestArea.trips} trips • ${to2(strongestArea.lbs)} lbs`
      } : null,
      bestPplMonth ? {
        type: "summary",
        label: "Best $/lb month",
        headline: `${bestPplMonth.label} delivered the top avg $/lb.`,
        value: `${formatMoney(to2(bestPplMonth.avg))}/lb`,
        statusTone: "steady",
        statusText: `${bestPplMonth.trips} trips • ${to2(bestPplMonth.lbs)} lbs`
      } : null
    ].filter(Boolean);

    const highlights = [];
    if(compareCards.length >= 2){
      highlights.push(compareCards[0], compareCards[1]);
      if(summaryCards[0]) highlights.push(summaryCards[0]);
    }else if(compareCards.length === 1){
      highlights.push(compareCards[0], ...summaryCards.slice(0, 2));
    }else{
      highlights.push(...summaryCards.slice(0, 3));
    }

    if(!highlights.length) return "";

    return `
      <div class="card reportsHighlightsCard">
        <div class="reportsHighlightsHdr">Range insights</div>
        <div class="reportsHighlightsGrid">
          ${highlights.map(item=>`
            <div class="reportsHighlightItem">
              <div class="reportsHighlightLabel">${escapeHtml(item.label)}</div>
              <div class="reportsHighlightHeadline">${escapeHtml(item.headline)}</div>
              <div class="reportsHighlightValue">${escapeHtml(item.value)}</div>
              ${item.type === "compare" ? `
                <div class="reportsCompareRow tone-${escapeHtml(item.compareTone)}">${item.compareText}</div>
                <div class="reportsCompareBars" role="presentation">
                  <div class="reportsCompareLine">
                    <div class="reportsCompareMeta">${escapeHtml(item.aLabel)} • ${escapeHtml(item.aValue)}</div>
                    <div class="reportsCompareBarTrack"><span style="width:${item.aPct}%"></span></div>
                  </div>
                  <div class="reportsCompareLine">
                    <div class="reportsCompareMeta">${escapeHtml(item.bLabel)} • ${escapeHtml(item.bValue)}</div>
                    <div class="reportsCompareBarTrack muted"><span style="width:${item.bPct}%"></span></div>
                  </div>
                </div>
              ` : `
                <div class="reportsCompareRow tone-${escapeHtml(item.statusTone)}">${escapeHtml(item.statusText)}</div>
              `}
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  return {
    renderHighlightsStrip
  };
}
