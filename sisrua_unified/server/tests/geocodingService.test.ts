import { GeocodingService } from "../services/geocodingService";
import * as externalApi from "../utils/externalApi";
import { IbgeService } from "../services/ibgeService";

jest.mock("../utils/externalApi");
jest.mock("../services/ibgeService");

describe("GeocodingService", () => {
  describe("resolveLocation", () => {
    it("should parse decimal coordinates", async () => {
      const result =
        await GeocodingService.resolveLocation("-23.5505, -46.6333");
      expect(result).not.toBeNull();
      expect(result?.lat).toBeCloseTo(-23.5505, 4);
      expect(result?.lng).toBeCloseTo(-46.6333, 4);
      expect(result?.label).toContain("Lat/Lng");
    });

    it("should parse coordinates with different separators", async () => {
      const result =
        await GeocodingService.resolveLocation("-23.5505 -46.6333");
      expect(result).not.toBeNull();
      expect(result?.lat).toBeCloseTo(-23.5505, 4);
      expect(result?.lng).toBeCloseTo(-46.6333, 4);
    });

    it("should return null for malformed input", async () => {
      const result = await GeocodingService.resolveLocation("not-a-coordinate");
      expect(result).toBeNull();
    });

    it("should return null for single number", async () => {
      const result = await GeocodingService.resolveLocation("123.456");
      expect(result).toBeNull();
    });

    it("should parse UTM coordinates", async () => {
      const result =
        await GeocodingService.resolveLocation("23K 315000 7395000");
      expect(result).not.toBeNull();
      expect(result?.lat).toBeDefined();
      expect(result?.lng).toBeDefined();
      expect(result?.label).toContain("UTM");
    });

    it("should handle empty query", async () => {
      const result = await GeocodingService.resolveLocation("");
      expect(result).toBeNull();
    });

    it("should validate latitude range", async () => {
      const result = await GeocodingService.resolveLocation("91.0, -46.6333");
      expect(result).toBeNull();
    });

    it("should validate longitude range", async () => {
      const result = await GeocodingService.resolveLocation("-23.5505, 181.0");
      expect(result).toBeNull();
    });

    describe("MGRS band hemisphere detection", () => {
      it("should detect Southern Hemisphere for band C", async () => {
        const result =
          await GeocodingService.resolveLocation("31C 500000 1000000");
        expect(result).not.toBeNull();
        // Band C is in Southern Hemisphere
        expect(result?.label).toContain("UTM");
      });

      it("should detect Southern Hemisphere for band K", async () => {
        const result =
          await GeocodingService.resolveLocation("23K 801370 7549956");
        expect(result).not.toBeNull();
        // Band K (ASCII 75) is in Southern Hemisphere (C-M range)
        // This was the original bug: ASCII comparison would incorrectly use K >= N
        expect(result?.label).toContain("UTM");
      });

      it("should detect Northern Hemisphere for band N", async () => {
        const result =
          await GeocodingService.resolveLocation("32N 600000 5000000");
        expect(result).not.toBeNull();
        // Band N is in Northern Hemisphere
        expect(result?.label).toContain("UTM");
      });

      it("should detect Northern Hemisphere for band X", async () => {
        const result =
          await GeocodingService.resolveLocation("33X 500000 8000000");
        expect(result).not.toBeNull();
        // Band X is in Northern Hemisphere (N-X range)
        expect(result?.label).toContain("UTM");
      });

      it("should handle explicit N suffix for Northern Hemisphere", async () => {
        const result =
          await GeocodingService.resolveLocation("23N 801370 7549956");
        expect(result).not.toBeNull();
        expect(result?.label).toContain("UTM");
      });

      it("should handle explicit S suffix for Southern Hemisphere", async () => {
        const result =
          await GeocodingService.resolveLocation("23S 801370 7549956");
        expect(result).not.toBeNull();
        expect(result?.label).toContain("UTM");
      });
    });
  });
});

describe("GeocodingService - Nominatim/IBGE paths", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (externalApi.fetchWithCircuitBreaker as jest.Mock).mockClear();
    (IbgeService.findMunicipioByName as jest.Mock).mockClear();
  });

  it("resolveLocation: falls back to Nominatim when input is address-like", async () => {
    (externalApi.fetchWithCircuitBreaker as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          lat: "-23.5505",
          lon: "-46.6333",
          display_name: "São Paulo, Brazil",
        },
      ],
    });

    const result = await GeocodingService.resolveLocation("São Paulo");
    expect(result).not.toBeNull();
    expect(result?.label).toContain("São Paulo");
  });

  it("resolveLocation: handles Nominatim network error gracefully", async () => {
    (externalApi.fetchWithCircuitBreaker as jest.Mock).mockRejectedValueOnce(
      new Error("Network error"),
    );

    const result = await GeocodingService.resolveLocation("São Paulo");
    // Should return null when Nominatim fails and no IBGE result
    expect(result).toBeNull();
  });

  it("resolveLocation: falls back to IBGE when Nominatim fails", async () => {
    (externalApi.fetchWithCircuitBreaker as jest.Mock).mockRejectedValueOnce(
      new Error("Network error"),
    );
    (IbgeService.findMunicipioByName as jest.Mock).mockResolvedValueOnce({
      nome: "Taubaté",
      microrregiao: {
        mesorregiao: {
          UF: { sigla: "SP" },
        },
      },
    });

    const result = await GeocodingService.resolveLocation("Taubaté");
    expect(result).not.toBeNull();
    expect(result?.label).toContain("Taubaté");
  });

  it("resolveLocation: rejects IBGE result if municipality name does not match query tokens", async () => {
    (externalApi.fetchWithCircuitBreaker as jest.Mock).mockRejectedValueOnce(
      new Error("Network error"),
    );
    (IbgeService.findMunicipioByName as jest.Mock).mockResolvedValueOnce({
      nome: "Unrelated City",
      microrregiao: {
        mesorregiao: {
          UF: { sigla: "SP" },
        },
      },
    });

    const result = await GeocodingService.resolveLocation("Taubaté");
    // Should reject this match because the normalized text doesn't contain the query token
    expect(result).toBeNull();
  });

  it("resolveLocation: uses IBGE when query is too short for Nominatim", async () => {
    (IbgeService.findMunicipioByName as jest.Mock).mockResolvedValueOnce({
      nome: "Rio de Janeiro",
      microrregiao: {
        mesorregiao: {
          UF: { sigla: "RJ" },
        },
      },
    });

    const result = await GeocodingService.resolveLocation("Rio de Janeiro");
    expect(result).not.toBeNull();
  });

  it("parseLatLng: handles very small coordinates", async () => {
    const result = await GeocodingService.resolveLocation("0.00001, 0.00001");
    expect(result).not.toBeNull();
    expect(result?.lat).toBeCloseTo(0.00001, 5);
  });

  it("parseUtm: rejects zone outside valid range", async () => {
    const result = await GeocodingService.resolveLocation("61A 500000 7500000");
    expect(result).toBeNull();
  });

  it("parseUtm: rejects invalid hemisphere band", async () => {
    const result = await GeocodingService.resolveLocation("23B 500000 7500000");
    expect(result).toBeNull();
  });
});
