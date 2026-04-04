import { SITE_CONFIG_STORAGE_KEY } from "./constants.js";
import { SITE_CONFIG_VERSION } from "./defaults.js";

export function normalizeSiteConfigPayload(payload) {
  return {
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
