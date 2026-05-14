import { renderHook, act } from '@testing-library/react';
import { useAppElectricalAudit } from '@/hooks/useAppElectricalAudit';
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('useAppElectricalAudit hook', () => {
  const mockShowToast = vi.fn();
  const mockSettings = { layers: { electricalAudit: true } };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes correctly', () => {
    const { result } = renderHook(() => useAppElectricalAudit({ settings: mockSettings, showToast: mockShowToast }));
    expect(result.current.isAuditOpen).toBe(false);
    expect(result.current.selectedAuditElement).toBeNull();
  });

  it('opens audit panel when layer is enabled and element is selected', () => {
    const { result, rerender } = renderHook(
      (props) => useAppElectricalAudit(props),
      { initialProps: { settings: mockSettings, showToast: mockShowToast } }
    );

    act(() => {
      result.current.setSelectedAuditElement({ id: 'e1' });
    });

    expect(result.current.isAuditOpen).toBe(true);

    // Disable layer
    rerender({ settings: { layers: { electricalAudit: false } }, showToast: mockShowToast });
    expect(result.current.isAuditOpen).toBe(false);
  });

  it('handles audit actions', () => {
    const { result } = renderHook(() => useAppElectricalAudit({ settings: mockSettings, showToast: mockShowToast }));

    act(() => {
        result.current.setIsAuditOpen(true);
    });

    act(() => {
      result.current.handleAuditAction('approve', 'Looks good');
    });

    expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining('aprovada'), 'success');
    expect(result.current.isAuditOpen).toBe(false);

    act(() => {
        result.current.handleAuditAction('reject', 'Bad wiring');
    });
    expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining('rejeitada'), 'info');
  });
});
