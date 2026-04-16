import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createMapsApiGuard } from "./maps-api-guard.js";

describe("createMapsApiGuard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows autocomplete up to limit then blocks within one minute", () => {
    const g = createMapsApiGuard({ minCharsAutocomplete: 2 });
    for (let i = 0; i < 36; i += 1) {
      expect(g.tryAutocomplete()).toBe(true);
    }
    expect(g.tryAutocomplete()).toBe(false);
    expect(g.getLastMessage()).toMatch(/Too many address searches/i);
  });

  it("enters cooldown after repeated failures", () => {
    const g = createMapsApiGuard();
    for (let i = 0; i < 5; i += 1) {
      g.recordFailure(500);
    }
    expect(g.tryAutocomplete()).toBe(false);
    expect(g.getLastMessage()).toMatch(/paused/i);
  });
});

describe("tryDistanceMatrix", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows distance matrix up to limit then blocks", () => {
    const g = createMapsApiGuard();
    for (let i = 0; i < 24; i += 1) {
      expect(g.tryDistanceMatrix()).toBe(true);
    }
    expect(g.tryDistanceMatrix()).toBe(false);
    expect(g.getLastMessage()).toMatch(/distance/i);
  });

  it("returns false with message during cooldown", () => {
    const g = createMapsApiGuard();
    for (let i = 0; i < 5; i += 1) {
      g.recordFailure(500);
    }
    expect(g.tryDistanceMatrix()).toBe(false);
    expect(g.getLastMessage()).toMatch(/paused/i);
  });

  it("recovers after cooldown expires", () => {
    const g = createMapsApiGuard();
    for (let i = 0; i < 5; i += 1) {
      g.recordFailure(500);
    }
    expect(g.tryDistanceMatrix()).toBe(false);
    vi.advanceTimersByTime(121000);
    expect(g.tryDistanceMatrix()).toBe(true);
  });
});
