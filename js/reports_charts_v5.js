const chartAnimationState = new Map();

export function drawReportsCharts(monthRows, dealerRows, trips, options = {}){
  function setupCanvas(canvas){
    if(!canvas) return null;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(280, rect.width || canvas.parentElement?.clientWidth || 320);
    const h = canvas.height || 180;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr,0,0,dpr,0,0);
    return { canvas, ctx, w, h };
  }

  function clear(ctx, w, h){
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle = "rgba(255,255,255,0.02)";
    ctx.fillRect(0,0,w,h);
  }

  const css = getComputedStyle(document.documentElement);
  const color = (name, fallback)=> (css.getPropertyValue(name) || "").trim() || fallback;
  const palette = {
    money: color("--money", "rgba(76,191,117,0.9)"),
    ppl: color("--ppl", "rgba(255,196,77,0.92)"),
    lbs: color("--lbs", "rgba(77,155,255,0.9)"),
    trips: color("--accent", "rgba(180,161,255,0.78)"),
    grid: "rgba(255,255,255,0.07)",
    label: "rgba(255,255,255,0.8)",
    axis: "rgba(255,255,255,0.2)",
    plotBg: "rgba(255,255,255,0.025)"
  };

  function chartFrame(w,h){
    const compact = w < 360;
    return {
      compact,
      left: compact ? 46 : 54,
      right: compact ? 12 : 16,
      top: compact ? 14 : 16,
      bottom: compact ? 40 : 42,
      tickFont: compact ? "11px system-ui, -apple-system, Segoe UI, Arial" : "12px system-ui, -apple-system, Segoe UI, Arial"
    };
  }

  function drawAxes(ctx, w, h, frame){
    const x0 = frame.left;
    const y0 = h - frame.bottom;
    const yTop = frame.top;
    const xRight = w - frame.right;

    ctx.strokeStyle = palette.grid;
    ctx.lineWidth = 1;

    const gridLines = 3;
    for(let i=0;i<=gridLines;i++){
      const y = y0 - ((y0 - yTop) * (i / gridLines));
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(xRight, y);
      ctx.stroke();
    }

    ctx.strokeStyle = palette.axis;
    ctx.beginPath();
    ctx.moveTo(x0, yTop);
    ctx.lineTo(x0, y0);
    ctx.lineTo(xRight, y0);
    ctx.stroke();
    return { x0, y0, yTop, xRight, plotW: xRight - x0, plotH: y0 - yTop };
  }

  function drawYLabel(ctx, text, frame){
    ctx.fillStyle = palette.label;
    ctx.font = frame.tickFont;
    ctx.fillText(text, frame.left + 4, frame.top + 10);
  }

  function niceScale(maxV, steps){
    const safeMax = Math.max(1, Number(maxV) || 0);
    const rough = safeMax / Math.max(1, steps);
    const mag = Math.pow(10, Math.floor(Math.log10(rough)));
    const norm = rough / mag;
    const niceNorm = norm <= 1 ? 1 : (norm <= 2 ? 2 : (norm <= 5 ? 5 : 10));
    const step = niceNorm * mag;
    const top = Math.ceil(safeMax / step) * step;
    return { step, top, steps: Math.max(1, Math.round(top / step)) };
  }

  function drawYTickLabels(ctx, geom, frame, labels){
    ctx.fillStyle = palette.label;
    ctx.font = frame.tickFont;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    labels.forEach((t)=>{
      const ratio = t.pos;
      const y = geom.y0 - (ratio * geom.plotH);
      ctx.fillText(t.label, frame.left - 6, y);
    });
    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";
  }

  function drawBottomTicks(ctx, labels, geom, y, frame){
    const maxTicks = frame.compact ? 4 : 6;
    const step = Math.max(1, Math.ceil(labels.length / maxTicks));
    ctx.fillStyle = palette.label;
    ctx.font = frame.tickFont;
    let lastRight = -Infinity;
    labels.forEach((lab,i)=>{
      if(i % step !== 0 && i !== labels.length - 1) return;
      const x = geom.x0 + ((geom.plotW * i) / (Math.max(1, labels.length - 1)));
      const text = String(lab || "");
      const m = ctx.measureText(text);
      let tx = x - (m.width / 2);
      tx = Math.max(2, Math.min(geom.xRight - m.width, tx));
      if(tx <= lastRight + (frame.compact ? 9 : 7)) return;
      ctx.fillText(text, tx, y);
      lastRight = tx + m.width;
    });
  }

  function fitLabel(ctx, text, maxW){
    const src = String(text || "");
    if(!src) return "";
    if(ctx.measureText(src).width <= maxW) return src;
    const parts = src.split(/\s+/).filter(Boolean);
    if(parts.length > 1){
      const initials = parts.map(p=>p[0]).join("").slice(0,4);
      if(initials && ctx.measureText(initials).width <= maxW) return initials;
    }
    if(maxW < 12) return "";
    let out = src;
    while(out.length > 2 && ctx.measureText(out + "…").width > maxW){
      out = out.slice(0,-1);
    }
    return out.length < src.length ? (out + "…") : out;
  }

  function formatShortMoney(v){
    const n = Number(v)||0;
    return "$" + (Math.round(n*100)/100).toFixed(2);
  }

  function formatCompactMoney(v){
    const n = Number(v) || 0;
    if(n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
    if(n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
    return `$${Math.round(n)}`;
  }

  function formatCompactCount(v){
    const n = Number(v) || 0;
    if(n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return `${Math.round(n)}`;
  }

  function normalizeDealerLabel(name){
    const src = String(name || "").trim();
    if(!src) return "";
    const cleaned = src.replace(/\s+/g, " ");
    if(cleaned.length <= 14) return cleaned;
    const words = cleaned.split(" ").filter(Boolean);
    if(words.length > 1){
      return `${words[0]} ${words[1]}`;
    }
    return cleaned;
  }

  function makeTripsTimeline(rows){
    const byKey = new Map();
    rows.forEach((t)=>{
      const iso = String(t?.dateISO || "");
      if(!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return;
      const key = iso.slice(0,7);
      byKey.set(key, (byKey.get(key) || 0) + 1);
    });
    return Array.from(byKey.entries())
      .sort((a,b)=> a[0].localeCompare(b[0]))
      .map(([key, count])=>{
        const year = Number(key.slice(0,4));
        const month = Number(key.slice(5,7));
        const dt = new Date(year, month - 1, 1);
        return {
          key,
          count,
          label: dt.toLocaleString(undefined, { month:"short" }),
          shortLabel: `${dt.toLocaleString(undefined, { month:"short" })} ${String(year).slice(-2)}`
        };
      });
  }

  function easeOutCubic(t){
    return 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);
  }

  function renderAnimatedChart(canvas, nextValues, drawFrame){
    const key = canvas.id || `reports-chart-${Math.random().toString(36).slice(2)}`;
    const next = nextValues.map((v)=> Number(v) || 0);
    const signature = JSON.stringify(next);
    const prevState = chartAnimationState.get(key) || null;
    if(prevState?.signature === signature){
      drawFrame(next, 1);
      return;
    }

    if(prevState?.rafId) cancelAnimationFrame(prevState.rafId);
    const from = next.map((_, index)=> (prevState?.values?.[index] ?? 0));
    const duration = prevState ? 170 : 230;
    const state = {
      signature,
      values: next.slice(),
      rafId: 0
    };
    chartAnimationState.set(key, state);

    const start = performance.now();
    const tick = (now)=>{
      const progress = duration <= 0 ? 1 : Math.min(1, (now - start) / duration);
      const eased = easeOutCubic(progress);
      const frameValues = next.map((target, index)=> from[index] + ((target - from[index]) * eased));
      drawFrame(frameValues, Math.max(0.84, eased));
      if(progress < 1){
        state.rafId = requestAnimationFrame(tick);
      }else{
        state.rafId = 0;
        drawFrame(next, 1);
      }
    };
    state.rafId = requestAnimationFrame(tick);
  }

  function drawLineChart(canvasId, values, labels){
    const c = setupCanvas(document.getElementById(canvasId));
    if(!c) return;
    const { canvas, ctx, w, h } = c;
    const frame = chartFrame(w,h);
    const targetMax = Math.max(1e-6, ...values, 0);
    const targetMin = Math.min(...values, 0);
    const targetSpan = (targetMax - targetMin) || targetMax || 1;
    renderAnimatedChart(canvas, values, (animatedVals, alpha)=>{
      clear(ctx,w,h);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = palette.plotBg;
      ctx.fillRect(frame.left, frame.top, w - frame.left - frame.right, h - frame.top - frame.bottom);
      const geom = drawAxes(ctx,w,h,frame);
      ctx.strokeStyle = palette.ppl;
      ctx.lineWidth = frame.compact ? 2.8 : 3.2;
      ctx.beginPath();
      animatedVals.forEach((v,i)=>{
        const x = geom.x0 + (i/(animatedVals.length-1 || 1))*geom.plotW;
        const y = geom.y0 - ((v - targetMin)/targetSpan)*geom.plotH;
        if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
      });
      ctx.stroke();
      ctx.fillStyle = palette.ppl;
      animatedVals.forEach((v,i)=>{
        const x = geom.x0 + (i/(animatedVals.length-1 || 1))*geom.plotW;
        const y = geom.y0 - ((v - targetMin)/targetSpan)*geom.plotH;
        ctx.beginPath();
        ctx.arc(x,y,frame.compact ? 3.3 : 3.8,0,Math.PI*2);
        ctx.fill();
      });
      drawBottomTicks(ctx, labels, geom, h-10, frame);
      drawYTickLabels(ctx, geom, frame, [
        { pos: 1, label: formatShortMoney(targetMax) },
        { pos: 0.5, label: formatShortMoney(targetMin + (targetSpan * 0.5)) },
        { pos: 0, label: formatShortMoney(targetMin) }
      ]);
      drawYLabel(ctx, formatShortMoney(targetMax), frame);
      ctx.restore();
    });
  }

  function drawBarChart(canvasId, values, labels, barColor, yLabelFormatter, topLabel, options = {}){
    const c = setupCanvas(document.getElementById(canvasId));
    if(!c) return;
    const { canvas, ctx, w, h } = c;
    const frame = chartFrame(w,h);
    const targetTop = Math.max(options.minTop || 1, ...values, 0);
    renderAnimatedChart(canvas, values, (animatedVals, alpha)=>{
      clear(ctx,w,h);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = palette.plotBg;
      ctx.fillRect(frame.left, frame.top, w - frame.left - frame.right, h - frame.top - frame.bottom);
      const geom = drawAxes(ctx,w,h,frame);
      const yScale = niceScale(targetTop, 4);
      const barW = geom.plotW / (animatedVals.length || 1);
      animatedVals.forEach((v,i)=>{
        const safe = Math.max(0, Number(v) || 0);
        const bh = yScale.top ? (safe / yScale.top) * geom.plotH : 0;
        const barPad = typeof options.barPad === "function" ? options.barPad(frame) : (frame.compact ? 1 : 1.4);
        const x = geom.x0 + i*barW + barPad;
        const y = geom.y0 - bh;
        ctx.fillStyle = barColor;
        ctx.fillRect(x, y, Math.max(options.minBarWidth || 4, barW - (barPad * 2)), bh);
      });
      if(options.customLabels){
        options.customLabels({ ctx, frame, geom, barW, canvasHeight: h });
      }else{
        drawBottomTicks(ctx, labels, geom, h-10, frame);
      }
      const yLabels = [];
      for(let v=0; v<=yScale.top + 1e-9; v += yScale.step){
        yLabels.push({ pos: yScale.top ? (v / yScale.top) : 0, label: yLabelFormatter(v) });
      }
      drawYTickLabels(ctx, geom, frame, yLabels);
      drawYLabel(ctx, topLabel, frame);
      ctx.restore();
    });
  }

  function resolveMetricDetailPalette(metricKey){
    if(metricKey === "amount") return { color: palette.money, yFormatter: formatCompactMoney, topFormatter: formatShortMoney };
    if(metricKey === "ppl") return { color: palette.ppl, yFormatter: formatShortMoney, topFormatter: formatShortMoney };
    if(metricKey === "pounds") return { color: palette.lbs, yFormatter: formatCompactCount, topFormatter: (v)=> `${Math.round(Number(v) || 0)}` };
    return { color: palette.trips, yFormatter: formatCompactCount, topFormatter: (v)=> `${Math.round(Number(v) || 0)}` };
  }

  function drawMetricDetailCompareChart(metricDetail){
    const metricKey = String(metricDetail?.metricKey || "").toLowerCase();
    const compareChart = metricDetail?.compareChart;
    if(!metricKey || !compareChart) return false;
    const canvasIdByMetric = { trips: "c_trips", pounds: "c_lbs", amount: "c_dealer", ppl: "c_ppl" };
    const canvasId = canvasIdByMetric[metricKey];
    if(!canvasId || !document.getElementById(canvasId)) return false;
    const values = Array.isArray(compareChart?.values) ? compareChart.values.map((v)=> Number(v) || 0) : [];
    const labels = Array.isArray(compareChart?.labels) ? compareChart.labels.map((v)=> String(v || "")) : [];
    const paletteSet = resolveMetricDetailPalette(metricKey);
    const topValue = Math.max(...values, metricKey === "trips" ? 1 : 0);
    drawBarChart(
      canvasId,
      values,
      labels,
      paletteSet.color,
      paletteSet.yFormatter,
      paletteSet.topFormatter(topValue),
      {
        minTop: metricKey === "trips" ? 1 : 0,
        minBarWidth: 18,
        barPad: (frame)=> frame.compact ? 8 : 14
      }
    );
    return true;
  }

  if(drawMetricDetailCompareChart(options?.metricDetail)) return;

  const tripsTimeline = makeTripsTimeline(trips);
  const pplValues = monthRows.map((r)=> Number(r.avg) || 0);
  drawLineChart("c_ppl", pplValues, monthRows.map((r)=> r.label));

  const topDealers = dealerRows.slice(0,8);
  drawBarChart(
    "c_dealer",
    topDealers.map((r)=> Number(r.amt) || 0),
    topDealers.map((r)=> normalizeDealerLabel(r.name || "")),
    palette.money,
    formatCompactMoney,
    formatShortMoney(Math.max(...topDealers.map((r)=> Number(r.amt) || 0), 0)),
    {
      minBarWidth: 8,
      barPad: (frame)=> frame.compact ? 3 : 4,
      customLabels: ({ ctx, frame, geom, barW, canvasHeight })=>{
        ctx.fillStyle = palette.label;
        ctx.font = frame.tickFont;
        const labelStep = Math.max(1, Math.ceil(topDealers.length / (frame.compact ? 5 : 7)));
        topDealers.forEach((r,i)=>{
          if(i % labelStep !== 0 && i !== topDealers.length - 1) return;
          const maxLabelW = Math.max(18, barW - 1);
          const base = normalizeDealerLabel(r.name || "");
          const lab = fitLabel(ctx, base, maxLabelW);
          const tx = geom.x0 + i*barW + ((barW - ctx.measureText(lab).width) / 2);
          const x = Math.max(2, tx);
          ctx.fillText(lab, x, canvasHeight-10);
        });
      }
    }
  );

  const lbsValues = monthRows.map((r)=> Number(r.lbs) || 0);
  drawBarChart("c_lbs", lbsValues, monthRows.map((r)=> r.label), palette.lbs, formatCompactCount, String(Math.round(Math.max(...lbsValues, 0))), {
    minBarWidth: 4,
    barPad: (frame)=> frame.compact ? 0.8 : 1.2
  });

  const tripValues = tripsTimeline.map((r)=> Number(r.count) || 0);
  drawBarChart("c_trips", tripValues, tripsTimeline.map((r)=> r.shortLabel), palette.trips, formatCompactCount, String(Math.round(Math.max(...tripValues, 1))), {
    minBarWidth: 4,
    minTop: 1,
    barPad: (frame)=> frame.compact ? 0.8 : 1.2
  });
}
