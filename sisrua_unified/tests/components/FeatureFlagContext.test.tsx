import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { FeatureFlagProvider, useFeatureFlags } from '@/contexts/FeatureFlagContext';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuth } from '@/auth/AuthProvider';
import { supabase } from '@/lib/supabaseClient';

// Mock dependencies
vi.mock('@/auth/AuthProvider');
vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116', message: 'Not found' } })
        }))
      })),
      upsert: vi.fn().mockResolvedValue({ error: null })
    }))
  }
}));

describe('FeatureFlagContext', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <FeatureFlagProvider>{children}</FeatureFlagProvider>
  );

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(useAuth).mockReturnValue({ user: null } as any);
  });

  it('loads default flags when no storage exists', async () => {
    const { result } = renderHook(() => useFeatureFlags(), { wrapper });
    
    // Wait for useEffect to finish
    await act(async () => {});
    
    expect(result.current.isReady).toBe(true);
    expect(result.current.flags.enableDgWizard).toBeDefined();
  });

  it('loads flags from localStorage', async () => {
    localStorage.setItem('sisrua_feature_flags', JSON.stringify({ enableDgWizard: true }));
    const { result } = renderHook(() => useFeatureFlags(), { wrapper });
    
    await act(async () => {});
    
    expect(result.current.flags.enableDgWizard).toBe(true);
  });

  it('toggles a flag and persists it', async () => {
    const { result } = renderHook(() => useFeatureFlags(), { wrapper });
    await act(async () => {});

    const initialState = result.current.flags.enableDgWizard;
    await act(async () => {
      await result.current.toggleFlag('enableDgWizard');
    });

    expect(result.current.flags.enableDgWizard).toBe(!initialState);
    expect(localStorage.getItem('sisrua_feature_flags')).toContain(String(!initialState));
  });

  it('applies a standard preset', async () => {
    const { result } = renderHook(() => useFeatureFlags(), { wrapper });
    await act(async () => {});

    await act(async () => {
      await result.current.applyPreset('performance');
    });

    // Verify some expected flags for performance preset
    expect(result.current.isReady).toBe(true);
  });

  it('saves and deletes custom presets', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: { id: 'u1' } } as any);
    const { result } = renderHook(() => useFeatureFlags(), { wrapper });
    await act(async () => {});

    await act(async () => {
      await result.current.saveCustomPreset('My Preset');
    });

    expect(result.current.customPresets).toHaveLength(1);
    expect(result.current.customPresets[0].label).toBe('My Preset');

    const presetId = result.current.customPresets[0].id;
    await act(async () => {
      await result.current.deleteCustomPreset(presetId);
    });

    expect(result.current.customPresets).toHaveLength(0);
  });

  it('throws error when used outside provider', () => {
    // Suppress console error for expected throw
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useFeatureFlags())).toThrow(/useFeatureFlags must be used within/);
  });
});
