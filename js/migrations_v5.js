export const LS_KEY = "shellfish-state";
export const LEGACY_KEYS = ["shellfish-v1.5.0", "shellfish-v1.4.2"];

export function buildDefaultAppState() {
  return {
    trips: [],
    deletedTrips: [],
    areas: [],
    dealers: [],
    view: "home",
    filter: "YTD",
    homeFilter: { mode: "YTD", from: "", to: "" },
    tripsFilter: { mode: "ALL", from: "", to: "" },
    reportsFilter: { mode: "YTD", from: "", to: "" },
    reportsMode: "tables",
    settings: {},
    navStack: []
  };
}

export function parseSemverKey(key) {
  const m = /^shellfish-v(\d+)\.(\d+)\.(\d+)$/.exec(key || "");
  if (!m) return null;
  return { key, v: [Number(m[1]), Number(m[2]), Number(m[3])] };
}

export function pickBestLegacyKey(storage = localStorage) {
  const found = [];
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    const pv = parseSemverKey(k);
    if (pv) found.push(pv);
  }
  found.sort((a, b) => (a.v[0] - b.v[0]) || (a.v[1] - b.v[1]) || (a.v[2] - b.v[2]));
  if (found.length) return found[found.length - 1].key;
  for (const k of LEGACY_KEYS) if (storage.getItem(k)) return k;
  return null;
}

export function migrateLegacyStateIfNeeded(storage = localStorage) {
  try {
    if (storage.getItem(LS_KEY)) return;
    const legacyKey = pickBestLegacyKey(storage);
    if (!legacyKey) return;
    const raw = storage.getItem(legacyKey);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return;

    parsed.settings = parsed.settings && typeof parsed.settings === "object" ? parsed.settings : {};
    parsed.settings.migratedFrom = legacyKey;
    parsed.settings.migratedAt = new Date().toISOString();

    storage.setItem(LS_KEY, JSON.stringify(parsed));
  } catch {
    // Best-effort: never crash app boot because of migration.
  }
}

export function migrateStateIfNeeded(st, { normalizeTrip, normalizeThemeMode, themeModeDefault }) {
  try {
    const defaults = buildDefaultAppState();
    const parsedState = (st && typeof st === "object") ? st : {};
    st = { ...defaults, ...parsedState };
    const v = Number(st.schemaVersion || 0);

    if (!Array.isArray(st.trips)) st.trips = [];
    st.trips = st.trips.map(normalizeTrip).filter(Boolean);

    if (!Array.isArray(st.deletedTrips)) st.deletedTrips = [];
    st.deletedTrips = st.deletedTrips.map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const trip = normalizeTrip(entry.trip);
      if (!trip) return null;
      return {
        id: String(entry.id || trip.id || ""),
        trip,
        tripId: String(entry.tripId || trip.id || ""),
        deletedAt: String(entry.deletedAt || "")
      };
    }).filter(Boolean);

    st.homeFilter = { ...defaults.homeFilter, ...((st.homeFilter && typeof st.homeFilter === "object") ? st.homeFilter : {}) };
    if (st.filter && (!st.homeFilter.mode || st.homeFilter.mode === "")) {
      const m = String(st.filter || "YTD").toUpperCase();
      st.homeFilter.mode = (m.includes("MONTH") ? "MONTH" : (m.includes("7") ? "7D" : (m.includes("ALL") ? "ALL" : "YTD")));
    }

    st.reportsFilter = { ...defaults.reportsFilter, ...((st.reportsFilter && typeof st.reportsFilter === "object") ? st.reportsFilter : {}) };
    if (!st.reportsMode) st.reportsMode = "tables";

    if (st.filters && typeof st.filters === "object" && st.filters.active && typeof st.filters.active === "object") {
      st.filters.active.range = st.filters.active.range || "ytd";
      if (st.filters.active.dealer == null) st.filters.active.dealer = "all";
      if (st.filters.active.area == null) st.filters.active.area = "all";
      if (st.filters.active.species == null) st.filters.active.species = "all";
      if (st.filters.active.fromISO == null) st.filters.active.fromISO = "";
      if (st.filters.active.toISO == null) st.filters.active.toISO = "";
    }

    st.tripsFilter = { ...defaults.tripsFilter, ...((st.tripsFilter && typeof st.tripsFilter === "object") ? st.tripsFilter : {}) };

    st.settings = (st.settings && typeof st.settings === "object") ? st.settings : {};
    st.settings.themeMode = normalizeThemeMode(st.settings.themeMode || themeModeDefault);

    if (v < 1) st.schemaVersion = 1;
    return st;
  } catch (_e) {
    try { st.schemaVersion = st.schemaVersion || 1; } catch (_) {}
    return st;
  }
}

export function loadStateWithLegacyFallback(
  storage = localStorage,
  ensureNavStateFn = (s)=>s,
  buildStateFn = buildDefaultAppState
) {
  const fallback = ensureNavStateFn(buildStateFn());

  try {
    const tryKeys = [LS_KEY, pickBestLegacyKey(storage), ...LEGACY_KEYS].filter(Boolean);
    let raw = null;
    for (const k of tryKeys) {
      raw = storage.getItem(k);
      if (raw) break;
    }
    if (!raw) return fallback;

    const p = JSON.parse(raw);
    const merged = (p && typeof p === "object")
      ? { ...buildStateFn(), ...p }
      : buildStateFn();
    return ensureNavStateFn(merged);
  } catch {
    return fallback;
  }
}
