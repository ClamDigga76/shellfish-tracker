#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { SW_CORE_JS_PATHS } from "../js/startup_asset_manifest_v5.js";

export const SW_CORE_GENERATED_START_MARKER = "// BEGIN GENERATED: CORE_JS_PATHS (from js/startup_asset_manifest_v5.js)";
export const SW_CORE_GENERATED_END_MARKER = "// END GENERATED: CORE_JS_PATHS";

export function buildSwCoreJsPaths(swCorePaths = SW_CORE_JS_PATHS) {
  return swCorePaths.map((relPath) => `./js/${String(relPath).replace(/^\.\//, "")}`);
}

export function buildGeneratedSwCoreJsBlock(swCorePaths = SW_CORE_JS_PATHS) {
  const swPaths = buildSwCoreJsPaths(swCorePaths);
  const lines = [
    SW_CORE_GENERATED_START_MARKER,
    "const CORE_JS_PATHS = [",
    ...swPaths.map((swPath) => `  \"${swPath}\",`),
    "];",
    SW_CORE_GENERATED_END_MARKER,
  ];
  return `${lines.join("\n")}\n`;
}

export function syncSwCoreJsPaths(swPath = "sw.js") {
  const root = process.cwd();
  const fullPath = path.join(root, swPath);
  const swJs = readFileSync(fullPath, "utf8");

  const start = SW_CORE_GENERATED_START_MARKER;
  const end = SW_CORE_GENERATED_END_MARKER;
  const markerRegex = new RegExp(`${escapeRegex(start)}[\\s\\S]*?${escapeRegex(end)}\\n?`);

  if (!markerRegex.test(swJs)) {
    throw new Error(`Could not find generated block markers in ${swPath}`);
  }

  const generatedBlock = buildGeneratedSwCoreJsBlock();
  const next = swJs.replace(markerRegex, generatedBlock);

  if (next !== swJs) {
    writeFileSync(fullPath, next, "utf8");
  }

  return { changed: next !== swJs, entries: SW_CORE_JS_PATHS.length, swPath };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isMainModule() {
  if (!process.argv[1]) return false;
  return path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isMainModule()) {
  const result = syncSwCoreJsPaths();
  const status = result.changed ? "updated" : "already up to date";
  console.log(`sync-sw-core-js-from-manifest: ${status} (${result.entries} entries)`);
}
