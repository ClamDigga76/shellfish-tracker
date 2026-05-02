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
    label: isLightTheme ? "rgba(24,35,59,0.78)" : "rgba(255,255,255,0.84)",
    axis: isLightTheme ? "rgba(21,38,72,0.13)" : "rgba(255,255,255,0.11)",
    plotBg: isLightTheme ? "rgba(21,38,72,0.012)" : "rgba(255,255,255,0.008)"
  };

  function resolveFrameProfile({ mode = "default", chartKind = "bar", pointCount = 0, labelType = "category" } = {}){
    const safeCount = Math.max(0, Number(pointCount) || 0);
    const sparse = safeCount > 0 && safeCount <= 3;
    const dense = safeCount >= 10;
    const rolling = chartKind === "rolling";
    const monthLabels = labelType === "month";
    const compareLabels = labelType === "compare";
    return {
      sparse,
      dense,
      pointCount: safeCount,
      rolling,
      monthLabels,
      compareLabels,
      mode
    };
  }

  function chartFrame(w,h, mode = "default", context = {}){
    const compact = w < 360;
    const isHomeInsights = mode === "home-insights";
    const profile = resolveFrameProfile({ mode, ...context });
    const leftBase = isHomeInsights ? (compact ? 34 : 40) : (compact ? 38 : 50);
    const rightBase = isHomeInsights ? (compact ? 7 : 8) : (compact ? 8 : 12);
    const topBase = isHomeInsights ? (compact ? 16 : 18) : (compact ? 20 : 24);
    const bottomBase = isHomeInsights ? (compact ? 46 : 44) : (compact ? 54 : 50);
    const left = leftBase + (profile.dense && !compact ? -2 : 0);
    const right = rightBase + (profile.sparse ? (compact ? 4 : 6) : 0) + (profile.dense ? -2 : 0);
    const top = topBase + (profile.sparse ? 2 : 0);
    const compareCountBoost = profile.compareLabels && profile.pointCount > 0
      ? (profile.pointCount <= 2
          ? (compact ? 11 : 9)
          : (profile.pointCount <= 5 ? (compact ? 8 : 6) : (compact ? 4 : 1)))
      : 0;
    const categoryLabelBoost = profile.compareLabels
      ? compareCountBoost
      : (compact ? 5 : 7);
    const bottom = Math.max(
      compact ? 40 : 44,
      bottomBase
        + categoryLabelBoost
        + (profile.monthLabels && profile.dense ? (compact ? -8 : -10) : 0)
    );
    return {
      compact,
      left,
      right,
      top,
      bottom,
      profile,
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
    const explicitMaxTicks = Number(options.maxTicks) || 0;
    const preserveFinalLabel = options.preserveFinalLabel !== false;
    const finalLabelFallbacks = Array.isArray(options.finalLabelFallbacks) ? options.finalLabelFallbacks : [];
    const inferredMaxTicks = (()=>{
      const count = labels.length;
      if(count <= 0) return frame.compact ? 4 : 6;
      const profile = frame.profile || {};
      if(profile.monthLabels && count <= 6) return count;
      if(profile.compareLabels && count <= 4) return count;
      if(profile.monthLabels && profile.dense) return frame.compact ? 5 : 8;
      if(profile.rolling) return frame.compact ? 5 : 7;
      return frame.compact ? 4 : 6;
    })();
    const maxTicks = explicitMaxTicks || inferredMaxTicks;
    const step = Math.max(1, Math.ceil(labels.length / Math.max(1, maxTicks)));
    const alignMode = options.alignMode === "bar-center" ? "bar-center" : "index";
    const labelType = options.labelType || "category";
    ctx.fillStyle = palette.label;
    ctx.font = frame.tickFont;
    const edgeInset = frame.compact ? 6 : 8;
    const finalEdgeInset = edgeInset + (frame.compact ? 4 : 6);
    const minGap = frame.compact ? 12 : 8;
    const placed = [];
    const pendingDraws = [];
    const tickIndexes = new Set([0]);
    if(preserveFinalLabel) tickIndexes.add(Math.max(0, labels.length - 1));
    labels.forEach((_, i)=> {
      if(i % step === 0) tickIndexes.add(i);
    });
    Array.from(tickIndexes).sort((a,b)=> a - b).forEach((i)=>{
      const lab = labels[i];
      const slotW = labels.length > 0 ? (geom.plotW / labels.length) : geom.plotW;
      const x = alignMode === "bar-center"
        ? geom.x0 + (slotW * i) + (slotW * 0.5)
        : (labels.length === 1
            ? geom.x0 + (geom.plotW * 0.5)
            : geom.x0 + ((geom.plotW * i) / (labels.length - 1)));
      const isFinal = i === labels.length - 1;
      const baseText = formatAxisLabel(lab, { labelType, compact: frame.compact });
      if(!baseText) return;
      const candidates = isFinal ? [baseText, ...finalLabelFallbacks] : [baseText];
      const textHeight = Math.max(10, Math.ceil(Number.parseFloat(frame.tickFont) || 11));
      let placedLabel = null;
      for(const candidate of candidates){
        const text = String(candidate || "").trim();
        if(!text) continue;
        const lines = isFinal && /\s+so far$/i.test(text) ? [text.replace(/\s+so far$/i, "").trim(), "so far"].filter(Boolean) : [text];
        const lineWidths = lines.map((line)=> ctx.measureText(line).width);
        const width = Math.max(...lineWidths);
        let tx = x - (width / 2);
        const minX = geom.x0 + edgeInset;
        const maxX = geom.xRight - width - (isFinal ? finalEdgeInset : edgeInset);
        tx = Math.max(minX, Math.min(maxX, tx));
        const right = tx + width;
        const lastPlaced = placed[placed.length - 1];
        if(lastPlaced && tx < lastPlaced.right + minGap){
          if(!isFinal) continue;
          const forcedTx = Math.max(minX, maxX);
          if(forcedTx < lastPlaced.right + minGap){
            const canDropPrev = placed.length > 0 && i > 0;
            if(canDropPrev){
              placed.pop();
              continue;
            }
            continue;
          }
          tx = forcedTx;
        }
        placedLabel = { tx, right, i, lines, multiline: lines.length > 1, text };
        break;
      }
      if(!placedLabel) return;
      placed.push({ tx: placedLabel.tx, right: placedLabel.right, i: placedLabel.i });
      pendingDraws.push({ tx: placedLabel.tx, i: placedLabel.i, lines: placedLabel.lines, multiline: placedLabel.multiline, text: placedLabel.text, textHeight });
    });
    if(labelType === "month" && labels.length > 1 && labels.length <= 5){
      const renderedIndexes = new Set(pendingDraws.map((draw)=> draw.i));
      labels.forEach((label, i)=> {
        if(renderedIndexes.has(i)) return;
        const text = formatAxisLabel(label, { labelType, compact: frame.compact });
        if(!text) return;
        const slotW = labels.length > 0 ? (geom.plotW / labels.length) : geom.plotW;
        const x = alignMode === "bar-center"
          ? geom.x0 + (slotW * i) + (slotW * 0.5)
          : (labels.length === 1
              ? geom.x0 + (geom.plotW * 0.5)
              : geom.x0 + ((geom.plotW * i) / (labels.length - 1)));
        const width = ctx.measureText(text).width;
        const tx = Math.max(geom.x0 + edgeInset, Math.min(geom.xRight - width - edgeInset, x - (width / 2)));
        const right = tx + width;
        const left = tx;
        const collides = placed.some((entry)=> !(right + minGap < entry.tx || left > entry.right + minGap));
        if(collides) return;
        placed.push({ tx, right, i });
        pendingDraws.push({ tx, i, lines: [text], multiline: false, text, textHeight: Math.max(10, Math.ceil(Number.parseFloat(frame.tickFont) || 11)) });
      });
    }
    pendingDraws
      .sort((a,b)=> a.i - b.i)
      .forEach((draw)=> {
        if(draw.multiline){
          draw.lines.forEach((line, lineIdx)=> ctx.fillText(line, draw.tx, y + (lineIdx * draw.textHeight)));
          return;
        }
        ctx.fillText(draw.text, draw.tx, y);
      });
  }


  function buildFinalMonthLabelFallbacks(label){
    const text = String(label || "").trim();
    if(!text) return [];
    const lower = text.toLowerCase();
    if(!lower.includes("so far")) return [];
    const month = text.split(/\s+/).find((part)=> /^[A-Za-z]{3,9}$/.test(part));
    if(!month) return ["so far", "So far"];
    return [text, `${month.slice(0,3)} so far`, month.slice(0,3), "So far"];
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
    return normalizeDealerLabel(name);
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
    if(src.length <= 14) return src;
    const words = src.split(/\s+/).filter(Boolean);
    if(words.length >= 2){
      const first = words[0];
      const second = words[1];
      const combined = `${first} ${second.length > 6 ? `${second.slice(0, 6)}…` : second}`;
      if(combined.length <= 16) return combined;
      return `${first.slice(0, 10).trimEnd()}…`;
    }
    return `${src.slice(0, 13).trimEnd()}…`;
  }

  function buildDealerLabelVariants(name){
    const normalized = normalizeDealerLabel(name);
    if(!normalized) return [];
    const words = normalized.split(/\s+/).filter(Boolean);
    const variants = [normalized];
    if(words.length > 1){
      variants.push(`${words[0]} ${words[1]}`);
      const withoutStopWords = words.filter((word)=> !["the", "co", "company", "inc", "llc", "&"].includes(word.toLowerCase()));
      if(withoutStopWords.length >= 2){
        variants.push(`${withoutStopWords[0]} ${withoutStopWords[1]}`);
      }
      const compactWords = words
        .slice(0, 2)
        .map((word)=> word.length > 8 ? `${word.slice(0, 8)}…` : word)
        .join(" ");
      variants.push(compactWords);
      const initials = words.map((part)=> part[0]).join("").slice(0,3).toUpperCase();
      if(initials.length >= 2) variants.push(initials);
    }else{
      variants.push(words[0].length > 10 ? `${words[0].slice(0, 10)}…` : words[0]);
    }
    return Array.from(new Set(variants.map((value)=> String(value || "").trim()).filter(Boolean)));
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
      const preferredBottomLineY = Number(categoryLabelY) > 0
        ? (categoryLabelY + (frame.compact ? 2 : 1))
        : (canvasHeight - (frame.compact ? 8 : 9));
      const minBottomLineY = geom.y0
        + (frame.compact ? 13 : 14)
        + ((lines.length - 1) * lineHeight);
      const bottomLineY = Math.min(
        canvasHeight - (frame.compact ? 6 : 7),
        Math.max(preferredBottomLineY, minBottomLineY)
      );
      const baseY = bottomLineY - ((lines.length - 1) * lineHeight);
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
      const candidates = frame.compact
        ? buildDealerLabelVariants(compactDealerTag(r.name || ""))
        : buildDealerLabelVariants(normalizeDealerLabel(r.name || ""));
      const preferred = candidates.find((candidate)=> ctx.measureText(candidate).width <= maxLabelW);
      const lab = preferred || fitLabel(ctx, candidates[0] || "", maxLabelW);
      const left = bar ? bar.x : (geom.x0 + i * barW);
      const width = bar ? bar.width : barW;
      const tx = left + ((width - ctx.measureText(lab).width) / 2);
      const x = Math.max(2, tx);
      ctx.fillText(lab, x, baselineY);
    });
  }

  function drawBarValueLabels(bars, { ctx, frame, formatter }){
    if(!Array.isArray(bars) || !bars.length) return;
    ctx.fillStyle = isLightTheme ? "rgba(16,30,58,0.86)" : "rgba(255,255,255,0.92)";
    ctx.font = frame.tickFont;
    ctx.textBaseline = "alphabetic";
    const textHeight = Math.max(10, Math.ceil(Number.parseFloat(frame.tickFont) || 11));
    const safeTopBaseline = frame.top + textHeight + 2;
    const barGap = frame.compact ? 7 : 8;
    let lastRight = -Infinity;
    const minLabelGap = frame.compact ? 8 : 6;
    bars.forEach((bar)=>{
      if(!bar || !(bar.height > 0)) return;
      const raw = typeof formatter === "function" ? formatter(bar.value) : String(Math.round(Number(bar.value) || 0));
      const text = String(raw || "").trim();
      if(!text) return;
      const textW = ctx.measureText(text).width;
      if(bars.length >= 5 && bar.width < (textW + 4) && bar.index % 2 === 1) return;
      const x = Math.max(2, bar.x + ((bar.width - textW) / 2));
      if(bars.length >= 4 && x < lastRight + minLabelGap) return;
      const y = Math.max(safeTopBaseline, bar.y - barGap);
      ctx.fillText(text, x, y);
      lastRight = x + textW;
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
    ctx.fillStyle = isLightTheme ? "rgba(16,30,58,0.78)" : "rgba(6,12,22,0.82)";
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
    const count = Math.max(0, values.length || 0);
    const xLabelType = options.xLabelType || "category";
    const frame = chartFrame(w,h, options.frameMode || "default", {
      chartKind: "bar",
      pointCount: count,
      labelType: xLabelType
    });
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
            barW * (count === 1 ? 0.44 : 0.58),
            frame.compact ? 74 : 96
          )
        )
        : 0;
      const renderedBars = [];
      animatedVals.forEach((v,i)=>{
        const safe = Math.max(0, Number(v) || 0);
        const bh = yScale.top ? (safe / yScale.top) * geom.plotH : 0;
        const baseBarPad = typeof options.barPad === "function" ? options.barPad(frame) : (frame.compact ? 1 : 1.4);
        const adaptivePad = frame.profile?.dense ? (baseBarPad * 0.8) : (frame.profile?.sparse ? (baseBarPad * 1.08) : baseBarPad);
        const barPad = Math.max(0.25, adaptivePad);
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
        h - (frame.compact ? 6 : 7),
        geom.y0
          + (frame.compact ? 19 : 20)
          + (frame.profile?.compareLabels && frame.profile?.pointCount <= 2 ? (frame.compact ? 4 : 3) : 0)
          + (frame.profile?.compareLabels && frame.profile?.pointCount > 2 && frame.profile?.pointCount <= 5 ? (frame.compact ? 2 : 1) : 0)
      );
      const categoryLabelY = options.categoryLabelsBelowBars ? defaultCategoryLabelY : (h - 10);
      if(options.customLabels){
        options.customLabels({ ctx, frame, geom, barW, canvasHeight: h, bars: renderedBars, yScale, categoryLabelY });
      }else{
        drawBottomTicks(ctx, labels, geom, categoryLabelY, frame, {
          alignMode: "bar-center",
          labelType: xLabelType,
          maxTicks: options.maxTicks || 0,
          finalLabelFallbacks: xLabelType === "month" ? buildFinalMonthLabelFallbacks(labels[labels.length - 1]) : []
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

  function drawRollingBarChart(canvasId, values, labels, metricKey, options = {}){
    const showEmptyState = options?.emptyStateEnabled === true
      && !values.some((value)=> Number.isFinite(Number(value)) && Number(value) > 0);
    toggleChartEmptyState(canvasId, showEmptyState, options?.emptyMessage);
    if(showEmptyState) return true;
    const paletteSet = resolveMetricDetailPalette(metricKey);
    const topValue = Math.max(...values, metricKey === "trips" ? 1 : 0);
    drawBarChart(canvasId, values, labels, paletteSet.color, paletteSet.yFormatter, paletteSet.topFormatter(topValue), {
      minTop: metricKey === "trips" ? 1 : 0,
      minBarWidth: frameMinBarWidth(labels.length),
      barPad: (frame)=> frame.compact ? 0.8 : 1.2,
      xLabelType: options.xLabelType || "month",
      frameMode: options.frameMode || "default",
      emptyStateEnabled: options?.emptyStateEnabled === true,
      emptyMessage: options?.emptyMessage
    });
    return true;
  }

  function drawRollingLineChart(canvasId, values, labels, metricKey, options = {}){
    const showEmptyState = options?.emptyStateEnabled === true
      && !values.some((value)=> Number.isFinite(Number(value)) && Number(value) > 0);
    toggleChartEmptyState(canvasId, showEmptyState, options?.emptyMessage);
    if(showEmptyState) return true;
    const c = setupCanvas(document.getElementById(canvasId));
    if(!c) return false;
    const { canvas, ctx, w, h } = c;
    const paletteSet = resolveMetricDetailPalette(metricKey);
    const count = Math.max(0, values.length || 0);
    const axisLabels = (()=> {
      const safeLabels = Array.isArray(labels) ? labels : [];
      if(count !== 1) return safeLabels;
      const singleLabel = safeLabels[safeLabels.length - 1] ?? safeLabels[0] ?? "";
      return [String(singleLabel || "")];
    })();
    const xLabelType = options.xLabelType || "month";
      const hasFinalSoFarLabel = xLabelType === "month"
        && axisLabels.length > 0
        && /\s+so far$/i.test(String(axisLabels[axisLabels.length - 1] || ""));
    const frame = chartFrame(w, h, options.frameMode || "default", {
      chartKind: "rolling",
      pointCount: count,
      labelType: xLabelType
    });
    const normalizedValues = values.map((value)=> {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? Math.max(0, numeric) : null;
    });
    const positiveValues = normalizedValues.filter((value)=> Number.isFinite(value));
    const observedTop = Math.max(...positiveValues, metricKey === "trips" ? 1 : 0);
    const valueHeadroom = computeBarValueHeadroom(observedTop, { frame, chartHeight: h });
    const targetTop = Math.max(metricKey === "trips" ? 1 : 0, observedTop + (valueHeadroom * 0.5));
    renderAnimatedChart(canvas, normalizedValues.map((value)=> Number.isFinite(value) ? value : 0), (animatedVals, alpha)=>{
      clear(ctx,w,h);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = palette.plotBg;
      ctx.fillRect(frame.left, frame.top, w - frame.left - frame.right, h - frame.top - frame.bottom);
      const geom = drawAxes(ctx,w,h,frame);
      const yScale = niceScale(targetTop, 4);
      const lastIndex = Math.max(0, animatedVals.length - 1);
      const points = animatedVals.map((value, index)=>{
        const hasData = Number.isFinite(normalizedValues[index]);
        const safe = hasData ? Math.max(0, Number(value) || 0) : null;
        const ratio = hasData && yScale.top > 0 ? (safe / yScale.top) : 0;
        const x = animatedVals.length <= 1
          ? geom.x0 + (geom.plotW * 0.5)
          : geom.x0 + ((geom.plotW * index) / (animatedVals.length - 1));
        const y = geom.y0 - (ratio * geom.plotH);
        return { x, y, value: safe, index, hasData };
      });
      if(points.length){
        ctx.save();
        ctx.beginPath();
        ctx.rect(geom.x0, geom.yTop, geom.plotW, geom.plotH);
        ctx.clip();

        const segmentGroups = [];
        let currentSegment = [];
        points.forEach((point)=> {
          if(point.hasData){
            currentSegment.push(point);
          }else if(currentSegment.length){
            segmentGroups.push(currentSegment);
            currentSegment = [];
          }
        });
        if(currentSegment.length) segmentGroups.push(currentSegment);

        ctx.save();
        ctx.globalAlpha = 0.14;
        ctx.fillStyle = paletteSet.color;
        segmentGroups.forEach((segment)=> {
          if(!segment.length) return;
          ctx.beginPath();
          ctx.moveTo(segment[0].x, geom.y0);
          segment.forEach((point)=> ctx.lineTo(point.x, point.y));
          ctx.lineTo(segment[segment.length - 1].x, geom.y0);
          ctx.closePath();
          ctx.fill();
        });
        ctx.restore();

        ctx.beginPath();
        let started = false;
        points.forEach((point)=>{
          if(!point.hasData){
            started = false;
            return;
          }
          if(!started){
            ctx.moveTo(point.x, point.y);
            started = true;
          }else{
            ctx.lineTo(point.x, point.y);
          }
        });
        ctx.strokeStyle = paletteSet.color;
        ctx.lineWidth = frame.compact ? 2 : 2.4;
        ctx.stroke();

        const latestPoint = points[lastIndex];
        if(latestPoint?.hasData){
          ctx.fillStyle = paletteSet.color;
          ctx.beginPath();
          ctx.arc(latestPoint.x, latestPoint.y, frame.compact ? 3.2 : 3.8, 0, Math.PI * 2);
          ctx.fill();
          ctx.save();
          ctx.globalAlpha = 0.22;
          ctx.beginPath();
          ctx.arc(latestPoint.x, latestPoint.y, frame.compact ? 8 : 10, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        ctx.restore();
      }

      const tickBaseline = h - (frame.compact ? 14 : 16) - (hasFinalSoFarLabel ? (frame.compact ? 6 : 8) : 0);
      drawBottomTicks(ctx, axisLabels, geom, tickBaseline, frame, {
        alignMode: "index",
        labelType: xLabelType,
        maxTicks: options.maxTicks || 0,
        finalLabelFallbacks: xLabelType === "month" ? buildFinalMonthLabelFallbacks(labels[labels.length - 1]) : []
      });
      const yLabels = [];
      for(let v=0; v<=yScale.top + 1e-9; v += yScale.step){
        yLabels.push({ pos: yScale.top ? (v / yScale.top) : 0, label: paletteSet.yFormatter(v) });
      }
      drawYTickLabels(ctx, geom, frame, yLabels);
      const latestPoint = [...points].reverse().find((point)=> point.hasData) || null;
      if(latestPoint){
        const chipText = String(paletteSet.yFormatter(latestPoint.value) || "").trim();
        drawPointValueChip(ctx, chipText, latestPoint.x, latestPoint.y, {
          minX: geom.x0 + 2,
          maxX: geom.xRight - 2,
          minY: geom.yTop + 2,
          maxY: geom.y0 - 6
        });
      }
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
    if(chartModel.chartType === "trip-timeline"){
      const labels = Array.isArray(chartModel?.labels) ? chartModel.labels.map((v)=> String(v || "")) : [];
      const values = Array.isArray(chartModel?.values) ? chartModel.values.map((v)=> Number(v) || 0) : [];
      const prettyLabels = labels.map((label)=> {
        if(/^\d{4}-\d{2}-\d{2}/.test(label)){
          const d = new Date(`${label.slice(0,10)}T00:00:00Z`);
          if(!Number.isNaN(d.getTime())) return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
        }
        return label;
      });
      const c = setupCanvas(document.getElementById(canvasId));
      if(!c) return false;
      const { ctx, w, h } = c;
      const frame = chartFrame(w, h, frameMode, { chartKind: "line", pointCount: labels.length, labelType: "category" });
      clear(ctx, w, h);
      const stripHeight = frame.compact ? 26 : 30;
      const stripBottomLift = frame.compact ? 20 : 24;
      const stripBottom = Math.max(frame.top + stripHeight + 4, frame.bottom + stripBottomLift);
      const stripTop = h - stripBottom - stripHeight;
      const geom = drawAxes(ctx, w, h, { ...frame, top: stripTop, bottom: stripBottom });
      const slotW = labels.length > 0 ? (geom.plotW / labels.length) : geom.plotW;
      const hasAnyTrips = values.some((count)=> count > 0);
      values.forEach((count, i)=> {
        const x = geom.x0 + (slotW * i) + (slotW * 0.5);
        const tickHeight = count >= 2 ? (frame.compact ? 16 : 20) : (frame.compact ? 10 : 13);
        ctx.strokeStyle = palette.trips;
        ctx.lineWidth = frame.compact ? 2.8 : 3.4;
        ctx.beginPath();
        ctx.moveTo(x, geom.y0);
        ctx.lineTo(x, geom.y0 - tickHeight);
        ctx.stroke();
        ctx.beginPath();
        ctx.fillStyle = palette.trips;
        ctx.arc(x, geom.y0 - tickHeight, frame.compact ? 2.8 : 3.4, 0, Math.PI * 2);
        ctx.fill();
        if(count >= 2){
          ctx.fillStyle = palette.label;
          ctx.font = "10px system-ui, -apple-system, Segoe UI, Arial";
          const txt = String(Math.round(count));
          ctx.fillText(txt, x - (ctx.measureText(txt).width / 2), geom.y0 - tickHeight - 5);
        }
      });
      if(!hasAnyTrips){
        ctx.fillStyle = palette.label;
        ctx.font = frame.tickFont;
        ctx.fillText("Not enough timeline activity in this range yet.", geom.x0 + 4, geom.yTop + 14);
      }else if(values.filter((count)=> count > 0).length <= 2){
        ctx.fillStyle = palette.label;
        ctx.font = frame.tickFont;
        ctx.fillText("Each mark is a day with work logged.", geom.x0 + 4, geom.yTop + 14);
      }
      drawBottomTicks(ctx, prettyLabels, geom, h - (frame.compact ? 9 : 10), frame, {
        alignMode: "bar-center",
        labelType: "category",
        maxTicks: values.length <= 6 ? values.length : 5,
        preserveFinalLabel: true
      });
      return true;
    }
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
    if(chartModel.chartType === "month-line" || chartModel.chartType === "rolling-line"){
      const chronologicalSeries = normalizeChronologicalSeries({
        monthKeys: Array.isArray(chartModel?.monthKeys) ? chartModel.monthKeys : [],
        labels: Array.isArray(chartModel?.labels) ? chartModel.labels : [],
        values: Array.isArray(chartModel?.values) ? chartModel.values : []
      });
      drawRollingLineChart(
        canvasId,
        chronologicalSeries.values,
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
        basisLabel: "Rolling trend • active Insights range"
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
    if(chartModel?.chartType !== "time-series") return;
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
