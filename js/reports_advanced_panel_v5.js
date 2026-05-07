import { createTimeframeFilterControlsSeam } from "./timeframe_filter_controls_seam_v5.js";

export function createReportsAdvancedPanelSeam(deps){
  const {
    escapeHtml,
    formatReportDateValue,
    parseReportDateToISO,
    bindDatePill,
    normalizeCustomRangeWithFeedback
  } = deps;
  const timeframeFilterControls = createTimeframeFilterControlsSeam({
    escapeHtml,
    parseReportDateToISO,
    formatDateDMY: formatReportDateValue
  });

  function renderAdvancedPanel({ reportsFilter, dealers, areas }){
    const rf = reportsFilter || {};
    const advOpen = !!rf.adv;
    if(!advOpen) return "";

    const advFromValue = formatReportDateValue(rf.from);
    const advToValue = formatReportDateValue(rf.to);

    const dealerOpts = ['<option value="">Any Dealer</option>'].concat(
      (Array.isArray(dealers) ? dealers : []).map((d)=>{
        const v = String(d || "");
        return `<option value="${escapeHtml(v)}" ${v===String(rf.dealer||"")?'selected':''}>${escapeHtml(v)}</option>`;
      })
    ).join("");

    const areaOpts = ['<option value="">Any Area</option>'].concat(
      (Array.isArray(areas) ? areas : []).map((a)=>{
        const v = String(a || "");
        return `<option value="${escapeHtml(v)}" ${v===String(rf.area||"")?'selected':''}>${escapeHtml(v)}</option>`;
      })
    ).join("");

    return `
      <div id="reportsAdvancedInlinePanel" class="reportsAdvancedInlinePanel">
        <div class="sep reportsAdvancedDivider"></div>
        <div class="reportsAdvancedGroup">
          <div class="reportsAdvancedGroupLabel">Date range</div>
          ${timeframeFilterControls.renderCustomRangeRow({
            mode: "RANGE",
            fromValue: advFromValue,
            toValue: advToValue,
            fromId: "repAdvFrom",
            toId: "repAdvTo",
            applyId: "repAdvApply",
            wrapperClass: "reportsAdvancedRangeRow"
          })}
        </div>
        <div class="reportsAdvancedGroup">
          <div class="reportsAdvancedGroupLabel">Trip context</div>
          <div class="grid2 reportsAdvancedGrid">
            <div class="field">
              <div class="label">Dealer</div>
              <select class="input" id="repAdvDealer">${dealerOpts}</select>
            </div>
            <div class="field">
              <div class="label">Area</div>
              <select class="input" id="repAdvArea">${areaOpts}</select>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function bindAdvancedPanel({ root, state, saveState, renderReports, showToast, variant = "default" }){
    root.querySelectorAll(".repAdvToggle").forEach((btn)=>{
      btn.onclick = ()=>{
        state.reportsFilter.adv = !state.reportsFilter.adv;
        saveState();
        renderReports();
      };
    });

    bindDatePill("repAdvFrom");
    bindDatePill("repAdvTo");

    const advApply = root.querySelector("#repAdvApply");
    if(advApply){
      advApply.onclick = ()=>{
        if(variant === "empty"){
          let from = String(root.querySelector("#repAdvFrom")?.value || "").trim();
          let to = String(root.querySelector("#repAdvTo")?.value || "").trim();
          const dealer = String(root.querySelector("#repAdvDealer")?.value || "");
          const area = String(root.querySelector("#repAdvArea")?.value || "");

          state.reportsFilter.dealer = dealer;
          state.reportsFilter.area = area;

          if(from && !to) to = from;
          if(!from && to) from = to;

          const fromISO = parseReportDateToISO(from);
          const toISO = parseReportDateToISO(to);
          const wantsCustomRange = !!(fromISO || toISO);
          const normalized = normalizeCustomRangeWithFeedback({ fromISO, toISO });
          state.reportsFilter.from = wantsCustomRange ? normalized.fromISO : "";
          state.reportsFilter.to = wantsCustomRange ? normalized.toISO : "";
          state.reportsFilter.customRangeCorrectionMessages = wantsCustomRange ? normalized.messages : [];
          if(wantsCustomRange) state.reportsFilter.mode = "RANGE";

          saveState();
          renderReports();
          return;
        }

        const from = String(root.querySelector("#repAdvFrom")?.value || "").trim();
        const to = String(root.querySelector("#repAdvTo")?.value || "").trim();
        const dealer = String(root.querySelector("#repAdvDealer")?.value || "");
        const area = String(root.querySelector("#repAdvArea")?.value || "");
        const fromISO = parseReportDateToISO(from);
        const toISO = parseReportDateToISO(to);
        const wantsCustomRange = !!(fromISO || toISO);
        const normalized = normalizeCustomRangeWithFeedback({ fromISO, toISO });
        state.reportsFilter.from = wantsCustomRange ? normalized.fromISO : "";
        state.reportsFilter.to = wantsCustomRange ? normalized.toISO : "";
        state.reportsFilter.customRangeCorrectionMessages = wantsCustomRange ? normalized.messages : [];
        state.reportsFilter.dealer = dealer;
        state.reportsFilter.area = area;
        if(wantsCustomRange) state.reportsFilter.mode = "RANGE";

        saveState();
        renderReports();
      };
    }

  }

  return {
    renderAdvancedPanel,
    bindAdvancedPanel
  };
}
