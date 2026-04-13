import {
  isValidDate,
  notifyEachSafe,
  runSafe,
} from "../lib/runtime-utils.js";

// ── Collection fee calculation (time-based, from moving calculator) ──

/**
 * Floor multiplier for loading/unloading time.
 * @param {number} floor  0 = ground
 * @param {boolean} hasLift
 * @param {object} cfg  collection config
 * @returns {number}
 */
function floorMultiplier(floor, hasLift, cfg) {
  if (floor <= 0) return 1;
  const perFloor = hasLift
    ? (cfg.floorMultiplierWithLift ?? 0.015)
    : (cfg.floorMultiplierNoLift ?? 0.25);
  return 1 + floor * perFloor;
}

/**
 * Determine number of movers based on volume.
 * @param {number} volume  total m³
 * @param {object} cfg  collection config
 * @returns {number} 1 or 2
 */
function pickMovers(volume, cfg) {
  const threshold = cfg.autoUpgradeThreshold ?? 10;
  return volume > threshold ? 2 : 1;
}

/**
 * Calculate the collection fee using time-based formula.
 * @param {object} params
 * @param {number} params.volume           total m³
 * @param {number|null} params.distanceMiles  driving distance
 * @param {string} params.propType         "ground" | "apartment"
 * @param {number} params.floor            floor number (1+)
 * @param {string} params.lift             "yes" | "no"
 * @param {object} params.dateData         { isWeekend, isHoliday, isUrgent, windowType }
 * @param {object} params.extrasData       { dismantlingQty, flags[] }
 * @param {object} cfg                     siteConfig.collection
 * @param {object} vatCfg                  siteConfig.vat
 * @returns {object} { collectionFee, rawCollectionFee, extrasPrice, vatAmount, movers, totalTimeMin, breakdown }
 */
export function calculateCollectionFee({
  volume,
  distanceMiles,
  propType,
  floor,
  lift,
  dateData,
  extrasData,
  cfg,
  vatCfg,
  extrasList,
}) {
  if (!cfg) cfg = {};

  const baseTime = cfg.baseTimePerCubicMeter ?? 9.5;
  const effFactor = cfg.moverEfficiencyFactor ?? 2.2;
  const rates = cfg.moverRates ?? { 1: 72, 2: 84 };
  const smallThreshold = cfg.smallJobThreshold ?? 2;
  const minPrice = cfg.smallJobMinPrice ?? 65;

  const movers = pickMovers(volume, cfg);
  const rate = rates[movers] ?? rates[1] ?? 72;

  const isSmallJob = volume < smallThreshold;

  // ── Time calculation ──
  let loadingTime, unloadingTime, travelTime;

  if (isSmallJob) {
    loadingTime = cfg.smallJobLoadingTime ?? 15;
    unloadingTime = cfg.smallJobUnloadingTime ?? 10;
    const miles = distanceMiles ?? (cfg.smallJobDefaultMiles ?? 3);
    travelTime =
      miles * (cfg.smallJobTravelPerMile ?? 2) +
      (cfg.smallJobTravelDelay ?? 20);
  } else {
    // Mover efficiency: time per m³ adjusted for number of movers
    const efficiency = baseTime * (effFactor / (movers + 0.2));

    // Pickup floor multiplier (customer's property)
    const pickupFloor =
      propType === "apartment" ? Math.max(1, floor || 1) : 0;
    const hasLift = lift === "yes";
    const pickupMul = floorMultiplier(pickupFloor, hasLift, cfg);

    // Delivery is always warehouse ground floor → multiplier 1.0
    const deliveryMul = 1.0;

    loadingTime = efficiency * volume * pickupMul;
    unloadingTime = efficiency * volume * deliveryMul;

    const miles = distanceMiles ?? (cfg.normalJobDefaultMiles ?? 5);
    travelTime =
      miles * (cfg.travelTimePerMile ?? 3) +
      (cfg.fixedDelayMinutes ?? 85);
  }

  const totalTimeMin = loadingTime + unloadingTime + travelTime;

  // ── Base price ──
  let basePrice = (totalTimeMin / 60) * rate;
  if (isSmallJob && basePrice < minPrice) {
    basePrice = minPrice;
  }

  // ── Overload surcharge ──
  const vanCap = cfg.vanCapacity ?? 18;
  const overloadThresh = cfg.overloadThreshold ?? 20;
  let overloadSurcharge = 0;
  if (volume > overloadThresh) {
    overloadSurcharge = basePrice * ((cfg.overloadHeavyMultiplier ?? 2.0) - 1);
  } else if (volume > vanCap) {
    overloadSurcharge = basePrice * ((cfg.overloadLightMultiplier ?? 1.5) - 1);
  }
  let price = basePrice + overloadSurcharge;

  // ── Date-based surcharges ──
  let urgencySurcharge = 0;
  let weekendHolidaySurcharge = 0;
  let timeSlotSurcharge = 0;

  if (dateData) {
    // Urgency
    if (dateData.isUrgent) {
      urgencySurcharge = price * (cfg.urgencySurcharge ?? 0.20);
    }
    // Holiday replaces weekend
    if (dateData.isHoliday) {
      weekendHolidaySurcharge = price * (cfg.holidaySurcharge ?? 0.20);
    } else if (dateData.isWeekend) {
      weekendHolidaySurcharge = price * (cfg.weekendSurcharge ?? 0.15);
    }
    // 2-hour window
    if (dateData.windowType === "2-hour") {
      timeSlotSurcharge = price * (cfg.twoHourWindowSurcharge ?? 0.10);
    }
  }

  price += urgencySurcharge + weekendHolidaySurcharge + timeSlotSurcharge;

  // ── Extras ──
  let extrasPrice = 0;
  if (extrasData && extrasList) {
    for (const extra of extrasList) {
      if (extra.perItem && extra.price > 0) {
        const qty = extrasData.quantities?.[extra.id] || 0;
        extrasPrice += extra.price * qty;
      }
      // flag-only extras (price=0) are recorded but don't add cost
    }
  }

  const rawCollectionFee = price;
  const subtotalBeforeVat = price + extrasPrice;

  // ── VAT ──
  let vatAmount = 0;
  if (vatCfg?.enabled && vatCfg?.applyToCollection) {
    vatAmount = subtotalBeforeVat * (vatCfg.rate ?? 0.20);
  }

  const collectionFee = subtotalBeforeVat + vatAmount;

  return {
    collectionFee,
    rawCollectionFee: price,
    extrasPrice,
    vatAmount,
    movers,
    totalTimeMin,
    loadingTime,
    unloadingTime,
    travelTime,
    basePrice,
  };
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
    extras: null,
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
    let extrasPrice = 0;
    let vatAmount = 0;
    let collMovers = 1;
    let collTotalTimeMin = 0;
    const insurancePrice = insuranceData?.price ?? 0;

    // --- Storage price & volume ---
    let totalVolume = 0;
    if (currentTab === "boxes") {
      itemsData.forEach((item) => {
        if (item.qty > 0) {
          hasItems = true;
          storagePrice += item.qty * item.price;
          totalVolume += item.qty * (item.volume || 0.05);
        }
      });
    } else {
      if (selectedUnit) {
        hasItems = true;
        storagePrice = selectedUnit.price;
        totalVolume = selectedUnit.volume || 1;
      }
    }

    // --- Collection fee (time-based) ---
    if (currentStep >= 2 && addr && hasItems && addr.mode === "collection") {
      const siteCfg = this.siteConfig || {};
      const collCfg = siteCfg.collection || {};
      const vatCfg = siteCfg.vat || {};
      const extrasList = siteCfg.extras || [];

      const extrasModule = modules.extras;
      const extrasData = extrasModule?.getData() ?? null;

      const result = calculateCollectionFee({
        volume: totalVolume,
        distanceMiles: addr.distanceMiles,
        propType: addr.propType,
        floor: addr.floor,
        lift: addr.lift,
        dateData: currentStep >= 3 ? dateData : null,
        extrasData,
        cfg: collCfg,
        vatCfg,
        extrasList,
      });

      rawCollectionFee = result.rawCollectionFee;
      collectionFee = result.collectionFee;
      extrasPrice = result.extrasPrice;
      vatAmount = result.vatAmount;
      collMovers = result.movers;
      collTotalTimeMin = result.totalTimeMin;
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
        bookingDetails.push({ label: "Movers", value: `${collMovers} mover${collMovers > 1 ? "s" : ""} (auto)` });
        const notes = (addr.instructions || "").trim();
        if (notes) bookingDetails.push({ label: "Notes", value: notes });

        // Extras
        const extrasModule = modules.extras;
        const extrasData = extrasModule?.getData?.() ?? null;
        const extrasList = (this.siteConfig?.extras) || [];
        if (extrasData) {
          for (const extra of extrasList) {
            if (extra.perItem && extra.price > 0) {
              const qty = extrasData.quantities?.[extra.id] || 0;
              if (qty > 0) {
                bookingDetails.push({ label: extra.name, value: `${qty}x £${extra.price.toFixed(2)} = £${(qty * extra.price).toFixed(2)}` });
              }
            } else if (extrasData.flags?.includes(extra.id)) {
              bookingDetails.push({ label: extra.name, value: "Requested" });
            }
          }
        }

        bookingDetails.push({ label: "Collection fee", value: `£${collectionFee.toFixed(2)}` });
        if (vatAmount > 0) {
          bookingDetails.push({ label: "incl. VAT", value: `£${vatAmount.toFixed(2)}` });
        }
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
      extrasPrice,
      vatAmount,
      dateStr,
      duration,
      isRolling,
      rawCollectionFee,
      totalVolume,
      collMovers,
      collTotalTimeMin,
      bookingDetails,
    };
  },

  notify() {
    runSafe("store.notify", () => this.dispatch({ type: "UPDATE" }));
  },
};
