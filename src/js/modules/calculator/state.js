export const store = {
  currentTab: "boxes",
  currentStep: 1,

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

    // Step 1
    if (currentTab === "boxes") {
      itemsData.forEach((item) => {
        if (item.qty > 0) {
          hasItems = true;
          const itemTotal = item.qty * item.price;
          subtotal += itemTotal;
          lines.push({
            label: `${item.qty}x ${item.name}`,
            price: itemTotal,
            suffix: "",
          });
        }
      });
    } else {
      if (selectedUnit) {
        hasItems = true;
        subtotal = selectedUnit.price;
        lines.push({
          label: `1x ${selectedUnit.name} (${selectedUnit.size})`,
          price: subtotal,
          suffix: "/wk",
        });
      }
    }

    // Step 2
    if (currentStep >= 2 && addr && hasItems) {
      if (addr.mode === "collection") {
        let collFee = 30.0;
        let details = "Collection";

        if (addr.propType === "apartment") {
          collFee += 30.0 * 0.1;
          if (addr.lift === "no") {
            const floorNum = Math.max(1, addr.floor);
            collFee += 30.0 * (0.05 * floorNum);
          }
          details += ` (Apt, Fl ${addr.floor})`;
        } else {
          details += ` (Ground)`;
        }

        if (addr.movers === "2") {
          collFee += 45.0;
          details += ", 2 Movers";
        }

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

        subtotal += collFee;
        lines.push({ label: details, price: collFee, suffix: "" });
      } else {
        const facName =
          addr.facility === "bloomsbury" ? "Bloomsbury" : "Hackney";
        lines.push({ label: `Drop-off (${facName})`, price: 0, suffix: "" });
      }
    }

    // Step 3 - Добавляем Дату и Время в сайдбар (как текст без цены)
    if (currentStep >= 3 && dateData) {
      const dateStr = dateData.date.toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
      });
      lines.push({ label: `Date: ${dateStr}`, price: 0, suffix: "" });
      lines.push({
        label: `Time: ${dateData.timeWindow}`,
        price: 0,
        suffix: "",
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
