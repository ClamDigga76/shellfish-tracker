(function seedDisplayModeForFirstPaint() {
  const root = document.documentElement;

  try {
    let isStandalone = false;
    if (window.matchMedia) {
      const media = window.matchMedia("(display-mode: standalone)");
      isStandalone = Boolean(media && media.matches);
    }
    if (!isStandalone && navigator.standalone === true) {
      isStandalone = true;
    }
    root.setAttribute("data-display-mode", isStandalone ? "standalone" : "browser");
  } catch (_) {
    root.setAttribute("data-display-mode", "browser");
  }
})();
