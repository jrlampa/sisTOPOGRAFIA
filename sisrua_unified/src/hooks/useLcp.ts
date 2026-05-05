/**
 * useLcp – Hook de estado e integração com o Motor Least-Cost Path.
 *
 * Gerencia:
 *   – seleção interativa de source e terminais no mapa
 *   – seleção de perfil de custo
 *   – chamada POST /api/dg/lcp
 *   – resultado, estado de loading/erro
 *
 * Referência: T2.59 — docs/STRATEGIC_ROADMAP_2026.md
 */

import { useState, useCallback } from "react";

// ─── Tipos espelhados do servidor (lcpTypes.ts) ───────────────────────────────

export interface LcpLatLon {
  lat: number;
  lon: number;
}

export interface LcpTerminal {
  id: string;
  name?: string;
  position: LcpLatLon;
  demandKva?: number;
}

export interface LcpRoadSegment {
  id: string;
  centerPoints: LcpLatLon[];
  bufferMeters?: number;
  highwayClass?: string;
  isSensitiveArea?: boolean;
  fixedPenalty?: number;
}

export interface LcpExistingPole {
  id: string;
  position: LcpLatLon;
}

export interface LcpCostProfile {
  id: string;
  name: string;
  highwayMultiplier?: Record<string, number>;
  existingPoleBonus: number;
  sensitiveCrossing: number;
  baseCostPerMeter: number;
}

export type LcpHighwayClass =
  | "motorway" | "trunk" | "primary" | "secondary" | "tertiary"
  | "residential" | "service" | "track" | "path" | "unknown";

export interface LcpPathSegment {
  fromNodeId: string;
  toNodeId: string;
  fromLatLon?: LcpLatLon;
  toLatLon?: LcpLatLon;
  lengthMeters: number;
  weightedCost: number;
  highwayClass?: LcpHighwayClass;
  usesExistingPole?: boolean;
  isSensitiveArea?: boolean;
}

export interface LcpPath {
  terminalId: string;
  totalLengthMeters: number;
  totalWeightedCost: number;
  estimatedCostBrl?: number;
  segments: LcpPathSegment[];
  existingPolesReused: number;
  sensitiveCrossings: number;
}

export interface LcpEdge {
  fromNodeId: string;
  toNodeId: string;
  fromLatLon?: LcpLatLon;
  toLatLon?: LcpLatLon;
  lengthMeters: number;
  weightedCost: number;
  highwayClass?: LcpHighwayClass;
  usesExistingPole?: boolean;
  isSensitiveArea?: boolean;
}

export interface LcpResult {
  feasible: boolean;
  reason?: string;
  runId?: string;
  costProfileId: string;
  connectedTerminals: number;
  totalLengthMeters: number;
  totalWeightedCost: number;
  estimatedCostBrl?: number;
  edges: LcpEdge[];
  paths: LcpPath[];
  unreachableTerminals: string[];
  totalExistingPolesReused: number;
}

/** Perfis de custo predefinidos carregados da API. */
export const DEFAULT_LCP_PROFILES: LcpCostProfile[] = [
  {
    id: "URBAN_STANDARD",
    name: "Urbano Padrão",
    existingPoleBonus: 0.7,
    sensitiveCrossing: 1.8,
    baseCostPerMeter: 85,
  },
  {
    id: "RURAL_STANDARD",
    name: "Rural Padrão",
    existingPoleBonus: 0.65,
    sensitiveCrossing: 2.2,
    baseCostPerMeter: 60,
  },
  {
    id: "CORRIDOR_PREFERRED",
    name: "Preferência de Corredor",
    existingPoleBonus: 0.6,
    sensitiveCrossing: 2.0,
    baseCostPerMeter: 75,
  },
  {
    id: "MINIMIZE_CROSSINGS",
    name: "Mínimo de Travessias",
    existingPoleBonus: 0.75,
    sensitiveCrossing: 3.0,
    baseCostPerMeter: 90,
  },
];

// ─── Estado do hook ──────────────────────────────────────────────────────────

type LcpSelectionMode = "idle" | "pickSource" | "pickTerminal";

export interface LcpRouterState {
  source: LcpLatLon | null;
  terminals: LcpTerminal[];
  roadSegments: LcpRoadSegment[];
  costProfile: LcpCostProfile;
  existingPoles: LcpExistingPole[];
  maxSnapDistanceMeters: number;
  selectionMode: LcpSelectionMode;
  isCalculating: boolean;
  result: LcpResult | null;
  error: string | null;
  availableProfiles: LcpCostProfile[];
}

const DEFAULT_STATE: LcpRouterState = {
  source: null,
  terminals: [],
  roadSegments: [],
  costProfile: DEFAULT_LCP_PROFILES[0]!,
  existingPoles: [],
  maxSnapDistanceMeters: 150,
  selectionMode: "idle",
  isCalculating: false,
  result: null,
  error: null,
  availableProfiles: DEFAULT_LCP_PROFILES,
};

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useLcp() {
  const [state, setState] = useState<LcpRouterState>(DEFAULT_STATE);

  const setSource = useCallback((source: LcpLatLon) => {
    setState((s) => ({ ...s, source, selectionMode: "idle" }));
  }, []);

  const addTerminal = useCallback((terminal: LcpTerminal) => {
    setState((s) => ({
      ...s,
      terminals: [...s.terminals, terminal],
      selectionMode: "idle",
    }));
  }, []);

  const removeTerminal = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      terminals: s.terminals.filter((t) => t.id !== id),
    }));
  }, []);

  const setRoadSegments = useCallback((segments: LcpRoadSegment[]) => {
    setState((s) => ({ ...s, roadSegments: segments }));
  }, []);

  const setExistingPoles = useCallback((poles: LcpExistingPole[]) => {
    setState((s) => ({ ...s, existingPoles: poles }));
  }, []);

  const setCostProfile = useCallback((profile: LcpCostProfile) => {
    setState((s) => ({ ...s, costProfile: profile }));
  }, []);

  const setMaxSnapDistance = useCallback((meters: number) => {
    setState((s) => ({ ...s, maxSnapDistanceMeters: meters }));
  }, []);

  const setSelectionMode = useCallback((mode: LcpSelectionMode) => {
    setState((s) => ({ ...s, selectionMode: mode }));
  }, []);

  const loadProfiles = useCallback(async () => {
    try {
      const resp = await fetch("/api/dg/lcp/profiles");
      if (resp.ok) {
        const profiles: LcpCostProfile[] = await resp.json();
        setState((s) => ({ ...s, availableProfiles: profiles }));
      }
    } catch {
      // Usa perfis padrão se API falhar
    }
  }, []);

  const calculate = useCallback(async () => {
    setState((s) => {
      if (!s.source || s.terminals.length === 0 || s.roadSegments.length === 0) {
        return {
          ...s,
          error: "Defina origem, ao menos 1 terminal e corredores viários.",
        };
      }
      return { ...s, isCalculating: true, error: null };
    });

    setState((prev) => {
      // Acessa o estado mais recente para a chamada
      if (!prev.source || prev.terminals.length === 0 || prev.roadSegments.length === 0) {
        return { ...prev, isCalculating: false };
      }

      const body = {
        source: prev.source,
        terminals: prev.terminals.map((t) => ({
          id: t.id,
          position: t.position,
          demandKva: t.demandKva,
        })),
        roadSegments: prev.roadSegments,
        costProfileId: prev.costProfile.id,
        existingPoles: prev.existingPoles,
        maxSnapDistanceMeters: prev.maxSnapDistanceMeters,
      };

      fetch("/api/dg/lcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
        .then(async (resp) => {
          const data: LcpResult = await resp.json();
          setState((s) => ({
            ...s,
            isCalculating: false,
            result: data,
            error: data.feasible ? null : (data.reason ?? "Cálculo LCP inviável."),
          }));
        })
        .catch((err) => {
          setState((s) => ({
            ...s,
            isCalculating: false,
            error: (err as Error).message,
          }));
        });

      return prev; // retorno síncrono, atualização assíncrona via .then
    });
  }, []);

  const reset = useCallback(() => {
    setState(DEFAULT_STATE);
  }, []);

  return {
    state,
    setSource,
    addTerminal,
    removeTerminal,
    setRoadSegments,
    setExistingPoles,
    setCostProfile,
    setMaxSnapDistance,
    setSelectionMode,
    loadProfiles,
    calculate,
    reset,
  };
}
