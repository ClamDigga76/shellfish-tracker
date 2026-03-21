export const LS_KEY = "shellfish-state";
export const LEGACY_KEYS = ["shellfish-v1.5.0", "shellfish-v1.4.2"];

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

export function migrateStateIfNeeded(st, { normalizeTrip, normalizeThemeMode, themeModeSystem }) {
  try {
    st = (st && typeof st === "object") ? st : {};
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

    if (!st.homeFilter || typeof st.homeFilter !== "object") {
      st.homeFilter = { mode: "YTD", from: "", to: "" };
    }
    if (st.filter && (!st.homeFilter.mode || st.homeFilter.mode === "")) {
      const m = String(st.filter || "YTD").toUpperCase();
      st.homeFilter.mode = (m.includes("MONTH") ? "MONTH" : (m.includes("7") ? "7D" : (m.includes("ALL") ? "ALL" : "YTD")));
    }

    if (!st.reportsFilter || typeof st.reportsFilter !== "object") {
      st.reportsFilter = { mode: "YTD", from: "", to: "" };
    }
    if (!st.reportsMode) st.reportsMode = "tables";

    if (st.filters && typeof st.filters === "object" && st.filters.active && typeof st.filters.active === "object") {
      st.filters.active.range = st.filters.active.range || "ytd";
      if (st.filters.active.dealer == null) st.filters.active.dealer = "all";
      if (st.filters.active.area == null) st.filters.active.area = "all";
      if (st.filters.active.species == null) st.filters.active.species = "all";
      if (st.filters.active.fromISO == null) st.filters.active.fromISO = "";
      if (st.filters.active.toISO == null) st.filters.active.toISO = "";
    }

    if (!st.tripsFilter || typeof st.tripsFilter !== "object") {
      st.tripsFilter = { mode: "ALL", from: "", to: "" };
    }

    st.settings = (st.settings && typeof st.settings === "object") ? st.settings : {};
    st.settings.themeMode = normalizeThemeMode(st.settings.themeMode || themeModeSystem);

    if (v < 1) st.schemaVersion = 1;
    return st;
  } catch (_e) {
    try { st.schemaVersion = st.schemaVersion || 1; } catch (_) {}
    return st;
  }
}

export function loadStateWithLegacyFallback(storage = localStorage, ensureNavStateFn = (s)=>s) {
  const fallback = ensureNavStateFn({
    trips: [],
    view: "home",
    filter: "YTD",
    settings: {},
    areas: [],
    dealers: [],
    navStack: [],
    tripsFilter: { mode: "ALL", from: "", to: "" },
    reportsFilter: { mode: "YTD", from: "", to: "" },
    deletedTrips: [],
  });

  try {
    const tryKeys = [LS_KEY, pickBestLegacyKey(storage), ...LEGACY_KEYS].filter(Boolean);
    let raw = null;
    for (const k of tryKeys) {
      raw = storage.getItem(k);
      if (raw) break;
    }
    if (!raw) return fallback;

    const p = JSON.parse(raw);
    return ensureNavStateFn({
      trips: Array.isArray(p?.trips) ? p.trips : [],
      view: p?.view || "home",
      filter: p?.filter || "YTD",
      settings: p?.settings && typeof p.settings === "object" ? p.settings : {},
      areas: Array.isArray(p?.areas) ? p.areas : [],
      dealers: Array.isArray(p?.dealers) ? p.dealers : [],
      navStack: Array.isArray(p?.navStack) ? p.navStack : [],
      tripsFilter: (p?.tripsFilter && typeof p.tripsFilter === "object") ? p.tripsFilter : { mode: "ALL", from: "", to: "" },
      reportsFilter: (p?.reportsFilter && typeof p.reportsFilter === "object") ? p.reportsFilter : { mode: "YTD", from: "", to: "" },
      deletedTrips: Array.isArray(p?.deletedTrips) ? p.deletedTrips : [],
    });
  } catch {
    return fallback;
  }
}
