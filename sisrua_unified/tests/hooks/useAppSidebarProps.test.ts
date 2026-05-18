import { renderHook } from '@testing-library/react';
import { useAppSidebarProps } from '@/hooks/useAppSidebarProps';
import { describe, it, expect, vi } from 'vitest';

describe('useAppSidebarProps hook', () => {
  const mockParams = {
    settings: { locale: 'pt-BR' },
    center: { lat: 0, lng: 0 },
    searchQuery: 'test',
    setSearchQuery: vi.fn(),
    isSearching: false,
    handleSearch: vi.fn(),
    selectionMode: 'circle',
    handleSelectionModeChange: vi.fn(),
    radius: 100,
    handleRadiusChange: vi.fn(),
    saveSnapshot: vi.fn(),
    handleFetchAndAnalyze: vi.fn(),
    isProcessing: false,
    isPolygonValid: true,
    setBtNetworkScenario: vi.fn(),
    setBtEditorMode: vi.fn(),
    btNetworkScenario: 'asis',
    btEditorMode: 'none',
    btTopology: { poles: [], transformers: [], edges: [] },
    dgTopologySource: null,
    btAccumulatedByPole: [],
    btSummary: {},
    btPointDemandKva: 0,
    btTransformerDebugById: {},
    btPoleCoordinateInput: '',
    setBtPoleCoordinateInput: vi.fn(),
    handleBtInsertPoleByCoordinates: vi.fn(),
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
    btClandestinoDisplay: {},
    btTransformersDerived: [],
    requestCriticalConfirmation: vi.fn(),
    handleTriggerTelescopicAnalysis: vi.fn(),
    isDgOptimizing: false,
    dgResult: null,
    dgError: null,
    dgActiveAltIndex: -1,
    handleRunDgOptimization: vi.fn(),
    handleAcceptDgAll: vi.fn(),
    handleAcceptDgTrafoOnly: vi.fn(),
    handleDiscardDgResult: vi.fn(),
    setDgActiveAltIndex: vi.fn(),
    isPreviewActive: true,
    setIsPreviewActive: vi.fn(),
    selectedPoleId: '',
    selectedPoleIds: [],
    selectedEdgeId: '',
    selectedTransformerId: '',
    setSelectedPoleId: vi.fn(),
    setSelectedPoleIds: vi.fn(),
    setSelectedEdgeId: vi.fn(),
    setSelectedTransformerId: vi.fn(),
    mtTopology: { poles: [], edges: [] },
    osmData: null,
    stats: null,
    analysisText: '',
    terrainData: null,
    error: null,
    handleDownloadDxf: vi.fn(),
    handleDownloadCoordinatesCsv: vi.fn(),
    isDownloading: false,
    showToast: vi.fn(),
    isCalculating: false,
  } as any;

  it('aggregates props correctly into specialized objects', () => {
    const { result } = renderHook(() => useAppSidebarProps(mockParams));

    expect(result.current.sidebarSelectionControlsProps).toBeDefined();
    expect(result.current.sidebarBtEditorSectionProps).toBeDefined();
    expect(result.current.sidebarAnalysisResultsProps).toBeDefined();

    // Verify a mapping
    expect(result.current.sidebarSelectionControlsProps.radius).toBe(100);
    expect(result.current.sidebarBtEditorSectionProps.btNetworkScenario).toBe('asis');
    expect(result.current.sidebarAnalysisResultsProps.isDownloading).toBe(false);
  });

  it('memoizes objects when dependencies do not change', () => {
    const { result, rerender } = renderHook(
      (params) => useAppSidebarProps(params),
      { initialProps: mockParams }
    );

    const firstSelectionProps = result.current.sidebarSelectionControlsProps;
    
    rerender({ ...mockParams }); // Same values, new object
    
    expect(result.current.sidebarSelectionControlsProps).toBe(firstSelectionProps);
  });
});
