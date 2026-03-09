export function drawReportsCharts(monthRows, dealerRows, trips){
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
    return { ctx, w, h };
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
    grid: "rgba(255,255,255,0.10)",
    label: "rgba(255,255,255,0.72)",
    plotBg: "rgba(255,255,255,0.035)"
  };

  function chartFrame(w,h){
    const compact = w < 360;
    return {
      compact,
      left: compact ? 36 : 44,
      right: compact ? 8 : 12,
      top: compact ? 10 : 12,
      bottom: compact ? 26 : 30,
      tickFont: compact ? "9px system-ui, -apple-system, Segoe UI, Arial" : "10px system-ui, -apple-system, Segoe UI, Arial"
    };
  }

  function drawAxes(ctx, w, h, frame){
    const x0 = frame.left;
    const y0 = h - frame.bottom;
    const yTop = frame.top;
    const xRight = w - frame.right;

    ctx.strokeStyle = palette.grid;
    ctx.lineWidth = 1;

    const gridLines = 4;
    for(let i=0;i<=gridLines;i++){
      const y = y0 - ((y0 - yTop) * (i / gridLines));
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(xRight, y);
      ctx.stroke();
    }

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
      if(tx <= lastRight + 4) return;
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

  // Line: Avg $/lb by month
  {
      const c = setupCanvas(document.getElementById("c_ppl"));
      if(c){
        const {ctx,w,h} = c;
      const frame = chartFrame(w,h);
      clear(ctx,w,h);
      ctx.fillStyle = palette.plotBg;
      ctx.fillRect(frame.left, frame.top, w - frame.left - frame.right, h - frame.top - frame.bottom);
      const geom = drawAxes(ctx,w,h,frame);

      const vals = monthRows.map(r=> Number(r.avg)||0);
      const maxV = Math.max(1e-6, ...vals);
      const minV = Math.min(...vals);
      const span = (maxV - minV) || maxV || 1;

      ctx.strokeStyle = palette.ppl;
      ctx.lineWidth = 2;
      ctx.beginPath();
      vals.forEach((v,i)=>{
        const x = geom.x0 + (i/(vals.length-1 || 1))*geom.plotW;
        const y = geom.y0 - ((v - minV)/span)*geom.plotH;
        if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
      });
      ctx.stroke();

      ctx.fillStyle = palette.ppl;
      vals.forEach((v,i)=>{
        const x = geom.x0 + (i/(vals.length-1 || 1))*geom.plotW;
        const y = geom.y0 - ((v - minV)/span)*geom.plotH;
        ctx.beginPath(); ctx.arc(x,y,2.5,0,Math.PI*2); ctx.fill();
      });

      drawBottomTicks(ctx, monthRows.map(r=>r.label), geom, h-10, frame);
      drawYLabel(ctx, formatShortMoney(maxV), frame);
    }
  }

  // Bar: Total $ by dealer (top 8)
  {
      const c = setupCanvas(document.getElementById("c_dealer"));
      if(c){
      const {ctx,w,h} = c;
      const frame = chartFrame(w,h);
      clear(ctx,w,h);
      ctx.fillStyle = palette.plotBg;
      ctx.fillRect(frame.left, frame.top, w - frame.left - frame.right, h - frame.top - frame.bottom);
      const geom = drawAxes(ctx,w,h,frame);

      const top = dealerRows.slice(0,8);
      const vals = top.map(r=> Number(r.amt)||0);
      const maxV = Math.max(1e-6, ...vals);
      const barW = geom.plotW / (top.length || 1);

      top.forEach((r,i)=>{
        const v = Number(r.amt)||0;
        const bh = (v/maxV)*geom.plotH;
        const x = geom.x0 + i*barW + 4;
        const y = geom.y0 - bh;
        ctx.fillStyle = palette.money;
        ctx.fillRect(x, y, Math.max(6, barW-8), bh);
      });

      ctx.fillStyle = palette.label;
      ctx.font = frame.tickFont;
      const labelStep = Math.max(1, Math.ceil(top.length / (frame.compact ? 3 : 5)));
      top.forEach((r,i)=>{
        if(i % labelStep !== 0 && i !== top.length - 1) return;
        const maxLabelW = Math.max(10, barW - 4);
        const lab = fitLabel(ctx, r.name || "", maxLabelW);
        const tx = geom.x0 + i*barW + ((barW - ctx.measureText(lab).width) / 2);
        const x = Math.max(2, tx);
        ctx.fillText(lab, x, h-8);
      });

      drawYLabel(ctx, formatShortMoney(maxV), frame);
    }
  }

  // Bar: Total Lbs by month
  {
      const c = setupCanvas(document.getElementById("c_lbs"));
      if(c){
      const {ctx,w,h} = c;
      const frame = chartFrame(w,h);
      clear(ctx,w,h);
      ctx.fillStyle = palette.plotBg;
      ctx.fillRect(frame.left, frame.top, w - frame.left - frame.right, h - frame.top - frame.bottom);
      const geom = drawAxes(ctx,w,h,frame);

      const vals = monthRows.map(r=> Number(r.lbs)||0);
      const maxV = Math.max(1e-6, ...vals);
      const barW = geom.plotW / (vals.length || 1);

      vals.forEach((v,i)=>{
        const bh = (v/maxV)*geom.plotH;
        const x = geom.x0 + i*barW + 1;
        const y = geom.y0 - bh;
        ctx.fillStyle = palette.lbs;
        ctx.fillRect(x, y, Math.max(2, barW-2), bh);
      });

      drawBottomTicks(ctx, monthRows.map(r=>r.label), geom, h-10, frame);
      drawYLabel(ctx, String(Math.round(maxV)), frame);
    }
  }

  // Bar: Trips over time (by month in range)
  {
    const c = setupCanvas(document.getElementById("c_trips"));
    if(c){
      const {ctx,w,h} = c;
      const frame = chartFrame(w,h);
      clear(ctx,w,h);
      ctx.fillStyle = palette.plotBg;
      ctx.fillRect(frame.left, frame.top, w - frame.left - frame.right, h - frame.top - frame.bottom);
      const geom = drawAxes(ctx,w,h,frame);

      const timeline = makeTripsTimeline(trips);
      const vals = timeline.map(r=> Number(r.count)||0);
      const maxV = Math.max(1, ...vals);
      const barW = geom.plotW / (vals.length || 1);

      vals.forEach((v,i)=>{
        const bh = (v/maxV)*geom.plotH;
        const x = geom.x0 + i*barW + 1;
        const y = geom.y0 - bh;
        ctx.fillStyle = palette.trips;
        ctx.fillRect(x, y, Math.max(2, barW-2), bh);
      });

      drawBottomTicks(ctx, timeline.map(r=>r.shortLabel), geom, h-10, frame);
      drawYLabel(ctx, String(Math.round(maxV)), frame);
    }
  }
}
