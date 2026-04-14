import { animateExpand, animateCollapse } from "./animations.js";
import { applySiteConfigUi } from "./apply-site-config-ui.js";
import { getCalculatorDom } from "./dom.js";
import { attachCalculatorFlow } from "./flow.js";
import { INLINE_GOOGLE_MAPS_API_KEY } from "./inline-maps-api-key.js";
import { loadMapsJavaScriptApi } from "./maps-driving.js";
import { initCalculatorModules } from "./modules-init.js";
import { store } from "./store.js";

export function initCalculator(siteConfig) {
  try {
    if (typeof gsap !== "undefined" && typeof ScrollToPlugin !== "undefined") {
      gsap.registerPlugin(ScrollToPlugin);
    }
  } catch (err) {
    console.error("[SmartRoom] GSAP registerPlugin failed", err);
  }

  const dom = getCalculatorDom();
  if (!dom.form) return;

  store.siteConfig = siteConfig ?? null;
  applySiteConfigUi(dom, siteConfig);

  // Expose store for debugging / diagnostics (read-only usage is fine)
  if (typeof window !== "undefined") {
    window.__SR__ = store;
  }

  // Priority: siteConfig (WP plugin injection) → inline (gh-pages) → env (.env dev)
  const googleMapsApiKey = String(
    siteConfig?.googleMapsApiKey ||
      (import.meta.env.PROD
        ? INLINE_GOOGLE_MAPS_API_KEY || import.meta.env.VITE_GOOGLE_MAPS_API_KEY
        : import.meta.env.VITE_GOOGLE_MAPS_API_KEY || INLINE_GOOGLE_MAPS_API_KEY),
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

  // Inject the Google Maps bootstrap loader eagerly so that
  // window.google.maps.importLibrary is available for any caller —
  // including the distance calc flow and manual console diagnostics.
  // This does not load the SDK yet; the first importLibrary() call does.
  if (googleMapsApiKey) {
    loadMapsJavaScriptApi(googleMapsApiKey).catch((err) => {
      console.warn("[SmartRoom] Early Maps loader injection failed:", err);
    });
  }

  let postcode;
  try {
    postcode = initCalculatorModules(dom, store, {
      ...(siteConfig && typeof siteConfig === "object" ? siteConfig : {}),
      googleMapsApiKey,
    });
  } catch (err) {
    console.error("[SmartRoom] initCalculatorModules failed", err);
    return;
  }

  const directMode = Boolean(siteConfig?.directMode);

  try {
    attachCalculatorFlow({
      dom,
      store,
      postcode,
      animateExpand,
      animateCollapse,
      directMode,
    });
  } catch (err) {
    console.error("[SmartRoom] attachCalculatorFlow failed", err);
  }

  // ── Direct mode: skip the initial postcode view entirely ──
  // Opens the expanded calculator statically, reads ?place_id / ?postcode
  // from the URL (set by the shortcode widget on submit) and pre-resolves
  // the place so the address, distance and sidebar price are ready.
  if (directMode) {
    openExpandedViewStatic(dom);
    maybeResolvePlaceFromUrl(postcode);
  }
}

/**
 * Static (no animation) opening of the expanded calculator view. Used in
 * directMode — the shortcode widget on the host page is the "initial view",
 * so on the dedicated page we jump straight to the expanded state.
 */
function openExpandedViewStatic(dom) {
  const { panel, initialView, expandedView, sharedToggle, toggleExpandedSlot, backBtn } =
    dom;
  if (!panel || !initialView || !expandedView) return;

  initialView.style.display = "none";
  expandedView.style.display = "block";
  expandedView.style.opacity = "1";
  panel.classList.add("is-expanded");

  // Move the boxes/furniture toggle from the pill slot into the expanded header slot
  if (sharedToggle && toggleExpandedSlot && toggleExpandedSlot !== sharedToggle.parentNode) {
    toggleExpandedSlot.appendChild(sharedToggle);
  }

  // The expanded-state header elements (back button, pill, content) are
  // normally faded in by animateExpand — in static mode they start visible.
  expandedView
    .querySelectorAll(".calc-back-btn, .calc-postcode-display, .calc-content")
    .forEach((el) => {
      el.style.opacity = "1";
    });

  // Swap the × close icon for a ← back arrow, and update a11y label.
  if (backBtn) {
    backBtn.setAttribute("aria-label", "Back");
    backBtn.innerHTML =
      '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>';
  }
}

function maybeResolvePlaceFromUrl(postcode) {
  if (!postcode || typeof postcode.resolveByPlaceId !== "function") return;
  let params;
  try {
    params = new URLSearchParams(window.location.search);
  } catch {
    return;
  }
  const placeId = (params.get("place_id") || "").trim();
  const rawPc = (params.get("postcode") || "").trim();
  if (!placeId) return;

  console.log("[SmartRoom] URL param resolve: place_id =", placeId);
  if (rawPc && typeof postcode.setSaved === "function") {
    postcode.setSaved(rawPc);
  }
  // Fire and forget — resolvePlaceSelection is async and will update the
  // store + sidebar via its own onPlaceResolved chain.
  Promise.resolve(postcode.resolveByPlaceId(placeId)).catch((err) =>
    console.error("[SmartRoom] resolveByPlaceId failed:", err),
  );
}
