import { buildRollingSeriesFromMonthRows, getRollingWindowForMetric } from "./reports_rolling_trends_v5.js";

const chartAnimationState = new Map();

export function drawReportsCharts(monthRows, dealerRows, tripsOrTimeline, options = {}){
  const monthRowsChronological = normalizeChronologicalRows(monthRows);
  const tripsTimelineChronological = normalizeChronologicalRows(tripsOrTimeline);

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
  }

  const css = getComputedStyle(document.documentElement);
  const color = (name, fallback)=> (css.getPropertyValue(name) || "").trim() || fallback;
  const isLightTheme = document.documentElement.getAttribute("data-theme") === "light";
  const palette = {
    money: color("--money", "rgba(76,191,117,0.9)"),
    ppl: color("--ppl", "rgba(255,196,77,0.92)"),
    lbs: color("--lbs", "rgba(77,155,255,0.9)"),
    trips: color("--trips", "rgba(242,245,255,0.92)"),
    grid: isLightTheme ? "rgba(21,38,72,0.07)" : "rgba(255,255,255,0.045)",
    label: "rgba(255,255,255,0.8)",
    axis: isLightTheme ? "rgba(21,38,72,0.13)" : "rgba(255,255,255,0.11)",
    plotBg: isLightTheme ? "rgba(21,38,72,0.012)" : "rgba(255,255,255,0.008)"
  };

  function chartFrame(w,h, mode = "default"){
    const compact = w < 360;
    const isHomeInsights = mode === "home-insights";
    return {
      compact,
      left: isHomeInsights ? (compact ? 38 : 44) : (compact ? 46 : 54),
      right: isHomeInsights ? (compact ? 8 : 10) : (compact ? 12 : 16),
      top: isHomeInsights ? (compact ? 18 : 20) : (compact ? 26 : 28),
      bottom: isHomeInsights ? (compact ? 46 : 50) : (compact ? 54 : 58),
      tickFont: compact ? "11px system-ui, -apple-system, Segoe UI, Arial" : "12px system-ui, -apple-system, Segoe UI, Arial"
    };
  }

  function hasUsableChartData(chartModel){
    if(!chartModel || typeof chartModel !== "object") return false;
    const values = Array.isArray(chartModel.values) ? chartModel.values : [];
    return values.some((value)=> Number.isFinite(Number(value)) && Number(value) > 0);
  }

  function toggleChartEmptyState(canvasId, shouldShowEmpty, emptyMessage = "Not enough data in this range yet."){
    if(!canvasId) return;
    const canvas = document.getElementById(canvasId);
    if(!canvas) return;
    const emptyNode = Array.from(document.querySelectorAll("[data-chart-empty-for]"))
      .find((node)=> String(node?.getAttribute("data-chart-empty-for") || "") === canvasId);
    if(canvas){
      canvas.hidden = shouldShowEmpty && !!emptyNode;
    }
    if(emptyNode){
      emptyNode.hidden = !shouldShowEmpty;
      if(shouldShowEmpty){
        emptyNode.textContent = String(emptyMessage || "Not enough data in this range yet.");
      }
    }
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

  function formatAxisLabel(label, { labelType = "category", compact = false } = {}){
    const raw = String(label || "").trim();
    const text = labelType === "month" ? raw : stripLeadingRankPrefix(raw);
    if(!text) return "";
    if(labelType === "month"){
      const directMonthMatch = text.match(/^([A-Za-z]{3,9})\s+(\d{2,4})$/);
      if(directMonthMatch){
        const mon = directMonthMatch[1].slice(0,3);
        const yearToken = directMonthMatch[2];
        if(compact) return `${mon} '${yearToken.slice(-2)}`;
        return `${mon} ${yearToken.slice(-2)}`;
      }
      if(/^\d{4}-\d{2}$/.test(text)){
        const [year, month] = text.split("-");
        const monthDate = new Date(`${year}-${month}-01T00:00:00Z`);
        const mon = monthDate.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
        return compact ? `${mon} '${year.slice(-2)}` : `${mon} ${year.slice(-2)}`;
      }
    }
    if(labelType === "compare"){
      return compact ? text.replace(/\s+/g, " ").slice(0, 10) : text;
    }
    return text;
  }

  function stripLeadingRankPrefix(label){
    const text = String(label || "").trim();
    if(!text) return "";
    return text
      .replace(/^\s*(?:#\s*)?\d{1,3}\s*[\).:-]\s*/,"")
      .replace(/\s+/g, " ")
      .trim();
  }

  function drawBottomTicks(ctx, labels, geom, y, frame, options = {}){
    const maxTicks = Number(options.maxTicks) || (frame.compact ? 4 : 6);
    const step = Math.max(1, Math.ceil(labels.length / maxTicks));
    const alignMode = options.alignMode === "bar-center" ? "bar-center" : "index";
    const labelType = options.labelType || "category";
    ctx.fillStyle = palette.label;
    ctx.font = frame.tickFont;
    let lastRight = -Infinity;
    const tickIndexes = new Set([0, Math.max(0, labels.length - 1)]);
    labels.forEach((_, i)=> {
      if(i % step === 0) tickIndexes.add(i);
    });
    Array.from(tickIndexes).sort((a,b)=> a - b).forEach((i)=>{
      const lab = labels[i];
      const slotW = labels.length > 0 ? (geom.plotW / labels.length) : geom.plotW;
      const x = alignMode === "bar-center"
        ? geom.x0 + (slotW * i) + (slotW * 0.5)
        : geom.x0 + ((geom.plotW * i) / (Math.max(1, labels.length - 1)));
      const text = formatAxisLabel(lab, { labelType, compact: frame.compact });
      const m = ctx.measureText(text);
      let tx = x - (m.width / 2);
      tx = Math.max(2, Math.min(geom.xRight - m.width, tx));
      if(tx <= lastRight + (frame.compact ? 9 : 7)){
        if(i !== labels.length - 1) return;
        tx = Math.max(2, geom.xRight - m.width);
      }
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
    const src = stripLeadingRankPrefix(name);
    if(!src) return "";
    const cleaned = src.replace(/\s+/g, " ");
    if(cleaned.length <= 14) return cleaned;
    const words = cleaned.split(" ").filter(Boolean);
    if(words.length > 1){
      return `${words[0]} ${words[1]}`;
    }
    return cleaned;
  }

  function compactDealerTag(name){
    const normalized = normalizeDealerLabel(name);
    if(normalized.length <= 6) return normalized;
    const words = normalized.split(" ").filter(Boolean);
    if(words.length > 1){
      const initials = words.map((part)=> part[0]).join("").slice(0,3);
      if(initials.length >= 2) return initials.toUpperCase();
    }
    return normalized.slice(0, 5).trimEnd() + "…";
  }

  function normalizeAreaLabel(name){
    return stripLeadingRankPrefix(name);
  }

  function splitAreaWords(label){
    return String(label || "")
      .trim()
      .split(/[\s/-]+/)
      .map((word)=> word.trim())
      .filter(Boolean);
  }

  function buildTwoLineAreaWrap(ctx, label, maxW){
    const words = splitAreaWords(label);
    if(words.length < 2) return null;
    let best = null;
    for(let i=1; i<words.length; i++){
      const first = words.slice(0, i).join(" ");
      const second = words.slice(i).join(" ");
      if(!first || !second) continue;
      const firstW = ctx.measureText(first).width;
      const secondW = ctx.measureText(second).width;
      if(firstW > maxW || secondW > maxW) continue;
      const score = Math.abs(firstW - secondW);
      if(!best || score < best.score){
        best = { first, second, score };
      }
    }
    return best ? [best.first, best.second] : null;
  }

  function buildMeaningfulAreaAbbrev(label){
    const words = splitAreaWords(label);
    if(!words.length) return "";
    if(words.length === 1){
      const single = words[0];
      return single.length > 8 ? `${single.slice(0, 8)}…` : single;
    }
    const placeSuffixes = new Set(["bay","harbor","harbour","point","island","isle","beach","cove","reef","channel","banks","shoal","sound","inlet","gulf","coast","head"]);
    const lowerWords = words.map((word)=> word.toLowerCase());
    const suffix = placeSuffixes.has(lowerWords[lowerWords.length - 1]) ? words[words.length - 1] : "";
    const sourceWords = suffix ? words.slice(0, -1) : words;
    const initials = sourceWords
      .filter((word)=> !["of", "the", "and", "at", "in"].includes(word.toLowerCase()))
      .map((word)=> word[0]?.toUpperCase() || "")
      .join("")
      .slice(0, 3);
    if(suffix && initials){
      return `${initials} ${suffix}`;
    }
    if(initials.length >= 2){
      return initials;
    }
    return words.slice(0, 2).join(" ");
  }

  function shortenAreaLabelRecognizable(label){
    const src = String(label || "").trim();
    if(!src) return "";
    if(src.length <= 12) return src;
    return `${src.slice(0, 12).trimEnd()}…`;
  }

  function resolveAreaLabelLayout(ctx, { label, maxW }){
    const fullLabel = normalizeAreaLabel(label);
    if(!fullLabel) return [];
    if(ctx.measureText(fullLabel).width <= maxW){
      return [fullLabel];
    }
    const twoLine = buildTwoLineAreaWrap(ctx, fullLabel, maxW);
    if(twoLine){
      return [twoLine[0], twoLine[1]];
    }
    const meaningful = buildMeaningfulAreaAbbrev(fullLabel);
    if(meaningful){
      if(ctx.measureText(meaningful).width <= maxW){
        return [meaningful];
      }
      const meaningfulTwoLine = buildTwoLineAreaWrap(ctx, meaningful, maxW);
      if(meaningfulTwoLine){
        return [meaningfulTwoLine[0], meaningfulTwoLine[1]];
      }
    }
    const shortened = shortenAreaLabelRecognizable(fullLabel);
    if(ctx.measureText(shortened).width <= maxW){
      return [shortened];
    }
    return [shortened.slice(0, Math.max(6, shortened.length - 1)).trimEnd() + "…"];
  }

  function drawAreaIdentityLabels(labels, { ctx, frame, geom, bars = [], barW, canvasHeight, categoryLabelY = 0 }){
    ctx.fillStyle = palette.label;
    ctx.font = frame.tickFont;
    labels.forEach((rawLabel, i)=>{
      const fullLabel = normalizeAreaLabel(rawLabel || "");
      if(!fullLabel) return;
      const bar = bars[i] || null;
      const labelWidthBase = bar?.width || barW;
      const maxLabelW = Math.max(32, labelWidthBase - 2);
      const lines = resolveAreaLabelLayout(ctx, { label: fullLabel, maxW: maxLabelW });
      if(!lines.length) return;
      const lineHeight = frame.compact ? 10 : 11;
      const preferredBelowY = Number(categoryLabelY) > 0
        ? categoryLabelY
        : (lines.length > 1 ? canvasHeight - 20 : canvasHeight - 10);
      const baseY = preferredBelowY - ((lines.length - 1) * lineHeight);
      lines.forEach((line, lineIndex)=>{
        const left = bar ? bar.x : (geom.x0 + i * barW);
        const width = bar ? bar.width : barW;
        const tx = left + ((width - ctx.measureText(line).width) / 2);
        const x = Math.max(2, tx);
        const y = baseY + (lineHeight * lineIndex);
        ctx.fillText(line, x, y);
      });
    });
  }

  function drawDealerIdentityLabels(rows, { ctx, frame, geom, barW, canvasHeight, bars = [], categoryLabelY = 0 }){
    ctx.fillStyle = palette.label;
    ctx.font = frame.tickFont;
    const baselineY = Number(categoryLabelY) > 0 ? categoryLabelY : canvasHeight - 10;
    rows.forEach((r,i)=>{
      const bar = bars[i] || null;
      const labelWidthBase = bar?.width || barW;
      const maxLabelW = Math.max(20, labelWidthBase - 2);
      const base = frame.compact ? compactDealerTag(r.name || "") : normalizeDealerLabel(r.name || "");
      const lab = fitLabel(ctx, base, maxLabelW);
      const left = bar ? bar.x : (geom.x0 + i * barW);
      const width = bar ? bar.width : barW;
      const tx = left + ((width - ctx.measureText(lab).width) / 2);
      const x = Math.max(2, tx);
      ctx.fillText(lab, x, baselineY);
    });
  }

  function drawBarValueLabels(bars, { ctx, frame, formatter }){
    if(!Array.isArray(bars) || !bars.length) return;
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = frame.tickFont;
    ctx.textBaseline = "alphabetic";
    const textHeight = Math.max(10, Math.ceil(Number.parseFloat(frame.tickFont) || 11));
    const safeTopBaseline = frame.top + textHeight + 2;
    const barGap = frame.compact ? 7 : 8;
    bars.forEach((bar)=>{
      if(!bar || !(bar.height > 0)) return;
      const raw = typeof formatter === "function" ? formatter(bar.value) : String(Math.round(Number(bar.value) || 0));
      const text = String(raw || "").trim();
      if(!text) return;
      const x = Math.max(2, bar.x + ((bar.width - ctx.measureText(text).width) / 2));
      const y = Math.max(safeTopBaseline, bar.y - barGap);
      ctx.fillText(text, x, y);
    });
  }

  function drawPointValueChip(ctx, text, x, y, bounds = {}){
    if(!text) return;
    ctx.save();
    ctx.font = "11px system-ui, -apple-system, Segoe UI, Arial";
    const padX = 5;
    const padY = 3;
    const m = ctx.measureText(text);
    const chipW = Math.max(18, m.width + (padX * 2));
    const chipH = 16;
    const minX = Number(bounds.minX) || 0;
    const maxX = Number(bounds.maxX) || Number.POSITIVE_INFINITY;
    const minY = Number(bounds.minY) || 0;
    const maxY = Number(bounds.maxY) || Number.POSITIVE_INFINITY;
    let chipX = x - (chipW / 2);
    let chipY = y - 18;
    chipX = Math.max(minX, Math.min(maxX - chipW, chipX));
    chipY = Math.max(minY, Math.min(maxY - chipH, chipY));
    ctx.fillStyle = "rgba(6,12,22,0.82)";
    ctx.fillRect(chipX, chipY, chipW, chipH);
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillText(text, chipX + padX, chipY + chipH - padY);
    ctx.restore();
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

  function drawBarChart(canvasId, values, labels, barColor, yLabelFormatter, topLabel, options = {}){
    const showEmptyState = options?.emptyStateEnabled === true
      && !values.some((value)=> Number.isFinite(Number(value)) && Number(value) > 0);
    toggleChartEmptyState(canvasId, showEmptyState, options?.emptyMessage);
    if(showEmptyState) return true;
    const c = setupCanvas(document.getElementById(canvasId));
    if(!c) return false;
    const { canvas, ctx, w, h } = c;
    const frame = chartFrame(w,h, options.frameMode || "default");
    const observedTop = Math.max(...values, 0);
    const showBarValueLabels = options.showBarValueLabels !== false;
    const labelHeadroom = !showBarValueLabels
      ? 0
      : computeBarValueHeadroom(observedTop, { frame, chartHeight: h });
    const targetTop = Math.max(options.minTop || 1, observedTop + labelHeadroom, 0);
    renderAnimatedChart(canvas, values, (animatedVals, alpha)=>{
      clear(ctx,w,h);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = palette.plotBg;
      ctx.fillRect(frame.left, frame.top, w - frame.left - frame.right, h - frame.top - frame.bottom);
      const geom = drawAxes(ctx,w,h,frame);
      const yScale = niceScale(targetTop, 4);
      const count = Math.max(1, animatedVals.length || 0);
      const barW = geom.plotW / count;
      const constrainSmallCountBars = options.constrainSmallCountBars !== false;
      const smallCount = constrainSmallCountBars && count <= 2;
      const smallCountMaxBarW = smallCount
        ? Math.max(
          options.minBarWidth || 4,
          Math.min(
            barW * (count === 1 ? 0.36 : 0.5),
            frame.compact ? 68 : 84
          )
        )
        : 0;
      const renderedBars = [];
      animatedVals.forEach((v,i)=>{
        const safe = Math.max(0, Number(v) || 0);
        const bh = yScale.top ? (safe / yScale.top) * geom.plotH : 0;
        const barPad = typeof options.barPad === "function" ? options.barPad(frame) : (frame.compact ? 1 : 1.4);
        const naturalWidth = Math.max(options.minBarWidth || 4, barW - (barPad * 2));
        const drawWidth = smallCount ? Math.min(naturalWidth, smallCountMaxBarW) : naturalWidth;
        const x = smallCount
          ? geom.x0 + i * barW + ((barW - drawWidth) / 2)
          : geom.x0 + i * barW + barPad;
        const y = geom.y0 - bh;
        ctx.fillStyle = barColor;
        ctx.fillRect(x, y, drawWidth, bh);
        renderedBars.push({ x, y, width: drawWidth, height: bh, value: safe, index: i, slotW: barW });
      });
      if(showBarValueLabels){
        drawBarValueLabels(renderedBars, { ctx, frame, formatter: options.barValueFormatter || yLabelFormatter });
      }
      const defaultCategoryLabelY = Math.min(
        h - 8,
        geom.y0 + (frame.compact ? 16 : 18)
      );
      const categoryLabelY = options.categoryLabelsBelowBars ? defaultCategoryLabelY : (h - 10);
      if(options.customLabels){
        options.customLabels({ ctx, frame, geom, barW, canvasHeight: h, bars: renderedBars, yScale, categoryLabelY });
      }else{
        drawBottomTicks(ctx, labels, geom, categoryLabelY, frame, {
          alignMode: "bar-center",
          labelType: options.xLabelType || "category",
          maxTicks: options.maxTicks || 0
        });
      }
      const yLabels = [];
      for(let v=0; v<=yScale.top + 1e-9; v += yScale.step){
        yLabels.push({ pos: yScale.top ? (v / yScale.top) : 0, label: yLabelFormatter(v) });
      }
      drawYTickLabels(ctx, geom, frame, yLabels);
      ctx.restore();
    });
    return true;
  }

  function computeBarValueHeadroom(maxValue, { frame, chartHeight } = {}){
    const safeMax = Math.max(0, Number(maxValue) || 0);
    if(!(safeMax > 0)) return 1;
    const textHeight = Math.max(10, Math.ceil(Number.parseFloat(frame?.tickFont) || 11));
    const plotHeight = Math.max(80, (Number(chartHeight) || 180) - (Number(frame?.top) || 0) - (Number(frame?.bottom) || 0));
    const lanePx = textHeight + (frame?.compact ? 12 : 10);
    const ratio = Math.max(frame?.compact ? 0.14 : 0.12, Math.min(0.36, lanePx / plotHeight));
    const relativeExtra = safeMax * ratio;
    const minimumExtra = safeMax * (frame?.compact ? 0.08 : 0.06);
    return Math.max(relativeExtra, minimumExtra);
  }

  function drawRollingLineChart(canvasId, values, labels, metricKey, options = {}){
    const showEmptyState = options?.emptyStateEnabled === true
      && !values.some((value)=> Number.isFinite(Number(value)) && Number(value) > 0);
    toggleChartEmptyState(canvasId, showEmptyState, options?.emptyMessage);
    if(showEmptyState) return true;
    const c = setupCanvas(document.getElementById(canvasId));
    if(!c) return false;
    const { canvas, ctx, w, h } = c;
    const frame = chartFrame(w,h, options.frameMode || "default");
    const paletteSet = resolveMetricDetailPalette(metricKey);
    const topValue = Math.max(...values, metricKey === "trips" ? 1 : 0);
    const yScale = niceScale(Math.max(topValue, 1), 4);
    renderAnimatedChart(canvas, values, (animatedVals, alpha)=> {
      clear(ctx,w,h);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = palette.plotBg;
      ctx.fillRect(frame.left, frame.top, w - frame.left - frame.right, h - frame.top - frame.bottom);
      const geom = drawAxes(ctx,w,h,frame);
      const points = animatedVals.map((rawValue, index)=> {
        const safe = Math.max(0, Number(rawValue) || 0);
        const x = geom.x0 + ((geom.plotW * index) / Math.max(1, animatedVals.length - 1));
        const y = geom.y0 - ((safe / Math.max(1, yScale.top)) * geom.plotH);
        return { x, y, value: safe };
      });

      ctx.strokeStyle = paletteSet.color;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      points.forEach((pt, index)=> {
        if(index === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.stroke();

      points.forEach((pt, index)=> {
        const isCurrent = index === points.length - 1;
        ctx.beginPath();
        ctx.fillStyle = isCurrent ? "#ffffff" : paletteSet.color;
        ctx.strokeStyle = paletteSet.color;
        ctx.lineWidth = isCurrent ? 2.2 : 1.6;
        ctx.arc(pt.x, pt.y, isCurrent ? 4.6 : 3.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });

      const currentPoint = points[points.length - 1];
      if(currentPoint){
        drawPointValueChip(ctx, paletteSet.yFormatter(currentPoint.value), currentPoint.x, currentPoint.y, {
          minX: geom.x0 + 2,
          maxX: geom.xRight - 2,
          minY: frame.top + 2,
          maxY: geom.y0 - 2
        });
      }

      drawBottomTicks(ctx, labels, geom, h-10, frame, {
        alignMode: "index",
        labelType: options.xLabelType || "month",
        maxTicks: options.maxTicks || 0
      });
      const yLabels = [];
      for(let v=0; v<=yScale.top + 1e-9; v += yScale.step){
        yLabels.push({ pos: yScale.top ? (v / yScale.top) : 0, label: paletteSet.yFormatter(v) });
      }
      drawYTickLabels(ctx, geom, frame, yLabels);
      drawYLabel(ctx, paletteSet.topFormatter(topValue), frame);
      ctx.restore();
    });
    return true;
  }

  function resolveMetricDetailPalette(metricKey){
    if(metricKey === "amount") return { color: palette.money, yFormatter: formatCompactMoney, topFormatter: formatShortMoney };
    if(metricKey === "ppl") return { color: palette.ppl, yFormatter: formatShortMoney, topFormatter: formatShortMoney };
    if(metricKey === "pounds") return { color: palette.lbs, yFormatter: formatCompactCount, topFormatter: (v)=> `${Math.round(Number(v) || 0)}` };
    return { color: palette.trips, yFormatter: formatCompactCount, topFormatter: (v)=> `${Math.round(Number(v) || 0)}` };
  }

  function drawMetricDetailChart(canvasId, chartModel, metricKeyOverride = "", drawOptions = {}){
    const metricKey = String(metricKeyOverride || chartModel?.metricKey || "").toLowerCase();
    if(!canvasId || !chartModel || !document.getElementById(canvasId)) return false;
    const frameMode = drawOptions?.frameMode || chartModel?.frameMode || "default";
    const emptyStateEnabled = drawOptions?.emptyStateEnabled === true;
    const showEmptyState = emptyStateEnabled && !hasUsableChartData(chartModel);
    toggleChartEmptyState(canvasId, showEmptyState, drawOptions?.emptyMessage);
    if(showEmptyState) return true;
    if(chartModel.chartType === "time-series"){
      const chronologicalSeries = normalizeChronologicalSeries({
        monthKeys: Array.isArray(chartModel?.monthKeys) ? chartModel.monthKeys : [],
        labels: Array.isArray(chartModel?.labels) ? chartModel.labels : [],
        values: Array.isArray(chartModel?.values) ? chartModel.values : []
      });
      const values = chronologicalSeries.values.map((v)=> Number(v) || 0);
      const labels = chronologicalSeries.labels.map((v)=> String(v || ""));
      const paletteSet = resolveMetricDetailPalette(metricKey || "amount");
      const topValue = Math.max(...values, metricKey === "trips" ? 1 : 0);
      drawBarChart(canvasId, values, labels, paletteSet.color, paletteSet.yFormatter, paletteSet.topFormatter(topValue), {
        minTop: metricKey === "trips" ? 1 : 0,
        minBarWidth: frameMinBarWidth(labels.length),
        barPad: (frame)=> frame.compact ? 1.2 : 1.8,
        xLabelType: "month",
        frameMode
      });
      return true;
    }
    if(chartModel.chartType === "rolling-line"){
      const chronologicalSeries = normalizeChronologicalSeries({
        monthKeys: Array.isArray(chartModel?.monthKeys) ? chartModel.monthKeys : [],
        labels: Array.isArray(chartModel?.labels) ? chartModel.labels : [],
        values: Array.isArray(chartModel?.values) ? chartModel.values : []
      });
      drawRollingLineChart(
        canvasId,
        chronologicalSeries.values.map((v)=> Number(v) || 0),
        chronologicalSeries.labels.map((v)=> String(v || "")),
        metricKey || chartModel?.metricKey || "amount",
        {
          xLabelType: "month",
          frameMode,
          emptyStateEnabled,
          emptyMessage: drawOptions?.emptyMessage
        }
      );
      return true;
    }
    const values = Array.isArray(chartModel?.values) ? chartModel.values.map((v)=> Number(v) || 0) : [];
    const labels = Array.isArray(chartModel?.labels) ? chartModel.labels.map((v)=> String(v || "")) : [];
    const paletteSet = resolveMetricDetailPalette(metricKey);
    const topValue = Math.max(...values, metricKey === "trips" ? 1 : 0);
    const labelMode = String(chartModel?.labelMode || "").trim();
    const showBarValueLabels = chartModel?.showBarValueLabels !== false;
    const categoryLabelsBelowBars = chartModel?.categoryLabelsBelowBars !== false;
    const customLabels = labelMode === "home-area-direct"
      ? ({ ctx, frame, geom, barW, canvasHeight, bars, categoryLabelY })=>{
        drawAreaIdentityLabels(labels, { ctx, frame, geom, barW, canvasHeight, bars, categoryLabelY });
      }
      : (labelMode === "home-dealer-direct"
        ? ({ ctx, frame, geom, barW, canvasHeight, bars, categoryLabelY })=>{
          const dealerRows = labels.map((label)=> ({ name: label }));
          drawDealerIdentityLabels(dealerRows, { ctx, frame, geom, barW, canvasHeight, bars, categoryLabelY });
        }
        : null);
    drawBarChart(
      canvasId,
      values,
      labels,
      paletteSet.color,
      paletteSet.yFormatter,
      paletteSet.topFormatter(topValue),
      {
        minTop: metricKey === "trips" ? 1 : 0,
        minBarWidth: frameMode === "home-insights" ? 20 : 18,
        barPad: (frame)=> {
          if(frameMode === "home-insights") return frame.compact ? 4 : 6;
          return frame.compact ? 8 : 14;
        },
        xLabelType: labels.length <= 3 ? "compare" : "category",
        customLabels,
        showBarValueLabels,
        categoryLabelsBelowBars,
        frameMode
      }
    );
    return true;
  }

  function drawMetricDetailCompareChart(metricDetail){
    const metricKey = String(metricDetail?.metricKey || "").toLowerCase();
    const compareChart = metricDetail?.compareChart;
    if(!metricKey || !compareChart) return false;
    const canvasIdByMetric = { trips: "c_trips", pounds: "c_lbs", amount: "c_amount_detail", ppl: "c_ppl" };
    return drawMetricDetailChart(canvasIdByMetric[metricKey], compareChart, metricKey, {
      emptyStateEnabled: true
    });
  }

  function drawMetricDetailSecondaryCharts(metricDetail){
    const metricKey = String(metricDetail?.metricKey || "").toLowerCase();
    const secondaryCharts = Array.isArray(metricDetail?.secondaryCharts) ? metricDetail.secondaryCharts : [];
    secondaryCharts.forEach((chart)=> {
      if(!chart?.canvasId || !chart?.chartModel) return;
      drawMetricDetailChart(chart.canvasId, chart.chartModel, chart.metricKey || metricKey, {
        emptyStateEnabled: true
      });
    });
    if(metricKey !== "amount" || !document.getElementById("c_dealer")) return;
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
        showBarValueLabels: true,
        categoryLabelsBelowBars: true,
        emptyStateEnabled: true,
        customLabels: ({ ctx, frame, geom, barW, canvasHeight, bars, categoryLabelY })=>{
          drawDealerIdentityLabels(topDealers, { ctx, frame, geom, barW, canvasHeight, bars, categoryLabelY });
        },
      }
    );
  }

  if(drawMetricDetailCompareChart(options?.metricDetail)){
    drawMetricDetailSecondaryCharts(options?.metricDetail);
    return;
  }

  const chartDeck = Array.isArray(options?.chartDeck) ? options.chartDeck : [];
  if(chartDeck.length){
    chartDeck.forEach((entry)=> {
      if(!entry || typeof entry !== "object") return;
      const canvasId = String(entry.canvasId || "").trim();
      const chartModel = entry.chartModel && typeof entry.chartModel === "object" ? entry.chartModel : null;
      if(!canvasId || !chartModel) return;
      drawMetricDetailChart(
        canvasId,
        chartModel,
        String(entry.metricKey || chartModel.metricKey || ""),
        {
          frameMode: options?.homeInsightsMode ? "home-insights" : "default",
          emptyStateEnabled: options?.homeInsightsMode === true,
          emptyMessage: options?.homeInsightsEmptyMessage || "Not enough data in this range yet."
        }
      );
    });
    return;
  }

  const seasonalityChart = options?.seasonalityChart;
  if(seasonalityChart && document.getElementById("c_seasonality_amount")){
    drawMetricDetailChart("c_seasonality_amount", seasonalityChart, seasonalityChart.metricKey || "amount", {
      emptyStateEnabled: true
    });
  }

  function frameMinBarWidth(count){
    if(count <= 2) return 20;
    if(count <= 4) return 16;
    if(count <= 8) return 10;
    return 4;
  }

  const amountValues = monthRowsChronological.map((r)=> Number(r.amt) || 0);
  drawBarChart("c_amount_monthly", amountValues, monthRowsChronological.map((r)=> r.label), palette.money, formatCompactMoney, formatShortMoney(Math.max(...amountValues, 0)), {
    minBarWidth: frameMinBarWidth(amountValues.length),
    barPad: (frame)=> frame.compact ? 1.1 : 1.5,
    xLabelType: "month",
    emptyStateEnabled: true
  });

  const pplValues = monthRowsChronological.map((r)=> Number(r.avg) || 0);
  drawBarChart("c_ppl", pplValues, monthRowsChronological.map((r)=> r.label), palette.ppl, formatShortMoney, formatShortMoney(Math.max(...pplValues, 0)), {
    minBarWidth: frameMinBarWidth(pplValues.length),
    barPad: (frame)=> frame.compact ? 1.1 : 1.5,
    xLabelType: "month",
    emptyStateEnabled: true
  });

  const dealerAmountRows = dealerRows.slice(0,8);
  if(document.getElementById("c_dealer")){
    drawBarChart(
      "c_dealer",
      dealerAmountRows.map((r)=> Number(r.amt) || 0),
      dealerAmountRows.map((r)=> normalizeDealerLabel(r.name || "")),
      palette.money,
      formatCompactMoney,
      formatShortMoney(Math.max(...dealerAmountRows.map((r)=> Number(r.amt) || 0), 0)),
      {
        minBarWidth: 8,
        barPad: (frame)=> frame.compact ? 3 : 4,
        showBarValueLabels: true,
        categoryLabelsBelowBars: true,
        emptyStateEnabled: true,
        customLabels: ({ ctx, frame, geom, barW, canvasHeight, bars, categoryLabelY })=>{
          drawDealerIdentityLabels(dealerAmountRows, { ctx, frame, geom, barW, canvasHeight, bars, categoryLabelY });
        },
      }
    );
  }

  const dealerRateRows = dealerRows
    .filter((r)=> (Number(r.lbs) || 0) > 0 && (Number(r.avg) || 0) > 0)
    .slice(0,8);
  drawBarChart(
    "c_dealer_rate",
    dealerRateRows.map((r)=> Number(r.avg) || 0),
    dealerRateRows.map((r)=> normalizeDealerLabel(r.name || "")),
    palette.ppl,
    formatShortMoney,
    formatShortMoney(Math.max(...dealerRateRows.map((r)=> Number(r.avg) || 0), 0)),
    {
      minBarWidth: 8,
      barPad: (frame)=> frame.compact ? 3 : 4,
      showBarValueLabels: true,
      categoryLabelsBelowBars: true,
      emptyStateEnabled: true,
      customLabels: ({ ctx, frame, geom, barW, canvasHeight, bars, categoryLabelY })=>{
        drawDealerIdentityLabels(dealerRateRows, { ctx, frame, geom, barW, canvasHeight, bars, categoryLabelY });
      },
    }
  );

  const amountPerTripValues = monthRowsChronological.map((r)=> Number(r.amountPerTrip) || 0);
  drawBarChart("c_amount_per_trip", amountPerTripValues, monthRowsChronological.map((r)=> r.label), palette.money, formatCompactMoney, formatShortMoney(Math.max(...amountPerTripValues, 0)), {
    minBarWidth: 4,
    barPad: (frame)=> frame.compact ? 0.8 : 1.2,
    xLabelType: "month",
    emptyStateEnabled: true
  });

  const lbsValues = monthRowsChronological.map((r)=> Number(r.lbs) || 0);
  drawBarChart("c_lbs", lbsValues, monthRowsChronological.map((r)=> r.label), palette.lbs, formatCompactCount, `${Math.round(Math.max(...lbsValues, 0))}`, {
    minBarWidth: 4,
    barPad: (frame)=> frame.compact ? 0.8 : 1.2,
    xLabelType: "month",
    emptyStateEnabled: true
  });

  const tripValues = tripsTimelineChronological.map((r)=> Number(r.count) || 0);
  drawBarChart("c_trips", tripValues, tripsTimelineChronological.map((r)=> r.shortLabel || r.label || ""), palette.trips, formatCompactCount, `${Math.round(Math.max(...tripValues, 1))}`, {
    minTop: 1,
    minBarWidth: 4,
    barPad: (frame)=> frame.compact ? 0.8 : 1.2,
    xLabelType: "month",
    emptyStateEnabled: true
  });

  const rollingMetricKeys = ["trips", "pounds", "amount", "ppl"];
  const rollingModelsByMetric = Object.fromEntries(
    rollingMetricKeys.map((metricKey)=> [
      metricKey,
      buildRollingSeriesFromMonthRows({
        monthRows: monthRowsChronological,
        metricKey,
        windowSize: getRollingWindowForMetric(metricKey, { surface: "reports" }),
        basisLabel: "Rolling trend • active Reports range"
      })
    ])
  );

  const rollingMetricCards = [
    { canvasId: "c_roll_trips", metricKey: "trips" },
    { canvasId: "c_roll_lbs", metricKey: "pounds" },
    { canvasId: "c_roll_amount", metricKey: "amount" },
    { canvasId: "c_roll_ppl", metricKey: "ppl" }
  ];
  rollingMetricCards.forEach(({ canvasId, metricKey })=> {
    if(!document.getElementById(canvasId)) return;
    const chartModel = rollingModelsByMetric[metricKey];
    if(chartModel?.chartType !== "rolling-line") return;
    drawMetricDetailChart(canvasId, chartModel, metricKey, {
      emptyStateEnabled: true
    });
  });

}

function normalizeChronologicalRows(rows){
  const list = Array.isArray(rows) ? rows.slice() : [];
  return list.sort((a,b)=> {
    const keyA = extractMonthKey(a);
    const keyB = extractMonthKey(b);
    if(keyA && keyB) return keyA.localeCompare(keyB);
    if(keyA) return -1;
    if(keyB) return 1;
    return 0;
  });
}

function normalizeChronologicalSeries({ monthKeys, labels, values }){
  const safeLabels = Array.isArray(labels) ? labels : [];
  const safeValues = Array.isArray(values) ? values : [];
  const safeKeys = Array.isArray(monthKeys) ? monthKeys : [];
  if(!(safeLabels.length && safeValues.length && safeKeys.length === safeLabels.length && safeValues.length === safeLabels.length)){
    return {
      labels: safeLabels.slice(),
      values: safeValues.slice()
    };
  }
  const tuples = safeKeys.map((key, index)=> ({
    monthKey: normalizeMonthKey(key),
    label: safeLabels[index],
    value: safeValues[index]
  }));
  tuples.sort((a,b)=> a.monthKey.localeCompare(b.monthKey));
  return {
    labels: tuples.map((row)=> row.label),
    values: tuples.map((row)=> row.value)
  };
}

function extractMonthKey(row){
  return normalizeMonthKey(row?.monthKey || row?.key || row?.dateISO || "");
}

function normalizeMonthKey(raw){
  const value = String(raw || "").trim();
  if(/^\d{4}-\d{2}$/.test(value)) return value;
  if(/^\d{4}-\d{2}-\d{2}$/.test(value)) return value.slice(0, 7);
  return "";
}
