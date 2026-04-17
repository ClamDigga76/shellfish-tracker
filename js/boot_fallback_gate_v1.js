(function initBootFallbackGate() {
  const doc = document;
  const root = doc.documentElement;
  const bootFallbackId = "bootFallback";
  const revealDelayMs = 2000;
  const fallbackVisibilityAttr = "data-boot-fallback";
  const bootStateAttr = "data-boot-state";
  let revealTimer = null;
  let revealTimerStarted = false;
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
    if (revealTimer !== null) {
      clearTimeout(revealTimer);
      revealTimer = null;
    }
    setFallbackHidden();
  }

  function maybeRevealFallback() {
    if (startupSettled) return;
    if (startupHasCompleted()) {
      settleStartupSuccess();
      return;
    }
    setFallbackVisible();
  }

  function startRevealTimer() {
    if (revealTimerStarted || startupSettled) return;
    revealTimerStarted = true;
    if (startupHasCompleted()) {
      settleStartupSuccess();
      return;
    }
    revealTimer = window.setTimeout(maybeRevealFallback, revealDelayMs);
  }

  setFallbackHidden();
  if (startupHasCompleted()) settleStartupSuccess();

  window.addEventListener("shellfish-app-started", settleStartupSuccess, { once: true });
  if (doc.readyState === "loading") {
    doc.addEventListener("DOMContentLoaded", startRevealTimer, { once: true });
  } else {
    startRevealTimer();
  }
})();
