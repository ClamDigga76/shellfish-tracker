import { createTripCardRendererCore } from "./trip_card_renderer_core_v5.js";

export function normalizeDealerDisplay(name){
  let s = String(name||"").trim();
  if(!s) return "";
  // collapse whitespace
  s = s.replace(/\s+/g, " ");
  // remove common trailing business suffixes (display-only)
  s = s.replace(/\b(inc\.?|incorporated|llc|co\.?|company)\b\.?/gi, "").replace(/\s+/g," ").trim();
  // Title-case words (keeps & and numbers)
  return s.split(" ").map(w=>{
    if(!w) return w;
    // keep all-caps short tokens like "USA"
    if(w.length <= 3 && w.toUpperCase() === w) return w;
    const lower = w.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }).join(" ");
}

export function createTripCardRenderHelpers({ formatDateDMY, to2, computePPL, resolveTripPayRate, deriveTripSettlement, formatMoney, escapeHtml }){
  // Public Trip Card render seam:
  // - Use this wrapper for all screen-level trip card rendering.
  // - Add new variants/helpers here instead of duplicating card markup in feature screens.
  // - Shared model/layout ownership stays in trip_card_renderer_core_v5.js.
  const { resolveTripCardModel, renderTripCardHTML } = createTripCardRendererCore({
    formatDateDMY,
    to2,
    computePPL,
    resolveTripPayRate,
    deriveTripSettlement,
    formatMoney,
    escapeHtml
  });

  function renderStandardReadOnlyTripCard(t, opts = {}){
    const model = resolveTripCardModel(t, opts);
    return renderTripCardHTML(model, { interactive: false, variant: opts.variant || "standard" });
  }

  function renderStandardInteractiveTripCard(t, opts = {}){
    const model = resolveTripCardModel(t, opts);
    return renderTripCardHTML(model, { interactive: true, variant: opts.variant || "standard" });
  }

  function renderTripsBrowseReadOnlyTripCard(t, opts = {}){
    const model = resolveTripCardModel(t, opts);
    return renderTripCardHTML(model, {
      interactive: false,
      variant: "tripsBrowse",
      auditVariant: "tripsBrowseReadOnly",
      showTripsBrowseActions: false
    });
  }

  function renderTripsBrowseInteractiveTripCard(t, opts = {}){
    const model = resolveTripCardModel(t, opts);
    return renderTripCardHTML(model, {
      interactive: true,
      variant: "tripsBrowse",
      auditVariant: "tripsBrowse",
      showTripsBrowseActions: true
    });
  }

  // Legacy alias; keeps compatibility while always using shared standardized layout.
  function renderTripCatchCard(t, opts = {}){
    return opts?.interactive
      ? renderStandardInteractiveTripCard(t, opts)
      : renderStandardReadOnlyTripCard(t, opts);
  }

  return {
    renderStandardReadOnlyTripCard,
    renderStandardInteractiveTripCard,
    renderTripsBrowseReadOnlyTripCard,
    renderTripsBrowseInteractiveTripCard,
    renderTripCatchCard
  };
}
