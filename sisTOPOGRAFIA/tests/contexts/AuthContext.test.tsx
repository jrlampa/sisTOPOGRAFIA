import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import React from 'react';

// ── Mocks ──────────────────────────────────────────────────────────────────

let authStateCallback: ((user: any) => void) | null = null;

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn((_auth, cb) => {
    authStateCallback = cb;
    return vi.fn(); // unsubscribe function
  }),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  GoogleAuthProvider: vi.fn()
}));

vi.mock('../../src/config/firebase', () => ({
  auth: {},
  googleProvider: {}
}));

import { AuthProvider, useAuth } from '../../src/contexts/AuthContext';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';

// ── Test helpers ────────────────────────────────────────────────────────────

const TestConsumer: React.FC = () => {
  const { user, loading, loginWithGoogle, logout } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="user">{user ? (user as any).uid : 'null'}</span>
      <button data-testid="login" onClick={loginWithGoogle}>Login</button>
      <button data-testid="logout" onClick={logout}>Logout</button>
    </div>
  );
};

const Wrapped: React.FC = () => (
  <AuthProvider>
    <TestConsumer />
  </AuthProvider>
);

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authStateCallback = null;
  });

  // ── initial loading state ─────────────────────────────────────────────────

  it('oculta children enquanto loading=true (onAuthStateChanged ainda não disparou)', () => {
    // onAuthStateChanged never fires → loading stays true → AuthProvider hides children
    render(<Wrapped />);
    // The TestConsumer is NOT rendered because AuthProvider returns null while loading
    expect(screen.queryByTestId('loading')).toBeNull();
    expect(screen.queryByTestId('user')).toBeNull();
  });

  // ── authenticated user ────────────────────────────────────────────────────

  it('exibe o usuário correto quando onAuthStateChanged retorna user', async () => {
    render(<Wrapped />);

    await act(async () => {
      authStateCallback!({ uid: 'user-abc' });
    });

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(screen.getByTestId('user').textContent).toBe('user-abc');
  });

  // ── logged out ────────────────────────────────────────────────────────────

  it('exibe user=null quando onAuthStateChanged retorna null', async () => {
    render(<Wrapped />);

    await act(async () => {
      authStateCallback!(null);
    });

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(screen.getByTestId('user').textContent).toBe('null');
  });

  // ── loginWithGoogle ───────────────────────────────────────────────────────

  it('loginWithGoogle chama signInWithPopup com auth e googleProvider', async () => {
    (signInWithPopup as any).mockResolvedValueOnce({ user: { uid: 'new-user' } });

    render(<Wrapped />);

    await act(async () => { authStateCallback!(null); });
    await waitFor(() => screen.getByTestId('login'));

    await act(async () => {
      screen.getByTestId('login').click();
    });

    expect(signInWithPopup).toHaveBeenCalledWith({}, {}); // auth={}, googleProvider={}
  });

  it('loginWithGoogle loga erro mas não lança quando signInWithPopup falha', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    (signInWithPopup as any).mockRejectedValueOnce(new Error('Popup closed'));

    render(<Wrapped />);

    await act(async () => { authStateCallback!(null); });
    await waitFor(() => screen.getByTestId('login'));

    await act(async () => {
      screen.getByTestId('login').click();
    });

    await waitFor(() => expect(consoleSpy).toHaveBeenCalled());
    consoleSpy.mockRestore();
  });

  // ── logout ────────────────────────────────────────────────────────────────

  it('logout chama signOut com auth', async () => {
    (signOut as any).mockResolvedValueOnce(undefined);

    render(<Wrapped />);

    await act(async () => { authStateCallback!({ uid: 'user-abc' }); });
    await waitFor(() => screen.getByTestId('logout'));

    await act(async () => {
      screen.getByTestId('logout').click();
    });

    expect(signOut).toHaveBeenCalledWith({});
  });

  it('logout loga erro mas não lança quando signOut falha', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    (signOut as any).mockRejectedValueOnce(new Error('Sign out error'));

    render(<Wrapped />);

    await act(async () => { authStateCallback!(null); });
    await waitFor(() => screen.getByTestId('logout'));

    await act(async () => {
      screen.getByTestId('logout').click();
    });

    await waitFor(() => expect(consoleSpy).toHaveBeenCalled());
    consoleSpy.mockRestore();
  });

  // ── unsubscribe on unmount ────────────────────────────────────────────────

  it('cancela a assinatura de onAuthStateChanged ao desmontar', async () => {
    const unsubscribeSpy = vi.fn();
    (onAuthStateChanged as any).mockReturnValueOnce(unsubscribeSpy);

    const { unmount } = render(<Wrapped />);
    unmount();

    expect(unsubscribeSpy).toHaveBeenCalled();
  });

  // ── useAuth hook ──────────────────────────────────────────────────────────

  it('useAuth retorna valores padrão fora do provider', () => {
    const DefaultConsumer: React.FC = () => {
      const { user, loading } = useAuth();
      return <div><span data-testid="d-user">{String(user)}</span><span data-testid="d-loading">{String(loading)}</span></div>;
    };

    render(<DefaultConsumer />);

    expect(screen.getByTestId('d-user').textContent).toBe('null');
    expect(screen.getByTestId('d-loading').textContent).toBe('true');
  });

  // ── default context functions ─────────────────────────────────────────────

  it('funções padrão do contexto não lançam erros quando chamadas fora do provider', async () => {
    const DefaultFuncConsumer: React.FC = () => {
      const { loginWithGoogle, logout } = useAuth();
      return (
        <div>
          <button data-testid="default-login" onClick={() => loginWithGoogle()}>Login</button>
          <button data-testid="default-logout" onClick={() => logout()}>Logout</button>
        </div>
      );
    };

    render(<DefaultFuncConsumer />);

    // Call the default no-op functions — they should not throw
    await act(async () => {
      screen.getByTestId('default-login').click();
    });
    await act(async () => {
      screen.getByTestId('default-logout').click();
    });

    // If we get here without throwing, the default functions work correctly
    expect(screen.getByTestId('default-login')).toBeTruthy();
  });
});
