import { initCalculator } from "./calculator/index.js";
import { initFooter } from "./layout/footer.js";
import { initHeader } from "./layout/header.js";
import { loadSiteConfig } from "./site-config/load-site-config.js";

document.addEventListener("DOMContentLoaded", async () => {
  initHeader();
  initFooter();
  const siteConfig = await loadSiteConfig();
  initCalculator(siteConfig);
});
