import { SITE_CONFIG_STORAGE_KEY } from "./constants.js";
import { SITE_CONFIG_VERSION } from "./defaults.js";

export function normalizeSiteConfigPayload(payload) {
  const body = {
    version: SITE_CONFIG_VERSION,
    updatedAt: Date.now(),
    globalDiscount: Number(payload.globalDiscount),
    baseFeeBoxes: Number(payload.baseFeeBoxes),
    baseFeeFurniture: Number(payload.baseFeeFurniture),
    allowedPostcodes: Array.isArray(payload.allowedPostcodes)
      ? payload.allowedPostcodes
      : [],
    items: Array.isArray(payload.items)
      ? payload.items.map((row) => ({ ...row }))
      : [],
  };

  if (payload.restrictToAllowedPostcodes != null) {
    body.restrictToAllowedPostcodes = Boolean(payload.restrictToAllowedPostcodes);
  }
  if (payload.warehouseLatitude != null && payload.warehouseLatitude !== "") {
    body.warehouseLatitude = Number(payload.warehouseLatitude);
  }
  if (payload.warehouseLongitude != null && payload.warehouseLongitude !== "") {
    body.warehouseLongitude = Number(payload.warehouseLongitude);
  }
  if (payload.distancePricing && typeof payload.distancePricing === "object") {
    body.distancePricing = {
      freeMiles: Number(payload.distancePricing.freeMiles),
      pricePerMile: Number(payload.distancePricing.pricePerMile),
    };
  }

  return body;
}

export function saveSiteConfig(payload) {
  const body = normalizeSiteConfigPayload(payload);

  try {
    localStorage.setItem(SITE_CONFIG_STORAGE_KEY, JSON.stringify(body));
  } catch {
    /* quota or private mode */
  }

  if (typeof window !== "undefined") {
    if (typeof window.__SMARTROOM_SAVE_CONFIG__ === "function") {
      window.__SMARTROOM_SAVE_CONFIG__(body);
    }
    window.dispatchEvent(
      new CustomEvent("smartroom-site-config-saved", { detail: body }),
    );
  }

  return body;
}
