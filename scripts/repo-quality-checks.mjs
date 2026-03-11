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
