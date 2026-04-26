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
const { computeAggregatePPL } = utilsModule;
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

assertRepoCheck(homeDashboardSource.includes('rows.reduce((s, t) => s + (Number(t?.amount) || 0), 0)'), 'home totals still aggregate trip.amount');

const reportsAggregationSource = readFileSync('js/reports_aggregation_v5.js', 'utf8');
assertRepoCheck(reportsAggregationSource.includes('const amt = Number(t?.amount) || 0;'), 'reports aggregation amt still reads trip.amount');

assertRepoCheck(utilsSource.includes('String(to2(t.amount)),'), 'CSV export Amount column still uses trip.amount');
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

const formatPercentNumberForCheck = (percentValue) => {
  const absPercent = Math.abs(Number(percentValue) || 0);
  const rounded = absPercent < 10
    ? Math.round(absPercent * 10) / 10
    : Math.round(absPercent);
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace(/\.0$/, '');
};
const formatSignedPercentFromRatioForCheck = (ratioValue) => {
  const signedPercent = (Number(ratioValue) || 0) * 100;
  const sign = signedPercent > 0 ? '+' : (signedPercent < 0 ? '-' : '');
  return `${sign}${formatPercentNumberForCheck(signedPercent)}%`;
};
assertRepoCheck(formatSignedPercentFromRatioForCheck(0.004) === '+0.4%', 'reports percent formatter keeps +0.004 as +0.4%');
assertRepoCheck(formatSignedPercentFromRatioForCheck(-0.004) === '-0.4%', 'reports percent formatter keeps -0.004 as -0.4%');
assertRepoCheck(formatSignedPercentFromRatioForCheck(0.006) === '+0.6%', 'reports percent formatter keeps +0.006 as +0.6%');
assertRepoCheck(formatSignedPercentFromRatioForCheck(0.03) === '+3%', 'reports percent formatter trims trailing .0 for +0.03');
assertRepoCheck(formatSignedPercentFromRatioForCheck(0.099) === '+9.9%', 'reports percent formatter keeps +0.099 as +9.9%');
assertRepoCheck(formatSignedPercentFromRatioForCheck(0.124) === '+12%', 'reports percent formatter rounds +0.124 to +12%');

const decimalPercentTokenRe = /([+-]?\d+(?:\.\d+)?%)/g;
const emphasizedPercentMatches = '3% +3% -3% 3.5% +1.2% -0.6%'.match(decimalPercentTokenRe) || [];
assertRepoCheck(
  emphasizedPercentMatches.join('|') === '3%|+3%|-3%|3.5%|+1.2%|-0.6%',
  'reports percent emphasis regex matches integer and decimal percent tokens'
);

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
