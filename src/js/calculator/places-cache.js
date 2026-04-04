/** Full resolve result (place + distance), persisted for repeat selections. */
const STORAGE_KEY = "smartroom_maps_place_cache_v1";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_STORED_ENTRIES = 200;

/** @type {Map<string, { predictions: Array<{ placeId: string, text: string }>, expiresAt: number }>} */
const autocompleteMemory = new Map();
const AUTOCOMPLETE_MEMORY_TTL_MS = 10 * 60 * 1000;
const AUTOCOMPLETE_MEMORY_MAX = 48;

function normAutocompleteKey(input) {
  return (input || "").trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * @param {string} input
 * @returns {Array<{ placeId: string, text: string }>|null}
 */
export function getAutocompleteMemory(input) {
  const key = normAutocompleteKey(input);
  if (!key) return null;
  const row = autocompleteMemory.get(key);
  if (!row || row.expiresAt <= Date.now()) {
    autocompleteMemory.delete(key);
    return null;
  }
  return row.predictions;
}

/**
 * @param {string} input
 * @param {Array<{ placeId: string, text: string }>} predictions
 */
export function setAutocompleteMemory(input, predictions) {
  const key = normAutocompleteKey(input);
  if (!key) return;
  while (autocompleteMemory.size >= AUTOCOMPLETE_MEMORY_MAX) {
    const first = autocompleteMemory.keys().next().value;
    autocompleteMemory.delete(first);
  }
  autocompleteMemory.set(key, {
    predictions,
    expiresAt: Date.now() + AUTOCOMPLETE_MEMORY_TTL_MS,
  });
}

function loadStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { entries: {} };
    const data = JSON.parse(raw);
    return data && typeof data.entries === "object" ? data : { entries: {} };
  } catch {
    return { entries: {} };
  }
}

function saveStore(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* quota */
  }
}

function pruneExpired(data) {
  const now = Date.now();
  const entries = data.entries || {};
  let changed = false;
  for (const k of Object.keys(entries)) {
    if (entries[k].expiresAt <= now) {
      delete entries[k];
      changed = true;
    }
  }
  return changed;
}

/**
 * @param {string} warehouseKey e.g. "51.5229,-0.1195"
 * @param {string} placeId
 * @returns {object|null} cached payload for onPlaceResolved
 */
export function getCachedResolvedPlace(warehouseKey, placeId) {
  if (!placeId) return null;
  const data = loadStore();
  pruneExpired(data);
  const row = data.entries[placeId];
  if (!row || row.warehouseKey !== warehouseKey) return null;
  if (row.expiresAt <= Date.now()) {
    delete data.entries[placeId];
    saveStore(data);
    return null;
  }
  return row.payload;
}

/**
 * @param {string} warehouseKey
 * @param {string} placeId
 * @param {object} payload fields passed to onPlaceResolved
 */
export function setCachedResolvedPlace(warehouseKey, placeId, payload) {
  if (!placeId || !payload) return;
  const data = loadStore();
  pruneExpired(data);
  const entries = data.entries || {};
  entries[placeId] = {
    warehouseKey,
    expiresAt: Date.now() + TTL_MS,
    payload: { ...payload },
  };

  const keys = Object.keys(entries);
  if (keys.length > MAX_STORED_ENTRIES) {
    keys
      .map((k) => ({ k, exp: entries[k].expiresAt }))
      .sort((a, b) => a.exp - b.exp)
      .slice(0, keys.length - MAX_STORED_ENTRIES)
      .forEach(({ k }) => delete entries[k]);
  }

  data.entries = entries;
  saveStore(data);
}

export function warehouseKeyFromCoords(lat, lng) {
  const a = Number(lat);
  const b = Number(lng);
  if (Number.isNaN(a) || Number.isNaN(b)) return "0,0";
  return `${a.toFixed(5)},${b.toFixed(5)}`;
}
