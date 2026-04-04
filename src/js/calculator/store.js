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
  },

  dispatch(event) {
    this._listeners.forEach((fn) => fn(event, this.getSnapshot()));
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

    let subtotal = 0;
    let hasItems = false;
    const lines = [];
    let rawCollectionFee = 0;

    if (currentTab === "boxes") {
      itemsData.forEach((item) => {
        if (item.qty > 0) {
          hasItems = true;
          const itemTotal = item.qty * item.price;
          subtotal += itemTotal;
          lines.push({
            group: "storage",
            label: `${item.qty}x ${item.name}`,
            price: itemTotal,
            suffix: "",
          });
        }
      });
      if (hasItems && duration != null) {
        lines.push({
          group: "storage",
          label: isRolling
            ? "Plan: rolling monthly"
            : `Storing for: ${duration} months`,
          price: null,
        });
      }
    } else {
      if (selectedUnit) {
        hasItems = true;
        subtotal = selectedUnit.price;
        lines.push({
          group: "storage",
          label: `1x ${selectedUnit.name} (${selectedUnit.size})`,
          price: subtotal,
          suffix: "/wk",
        });
        if (duration != null) {
          lines.push({
            group: "storage",
            label: isRolling
              ? "Plan: rolling monthly"
              : `Storing for: ${duration} months`,
            price: null,
          });
        }
      }
    }

    if (currentStep >= 2 && addr && hasItems) {
      if (addr.mode === "collection") {
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

        const pickupAddress = (addr.address || "").trim() || "Not provided";

        subtotal += collFee;
        lines.push({
          group: "service",
          label: "Collection fee",
          price: collFee,
          suffix: "",
        });

        if (
          addr.distanceMiles != null &&
          typeof addr.distanceMiles === "number" &&
          !Number.isNaN(addr.distanceMiles)
        ) {
          lines.push({
            group: "service",
            label: "Driving distance (est.)",
            detail: `${addr.distanceMiles.toFixed(1)} mi from Bloomsbury warehouse`,
            price: null,
          });
        }

        if (distanceExtra > 0) {
          lines.push({
            group: "service",
            label: "Distance note",
            detail: `Includes distance surcharge beyond ${Number(cfg.distancePricing?.freeMiles) || 0} mi free`,
            price: null,
          });
        }

        lines.push({
          group: "service",
          label: "Service",
          detail: "Home collection",
          price: null,
        });
        lines.push({
          group: "service",
          label: "Pickup address",
          detail: pickupAddress,
          price: null,
        });

        if (addr.propType === "apartment") {
          lines.push({
            group: "service",
            label: "Property type",
            detail: `Apartment · floor ${addr.floor}`,
            price: null,
          });
          lines.push({
            group: "service",
            label: "Lift",
            detail: addr.lift === "yes" ? "Yes" : "No",
            price: null,
          });
        } else {
          lines.push({
            group: "service",
            label: "Property type",
            detail: "House / ground level",
            price: null,
          });
        }

        lines.push({
          group: "service",
          label: "Crew",
          detail:
            addr.movers === "2" ? "2 movers" : "Standard (1 team)",
          price: null,
        });

        const notes = (addr.instructions || "").trim();
        if (notes) {
          const short =
            notes.length > 100 ? `${notes.slice(0, 97)}…` : notes;
          lines.push({
            group: "service",
            label: "Access notes",
            detail: short,
            price: null,
          });
        }
      } else {
        const facName =
          addr.facility === "bloomsbury" ? "Bloomsbury" : "Hackney";
        lines.push({
          group: "service",
          label: `Drop-off at ${facName}`,
          price: null,
          variant: "dropoff",
        });
      }
    }

    if (currentStep >= 3 && dateData) {
      const dateStr = dateData.date.toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      });
      lines.push({
        group: "schedule",
        label: "Date",
        detail: dateStr,
        price: null,
      });
      lines.push({
        group: "schedule",
        label: "Time window",
        detail: dateData.timeWindow,
        price: null,
      });
    }

    return {
      currentTab,
      currentStep,
      hasItems,
      subtotal,
      lines,
      duration,
      isRolling,
      rawCollectionFee,
    };
  },

  notify() {
    this.dispatch({ type: "UPDATE" });
  },
};
