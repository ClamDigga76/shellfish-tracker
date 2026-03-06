export const THEME_MODE_SYSTEM = "system";
export const THEME_MODE_LIGHT = "light";
export const THEME_MODE_DARK = "dark";

const THEME_MODES = new Set([THEME_MODE_SYSTEM, THEME_MODE_LIGHT, THEME_MODE_DARK]);

export function normalizeThemeMode(value){
  const mode = String(value || "").toLowerCase();
  return THEME_MODES.has(mode) ? mode : THEME_MODE_SYSTEM;
}

export function resolveTheme(mode, prefersDark){
  const normalized = normalizeThemeMode(mode);
  if(normalized === THEME_MODE_LIGHT) return THEME_MODE_LIGHT;
  if(normalized === THEME_MODE_DARK) return THEME_MODE_DARK;
  return prefersDark ? THEME_MODE_DARK : THEME_MODE_LIGHT;
}
