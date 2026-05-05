/**
 * useMtRouter – Hook de estado e integração com o motor MT Router.
 *
 * Gerencia:
 *   – seleção interativa de source e terminais no mapa
 *   – upload KMZ para pré-preenchimento automático
 *   – chamada POST /api/dg/mt-router
 *   – resultado e estado de loading/erro
 */

import { useState, useCallback, useRef } from "react";

// ─── Tipos espelhados do servidor (dgTypes.ts / kmzPreprocessingService.ts) ────

export interface MtLatLon {
  lat: number;
  lon: number;
}

export interface MtTerminal {
  id: string;
  name?: string;
  position: MtLatLon;
}

export interface MtRoadCorridor {
  id: string;
  label?: string;
  centerPoints: MtLatLon[];
  bufferMeters: number;
}

export interface MtRouterPath {
  terminalId: string;
  reachable: boolean;
  routeNodeIds: string[];
  totalDistanceMeters: number;
}

export interface MtRouterEdge {
  fromNodeId: string;
  toNodeId: string;
  distanceMeters: number;
  latLon: [MtLatLon, MtLatLon];
}

export interface MtRouterResult {
  feasible: boolean;
  source: MtLatLon;
  connectedTerminals: number;
  paths: MtRouterPath[];
  edges: MtRouterEdge[];
  totalEdgeLengthMeters: number;
  unreachableTerminals: string[];
}

export interface KmzParseResult {
  source?: MtLatLon;
  terminals: MtTerminal[];
  roadCorridors: MtRoadCorridor[];
  warnings: string[];
}

// ─── Modo de seleção interativa ────────────────────────────────────────────────

export type MtSelectionMode = "idle" | "picking_source" | "picking_terminals";

// ─── Estado do hook ────────────────────────────────────────────────────────────

export interface MtRouterState {
  /** Modo de seleção atual */
  selectionMode: MtSelectionMode;
  /** Ponto de origem MT selecionado */
  source: MtLatLon | null;
  /** Lista de terminais */
  terminals: MtTerminal[];
  /** Corredores viários (do KMZ ou preenchidos manualmente) */
  roadCorridors: MtRoadCorridor[];
  /** Distância máxima de snap para a malha viária */
  maxSnapDistanceMeters: number;
  /** Resultado do último cálculo */
  result: MtRouterResult | null;
  /** true enquanto aguarda resposta da API */
  isCalculating: boolean;
  /** true enquanto processa upload KMZ */
  isParsingKmz: boolean;
  /** Mensagem de erro */
  error: string | null;
  /** Avisos não fatais do parsing KMZ */
  kmzWarnings: string[];
}

const INITIAL_STATE: MtRouterState = {
  selectionMode: "idle",
  source: null,
  terminals: [],
  roadCorridors: [],
  maxSnapDistanceMeters: 100,
  result: null,
  isCalculating: false,
  isParsingKmz: false,
  error: null,
  kmzWarnings: [],
};

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useMtRouter() {
  const [state, setStateRaw] = useState<MtRouterState>(INITIAL_STATE);
  const stateRef = useRef<MtRouterState>(INITIAL_STATE);
  const terminalCounterRef = useRef(0);

  /** Atualiza estado e mantém stateRef sincronizado. */
  const patch = useCallback((updater: (s: MtRouterState) => MtRouterState) => {
    setStateRaw((prev) => {
      const next = updater(prev);
      stateRef.current = next;
      return next;
    });
  }, []);

  // ── Helpers de estado ───────────────────────────────────────────────────────

  const setSelectionMode = useCallback((mode: MtSelectionMode) => {
    patch((s) => ({ ...s, selectionMode: mode, error: null }));
  }, [patch]);

  const setSource = useCallback((pos: MtLatLon) => {
    patch((s) => ({
      ...s,
      source: pos,
      selectionMode: "idle",
      result: null,
      error: null,
    }));
  }, [patch]);

  const addTerminal = useCallback((pos: MtLatLon) => {
    terminalCounterRef.current += 1;
    const id = `t${terminalCounterRef.current}`;
    patch((s) => ({
      ...s,
      terminals: [...s.terminals, { id, position: pos }],
      result: null,
      error: null,
    }));
  }, [patch]);

  const removeTerminal = useCallback((id: string) => {
    patch((s) => ({
      ...s,
      terminals: s.terminals.filter((t) => t.id !== id),
      result: null,
    }));
  }, [patch]);

  const setMaxSnapDistance = useCallback((meters: number) => {
    patch((s) => ({ ...s, maxSnapDistanceMeters: meters, result: null }));
  }, [patch]);

  const reset = useCallback(() => {
    terminalCounterRef.current = 0;
    patch(() => INITIAL_STATE);
  }, [patch]);

  // ── Clique no mapa ──────────────────────────────────────────────────────────

  /**
   * Trata clique no mapa de acordo com o modo de seleção ativo.
   * Deve ser chamado pelo componente de mapa quando usuário clicar.
   */
  const handleMapClick = useCallback(
    (pos: MtLatLon) => {
      patch((s) => {
        if (s.selectionMode === "picking_source") {
          return { ...s, source: pos, selectionMode: "idle", result: null, error: null };
        }
        if (s.selectionMode === "picking_terminals") {
          terminalCounterRef.current += 1;
          const id = `t${terminalCounterRef.current}`;
          return {
            ...s,
            terminals: [...s.terminals, { id, position: pos }],
            result: null,
            error: null,
          };
        }
        return s;
      });
    },
    [patch],
  );

  // ── Upload KMZ ──────────────────────────────────────────────────────────────

  const uploadKmz = useCallback(async (file: File) => {
    patch((s) => ({ ...s, isParsingKmz: true, error: null, kmzWarnings: [] }));
    try {
      const form = new FormData();
      form.append("file", file);
      const resp = await fetch("/api/dg/mt-router/parse-kmz", {
        method: "POST",
        body: form,
        credentials: "same-origin",
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({ error: "Erro desconhecido." }));
        throw new Error(body.error ?? `HTTP ${resp.status}`);
      }
      const data: KmzParseResult = await resp.json();
      terminalCounterRef.current = data.terminals.length;
      patch((s) => ({
        ...s,
        source: data.source ?? s.source,
        terminals: data.terminals.length > 0 ? data.terminals : s.terminals,
        roadCorridors: data.roadCorridors.length > 0 ? data.roadCorridors : s.roadCorridors,
        kmzWarnings: data.warnings,
        isParsingKmz: false,
        result: null,
        error: null,
      }));
    } catch (err) {
      patch((s) => ({
        ...s,
        isParsingKmz: false,
        error: (err as Error).message,
      }));
    }
  }, [patch]);

  // ── Cálculo de roteamento ───────────────────────────────────────────────────

  const calculate = useCallback(async () => {
    const s = stateRef.current;
    if (!s.source) {
      patch((prev) => ({ ...prev, error: "Defina o ponto de origem da MT." }));
      return;
    }
    if (s.terminals.length === 0) {
      patch((prev) => ({ ...prev, error: "Adicione pelo menos um terminal." }));
      return;
    }
    if (s.roadCorridors.length === 0) {
      patch((prev) => ({
        ...prev,
        error: "Importe corredores viários via KMZ ou adicione manualmente.",
      }));
      return;
    }

    patch((prev) => ({ ...prev, isCalculating: true, error: null }));

    const payload = {
      source: s.source,
      terminals: s.terminals.map((t) => ({ id: t.id, position: t.position })),
      roadCorridors: s.roadCorridors,
      maxSnapDistanceMeters: s.maxSnapDistanceMeters,
    };

    try {
      const resp = await fetch("/api/dg/mt-router", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload),
      });
      const body = await resp.json();
      if (!resp.ok && resp.status !== 422) {
        throw new Error(body.error ?? `HTTP ${resp.status}`);
      }
      const result = body as MtRouterResult;
      patch((prev) => ({
        ...prev,
        result,
        isCalculating: false,
        error:
          !result.feasible && result.connectedTerminals === 0
            ? "Nenhum terminal alcançável. Verifique a malha viária e a distância de snap."
            : null,
      }));
    } catch (err) {
      patch((prev) => ({
        ...prev,
        isCalculating: false,
        error: (err as Error).message,
      }));
    }
  }, [patch]);

  return {
    state,
    setSelectionMode,
    setSource,
    addTerminal,
    removeTerminal,
    setMaxSnapDistance,
    handleMapClick,
    uploadKmz,
    calculate,
    reset,
  };
}
