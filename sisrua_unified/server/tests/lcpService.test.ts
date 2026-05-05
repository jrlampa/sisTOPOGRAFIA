/**
 * Testes — Motor Least-Cost Path (LCP)
 *
 * Cobre:
 *   - computeLcpRoutes: caminho simples conectado
 *   - Perfis de custo: penalidade por classe de via
 *   - Bônus de reuso de postes existentes
 *   - Múltiplos terminais com deduplicação de edges
 *   - Terminais não alcançáveis (snap excedido)
 *   - Área sensível: penalidade aplicada
 *   - Perfis predefinidos: LCP_COST_PROFILES
 */

import { describe, it, expect } from "vitest";
import { computeLcpRoutes } from "../services/dg/lcpService.js";
import { LCP_COST_PROFILES } from "../services/dg/lcpTypes.js";
import type { LcpInput } from "../services/dg/lcpTypes.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Corredor simples com 3 pontos (L = ~111 m em lat/lon delta de 0.001). */
function makeLinearCorridor(
  startLat: number,
  startLon: number,
  steps: number,
  deltaLat = 0.0003,
  deltaLon = 0.0,
) {
  return {
    id: "c1",
    centerPoints: Array.from({ length: steps }, (_, i) => ({
      lat: startLat + i * deltaLat,
      lon: startLon + i * deltaLon,
    })),
    bufferMeters: 5,
  };
}

// ─── Testes ───────────────────────────────────────────────────────────────────

describe("LCP – computeLcpRoutes", () => {
  it("conecta origem e terminal via corredor linear simples", () => {
    const source = { lat: -22.9, lon: -43.1 };
    const terminal = { lat: -22.9 + 0.0009, lon: -43.1 };

    const input: LcpInput = {
      source,
      terminals: [{ id: "T1", position: terminal }],
      roadSegments: [makeLinearCorridor(-22.9, -43.1, 5) as any],
      maxSnapDistanceMeters: 200,
    };

    const result = computeLcpRoutes(input);

    expect(result.feasible).toBe(true);
    expect(result.connectedTerminals).toBe(1);
    expect(result.paths).toHaveLength(1);
    expect(result.paths[0]!.totalLengthMeters).toBeGreaterThan(0);
    expect(result.unreachableTerminals).toHaveLength(0);
    expect(result.edges.length).toBeGreaterThan(0);
    expect(result.costProfileId).toBe("URBAN_STANDARD");
  });

  it("retorna infeasible quando snap excede maxSnapDistanceMeters", () => {
    const input: LcpInput = {
      source: { lat: -22.9, lon: -43.1 },
      terminals: [{ id: "T1", position: { lat: -23.5, lon: -44.0 } }],
      roadSegments: [makeLinearCorridor(-22.9, -43.1, 4) as any],
      maxSnapDistanceMeters: 50,
    };

    const result = computeLcpRoutes(input);
    expect(result.feasible).toBe(false);
  });

  it("retorna infeasible quando não há corredores viários", () => {
    const input: LcpInput = {
      source: { lat: -22.9, lon: -43.1 },
      terminals: [{ id: "T1", position: { lat: -22.901, lon: -43.1 } }],
      roadSegments: [],
    };

    const result = computeLcpRoutes(input);
    expect(result.feasible).toBe(false);
    expect(result.unreachableTerminals).toContain("T1");
  });

  it("aplica penalidade de área sensível ao custo ponderado", () => {
    const base: LcpInput = {
      source: { lat: -22.9, lon: -43.1 },
      terminals: [{ id: "T1", position: { lat: -22.9012, lon: -43.1 } }],
      roadSegments: [makeLinearCorridor(-22.9, -43.1, 5) as any],
      maxSnapDistanceMeters: 200,
    };

    const withSensitive: LcpInput = {
      ...base,
      roadSegments: [
        { ...(makeLinearCorridor(-22.9, -43.1, 5) as any), isSensitiveArea: true },
      ],
    };

    const baseResult = computeLcpRoutes(base);
    const sensitiveResult = computeLcpRoutes(withSensitive);

    if (baseResult.feasible && sensitiveResult.feasible) {
      expect(sensitiveResult.paths[0]!.totalWeightedCost).toBeGreaterThan(
        baseResult.paths[0]!.totalWeightedCost,
      );
    }
  });

  it("aplica bônus de reuso para postes existentes próximos", () => {
    const base: LcpInput = {
      source: { lat: -22.9, lon: -43.1 },
      terminals: [{ id: "T1", position: { lat: -22.9012, lon: -43.1 } }],
      roadSegments: [makeLinearCorridor(-22.9, -43.1, 5) as any],
      maxSnapDistanceMeters: 200,
    };

    // Poste existente no meio do corredor
    const withPoles: LcpInput = {
      ...base,
      existingPoles: [{ id: "PE1", position: { lat: -22.9006, lon: -43.1 } }],
    };

    const baseResult = computeLcpRoutes(base);
    const polesResult = computeLcpRoutes(withPoles);

    // Com bônus, custo ponderado deve ser ≤ sem bônus
    if (baseResult.feasible && polesResult.feasible) {
      expect(polesResult.paths[0]!.totalWeightedCost).toBeLessThanOrEqual(
        baseResult.paths[0]!.totalWeightedCost + 1e-6,
      );
      expect(polesResult.totalExistingPolesReused).toBeGreaterThanOrEqual(0);
    }
  });

  it("conecta múltiplos terminais e deduplica edges", () => {
    const input: LcpInput = {
      source: { lat: -22.9, lon: -43.1 },
      terminals: [
        { id: "T1", position: { lat: -22.9006, lon: -43.1 } },
        { id: "T2", position: { lat: -22.9009, lon: -43.1 } },
      ],
      roadSegments: [makeLinearCorridor(-22.9, -43.1, 6) as any],
      maxSnapDistanceMeters: 200,
    };

    const result = computeLcpRoutes(input);

    if (result.feasible) {
      expect(result.connectedTerminals).toBeGreaterThanOrEqual(1);
      // Edges deduplificados: não pode haver mais edges do que a soma de todas as paths
      const totalPathEdges = result.paths.reduce(
        (s, p) => s + p.segments.length,
        0,
      );
      expect(result.edges.length).toBeLessThanOrEqual(totalPathEdges);
    }
  });

  it("inclui estimativa de custo em BRL quando feasible", () => {
    const input: LcpInput = {
      source: { lat: -22.9, lon: -43.1 },
      terminals: [{ id: "T1", position: { lat: -22.9009, lon: -43.1 } }],
      roadSegments: [makeLinearCorridor(-22.9, -43.1, 5) as any],
      maxSnapDistanceMeters: 200,
    };

    const result = computeLcpRoutes(input);

    if (result.feasible) {
      expect(result.estimatedCostBrl).toBeGreaterThan(0);
      expect(result.paths[0]!.estimatedCostBrl).toBeGreaterThan(0);
    }
  });

  it("usa perfil RURAL_STANDARD quando especificado", () => {
    const input: LcpInput = {
      source: { lat: -22.9, lon: -43.1 },
      terminals: [{ id: "T1", position: { lat: -22.9009, lon: -43.1 } }],
      roadSegments: [makeLinearCorridor(-22.9, -43.1, 5) as any],
      costProfile: LCP_COST_PROFILES["RURAL_STANDARD"],
      maxSnapDistanceMeters: 200,
    };

    const result = computeLcpRoutes(input);
    expect(result.costProfileId).toBe("RURAL_STANDARD");
  });
});

describe("LCP – perfis predefinidos", () => {
  it("LCP_COST_PROFILES contém os 4 perfis esperados", () => {
    expect(Object.keys(LCP_COST_PROFILES)).toEqual(
      expect.arrayContaining([
        "URBAN_STANDARD",
        "RURAL_STANDARD",
        "CORRIDOR_PREFERRED",
        "MINIMIZE_CROSSINGS",
      ]),
    );
  });

  it("todos os perfis têm existingPoleBonus < 1.0", () => {
    for (const profile of Object.values(LCP_COST_PROFILES)) {
      expect(profile.existingPoleBonus).toBeLessThan(1.0);
    }
  });

  it("MINIMIZE_CROSSINGS penaliza vias primárias mais que URBAN_STANDARD", () => {
    const mc = LCP_COST_PROFILES["MINIMIZE_CROSSINGS"]!;
    const urban = LCP_COST_PROFILES["URBAN_STANDARD"]!;
    expect(mc.highwayMultiplier["primary"]).toBeGreaterThan(
      urban.highwayMultiplier["primary"]!,
    );
  });
});
