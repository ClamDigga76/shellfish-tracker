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

export function createTripCardRenderHelpers({ formatDateDMY, to2, computePPL, formatMoney, escapeHtml }){
  const { resolveTripCardModel, renderTripCardHTML } = createTripCardRendererCore({
    formatDateDMY,
    to2,
    computePPL,
    formatMoney,
    escapeHtml
  });

  function renderStandardReadOnlyTripCard(t, opts = {}){
    const model = resolveTripCardModel(t, opts);
    return renderTripCardHTML(model, { interactive: false });
  }

  function renderStandardInteractiveTripCard(t, opts = {}){
    const model = resolveTripCardModel(t, opts);
    return renderTripCardHTML(model, { interactive: true });
  }

  // Legacy alias while callers migrate to explicit shared APIs.
  function renderTripCatchCard(t, opts = {}){
    return opts?.interactive
      ? renderStandardInteractiveTripCard(t, opts)
      : renderStandardReadOnlyTripCard(t, opts);
  }

  return {
    renderStandardReadOnlyTripCard,
    renderStandardInteractiveTripCard,
    renderTripCatchCard
  };
}
