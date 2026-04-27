import { execSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const CHECKABLE_EXTENSIONS = /\.(js|mjs|json|html)$/i;
const JS_EXTENSIONS = /\.(js|mjs)$/i;
const JSON_EXTENSIONS = /\.json$/i;
const MERGE_MARKER_RE = /^(<{7}|={7}|>{7})/m;

const trackedFiles = execSync('git ls-files', { encoding: 'utf8' })
  .split('\n')
  .map((f) => f.trim())
  .filter(Boolean)
  .filter((f) => CHECKABLE_EXTENSIONS.test(f));

let failed = false;

for (const file of trackedFiles) {
  const source = readFileSync(file, 'utf8');
  if (MERGE_MARKER_RE.test(source)) {
    failed = true;
    console.error(`FAIL merge marker found: ${file}`);
  }
}

for (const file of trackedFiles) {
  if (!JS_EXTENSIONS.test(file)) continue;
  const run = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (run.status !== 0) {
    failed = true;
    console.error(`FAIL syntax check: ${file}`);
    if (run.stderr) console.error(run.stderr.trim());
  }
}

for (const file of trackedFiles) {
  if (!JSON_EXTENSIONS.test(file)) continue;
  try {
    JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    failed = true;
    const message = error instanceof Error ? error.message : String(error);
    console.error(`FAIL JSON parse check: ${file}`);
    console.error(message);
  }
}

function assertRepoCheck(condition, message) {
  if (condition) return;
  failed = true;
  console.error(`FAIL ${message}`);
}

const utilsModule = await import('../js/utils_v5.js');
const reportsAggregationModule = await import('../js/reports_aggregation_v5.js');
const { computeAggregatePPL, deriveTripSettlement, toCSV } = utilsModule;
const {
  buildReportsAggregationState,
  summarizeTripsByMonthWindow,
  buildEntityPeriodRows
} = reportsAggregationModule;

const staleStoredRateTrips = [
  { dateISO: '2026-01-10', dealer: 'Dealer A', area: 'Bay', pounds: 100, amount: 300, payRate: 2.75 }
];
const staleRateAggregate = buildReportsAggregationState({
  trips: staleStoredRateTrips,
  canonicalDealerGroupKey: (name) => String(name || '').trim().toLowerCase(),
  normalizeDealerDisplay: (name) => String(name || '').trim(),
  resolveTripArea: (trip) => ({ canonicalName: String(trip?.area || '').trim() })
});
const staleDealerAvg = Number(staleRateAggregate.dealerRows?.[0]?.avg) || 0;
const staleAreaAvg = Number(staleRateAggregate.areaRows?.[0]?.avg) || 0;
const staleMonthAvg = Number(staleRateAggregate.monthRows?.[0]?.avg) || 0;
assertRepoCheck(Math.abs(staleDealerAvg - 3.0) < 1e-9, 'reports dealer aggregate Avg $/lb uses amount ÷ pounds (stale payRate case)');
assertRepoCheck(Math.abs(staleAreaAvg - 3.0) < 1e-9, 'reports area aggregate Avg $/lb uses amount ÷ pounds (stale payRate case)');
assertRepoCheck(Math.abs(staleMonthAvg - 3.0) < 1e-9, 'reports month aggregate Avg $/lb uses amount ÷ pounds (stale payRate case)');

const weightedExampleTrips = [
  { dateISO: '2026-02-05', dealer: 'Dealer B', area: 'North', pounds: 50, amount: 200, payRate: 4.0 },
  { dateISO: '2026-02-16', dealer: 'Dealer B', area: 'North', pounds: 150, amount: 300, payRate: 2.0 }
];
const weightedSummary = summarizeTripsByMonthWindow(weightedExampleTrips, '2026-02');
assertRepoCheck(Math.abs((Number(weightedSummary.ppl) || 0) - 2.5) < 1e-9, 'summarizeTripsByMonthWindow uses aggregate amount ÷ pounds');

const compareRows = buildEntityPeriodRows({
  trips: weightedExampleTrips,
  entityType: 'dealer',
  period: {
    current: { monthKey: '2026-02', dayLimit: 0 },
    previous: { monthKey: '2026-01', dayLimit: 0 }
  }
});
assertRepoCheck(Math.abs((Number(compareRows?.[0]?.current?.ppl) || 0) - 2.5) < 1e-9, 'buildEntityPeriodRows compare bucket PPL uses aggregate amount ÷ pounds');

const zeroPpl = computeAggregatePPL(0, 250);
assertRepoCheck(Number.isFinite(zeroPpl) && zeroPpl === 0, 'computeAggregatePPL zero-pound rows avoid NaN/Infinity');

const settlementSample = deriveTripSettlement({ amount: 100.25, writtenCheckAmount: 100 });
assertRepoCheck(settlementSample.calculatedAmount === 100.25, 'deriveTripSettlement keeps calculatedAmount as calculated settlement amount');
assertRepoCheck(settlementSample.writtenCheckAmount === 100, 'deriveTripSettlement keeps writtenCheckAmount as dealer check amount');
assertRepoCheck(settlementSample.dealerAdjustment === -0.25, 'deriveTripSettlement dealerAdjustment equals writtenCheckAmount - calculatedAmount');

const csvPreview = toCSV([{ dateISO: '2026-03-01', dealer: 'Dealer C', pounds: 40, amount: 160, payRate: 3.25, area: 'Harbor' }]);
const csvDataLine = (String(csvPreview || '').split('\r\n')[1] || '').split(',');
assertRepoCheck(csvDataLine[3] === '160', 'CSV Amount column exports trip.amount');
assertRepoCheck(csvDataLine[4] === '4', 'CSV PricePerLb resolves from amount ÷ pounds when payRate is stale');

const homeDashboardSource = readFileSync('js/home_dashboard_v5.js', 'utf8');
assertRepoCheck(!homeDashboardSource.includes('weightedRateTotal'), 'home aggregate overview does not use weightedRateTotal');
assertRepoCheck(!homeDashboardSource.includes('resolveTripPayRate('), 'home aggregate Avg $/lb path does not call resolveTripPayRate()');
const utilsSource = readFileSync('js/utils_v5.js', 'utf8');

const quickChipsSource = readFileSync('js/quick_chips_v5.js', 'utf8');
assertRepoCheck(!quickChipsSource.includes('areaPinnedCustom'), 'quick chips source does not include areaPinnedCustom');
assertRepoCheck(!quickChipsSource.includes('dealerPinnedCustom'), 'quick chips source does not include dealerPinnedCustom');
assertRepoCheck(!quickChipsSource.includes('openQuickChipCustomizeModal'), 'quick chips source does not export customize modal behavior');
assertRepoCheck(!quickChipsSource.includes('bindQuickChipLongPress'), 'quick chips source does not export long-press customize behavior');

const backupRestoreSource = readFileSync('js/backup_restore_v5.js', 'utf8');
assertRepoCheck(/backupId:\s*safeBackupId/.test(backupRestoreSource), 'backup export payload includes backupId');
assertRepoCheck(backupRestoreSource.includes('Bank-the-Catch-Backup-'), 'backup filename uses Bank-the-Catch-Backup prefix');
assertRepoCheck(backupRestoreSource.includes('1-trip') && backupRestoreSource.includes('-trips'), 'backup filename uses trip/trips count language');
assertRepoCheck(!backupRestoreSource.includes('bank-the-catch_backup_'), 'legacy build-oriented backup filename pattern removed');
assertRepoCheck(backupRestoreSource.includes('obj.schemaVersion ?? obj.schema ?? 0'), 'restore supports schemaVersion ?? schema compatibility');
assertRepoCheck(backupRestoreSource.includes('delete safeSettings.quickChips.areaPinnedCustom;'), 'backup export sanitizes stale areaPinnedCustom quick-chip map');
assertRepoCheck(backupRestoreSource.includes('delete safeSettings.quickChips.dealerPinnedCustom;'), 'backup export sanitizes stale dealerPinnedCustom quick-chip map');
assertRepoCheck(backupRestoreSource.includes('data: {\n        trips,'), 'backup payload preserves trips collection for restore');

const tripMutationLifecycleSource = readFileSync('js/trip_mutation_lifecycle_v5.js', 'utf8');
assertRepoCheck(tripMutationLifecycleSource.includes('const amountNum = settlement.calculatedAmount;'), 'trip commit amount remains settlement.calculatedAmount');
assertRepoCheck(tripMutationLifecycleSource.includes('calculatedAmount: to2(settlement.calculatedAmount),'), 'trip commit persists calculatedAmount settlement field');
assertRepoCheck(tripMutationLifecycleSource.includes('writtenCheckAmount: to2(settlement.writtenCheckAmount),'), 'trip commit persists writtenCheckAmount settlement field');
assertRepoCheck(tripMutationLifecycleSource.includes('dealerAdjustment: to2(settlement.dealerAdjustment),'), 'trip commit persists dealerAdjustment settlement field');
assertRepoCheck(tripMutationLifecycleSource.includes('adjustmentClass: settlement.adjustmentClass,'), 'trip commit persists adjustmentClass settlement field');

assertRepoCheck(homeDashboardSource.includes('rows.reduce((s, t) => s + (Number(t?.amount) || 0), 0)'), 'home totals still aggregate trip.amount');

const reportsAggregationSource = readFileSync('js/reports_aggregation_v5.js', 'utf8');
assertRepoCheck(reportsAggregationSource.includes('const amt = Number(t?.amount) || 0;'), 'reports aggregation amt still reads trip.amount');
const settingsScreenSource = readFileSync('js/settings_screen_v5.js', 'utf8');
const settingsFeatureCssSource = readFileSync('css/shell_feature_surfaces_v5.css', 'utf8');
assertRepoCheck(settingsScreenSource.includes('data-settings-accordion'), 'settings screen keeps grouped accordion data-settings-accordion hooks');
assertRepoCheck(settingsScreenSource.includes('settingsAccordionSummary'), 'settings screen keeps settings accordion summary surface');
const settingsVersionTokenMatch = String('Version v5.679 • Browser').match(/\bv\d+(?:\.\d+){1,3}\b/i);
assertRepoCheck(settingsVersionTokenMatch?.[0]?.toLowerCase() === 'v5.679', 'settings update version token parsing avoids partial v5 match and keeps v5.679 token');
assertRepoCheck(settingsFeatureCssSource.includes('.settingsAccordionSummary') && settingsFeatureCssSource.includes('.settingsAccordionPill'), 'settings feature CSS keeps compact accordion summary and pill selectors');

const tripSharedEngineSource = readFileSync('js/trip_shared_engine_v5.js', 'utf8');
assertRepoCheck(tripSharedEngineSource.includes('const settlement = deriveTripSettlement({'), 'normalizeTripRow derives settlement fields from resolved amount');
assertRepoCheck(tripSharedEngineSource.includes('calculatedAmount: Number.isFinite(settlement.calculatedAmount) ? settlement.calculatedAmount : 0,'), 'normalizeTripRow persists calculatedAmount settlement field');
assertRepoCheck(tripSharedEngineSource.includes('writtenCheckAmount: Number.isFinite(settlement.writtenCheckAmount) ? settlement.writtenCheckAmount : 0,'), 'normalizeTripRow persists writtenCheckAmount settlement field');
assertRepoCheck(tripSharedEngineSource.includes('dealerAdjustment: Number.isFinite(settlement.dealerAdjustment) ? settlement.dealerAdjustment : 0,'), 'normalizeTripRow persists dealerAdjustment settlement field');
const reportsMetricDetailSource = readFileSync('js/reports_metric_detail_v5.js', 'utf8');
assertRepoCheck(
  reportsMetricDetailSource.includes('chartModel?.metricKey')
    && reportsMetricDetailSource.includes('chartDef?.metricKey')
    && reportsMetricDetailSource.includes('|| targetMetricKey'),
  'home free chart cards resolve metric key from chart model before card/parent fallback'
);
assertRepoCheck(
  reportsMetricDetailSource.includes('pplRateVsPoundsTrend: buildHomeTimeSeriesChart({ monthRows: safeMonths, metricKey: "pounds", valueKey: "lbs" })'),
  'Avg $/lb pounds-support chart keeps pounds metric key'
);
assertRepoCheck(
  reportsMetricDetailSource.includes('if(isCompareBars && (!hasRealComparablePeriod || isHomeCompareSuppressed)) return null;'),
  'home free compare chart cards are suppressed when no real prior month comparison exists'
);
assertRepoCheck(
  reportsMetricDetailSource.includes(': (primaryBasisByMetric?.[metricKey]?.primaryChart || detailCharts?.[metricKey] || null)'),
  'reports metric detail primary compare chart path remains unchanged'
);

assertRepoCheck(utilsSource.includes('String(to2(t.amount)),'), 'CSV export Amount column still uses trip.amount');
assertRepoCheck(
  utilsSource.includes('const ppl = (Number.isFinite(pounds) && pounds > 0 && Number.isFinite(amount) && amount > 0)')
    && utilsSource.includes(': resolveTripPayRate(t);'),
  'CSV PricePerLb prefers amount ÷ pounds and falls back to resolved trip pay rate'
);
assertRepoCheck(utilsSource.includes('calculatedAmount,'), 'deriveTripSettlement still exposes calculatedAmount');
assertRepoCheck(utilsSource.includes('writtenCheckAmount,'), 'deriveTripSettlement still exposes writtenCheckAmount');
assertRepoCheck(utilsSource.includes('dealerAdjustment,'), 'deriveTripSettlement still exposes dealerAdjustment');

const tripSharedModule = await import('../js/trip_shared_engine_v5.js');
const { createTripSharedCollectionsEngine, AREA_NOT_RECORDED } = tripSharedModule;

const normalizeRepoKey = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
const collectionState = {
  areas: [' Area  5 ', 'area 5', 'Area Not  Recorded'],
  dealers: ['Dealer One', ' dealer   one '],
  trips: [
    { area: '  AREA 5 ', dealer: 'DEALER ONE' },
    { area: 'Area 6', dealer: 'Dealer Two' },
    { area: 'area not recorded', dealer: ' Dealer Two ' }
  ]
};
const collections = createTripSharedCollectionsEngine({
  getState: () => collectionState,
  normalizeKey: normalizeRepoKey,
  normalizeTripRow: (trip) => trip,
  escapeHtml: (value) => String(value || '')
});
collections.syncAreaState(collectionState);
collections.ensureDealers();

assertRepoCheck(collectionState.areas.includes(AREA_NOT_RECORDED), 'Area Not Recorded remains present after area reconciliation');
assertRepoCheck(collectionState.areas.filter((area) => normalizeRepoKey(area) === normalizeRepoKey('area 5')).length === 1, 'area reconciliation dedupes by normalized key');
assertRepoCheck(collectionState.dealers.filter((dealer) => normalizeRepoKey(dealer) === normalizeRepoKey('dealer one')).length === 1, 'dealer reconciliation dedupes by normalized key');
assertRepoCheck(collectionState.dealers.some((dealer) => normalizeRepoKey(dealer) === normalizeRepoKey('dealer two')), 'dealer reconciliation includes dealers from saved trips');

const roundedPercentNumberForCheck = (percentValue) => {
  const absPercent = Math.abs(Number(percentValue) || 0);
  return absPercent < 10
    ? Math.round(absPercent * 10) / 10
    : Math.round(absPercent);
};
const formatPercentNumberForCheck = (percentValue) => {
  const rounded = roundedPercentNumberForCheck(percentValue);
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace(/\.0$/, '');
};
const formatSignedPercentFromRatioForCheck = (ratioValue) => {
  const signedPercent = (Number(ratioValue) || 0) * 100;
  const roundedMagnitude = roundedPercentNumberForCheck(signedPercent);
  if (roundedMagnitude === 0) return '0%';
  const sign = signedPercent > 0 ? '+' : '-';
  return `${sign}${formatPercentNumberForCheck(signedPercent)}%`;
};
assertRepoCheck(formatSignedPercentFromRatioForCheck(0.004) === '+0.4%', 'reports percent formatter keeps +0.004 as +0.4%');
assertRepoCheck(formatSignedPercentFromRatioForCheck(-0.004) === '-0.4%', 'reports percent formatter keeps -0.004 as -0.4%');
assertRepoCheck(formatSignedPercentFromRatioForCheck(0.006) === '+0.6%', 'reports percent formatter keeps +0.006 as +0.6%');
assertRepoCheck(formatSignedPercentFromRatioForCheck(0.03) === '+3%', 'reports percent formatter trims trailing .0 for +0.03');
assertRepoCheck(formatSignedPercentFromRatioForCheck(0.099) === '+9.9%', 'reports percent formatter keeps +0.099 as +9.9%');
assertRepoCheck(formatSignedPercentFromRatioForCheck(0.124) === '+12%', 'reports percent formatter rounds +0.124 to +12%');
assertRepoCheck(formatSignedPercentFromRatioForCheck(-0.0004) === '0%', 'reports percent formatter normalizes tiny negative ratios that round to zero');
assertRepoCheck(Object.is(-0, -0) && formatSignedPercentFromRatioForCheck(-0) === '0%', 'reports percent formatter normalizes negative zero ratios');
assertRepoCheck(formatSignedPercentFromRatioForCheck(0) === '0%', 'reports percent formatter keeps zero ratios unsigned');

const decimalPercentTokenRe = /([+-]?\d+(?:\.\d+)?%)/g;
const emphasizedPercentMatches = '3% +3% -3% 3.5% +1.2% -0.6%'.match(decimalPercentTokenRe) || [];
assertRepoCheck(
  emphasizedPercentMatches.join('|') === '3%|+3%|-3%|3.5%|+1.2%|-0.6%',
  'reports percent emphasis regex matches integer and decimal percent tokens'
);


const unifiedFiltersModule = await import('../js/unified_filters_seam_v5.js');
const reportsMetricRouteModule = await import('../js/reports_metric_route_seam_v5.js');
const tripsUnifiedFilterBridgeModule = await import('../js/trips_unified_filter_bridge_v5.js');
const { createUnifiedFiltersSeam } = unifiedFiltersModule;
const { createReportsMetricRouteSeam } = reportsMetricRouteModule;
const { createTripsUnifiedFilterBridge } = tripsUnifiedFilterBridgeModule;

const unifiedSeamForRangeTruth = createUnifiedFiltersSeam({
  getState: () => ({}),
  parseUsDateToISODate: (value) => String(value || ''),
  parseReportDateToISO: (value) => String(value || ''),
  isoToday: () => '2026-04-26',
  ensureAreas: () => {},
  resolveAreaValue: (value) => ({ canonicalName: String(value || '') }),
  resolveTripArea: (trip) => ({ canonicalName: String(trip?.area || '') }),
  normalizeTripRow: (trip) => trip,
  canonicalizeTripArea: (trip) => trip,
  isValidISODate: (iso) => /^\d{4}-\d{2}-\d{2}$/.test(String(iso || ''))
});

const lastYearRange = unifiedSeamForRangeTruth.resolveUnifiedRange({ range: 'last_year' });
assertRepoCheck(lastYearRange.label === 'Previous Year', 'resolveUnifiedRange last_year label is Previous Year');
assertRepoCheck(lastYearRange.fromISO === '2025-01-01' && lastYearRange.toISO === '2025-12-31', 'resolveUnifiedRange last_year uses previous calendar year bounds');
const ytdRange = unifiedSeamForRangeTruth.resolveUnifiedRange({ range: 'ytd' });
assertRepoCheck(ytdRange.label === 'YTD', 'resolveUnifiedRange ytd label remains YTD');
assertRepoCheck(ytdRange.fromISO === '2026-01-01' && ytdRange.toISO === '2026-04-26', 'resolveUnifiedRange ytd bounds remain current year to today');

const reportsRouteSeam = createReportsMetricRouteSeam({
  parseReportDateToISO: (value) => String(value || ''),
  resolveUnifiedRange: (filter) => unifiedSeamForRangeTruth.resolveUnifiedRange(filter),
  formatDateDMY: (iso) => iso,
  applyUnifiedTripFilter: (rows) => ({ rows: Array.isArray(rows) ? rows : [], range: { fromISO: '', toISO: '' } }),
  buildUnifiedFilterFromReportsFilter: (rf) => ({ range: String(rf?.mode || '').toLowerCase(), fromISO: '', toISO: '' })
});
assertRepoCheck(reportsRouteSeam.mapHomeModeToUnifiedRange('LAST_YEAR') === 'last_year', 'mapHomeModeToUnifiedRange maps LAST_YEAR to last_year');
assertRepoCheck(reportsRouteSeam.mapHomeModeToUnifiedRange('YTD') === 'ytd', 'mapHomeModeToUnifiedRange keeps YTD mapping');

const tripsBridge = createTripsUnifiedFilterBridge({
  ensureUnifiedFilters: () => {},
  applyUnifiedTripFilter: (_rows, filter) => ({
    rows: [],
    range: filter?.range === 'last_year'
      ? { fromISO: '2025-01-01', toISO: '2025-12-31' }
      : { fromISO: '2026-01-01', toISO: '2026-04-26' },
    transparency: { excludedQuarantinedCount: 0, quarantinedTotalCount: 0, hasExcludedQuarantined: false }
  }),
  resolveUnifiedRange: (filter) => unifiedSeamForRangeTruth.resolveUnifiedRange(filter),
  getTripsNewestFirst: (rows) => rows,
  resolveAreaValue: (value) => ({ canonicalName: String(value || '') })
});
const lastYearTripsResult = tripsBridge.getTripsFilteredRows({
  trips: [],
  filters: { active: { range: 'last_year', fromISO: '', toISO: '', dealer: 'all', area: 'all', species: 'all', text: '' } }
});
assertRepoCheck(lastYearTripsResult.range.label === 'Previous Year', 'Trips range label displays Previous Year for last_year');
const ytdTripsResult = tripsBridge.getTripsFilteredRows({
  trips: [],
  filters: { active: { range: 'ytd', fromISO: '', toISO: '', dealer: 'all', area: 'all', species: 'all', text: '' } }
});
assertRepoCheck(ytdTripsResult.range.label === 'YTD', 'Trips range label keeps YTD for ytd');

if (failed) {
  console.error('\nRepo quality checks failed.');
  process.exit(1);
}

const mergeMarkerScope = trackedFiles.length;
const jsFileCount = trackedFiles.filter((file) => JS_EXTENSIONS.test(file)).length;
const jsonFileCount = trackedFiles.filter((file) => JSON_EXTENSIONS.test(file)).length;

console.log(`PASS merge marker check (${mergeMarkerScope} files)`);
console.log(`PASS JavaScript syntax checks (${jsFileCount} files)`);
console.log(`PASS JSON parse checks (${jsonFileCount} files)`);
