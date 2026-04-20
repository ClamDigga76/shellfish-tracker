export function createTimeframeFilterControlsSeam({
  escapeHtml,
  parseReportDateToISO,
  formatDateDMY
} = {}){
  const HOME_PRESET_FILTER_ITEMS = [
    { key: "YTD", label: "YTD" },
    { key: "MONTH", label: "This Month" },
    { key: "LAST_MONTH", label: "Last Month" },
    { key: "7D", label: "Last 7 Days" },
    { key: "30D", label: "Last 30 Days" },
    { key: "RANGE", label: "Custom Range" }
  ];

  const REPORTS_PRESET_FILTER_ITEMS = [
    { key: "YTD", label: "YTD" },
    { key: "THIS_MONTH", label: "This Month" },
    { key: "LAST_MONTH", label: "Last Month" },
    { key: "90D", label: "Last 3 Months" },
    { key: "ALL", label: "All Time" }
  ];

  function renderPresetChipRow({
    items = [],
    activeKey = "",
    dataAttr = "data-range-key",
    chipClass = "",
    groupClass = "",
    ariaLabel = "Timeframe filters",
    role = "group",
    itemRole = "",
    includeAriaSelected = false,
    useRovingTabIndex = false
  } = {}){
    const activeIdx = items.findIndex((item)=> String(activeKey) === String(item.key));
    const fallbackTabbableIdx = activeIdx >= 0 ? activeIdx : 0;
    return `
      <div class="segWrap timeframeUnifiedControl ${groupClass}" role="${escapeHtml(role)}" aria-label="${escapeHtml(ariaLabel)}">
        ${items.map((item, idx)=> {
          const isSelected = String(activeKey) === String(item.key);
          const isTabbable = useRovingTabIndex
            ? (activeIdx >= 0 ? isSelected : idx === fallbackTabbableIdx)
            : false;
          const itemAttrs = [];
          if(itemRole) itemAttrs.push(`role="${escapeHtml(String(itemRole))}"`);
          if(includeAriaSelected) itemAttrs.push(`aria-selected="${isSelected ? "true" : "false"}"`);
          if(useRovingTabIndex) itemAttrs.push(`tabindex="${isTabbable ? "0" : "-1"}"`);
          return `<button class="chip segBtn ${chipClass} ${isSelected ? "on is-selected" : ""}" ${dataAttr}="${escapeHtml(String(item.key))}" type="button" ${itemAttrs.join(" ")}>${escapeHtml(String(item.label || item.key))}</button>`;
        }).join("")}
      </div>
    `;
  }

  function renderCustomRangeRow({
    mode = "",
    customModeKey = "RANGE",
    fromValue = "",
    toValue = "",
    fromId,
    toId,
    applyId,
    applyLabel = "Apply",
    wrapperClass = ""
  } = {}){
    if(String(mode || "").toUpperCase() !== String(customModeKey || "RANGE").toUpperCase()) return "";
    return `
      <div class="row gap10 wrap dateRangeRow ${wrapperClass}">
        <div class="homeRangeInputs reportsSharedRangeInputs">
          <input class="input" id="${escapeHtml(String(fromId || ""))}" type="date" value="${escapeHtml(parseReportDateToISO?.(fromValue) || "")}" />
          <input class="input" id="${escapeHtml(String(toId || ""))}" type="date" value="${escapeHtml(parseReportDateToISO?.(toValue) || "")}" />
        </div>
        <button class="btn" id="${escapeHtml(String(applyId || ""))}" type="button">${escapeHtml(applyLabel)}</button>
      </div>
    `;
  }

  function renderCorrectionMessages({ mode = "", customModeKey = "RANGE", messages = [], className = "" } = {}){
    if(String(mode || "").toUpperCase() !== String(customModeKey || "RANGE").toUpperCase()) return "";
    const safeMessages = Array.isArray(messages) ? messages.filter(Boolean) : [];
    if(!safeMessages.length) return "";
    return `<div class="muted small mt8 ${className}" aria-live="polite">${safeMessages.map((msg)=> `<div>${escapeHtml(String(msg))}</div>`).join("")}</div>`;
  }

  function resolveRangeLabel({ mode = "YTD", fromISO = "", toISO = "", emptyCustomLabel = "Set dates" } = {}){
    const normalizedMode = String(mode || "YTD").toUpperCase();
    if(normalizedMode === "MONTH" || normalizedMode === "THIS_MONTH") return "This Month";
    if(normalizedMode === "LAST_MONTH") return "Last Month";
    if(normalizedMode === "7D") return "Last 7 Days";
    if(normalizedMode === "30D") return "Last 30 Days";
    if(normalizedMode === "90D") return "Last 3 Months";
    if(normalizedMode === "12M") return "Last 12 Months";
    if(normalizedMode === "ALL") return "All Time";
    if(normalizedMode === "RANGE" || normalizedMode === "CUSTOM"){
      const from = parseReportDateToISO?.(fromISO) || "";
      const to = parseReportDateToISO?.(toISO) || "";
      if(!from || !to) return emptyCustomLabel;
      return `${formatDateDMY?.(from) || from} → ${formatDateDMY?.(to) || to}`;
    }
    return "YTD";
  }

  function buildActiveFilterSummary({ reportsFilter } = {}){
    const rf = reportsFilter || {};
    const tokens = [];
    const rangeLabel = resolveRangeLabel({ mode: rf.mode, fromISO: rf.from, toISO: rf.to, emptyCustomLabel: "Custom range" });
    if(rangeLabel && String(rf.mode || "").toUpperCase() === "RANGE") tokens.push(`Date ${rangeLabel}`);

    const dealerFilter = String(rf.dealer || "").trim();
    if(dealerFilter) tokens.push(`Dealer ${dealerFilter}`);

    const areaFilter = String(rf.area || "").trim();
    if(areaFilter) tokens.push(`Area ${areaFilter}`);

    const activeFilterSummaryLabel = tokens.length
      ? `${tokens.length} filter${tokens.length === 1 ? "" : "s"} on`
      : "No custom filters";

    const renderActiveFilterSummary = tokens.length
      ? `
      <div class="reportsActiveFilterSummary" aria-live="polite" aria-label="Active custom filters">
        <div class="reportsActiveFilterChipRow">${tokens.map((token)=> `<span class="reportsActiveFilterChip">${escapeHtml(token)}</span>`).join("")}</div>
      </div>
    `
      : "";

    return { activeFilterSummaryLabel, renderActiveFilterSummary };
  }

  return {
    HOME_PRESET_FILTER_ITEMS,
    REPORTS_PRESET_FILTER_ITEMS,
    renderPresetChipRow,
    renderCustomRangeRow,
    renderCorrectionMessages,
    resolveRangeLabel,
    buildActiveFilterSummary
  };
}
