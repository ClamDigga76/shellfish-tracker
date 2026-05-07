import { createTimeframeFilterControlsSeam } from "./timeframe_filter_controls_seam_v5.js";

export function createReportsShellControlsSeam(deps){
  const {
    escapeHtml,
    parseReportDateToISO,
    formatDateDMY
  } = deps;

  const timeframeFilterControls = createTimeframeFilterControlsSeam({
    escapeHtml,
    parseReportDateToISO,
    formatDateDMY
  });
  const REPORTS_PRESET_FILTER_ITEMS = timeframeFilterControls.REPORTS_PRESET_FILTER_ITEMS;
  const REPORTS_PRESET_MODES = REPORTS_PRESET_FILTER_ITEMS.map((item)=> item.key);

  const REPORTS_SECTION_ITEMS = [
    { key: "insights", label: "Overview", intro: "Main takeaways for this range." },
    { key: "high-value", label: "Top Drivers", intro: "See what affected pounds, total pay, price/lb, dealers, and areas in this range." },
    { key: "charts", label: "Charts", intro: "See how your season changes over time." },
    { key: "seasonality", label: "Season Trends", intro: "See how your season changes over time." },
    { key: "records", label: "Records", intro: "High and low trip records." },
    { key: "detail", label: "Breakdowns", intro: "Review trips, dealers, areas, and months in more detail." }
  ];

  function ensureReportsFilter(state){
    if(!state?.reportsFilter || typeof state.reportsFilter !== "object"){
      state.reportsFilter = { mode:"YTD", from:"", to:"", dealer:"", area:"", adv:false };
    }
    if(!state.reportsFilter.mode) state.reportsFilter.mode = "YTD";
    if(state.reportsFilter.from == null) state.reportsFilter.from = "";
    if(state.reportsFilter.to == null) state.reportsFilter.to = "";
    if(state.reportsFilter.dealer == null) state.reportsFilter.dealer = "";
    if(state.reportsFilter.area == null) state.reportsFilter.area = "";
    if(state.reportsFilter.adv == null) state.reportsFilter.adv = false;
    if(!Array.isArray(state.reportsFilter.customRangeCorrectionMessages)) state.reportsFilter.customRangeCorrectionMessages = [];
  }

  const resolveActiveReportsSection = (reportsSectionKey)=> (
    REPORTS_SECTION_ITEMS.some((item)=> item.key === reportsSectionKey) ? reportsSectionKey : "insights"
  );

  const buildActiveFilterSummary = (rf)=> timeframeFilterControls.buildActiveFilterSummary({ reportsFilter: rf });

  const renderCorrectionSummary = ({ filterMode, customRangeCorrectionMessages = [] })=> (
    timeframeFilterControls.renderCorrectionMessages({
      mode: filterMode,
      messages: customRangeCorrectionMessages,
      className: "reportsRangeCorrectionSummary"
    })
  );

  const renderReportsTopShell = ({
    body = "",
    shellMode = "overview",
    activePresetFilterKey = "",
    isAdvancedActive = false,
    advOpen = false,
    activeFilterSummaryLabel = "No custom filters",
    renderActiveFilterSummary = "",
    correctionSummary = "",
    quarantinedSupportCopy = "",
    advPanel = "",
    activeReportsSection = "insights"
  } = {})=> {
    const renderReportsSectionChip = (item)=> `<button class="chip reportsSectionChip ${activeReportsSection===item.key?'on is-selected':''}" data-reports-section="${item.key}" type="button" role="tab" id="reports-tab-${item.key}" aria-controls="reportsTransitionRoot" aria-selected="${activeReportsSection===item.key ? 'true' : 'false'}" tabindex="${activeReportsSection===item.key ? "0" : "-1"}">
    <span>${item.label}</span>
  </button>`;

    return `
    <div class="reportsTopShell reportsTopShell--${escapeHtml(shellMode)}">
      <section class="reportsTimeframeShell" aria-label="Insights timeframe controls">
        ${timeframeFilterControls.renderPresetChipRow({
            items: REPORTS_PRESET_FILTER_ITEMS,
            activeKey: activePresetFilterKey,
            dataAttr: "data-rf",
            chipClass: "reportsPrimaryFilterChip",
            groupClass: "reportsTimeframeControl reportsPrimaryFilterBar",
            ariaLabel: "Insights quick range filters",
            role: "tablist",
            itemRole: "tab",
            includeAriaSelected: true,
            useRovingTabIndex: true
          })}
      </section>

      <div class="reportsAdvancedShell" aria-label="Insights advanced filters">
        <button class="chip segBtn repAdvToggle reportsAdvancedDisclosure ${isAdvancedActive ? "on is-selected" : ""}" type="button" aria-expanded="${advOpen ? "true" : "false"}" aria-controls="reportsAdvancedInlinePanel">
          <span class="reportsAdvancedDisclosureTitle">Advanced</span>
          <span class="reportsAdvancedDisclosureState">${escapeHtml(activeFilterSummaryLabel)}</span>
        </button>
        ${renderActiveFilterSummary}
        ${correctionSummary}
        ${quarantinedSupportCopy ? `<div class="reportsRangeCorrectionSummary muted small" aria-live="polite">${escapeHtml(quarantinedSupportCopy)}</div>` : ""}
        ${advPanel}
      </div>

      <section class="reportsNavShell" aria-label="Insights sections">
        <div class="reportsSectionSwitch" role="tablist" aria-label="Insights sections">
          ${REPORTS_SECTION_ITEMS.map((item)=> renderReportsSectionChip(item)).join("")}
        </div>
      </section>

      ${body}
    </div>
  `;
  };

  const applyPrimaryReportsFilterSelection = (state, key)=>{
    const normalizedKey = String(key || "YTD").toUpperCase();
    if(!state.reportsFilter || typeof state.reportsFilter !== "object"){
      state.reportsFilter = { mode:"YTD", from:"", to:"", dealer:"", area:"", adv:false };
    }
    state.reportsFilter.mode = normalizedKey;
    state.reportsFilter.adv = false;
    if(normalizedKey !== "RANGE"){
      state.reportsFilter.from = "";
      state.reportsFilter.to = "";
      state.reportsFilter.customRangeCorrectionMessages = [];
    }
  };

  return {
    ensureReportsFilter,
    REPORTS_PRESET_FILTER_ITEMS,
    REPORTS_PRESET_MODES,
    REPORTS_SECTION_ITEMS,
    resolveActiveReportsSection,
    buildActiveFilterSummary,
    renderCorrectionSummary,
    renderReportsTopShell,
    applyPrimaryReportsFilterSelection
  };
}
