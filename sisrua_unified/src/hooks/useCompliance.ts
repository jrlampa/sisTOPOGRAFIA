/**
 * useCompliance.ts — Hook para gerenciar conformidade T2 (Ambiental, Urbano, Solar, Vegetação, Fundiário).
 */

import { useState, useCallback } from "react";
import { useFeatureFlags } from "../contexts/FeatureFlagContext";
import { API_BASE_URL } from "../config/api";
import { buildApiHeaders } from "../services/apiClient";
import type { BtTopology } from "../types";

export interface ComplianceResult {
  timestamp: string;
  environmental: {
    riskLevel: "ALTO" | "BAIXO";
    totalInterferencias: number;
    interferencias: any[];
  } | null;
  urban: {
    score: number;
    results: any[];
  } | null;
  solar: {
    totalAtivosAnalisados: number;
    results: any[];
  } | null;
  vegetation: {
    totalConflitos: number;
    areaEstimadaHa: number;
    volumeEstimadoM3: number;
    riscoOperacional: "baixo" | "medio" | "alto";
    detalhes: any[];
  } | null;
  land: {
    totalConflitos: number;
    conflicts: any[];
  } | null;
}

export function useCompliance() {
  const { flags } = useFeatureFlags();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ComplianceResult | null>(null);

  const runAnalysis = useCallback(
    async (topology: BtTopology, osmData: any[]) => {
      setLoading(true);
      setError(null);
      try {
        const headers = buildApiHeaders();

        const [nbrData, envData, solarData, vegData, landData] =
          await Promise.all([
            // 1. NBR 9050
            flags.enableNbr9050
              ? fetch(`${API_BASE_URL}/compliance/nbr9050/auto`, {
                  method: "POST",
                  headers: { ...headers, "Content-Type": "application/json" },
                  body: JSON.stringify(topology),
                }).then((r) => r.json())
              : Promise.resolve(null),

            // 2. Environmental (APPs/UCs)
            flags.enableEnvironmentalAudit
              ? fetch(`${API_BASE_URL}/compliance/environmental/auto`, {
                  method: "POST",
                  headers: { ...headers, "Content-Type": "application/json" },
                  body: JSON.stringify(topology),
                }).then((r) => r.json())
              : Promise.resolve(null),

            // 3. Solar Shading (Item 61)
            flags.enableSolarShading
              ? fetch(`${API_BASE_URL}/sombreamento-2d5/auto`, {
                  method: "POST",
                  headers: { ...headers, "Content-Type": "application/json" },
                  body: JSON.stringify({ topology, osmData }),
                }).then((r) => r.json())
              : Promise.resolve(null),

            // 4. Vegetation (Item 46)
            flags.enableEnvironmentalAudit
              ? fetch(`${API_BASE_URL}/compliance/vegetation/auto`, {
                  method: "POST",
                  headers: { ...headers, "Content-Type": "application/json" },
                  body: JSON.stringify({ topology, osmData }),
                }).then((r) => r.json())
              : Promise.resolve(null),

            // 5. Land Easement (Item 107)
            fetch(`${API_BASE_URL}/compliance/land/auto-detect`, {
              method: "POST",
              headers: { ...headers, "Content-Type": "application/json" },
              body: JSON.stringify(topology),
            }).then((r) => r.json()),
          ]);

        setResult({
          timestamp: new Date().toISOString(),
          urban: nbrData,
          environmental: envData,
          solar: solarData,
          vegetation: vegData,
          land: landData,
        });
      } catch (err: any) {
        setError(err.message || "Erro desconhecido na análise de compliance.");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return {
    runAnalysis,
    loading,
    error,
    result,
  };
}
