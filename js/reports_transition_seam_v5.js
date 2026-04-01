export function createReportsTransitionSeam(deps){
  const {
    drawReportsCharts,
    getApp,
    renderReportsScreen
  } = deps;

  const REPORTS_TRANSITION_MS = 180;
  let reportsTransitionTimer = null;
  let reportsChartRenderToken = 0;
  let reportsChartScheduleRafId = 0;
  let pendingReportsAnnouncement = "";
  let reportsFocusIntent = null;

  function invalidateReportsChartSchedule(){
    reportsChartRenderToken += 1;
    if(reportsChartScheduleRafId){
      cancelAnimationFrame(reportsChartScheduleRafId);
      reportsChartScheduleRafId = 0;
    }
    return reportsChartRenderToken;
  }

  function scheduleReportsChartsDraw(monthRows, dealerRows, tripsTimeline, options){
    const renderToken = invalidateReportsChartSchedule();
    reportsChartScheduleRafId = requestAnimationFrame(()=>{
      reportsChartScheduleRafId = 0;
      if(renderToken !== reportsChartRenderToken) return;
      drawReportsCharts(monthRows, dealerRows, tripsTimeline, options);
    });
  }

  function animateReportsShellEnter(root){
    if(!root) return;
    root.classList.remove("is-ready");
    requestAnimationFrame(()=>{
      requestAnimationFrame(()=>{
        root.classList.add("is-ready");
      });
    });
  }

  function queueReportsAnnouncement(message){
    const text = String(message || "").trim();
    if(!text) return;
    pendingReportsAnnouncement = text;
  }

  function flushReportsAnnouncement(){
    const text = String(pendingReportsAnnouncement || "").trim();
    if(!text) return;
    pendingReportsAnnouncement = "";
    try{
      const live = document.getElementById("ariaLive");
      if(!live) return;
      live.setAttribute("aria-live", "polite");
      live.textContent = "";
      setTimeout(()=>{
        live.textContent = text;
        setTimeout(()=>{ live.textContent = ""; }, 1800);
      }, 40);
    }catch(_){ }
  }

  function queueReportsFocusIntent(intent){
    if(!intent || typeof intent !== "object"){
      reportsFocusIntent = null;
      return;
    }
    reportsFocusIntent = intent;
  }

  function applyReportsFocusIntent(root){
    const intent = reportsFocusIntent;
    reportsFocusIntent = null;
    if(!intent || !root) return;
    const safeFocus = (target)=>{
      if(!(target instanceof HTMLElement)) return false;
      try{
        target.focus({ preventScroll: true });
        return true;
      }catch(_){
        return false;
      }
    };
    if(intent.type === "section-tab"){
      const tab = root.querySelector(`.chip[data-reports-section="${intent.key}"]`);
      if(safeFocus(tab)) return;
    }
    if(intent.type === "metric-button"){
      const metricBtn = root.querySelector(`[data-metric-detail="${intent.metricKey}"]`);
      if(safeFocus(metricBtn)) return;
    }
    if(intent.type === "metric-back"){
      const backBtn = root.querySelector("#reportsMetricBack");
      if(safeFocus(backBtn)) return;
    }
    const panel = root.querySelector("#reportsTransitionRoot");
    safeFocus(panel);
  }

  function runReportsTransition({ mutate, renderNext, homeMetricOnly = false } = {}){
    if(typeof mutate !== "function") return;
    const app = getApp();
    const root = app?.querySelector("#reportsTransitionRoot");
    const nextRenderer = typeof renderNext === "function"
      ? renderNext
      : ((opts = {})=> renderReportsScreen(opts));
    const finish = ()=>{
      mutate();
      nextRenderer({ homeMetricOnly });
    };
    if(!root){
      finish();
      return;
    }
    if(reportsTransitionTimer){
      clearTimeout(reportsTransitionTimer);
      reportsTransitionTimer = null;
    }
    root.classList.remove("is-ready");
    root.classList.add("is-leaving");
    reportsTransitionTimer = setTimeout(()=>{
      reportsTransitionTimer = null;
      finish();
    }, REPORTS_TRANSITION_MS);
  }

  return {
    invalidateReportsChartSchedule,
    scheduleReportsChartsDraw,
    animateReportsShellEnter,
    queueReportsAnnouncement,
    flushReportsAnnouncement,
    queueReportsFocusIntent,
    applyReportsFocusIntent,
    runReportsTransition
  };
}
