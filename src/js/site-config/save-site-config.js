import { SITE_CONFIG_STORAGE_KEY } from "./constants.js";
import { SITE_CONFIG_VERSION } from "./defaults.js";

export function normalizeSiteConfigPayload(payload) {
  const body = {
    version: SITE_CONFIG_VERSION,
    updatedAt: Date.now(),
    restrictToAllowedPostcodes: Boolean(payload.restrictToAllowedPostcodes),
  };

  if (payload.warehouseLatitude != null && payload.warehouseLatitude !== "") {
    body.warehouseLatitude = Number(payload.warehouseLatitude);
  }
  if (payload.warehouseLongitude != null && payload.warehouseLongitude !== "") {
    body.warehouseLongitude = Number(payload.warehouseLongitude);
  }

  // Collection pricing (deep copy with number coercion)
  if (payload.collection && typeof payload.collection === "object") {
    const c = payload.collection;
    body.collection = {};
    if (c.moverRates && typeof c.moverRates === "object") {
      body.collection.moverRates = {};
      for (const k of Object.keys(c.moverRates)) {
        body.collection.moverRates[k] = Number(c.moverRates[k]) || 0;
      }
    }
    const numericKeys = [
      "baseTimePerCubicMeter", "moverEfficiencyFactor",
      "floorMultiplierNoLift", "floorMultiplierWithLift",
      "travelTimePerMile", "fixedDelayMinutes",
      "smallJobThreshold", "smallJobLoadingTime", "smallJobUnloadingTime",
      "smallJobTravelPerMile", "smallJobTravelDelay", "smallJobDefaultMiles", "smallJobMinPrice",
      "normalJobDefaultMiles", "autoUpgradeThreshold",
      "vanCapacity", "overloadThreshold", "overloadLightMultiplier", "overloadHeavyMultiplier",
      "urgencyDaysThreshold", "urgencySurcharge", "weekendSurcharge", "holidaySurcharge", "twoHourWindowSurcharge",
    ];
    for (const key of numericKeys) {
      if (c[key] != null) {
        body.collection[key] = Number(c[key]);
      }
    }
  }

  // VAT
  if (payload.vat && typeof payload.vat === "object") {
    body.vat = {
      enabled: Boolean(payload.vat.enabled),
      rate: Number(payload.vat.rate) || 0,
      applyToCollection: Boolean(payload.vat.applyToCollection),
      applyToStorage: Boolean(payload.vat.applyToStorage),
    };
  }

  // Arrays
  if (Array.isArray(payload.items)) {
    body.items = payload.items.map((row) => ({
      id: String(row.id || ""),
      name: String(row.name || ""),
      desc: String(row.desc || ""),
      price: Number(row.price) || 0,
      volume: Number(row.volume) || 0,
    }));
  }

  if (Array.isArray(payload.units)) {
    body.units = payload.units.map((row) => ({
      id: String(row.id || ""),
      name: String(row.name || ""),
      size: String(row.size || ""),
      price: Number(row.price) || 0,
      volume: Number(row.volume) || 0,
    }));
  }

  if (Array.isArray(payload.extras)) {
    body.extras = payload.extras.map((row) => ({
      id: String(row.id || ""),
      name: String(row.name || ""),
      price: Number(row.price) || 0,
      perItem: Boolean(row.perItem),
    }));
  }

  if (Array.isArray(payload.allowedPostcodes)) {
    body.allowedPostcodes = payload.allowedPostcodes;
  }

  if (Array.isArray(payload.durationDiscounts)) {
    body.durationDiscounts = payload.durationDiscounts
      .map((row) => ({
        minMonths: Number(row.minMonths) || 0,
        discount: Number(row.discount) || 0,
      }))
      .sort((a, b) => b.minMonths - a.minMonths);
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
