import { SITE_CONFIG_STORAGE_KEY } from "./constants.js";
import { mergeSiteConfigChain } from "./merge-layers.js";

/**
 * Sanitise an external config layer: coerce numeric collection/vat fields,
 * drop values with wrong types so they don't corrupt calculations.
 */
function sanitizeConfigLayer(raw) {
  if (!raw || typeof raw !== "object") return null;
  const out = { ...raw };

  // Coerce collection numeric fields
  if (out.collection && typeof out.collection === "object") {
    const c = { ...out.collection };
    for (const key of Object.keys(c)) {
      if (key === "moverRates") {
        if (c.moverRates && typeof c.moverRates === "object") {
          const rates = {};
          for (const [k, v] of Object.entries(c.moverRates)) {
            const n = Number(v);
            if (Number.isFinite(n)) rates[k] = n;
            else console.warn(`[SmartRoom] config: dropped non-numeric moverRates.${k}:`, v);
          }
          c.moverRates = rates;
        }
        continue;
      }
      if (typeof c[key] === "string") {
        const n = Number(c[key]);
        if (Number.isFinite(n)) c[key] = n;
        else { console.warn(`[SmartRoom] config: dropped non-numeric collection.${key}:`, c[key]); delete c[key]; }
      }
    }
    out.collection = c;
  }

  // Coerce vat numeric fields
  if (out.vat && typeof out.vat === "object") {
    const v = { ...out.vat };
    if (v.rate != null) { const n = Number(v.rate); if (Number.isFinite(n)) v.rate = n; else delete v.rate; }
    if (v.enabled != null) v.enabled = Boolean(v.enabled);
    if (v.applyToCollection != null) v.applyToCollection = Boolean(v.applyToCollection);
    if (v.applyToStorage != null) v.applyToStorage = Boolean(v.applyToStorage);
    out.vat = v;
  }

  // Validate array fields
  if (out.allowedPostcodes != null && !Array.isArray(out.allowedPostcodes)) {
    console.warn("[SmartRoom] config: dropped non-array allowedPostcodes");
    delete out.allowedPostcodes;
  }
  if (out.extras != null && !Array.isArray(out.extras)) {
    console.warn("[SmartRoom] config: dropped non-array extras");
    delete out.extras;
  }
  if (out.items != null && !Array.isArray(out.items)) {
    console.warn("[SmartRoom] config: dropped non-array items");
    delete out.items;
  }

  return out;
}

function readLocalStorage() {
  try {
    const raw = localStorage.getItem(SITE_CONFIG_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function mapLegacyWpConfig() {
  const legacy = typeof window !== "undefined" ? window.StorageCalcConfig : null;
  if (!legacy || typeof legacy !== "object") return null;
  const out = {};
  if (Array.isArray(legacy.postcodes)) out.allowedPostcodes = legacy.postcodes;
  if (Array.isArray(legacy.boxItemsData)) out.items = legacy.boxItemsData;
  if (legacy.collection && typeof legacy.collection === "object") out.collection = legacy.collection;
  if (legacy.vat && typeof legacy.vat === "object") out.vat = legacy.vat;
  if (Array.isArray(legacy.extras)) out.extras = legacy.extras;
  return Object.keys(out).length ? out : null;
}

export async function loadSiteConfig() {
  let fromFile = null;
  // Skip file fetch when WP (or any other host) has already injected a config —
  // avoids a noisy 404 on hosts where the JSON file is not served from the page path.
  const hasInjectedConfig =
    typeof window !== "undefined" &&
    (window.__SMARTROOM_SITE_CONFIG__ || window.StorageCalcConfig);

  if (typeof window !== "undefined" && !hasInjectedConfig) {
    try {
      const jsonUrl = new URL("calculator-config.json", window.location.href).href;
      const res = await fetch(jsonUrl, { cache: "no-store" });
      if (res.ok) {
        try {
          fromFile = await res.json();
        } catch {
          fromFile = null;
        }
      }
    } catch {
      fromFile = null;
    }
  }

  let fromStorage = null;
  try {
    fromStorage = readLocalStorage();
  } catch {
    fromStorage = null;
  }

  const fromWp = sanitizeConfigLayer(
    typeof window !== "undefined" && window.__SMARTROOM_SITE_CONFIG__
      ? window.__SMARTROOM_SITE_CONFIG__
      : null,
  );
  let legacyWp = null;
  try {
    legacyWp = sanitizeConfigLayer(mapLegacyWpConfig());
  } catch {
    legacyWp = null;
  }

  // Sanitize layers that come from untrusted sources
  fromStorage = sanitizeConfigLayer(fromStorage);

  try {
    return mergeSiteConfigChain(fromFile, fromStorage, legacyWp, fromWp);
  } catch (err) {
    console.error("[SmartRoom] loadSiteConfig merge failed", err);
    return mergeSiteConfigChain(null, null, null, null);
  }
}
