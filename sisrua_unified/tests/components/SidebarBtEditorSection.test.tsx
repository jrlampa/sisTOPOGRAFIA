vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

// Mock lazy components synchronously for unit tests
vi.mock("../../src/components/BtTopologyPanel", () => ({
  default: () => <div data-testid="bt-topology-panel">BtTopologyPanel Mock</div>
}));
vi.mock("../../src/components/DgOptimizationPanel", () => ({
  DgOptimizationPanel: ({ locale: _locale }: any) => <div data-testid="dg-panel">dgPanel.title</div>
}));
vi.mock("../../src/components/MtRouterPanel", () => ({
  default: () => <div data-testid="mt-router-panel">MtRouterPanel Mock</div>
}));
vi.mock("../../src/contexts/FeatureFlagContext", async () => {
  const { DEFAULT_FEATURE_FLAGS } = await vi.importActual<
    typeof import("../../src/types/featureFlags")
  >("../../src/types/featureFlags");

  return {
    useFeatureFlags: () => ({
      flags: DEFAULT_FEATURE_FLAGS,
      customPresets: [],
      featureHealth: {},
      toggleFlag: vi.fn(),
      applyPreset: vi.fn(),
      saveCustomPreset: vi.fn(),
      deleteCustomPreset: vi.fn(),
      resetToDefaults: vi.fn(),
      isReady: true,
    }),
  };
});

/**
 * SidebarBtEditorSection.test.tsx — Vitest: teste da barra lateral BT.
 * Verifica renderização de seções, painel DG e controles de topologia.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { SidebarBtEditorSection } from "../../src/components/SidebarBtEditorSection";
import { INITIAL_APP_STATE } from "../../src/app/initialState";
import { EMPTY_BT_TOPOLOGY } from "../../src/utils/btNormalization";
import { TopologyProvider } from "../../src/contexts/TopologyContext";

const MOCK_TOPOLOGY_STATE: any = {
  btTopology: { poles: [], transformers: [], edges: [] },
  mtTopology: { poles: [], edges: [] },
  btNetworkScenario: { mode: 'ramal' },
  btEditorMode: { mode: 'none' },
  isCalculating: false,
  updateBtTopology: vi.fn(),
  updateMtTopology: vi.fn(),
  setBtNetworkScenario: vi.fn(),
  setBtEditorMode: vi.fn(),
};

const DEFAULT_PROPS: any = {
  locale: "pt-BR",
  settings: INITIAL_APP_STATE.settings,
  setBtNetworkScenario: vi.fn(),
  setBtEditorMode: vi.fn(),
  btNetworkScenario: "asis",
  btEditorMode: "none",
  btTopology: EMPTY_BT_TOPOLOGY,
  btAccumulatedByPole: [],
  btSummary: { poles: 0, transformers: 0, edges: 0, totalLengthMeters: 0, transformerDemandKva: 0, transformerDemandKw: 0 },
  btPointDemandKva: 0,
  btTransformerDebugById: {},
  btPoleCoordinateInput: "",
  setBtPoleCoordinateInput: vi.fn(),
  handleBtInsertPoleByCoordinates: vi.fn(),
  clearPendingBtEdge: vi.fn(),
  pendingNormalClassificationPoles: [],
  handleResetBtTopology: vi.fn(),
  updateBtTopology: vi.fn(),
  updateProjectType: vi.fn(),
  updateClandestinoAreaM2: vi.fn(),
  handleBtSelectedPoleChange: vi.fn(),
  handleBtSelectedTransformerChange: vi.fn(),
  handleBtSelectedEdgeChange: vi.fn(),
  handleBtRenamePole: vi.fn(),
  handleBtRenameTransformer: vi.fn(),
  handleBtSetEdgeChangeFlag: vi.fn(),
  handleBtSetPoleChangeFlag: vi.fn(),
  handleBtTogglePoleCircuitBreak: vi.fn(),
  handleBtSetTransformerChangeFlag: vi.fn(),
  btClandestinoDisplay: { demandKva: 0, demandKw: 0, areaMin: 0, areaMax: 0, baseDemandKva: 0, diversificationFactor: null, finalDemandKva: 0 },
  btTransformersDerived: [],
  requestCriticalConfirmation: vi.fn(),
  mtTopology: { poles: [], edges: [] }
};

describe("SidebarBtEditorSection", () => {
  it("deve renderizar o título da seção e o seletor de cenário", () => {
    render(
      <TopologyProvider value={MOCK_TOPOLOGY_STATE}>
        <React.Suspense fallback={<div>Loading...</div>}>
          <SidebarBtEditorSection {...DEFAULT_PROPS} />
        </React.Suspense>
      </TopologyProvider>
    );
    expect(screen.getByText(/toolbox/i)).toBeInTheDocument();
    // Usa getAllByText e verifica se ao menos um está lá
    expect(screen.getAllByText(/rede atual/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/rede nova/i)).toBeInTheDocument();
  });

  it("deve renderizar o painel DG quando onRunDgOptimization é fornecido", async () => {
    render(
      <TopologyProvider value={MOCK_TOPOLOGY_STATE}>
        <SidebarBtEditorSection {...DEFAULT_PROPS} onRunDgOptimization={vi.fn()} />
      </TopologyProvider>
    );
    expect(await screen.findByText(/dgPanel.title/i)).toBeInTheDocument();
  });

  it("deve exibir os botões de controle de topologia", () => {
    render(
      <TopologyProvider value={MOCK_TOPOLOGY_STATE}>
        <SidebarBtEditorSection {...DEFAULT_PROPS} />
      </TopologyProvider>
    );
    expect(screen.getByRole("button", { name: /\+ poste/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /\+ condutor/i })).toBeInTheDocument();
  });
});

