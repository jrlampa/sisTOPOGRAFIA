import { renderHook, act } from '@testing-library/react';
import { useAutoSave, loadSessionDraft, clearSessionDraft } from '@/hooks/useAutoSave';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProjectService } from '@/services/projectService';
import { SpatialJurisdictionService } from '@/services/spatialJurisdictionService';

vi.mock('@/services/projectService');
vi.mock('@/services/spatialJurisdictionService');

describe('useAutoSave hook', () => {
  const mockState = {
    center: { lat: 0, lng: 0 },
    radius: 100,
    polygon: [],
    btTopology: { poles: [], transformers: [], edges: [] },
    mtTopology: { poles: [], edges: [] },
  } as any;

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    vi.clearAllMocks();
    
    // Mock SpatialJurisdictionService to just return the same topology
    vi.mocked(SpatialJurisdictionService.filterTopology).mockImplementation((t) => t);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('triggers auto-save after debounce delay', async () => {
    const { result } = renderHook(() => useAutoSave(mockState, true));
    
    expect(result.current.status).toBe('saving');
    
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(result.current.status).toBe('idle');
    expect(localStorage.getItem('sisrua_session_draft')).not.toBeNull();
  });

  it('saves to cloud when projectId is provided', async () => {
    vi.mocked(ProjectService.saveProjectState).mockResolvedValue(undefined);
    
    renderHook(() => useAutoSave(mockState, 'project-123'));
    
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    expect(ProjectService.saveProjectState).toHaveBeenCalledWith('project-123', expect.any(Object));
  });

  it('does not save when disabled', () => {
    const { result } = renderHook(() => useAutoSave(mockState, false));
    
    expect(result.current.status).toBe('idle');
    
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(localStorage.getItem('sisrua_session_draft')).toBeNull();
  });

  it('loadSessionDraft returns stored draft', () => {
    const draft = { version: 1, state: { center: { lat: 10, lng: 20 } }, savedAt: new Date().toISOString() };
    localStorage.setItem('sisrua_session_draft', JSON.stringify(draft));
    
    const loaded = loadSessionDraft();
    expect(loaded?.state.center.lat).toBe(10);
  });

  it('clearSessionDraft removes the draft', () => {
    localStorage.setItem('sisrua_session_draft', 'some data');
    clearSessionDraft();
    expect(localStorage.getItem('sisrua_session_draft')).toBeNull();
  });
});
