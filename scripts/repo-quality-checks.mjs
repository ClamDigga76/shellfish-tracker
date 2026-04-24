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
