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
    hasProjectedPoles: false,
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

  it("renderiza botão 'PROJETAR REDE (WIZARD)' quando não há transformador", () => {
    render(
      React.createElement(
        DgOptimizationPanel,
        defaultProps({ hasTransformer: false }),
      ),
    );
    expect(
      screen.getByRole("button", { name: /projetar rede \(wizard\)/i }),
    ).toBeInTheDocument();
  });

  it("botão está desabilitado quando não há postes", () => {
    render(
      React.createElement(
        DgOptimizationPanel,
        defaultProps({ hasPoles: false }),
      ),
    );
    // Quando não há postes, o botão fica desabilitado idependente do modo
    const btn = screen.queryByRole("button", { name: /otimizar|projetar/i });
    expect(btn).toBeDisabled();
  });

  it("chama onRun ao clicar em 'OTIMIZAR REDE' (modo legado)", () => {
    const onRun = vi.fn();
    render(React.createElement(DgOptimizationPanel, defaultProps({ onRun })));
    fireEvent.click(screen.getByRole("button", { name: /otimizar rede/i }));
    expect(onRun).toHaveBeenCalledOnce();
  });

  it("abre Wizard ao clicar em 'PROJETAR REDE (WIZARD)'", () => {
    render(
      React.createElement(
        DgOptimizationPanel,
        defaultProps({ hasTransformer: false }),
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: /projetar rede/i }));
    expect(screen.getByText(/wizard projeto bt/i)).toBeInTheDocument();
  });

  it("executa onRun com parâmetros do wizard", () => {
    const onRun = vi.fn();
    render(
      React.createElement(
        DgOptimizationPanel,
        defaultProps({ hasTransformer: false, onRun }),
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: /projetar rede/i }));
    fireEvent.click(screen.getByRole("button", { name: /próximo/i }));
    fireEvent.click(screen.getByRole("button", { name: /próximo/i }));
    fireEvent.click(screen.getByRole("button", { name: /próximo/i }));
    fireEvent.click(screen.getByRole("button", { name: /executar projeto/i }));

    expect(onRun).toHaveBeenCalledOnce();
    expect(onRun).toHaveBeenCalledWith(
      expect.objectContaining({
        clientesPorPoste: 1,
        areaClandestinaM2: 0,
        demandaMediaClienteKva: 1.5,
        fatorSimultaneidade: 0.8,
        maxSpanMeters: 40,
      }),
    );
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
    expect(screen.getByText(/82/)).toBeInTheDocument();
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
});
