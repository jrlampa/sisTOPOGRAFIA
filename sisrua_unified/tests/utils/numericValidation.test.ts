import { describe, it, expect } from "vitest";
import {
  validatePositiveInteger,
  validateCoordinate,
  validateRadius,
  validateDecimal,
  validateNumericFields,
  parseUserInputNumber,
} from "../../src/utils/numericValidation";

// ---------------------------------------------------------------------------
// validatePositiveInteger
// ---------------------------------------------------------------------------

describe("validatePositiveInteger", () => {
  it("accepts a valid positive integer string", () => {
    const result = validatePositiveInteger("5", "count");
    expect(result.valid).toBe(true);
    expect(result.value).toBe(5);
  });

  it("accepts a numeric value directly", () => {
    const result = validatePositiveInteger(10, "id");
    expect(result.valid).toBe(true);
    expect(result.value).toBe(10);
  });

  it("accepts zero", () => {
    const result = validatePositiveInteger(0, "count");
    expect(result.valid).toBe(true);
    expect(result.value).toBe(0);
  });

  it("rejects NaN string", () => {
    const result = validatePositiveInteger("abc", "count");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/número válido/);
  });

  it("rejects a float", () => {
    const result = validatePositiveInteger("3.5", "count");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/inteiro/);
  });

  it("rejects a negative integer", () => {
    const result = validatePositiveInteger(-1, "count");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/negativo/);
  });

  it("rejects a value exceeding max", () => {
    const result = validatePositiveInteger(200, "count", 100);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/100/);
  });

  it("accepts a value equal to max", () => {
    const result = validatePositiveInteger(100, "count", 100);
    expect(result.valid).toBe(true);
  });

  it("uses 'field' as default field name in error messages", () => {
    const result = validatePositiveInteger("abc");
    expect(result.error).toContain("field");
  });
});

// ---------------------------------------------------------------------------
// validateCoordinate
// ---------------------------------------------------------------------------

describe("validateCoordinate", () => {
  it("accepts a valid latitude", () => {
    const result = validateCoordinate(-22.9068, "latitude");
    expect(result.valid).toBe(true);
    expect(result.value).toBeCloseTo(-22.9068);
  });

  it("accepts boundary latitudes", () => {
    expect(validateCoordinate(-90, "latitude").valid).toBe(true);
    expect(validateCoordinate(90, "latitude").valid).toBe(true);
  });

  it("rejects out-of-range latitude", () => {
    expect(validateCoordinate(91, "latitude").valid).toBe(false);
    expect(validateCoordinate(-91, "latitude").valid).toBe(false);
  });

  it("accepts a valid longitude", () => {
    const result = validateCoordinate(-43.1729, "longitude");
    expect(result.valid).toBe(true);
  });

  it("accepts boundary longitudes", () => {
    expect(validateCoordinate(-180, "longitude").valid).toBe(true);
    expect(validateCoordinate(180, "longitude").valid).toBe(true);
  });

  it("rejects out-of-range longitude", () => {
    expect(validateCoordinate(181, "longitude").valid).toBe(false);
    expect(validateCoordinate(-181, "longitude").valid).toBe(false);
  });

  it("rejects NaN", () => {
    const result = validateCoordinate(NaN, "latitude");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/número válido/);
  });
});

// ---------------------------------------------------------------------------
// validateRadius
// ---------------------------------------------------------------------------

describe("validateRadius", () => {
  it("accepts a valid radius in the allowed range", () => {
    const result = validateRadius(5000);
    expect(result.valid).toBe(true);
    expect(result.value).toBe(5000);
  });

  it("accepts boundary values", () => {
    expect(validateRadius(100).valid).toBe(true);
    expect(validateRadius(50000).valid).toBe(true);
  });

  it("rejects radius below minimum", () => {
    const result = validateRadius(50);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("100");
  });

  it("rejects radius above maximum", () => {
    const result = validateRadius(60000);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("50000");
  });

  it("rejects NaN", () => {
    const result = validateRadius(NaN);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/número válido/);
  });
});

// ---------------------------------------------------------------------------
// validateDecimal
// ---------------------------------------------------------------------------

describe("validateDecimal", () => {
  it("accepts a value within range", () => {
    const result = validateDecimal(0.85, 0, 1, "fator");
    expect(result.valid).toBe(true);
    expect(result.value).toBe(0.85);
  });

  it("accepts boundary values", () => {
    expect(validateDecimal(0, 0, 1, "f").valid).toBe(true);
    expect(validateDecimal(1, 0, 1, "f").valid).toBe(true);
  });

  it("rejects values outside range", () => {
    expect(validateDecimal(-0.1, 0, 1, "f").valid).toBe(false);
    expect(validateDecimal(1.1, 0, 1, "f").valid).toBe(false);
  });

  it("rejects NaN", () => {
    const result = validateDecimal(NaN, 0, 1, "f");
    expect(result.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateNumericFields
// ---------------------------------------------------------------------------

describe("validateNumericFields", () => {
  it("validates multiple fields and returns results keyed by field name", () => {
    const results = validateNumericFields({
      lat: { value: -22.9, min: -90, max: 90 },
      lng: { value: -43.1, min: -180, max: 180 },
      radius: { value: 5000, min: 100, max: 50000 },
    });

    expect(results.lat.valid).toBe(true);
    expect(results.lng.valid).toBe(true);
    expect(results.radius.valid).toBe(true);
  });

  it("marks invalid fields correctly", () => {
    const results = validateNumericFields({
      lat: { value: 200, min: -90, max: 90 },
    });

    expect(results.lat.valid).toBe(false);
  });

  it("handles an empty field map", () => {
    const results = validateNumericFields({});
    expect(Object.keys(results)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// parseUserInputNumber
// ---------------------------------------------------------------------------

describe("parseUserInputNumber", () => {
  it("parses a valid numeric string within range", () => {
    const result = parseUserInputNumber("123.45", 0, 1000);
    expect(result.valid).toBe(true);
    expect(result.value).toBeCloseTo(123.45);
  });

  it("rejects an empty string", () => {
    const result = parseUserInputNumber("  ", 0, 1000);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/obrigatório/);
  });

  it("rejects a non-numeric string", () => {
    const result = parseUserInputNumber("abc", 0, 1000);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/numérico/);
  });

  it("rejects a value below min", () => {
    const result = parseUserInputNumber("-10", 0, 1000, "Raio");
    expect(result.valid).toBe(false);
  });

  it("rejects a value above max", () => {
    const result = parseUserInputNumber("2000", 0, 1000, "Raio");
    expect(result.valid).toBe(false);
  });

  it("trims whitespace from input", () => {
    const result = parseUserInputNumber("  500  ", 0, 1000);
    expect(result.valid).toBe(true);
    expect(result.value).toBe(500);
  });
});
