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
    const peakLbsMonth = monthRows.reduce((best,row)=>{
      if(!best) return row;
      return (Number(row?.lbs)||0) > (Number(best?.lbs)||0) ? row : best;
    }, null);
    const latestMonth = monthRows[monthRows.length - 1] || null;
    const strongestArea = areaRows[0] || null;

    const highlights = [
      topDealer ? {
        label: "Top dealer",
        value: formatMoney(to2(topDealer.amt)),
        detail: `${topDealer.name} • ${topDealer.trips} trips • ${to2(topDealer.lbs)} lbs`
      } : null,
      bestPplMonth ? {
        label: "Best $/lb month",
        value: `${formatMoney(to2(bestPplMonth.avg))}/lb`,
        detail: `${bestPplMonth.label} • ${bestPplMonth.trips} trips`
      } : null,
      peakLbsMonth ? {
        label: "Peak pounds month",
        value: `${to2(peakLbsMonth.lbs)} lbs`,
        detail: `${peakLbsMonth.label} • ${formatMoney(to2(peakLbsMonth.amt))}`
      } : null,
      latestMonth ? {
        label: "Latest month",
        value: `${to2(latestMonth.lbs)} lbs`,
        detail: `${latestMonth.label} • ${formatMoney(to2(latestMonth.avg))}/lb`
      } : null,
      strongestArea ? {
        label: "Strongest area",
        value: formatMoney(to2(strongestArea.amt)),
        detail: `${strongestArea.name} • ${strongestArea.trips} trips`
      } : null
    ].filter(Boolean);

    if(!highlights.length) return "";

    return `
      <div class="card reportsHighlightsCard">
        <div class="reportsHighlightsHdr">Range highlights</div>
        <div class="reportsHighlightsGrid">
          ${highlights.map(item=>`
            <div class="reportsHighlightItem">
              <div class="reportsHighlightLabel">${escapeHtml(item.label)}</div>
              <div class="reportsHighlightValue">${escapeHtml(item.value)}</div>
              <div class="reportsHighlightDetail">${escapeHtml(item.detail)}</div>
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
