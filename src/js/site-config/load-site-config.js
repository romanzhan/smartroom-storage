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
  if (legacy.globalDiscount != null) out.globalDiscount = legacy.globalDiscount;
  if (legacy.baseFeeBoxes != null) out.baseFeeBoxes = legacy.baseFeeBoxes;
  if (legacy.baseFeeFurniture != null) out.baseFeeFurniture = legacy.baseFeeFurniture;
  return Object.keys(out).length ? out : null;
}

export async function loadSiteConfig() {
  let fromFile = null;
  if (typeof window !== "undefined") {
    try {
      const jsonUrl = new URL("calculator-config.json", window.location.href).href;
      const res = await fetch(jsonUrl, { cache: "no-store" });
      if (res.ok) fromFile = await res.json();
    } catch {
      fromFile = null;
    }
  }

  const fromStorage = readLocalStorage();
  const fromWp =
    typeof window !== "undefined" && window.__SMARTROOM_SITE_CONFIG__
      ? window.__SMARTROOM_SITE_CONFIG__
      : null;
  const legacyWp = mapLegacyWpConfig();

  return mergeSiteConfigChain(fromFile, fromStorage, legacyWp, fromWp);
}
