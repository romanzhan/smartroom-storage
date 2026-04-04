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

  const googleMapsApiKey = (
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ""
  ).trim();

  if (!googleMapsApiKey && dom.initialView) {
    const note = document.createElement("p");
    note.className = "storage-form__maps-off";
    note.setAttribute("role", "alert");
    note.textContent =
      "Google Maps API key is missing. Create a file named .env in the project root with: VITE_GOOGLE_MAPS_API_KEY=your_key_here — then restart npm run dev (or set the variable in your host’s build settings for production).";
    const actionGroup = dom.initialView.querySelector(
      ".storage-form__action-group",
    );
    if (actionGroup) {
      actionGroup.insertAdjacentElement("beforebegin", note);
    } else {
      dom.initialView.insertAdjacentElement("afterbegin", note);
    }
  }

  const postcode = initCalculatorModules(dom, store, {
    ...siteConfig,
    googleMapsApiKey,
  });

  attachCalculatorFlow({
    dom,
    store,
    postcode,
    animateExpand,
    animateCollapse,
  });
}
