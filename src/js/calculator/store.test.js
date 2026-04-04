import { describe, it, expect, beforeEach } from "vitest";
import { store, distanceSurchargePounds } from "./store.js";

function resetStore() {
  store.currentTab = "boxes";
  store.currentStep = 1;
  store.siteConfig = null;
  store.modules = {
    items: null,
    units: null,
    durationBoxes: null,
    durationFurn: null,
    address: null,
    date: null,
  };
  store._listeners = [];
}

describe("store.getSnapshot", () => {
  beforeEach(() => {
    resetStore();
  });

  it("boxes: empty cart has no items and zero subtotal", () => {
    store.modules.items = { getData: () => [] };
    store.modules.durationBoxes = {
      getDuration: () => 3,
      isRollingPlan: () => false,
    };
    const s = store.getSnapshot();
    expect(s.hasItems).toBe(false);
    expect(s.subtotal).toBe(0);
    expect(s.lines.length).toBe(0);
  });

  it("boxes: sums line totals and adds duration line", () => {
    store.modules.items = {
      getData: () => [
        { name: "Small box", qty: 2, price: 10 },
        { name: "Large box", qty: 1, price: 15 },
      ],
    };
    store.modules.durationBoxes = {
      getDuration: () => 4,
      isRollingPlan: () => false,
    };
    const s = store.getSnapshot();
    expect(s.hasItems).toBe(true);
    expect(s.subtotal).toBe(35);
    expect(s.lines[0].label).toBe("2x Small box");
    expect(s.lines[0].price).toBe(20);
    expect(s.lines[1].label).toBe("1x Large box");
    expect(s.lines[1].price).toBe(15);
    expect(s.lines[2].label).toBe("Storing for: 4 months");
    expect(s.lines[2].price).toBeNull();
  });

  it("furniture: unit line includes weekly suffix", () => {
    store.currentTab = "furniture";
    store.modules.units = {
      getSelectedUnit: () => ({
        name: "Unit A",
        size: "10 sq ft",
        price: 49.99,
      }),
    };
    store.modules.durationFurn = {
      getDuration: () => null,
      isRollingPlan: () => false,
    };
    const s = store.getSnapshot();
    expect(s.hasItems).toBe(true);
    expect(s.subtotal).toBe(49.99);
    expect(s.lines[0].suffix).toBe("/wk");
    expect(s.lines[0].label).toContain("Unit A");
  });

  it("collection: Collection fee is first service line", () => {
    store.modules.items = {
      getData: () => [{ name: "Box", qty: 1, price: 5 }],
    };
    store.modules.durationBoxes = {
      getDuration: () => 1,
      isRollingPlan: () => false,
    };
    store.currentStep = 2;
    store.modules.address = {
      getData: () => ({
        mode: "collection",
        address: "10 Test St",
        propType: "ground",
        movers: "1",
        instructions: "",
      }),
    };
    const s = store.getSnapshot();
    const service = s.lines.filter((l) => l.group === "service");
    expect(service[0].label).toBe("Collection fee");
    expect(typeof service[0].price).toBe("number");
    expect(service[1].label).toBe("Service");
    expect(s.subtotal).toBe(5 + service[0].price);
  });

  it("distanceSurchargePounds respects free miles and per-mile rate", () => {
    const cfg = { distancePricing: { freeMiles: 15, pricePerMile: 2 } };
    expect(distanceSurchargePounds(10, cfg)).toBe(0);
    expect(distanceSurchargePounds(20, cfg)).toBe(10);
    expect(distanceSurchargePounds(null, cfg)).toBe(0);
  });

  it("collection fee includes distance surcharge when distanceMiles set", () => {
    store.siteConfig = {
      distancePricing: { freeMiles: 0, pricePerMile: 1 },
      baseFeeBoxes: 0,
    };
    store.modules.items = {
      getData: () => [{ name: "Box", qty: 1, price: 0 }],
    };
    store.modules.durationBoxes = {
      getDuration: () => 1,
      isRollingPlan: () => false,
    };
    store.currentStep = 2;
    store.modules.address = {
      getData: () => ({
        mode: "collection",
        address: "Far away",
        distanceMiles: 25,
        propType: "ground",
        movers: "1",
        instructions: "",
      }),
    };
    const s = store.getSnapshot();
    const feeLine = s.lines.find(
      (l) => l.group === "service" && l.label === "Collection fee",
    );
    expect(feeLine.price).toBeCloseTo(30 + 25, 5);
    const distLine = s.lines.find(
      (l) => l.group === "service" && l.label === "Driving distance (est.)",
    );
    expect(distLine.detail).toContain("25.0");
  });

  it("drop-off: single line with variant dropoff", () => {
    store.modules.items = {
      getData: () => [{ name: "Box", qty: 1, price: 5 }],
    };
    store.modules.durationBoxes = {
      getDuration: () => 1,
      isRollingPlan: () => false,
    };
    store.currentStep = 2;
    store.modules.address = {
      getData: () => ({
        mode: "dropoff",
        facility: "bloomsbury",
      }),
    };
    const s = store.getSnapshot();
    const service = s.lines.filter((l) => l.group === "service");
    expect(service.length).toBe(1);
    expect(service[0].label).toBe("Drop-off at Bloomsbury");
    expect(service[0].variant).toBe("dropoff");
    expect(s.subtotal).toBe(5);
  });

  it("collection fee applies date multipliers from step 3", () => {
    store.modules.items = {
      getData: () => [{ name: "Box", qty: 1, price: 0 }],
    };
    store.modules.durationBoxes = {
      getDuration: () => 1,
      isRollingPlan: () => false,
    };
    store.currentStep = 3;
    store.modules.address = {
      getData: () => ({
        mode: "collection",
        address: "1 St",
        propType: "ground",
        movers: "1",
        instructions: "",
      }),
    };
    const baseDate = new Date(2026, 5, 10, 12, 0, 0);
    store.modules.date = {
      getData: () => ({
        date: baseDate,
        timeWindow: "2:00 PM - 8:00 PM",
        windowType: "6-hour",
        isWeekend: true,
        isHoliday: false,
        isUrgent: false,
        hasInteracted: true,
      }),
    };
    const s = store.getSnapshot();
    const feeLine = s.lines.find(
      (l) => l.group === "service" && l.label === "Collection fee",
    );
    expect(feeLine.price).toBeCloseTo(30 * 1.15, 5);
  });

  it("schedule lines appear from step 3 when date module set", () => {
    store.modules.items = {
      getData: () => [{ name: "Box", qty: 1, price: 1 }],
    };
    store.modules.durationBoxes = {
      getDuration: () => 1,
      isRollingPlan: () => false,
    };
    store.currentStep = 3;
    store.modules.address = {
      getData: () => ({ mode: "dropoff", facility: "hackney" }),
    };
    const baseDate = new Date(2026, 3, 6, 12, 0, 0);
    store.modules.date = {
      getData: () => ({
        date: baseDate,
        timeWindow: "Morning",
        windowType: "6-hour",
        isWeekend: false,
        isHoliday: false,
        isUrgent: false,
        hasInteracted: true,
      }),
    };
    const s = store.getSnapshot();
    const sched = s.lines.filter((l) => l.group === "schedule");
    expect(sched.length).toBe(2);
    expect(sched[0].label).toBe("Date");
    expect(sched[0].detail).toMatch(/2026/);
    expect(sched[1].label).toBe("Time window");
    expect(sched[1].detail).toBe("Morning");
  });
});
