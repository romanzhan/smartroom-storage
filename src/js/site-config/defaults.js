export const SITE_CONFIG_VERSION = 1;

export const defaultSiteConfig = {
  version: SITE_CONFIG_VERSION,
  globalDiscount: 45,
  restrictToAllowedPostcodes: false,
  warehouseLatitude: 51.5229,
  warehouseLongitude: -0.1195,

  // ── Collection / Moving pricing ──────────────────────────────
  collection: {
    // Mover hourly rates (£/hour)
    moverRates: { 1: 72, 2: 84, 3: 120 },
    // Time per cubic metre (minutes)
    baseTimePerCubicMeter: 9.5,
    // Mover efficiency divisor
    moverEfficiencyFactor: 2.2,
    // Floor multipliers per floor
    floorMultiplierNoLift: 0.25,
    floorMultiplierWithLift: 0.015,
    // Travel time
    travelTimePerMile: 3,        // minutes per mile
    fixedDelayMinutes: 85,       // London traffic delay
    // Small job overrides (volume < smallJobThreshold)
    smallJobThreshold: 2,        // m³
    smallJobLoadingTime: 15,     // fixed minutes
    smallJobUnloadingTime: 10,   // fixed minutes
    smallJobTravelPerMile: 2,    // minutes per mile
    smallJobTravelDelay: 20,     // fixed delay minutes
    smallJobDefaultMiles: 3,     // default miles when unknown
    smallJobMinPrice: 65,        // minimum price (£) before VAT
    // Normal job defaults
    normalJobDefaultMiles: 5,    // default miles when unknown
    // Auto-upgrade movers threshold
    autoUpgradeThreshold: 10,    // m³ — above this, auto-add 1 mover
    // Overload thresholds
    vanCapacity: 18,             // m³
    overloadThreshold: 20,       // m³
    overloadLightMultiplier: 1.5,  // 18–20 m³
    overloadHeavyMultiplier: 2.0,  // >20 m³
    // Surcharges (as decimal fractions)
    urgencyDaysThreshold: 4,     // days — less than this = urgent
    urgencySurcharge: 0.20,      // +20%
    weekendSurcharge: 0.15,      // +15%
    holidaySurcharge: 0.20,      // +20% (replaces weekend)
    twoHourWindowSurcharge: 0.10, // +10%
  },

  // ── VAT ──────────────────────────────────────────────────────
  vat: {
    enabled: true,
    rate: 0.20,                  // 20%
    applyToCollection: true,     // VAT on collection fee
    applyToStorage: false,       // VAT on storage monthly
  },

  // ── Extras (add-on services) ─────────────────────────────────
  extras: [
    { id: "dismantling", name: "Dismantling & Reassembly", price: 20, perItem: true },
    { id: "packing", name: "Packing Service", price: 0, perItem: false },
    { id: "unpacking", name: "Unpacking Service", price: 0, perItem: false },
    { id: "end_of_tenancy", name: "End of Tenancy Cleaning", price: 0, perItem: false },
  ],

  allowedPostcodes: [
    "SW1A 1AA",
    "SW1A 2AA",
    "SW1A 2AB",
    "SW1P 3PA",
    "EC1A 1BB",
    "W1A 0AX",
    "E1 6AN",
    "SE1 9SG",
    "N1 9GU",
  ],
  items: [
    { id: "small_box", name: "Small Box", desc: "(45 x 35 x 35cm)", price: 8.20, volume: 0.055 },
    { id: "medium_box", name: "Medium box", desc: "(50 x 40 x 40cm)", price: 11.30, volume: 0.08 },
    { id: "large_box", name: "Large box", desc: "(70 x 50 x 45cm)", price: 20.40, volume: 0.158 },
    {
      id: "suitcase",
      name: "Suitcase",
      desc: "(must be in a box or have a hard shell)",
      price: 19.40,
      volume: 0.12,
    },
    {
      id: "medium_bag",
      name: "Medium bag",
      desc: "(55 x 40 x 35cm) As strong as IKEA bag",
      price: 13.50,
      volume: 0.077,
    },
    {
      id: "guitar",
      name: "Guitar",
      desc: "(In hard case)",
      price: 30.00,
      volume: 0.15,
    },
    {
      id: "plastic_box",
      name: "Medium plastic box",
      desc: "Heavy-duty crate (approx 60x40x35cm)",
      price: 15.00,
      volume: 0.084,
    },
  ],
};
