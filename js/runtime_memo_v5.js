export function createFilteredRowsMemo(applyUnifiedTripFilter){
  let lastRowsSource = null;
  let lastFilterKey = "";
  let lastRows = [];

  return function getFilteredRows(rowsSource, unifiedFilter){
    const source = Array.isArray(rowsSource) ? rowsSource : [];
    const filterKey = JSON.stringify(unifiedFilter || {});
    if(source === lastRowsSource && filterKey === lastFilterKey){
      return lastRows;
    }
    const nextRows = applyUnifiedTripFilter(source, unifiedFilter).rows;
    lastRowsSource = source;
    lastFilterKey = filterKey;
    lastRows = Array.isArray(nextRows) ? nextRows : [];
    return lastRows;
  };
}

export function createRowsComputationMemo(compute){
  let lastRows = null;
  let lastValue = null;
  return function memoized(rows){
    const safeRows = Array.isArray(rows) ? rows : [];
    if(safeRows === lastRows && lastValue) return lastValue;
    lastRows = safeRows;
    lastValue = compute(safeRows);
    return lastValue;
  };
}
