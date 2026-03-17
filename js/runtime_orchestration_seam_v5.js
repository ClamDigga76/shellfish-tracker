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
  bindHeaderHelpButtons
}){
  if(!state.view) state.view = "home";

  try{ document.body.dataset.view = String(state.view || ""); }catch(_){ }

  if(state.view === "settings") renderers.renderSettings();
  else if(state.view === "new") renderers.renderNewTrip();
  else if(state.view === "review") onRedirectToNew();
  else if(state.view === "edit") renderers.renderEditTrip();
  else if(state.view === "reports") renderers.renderReports();
  else if(state.view === "help") renderers.renderHelp();
  else if(state.view === "all_trips") renderers.renderAllTrips();
  else if(state.view === "about") renderers.renderAbout();
  else renderers.renderHome();

  renderTabBar(state.view);
  bindHeaderHelpButtons();
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
