import { describe, it, expect } from "vitest";
import {
  parseLatLngQuery,
  parseUtmQuery,
  getUtmZone,
  getUtmBand,
  toUtm,
} from "../../src/utils/geo";

// ---------------------------------------------------------------------------
// parseLatLngQuery
// ---------------------------------------------------------------------------

describe("parseLatLngQuery", () => {
  it("parses simple lat/lng separated by space", () => {
    const result = parseLatLngQuery("-22.9068 -43.1729");
    expect(result).not.toBeNull();
    expect(result!.lat).toBeCloseTo(-22.9068);
    expect(result!.lng).toBeCloseTo(-43.1729);
  });

  it("parses zero coordinates", () => {
    const result = parseLatLngQuery("0 0");
    expect(result).not.toBeNull();
    expect(result!.lat).toBe(0);
    expect(result!.lng).toBe(0);
  });

  it("normalizes comma decimal separator", () => {
    const result = parseLatLngQuery("-22,9068 -43,1729");
    expect(result).not.toBeNull();
    expect(result!.lat).toBeCloseTo(-22.9068);
    expect(result!.lng).toBeCloseTo(-43.1729);
  });

  it("normalizes comma-as-separator to space", () => {
    const result = parseLatLngQuery("-22.9068,-43.1729");
    expect(result).not.toBeNull();
  });

  it("normalizes semicolon-as-separator to space", () => {
    const result = parseLatLngQuery("-22.9068;-43.1729");
    expect(result).not.toBeNull();
  });

  it("strips parentheses", () => {
    const result = parseLatLngQuery("(-22.9068 -43.1729)");
    expect(result).not.toBeNull();
  });

  it("returns null for plain text", () => {
    expect(parseLatLngQuery("Rio de Janeiro")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseLatLngQuery("")).toBeNull();
  });

  it("returns null when latitude is out of range", () => {
    expect(parseLatLngQuery("91 0")).toBeNull();
    expect(parseLatLngQuery("-91 0")).toBeNull();
  });

  it("returns null when longitude is out of range", () => {
    expect(parseLatLngQuery("0 181")).toBeNull();
    expect(parseLatLngQuery("0 -181")).toBeNull();
  });

  it("includes a label in the result", () => {
    const result = parseLatLngQuery("-22.9068 -43.1729");
    expect(result!.label).toContain("Lat/Lng");
  });
});

// ---------------------------------------------------------------------------
// parseUtmQuery
// ---------------------------------------------------------------------------

describe("parseUtmQuery", () => {
  it("parses a valid UTM string with south band letter", () => {
    // UTM zone 23K (Brazil) – a representative coordinate
    const result = parseUtmQuery("23K 660000 7460000");
    expect(result).not.toBeNull();
    expect(result!.label).toContain("UTM");
    expect(result!.lat).toBeCloseTo(-22.8, 0);
    expect(result!.lng).toBeCloseTo(-43.4, 0);
  });

  it("parses a UTM string using S hemisphere designator", () => {
    const result = parseUtmQuery("23S 660000 7460000");
    expect(result).not.toBeNull();
  });

  it("returns null for a plain text string", () => {
    expect(parseUtmQuery("not a utm string")).toBeNull();
  });

  it("returns null for an invalid zone (0)", () => {
    expect(parseUtmQuery("0K 660000 7460000")).toBeNull();
  });

  it("returns null for an invalid zone (61)", () => {
    expect(parseUtmQuery("61K 660000 7460000")).toBeNull();
  });

  it("normalizes comma decimal separator", () => {
    const result = parseUtmQuery("23K 660000,5 7460000,3");
    expect(result).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getUtmZone
// ---------------------------------------------------------------------------

describe("getUtmZone", () => {
  it("returns zone 1 for longitude -180", () => {
    expect(getUtmZone(-180)).toBe(1);
  });

  it("returns zone 60 for longitude 179", () => {
    expect(getUtmZone(179)).toBe(60);
  });

  it("returns zone 23 for Rio de Janeiro longitude (~-43.1)", () => {
    expect(getUtmZone(-43.1)).toBe(23);
  });

  it("returns zone 31 for longitude 0 (prime meridian)", () => {
    expect(getUtmZone(0)).toBe(31);
  });
});

// ---------------------------------------------------------------------------
// getUtmBand
// ---------------------------------------------------------------------------

describe("getUtmBand", () => {
  it("returns Z for latitude 84 (outside UTM range)", () => {
    expect(getUtmBand(84)).toBe("Z");
  });

  it("returns Z for latitude below -80", () => {
    expect(getUtmBand(-81)).toBe("Z");
  });

  it("returns a letter in the valid band range for tropical latitudes", () => {
    const band = getUtmBand(-22.9); // São Paulo area
    expect(band).toBeTruthy();
    expect(band).not.toBe("Z");
  });

  it("returns K for latitude ~-22 (Southern hemisphere Brazil)", () => {
    // latitude -22 → index = floor((-22 + 80) / 8) = floor(7.25) = 7 → bands[7] = 'K'
    expect(getUtmBand(-22)).toBe("K");
  });

  it("returns C for latitude -80 (southernmost UTM)", () => {
    expect(getUtmBand(-80)).toBe("C");
  });
});

// ---------------------------------------------------------------------------
// toUtm
// ---------------------------------------------------------------------------

describe("toUtm", () => {
  it("converts known lat/lng to UTM with expected zone", () => {
    const result = toUtm(-22.9068, -43.1729);
    expect(result.zone).toBe(23);
    expect(result.isSouth).toBe(true);
    expect(result.easting).toBeGreaterThan(0);
    expect(result.northing).toBeGreaterThan(0);
  });

  it("flags northern-hemisphere coordinates correctly", () => {
    const result = toUtm(48.8566, 2.3522); // Paris
    expect(result.isSouth).toBe(false);
  });

  it("returns a valid projString", () => {
    const result = toUtm(-22.9068, -43.1729);
    expect(result.projString).toContain("proj=utm");
    expect(result.projString).toContain("south");
  });

  it("returns a band letter", () => {
    const result = toUtm(-22.9068, -43.1729);
    expect(result.band).toBeTruthy();
  });
});
