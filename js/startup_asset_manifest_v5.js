export const STARTUP_MODULE_PATHS = [
  "./utils_v5.js",
  "./settings.js",
  "./migrations_v5.js",
  "./entitlements_seam_v5.js",
  "./navigation_v5.js",
  "./reports_charts_v5.js",
  "./reports_aggregation_v5.js",
  "./reports_seasonality_v5.js",
  "./quick_chips_v5.js",
  "./reports_filters_v5.js",
  "./settings_list_management_v5.js",
  "./backup_restore_v5.js",
  "./trip_shared_engine_v5.js",
  "./trip_cards_v5.js",
  "./help_about_render_v5.js",
  "./trip_form_render_v5.js",
  "./home_dashboard_v5.js",
  "./settings_screen_v5.js",
  "./reports_screen_v5.js",
  "./chart_story_seam_v5.js",
  "./feedback_seam_v5.js",
  "./trip_screen_shared_helpers_v5.js",
  "./trip_screen_field_bindings_v5.js",
  "./trip_screen_orchestrator_v5.js",
  "./trips_browse_screen_v5.js",
  "./trip_flow_save_seam_v5.js",
  "./trip_mutation_lifecycle_v5.js",
  "./timeframe_filter_controls_seam_v5.js",
  "./unified_filters_seam_v5.js",
  "./root_state_save_seam_v5.js",
  "./update_runtime_status_v5.js",
  "./diagnostics_fatal_v5.js",
  "./runtime_orchestration_seam_v5.js",
  "./top_level_navigation_transition_seam_v5.js",
  "./app_shell_v5.js"
];

export const APP_ENTRY_MODULE_PATH = "./app_v5.js";

export const BOOTSTRAP_REQUIRED_ASSET_PATHS = [
  "./utils_v5.js",
  "./settings.js",
  "./migrations_v5.js",
  "./navigation_v5.js",
  APP_ENTRY_MODULE_PATH
];


// Startup-time modules intentionally loaded by app_v5.js at boot but app-owned
// (network-first), so they remain outside service worker core JS ownership.
export const STARTUP_APP_OWNED_MODULE_PATHS = [
  "./app_local_utils_v5.js",
  "./trips_unified_filter_bridge_v5.js",
  "./theme_runtime_seam_v5.js",
  "./ui_browser_helpers_v5.js"
];

// Service worker core JS ownership is declared here, then mirrored in sw.js and
// enforced by scripts/preflight-verify.mjs to prevent drift.
export const SW_CORE_JS_PATHS = [
  ...STARTUP_MODULE_PATHS,
  "./reports_compare_foundations_v5.js",
  "./reports_advanced_panel_v5.js",
  "./reports_highlights_v5.js",
  "./trip_card_renderer_core_v5.js",
  "./reports_chart_definitions_v5.js",
  APP_ENTRY_MODULE_PATH
];

// Startup-time app-owned modules stay explicitly excluded from SW core JS
// ownership to preserve current runtime/cache behavior.
export const SW_CORE_JS_EXCLUDED_PATHS = [
  ...STARTUP_APP_OWNED_MODULE_PATHS
];

export const SW_REGISTRATION_PATH = "./sw.js";

export const BOOTSTRAP_SANITY_REFERENCE_PATHS = [
  ...BOOTSTRAP_REQUIRED_ASSET_PATHS,
  SW_REGISTRATION_PATH
];

// Required startup/core cache truth used by service-worker trust diagnostics.
// Keep this as a single source of truth so diagnostics do not drift from
// startup/core ownership intent.
export const REQUIRED_CORE_CACHE_STATIC_PATHS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/shell_shared_v5.css",
  "./css/shell_feature_surfaces_v5.css",
  "./css/trip_form_v5.css",
  "./css/reports_v5.css",
  "./css/boot_shell_inline_extract_v1.css",
  "./js/boot_fallback_gate_v1.js",
  "./js/bootstrap_v5.js"
];

export const REQUIRED_CORE_CACHE_UNVERSIONED_PATHS = [
  "./",
  "./index.html"
];

export function buildRequiredCoreCachePaths(version) {
  const unversioned = new Set(REQUIRED_CORE_CACHE_UNVERSIONED_PATHS);
  const requiredStaticPaths = REQUIRED_CORE_CACHE_STATIC_PATHS.map((path) => (
    unversioned.has(path) ? path : buildVersionedPath(path, version)
  ));
  return [
    ...requiredStaticPaths,
    ...SW_CORE_JS_PATHS.map((path) => buildSwCoreVersionedAssetPath(path, version))
  ];
}

export function buildSwCoreVersionedAssetPath(path, version) {
  const normalizedPath = String(path || "").replace(/^\.\//, "");
  return buildVersionedPath(`./js/${normalizedPath}`, version);
}

export function buildVersionedAssetHref(path, version, baseUrl = import.meta.url) {
  const url = new URL(path, baseUrl);
  if (version) url.searchParams.set("v", String(version));
  return url.href;
}

export function buildVersionedAssetHrefList(paths, version, baseUrl = import.meta.url) {
  return paths.map((path) => buildVersionedAssetHref(path, version, baseUrl));
}

export function buildVersionedPath(path, version) {
  const normalizedPath = String(path || "");
  if (!version) return normalizedPath;
  const sep = normalizedPath.includes("?") ? "&" : "?";
  return `${normalizedPath}${sep}v=${encodeURIComponent(String(version))}`;
}
