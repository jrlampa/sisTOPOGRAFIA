import { describe, it, expect } from "vitest";
import { haversineDistanceMeters } from "../../shared/geodesic";

describe("haversineDistanceMeters", () => {
  it("returns zero for the same point", () => {
    expect(
      haversineDistanceMeters(
        { lat: -23.55, lng: -46.63 },
        { lat: -23.55, lng: -46.63 },
      ),
    ).toBe(0);
  });

  it("is symmetric", () => {
    const a = { lat: -23.55, lng: -46.63 };
    const b = { lat: -22.9, lng: -43.17 };
    const d1 = haversineDistanceMeters(a, b);
    const d2 = haversineDistanceMeters(b, a);
    expect(Math.abs(d1 - d2)).toBeLessThan(1e-9);
  });

  it("stays in expected range for Sao Paulo to Rio de Janeiro", () => {
    const distance = haversineDistanceMeters(
      { lat: -23.5505, lng: -46.6333 },
      { lat: -22.9068, lng: -43.1729 },
    );

    expect(distance).toBeGreaterThan(350000);
    expect(distance).toBeLessThan(380000);
  });
});
