export function createRuntimeOrchestrationSeam({
  createUpdateRuntimeStatusSeam,
  createDiagnosticsFatalSeam,
  displayBuildVersion,
  getState,
  getSchemaVersion,
  copyTextWithFeedback,
  escapeHtml
}){
  const updateRuntimeStatus = createUpdateRuntimeStatusSeam({
    displayBuildVersion,
    getIsSettingsView: () => getState()?.view === "settings",
    getSchemaVersion
  });

  const diagnosticsFatal = createDiagnosticsFatalSeam({
    displayBuildVersion,
    getSchemaVersion: () => getSchemaVersion(),
    getState,
    copyTextWithFeedback,
    escapeHtml
  });

  const { getDebugInfo, showFatal, bindBootErrorHandlers, bindFatalHandlers } = diagnosticsFatal;

  function bindRuntimeBootHandlers(){
    bindBootErrorHandlers();
    window.addEventListener("sw-update-ready", () => {
      updateRuntimeStatus.markSwUpdateReady();
    });
    bindFatalHandlers();
  }

  return {
    updateRuntimeStatus,
    getDebugInfo,
    showFatal,
    bindRuntimeBootHandlers
  };
}

export function renderViewDispatch({
  state,
  renderers,
  onRedirectToNew,
  renderTabBar,
  bindHeaderHelpButtons,
  onBeforeTopLevelViewChange,
  onAfterTopLevelViewChange
}){
  if(!state.view) state.view = "home";
  const nextView = String(state.view || "home");
  const prevView = String(renderViewDispatch._lastView || "");

  if(prevView && prevView !== nextView){
    try{ onBeforeTopLevelViewChange?.({ fromView: prevView, toView: nextView }); }catch(_){ }
  }

  try{ document.body.dataset.view = nextView; }catch(_){ }

  if(nextView === "settings") renderers.renderSettings();
  else if(nextView === "new") renderers.renderNewTrip();
  else if(nextView === "review") onRedirectToNew();
  else if(nextView === "edit") renderers.renderEditTrip();
  else if(nextView === "reports") renderers.renderReports();
  else if(nextView === "help") renderers.renderHelp();
  else if(nextView === "all_trips") renderers.renderAllTrips();
  else if(nextView === "about") renderers.renderAbout();
  else renderers.renderHome();

  renderTabBar(nextView);
  bindHeaderHelpButtons();
  if(prevView && prevView !== nextView){
    try{ onAfterTopLevelViewChange?.({ fromView: prevView, toView: nextView }); }catch(_){ }
  }
  renderViewDispatch._lastView = nextView;
}

export function startRuntimeRender({ render, getBootPill, displayBuildVersion, showFatal }){
  try{
    window.__SHELLFISH_APP_STARTED = true;
    render();
    const bp = getBootPill();
    if(bp && !bp.classList.contains("err")){
      bp.textContent = "OK";
      bp.title = `v ${displayBuildVersion}`;
    }
  }catch(err){
    showFatal(err);
  }
}
