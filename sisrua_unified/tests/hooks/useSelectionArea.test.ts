/**
 * useSelectionArea.test.ts — Testes Vitest para seleção de área via círculo e via polígono.
 *
 * Cobre:
 * - Modo círculo: onLocationChange, handleRadiusChange
 * - Modo polígono: acúmulo de pontos, remoção por índice, isPolygonValid
 * - Troca de modo: reset de polígono e measurePath
 * - Schemas Zod: SelectionModeSchema, PolygonSchema, DxfExportSchema, RadiusSchema
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useMapState } from "../../src/hooks/useMapState";
import {
  SelectionModeSchema,
  PolygonSchema,
  DxfExportSchema,
  RadiusSchema,
} from "../../src/utils/validation";
import type { GlobalState } from "../../src/types";
import { INITIAL_APP_STATE } from "../../src/app/initialState";

// Evita acesso ao localStorage durante os testes
vi.mock("../../src/hooks/useAutoSave", () => ({
  loadSessionDraft: () => null,
  clearSessionDraft: vi.fn(),
}));

// ─── Utilitários ─────────────────────────────────────────────────────────────

/** Cria parâmetros base para o hook useMapState com overrides opcionais. */
function makeHookParams(overrides: Partial<GlobalState> = {}) {
  const appState: GlobalState = { ...INITIAL_APP_STATE, ...overrides };
  const setAppState = vi.fn();
  const clearData = vi.fn();
  const loadElevationProfile = vi.fn().mockResolvedValue(undefined);
  const clearProfile = vi.fn();
  return { appState, setAppState, clearData, loadElevationProfile, clearProfile };
}

/**
 * Extrai o novo estado resultante de uma chamada setAppState com updater funcional.
 * Permite inspecionar a transformação sem precisar de um store real.
 */
function applyUpdater(
  setAppStateMock: ReturnType<typeof vi.fn>,
  callIndex: number,
  prevState: GlobalState,
): GlobalState {
  const [updaterOrState] = setAppStateMock.mock.calls[callIndex];
  if (typeof updaterOrState === "function") {
    return updaterOrState(prevState);
  }
  return updaterOrState as GlobalState;
}

// ─── Seleção via Círculo ──────────────────────────────────────────────────────

describe("Seleção de área via círculo", () => {
  it("handleMapClick atualiza center e chama clearData", () => {
    const params = makeHookParams({ selectionMode: "circle" });
    const { result } = renderHook(() => useMapState(params));

    const novaLocalizacao = { lat: -23.5505, lng: -46.6333, label: "São Paulo" };
    result.current.handleMapClick(novaLocalizacao);

    expect(params.setAppState).toHaveBeenCalledTimes(1);
    const nextState = applyUpdater(params.setAppState, 0, params.appState);
    expect(nextState.center).toEqual(novaLocalizacao);
    expect(params.clearData).toHaveBeenCalledTimes(1);
  });

  it("handleMapClick não altera polygon nem selectionMode", () => {
    const polygon = [
      { lat: -10, lng: -40 },
      { lat: -11, lng: -41 },
      { lat: -12, lng: -42 },
    ];
    const params = makeHookParams({ selectionMode: "circle", polygon });
    const { result } = renderHook(() => useMapState(params));

    result.current.handleMapClick({ lat: -23, lng: -43 });

    const nextState = applyUpdater(params.setAppState, 0, params.appState);
    expect(nextState.selectionMode).toBe("circle");
    expect(nextState.polygon).toEqual(polygon);
  });

  it("handleRadiusChange atualiza radius com valor válido", () => {
    const params = makeHookParams({ selectionMode: "circle", radius: 500 });
    const { result } = renderHook(() => useMapState(params));

    result.current.handleRadiusChange(1000);

    expect(params.setAppState).toHaveBeenCalledTimes(1);
    const nextState = applyUpdater(params.setAppState, 0, params.appState);
    expect(nextState.radius).toBe(1000);
  });

  it("handleRadiusChange não altera selectionMode", () => {
    const params = makeHookParams({ selectionMode: "circle" });
    const { result } = renderHook(() => useMapState(params));

    result.current.handleRadiusChange(750);

    const nextState = applyUpdater(params.setAppState, 0, params.appState);
    expect(nextState.selectionMode).toBe("circle");
  });
});

// ─── Seleção via Polígono ─────────────────────────────────────────────────────

describe("Seleção de área via polígono", () => {
  it("handlePolygonChange com um ponto inicia o polígono", () => {
    const params = makeHookParams({ selectionMode: "polygon", polygon: [] });
    const { result } = renderHook(() => useMapState(params));

    result.current.handlePolygonChange([[-22.9, -43.1]]);

    expect(params.setAppState).toHaveBeenCalledTimes(1);
    const nextState = applyUpdater(params.setAppState, 0, params.appState);
    expect(nextState.polygon).toHaveLength(1);
    expect(nextState.polygon[0]).toEqual({ lat: -22.9, lng: -43.1 });
  });

  it("handlePolygonChange acumula múltiplos pontos", () => {
    const params = makeHookParams({ selectionMode: "polygon", polygon: [] });
    const { result } = renderHook(() => useMapState(params));

    const pontos: [number, number][] = [
      [-22.9, -43.1],
      [-23.0, -43.2],
      [-23.1, -43.0],
    ];
    result.current.handlePolygonChange(pontos);

    const nextState = applyUpdater(params.setAppState, 0, params.appState);
    expect(nextState.polygon).toHaveLength(3);
    expect(nextState.polygon[1]).toEqual({ lat: -23.0, lng: -43.2 });
  });

  it("handlePolygonChange converte tuplas [lat, lng] para GeoLocation", () => {
    const params = makeHookParams({ selectionMode: "polygon", polygon: [] });
    const { result } = renderHook(() => useMapState(params));

    result.current.handlePolygonChange([[-10.5, -48.3]]);

    const nextState = applyUpdater(params.setAppState, 0, params.appState);
    expect(nextState.polygon[0]).toMatchObject({ lat: -10.5, lng: -48.3 });
  });

  it("handleClearPolygon redefine polygon para []", () => {
    const params = makeHookParams({
      selectionMode: "polygon",
      polygon: [
        { lat: -22.9, lng: -43.1 },
        { lat: -23.0, lng: -43.2 },
        { lat: -23.1, lng: -43.0 },
      ],
    });
    const { result } = renderHook(() => useMapState(params));

    result.current.handleClearPolygon();

    const nextState = applyUpdater(params.setAppState, 0, params.appState);
    expect(nextState.polygon).toEqual([]);
  });

  it("isPolygonValid é false com 0 pontos em modo polígono", () => {
    const params = makeHookParams({ selectionMode: "polygon", polygon: [] });
    const { result } = renderHook(() => useMapState(params));
    expect(result.current.isPolygonValid).toBe(false);
  });

  it("isPolygonValid é false com 2 pontos em modo polígono", () => {
    const params = makeHookParams({
      selectionMode: "polygon",
      polygon: [
        { lat: -22.9, lng: -43.1 },
        { lat: -23.0, lng: -43.2 },
      ],
    });
    const { result } = renderHook(() => useMapState(params));
    expect(result.current.isPolygonValid).toBe(false);
  });

  it("isPolygonValid é true com 3 ou mais pontos em modo polígono", () => {
    const params = makeHookParams({
      selectionMode: "polygon",
      polygon: [
        { lat: -22.9, lng: -43.1 },
        { lat: -23.0, lng: -43.2 },
        { lat: -23.1, lng: -43.0 },
      ],
    });
    const { result } = renderHook(() => useMapState(params));
    expect(result.current.isPolygonValid).toBe(true);
  });

  it("isPolygonValid é false em modo círculo mesmo com pontos", () => {
    const params = makeHookParams({
      selectionMode: "circle",
      polygon: [
        { lat: -22.9, lng: -43.1 },
        { lat: -23.0, lng: -43.2 },
        { lat: -23.1, lng: -43.0 },
      ],
    });
    const { result } = renderHook(() => useMapState(params));
    expect(result.current.isPolygonValid).toBe(false);
  });

  it("polygonPoints converte GeoLocation[] para [number,number][]", () => {
    const params = makeHookParams({
      selectionMode: "polygon",
      polygon: [
        { lat: -22.9, lng: -43.1 },
        { lat: -23.0, lng: -43.2 },
      ],
    });
    const { result } = renderHook(() => useMapState(params));
    expect(result.current.polygonPoints).toEqual([
      [-22.9, -43.1],
      [-23.0, -43.2],
    ]);
  });
});

// ─── Troca de modo de seleção ─────────────────────────────────────────────────

describe("Troca de modo de seleção", () => {
  it("handleSelectionModeChange para 'circle' define polygon=[] e measurePath=[]", () => {
    const params = makeHookParams({
      selectionMode: "polygon",
      polygon: [
        { lat: -22.9, lng: -43.1 },
        { lat: -23.0, lng: -43.2 },
        { lat: -23.1, lng: -43.0 },
      ],
      measurePath: [{ lat: -22.5, lng: -43.5 }],
    });
    const { result } = renderHook(() => useMapState(params));

    result.current.handleSelectionModeChange("circle");

    const nextState = applyUpdater(params.setAppState, 0, params.appState);
    expect(nextState.selectionMode).toBe("circle");
    expect(nextState.polygon).toEqual([]);
    expect(nextState.measurePath).toEqual([]);
  });

  it("handleSelectionModeChange para 'polygon' define polygon=[] e measurePath=[]", () => {
    const params = makeHookParams({
      selectionMode: "circle",
      polygon: [],
      measurePath: [{ lat: -22.5, lng: -43.5 }, { lat: -23.0, lng: -44.0 }],
    });
    const { result } = renderHook(() => useMapState(params));

    result.current.handleSelectionModeChange("polygon");

    const nextState = applyUpdater(params.setAppState, 0, params.appState);
    expect(nextState.selectionMode).toBe("polygon");
    expect(nextState.polygon).toEqual([]);
    expect(nextState.measurePath).toEqual([]);
  });

  it("handleSelectionModeChange para 'measure' limpa polígono acumulado", () => {
    const params = makeHookParams({
      selectionMode: "polygon",
      polygon: [
        { lat: -22.9, lng: -43.1 },
        { lat: -23.0, lng: -43.2 },
        { lat: -23.1, lng: -43.0 },
      ],
    });
    const { result } = renderHook(() => useMapState(params));

    result.current.handleSelectionModeChange("measure");

    const nextState = applyUpdater(params.setAppState, 0, params.appState);
    expect(nextState.selectionMode).toBe("measure");
    expect(nextState.polygon).toEqual([]);
  });
});

// ─── Validação com Zod ────────────────────────────────────────────────────────

describe("SelectionModeSchema", () => {
  it("aceita 'circle'", () => {
    expect(SelectionModeSchema.safeParse("circle").success).toBe(true);
  });

  it("aceita 'polygon'", () => {
    expect(SelectionModeSchema.safeParse("polygon").success).toBe(true);
  });

  it("aceita 'measure'", () => {
    expect(SelectionModeSchema.safeParse("measure").success).toBe(true);
  });

  it("rejeita valor desconhecido", () => {
    expect(SelectionModeSchema.safeParse("rectangle").success).toBe(false);
  });

  it("rejeita string vazia", () => {
    expect(SelectionModeSchema.safeParse("").success).toBe(false);
  });
});

describe("PolygonSchema", () => {
  it("aceita array vazio", () => {
    expect(PolygonSchema.safeParse([]).success).toBe(true);
  });

  it("aceita array com pontos LatLng válidos", () => {
    const pontos = [
      { lat: -22.9, lng: -43.1 },
      { lat: -23.0, lng: -43.2 },
      { lat: -23.1, lng: -43.0 },
    ];
    expect(PolygonSchema.safeParse(pontos).success).toBe(true);
  });

  it("aceita label opcional em cada ponto", () => {
    const pontos = [{ lat: -22.9, lng: -43.1, label: "Ponto A" }];
    expect(PolygonSchema.safeParse(pontos).success).toBe(true);
  });

  it("rejeita lat fora do intervalo [-90, 90]", () => {
    const pontos = [{ lat: 91, lng: -43.1 }];
    expect(PolygonSchema.safeParse(pontos).success).toBe(false);
  });

  it("rejeita lng fora do intervalo [-180, 180]", () => {
    const pontos = [{ lat: -22.9, lng: 181 }];
    expect(PolygonSchema.safeParse(pontos).success).toBe(false);
  });

  it("rejeita array com mais de 1000 pontos", () => {
    const pontos = Array.from({ length: 1001 }, (_, i) => ({
      lat: -22 + i * 0.001,
      lng: -43,
    }));
    expect(PolygonSchema.safeParse(pontos).success).toBe(false);
  });

  it("aceita exatamente 1000 pontos", () => {
    const pontos = Array.from({ length: 1000 }, (_, i) => ({
      lat: -22 + i * 0.00001,
      lng: -43,
    }));
    expect(PolygonSchema.safeParse(pontos).success).toBe(true);
  });
});

describe("RadiusSchema", () => {
  it("aceita 10 (mínimo)", () => {
    expect(RadiusSchema.safeParse(10).success).toBe(true);
  });

  it("aceita 50000 (máximo)", () => {
    expect(RadiusSchema.safeParse(50000).success).toBe(true);
  });

  it("aceita valor inteiro intermediário", () => {
    expect(RadiusSchema.safeParse(1000).success).toBe(true);
  });

  it("rejeita valor abaixo de 10", () => {
    expect(RadiusSchema.safeParse(9).success).toBe(false);
  });

  it("rejeita valor acima de 50000", () => {
    expect(RadiusSchema.safeParse(50001).success).toBe(false);
  });

  it("rejeita número fracionário", () => {
    expect(RadiusSchema.safeParse(100.5).success).toBe(false);
  });
});

describe("DxfExportSchema — modo círculo", () => {
  const camposPadrão = {
    layers: { buildings: true, roads: true },
    projection: "utm" as const,
    contourRenderMode: "spline" as const,
  };

  it("valida DXF com selectionMode 'circle' e center/radius válidos", () => {
    const payload = {
      ...camposPadrão,
      selectionMode: "circle",
      center: { lat: -22.9068, lng: -43.1729 },
      radius: 500,
      polygon: [],
    };
    expect(DxfExportSchema.safeParse(payload).success).toBe(true);
  });

  it("rejeita DXF com radius abaixo de 10", () => {
    const payload = {
      ...camposPadrão,
      selectionMode: "circle",
      center: { lat: -22.9068, lng: -43.1729 },
      radius: 5,
      polygon: [],
    };
    expect(DxfExportSchema.safeParse(payload).success).toBe(false);
  });

  it("rejeita DXF com center.lat inválido", () => {
    const payload = {
      ...camposPadrão,
      selectionMode: "circle",
      center: { lat: 100, lng: -43.1729 },
      radius: 500,
      polygon: [],
    };
    expect(DxfExportSchema.safeParse(payload).success).toBe(false);
  });

  it("aplica default polygon=[] quando omitido", () => {
    const payload = {
      ...camposPadrão,
      selectionMode: "circle",
      center: { lat: -22.9068, lng: -43.1729 },
      radius: 500,
    };
    const result = DxfExportSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.polygon).toEqual([]);
    }
  });
});

describe("DxfExportSchema — modo polígono", () => {
  const camposPadrão = {
    layers: { buildings: true, roads: true },
    projection: "utm" as const,
    contourRenderMode: "spline" as const,
    center: { lat: -22.9068, lng: -43.1729 },
    radius: 500,
  };

  it("valida DXF com selectionMode 'polygon' e polygon com 3 pontos", () => {
    const payload = {
      ...camposPadrão,
      selectionMode: "polygon",
      polygon: [
        { lat: -22.9, lng: -43.1 },
        { lat: -23.0, lng: -43.2 },
        { lat: -23.1, lng: -43.0 },
      ],
    };
    expect(DxfExportSchema.safeParse(payload).success).toBe(true);
  });

  it("valida DXF com selectionMode 'polygon' e polygon vazio (geometria ainda não fechada)", () => {
    const payload = {
      ...camposPadrão,
      selectionMode: "polygon",
      polygon: [],
    };
    expect(DxfExportSchema.safeParse(payload).success).toBe(true);
  });

  it("rejeita DXF com polygon contendo ponto com lat inválido", () => {
    const payload = {
      ...camposPadrão,
      selectionMode: "polygon",
      polygon: [{ lat: -200, lng: -43.1 }],
    };
    expect(DxfExportSchema.safeParse(payload).success).toBe(false);
  });

  it("rejeita DXF com selectionMode inválido", () => {
    const payload = {
      ...camposPadrão,
      selectionMode: "box",
      polygon: [],
    };
    expect(DxfExportSchema.safeParse(payload).success).toBe(false);
  });
});
