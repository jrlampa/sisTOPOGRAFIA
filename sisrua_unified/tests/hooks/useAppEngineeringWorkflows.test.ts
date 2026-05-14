import { renderHook, act } from '@testing-library/react';
import { useAppEngineeringWorkflows } from '@/hooks/useAppEngineeringWorkflows';
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('useAppEngineeringWorkflows hook', () => {
  const mockHandlers = {
    dgTopologySource: { poles: [], transformers: [], edges: [] },
    runDgOptimization: vi.fn(),
    dgResult: { runId: 'run-1' },
    logDgDecision: vi.fn(),
    dgActiveScenario: { scenarioId: 's1', objectiveScore: 100 },
    setAppState: vi.fn(),
    applyDgAll: vi.fn(() => ({})),
    applyDgTrafoOnly: vi.fn(() => ({})),
    clearDgResult: vi.fn(),
    showToast: vi.fn(),
    findNearestMtPole: vi.fn(),
    updateBtTopology: vi.fn(),
    isBtTelescopicAnalyzing: false,
    triggerBtTelescopicAnalysis: vi.fn((a, b, c, d, cb) => cb && cb(vi.fn())),
    btTopology: { poles: [], transformers: [], edges: [] },
    btAccumulatedByPole: [],
    btTransformerDebugById: {},
    requestCriticalConfirmation: vi.fn((config) => config.onConfirm()),
    settings: { btNetworkScenario: 'projeto' },
    clearBtTelescopicSuggestions: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs DG optimization', () => {
    const { result } = renderHook(() => useAppEngineeringWorkflows(mockHandlers));
    const wizardParams = { some: 'param' } as any;
    
    act(() => {
      result.current.handleRunDgOptimization(wizardParams);
    });

    expect(mockHandlers.runDgOptimization).toHaveBeenCalledWith(mockHandlers.dgTopologySource, wizardParams);
  });

  it('accepts DG all solution', () => {
    const { result } = renderHook(() => useAppEngineeringWorkflows(mockHandlers));
    const scenario = { 
        scenarioId: 's1', 
        objectiveScore: 90, 
        trafoPositionLatLon: { lat: 0, lon: 0 },
        electricalResult: { cqtMaxFraction: 0.1, trafoUtilizationFraction: 0.5, totalCableLengthMeters: 100 },
        scoreComponents: {}
    } as any;

    act(() => {
      result.current.handleAcceptDgAll(scenario);
    });

    expect(mockHandlers.logDgDecision).toHaveBeenCalledWith('all', scenario);
    expect(mockHandlers.updateBtTopology).toHaveBeenCalled();
    expect(mockHandlers.showToast).toHaveBeenCalledWith(expect.stringContaining("DG aplicada"), "success");
    expect(result.current.lastAppliedDgResults?.score).toBe(90);
  });

  it('discards DG result', () => {
    const { result } = renderHook(() => useAppEngineeringWorkflows(mockHandlers));
    
    act(() => {
      result.current.handleDiscardDgResult();
    });

    expect(mockHandlers.logDgDecision).toHaveBeenCalledWith('discard', mockHandlers.dgActiveScenario);
    expect(mockHandlers.clearDgResult).toHaveBeenCalled();
    expect(mockHandlers.showToast).toHaveBeenCalledWith(expect.stringContaining("descartada"), "info");
  });

  it('triggers telescopic analysis', () => {
    const { result } = renderHook(() => useAppEngineeringWorkflows(mockHandlers));
    
    act(() => {
      result.current.handleTriggerTelescopicAnalysis();
    });

    expect(mockHandlers.triggerBtTelescopicAnalysis).toHaveBeenCalled();
    expect(mockHandlers.requestCriticalConfirmation).toHaveBeenCalled();
  });
});
