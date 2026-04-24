export function createQuickChipHelpers({
  getState,
  saveState,
  getLastUniqueFromTrips,
  normalizeKey,
  escapeHtml
}){
  function normalizeChipValue(raw){
    return String(raw || "").replace(/\s+/g, " ").trim();
  }

  function dedupeChipValues(kind, values){
    const seen = new Set();
    const out = [];
    for(const raw of (Array.isArray(values) ? values : [])){
      const value = normalizeChipValue(raw);
      if(!value) continue;
      const dedupeKey = normalizeKey(value);
      if(!dedupeKey || seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      out.push(value);
    }
    return out;
  }

  function renderTopChips({ items, currentValue, containerId, kind, emptyLabel }){
    const list = Array.isArray(items) ? items.map(x=>String(x || "")) : [];
    if(!list.length) return `<div class="recentEmpty muted small">${emptyLabel}</div>`;
    const dataAttr = kind === "dealer" ? "dealer" : "area";
    const current = String(currentValue || "").trim();
    return `
      <div class="areachips" id="${containerId}">
        ${list.map((item, idx)=>{
          const val = String(item || "").trim();
          const on = !!val && (kind === "dealer"
            ? current.toLowerCase() === val.toLowerCase()
            : current === val);
          const label = val || "Select";
          return `<button class="areachip chip-selector${on ? " on" : ""}" type="button" data-${dataAttr}="${escapeHtml(val)}" data-chip-index="${idx}">${escapeHtml(label)}</button>`;
        }).join("")}
      </div>
    `;
  }

  function renderTopAreaChips(topAreas, currentArea, containerId){
    return renderTopChips({ items: topAreas, currentValue: currentArea, containerId, kind: "area", emptyLabel: "No recent areas yet — choose from Area list below" });
  }

  function renderTopDealerChips(topDealers, currentDealer, containerId){
    return renderTopChips({ items: topDealers, currentValue: currentDealer, containerId, kind: "dealer", emptyLabel: "No recent dealers yet — choose from Dealer list below" });
  }

  function getQuickChipSettings(){
    const state = getState();
    const settings = state.settings || (state.settings = {});
    return (settings.quickChips && typeof settings.quickChips === "object") ? settings.quickChips : (settings.quickChips = {});
  }

  function getPinnedQuickChipKey(kind){
    return kind === "dealer" ? "dealerPinned" : "areaPinned";
  }

  function getPinnedQuickChipValues(kind, { seedItems = [], limit = 0 } = {}){
    const max = Number.isFinite(Number(limit)) ? Math.max(0, Number(limit)) : 0;
    const settings = getQuickChipSettings();
    const key = getPinnedQuickChipKey(kind);
    const seedFromTrips = getLastUniqueFromTrips(kind, Math.max(3, max || 0));
    const fromSource = Array.isArray(seedItems) ? seedItems : [];
    const cleaned = dedupeChipValues(kind, [...(Array.isArray(settings[key]) ? settings[key] : []), ...fromSource, ...seedFromTrips]);
    const nextValues = max > 0 ? cleaned.slice(0, max) : cleaned;
    const changed = JSON.stringify(Array.isArray(settings[key]) ? settings[key] : []) !== JSON.stringify(nextValues);
    settings[key] = nextValues;
    if(changed) saveState();
    return nextValues;
  }

  function getQuickChipChoices(kind){
    const fromTrips = getLastUniqueFromTrips(kind, 30);
    const state = getState();
    const fromState = (kind === "dealer") ? (Array.isArray(state.dealers) ? state.dealers : []) : (Array.isArray(state.areas) ? state.areas : []);
    const seen = new Set();
    const out = [];
    for(const raw of [...fromTrips, ...fromState]){
      const v = normalizeChipValue(raw);
      if(!v) continue;
      const key = normalizeKey(v);
      if(seen.has(key)) continue;
      seen.add(key);
      out.push(v);
    }
    return out;
  }

  function resolveQuickChipItems(kind, sourceItems, limit){
    const max = Number.isFinite(Number(limit)) ? Math.max(0, Number(limit)) : 0;
    const choices = getQuickChipChoices(kind);
    const seeded = getPinnedQuickChipValues(kind, { seedItems: sourceItems, limit: max });
    const merged = dedupeChipValues(kind, [...seeded, ...choices]);
    if(max > 0) return merged.slice(0, max);
    return merged;
  }

  function bindQuickChips(containerId, dataAttr, onPick){
    const el = document.getElementById(containerId);
    if(!el) return;
    el.addEventListener("click", (e)=>{
      const btn = e.target && e.target.closest && e.target.closest(`button[data-${dataAttr}]`);
      if(!btn) return;
      if(btn.__suppressNextClick){
        btn.__suppressNextClick = false;
        e.preventDefault();
        e.stopPropagation();
        if(typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
        return;
      }
      const value = String(btn.getAttribute(`data-${dataAttr}`) || "").trim();
      if(!value) return;
      onPick(value);
    });
  }

  function bindAreaChips(containerId, onPick){
    bindQuickChips(containerId, "area", onPick);
  }

  return {
    renderTopAreaChips,
    renderTopDealerChips,
    resolveQuickChipItems,
    bindQuickChips,
    bindAreaChips
  };
}
