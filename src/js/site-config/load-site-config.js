import { SITE_CONFIG_STORAGE_KEY } from "./constants.js";
import { mergeSiteConfigChain } from "./merge-layers.js";

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

  const fromWp =
    typeof window !== "undefined" && window.__SMARTROOM_SITE_CONFIG__
      ? window.__SMARTROOM_SITE_CONFIG__
      : null;
  let legacyWp = null;
  try {
    legacyWp = mapLegacyWpConfig();
  } catch {
    legacyWp = null;
  }

  try {
    return mergeSiteConfigChain(fromFile, fromStorage, legacyWp, fromWp);
  } catch (err) {
    console.error("[SmartRoom] loadSiteConfig merge failed", err);
    return mergeSiteConfigChain(null, null, null, null);
  }
}
