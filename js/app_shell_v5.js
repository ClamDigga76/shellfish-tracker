const TABS = [
  { key: "home", label: "Home", icon: "home" },
  { key: "all_trips", label: "Trips", icon: "trips" },
  { key: "new", label: "New", icon: "plus", aria: "New Trip", isPlus: true },
  { key: "reports", label: "Insights", icon: "reports" },
  { key: "settings", label: "Settings", icon: "settings" },
];


export function getActiveTabKey(view){
  if(view === "new" || view === "edit") return "new";
  if(view === "help" || view === "about") return "settings";
  return view || "home";
}

export function renderPageHeader(viewKey, { escapeHtml }){
  const helpKey = (viewKey === "all_trips") ? "trips" : viewKey;
  const showHelp = (helpKey === "home" || helpKey === "trips" || helpKey === "reports");
  const topLevelViews = new Set(["home", "all_trips", "reports", "settings"]);
  const showLandingTarget = topLevelViews.has(viewKey);
  const titleByView = {
    home: "Home",
    all_trips: "Trips",
    new: "New Trip",
    edit: "Edit Trip",
    review: "Review Trip",
    reports: "Insights",
    settings: "Settings",
    help: "Help",
    about: "About"
  };
  const descriptionByView = {
    home: "Your season at a glance",
    all_trips: "Search, filter, and review saved trips",
    reports: "Track trends and performance",
    settings: "Manage app tools",
    help: "Learn how it works",
    new: "Log today's catch",
    edit: "Update this trip"
  };
  const headerTitle = titleByView[viewKey] || "Bank the Catch";
  const headerDescription = descriptionByView[viewKey] || "";
  return `
    <div class="pageHeader${["home", "all_trips", "reports", "settings", "help", "new", "edit"].includes(viewKey) ? " pageHeader--masthead-standard" : ""}${viewKey === "all_trips" ? " pageHeader--all-trips" : ""}" data-view="${escapeHtml(viewKey)}">
      <span class="phActionStub" aria-hidden="true"></span>
      <div class="phTitleSlot">
        ${showLandingTarget ? `<span class="pageLandingTarget sr-only" data-top-level-landing="true" tabindex="-1" aria-label="${escapeHtml(`${headerTitle} page`)}"></span>` : ""}
        <h2 class="phTitle">${escapeHtml(headerTitle)}</h2>
        ${headerDescription ? `<p class="phDescription">${escapeHtml(headerDescription)}</p>` : ""}
      </div>
      ${showHelp
        ? `<button class="phHelpBtn" type="button" aria-label="Help" data-help="${escapeHtml(helpKey)}"><span class="phHelpIconWrap" aria-hidden="true">${helpIconSvg()}</span><span class="phHelpLabel">Help</span></button>`
        : `<span class="phActionStub" aria-hidden="true"></span>`
      }
    </div>
  `;
}

export function bindHeaderHelpButtons({ onHelpClick }){
  try{
    document.querySelectorAll('.phHelpBtn[data-help]').forEach(btn=>{
      btn.onclick = ()=>{
        const k = String(btn.getAttribute('data-help')||'').toLowerCase();
        onHelpClick(k || "");
      };
    });
  }catch(_e){}
}

function iconSvg(name){
  if(name === "home"){
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M3 10.5 12 3l9 7.5"/><path d="M5 10.5V21h14V10.5"/>
      <path d="M9 21v-7h6v7"/>
    </svg>`;
  }
  if(name === "trips"){
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M9 4h6"/><path d="M9 2h6v2H9z"/>
      <path d="M7 4h10"/><path d="M6 6h12v16H6z"/>
      <path d="M9 10h6"/><path d="M9 14h6"/><path d="M9 18h4"/>
    </svg>`;
  }
  if(name === "reports"){
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-8"/><path d="M3 20h18"/>
    </svg>`;
  }
  if(name === "plus"){
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M12 5v14"/><path d="M5 12h14"/>
    </svg>`;
  }
  if(name === "settings"){
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"/>
      <path d="M19.4 15a7.9 7.9 0 0 0 .1-1l2-1.2-2-3.5-2.3.6a7.2 7.2 0 0 0-1.7-1L15 4h-6l-.5 2.9a7.2 7.2 0 0 0-1.7 1L4.5 7.3 2.5 10.8 4.5 12a7.9 7.9 0 0 0 0 2l-2 1.2 2 3.5 2.3-.6a7.2 7.2 0 0 0 1.7 1L9 20h6l.5-2.9a7.2 7.2 0 0 0 1.7-1l2.3.6 2-3.5-2.1-1.2z"/>
    </svg>`;
  }
  return "";
}

function helpIconSvg(){
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="8.5"></circle>
    <path d="M9.6 9.4a2.7 2.7 0 0 1 4.7 1.8c0 1.8-2.3 2.3-2.3 4"></path>
    <path d="M12 17h.01"></path>
  </svg>`;
}

export function renderTabBar({
  activeView,
  escapeHtml,
  hasUnsavedDraft,
  onNavigate,
  confirmUnsavedLeave
}){
  const host = document.getElementById("tabbar");
  if(!host) return;

  const activeKey = getActiveTabKey(activeView);
  host.innerHTML = TABS.map(t => {
    const isActive = t.key === activeKey;
    const ariaCurrent = isActive ? ' aria-current="page"' : "";
    return `
    <button class="tabbtn ${t.isPlus ? "plus" : "standard"} ${isActive ? "active" : ""}" type="button" data-tab="${escapeHtml(t.key)}" aria-label="${escapeHtml(t.aria || t.label)}"${ariaCurrent}>
      ${iconSvg(t.icon)}
      <span>${escapeHtml(t.label)}</span>
    </button>
  `;
  }).join("");

  host.querySelectorAll("[data-tab]").forEach(btn => {
    btn.onclick = async () => {
      const next = btn.getAttribute("data-tab") || "home";
      if((activeView === "new" || activeView === "edit") && hasUnsavedDraft()){
        const canLeave = (typeof confirmUnsavedLeave === "function")
          ? await confirmUnsavedLeave({
            activeView,
            next
          })
          : confirm("Leave this screen? Your unsaved trip entry may be lost.");
        if(!canLeave) return;
      }
      onNavigate(next);
    };
  });
}

export function createAppShellBindings({
  escapeHtml,
  onHelpClick,
  onTabNavigate,
  hasUnsavedDraft,
  confirmUnsavedLeave
}){
  return {
    renderPageHeader(viewKey){
      return renderPageHeader(viewKey, { escapeHtml });
    },
    bindHeaderHelpButtons(){
      return bindHeaderHelpButtons({ onHelpClick });
    },
    renderTabBar(activeView){
      return renderTabBar({
        activeView,
        escapeHtml,
        hasUnsavedDraft,
        onNavigate: onTabNavigate,
        confirmUnsavedLeave
      });
    }
  };
}
