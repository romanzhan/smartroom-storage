import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  parseAddressComponents,
  placeDetailsToResolved,
  fetchPlaceAutocomplete,
  greatCircleDistanceMiles,
} from "./google-places.js";

describe("parseAddressComponents", () => {
  it("extracts UK-style parts", () => {
    const c = [
      { types: ["street_number"], longText: "10" },
      { types: ["route"], longText: "Downing Street" },
      { types: ["postal_town"], longText: "London" },
      { types: ["postal_code"], longText: "SW1A 2AA" },
    ];
    const p = parseAddressComponents(c);
    expect(p.postcode).toBe("SW1A 2AA");
    expect(p.addressLine1).toBe("10 Downing Street");
    expect(p.town).toBe("London");
  });
});

describe("placeDetailsToResolved", () => {
  it("maps Places API (New) place resource", () => {
    const r = placeDetailsToResolved({
      name: "places/ChIJxyz",
      formattedAddress: "10 Test St, London",
      location: { latitude: 51.5, longitude: -0.12 },
      addressComponents: [
        { types: ["postal_code"], longText: "W1A 1AA" },
        { types: ["route"], longText: "Test St" },
        { types: ["street_number"], longText: "10" },
      ],
    });
    expect(r.placeId).toBe("ChIJxyz");
    expect(r.postcode).toBe("W1A 1AA");
    expect(r.lat).toBe(51.5);
    expect(r.lng).toBe(-0.12);
  });

  it("returns null without coordinates", () => {
    expect(placeDetailsToResolved(null)).toBeNull();
    expect(placeDetailsToResolved({ addressComponents: [] })).toBeNull();
  });
});

describe("fetchPlaceAutocomplete", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns place predictions from suggestions", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        suggestions: [
          {
            placePrediction: {
              placeId: "ChIJ1",
              text: { text: "1 Street, London" },
            },
          },
        ],
      }),
    });
    const out = await fetchPlaceAutocomplete("lon", "tok", "key");
    expect(out.ok).toBe(true);
    expect(out.predictions).toEqual([
      { placeId: "ChIJ1", text: "1 Street, London" },
    ]);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toMatchObject({
      input: "lon",
      languageCode: "en-GB",
      includedRegionCodes: ["gb"],
      includedPrimaryTypes: ["postal_code"],
      sessionToken: "tok",
    });
  });

  it("returns empty predictions when API key missing", async () => {
    const out = await fetchPlaceAutocomplete("x", "tok", "");
    expect(out.ok).toBe(false);
    expect(out.predictions).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe("greatCircleDistanceMiles", () => {
  it("is ~0 for identical coordinates", () => {
    expect(greatCircleDistanceMiles(51.5, -0.12, 51.5, -0.12)).toBeCloseTo(0, 5);
  });

  it("returns null for invalid inputs", () => {
    expect(greatCircleDistanceMiles(NaN, 0, 0, 0)).toBeNull();
  });

  it("returns a small positive distance for nearby London points", () => {
    const mi = greatCircleDistanceMiles(51.5074, -0.1278, 51.5229, -0.1195);
    expect(mi).toBeGreaterThan(0.5);
    expect(mi).toBeLessThan(5);
  });
});
