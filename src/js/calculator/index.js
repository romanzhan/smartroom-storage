import { animateExpand, animateCollapse } from "./animations.js";
import { applySiteConfigUi } from "./apply-site-config-ui.js";
import { getCalculatorDom } from "./dom.js";
import { attachCalculatorFlow } from "./flow.js";
import { initCalculatorModules } from "./modules-init.js";
import { store } from "./store.js";

export function initCalculator(siteConfig) {
  gsap.registerPlugin(ScrollToPlugin);

  const dom = getCalculatorDom();
  if (!dom.form) return;

  store.siteConfig = siteConfig;
  applySiteConfigUi(dom, siteConfig);

  const postcode = initCalculatorModules(dom, store, siteConfig);

  attachCalculatorFlow({
    dom,
    store,
    postcode,
    animateExpand,
    animateCollapse,
  });
}
