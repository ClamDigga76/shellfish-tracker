export function createReportsAdvancedPanelSeam(deps){
  const {
    escapeHtml,
    formatReportDateValue,
    parseReportDateToISO,
    bindDatePill
  } = deps;

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
      <div class="sep"></div>
      <div class="grid2">
        <div class="field">
          <div class="label">From</div>
          <input class="input" id="repAdvFrom" type="date" value="${escapeHtml(advFromValue)}">
        </div>
        <div class="field">
          <div class="label">To</div>
          <input class="input" id="repAdvTo" type="date" value="${escapeHtml(advToValue)}">
        </div>
      </div>
      <div class="grid2" style="margin-top:10px">
        <div class="field">
          <div class="label">Dealer</div>
          <select class="input" id="repAdvDealer">${dealerOpts}</select>
        </div>
        <div class="field">
          <div class="label">Area</div>
          <select class="input" id="repAdvArea">${areaOpts}</select>
        </div>
      </div>
      <div class="row" style="justify-content:flex-end;gap:10px;margin-top:10px">
        <button class="btn" id="repAdvReset" type="button">Reset</button>
        <button class="btn primary" id="repAdvApply" type="button">Apply</button>
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

          if(from || to){
            const sISO = parseReportDateToISO(from);
            const eISO = parseReportDateToISO(to);
            if(!sISO || !eISO){
              showToast("Invalid dates");
              return;
            }
            state.reportsFilter.mode = "RANGE";
          }

          from = parseReportDateToISO(from);
          to = parseReportDateToISO(to);

          state.reportsFilter.from = from;
          state.reportsFilter.to = to;

          saveState();
          showToast("Filter applied");
          renderReports();
          return;
        }

        const from = String(root.querySelector("#repAdvFrom")?.value || "").trim();
        const to = String(root.querySelector("#repAdvTo")?.value || "").trim();
        const dealer = String(root.querySelector("#repAdvDealer")?.value || "");
        const area = String(root.querySelector("#repAdvArea")?.value || "");
        const fromISO = parseReportDateToISO(from);
        const toISO = parseReportDateToISO(to);

        if((from && !fromISO) || (to && !toISO)){
          showToast("Invalid dates");
          return;
        }

        state.reportsFilter.from = fromISO;
        state.reportsFilter.to = toISO;
        state.reportsFilter.dealer = dealer;
        state.reportsFilter.area = area;
        if(fromISO || toISO){
          state.reportsFilter.mode = "RANGE";
        }

        saveState();
        showToast("Filter applied");
        renderReports();
      };
    }

    const advReset = root.querySelector("#repAdvReset");
    if(advReset){
      advReset.onclick = ()=>{
        if(variant === "empty"){
          state.reportsFilter.mode = "YTD";
          state.reportsFilter.from = "";
          state.reportsFilter.to = "";
          state.reportsFilter.dealer = "";
          state.reportsFilter.area = "";
        }else{
          state.reportsFilter = { mode:"YTD", from:"", to:"", dealer:"", area:"", adv:false };
        }

        saveState();
        showToast("Filters reset");
        renderReports();
      };
    }
  }

  return {
    renderAdvancedPanel,
    bindAdvancedPanel
  };
}
