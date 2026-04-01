export function createReportsBindingsSeam(){
  function bindPresetRangeChips({ root, applyPrimaryReportsFilterSelection, saveState, showToast, renderReportsScreen, includeToast = false }){
    root?.querySelectorAll?.('.chip[data-rf]').forEach((btn)=>{
      btn.onclick = ()=>{
        const key = String(btn.getAttribute('data-rf') || 'YTD');
        applyPrimaryReportsFilterSelection(key);
        saveState();
        if(includeToast && typeof showToast === 'function') showToast('Filter updated');
        renderReportsScreen();
      };
    });
  }

  function bindEmptyStateActions({
    fMode,
    hasValidRange,
    hasSavedTrips,
    state,
    saveState,
    showToast,
    renderReportsScreen,
    renderApp
  }){
    const reportsEmptyPrimary = document.getElementById('reportsEmptyPrimary');
    if(reportsEmptyPrimary){
      reportsEmptyPrimary.onclick = ()=>{
        if(fMode === 'RANGE' && !hasValidRange){
          if(!state.reportsFilter) state.reportsFilter = {};
          state.reportsFilter.adv = true;
          saveState();
          renderReportsScreen();
          return;
        }
        state.view = 'new';
        saveState();
        showToast('Start with one trip');
        renderApp();
      };
    }

    const reportsEmptySecondary = document.getElementById('reportsEmptySecondary');
    if(reportsEmptySecondary){
      reportsEmptySecondary.onclick = ()=>{
        if((fMode === 'RANGE' && !hasValidRange) || !hasSavedTrips){
          state.helpJump = 'reports';
          state.view = 'help';
          saveState();
          renderApp();
          return;
        }
        if(!state.reportsFilter) state.reportsFilter = {};
        state.reportsFilter.mode = 'ALL';
        state.reportsFilter.from = '';
        state.reportsFilter.to = '';
        saveState();
        showToast('Filter updated');
        renderReportsScreen();
      };
    }
  }

  function bindReportsAdvancedPanelWrapper({ bindReportsAdvancedPanel, root, state, saveState, renderReports, showToast, variant }){
    bindReportsAdvancedPanel({
      root,
      state,
      saveState,
      renderReports,
      showToast,
      variant
    });
  }

  function bindSectionTabs({
    root,
    activeReportsSection,
    REPORTS_SECTION_ITEMS,
    queueReportsAnnouncement,
    queueReportsFocusIntent,
    runReportsTransition,
    state,
    saveState
  }){
    const tabs = root?.querySelectorAll?.('.chip[data-reports-section]') || [];
    tabs.forEach((btn)=>{
      btn.onclick = ()=>{
        const key = String(btn.getAttribute('data-reports-section') || 'insights').toLowerCase();
        if(key === activeReportsSection) return;
        const section = REPORTS_SECTION_ITEMS.find((item)=> item.key === key);
        queueReportsAnnouncement(`Reports section ${section?.label || 'updated'}.`);
        queueReportsFocusIntent({ type: 'section-tab', key });
        runReportsTransition({
          mutate: ()=>{
            state.reportsSection = key;
            saveState();
          }
        });
      };
    });

    tabs.forEach((btn)=>{
      btn.addEventListener('keydown', (event)=>{
        const tabList = Array.from(root.querySelectorAll('.chip[data-reports-section]'));
        const currentIdx = tabList.indexOf(btn);
        if(currentIdx === -1) return;
        if(event.key === 'ArrowRight' || event.key === 'ArrowLeft'){
          event.preventDefault();
          const direction = event.key === 'ArrowRight' ? 1 : -1;
          const nextIdx = (currentIdx + direction + tabList.length) % tabList.length;
          const nextTab = tabList[nextIdx];
          nextTab?.focus();
          nextTab?.click();
          return;
        }
        if(event.key === 'Home' || event.key === 'End'){
          event.preventDefault();
          const target = event.key === 'Home' ? tabList[0] : tabList[tabList.length - 1];
          target?.focus();
          target?.click();
          return;
        }
        if(event.key === 'Enter' || event.key === ' '){
          event.preventDefault();
          btn.click();
        }
      });
    });
  }

  function bindMetricDetailActions({
    root,
    queueReportsAnnouncement,
    queueReportsFocusIntent,
    runReportsTransition,
    state,
    saveState,
    isHomeMetricDetail,
    activeMetricDetail,
    renderApp
  }){
    const metricDetailButtons = root?.querySelectorAll?.('[data-metric-detail]') || [];
    metricDetailButtons.forEach((btn)=>{
      btn.onclick = ()=>{
        const metricName = String(btn.getAttribute('data-metric-detail') || 'metric').toLowerCase();
        queueReportsAnnouncement(`Opened ${metricName} metric detail in reports.`);
        queueReportsFocusIntent({ type: 'metric-back' });
        runReportsTransition({
          mutate: ()=>{
            state.reportsMetricDetail = String(btn.getAttribute('data-metric-detail') || '').toLowerCase();
            state.reportsMetricDetailContext = { source: 'reports' };
            state.homeMetricDetail = '';
            state.homeMetricDetailContext = null;
            saveState();
          }
        });
      };
    });

    const reportsMetricBack = document.getElementById('reportsMetricBack');
    if(reportsMetricBack){
      reportsMetricBack.onclick = ()=>{
        if(isHomeMetricDetail){
          queueReportsAnnouncement('Returned to Home from metric detail.');
          runReportsTransition({
            mutate: ()=>{
              state.homeMetricDetail = '';
              state.homeMetricDetailContext = null;
              state.view = 'home';
              saveState();
            },
            renderNext: ()=>{ renderApp(); }
          });
          return;
        }
        queueReportsAnnouncement('Returned to reports overview.');
        queueReportsFocusIntent({ type: 'metric-button', metricKey: activeMetricDetail });
        runReportsTransition({
          mutate: ()=>{
            state.reportsMetricDetail = '';
            state.reportsMetricDetailContext = null;
            saveState();
          }
        });
      };
    }
  }

  return {
    bindPresetRangeChips,
    bindEmptyStateActions,
    bindReportsAdvancedPanelWrapper,
    bindSectionTabs,
    bindMetricDetailActions
  };
}
