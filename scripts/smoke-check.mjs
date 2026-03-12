#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const checks = [];

function pass(name, detail = '') {
  checks.push({ ok: true, name, detail });
}

function fail(name, detail = '') {
  checks.push({ ok: false, name, detail });
}

function checkFileExists(relPath) {
  const fullPath = path.join(ROOT, relPath);
  if (existsSync(fullPath)) {
    pass(`file present: ${relPath}`);
  } else {
    fail(`file present: ${relPath}`);
  }
}

const requiredFiles = [
  'index.html',
  'sw.js',
  'manifest.webmanifest',
  'js/bootstrap_v5.js',
  'js/app_v5.js',
  'js/utils_v5.js',
  'js/settings.js',
];

for (const relPath of requiredFiles) {
  checkFileExists(relPath);
}

let indexHtml = '';
try {
  indexHtml = readFileSync(path.join(ROOT, 'index.html'), 'utf8');
} catch (error) {
  fail('read index.html', String(error.message || error));
}

if (indexHtml) {
  const bootstrapPattern = /<script\s+type="module"\s+src="\.\/js\/bootstrap_v5\.js\?v=(\d+)"\s*>\s*<\/script>/i;
  const bootstrapMatch = indexHtml.match(bootstrapPattern);

  if (bootstrapMatch) {
    pass('index bootstrap module loader versioned', `v=${bootstrapMatch[1]}`);
  } else {
    fail('index bootstrap module loader versioned', 'missing ./js/bootstrap_v5.js?v=<number>');
  }

  if (indexHtml.includes('manifest.webmanifest')) {
    pass('index manifest reference present');
  } else {
    fail('index manifest reference present');
  }
}

let passCount = 0;
let failCount = 0;

for (const item of checks) {
  if (item.ok) {
    passCount += 1;
    console.log(`PASS ${item.name}${item.detail ? ` (${item.detail})` : ''}`);
  } else {
    failCount += 1;
    console.error(`FAIL ${item.name}${item.detail ? ` (${item.detail})` : ''}`);
  }
}

if (failCount > 0) {
  console.error(`\nSmoke failed: ${failCount} failed, ${passCount} passed.`);
  process.exit(1);
}

console.log(`\nSmoke passed: ${passCount} checks.`);
