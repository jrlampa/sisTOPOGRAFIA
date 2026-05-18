import { renderHook, act } from '@testing-library/react';
import { useProjectDataWorkflow } from '@/hooks/useProjectDataWorkflow';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useKmlImport } from '@/hooks/useKmlImport';
import { useFileOperations } from '@/hooks/useFileOperations';
import { SpatialJurisdictionService } from '@/services/spatialJurisdictionService';

// Mock hooks
vi.mock('@/hooks/useKmlImport');
vi.mock('@/hooks/useFileOperations');
vi.mock('@/services/spatialJurisdictionService');

describe('useProjectDataWorkflow hook', () => {
  const mockAppState = {
    btTopology: { poles: [], transformers: [], edges: [] },
    settings: { locale: 'pt-BR' },
    polygon: [],
    radius: 100,
    center: { lat: 0, lng: 0 }
  } as any;

  const mockSetAppState = vi.fn();
  const mockClearData = vi.fn();
  const mockClearPendingBtEdge = vi.fn();
  const mockShowToast = vi.fn();

  const mockImportKml = vi.fn();
  const mockSaveProject = vi.fn();
  const mockLoadProject = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
    vi.mocked(useKmlImport).mockReturnValue({ importKml: mockImportKml } as any);
    vi.mocked(useFileOperations).mockReturnValue({ 
        saveProject: mockSaveProject, 
        loadProject: mockLoadProject 
    } as any);
    vi.mocked(SpatialJurisdictionService.filterTopology).mockImplementation((t) => t);
  });

  it('handles KML drop', async () => {
    const { result } = renderHook(() => useProjectDataWorkflow({
      appState: mockAppState,
      setAppState: mockSetAppState,
      clearData: mockClearData,
      clearPendingBtEdge: mockClearPendingBtEdge,
      showToast: mockShowToast
    }));

    const file = new File(['test'], 'test.kml');
    await act(async () => {
      await result.current.handleKmlDrop(file);
    });

    expect(mockImportKml).toHaveBeenCalledWith(file);
  });

  it('handles save project with filtering', () => {
    const { result } = renderHook(() => useProjectDataWorkflow({
      appState: mockAppState,
      setAppState: mockSetAppState,
      clearData: mockClearData,
      clearPendingBtEdge: mockClearPendingBtEdge,
      showToast: mockShowToast
    }));

    act(() => {
      result.current.handleSaveProject();
    });

    expect(SpatialJurisdictionService.filterTopology).toHaveBeenCalled();
    expect(mockSaveProject).toHaveBeenCalled();
  });

  it('handles load project', () => {
    const { result } = renderHook(() => useProjectDataWorkflow({
      appState: mockAppState,
      setAppState: mockSetAppState,
      clearData: mockClearData,
      clearPendingBtEdge: mockClearPendingBtEdge,
      showToast: mockShowToast
    }));

    const file = new File(['test'], 'test.srua');
    act(() => {
      result.current.handleLoadProject(file);
    });

    expect(mockClearPendingBtEdge).toHaveBeenCalled();
    expect(mockLoadProject).toHaveBeenCalledWith(file);
  });

  it('triggers setAppState on successful polygon import', () => {
    let successCallback: any;
    vi.mocked(useKmlImport).mockImplementation((options: any) => {
        successCallback = options.onImportSuccess;
        return { importKml: mockImportKml } as any;
    });

    renderHook(() => useProjectDataWorkflow({
      appState: mockAppState,
      setAppState: mockSetAppState,
      clearData: mockClearData,
      clearPendingBtEdge: mockClearPendingBtEdge,
      showToast: mockShowToast
    }));

    act(() => {
        successCallback({ type: 'polygon', points: [{ lat: 1, lng: 1 }] }, 'area.kml');
    });

    expect(mockSetAppState).toHaveBeenCalledWith(expect.objectContaining({
        selectionMode: 'polygon',
        polygon: [{ lat: 1, lng: 1 }]
    }), true);
    expect(mockClearData).toHaveBeenCalled();
  });

  it('triggers setAppState on successful poles import', () => {
    let successCallback: any;
    vi.mocked(useKmlImport).mockImplementation((options: any) => {
        successCallback = options.onImportSuccess;
        return { importKml: mockImportKml } as any;
    });

    renderHook(() => useProjectDataWorkflow({
      appState: mockAppState,
      setAppState: mockSetAppState,
      clearData: mockClearData,
      clearPendingBtEdge: mockClearPendingBtEdge,
      showToast: mockShowToast
    }));

    act(() => {
        successCallback({ type: 'points', points: [{ lat: 1, lng: 1 }], names: ['P1'] }, 'poles.kml');
    });

    expect(mockSetAppState).toHaveBeenCalledWith(expect.objectContaining({
        btTopology: expect.objectContaining({
            poles: expect.arrayContaining([expect.objectContaining({ title: 'P1' })])
        })
    }), true);
    expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining('1 poste(s)'), 'success');
  });
});
