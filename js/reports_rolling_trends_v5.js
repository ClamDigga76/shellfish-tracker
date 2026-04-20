function safeNum(value){
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function getRollingWindowForMetric(metricKey, { surface = "reports" } = {}){
  const key = String(metricKey || "").toLowerCase();
  const bySurface = {
    reports: { trips: 3, pounds: 3, amount: 3, ppl: 3 },
    home: { trips: 3, pounds: 3, amount: 3, ppl: 2 }
  };
  const config = bySurface[surface] || bySurface.reports;
  return Math.max(2, Number(config[key] || 3));
}

function normalizeChronologicalRows(rows){
  const list = Array.isArray(rows) ? rows.slice() : [];
  return list.sort((a, b)=> {
    const keyA = String(a?.monthKey || a?.key || "").trim();
    const keyB = String(b?.monthKey || b?.key || "").trim();
    if(/^\d{4}-\d{2}$/.test(keyA) && /^\d{4}-\d{2}$/.test(keyB)) return keyA.localeCompare(keyB);
    if(/^\d{4}-\d{2}$/.test(keyA)) return -1;
    if(/^\d{4}-\d{2}$/.test(keyB)) return 1;
    return 0;
  });
}

function readMonthlyMetricValue(row, metricKey){
  if(metricKey === "trips") return safeNum(row?.trips);
  if(metricKey === "pounds") return safeNum(row?.lbs);
  if(metricKey === "ppl") return safeNum(row?.avg);
  return safeNum(row?.amt);
}

export function buildRollingSeriesFromMonthRows({ monthRows, metricKey, windowSize, basisLabel = "Rolling trend" } = {}){
  const safeRows = normalizeChronologicalRows(Array.isArray(monthRows) ? monthRows.filter((row)=> row?.monthKey) : []);
  const safeWindow = Math.max(2, Number(windowSize) || 3);
  const rollingRows = [];

  for(let index = safeWindow - 1; index < safeRows.length; index += 1){
    const windowRows = safeRows.slice(index - safeWindow + 1, index + 1);
    const windowValues = windowRows.map((row)=> readMonthlyMetricValue(row, metricKey));
    const rollingValue = metricKey === "ppl"
      ? (windowValues.reduce((sum, value)=> sum + value, 0) / Math.max(1, windowValues.length))
      : windowValues.reduce((sum, value)=> sum + value, 0);
    const monthRow = safeRows[index] || {};
    rollingRows.push({
      monthKey: String(monthRow?.monthKey || ""),
      label: String(monthRow?.label || monthRow?.monthKey || ""),
      value: rollingValue
    });
  }

  const latest = rollingRows[rollingRows.length - 1] || null;
  const previous = rollingRows[rollingRows.length - 2] || null;

  return {
    chartType: "time-series",
    metricKey,
    windowSize: safeWindow,
    basisLabel,
    monthKeys: rollingRows.map((row)=> row.monthKey),
    labels: rollingRows.map((row)=> row.label),
    values: rollingRows.map((row)=> row.value),
    currentLabel: latest?.label || "Current",
    previousLabel: previous?.label || "Previous",
    currentValue: safeNum(latest?.value),
    previousValue: safeNum(previous?.value)
  };
}

export function describeRollingContext({ chartModel, metricKey, compareTone } = {}){
  if(!chartModel || chartModel.chartType !== "time-series" || !(Number(chartModel?.windowSize) >= 2)) return "";
  const values = Array.isArray(chartModel.values) ? chartModel.values.map((value)=> safeNum(value)) : [];
  if(values.length < 2) return "";
  const current = values[values.length - 1];
  const previous = values[values.length - 2];
  if(!(previous > 0)) return "";
  const deltaPct = (current - previous) / previous;
  const absDeltaPct = Math.abs(deltaPct);
  if(absDeltaPct < 0.05) return "";

  const rollingTone = deltaPct > 0 ? "up" : "down";
  const pctText = `${Math.round(absDeltaPct * 100)}%`;
  const unit = metricKey === "ppl" ? "rolling $/lb" : "rolling window";

  if(compareTone === "steady"){
    return `Rolling context: the ${unit} is ${rollingTone} about ${pctText} vs the prior rolling window.`;
  }
  if(compareTone !== rollingTone){
    return `Rolling context: recent movement is ${rollingTone} (${pctText}) versus the prior rolling window, so this move may be noisy.`;
  }
  return "";
}
