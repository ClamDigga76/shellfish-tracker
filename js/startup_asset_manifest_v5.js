export const STARTUP_MODULE_PATHS = [
  "./utils_v5.js",
  "./settings.js",
  "./migrations_v5.js",
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
  "./feedback_seam_v5.js",
  "./trip_screen_orchestrator_v5.js",
  "./trip_flow_save_seam_v5.js",
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

export const SW_REGISTRATION_PATH = "./sw.js";

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
