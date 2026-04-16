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

describe("calculateCollectionFee – overload surcharge", () => {
  it("light overload (volume between vanCapacity=18 and overloadThreshold=20) applies 1.5x multiplier", () => {
    const result = calculateCollectionFee({
      volume: 19,
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
    // Light overload adds 50% of basePrice
    const expectedFee = result.basePrice * 1.5;
    expect(result.collectionFee).toBeCloseTo(expectedFee, 1);
  });

  it("heavy overload (volume above overloadThreshold=20) applies 2.0x multiplier", () => {
    const result = calculateCollectionFee({
      volume: 22,
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
    // Heavy overload adds 100% of basePrice
    const expectedFee = result.basePrice * 2.0;
    expect(result.collectionFee).toBeCloseTo(expectedFee, 1);
  });

  it("no overload surcharge when volume is 17 (below vanCapacity=18)", () => {
    const result = calculateCollectionFee({
      volume: 17,
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
    // No overload: collectionFee equals basePrice
    expect(result.collectionFee).toBeCloseTo(result.basePrice, 1);
  });
});

describe("calculateCollectionFee – floor multiplier", () => {
  it("apartment floor=0 is same as ground (multiplier 1.0)", () => {
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
    const aptFloor0 = calculateCollectionFee({
      volume: 5.0,
      distanceMiles: 5,
      propType: "apartment",
      floor: 0,
      lift: "yes",
      dateData: null,
      extrasData: null,
      cfg: {},
      vatCfg: { enabled: false },
      extrasList: [],
    });
    expect(aptFloor0.collectionFee).toBeCloseTo(ground.collectionFee, 2);
  });

  it("apartment floor=2 with lift applies small multiplier increase (0.015 per floor)", () => {
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
    const aptLift = calculateCollectionFee({
      volume: 5.0,
      distanceMiles: 5,
      propType: "apartment",
      floor: 2,
      lift: "yes",
      dateData: null,
      extrasData: null,
      cfg: {},
      vatCfg: { enabled: false },
      extrasList: [],
    });
    // Floor multiplier = 1 + 2 * 0.015 = 1.03 — only affects loading, not unloading
    expect(aptLift.collectionFee).toBeGreaterThan(ground.collectionFee);
    expect(aptLift.loadingTime).toBeCloseTo(ground.loadingTime * 1.03, 1);
  });

  it("apartment floor=4 with no lift applies large multiplier increase (0.25 per floor)", () => {
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
    const aptNoLift = calculateCollectionFee({
      volume: 5.0,
      distanceMiles: 5,
      propType: "apartment",
      floor: 4,
      lift: "no",
      dateData: null,
      extrasData: null,
      cfg: {},
      vatCfg: { enabled: false },
      extrasList: [],
    });
    // Floor multiplier = 1 + 4 * 0.25 = 2.0 — only affects loading
    expect(aptNoLift.collectionFee).toBeGreaterThan(ground.collectionFee);
    expect(aptNoLift.loadingTime).toBeCloseTo(ground.loadingTime * 2.0, 1);
  });
});

describe("calculateCollectionFee – extras + VAT combined", () => {
  it("VAT applies to (rawPrice + extras) when enabled", () => {
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
      vatCfg: { enabled: true, applyToCollection: true, rate: 0.20 },
      extrasList: extras,
    });
    expect(result.extrasPrice).toBe(60);
    const expectedVat = (result.rawCollectionFee + result.extrasPrice) * 0.20;
    expect(result.vatAmount).toBeCloseTo(expectedVat, 2);
    expect(result.collectionFee).toBeCloseTo(
      result.rawCollectionFee + result.extrasPrice + result.vatAmount,
      2
    );
  });
});

describe("calculateCollectionFee – boundary at smallJobThreshold", () => {
  it("volume exactly 2.0 is NOT a small job (formula uses < not <=)", () => {
    const result = calculateCollectionFee({
      volume: 2.0,
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
    // Normal job uses time-based formula: loading and unloading scale with volume
    // Small job would use fixed loading=15, unloading=10
    // At 2.0m3 with normal formula, loading = efficiency * 2.0 * 1.0
    const efficiency = 9.5 * (2.2 / 1.2); // ~17.42
    const expectedLoading = efficiency * 2.0 * 1.0;
    expect(result.loadingTime).toBeCloseTo(expectedLoading, 1);
  });

  it("volume 1.99 IS a small job", () => {
    const result = calculateCollectionFee({
      volume: 1.99,
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
    // Small job uses fixed loading time of 15 min
    expect(result.loadingTime).toBe(15);
    expect(result.unloadingTime).toBe(10);
  });
});

describe("calculateCollectionFee – flag-only extras", () => {
  it("extra with price=0 and perItem=false does not add to extrasPrice", () => {
    const extras = [
      { id: "packing", name: "Packing", price: 0, perItem: false },
    ];
    const result = calculateCollectionFee({
      volume: 5.0,
      distanceMiles: 5,
      propType: "ground",
      floor: 0,
      lift: "yes",
      dateData: null,
      extrasData: { quantities: {}, flags: ["packing"] },
      cfg: {},
      vatCfg: { enabled: false },
      extrasList: extras,
    });
    expect(result.extrasPrice).toBe(0);
  });
});
