/**
 * DgOptimizationPanel.test.tsx — Vitest: componente de otimização DG.
 * Testa renderização condicional, botões e callbacks de aceitação.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { DgOptimizationPanel } from "../../src/components/DgOptimizationPanel";
import type { DgOptimizationPanelProps } from "../../src/components/DgOptimizationPanel";

// ─── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_SCENARIO = {
  scenarioId: "sc-1",
  trafoPositionLatLon: { lat: -22.906, lon: -43.106 },
  edges: [],
  electricalResult: {
    cqtMaxFraction: 0.05,
    worstTerminalNodeId: "p2",
    trafoUtilizationFraction: 0.4,
    totalCableLengthMeters: 28,
    feasible: true,
  },
  objectiveScore: 82.5,
  scoreComponents: {
    cableCostScore: 80,
    poleCostScore: 90,
    trafoCostScore: 85,
    cqtPenaltyScore: 75,
    overloadPenaltyScore: 88,
  },
  violations: [],
  feasible: true,
};

const MOCK_OUTPUT = {
  runId: "run-abc-123",
  computedAt: "2026-04-21T00:00:00.000Z",
  totalCandidatesEvaluated: 10,
  totalFeasible: 3,
  recommendation: {
    bestScenario: MOCK_SCENARIO,
    alternatives: [],
    discardedCount: 7,
    discardReasonSummary: { MAX_SPAN_EXCEEDED: 4, CQT_LIMIT_EXCEEDED: 3 },
  },
  params: { maxSpanMeters: 40 },
};

function defaultProps(
  overrides: Partial<DgOptimizationPanelProps> = {},
): DgOptimizationPanelProps {
  return {
    hasPoles: true,
    hasTransformer: true,
    isOptimizing: false,
    result: null,
    error: null,
    activeAltIndex: -1,
    onSetActiveAltIndex: vi.fn(),
    onRun: vi.fn(),
    onAcceptAll: vi.fn(),
    onAcceptTrafoOnly: vi.fn(),
    onDiscard: vi.fn(),
    ...overrides,
  };
}

// ─── Testes ────────────────────────────────────────────────────────────────────

describe("DgOptimizationPanel", () => {
  it("renderiza botão 'OTIMIZAR REDE' quando há postes e transformador", () => {
    render(React.createElement(DgOptimizationPanel, defaultProps()));
    expect(
      screen.getByRole("button", { name: /otimizar rede/i }),
    ).toBeInTheDocument();
  });

  it("botão 'OTIMIZAR REDE' está desabilitado quando não há postes", () => {
    render(
      React.createElement(
        DgOptimizationPanel,
        defaultProps({ hasPoles: false }),
      ),
    );
    expect(
      screen.getByRole("button", { name: /otimizar rede/i }),
    ).toBeDisabled();
  });

  it("botão 'OTIMIZAR REDE' está desabilitado quando não há transformador", () => {
    render(
      React.createElement(
        DgOptimizationPanel,
        defaultProps({ hasTransformer: false }),
      ),
    );
    expect(
      screen.getByRole("button", { name: /otimizar rede/i }),
    ).toBeDisabled();
  });

  it("chama onRun ao clicar em 'OTIMIZAR REDE'", () => {
    const onRun = vi.fn();
    render(React.createElement(DgOptimizationPanel, defaultProps({ onRun })));
    fireEvent.click(screen.getByRole("button", { name: /otimizar rede/i }));
    expect(onRun).toHaveBeenCalledOnce();
  });

  it("exibe indicador de carregamento durante otimização", () => {
    render(
      React.createElement(
        DgOptimizationPanel,
        defaultProps({ isOptimizing: true }),
      ),
    );
    expect(screen.getByText(/otimizando/i)).toBeInTheDocument();
  });

  it("exibe mensagem de erro quando error está definido", () => {
    render(
      React.createElement(
        DgOptimizationPanel,
        defaultProps({ error: "Falha ao conectar à API DG" }),
      ),
    );
    expect(screen.getByText(/falha ao conectar à api dg/i)).toBeInTheDocument();
  });

  it("exibe score e score-bar quando há resultado com recomendação", () => {
    render(
      React.createElement(
        DgOptimizationPanel,
        defaultProps({ result: MOCK_OUTPUT }),
      ),
    );
    // Score 82.5 deve aparecer formatado
    expect(screen.getByText(/82/)).toBeInTheDocument();
    // Botões de aceitação devem aparecer
    expect(
      screen.getByRole("button", { name: /só trafo/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /aceitar tudo/i }),
    ).toBeInTheDocument();
  });

  it("chama onAcceptAll com o bestScenario ao clicar em 'ACEITAR TUDO'", () => {
    const onAcceptAll = vi.fn();
    render(
      React.createElement(
        DgOptimizationPanel,
        defaultProps({ result: MOCK_OUTPUT, onAcceptAll }),
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: /aceitar tudo/i }));
    expect(onAcceptAll).toHaveBeenCalledWith(MOCK_SCENARIO);
  });

  it("chama onAcceptTrafoOnly com o bestScenario ao clicar em 'SÓ TRAFO'", () => {
    const onAcceptTrafoOnly = vi.fn();
    render(
      React.createElement(
        DgOptimizationPanel,
        defaultProps({ result: MOCK_OUTPUT, onAcceptTrafoOnly }),
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: /só trafo/i }));
    expect(onAcceptTrafoOnly).toHaveBeenCalledWith(MOCK_SCENARIO);
  });

  it("chama onDiscard ao clicar em 'DESCARTAR'", () => {
    const onDiscard = vi.fn();
    render(
      React.createElement(
        DgOptimizationPanel,
        defaultProps({ result: MOCK_OUTPUT, onDiscard }),
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: /descartar/i }));
    expect(onDiscard).toHaveBeenCalledOnce();
  });

  it("exibe motivos de descarte quando discardReasonSummary não está vazio", () => {
    render(
      React.createElement(
        DgOptimizationPanel,
        defaultProps({ result: MOCK_OUTPUT }),
      ),
    );
    // MAX_SPAN_EXCEEDED → "Vão máximo excedido"
    expect(screen.getByText(/vão máximo excedido/i)).toBeInTheDocument();
    // CQT_LIMIT_EXCEEDED → "Limite CQT excedido"
    expect(screen.getByText(/limite cqt excedido/i)).toBeInTheDocument();
  });

  it("mostra mensagem de 'sem solução viável' quando totalFeasible é 0", () => {
    const outputNoFeasible = {
      ...MOCK_OUTPUT,
      totalFeasible: 0,
      recommendation: null,
    };
    render(
      React.createElement(
        DgOptimizationPanel,
        defaultProps({ result: outputNoFeasible }),
      ),
    );
    expect(screen.getByText(/nenhuma solução viável/i)).toBeInTheDocument();
  });

  it("não exibe navegação de alternativas quando alternatives está vazio", () => {
    render(
      React.createElement(
        DgOptimizationPanel,
        defaultProps({ result: MOCK_OUTPUT }),
      ),
    );
    // Sem alternativas, só o botão "Melhor" não deve aparecer como pill de nav
    expect(screen.queryByRole("button", { name: /alt\. 1/i })).not.toBeInTheDocument();
  });

  it("exibe pills de alternativas quando há alternativas disponíveis", () => {
    const ALT_SCENARIO = { ...MOCK_SCENARIO, scenarioId: "sc-2", objectiveScore: 75.0 };
    const outputWithAlts = {
      ...MOCK_OUTPUT,
      recommendation: {
        ...MOCK_OUTPUT.recommendation,
        alternatives: [ALT_SCENARIO],
      },
    };
    render(
      React.createElement(
        DgOptimizationPanel,
        defaultProps({ result: outputWithAlts }),
      ),
    );
    expect(screen.getByRole("button", { name: /melhor/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /alt\. 1/i })).toBeInTheDocument();
  });

  it("chama onSetActiveAltIndex(0) ao clicar em 'Alt. 1'", () => {
    const ALT_SCENARIO = { ...MOCK_SCENARIO, scenarioId: "sc-2", objectiveScore: 75.0 };
    const outputWithAlts = {
      ...MOCK_OUTPUT,
      recommendation: {
        ...MOCK_OUTPUT.recommendation,
        alternatives: [ALT_SCENARIO],
      },
    };
    const onSetActiveAltIndex = vi.fn();
    render(
      React.createElement(
        DgOptimizationPanel,
        defaultProps({ result: outputWithAlts, onSetActiveAltIndex }),
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: /alt\. 1/i }));
    expect(onSetActiveAltIndex).toHaveBeenCalledWith(0);
  });

  it("chama onSetActiveAltIndex(-1) ao clicar em 'Melhor'", () => {
    const ALT_SCENARIO = { ...MOCK_SCENARIO, scenarioId: "sc-2", objectiveScore: 75.0 };
    const outputWithAlts = {
      ...MOCK_OUTPUT,
      recommendation: {
        ...MOCK_OUTPUT.recommendation,
        alternatives: [ALT_SCENARIO],
      },
    };
    const onSetActiveAltIndex = vi.fn();
    render(
      React.createElement(
        DgOptimizationPanel,
        defaultProps({ result: outputWithAlts, activeAltIndex: 0, onSetActiveAltIndex }),
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: /melhor/i }));
    expect(onSetActiveAltIndex).toHaveBeenCalledWith(-1);
  });

  it("exibe score da alternativa selecionada quando activeAltIndex >= 0", () => {
    const ALT_SCENARIO = { ...MOCK_SCENARIO, scenarioId: "sc-2", objectiveScore: 75.0 };
    const outputWithAlts = {
      ...MOCK_OUTPUT,
      recommendation: {
        ...MOCK_OUTPUT.recommendation,
        alternatives: [ALT_SCENARIO],
      },
    };
    render(
      React.createElement(
        DgOptimizationPanel,
        defaultProps({ result: outputWithAlts, activeAltIndex: 0 }),
      ),
    );
    expect(screen.getByText(/75/)).toBeInTheDocument();
  });
});
