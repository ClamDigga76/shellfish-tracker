import { normalizeThemeMode, resolveTheme, THEME_META_COLOR, THEME_SUSPENDED } from "./settings.js";

export function createThemeRuntimeSeam(){
  function getThemeMode(state){
    return normalizeThemeMode(state?.settings?.themeMode);
  }

  function updateThemeMeta(){
    try{
      const meta = document.querySelector('meta[name="theme-color"]');
      if(meta) meta.setAttribute("content", THEME_META_COLOR);
    }catch(_){ }
  }

  function applyThemeMode(state){
    const resolvedTheme = resolveTheme(getThemeMode(state));
    try{ document.documentElement.dataset.theme = resolvedTheme; }catch(_){ }
    updateThemeMeta();
    return {
      themeMode: resolvedTheme,
      suspended: THEME_SUSPENDED
    };
  }

  return {
    applyThemeMode
  };
}
