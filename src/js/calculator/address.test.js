import { describe, it, expect } from "vitest";
import { dedupeAddressLine1 } from "./address.js";

describe("dedupeAddressLine1", () => {
  it("keeps real street line", () => {
    expect(dedupeAddressLine1("10 Downing Street", "London", "SW1A 2AA")).toBe(
      "10 Downing Street",
    );
  });

  it("clears when line is only postcode", () => {
    expect(dedupeAddressLine1("SW1A 2AA", "London", "SW1A 2AA")).toBe("");
  });

  it("clears when line is only town", () => {
    expect(dedupeAddressLine1("London", "London", "SW1A 2AA")).toBe("");
  });

  it("clears town + postcode combo", () => {
    expect(dedupeAddressLine1("London SW1A 2AA", "London", "SW1A 2AA")).toBe("");
  });

  it("clears town, postcode, UK tail", () => {
    expect(
      dedupeAddressLine1("London, SW1A 2AA, UK", "London", "SW1A 2AA"),
    ).toBe("");
  });
});
