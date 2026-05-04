(function initBootFallbackGate() {
  const doc = document;
  const root = doc.documentElement;
  const bootFallbackId = "bootFallback";
  const fallbackVisibilityAttr = "data-boot-fallback";
  const bootStateAttr = "data-boot-state";
  let startupSettled = false;

  function getFallbackEl() {
    return doc.getElementById(bootFallbackId);
  }

  function setFallbackHidden() {
    root.setAttribute(fallbackVisibilityAttr, "hidden");
    const fallbackEl = getFallbackEl();
    if (fallbackEl) fallbackEl.setAttribute("aria-hidden", "true");
  }

  function setFallbackVisible() {
    root.setAttribute(fallbackVisibilityAttr, "visible");
    const fallbackEl = getFallbackEl();
    if (fallbackEl) fallbackEl.removeAttribute("aria-hidden");
  }

  function startupHasCompleted() {
    return window.__SHELLFISH_APP_STARTED === true || root.getAttribute(bootStateAttr) === "started";
  }

  function settleStartupSuccess() {
    if (startupSettled) return;
    startupSettled = true;
    setFallbackHidden();
  }

  setFallbackVisible();
  if (startupHasCompleted()) settleStartupSuccess();

  window.addEventListener("shellfish-app-started", settleStartupSuccess, { once: true });
})();
