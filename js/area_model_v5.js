export function createAreaModel(deps = {}) {
  const { normalizeKey } = deps;

  function safeNormalizeKey(value) {
    return typeof normalizeKey === "function"
      ? String(normalizeKey(String(value || "")))
      : String(value || "").trim().toLowerCase();
  }

  function cleanName(value) {
    return String(value || "").trim();
  }

  function makeAreaId(nameOrKey) {
    const key = safeNormalizeKey(nameOrKey);
    if (!key) return "";
    return `area_${key.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "x"}`;
  }

  function normalizeAliases(values, canonicalName = "") {
    const canonicalKey = safeNormalizeKey(canonicalName);
    const out = [];
    const seen = new Set();
    for (const value of Array.isArray(values) ? values : []) {
      const alias = cleanName(value);
      const key = safeNormalizeKey(alias);
      if (!alias || !key || key === canonicalKey || seen.has(key)) continue;
      seen.add(key);
      out.push(alias);
    }
    return out;
  }

  function createRecord(input = {}) {
    const name = cleanName(input.name || input.displayName || input.canonicalName || "");
    const key = safeNormalizeKey(input.key || name);
    if (!name || !key) return null;
    return {
      id: cleanName(input.id) || makeAreaId(key),
      name,
      key,
      parentId: cleanName(input.parentId),
      level: cleanName(input.level),
      aliases: normalizeAliases(input.aliases, name)
    };
  }

  function buildAreaRegistry(rawRegistry, rawAreas = [], trips = []) {
    const sourceRecords = Array.isArray(rawRegistry?.records) ? rawRegistry.records : [];
    const byKey = new Map();
    const byAliasKey = new Map();

    function upsertRecord(rawRecord) {
      const record = createRecord(rawRecord);
      if (!record) return null;
      const existing = byKey.get(record.key);
      if (!existing) {
        byKey.set(record.key, record);
        for (const alias of record.aliases) byAliasKey.set(safeNormalizeKey(alias), record.key);
        return record;
      }
      existing.aliases = normalizeAliases([
        ...existing.aliases,
        ...(Array.isArray(record.aliases) ? record.aliases : []),
        record.name !== existing.name ? record.name : ""
      ], existing.name);
      if (!existing.parentId && record.parentId) existing.parentId = record.parentId;
      if (!existing.level && record.level) existing.level = record.level;
      for (const alias of existing.aliases) byAliasKey.set(safeNormalizeKey(alias), existing.key);
      return existing;
    }

    sourceRecords.forEach(upsertRecord);

    for (const areaName of Array.isArray(rawAreas) ? rawAreas : []) {
      const name = cleanName(areaName);
      const key = safeNormalizeKey(name);
      if (!name || !key) continue;
      const targetKey = byKey.has(key) ? key : byAliasKey.get(key);
      if (targetKey && byKey.has(targetKey)) continue;
      upsertRecord({ name });
    }

    for (const trip of Array.isArray(trips) ? trips : []) {
      const rawArea = cleanName(trip?.area);
      const key = safeNormalizeKey(rawArea);
      if (!rawArea || !key) continue;
      const areaId = cleanName(trip?.areaId);
      if (areaId) {
        const recordById = Array.from(byKey.values()).find((record) => record.id === areaId);
        if (recordById) {
          if (recordById.key !== key && !recordById.aliases.some((alias) => safeNormalizeKey(alias) === key)) {
            recordById.aliases = normalizeAliases([...recordById.aliases, rawArea], recordById.name);
            byAliasKey.set(key, recordById.key);
          }
          continue;
        }
      }
      const targetKey = byKey.has(key) ? key : byAliasKey.get(key);
      if (targetKey && byKey.has(targetKey)) continue;
      upsertRecord({ name: rawArea });
    }

    const records = Array.from(byKey.values())
      .map((record) => createRecord(record))
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      version: 1,
      records
    };
  }

  function indexAreaRegistry(registry) {
    const records = Array.isArray(registry?.records) ? registry.records : [];
    const byId = new Map();
    const byKey = new Map();
    const byAliasKey = new Map();
    for (const rawRecord of records) {
      const record = createRecord(rawRecord);
      if (!record) continue;
      byId.set(record.id, record);
      byKey.set(record.key, record);
      for (const alias of record.aliases) byAliasKey.set(safeNormalizeKey(alias), record);
    }
    return { byId, byKey, byAliasKey, records: Array.from(byKey.values()) };
  }

  function resolveAreaValue(value, registry) {
    const rawValue = cleanName(value);
    const key = safeNormalizeKey(rawValue);
    const indexed = indexAreaRegistry(registry);
    if (!rawValue || !key) {
      return { areaId: "", canonicalName: "", rawValue: "", key: "", matchedBy: "empty", record: null };
    }
    if (indexed.byId.has(rawValue)) {
      const record = indexed.byId.get(rawValue);
      return { areaId: record.id, canonicalName: record.name, rawValue, key: record.key, matchedBy: "id", record };
    }
    if (indexed.byKey.has(key)) {
      const record = indexed.byKey.get(key);
      return { areaId: record.id, canonicalName: record.name, rawValue, key: record.key, matchedBy: "key", record };
    }
    if (indexed.byAliasKey.has(key)) {
      const record = indexed.byAliasKey.get(key);
      return { areaId: record.id, canonicalName: record.name, rawValue, key: record.key, matchedBy: "alias", record };
    }
    return { areaId: "", canonicalName: rawValue, rawValue, key, matchedBy: "raw", record: null };
  }

  function syncAreaState(state) {
    const nextState = state && typeof state === "object" ? state : {};
    const registry = buildAreaRegistry(nextState.areaRegistry, nextState.areas, nextState.trips);
    nextState.areaRegistry = registry;
    nextState.areas = registry.records.map((record) => record.name);
    return registry;
  }

  function resolveTripArea(trip, registry) {
    const areaId = cleanName(trip?.areaId);
    if (areaId) {
      const resolvedById = resolveAreaValue(areaId, registry);
      if (resolvedById?.record) return resolvedById;
    }
    return resolveAreaValue(trip?.area, registry);
  }

  function canonicalizeTripArea(trip, registry) {
    const sourceTrip = trip && typeof trip === "object" ? { ...trip } : {};
    const resolved = resolveTripArea(sourceTrip, registry);
    if (!resolved.rawValue && !resolved.areaId) return sourceTrip;
    if (!resolved.record) {
      return {
        ...sourceTrip,
        area: resolved.canonicalName,
        areaId: cleanName(sourceTrip.areaId)
      };
    }
    return {
      ...sourceTrip,
      area: resolved.canonicalName,
      areaId: resolved.areaId
    };
  }

  function addCanonicalArea(state, rawName) {
    const name = cleanName(rawName);
    if (!name) return { ok: false, reason: "empty" };
    const registry = syncAreaState(state);
    const existing = resolveAreaValue(name, registry);
    if (existing.record) return { ok: true, record: existing.record, created: false };
    const nextRegistry = buildAreaRegistry(registry, [...(Array.isArray(state?.areas) ? state.areas : []), name], state?.trips);
    state.areaRegistry = nextRegistry;
    state.areas = nextRegistry.records.map((record) => record.name);
    const record = resolveAreaValue(name, nextRegistry).record;
    return { ok: !!record, record, created: true };
  }

  function mergeAreas(state, sourceId, targetId) {
    const registry = syncAreaState(state);
    const indexed = indexAreaRegistry(registry);
    const source = indexed.byId.get(cleanName(sourceId));
    const target = indexed.byId.get(cleanName(targetId));
    if (!source || !target || source.id === target.id) return { ok: false, reason: "invalid-merge" };
    const nextRecords = registry.records
      .filter((record) => record.id !== source.id)
      .map((record) => {
        if (record.id !== target.id) return createRecord(record);
        return createRecord({
          ...record,
          aliases: [...record.aliases, source.name, ...source.aliases]
        });
      })
      .filter(Boolean);
    state.areaRegistry = { version: 1, records: nextRecords };
    state.areas = nextRecords.map((record) => record.name);
    if (Array.isArray(state.trips)) {
      state.trips = state.trips.map((trip) => {
        const resolved = resolveTripArea(trip, registry);
        if (resolved.record?.id !== source.id) return canonicalizeTripArea(trip, state.areaRegistry);
        return { ...trip, area: target.name, areaId: target.id };
      });
    }
    return { ok: true, source, target: createRecord(target), registry: state.areaRegistry };
  }

  function countTripsForArea(state, areaId) {
    const registry = syncAreaState(state);
    const targetId = cleanName(areaId);
    const trips = Array.isArray(state?.trips) ? state.trips : [];
    let count = 0;
    for (const trip of trips) {
      const resolved = resolveTripArea(trip, registry);
      if (resolved.areaId && resolved.areaId === targetId) count += 1;
    }
    return count;
  }

  function deleteArea(state, areaId) {
    const registry = syncAreaState(state);
    const indexed = indexAreaRegistry(registry);
    const record = indexed.byId.get(cleanName(areaId));
    if (!record) return { ok: false, reason: "missing" };
    if (countTripsForArea(state, record.id) > 0) return { ok: false, reason: "in-use" };
    if (Array.isArray(record.aliases) && record.aliases.length) return { ok: false, reason: "has-aliases" };
    const nextRecords = registry.records.filter((item) => item.id !== record.id).map(createRecord).filter(Boolean);
    state.areaRegistry = { version: 1, records: nextRecords };
    state.areas = nextRecords.map((item) => item.name);
    return { ok: true, record };
  }

  return {
    buildAreaRegistry,
    indexAreaRegistry,
    resolveAreaValue,
    resolveTripArea,
    canonicalizeTripArea,
    syncAreaState,
    addCanonicalArea,
    mergeAreas,
    countTripsForArea,
    deleteArea
  };
}
