import { describe, it, expect, beforeEach } from "vitest";
import { store, calculateCollectionFee } from "./store.js";

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
    extras: null,
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
  });

  it("boxes: sums storage prices correctly", () => {
    store.modules.items = {
      getData: () => [
        { name: "Small box", qty: 2, price: 10, volume: 0.05 },
        { name: "Large box", qty: 1, price: 15, volume: 0.2 },
      ],
    };
    store.modules.durationBoxes = {
      getDuration: () => 4,
      isRollingPlan: () => false,
    };
    const s = store.getSnapshot();
    expect(s.hasItems).toBe(true);
    expect(s.storagePrice).toBe(35);
    expect(s.subtotal).toBe(35);
    expect(s.totalVolume).toBeCloseTo(0.3, 5);
  });

  it("furniture: unit price used as storage price", () => {
    store.currentTab = "furniture";
    store.modules.units = {
      getSelectedUnit: () => ({
        name: "Unit A",
        size: "10 sq ft",
        price: 49.99,
        volume: 2.0,
      }),
    };
    store.modules.durationFurn = {
      getDuration: () => null,
      isRollingPlan: () => false,
    };
    const s = store.getSnapshot();
    expect(s.hasItems).toBe(true);
    expect(s.storagePrice).toBe(49.99);
    expect(s.totalVolume).toBe(2.0);
  });
});

describe("calculateCollectionFee", () => {
  it("small job gets minimum price", () => {
    const result = calculateCollectionFee({
      volume: 1.0,
      distanceMiles: 5,
      propType: "ground",
      floor: 0,
      lift: "yes",
      dateData: null,
      extrasData: null,
      cfg: {},
      vatCfg: { enabled: false },
      extrasList: [],
    });
    expect(result.collectionFee).toBeGreaterThanOrEqual(65);
    expect(result.movers).toBe(1);
  });

  it("normal job calculates time-based price", () => {
    const result = calculateCollectionFee({
      volume: 5.0,
      distanceMiles: 10,
      propType: "ground",
      floor: 0,
      lift: "yes",
      dateData: null,
      extrasData: null,
      cfg: {},
      vatCfg: { enabled: false },
      extrasList: [],
    });
    // 5m³, 1 mover (£72/hr), efficiency = 9.5 * (2.2/1.2) = 17.42
    // loading = 17.42 * 5 * 1.0 = 87.08
    // unloading = 17.42 * 5 * 1.0 = 87.08
    // travel = 10 * 3 + 85 = 115
    // total = 289.17 min = 4.82 hr * £72 = £347
    expect(result.collectionFee).toBeGreaterThan(300);
    expect(result.movers).toBe(1);
  });

  it("apartment without lift increases loading time", () => {
    const ground = calculateCollectionFee({
      volume: 5.0,
      distanceMiles: 5,
      propType: "ground",
      floor: 0,
      lift: "yes",
      dateData: null,
      extrasData: null,
      cfg: {},
      vatCfg: { enabled: false },
      extrasList: [],
    });
    const apt = calculateCollectionFee({
      volume: 5.0,
      distanceMiles: 5,
      propType: "apartment",
      floor: 3,
      lift: "no",
      dateData: null,
      extrasData: null,
      cfg: {},
      vatCfg: { enabled: false },
      extrasList: [],
    });
    expect(apt.collectionFee).toBeGreaterThan(ground.collectionFee);
  });

  it("weekend surcharge adds 15%", () => {
    const normal = calculateCollectionFee({
      volume: 5.0,
      distanceMiles: 5,
      propType: "ground",
      floor: 0,
      lift: "yes",
      dateData: { isWeekend: false, isHoliday: false, isUrgent: false, windowType: "6-hour" },
      extrasData: null,
      cfg: {},
      vatCfg: { enabled: false },
      extrasList: [],
    });
    const weekend = calculateCollectionFee({
      volume: 5.0,
      distanceMiles: 5,
      propType: "ground",
      floor: 0,
      lift: "yes",
      dateData: { isWeekend: true, isHoliday: false, isUrgent: false, windowType: "6-hour" },
      extrasData: null,
      cfg: {},
      vatCfg: { enabled: false },
      extrasList: [],
    });
    expect(weekend.collectionFee).toBeCloseTo(normal.collectionFee * 1.15, 1);
  });

  it("VAT adds 20% when enabled", () => {
    const noVat = calculateCollectionFee({
      volume: 5.0,
      distanceMiles: 5,
      propType: "ground",
      floor: 0,
      lift: "yes",
      dateData: null,
      extrasData: null,
      cfg: {},
      vatCfg: { enabled: false },
      extrasList: [],
    });
    const withVat = calculateCollectionFee({
      volume: 5.0,
      distanceMiles: 5,
      propType: "ground",
      floor: 0,
      lift: "yes",
      dateData: null,
      extrasData: null,
      cfg: {},
      vatCfg: { enabled: true, applyToCollection: true, rate: 0.20 },
      extrasList: [],
    });
    expect(withVat.collectionFee).toBeCloseTo(noVat.collectionFee * 1.20, 1);
    expect(withVat.vatAmount).toBeGreaterThan(0);
  });

  it("auto-upgrades to 2 movers above 10 m³", () => {
    const result = calculateCollectionFee({
      volume: 12.0,
      distanceMiles: 5,
      propType: "ground",
      floor: 0,
      lift: "yes",
      dateData: null,
      extrasData: null,
      cfg: {},
      vatCfg: { enabled: false },
      extrasList: [],
    });
    expect(result.movers).toBe(2);
  });

  it("extras add to collection fee", () => {
    const extras = [
      { id: "dismantling", name: "Dismantling", price: 20, perItem: true },
    ];
    const result = calculateCollectionFee({
      volume: 5.0,
      distanceMiles: 5,
      propType: "ground",
      floor: 0,
      lift: "yes",
      dateData: null,
      extrasData: { quantities: { dismantling: 3 }, flags: [] },
      cfg: {},
      vatCfg: { enabled: false },
      extrasList: extras,
    });
    expect(result.extrasPrice).toBe(60);
  });
});
