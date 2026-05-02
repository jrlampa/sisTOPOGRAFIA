vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
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
    render(<SidebarBtEditorSection {...DEFAULT_PROPS} />);
    expect(screen.getByText(/editor bt/i)).toBeInTheDocument();
    // Usa getAllByText e verifica se ao menos um está lá
    expect(screen.getAllByText(/rede atual/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/rede nova/i)).toBeInTheDocument();
  });

  it("deve renderizar o painel DG quando onRunDgOptimization é fornecido", () => {
    render(<SidebarBtEditorSection {...DEFAULT_PROPS} onRunDgOptimization={vi.fn()} />);
    expect(screen.getByText(/dgPanel.title/i)).toBeInTheDocument();
  });

  it("deve exibir os botões de controle de topologia", () => {
    render(<SidebarBtEditorSection {...DEFAULT_PROPS} />);
    expect(screen.getByRole("button", { name: /\+ poste/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /\+ condutor/i })).toBeInTheDocument();
  });
});

