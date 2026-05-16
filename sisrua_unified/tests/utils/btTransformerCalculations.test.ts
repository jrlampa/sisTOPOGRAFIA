import { describe, it, expect } from "vitest";
import {
  getTransformerDemandKva,
  calculateTransformerEnergyKwh,
  calculateTransformerDemandKva,
  calculateTransformerDemandKw,
  calculateTransformerMonthlyBill,
} from "../../src/utils/btTransformerCalculations";
import type { BtTransformerReading } from "../../src/types";

// CURRENT_TO_DEMAND_CONVERSION = 0.375 (from btPhysicalConstants)
// DEFAULT_TEMPERATURE_FACTOR = 1.0 (from btPhysicalConstants)

// ---------------------------------------------------------------------------
// getTransformerDemandKva
// ---------------------------------------------------------------------------

describe("getTransformerDemandKva", () => {
  it("returns demandKw when no readings are provided", () => {
    const result = getTransformerDemandKva({ demandKva: undefined, demandKw: 25 });
    expect(result).toBe(25);
  });

  it("returns demandKva when no readings and demandKw not set", () => {
    const result = getTransformerDemandKva({ demandKva: 50 });
    expect(result).toBe(50);
  });

  it("returns 0 when transformer has no demand fields and no readings", () => {
    const result = getTransformerDemandKva({});
    expect(result).toBe(0);
  });

  it("returns 0 when rawDemand is Infinity", () => {
    const result = getTransformerDemandKva({ demandKva: Infinity });
    expect(result).toBe(0);
  });

  it("uses readings when at least one has a finite currentMaxA", () => {
    // 10A * 0.375 * DEFAULT_TEMPERATURE_FACTOR(1.2) = 4.5 kVA
    const readings: BtTransformerReading[] = [
      { id: "r1", currentMaxA: 10 },
    ];
    const result = getTransformerDemandKva({ demandKva: 999, readings });
    expect(result).toBe(4.5);
  });

  it("picks the highest corrected demand across multiple readings", () => {
    // r1 = 10 * 0.375 * 1.2 = 4.5; r2 = 20 * 0.375 * 1.0 = 7.5 → max = 7.5
    const readings: BtTransformerReading[] = [
      { id: "r1", currentMaxA: 10, temperatureFactor: 1.2 },
      { id: "r2", currentMaxA: 20, temperatureFactor: 1.0 },
    ];
    const result = getTransformerDemandKva({ demandKva: 0, readings });
    expect(result).toBe(7.5);
  });

  it("treats missing currentMaxA as 0 in readings computation", () => {
    // currentMaxA is undefined → ?? 0 → 0 * 0.375 = 0 → max(0, 0) = 0
    const readings: BtTransformerReading[] = [{ id: "r1", currentMaxA: 0 }];
    // hasUsableReadings checks Number.isFinite(reading.currentMaxA) – 0 is finite
    const result = getTransformerDemandKva({ demandKva: 99, readings });
    expect(result).toBe(0);
  });

  it("ignores readings where currentMaxA is not finite, falls back to demandKva", () => {
    const readings: BtTransformerReading[] = [{ id: "r1" }]; // no currentMaxA
    // hasUsableReadings = false (undefined is not finite) → fallback
    const result = getTransformerDemandKva({ demandKva: 15, readings });
    expect(result).toBe(15);
  });
});

// ---------------------------------------------------------------------------
// calculateTransformerEnergyKwh
// ---------------------------------------------------------------------------

describe("calculateTransformerEnergyKwh", () => {
  it("returns 0 for empty readings array", () => {
    expect(calculateTransformerEnergyKwh([])).toBe(0);
  });

  it("computes energy for a valid reading", () => {
    // 100 BRL / 0.5 BRL/kWh = 200 kWh
    expect(
      calculateTransformerEnergyKwh([
        { id: "r1", billedBrl: 100, unitRateBrlPerKwh: 0.5 },
      ]),
    ).toBe(200);
  });

  it("skips reading when unitRateBrlPerKwh is 0", () => {
    expect(
      calculateTransformerEnergyKwh([
        { id: "r1", billedBrl: 100, unitRateBrlPerKwh: 0 },
      ]),
    ).toBe(0);
  });

  it("skips reading when unitRateBrlPerKwh is negative", () => {
    expect(
      calculateTransformerEnergyKwh([
        { id: "r1", billedBrl: 100, unitRateBrlPerKwh: -1 },
      ]),
    ).toBe(0);
  });

  it("skips reading when billedBrl is 0", () => {
    expect(
      calculateTransformerEnergyKwh([
        { id: "r1", billedBrl: 0, unitRateBrlPerKwh: 1 },
      ]),
    ).toBe(0);
  });

  it("accumulates multiple valid readings", () => {
    // 100/0.5 + 50/1.0 = 200 + 50 = 250
    expect(
      calculateTransformerEnergyKwh([
        { id: "r1", billedBrl: 100, unitRateBrlPerKwh: 0.5 },
        { id: "r2", billedBrl: 50, unitRateBrlPerKwh: 1.0 },
      ]),
    ).toBe(250);
  });
});

// ---------------------------------------------------------------------------
// calculateTransformerDemandKva / calculateTransformerDemandKw (alias)
// ---------------------------------------------------------------------------

describe("calculateTransformerDemandKva", () => {
  it("returns 0 for empty readings", () => {
    expect(calculateTransformerDemandKva([])).toBe(0);
  });

  it("picks the max corrected demand across readings", () => {
    // r1 = 10 * 0.375 * 1.2 = 4.5; r2 = 12 * 0.375 * 1.0 = 4.5 → max = 4.5
    const readings: BtTransformerReading[] = [
      { id: "r1", currentMaxA: 10, temperatureFactor: 1.2 },
      { id: "r2", currentMaxA: 12, temperatureFactor: 1.0 },
    ];
    expect(calculateTransformerDemandKva(readings)).toBe(4.5);
  });

  it("is identical to calculateTransformerDemandKw (deprecated alias)", () => {
    const readings: BtTransformerReading[] = [
      { id: "r1", currentMaxA: 8, temperatureFactor: 1.0 },
    ];
    expect(calculateTransformerDemandKva(readings)).toBe(
      calculateTransformerDemandKw(readings),
    );
  });
});

// ---------------------------------------------------------------------------
// calculateTransformerMonthlyBill
// ---------------------------------------------------------------------------

describe("calculateTransformerMonthlyBill", () => {
  it("returns 0 for empty readings", () => {
    expect(calculateTransformerMonthlyBill([])).toBe(0);
  });

  it("sums billedBrl across readings, treating undefined as 0", () => {
    const readings: BtTransformerReading[] = [
      { id: "r1", billedBrl: 100 },
      { id: "r2", billedBrl: 250 },
      { id: "r3" }, // no billedBrl → 0
    ];
    expect(calculateTransformerMonthlyBill(readings)).toBe(350);
  });
});
