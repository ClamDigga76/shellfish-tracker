export function buildReportsAggregationState({ trips, canonicalDealerGroupKey, normalizeDealerDisplay }){
  const safeTrips = Array.isArray(trips) ? trips : [];

  const byDealer = new Map();
  const byArea = new Map();
  const byMonth = new Map();

  safeTrips.forEach((t)=>{
    const dealerRaw = (t?.dealer || "").toString();
    const dealerName = normalizeDealerDisplay(dealerRaw) || "(Unspecified)";
    const dealerKey = canonicalDealerGroupKey(dealerRaw) || "(unspecified)";
    const area = ((t?.area || "").toString().trim()) || "(Unspecified)";
    const areaKey = area.toLowerCase();

    const lbs = Number(t?.pounds) || 0;
    const amt = Number(t?.amount) || 0;

    const dealerAgg = byDealer.get(dealerKey) || { name: dealerName, trips: 0, lbs: 0, amt: 0 };
    dealerAgg.trips += 1;
    dealerAgg.lbs += lbs;
    dealerAgg.amt += amt;
    byDealer.set(dealerKey, dealerAgg);

    const areaAgg = byArea.get(areaKey) || { name: area, trips: 0, lbs: 0, amt: 0 };
    areaAgg.trips += 1;
    areaAgg.lbs += lbs;
    areaAgg.amt += amt;
    byArea.set(areaKey, areaAgg);

    const iso = String(t?.dateISO || "");
    if(/^\d{4}-\d{2}-\d{2}$/.test(iso)){
      const monthKey = iso.slice(0, 7);
      const monthAgg = byMonth.get(monthKey) || { trips: 0, lbs: 0, amt: 0 };
      monthAgg.trips += 1;
      monthAgg.lbs += lbs;
      monthAgg.amt += amt;
      byMonth.set(monthKey, monthAgg);
    }
  });

  const dealerRows = Array.from(byDealer.values())
    .map((x)=> ({ ...x, avg: x.lbs > 0 ? x.amt / x.lbs : 0 }))
    .sort((a,b)=> b.amt - a.amt);

  const areaRows = Array.from(byArea.values())
    .map((x)=> ({ ...x, avg: x.lbs > 0 ? x.amt / x.lbs : 0 }))
    .sort((a,b)=> b.amt - a.amt);

  const monthRows = Array.from(byMonth.entries())
    .sort((a,b)=> a[0].localeCompare(b[0]))
    .map(([monthKey, x])=>{
      const year = Number(monthKey.slice(0, 4));
      const month = Number(monthKey.slice(5, 7));
      const dt = new Date(year, month - 1, 1);
      return {
        monthKey,
        month,
        year,
        label: `${dt.toLocaleString(undefined, { month: "short" })} ${year}`,
        ...x,
        avg: x.lbs > 0 ? x.amt / x.lbs : 0
      };
    });

  const maxLbs = safeTrips.reduce((best,t)=> (Number(t?.pounds) || 0) > (Number(best?.pounds) || 0) ? t : best, safeTrips[0]);
  const minLbs = safeTrips.reduce((best,t)=> (Number(t?.pounds) || 0) < (Number(best?.pounds) || 0) ? t : best, safeTrips[0]);
  const maxAmt = safeTrips.reduce((best,t)=> (Number(t?.amount) || 0) > (Number(best?.amount) || 0) ? t : best, safeTrips[0]);
  const minAmt = safeTrips.reduce((best,t)=> (Number(t?.amount) || 0) < (Number(best?.amount) || 0) ? t : best, safeTrips[0]);

  const pplRows = safeTrips.filter((t)=> (Number(t?.pounds) || 0) > 0 && (Number(t?.amount) || 0) > 0);
  const maxPpl = pplRows.reduce((best,t)=> (Number(t?.amount) || 0) / (Number(t?.pounds) || 1) > (Number(best?.amount) || 0) / (Number(best?.pounds) || 1) ? t : best, pplRows[0]);
  const minPpl = pplRows.reduce((best,t)=> (Number(t?.amount) || 0) / (Number(t?.pounds) || 1) < (Number(best?.amount) || 0) / (Number(best?.pounds) || 1) ? t : best, pplRows[0]);

  const tripsTimeline = buildTripsTimeline(safeTrips);

  return {
    dealerRows,
    areaRows,
    monthRows,
    maxLbs,
    minLbs,
    maxAmt,
    minAmt,
    pplRows,
    maxPpl,
    minPpl,
    tripsTimeline
  };
}

function buildTripsTimeline(rows){
  const byKey = new Map();
  rows.forEach((t)=>{
    const iso = String(t?.dateISO || "");
    if(!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return;
    const key = iso.slice(0, 7);
    byKey.set(key, (byKey.get(key) || 0) + 1);
  });
  return Array.from(byKey.entries())
    .sort((a,b)=> a[0].localeCompare(b[0]))
    .map(([key, count])=>{
      const year = Number(key.slice(0, 4));
      const month = Number(key.slice(5, 7));
      const dt = new Date(year, month - 1, 1);
      return {
        key,
        count,
        label: dt.toLocaleString(undefined, { month: "short" }),
        shortLabel: `${dt.toLocaleString(undefined, { month: "short" })} ${String(year).slice(-2)}`
      };
    });
}
