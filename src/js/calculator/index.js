import { animateExpand, animateCollapse } from "./animations.js";
import { applySiteConfigUi } from "./apply-site-config-ui.js";
import { getCalculatorDom } from "./dom.js";
import { attachCalculatorFlow } from "./flow.js";
import { INLINE_GOOGLE_MAPS_API_KEY } from "./inline-maps-api-key.js";
import { initCalculatorModules } from "./modules-init.js";
import { store } from "./store.js";

export function initCalculator(siteConfig) {
  gsap.registerPlugin(ScrollToPlugin);

  const dom = getCalculatorDom();
  if (!dom.form) return;

  store.siteConfig = siteConfig;
  applySiteConfigUi(dom, siteConfig);

  // Prod (gh-pages): inline first so deploy matches Console referrers without relying on .env at build time.
  const googleMapsApiKey = (
    import.meta.env.PROD
      ? INLINE_GOOGLE_MAPS_API_KEY || import.meta.env.VITE_GOOGLE_MAPS_API_KEY
      : import.meta.env.VITE_GOOGLE_MAPS_API_KEY || INLINE_GOOGLE_MAPS_API_KEY
  ).trim();

  if (!googleMapsApiKey && dom.initialView) {
    const note = document.createElement("p");
    note.className = "storage-form__maps-off";
    note.setAttribute("role", "alert");
    note.textContent =
      "Нет ключа Google Maps: задайте VITE_GOOGLE_MAPS_API_KEY в .env (локально) или вставьте ключ в src/js/calculator/inline-maps-api-key.js для сборки под GitHub Pages, затем пересоберите проект.";
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
