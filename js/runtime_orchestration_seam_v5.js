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
    getRuntimeSupportDiagnosticsText: () => updateRuntimeStatus.formatSupportDiagnosticsSection(),
    copyTextWithFeedback,
    escapeHtml
  });

  const { getDebugInfo, showFatal, bindBootErrorHandlers, bindFatalHandlers } = diagnosticsFatal;
  let deferredInstallPrompt = null;

  function getDisplayMode(){
    try{
      const isStandalone = window.matchMedia && window.matchMedia("(display-mode: standalone)").matches;
      const navStandalone = (navigator.standalone === true);
      return (isStandalone || navStandalone) ? "standalone" : "browser";
    }catch{
      return "unknown";
    }
  }

  function getInstallPlatform(){
    const ua = String(navigator.userAgent || "");
    const vendor = String(navigator.vendor || "");
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isAndroid = /Android/i.test(ua);
    const isSafari = /Safari/i.test(ua) && !/CriOS|Chrome|Chromium|Edg|FxiOS/i.test(ua) && /Apple/i.test(vendor || ua);
    const isChrome = /Chrome|CriOS/i.test(ua) && !/Edg|OPR|SamsungBrowser/i.test(ua);
    if (isIOS) return isSafari ? "ios-safari" : "ios";
    if (isAndroid) return isChrome ? "android-chrome" : "android";
    if (isChrome) return "chrome";
    return "other";
  }

  function getInstallSurfaceModel(){
    const mode = getDisplayMode();
    const platform = getInstallPlatform();
    const installSupported = !!deferredInstallPrompt;
    const isInstalled = mode === "standalone";
    const isIOS = platform === "ios-safari" || platform === "ios";
    const isAndroidChrome = platform === "android-chrome";
    const statusPill = isInstalled ? "Installed" : "Browser";
    const statusLine = isInstalled
      ? "You’re running Bank the Catch as the installed app."
      : "You’re running Bank the Catch in a browser tab.";
    const statusHint = isInstalled
      ? "Open it from your Home Screen when you want installed mode."
      : (installSupported
        ? "Tap Install app for quick setup, or open Help for full step-by-step guidance."
        : isIOS
          ? "Open Help for Safari steps, then add Bank the Catch to your Home Screen."
          : isAndroidChrome
            ? "Open Help for Chrome steps, then add Bank the Catch to your Home Screen."
            : "Open Help for manual install steps. Safari on iPhone/iPad and Chrome on Android are the clearest paths.");
    const whyTitle = isInstalled ? "Installed and ready." : "Why install?";
    const whyBody = isInstalled
      ? "Use the Home Screen icon to keep opening the app in installed mode."
      : "Installing adds a Home Screen launch and helps you stay in the same app mode.";
    const stepsLine = isInstalled
      ? "If you used Safari or Chrome before installing, compare there and create a backup if older trips are missing."
      : isIOS
        ? "iPhone/iPad: open in Safari → Share → Add to Home Screen → Add."
        : isAndroidChrome
          ? (installSupported
            ? "Android Chrome: use Install app below, or open Help for the Chrome menu path."
            : "Android Chrome: Chrome menu → Install app or Add to Home screen.")
          : "Manual steps live in Help. Safari on iPhone/iPad or Chrome on Android are the clearest paths.";
    const actionLabel = isInstalled ? "Installed on this device" : (installSupported ? "Install app" : "Manual steps only");
    return {
      mode,
      platform,
      isInstalled,
      installSupported,
      statusPill,
      statusLine,
      statusHint,
      whyTitle,
      whyBody,
      stepsLine,
      actionLabel,
      actionEnabled: !isInstalled && installSupported,
      showAction: true
    };
  }

  async function runInstallAction(){
    const model = getInstallSurfaceModel();
    if (model.isInstalled) {
      return { ok: true, message: "Already running the installed app" };
    }
    if (!model.installSupported || !deferredInstallPrompt) {
      return { ok: false, message: model.stepsLine };
    }
    try {
      const promptEvent = deferredInstallPrompt;
      deferredInstallPrompt = null;
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice?.outcome === "accepted") {
        return { ok: true, message: "Install accepted — look for the Home Screen icon" };
      }
      return { ok: false, message: "Install cancelled — you can still install later from Settings" };
    } catch (_) {
      return { ok: false, message: model.stepsLine };
    }
  }

  function bindRuntimeBootHandlers(){
    bindBootErrorHandlers();
    window.addEventListener("sw-update-ready", () => {
      updateRuntimeStatus.markSwUpdateReady();
    });
    window.addEventListener("beforeinstallprompt", (event) => {
      try {
        event.preventDefault();
        deferredInstallPrompt = event;
      } catch (_) {}
    });
    window.addEventListener("appinstalled", () => {
      deferredInstallPrompt = null;
    });
    bindFatalHandlers();
  }

  return {
    updateRuntimeStatus,
    getDebugInfo,
    showFatal,
    bindRuntimeBootHandlers,
    getInstallSurfaceModel,
    runInstallAction
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
    try{
      window.__recordLastGoodRuntimeConfirmation?.();
    }catch(_){ }
  }catch(err){
    showFatal(err);
  }
}
