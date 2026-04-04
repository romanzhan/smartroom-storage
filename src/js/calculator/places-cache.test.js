import { describe, it, expect, beforeEach } from "vitest";
import {
  getCachedResolvedPlace,
  setCachedResolvedPlace,
  warehouseKeyFromCoords,
} from "./places-cache.js";

function mockLocalStorage() {
  const mem = {};
  globalThis.localStorage = {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null),
    setItem: (k, v) => {
      mem[k] = String(v);
    },
    removeItem: (k) => {
      delete mem[k];
    },
  };
}

describe("places-cache resolved place", () => {
  beforeEach(() => {
    mockLocalStorage();
  });

  it("stores and returns payload for same placeId and warehouse key", () => {
    const wh = warehouseKeyFromCoords(51.52, -0.12);
    const payload = {
      placeId: "ChIJtest",
      postcode: "W1A 1AA",
      distanceMiles: 12.3,
      lat: 51,
      lng: -0.1,
    };
    setCachedResolvedPlace(wh, "ChIJtest", payload);
    const got = getCachedResolvedPlace(wh, "ChIJtest");
    expect(got?.postcode).toBe("W1A 1AA");
    expect(got?.distanceMiles).toBe(12.3);
  });

  it("misses when warehouse key changes", () => {
    setCachedResolvedPlace("51.00000,-0.10000", "ChIJx", { postcode: "X" });
    expect(getCachedResolvedPlace("52.00000,-0.10000", "ChIJx")).toBeNull();
  });
});
