import {
  isValidDate,
  notifyEachSafe,
  runSafe,
} from "../lib/runtime-utils.js";

/**
 * Extra collection charge for driving distance beyond free threshold (miles).
 * @param {number|null|undefined} miles
 * @param {object} cfg siteConfig
 * @returns {number}
 */
export function distanceSurchargePounds(miles, cfg) {
  if (miles == null || Number.isNaN(Number(miles))) return 0;
  const dp = cfg?.distancePricing;
  const freeMiles =
    dp?.freeMiles != null && dp.freeMiles !== ""
      ? Number(dp.freeMiles)
      : 0;
  const pricePerMile =
    dp?.pricePerMile != null && dp.pricePerMile !== ""
      ? Number(dp.pricePerMile)
      : 0;
  const m = Number(miles);
  const extra = Math.max(0, m - freeMiles);
  return extra * pricePerMile;
}

export const store = {
  currentTab: "boxes",
  currentStep: 1,
  siteConfig: null,

  modules: {
    items: null,
    units: null,
    durationBoxes: null,
    durationFurn: null,
    address: null,
    date: null,
  },

  _listeners: [],

  subscribe(fn) {
    this._listeners.push(fn);
    return () => {
      const i = this._listeners.indexOf(fn);
      if (i !== -1) this._listeners.splice(i, 1);
    };
  },

  dispatch(event) {
    let snapshot;
    try {
      snapshot = this.getSnapshot();
    } catch (err) {
      console.error("[SmartRoom] getSnapshot failed", err);
      return;
    }
    notifyEachSafe(this._listeners, event, snapshot);
  },

  getSnapshot() {
    const { currentTab, currentStep, modules } = this;

    const itemsData = modules.items?.getData() ?? [];
    const selectedUnit = modules.units?.getSelectedUnit() ?? null;
    const addr = modules.address?.getData() ?? null;
    const dateData = modules.date?.getData() ?? null;

    const durationModule =
      currentTab === "boxes" ? modules.durationBoxes : modules.durationFurn;
    const duration = durationModule?.getDuration() ?? null;
    const isRolling = durationModule?.isRollingPlan() ?? false;

    const insuranceData = modules.insurance?.getSelected(currentTab) ?? null;

    let storagePrice = 0;
    let hasItems = false;
    let rawCollectionFee = 0;
    let collectionFee = 0;
    const insurancePrice = insuranceData?.price ?? 0;

    // --- Storage price ---
    if (currentTab === "boxes") {
      itemsData.forEach((item) => {
        if (item.qty > 0) {
          hasItems = true;
          storagePrice += item.qty * item.price;
        }
      });
    } else {
      if (selectedUnit) {
        hasItems = true;
        storagePrice = selectedUnit.price;
      }
    }

    // --- Collection fee ---
    if (currentStep >= 2 && addr && hasItems && addr.mode === "collection") {
      const cfg = this.siteConfig || {};
      const tabAddon =
        currentTab === "boxes"
          ? Number(cfg.baseFeeBoxes) || 0
          : Number(cfg.baseFeeFurniture) || 0;
      let collFee = 30.0 + tabAddon;

      if (addr.propType === "apartment") {
        collFee += 30.0 * 0.1;
        if (addr.lift === "no") {
          const floorNum = Math.max(1, addr.floor);
          collFee += 30.0 * (0.05 * floorNum);
        }
      }

      if (addr.movers === "2") {
        collFee += 45.0;
      }

      const distanceExtra = distanceSurchargePounds(addr.distanceMiles, cfg);
      collFee += distanceExtra;

      rawCollectionFee = collFee;

      if (dateData && currentStep >= 3) {
        let dateMultiplier = 1;
        if (dateData.isWeekend || dateData.isHoliday || dateData.isUrgent) {
          dateMultiplier += 0.15;
        }
        if (dateData.windowType === "2-hour") {
          dateMultiplier += 0.1;
        }
        collFee = collFee * dateMultiplier;
      }

      collectionFee = collFee;
    }

    // --- Totals ---
    const subtotal = storagePrice + insurancePrice + collectionFee;
    const monthlyPayment = storagePrice + insurancePrice;

    // --- Date string ---
    let dateStr = "";
    if (currentStep >= 3 && dateData && isValidDate(dateData.date)) {
      dateStr = dateData.date.toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    }

    // --- Booking details (for step 4 summary) ---
    const bookingDetails = [];
    if (currentTab === "boxes") {
      itemsData.forEach((item) => {
        if (item.qty > 0) {
          bookingDetails.push({ label: `${item.qty}x ${item.name}`, value: `£${(item.qty * item.price).toFixed(2)}/4wk` });
        }
      });
    } else if (selectedUnit) {
      bookingDetails.push({ label: `1x ${selectedUnit.name} (${selectedUnit.size})`, value: `£${selectedUnit.price.toFixed(2)}/4wk` });
    }

    if (duration != null) {
      bookingDetails.push({ label: "Duration", value: isRolling ? "Rolling monthly" : `${duration} months` });
    }

    if (insuranceData) {
      bookingDetails.push({ label: "Insurance", value: `£${insuranceData.cover.toLocaleString()} cover — £${insuranceData.price.toFixed(2)}/mo` });
    }

    if (addr && addr.mode) {
      if (addr.mode === "collection") {
        const pickupAddress = (addr.address || "").trim() || "Not provided";
        bookingDetails.push({ label: "Service", value: "Home collection" });
        bookingDetails.push({ label: "Pickup address", value: pickupAddress });
        if (addr.propType === "apartment") {
          bookingDetails.push({ label: "Property", value: `Other floor · floor ${addr.floor}` });
          bookingDetails.push({ label: "Lift", value: addr.lift === "yes" ? "Yes" : "No" });
        } else {
          bookingDetails.push({ label: "Property", value: "Ground floor" });
        }
        bookingDetails.push({ label: "Movers", value: addr.movers === "2" ? "2 movers" : "1 mover" });
        const notes = (addr.instructions || "").trim();
        if (notes) bookingDetails.push({ label: "Notes", value: notes });
        bookingDetails.push({ label: "Collection fee", value: `£${collectionFee.toFixed(2)}` });
      } else {
        const facName = addr.facility === "bloomsbury" ? "Bloomsbury (WC1N 3QA)" : "Hackney (N16 8DR)";
        bookingDetails.push({ label: "Service", value: "Drop-off" });
        bookingDetails.push({ label: "Facility", value: facName });
      }
    }

    if (dateStr) {
      bookingDetails.push({ label: "Date", value: dateStr });
    }
    if (dateData?.timeWindow) {
      bookingDetails.push({ label: "Time window", value: dateData.timeWindow });
    }

    return {
      currentTab,
      currentStep,
      hasItems,
      hasInsurance: !!insuranceData,
      subtotal,
      monthlyPayment,
      storagePrice,
      insurancePrice,
      collectionFee,
      dateStr,
      duration,
      isRolling,
      rawCollectionFee,
      bookingDetails,
    };
  },

  notify() {
    runSafe("store.notify", () => this.dispatch({ type: "UPDATE" }));
  },
};
