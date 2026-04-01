export function createReportsShellControlsSeam(deps){
  const {
    escapeHtml,
    parseReportDateToISO,
    formatDateDMY
  } = deps;

  const REPORTS_PRESET_FILTER_ITEMS = [
    { key: "YTD", label: "YTD" },
    { key: "THIS_MONTH", label: "This Month" },
    { key: "LAST_MONTH", label: "Last Month" },
    { key: "90D", label: "Last 3 Months" },
    { key: "ALL", label: "All Time" }
  ];
  const REPORTS_PRESET_MODES = REPORTS_PRESET_FILTER_ITEMS.map((item)=> item.key);

  const REPORTS_SECTION_ITEMS = [
    { key: "insights", label: "Insights", intro: "Top takeaways for this range." },
    { key: "charts", label: "Charts", intro: "Trend direction at a glance." },
    { key: "seasonality", label: "Seasonality", intro: "Matched windows across years." },
    { key: "records", label: "Records", intro: "High and low trip records." },
    { key: "detail", label: "Detail", intro: "Dealer, area, and monthly tables." }
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

  const buildActiveFilterSummary = (rf)=> {
    const activeFilterTokens = [];
    const fromISO = parseReportDateToISO(rf.from);
    const toISO = parseReportDateToISO(rf.to);
    if(fromISO || toISO){
      const fromLabel = fromISO ? formatDateDMY(fromISO) : "Start";
      const toLabel = toISO ? formatDateDMY(toISO) : "End";
      activeFilterTokens.push(`Date ${fromLabel} → ${toLabel}`);
    }
    const dealerFilter = String(rf.dealer || "").trim();
    if(dealerFilter) activeFilterTokens.push(`Dealer ${dealerFilter}`);
    const areaFilter = String(rf.area || "").trim();
    if(areaFilter) activeFilterTokens.push(`Area ${areaFilter}`);
    const activeFilterSummaryLabel = activeFilterTokens.length
      ? `${activeFilterTokens.length} filter${activeFilterTokens.length === 1 ? "" : "s"} on`
      : "No custom filters";
    const renderActiveFilterSummary = activeFilterTokens.length
      ? `
      <div class="reportsActiveFilterSummary" aria-live="polite" aria-label="Active custom filters">
        <div class="reportsActiveFilterChipRow">${activeFilterTokens.map((token)=> `<span class="reportsActiveFilterChip">${escapeHtml(token)}</span>`).join("")}</div>
      </div>
    `
      : "";

    return {
      activeFilterSummaryLabel,
      renderActiveFilterSummary
    };
  };

  const renderCorrectionSummary = ({ filterMode, customRangeCorrectionMessages = [] })=> (
    filterMode === "RANGE" && customRangeCorrectionMessages.length
      ? `<div class="reportsRangeCorrectionSummary muted small" aria-live="polite">${customRangeCorrectionMessages.map((msg)=>`<div>${escapeHtml(msg)}</div>`).join("")}</div>`
      : ""
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
    const chip = ({ key, label })=> `<button class="chip segBtn reportsPrimaryFilterChip ${activePresetFilterKey===key?'on is-selected':''}" data-rf="${key}" type="button" role="tab" aria-selected="${activePresetFilterKey===key ? "true" : "false"}">${label}</button>`;
    const renderReportsSectionChip = (item)=> `<button class="chip reportsSectionChip ${activeReportsSection===item.key?'on is-selected':''}" data-reports-section="${item.key}" type="button" role="tab" id="reports-tab-${item.key}" aria-controls="reportsTransitionRoot" aria-selected="${activeReportsSection===item.key ? 'true' : 'false'}" tabindex="${activeReportsSection===item.key ? "0" : "-1"}">
    <span>${item.label}</span>
  </button>`;

    return `
    <div class="reportsTopShell reportsTopShell--${escapeHtml(shellMode)}">
      <section class="reportsTimeframeShell" aria-label="Reports timeframe controls">
        <div class="segWrap timeframeUnifiedControl reportsTimeframeControl reportsPrimaryFilterBar" role="tablist" aria-label="Reports quick range filters">
          ${REPORTS_PRESET_FILTER_ITEMS.map((item)=> chip(item)).join("")}
        </div>
      </section>

      <div class="reportsAdvancedShell" aria-label="Reports advanced filters">
        <button class="chip segBtn repAdvToggle reportsAdvancedDisclosure ${isAdvancedActive ? "on is-selected" : ""}" type="button" aria-expanded="${advOpen ? "true" : "false"}" aria-controls="reportsAdvancedInlinePanel">
          <span class="reportsAdvancedDisclosureTitle">Advanced</span>
          <span class="reportsAdvancedDisclosureState">${escapeHtml(activeFilterSummaryLabel)}</span>
        </button>
        ${renderActiveFilterSummary}
        ${correctionSummary}
        ${quarantinedSupportCopy ? `<div class="reportsRangeCorrectionSummary muted small" aria-live="polite">${escapeHtml(quarantinedSupportCopy)}</div>` : ""}
        ${advPanel}
      </div>

      <section class="reportsNavShell" aria-label="Reports sections">
        <div class="reportsSectionSwitch" role="tablist" aria-label="Reports sections">
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
