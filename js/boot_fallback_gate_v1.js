(function initBootFallbackGate() {
  const doc = document;
  const root = doc.documentElement;
  const bootFallbackId = "bootFallback";
  const fallbackVisibilityAttr = "data-boot-fallback";
  const bootStateAttr = "data-boot-state";
  let startupSettled = false;
  let revealTimerId = 0;
  const FALLBACK_REVEAL_DELAY_MS = 1300;

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
    if (revealTimerId) {
      window.clearTimeout(revealTimerId);
      revealTimerId = 0;
    }
    setFallbackHidden();
  }

  function revealFallbackForDelayedStartup() {
    if (startupSettled || startupHasCompleted()) {
      settleStartupSuccess();
      return;
    }
    setFallbackVisible();
  }

  setFallbackHidden();
  if (startupHasCompleted()) {
    settleStartupSuccess();
  } else {
    revealTimerId = window.setTimeout(revealFallbackForDelayedStartup, FALLBACK_REVEAL_DELAY_MS);
  }

  window.addEventListener("shellfish-app-started", settleStartupSuccess, { once: true });
})();
