export function createQuickChipHelpers({
  getState,
  saveState,
  getLastUniqueFromTrips,
  normalizeKey,
  escapeHtml,
  openModal,
  closeModal,
  longPressMs,
  moveCancelPx
}){
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
    const quickChips = (settings.quickChips && typeof settings.quickChips === "object") ? settings.quickChips : (settings.quickChips = {});
    return quickChips;
  }

  function getPinnedQuickChipKey(kind){
    return kind === "dealer" ? "dealerPinned" : "areaPinned";
  }

  function getPinnedQuickChipValues(kind, { seedItems = [], limit = 0 } = {}){
    const max = Number.isFinite(Number(limit)) ? Math.max(0, Number(limit)) : 0;
    const settings = getQuickChipSettings();
    const key = getPinnedQuickChipKey(kind);
    const existing = settings[key];
    if(Array.isArray(existing)) return existing;

    const seedFromTrips = getLastUniqueFromTrips(kind, Math.max(3, max || 0));
    const fromSource = Array.isArray(seedItems) ? seedItems : [];
    const seeded = [];
    const seen = new Set();
    for(const raw of [...fromSource, ...seedFromTrips]){
      const value = String(raw || "").trim();
      if(!value) continue;
      const dedupeKey = kind === "dealer" ? normalizeKey(value) : value;
      if(seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      seeded.push(value);
      if(max > 0 && seeded.length >= max) break;
    }

    settings[key] = seeded;
    saveState();
    return settings[key];
  }

  function getCustomQuickChipKey(kind){
    return kind === "dealer" ? "dealerPinnedCustom" : "areaPinnedCustom";
  }

  function getCustomQuickChipMap(kind){
    const settings = getQuickChipSettings();
    const key = getCustomQuickChipKey(kind);
    const raw = settings[key];
    if(raw && typeof raw === "object" && !Array.isArray(raw)) return raw;
    settings[key] = {};
    saveState();
    return settings[key];
  }

  function setQuickChipMapping(kind, chipIndex, nextValue){
    const idx = Number(chipIndex);
    if(idx < 0) return;
    const value = String(nextValue || "").trim();
    if(!value) return;
    const quickChips = getQuickChipSettings();
    const key = getPinnedQuickChipKey(kind);
    const arr = Array.isArray(quickChips[key]) ? [...quickChips[key]] : [];
    arr[idx] = value;
    quickChips[key] = arr;
    const customMap = getCustomQuickChipMap(kind);
    customMap[idx] = true;
    saveState();
  }

  function getQuickChipChoices(kind){
    const fromTrips = getLastUniqueFromTrips(kind, 30);
    const state = getState();
    const fromState = (kind === "dealer") ? (Array.isArray(state.dealers) ? state.dealers : []) : (Array.isArray(state.areas) ? state.areas : []);
    const seen = new Set();
    const out = [];
    for(const raw of [...fromTrips, ...fromState]){
      const v = String(raw || "").trim();
      if(!v) continue;
      const key = (kind === "dealer") ? normalizeKey(v) : v;
      if(seen.has(key)) continue;
      seen.add(key);
      out.push(v);
    }
    return out;
  }

  function resolveQuickChipItems(kind, sourceItems, limit){
    const max = Number.isFinite(Number(limit)) ? Math.max(0, Number(limit)) : 0;
    const choices = getQuickChipChoices(kind);
    const pinned = getPinnedQuickChipValues(kind, { seedItems: sourceItems, limit: max });
    const customMap = getCustomQuickChipMap(kind);
    const len = max || pinned.length;
    const sourcePool = [];
    const sourceSeen = new Set();
    for(const raw of [...(Array.isArray(sourceItems) ? sourceItems : []), ...getLastUniqueFromTrips(kind, Math.max(len, 6)), ...choices]){
      const value = String(raw || "").trim();
      if(!value) continue;
      const dedupeKey = (kind === "dealer") ? normalizeKey(value) : value;
      if(sourceSeen.has(dedupeKey)) continue;
      sourceSeen.add(dedupeKey);
      sourcePool.push({ key: dedupeKey, value });
    }

    const out = [];
    const usedKeys = new Set();
    for(let i=0;i<len;i++){
      const isCustom = !!customMap[i];
      let picked = "";
      if(isCustom){
        const customCandidate = String(pinned[i] || "").trim();
        if(customCandidate){
          const customKey = (kind === "dealer") ? normalizeKey(customCandidate) : customCandidate;
          const canonical = choices.find(v=>((kind === "dealer") ? normalizeKey(v) : v) === customKey) || "";
          if(canonical && !usedKeys.has(customKey)){
            picked = canonical;
            usedKeys.add(customKey);
          }
        }
      }
      if(!picked){
        const fallback = sourcePool.find(item=>!usedKeys.has(item.key));
        if(fallback){
          picked = fallback.value;
          usedKeys.add(fallback.key);
        }
      }
      out.push(picked);
    }
    return out;
  }

  function openQuickChipCustomizeModal({ kind, chipIndex, currentValue, onSaved, choices: providedChoices }){
    const nice = (kind === "dealer") ? "Dealer" : "Area";
    const title = `Set ${nice} chip`;
    const rawChoices = Array.isArray(providedChoices) ? providedChoices : getQuickChipChoices(kind);
    const choices = [];
    const seen = new Set();
    for(const raw of rawChoices){
      const v = String(raw || "").trim();
      if(!v) continue;
      const key = (kind === "dealer") ? normalizeKey(v) : v;
      if(seen.has(key)) continue;
      seen.add(key);
      choices.push(v);
    }

    const uid = `${kind}_${Date.now()}`;
    const selectId = `quickChipSelect_${uid}`;
    const cancelId = `quickChipCancel_${uid}`;
    const saveId = `quickChipSave_${uid}`;
    const currentTrimmed = String(currentValue || "").trim();
    const currentNorm = (kind === "dealer") ? normalizeKey(currentTrimmed) : currentTrimmed;
    const hasCurrent = choices.some(v=>((kind === "dealer") ? normalizeKey(v) : v) === currentNorm);
    const options = [`<option value="">Select</option>`].concat(choices.map(v=>{
      const key = (kind === "dealer") ? normalizeKey(v) : v;
      const sel = (hasCurrent && key === currentNorm) ? "selected" : "";
      return `<option value="${escapeHtml(v)}" ${sel}>${escapeHtml(v)}</option>`;
    })).join("");

    openModal({
      title,
      backdropClose: false,
      escClose: true,
      showCloseButton: false,
      position: "center",
      html: `
        <div class="field">
          <label class="srOnly" for="${selectId}">${nice}</label>
          <select class="input" id="${selectId}">${options}</select>
        </div>
        <div class="modalActions">
          <button class="btn" id="${cancelId}" type="button">Cancel</button>
          <button class="btn primary" id="${saveId}" type="button" disabled>Save</button>
        </div>
      `,
      onOpen: ()=>{
        const elSelect = document.getElementById(selectId);
        const saveBtn = document.getElementById(saveId);

        if(elSelect) elSelect.value = hasCurrent ? currentTrimmed : "";

        const refreshSaveState = ()=>{
          if(!saveBtn || !elSelect) return;
          saveBtn.disabled = !String(elSelect.value || "").trim();
        };

        elSelect?.addEventListener("change", refreshSaveState);
        document.getElementById(cancelId)?.addEventListener("click", ()=>closeModal());
        document.getElementById(saveId)?.addEventListener("click", ()=>{
          const next = String(elSelect?.value || "").trim();
          if(!next) return;
          setQuickChipMapping(kind, chipIndex, next);
          closeModal();
          if(typeof onSaved === "function") onSaved(next);
        });

        refreshSaveState();
        setTimeout(()=>elSelect?.focus(), 50);
      }
    });
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

  function bindQuickChipLongPress(containerEl, onLongPressRelease){
    if(!containerEl || typeof onLongPressRelease !== "function") return;
    if(containerEl.__quickChipLongPressBound) return;
    containerEl.__quickChipLongPressBound = true;

    let pointerId = null;
    let timerId = null;
    let downX = 0;
    let downY = 0;
    let longPressArmed = false;
    let activeChip = null;

    const clearTimer = ()=>{
      if(timerId){
        clearTimeout(timerId);
        timerId = null;
      }
    };

    const cancelActive = ()=>{
      clearTimer();
      pointerId = null;
      longPressArmed = false;
      activeChip = null;
    };

    containerEl.addEventListener("pointerdown", (e)=>{
      const chip = e.target?.closest?.(".chip-selector");
      if(!chip || !containerEl.contains(chip)) return;
      if(typeof e.button === "number" && e.button !== 0) return;

      cancelActive();
      pointerId = e.pointerId;
      activeChip = chip;
      downX = Number(e.clientX || 0);
      downY = Number(e.clientY || 0);
      timerId = setTimeout(()=>{
        longPressArmed = true;
      }, longPressMs);
    });

    containerEl.addEventListener("pointermove", (e)=>{
      if(pointerId == null || e.pointerId !== pointerId || !activeChip) return;
      const dx = Math.abs(Number(e.clientX || 0) - downX);
      const dy = Math.abs(Number(e.clientY || 0) - downY);
      if(Math.max(dx, dy) > moveCancelPx){
        cancelActive();
      }
    });

    containerEl.addEventListener("pointerup", (e)=>{
      if(pointerId == null || e.pointerId !== pointerId) return;
      const chip = activeChip;
      const shouldTrigger = !!(chip && longPressArmed);
      cancelActive();
      if(!shouldTrigger) return;

      chip.__suppressNextClick = true;
      e.preventDefault();
      e.stopPropagation();
      if(typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
      onLongPressRelease(chip, e);
    });

    containerEl.addEventListener("pointercancel", (e)=>{
      if(pointerId == null || e.pointerId !== pointerId) return;
      cancelActive();
    });

    containerEl.addEventListener("contextmenu", (e)=>{
      const chip = e.target?.closest?.(".chip-selector");
      if(!chip || !containerEl.contains(chip)) return;
      e.preventDefault();
    });
  }

  return {
    renderTopAreaChips,
    renderTopDealerChips,
    resolveQuickChipItems,
    openQuickChipCustomizeModal,
    bindQuickChips,
    bindAreaChips,
    bindQuickChipLongPress
  };
}
