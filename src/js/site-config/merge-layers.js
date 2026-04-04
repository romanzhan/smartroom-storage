import { defaultSiteConfig } from "./defaults.js";

function cloneItems(items) {
  return items.map((row) => ({ ...row }));
}

export function mergeSiteConfigLayer(base, patch) {
  if (!patch || typeof patch !== "object") return base;
  const next = { ...base };
  if (patch.globalDiscount != null && patch.globalDiscount !== "") {
    next.globalDiscount = Number(patch.globalDiscount);
  }
  if (patch.baseFeeBoxes != null && patch.baseFeeBoxes !== "") {
    next.baseFeeBoxes = Number(patch.baseFeeBoxes);
  }
  if (patch.baseFeeFurniture != null && patch.baseFeeFurniture !== "") {
    next.baseFeeFurniture = Number(patch.baseFeeFurniture);
  }
  if (patch.version != null) next.version = patch.version;
  if (Array.isArray(patch.allowedPostcodes)) {
    next.allowedPostcodes = [...patch.allowedPostcodes];
  }
  if (Array.isArray(patch.items)) {
    next.items = cloneItems(patch.items);
  }
  return next;
}

export function mergeSiteConfigChain(...layers) {
  return layers.reduce(
    (acc, layer) => mergeSiteConfigLayer(acc, layer),
    { ...defaultSiteConfig, items: cloneItems(defaultSiteConfig.items), allowedPostcodes: [...defaultSiteConfig.allowedPostcodes] },
  );
}
