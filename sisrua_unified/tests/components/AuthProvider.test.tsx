import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { supabase } from '@/lib/supabaseClient';

// Mock dependencies
vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      signInWithOAuth: vi.fn(),
    }
  },
  isSupabaseClientConfigured: vi.fn(() => true),
  allowedCorporateDomain: 'im3brasil.com.br'
}));

vi.mock('./authSession', () => ({
  clearLegacyAuthStorage: vi.fn(),
  setAuthSnapshot: vi.fn(),
}));

describe('AuthProvider', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  );

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ 
        status: 200, 
        ok: true, 
        json: async () => ({}) 
    }));
    vi.stubGlobal('location', { origin: 'http://localhost' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('initializes with anonymous mode when no session exists', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    
    // Wait for supabase.auth.getSession
    await act(async () => {});
    
    expect(result.current.mode).toBe('anonymous');
    expect(result.current.loading).toBe(false);
  });

  it('syncs session correctly with valid corporate user', async () => {
    const mockSession = {
      access_token: 'valid-token',
      user: { id: 'u123', email: 'test@im3brasil.com.br' }
    };
    
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: mockSession }, error: null } as any);
    
    // Mock onboarding and me APIs
    vi.mocked(fetch)
      .mockResolvedValueOnce({ status: 200, ok: true, json: async () => ({}) } as any) // onboarding
      .mockResolvedValueOnce({ status: 200, ok: true, json: async () => ({ access: { role: 'admin', tenantId: 't1' } }) } as any); // me

    const { result } = renderHook(() => useAuth(), { wrapper });
    
    await act(async () => {});

    expect(result.current.mode).toBe('authenticated');
    expect(result.current.user?.id).toBe('u123');
    expect(result.current.access?.role).toBe('admin');
    expect(result.current.error).toBeNull();
  });

  it('blocks sign-up for non-corporate domains', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {});

    await expect(
      result.current.signUpWithEmail({ email: 'bad@gmail.com', password: '123' })
    ).rejects.toThrow(/Use um email @im3brasil.com.br/);
  });

  it('handles sign-up success', async () => {
    vi.mocked(supabase.auth.signUp).mockResolvedValue({ data: { user: {} }, error: null } as any);
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {});

    await act(async () => {
      await result.current.signUpWithEmail({ email: 'good@im3brasil.com.br', password: '123' });
    });

    expect(result.current.message).toContain('Cadastro iniciado');
    expect(result.current.awaitingEmailConfirmation).toBe(true);
  });

  it('handles sign-in error', async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({ data: {}, error: { message: 'Invalid credentials' } } as any);
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {});

    await act(async () => {
      try {
        await result.current.signInWithEmail({ email: 'test@im3brasil.com.br', password: 'wrong' });
      } catch (e) {}
    });

    expect(result.current.error).toBe('Invalid credentials');
  });

  it('handles sign-out', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {});

    await act(async () => {
      await result.current.signOut();
    });

    expect(supabase.auth.signOut).toHaveBeenCalled();
    expect(result.current.mode).toBe('anonymous');
    expect(result.current.user).toBeNull();
  });
});
