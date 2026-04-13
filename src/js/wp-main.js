import { initCalculator } from "./calculator/index.js";
import { loadSiteConfig } from "./site-config/load-site-config.js";
import { mergeSiteConfigChain } from "./site-config/merge-layers.js";

document.addEventListener("DOMContentLoaded", async () => {
  let siteConfig;
  try {
    siteConfig = await loadSiteConfig();
  } catch (err) {
    console.error("[SmartRoom] loadSiteConfig", err);
    siteConfig = mergeSiteConfigChain(null, null, null, null);
  }
  try {
    initCalculator(siteConfig);
  } catch (err) {
    console.error("[SmartRoom] initCalculator", err);
  }
});
