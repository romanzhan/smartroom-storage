import { defaultSiteConfig } from "./defaults.js";

function cloneItems(items) {
  return items.map((row) => ({ ...row }));
}

function finiteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function mergeObject(base, patch) {
  if (!patch || typeof patch !== "object") return base;
  const result = { ...base };
  for (const key of Object.keys(patch)) {
    if (patch[key] != null && patch[key] !== "") {
      if (typeof patch[key] === "object" && !Array.isArray(patch[key])) {
        result[key] = mergeObject(result[key] || {}, patch[key]);
      } else {
        result[key] = patch[key];
      }
    }
  }
  return result;
}

export function mergeSiteConfigLayer(base, patch) {
  if (!patch || typeof patch !== "object") return base;
  const next = { ...base };
  if (patch.globalDiscount != null && patch.globalDiscount !== "") {
    const n = finiteNumber(patch.globalDiscount);
    if (n != null) next.globalDiscount = n;
  }
  if (patch.version != null) next.version = patch.version;
  if (Array.isArray(patch.allowedPostcodes)) {
    next.allowedPostcodes = [...patch.allowedPostcodes];
  }
  if (patch.restrictToAllowedPostcodes != null) {
    next.restrictToAllowedPostcodes = Boolean(patch.restrictToAllowedPostcodes);
  }
  if (patch.warehouseLatitude != null && patch.warehouseLatitude !== "") {
    const n = finiteNumber(patch.warehouseLatitude);
    if (n != null) next.warehouseLatitude = n;
  }
  if (patch.warehouseLongitude != null && patch.warehouseLongitude !== "") {
    const n = finiteNumber(patch.warehouseLongitude);
    if (n != null) next.warehouseLongitude = n;
  }
  // Deep-merge nested objects
  if (patch.collection && typeof patch.collection === "object") {
    next.collection = mergeObject(next.collection || {}, patch.collection);
  }
  if (patch.vat && typeof patch.vat === "object") {
    next.vat = mergeObject(next.vat || {}, patch.vat);
  }
  if (Array.isArray(patch.extras)) {
    next.extras = patch.extras.map((e) => ({ ...e }));
  }
  if (Array.isArray(patch.items)) {
    next.items = cloneItems(patch.items);
  }
  if (Array.isArray(patch.units)) {
    next.units = cloneItems(patch.units);
  }
  if (Array.isArray(patch.durationDiscounts)) {
    next.durationDiscounts = cloneItems(patch.durationDiscounts);
  }
  return next;
}

function cloneDefaultConfig() {
  const base = { ...defaultSiteConfig };
  base.items = cloneItems(defaultSiteConfig.items);
  base.allowedPostcodes = [...defaultSiteConfig.allowedPostcodes];
  if (defaultSiteConfig.collection) {
    base.collection = { ...defaultSiteConfig.collection };
    if (defaultSiteConfig.collection.moverRates) {
      base.collection.moverRates = { ...defaultSiteConfig.collection.moverRates };
    }
  }
  if (defaultSiteConfig.vat) {
    base.vat = { ...defaultSiteConfig.vat };
  }
  if (Array.isArray(defaultSiteConfig.extras)) {
    base.extras = defaultSiteConfig.extras.map((e) => ({ ...e }));
  }
  if (Array.isArray(defaultSiteConfig.units)) {
    base.units = cloneItems(defaultSiteConfig.units);
  }
  if (Array.isArray(defaultSiteConfig.durationDiscounts)) {
    base.durationDiscounts = cloneItems(defaultSiteConfig.durationDiscounts);
  }
  return base;
}

export function mergeSiteConfigChain(...layers) {
  return layers.reduce((acc, layer) => mergeSiteConfigLayer(acc, layer), cloneDefaultConfig());
}
