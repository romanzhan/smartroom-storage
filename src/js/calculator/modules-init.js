import { initPostcode } from "./postcode.js";
import { initItems } from "./items.js";
import { initUnits } from "./units.js";
import { initDuration } from "./duration.js";
import { initAddress } from "./address.js";
import { initDate } from "./date.js";
import { initSidebar } from "./sidebar.js";

export function initCalculatorModules(dom, store, siteConfig) {
  store.modules.items = initItems({
    container: dom.boxesItemsList,
    onChange: () => store.notify(),
    itemsCatalog: siteConfig?.items,
  });

  store.modules.units = initUnits({
    container: dom.unitsListContainer,
    onChange: () => store.notify(),
  });

  store.modules.durationBoxes = initDuration({
    minusBtn: dom.durationMinus,
    plusBtn: dom.durationPlus,
    input: dom.durationInput,
    toggleBtn: dom.rollingPlanToggle,
    promoText: dom.durationPromo,
    rollingText: dom.rollingText,
    qtyWrap: dom.durationQtyBoxes,
    onChange: () => store.notify(),
  });

  store.modules.durationFurn = initDuration({
    minusBtn: dom.durationMinusFurn,
    plusBtn: dom.durationPlusFurn,
    input: dom.durationInputFurn,
    toggleBtn: dom.rollingPlanToggleFurn,
    promoText: dom.durationPromoFurn,
    rollingText: dom.rollingTextFurn,
    qtyWrap: dom.qtyWrapFurn,
    onChange: () => store.notify(),
  });

  store.modules.address = initAddress({
    onChange: () => {
      store.notify();
      if (store.modules.date) store.modules.date.reRenderCalendar();
    },
  });

  const postcode = initPostcode({
    googleMapsApiKey: siteConfig?.googleMapsApiKey || "",
    restrictToAllowedPostcodes: Boolean(siteConfig?.restrictToAllowedPostcodes),
    allowedPostcodes: siteConfig?.allowedPostcodes,
    warehouseLatitude: siteConfig?.warehouseLatitude,
    warehouseLongitude: siteConfig?.warehouseLongitude,
    onPlaceResolved: (data) => {
      store.modules.address?.applyFromPlace?.(data);
    },
    form: dom.form,
    errorText: dom.errorText,
    currentPostcodeInput: dom.currentPostcodeInput,
    mainAutocomplete: dom.mainAutocomplete,
    postcodePill: dom.postcodePill,
    postcodeSearchMode: dom.postcodeSearchMode,
    postcodeText: dom.postcodeText,
    editInput: dom.editInput,
    editAutocomplete: dom.editAutocomplete,
  });

  store.modules.date = initDate({
    store,
    onChange: () => store.notify(),
  });

  initSidebar({
    store,
    summaryItems: dom.summaryItems,
    summarySubtotal: dom.summarySubtotal,
    summaryTotal: dom.summaryTotal,
    continueBtn: dom.continueBtn,
    mobileSummaryTotal: dom.mobileSummaryTotal,
    mobileContinueBtn: dom.mobileContinueBtn,
    summaryCard: dom.summaryCard,
    summaryMobileToggle: dom.summaryMobileToggle,
  });

  return postcode;
}
