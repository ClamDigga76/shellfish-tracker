export function createTopLevelNavigationTransitionSeam({
  getState,
  saveState,
  render,
  getApp,
  clearHomeMetricDetailState
}){
  const TOP_LEVEL_TRANSITION_VIEWS = new Set(["home", "all_trips", "reports", "settings"]);
  const TOP_LEVEL_TRANSITION_OUT_MS = 90;
  const TOP_LEVEL_TRANSITION_IN_MS = 170;

  let topLevelTransitionToken = 0;
  let topLevelTransitionOutTimer = 0;
  let topLevelTransitionCleanupTimer = 0;

  function supportsTopLevelTransition(){
    if(typeof window === "undefined" || !window.matchMedia) return true;
    try{ return !window.matchMedia("(prefers-reduced-motion: reduce)").matches; }catch(_){ return true; }
  }

  function isTopLevelTransitionView(viewKey){
    return TOP_LEVEL_TRANSITION_VIEWS.has(String(viewKey || "home"));
  }

  function clearTopLevelTransitionTimers(){
    if(topLevelTransitionOutTimer){
      window.clearTimeout(topLevelTransitionOutTimer);
      topLevelTransitionOutTimer = 0;
    }
    if(topLevelTransitionCleanupTimer){
      window.clearTimeout(topLevelTransitionCleanupTimer);
      topLevelTransitionCleanupTimer = 0;
    }
  }

  function cleanupTopLevelTransition(app){
    if(!app) return;
    app.classList.remove("screenTransitionActive", "screenTransitionOut", "screenTransitionIn");
  }

  function shouldAnimateTopLevelScreenChange(fromView, toView){
    const fromKey = String(fromView || "home");
    const toKey = String(toView || "home");
    return fromKey !== toKey && isTopLevelTransitionView(fromKey) && isTopLevelTransitionView(toKey) && supportsTopLevelTransition();
  }

  function hasActiveMetricDetail(metricDetail, metricDetailContext){
    const detailKey = String(metricDetail || "").trim();
    const hasContext = !!(metricDetailContext && typeof metricDetailContext === "object");
    return !!(detailKey || hasContext);
  }

  function resetActiveTopLevelView(state, activeView){
    if(!state || typeof state !== "object") return false;
    if(activeView === "home"){
      if(hasActiveMetricDetail(state.homeMetricDetail, state.homeMetricDetailContext)){
        clearHomeMetricDetailState();
        return true;
      }
      return false;
    }
    if(activeView === "reports"){
      if(hasActiveMetricDetail(state.reportsMetricDetail, state.reportsMetricDetailContext)){
        state.reportsMetricDetail = "";
        state.reportsMetricDetailContext = null;
        state.reportsSection = "insights";
        return true;
      }
      const currentReportsSection = String(state.reportsSection || "insights").toLowerCase();
      if(currentReportsSection !== "insights"){
        state.reportsSection = "insights";
        return true;
      }
      return false;
    }
    return false;
  }

  function navigateTopLevelView(nextView){
    const state = getState();
    const currentView = String(state?.view || "home");
    const nextKey = String(nextView || "home");
    if(currentView === nextKey){
      if(resetActiveTopLevelView(state, currentView)){
        saveState();
        render();
      }
      return;
    }
    const leavingHome = currentView === "home" && nextKey !== "home";
    if(!shouldAnimateTopLevelScreenChange(currentView, nextKey)){
      if(leavingHome) clearHomeMetricDetailState();
      state.view = nextKey;
      saveState();
      render();
      return;
    }

    const app = getApp();
    if(!app){
      if(leavingHome) clearHomeMetricDetailState();
      state.view = nextKey;
      saveState();
      render();
      return;
    }

    const transitionToken = ++topLevelTransitionToken;
    clearTopLevelTransitionTimers();
    cleanupTopLevelTransition(app);
    app.classList.add("screenTransitionActive", "screenTransitionOut");

    topLevelTransitionOutTimer = window.setTimeout(()=>{
      if(transitionToken !== topLevelTransitionToken) return;
      if(leavingHome) clearHomeMetricDetailState();
      state.view = nextKey;
      saveState();
      render();

      const nextApp = getApp();
      if(!nextApp){
        clearTopLevelTransitionTimers();
        return;
      }

      cleanupTopLevelTransition(nextApp);
      nextApp.classList.add("screenTransitionActive", "screenTransitionIn");
      topLevelTransitionCleanupTimer = window.setTimeout(()=>{
        if(transitionToken !== topLevelTransitionToken) return;
        cleanupTopLevelTransition(nextApp);
        clearTopLevelTransitionTimers();
      }, TOP_LEVEL_TRANSITION_IN_MS);
    }, TOP_LEVEL_TRANSITION_OUT_MS);
  }

  return {
    navigateTopLevelView
  };
}
