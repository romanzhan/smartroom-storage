export const SITE_CONFIG_VERSION = 1;

export const defaultSiteConfig = {
  version: SITE_CONFIG_VERSION,
  globalDiscount: 45,
  baseFeeBoxes: 0,
  baseFeeFurniture: 25,
  restrictToAllowedPostcodes: false,
  warehouseLatitude: 51.5229,
  warehouseLongitude: -0.1195,
  distancePricing: {
    freeMiles: 15,
    pricePerMile: 0.5,
  },
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
    { id: "small_box", name: "Small Box", desc: "(45 x 30 x 30cm)", price: 4.5 },
    { id: "medium_box", name: "Medium box", desc: "(45 x 40 x 40cm)", price: 6.0 },
    { id: "large_box", name: "Large box", desc: "(70 x 45 x 45cm)", price: 8.5 },
    {
      id: "suitcase",
      name: "Suitcase",
      desc: "(must be in a box or have a hard shell)",
      price: 7.0,
    },
    {
      id: "medium_bag",
      name: "Medium bag",
      desc: "Holdall or duffel bag (approx 60x30x30cm)",
      price: 6.0,
    },
    {
      id: "guitar",
      name: "Guitar",
      desc: "Acoustic or electric (in hard case)",
      price: 9.0,
    },
    {
      id: "plastic_box",
      name: "Medium plastic box",
      desc: "Heavy-duty crate (approx 60x40x35cm)",
      price: 7.5,
    },
  ],
};
