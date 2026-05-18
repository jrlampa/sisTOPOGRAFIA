import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { LandingAuth } from '@/components/landing/LandingAuth';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuth } from '@/auth/AuthProvider';
import { BrowserRouter } from 'react-router-dom';

// Mock framer-motion to simplify rendering in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    form: ({ children, ...props }: any) => <form {...props}>{children}</form>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock useAuth
vi.mock('@/auth/AuthProvider');

describe('LandingAuth component', () => {
  const mockSignIn = vi.fn();
  const mockAuth = {
    signInWithEmail: mockSignIn,
    loading: false,
    error: null,
    user: null,
  };

  const renderWithRouter = (ui: React.ReactElement) => {
    return render(ui, { wrapper: BrowserRouter });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue(mockAuth as any);
  });

  it('renders login form correctly', () => {
    renderWithRouter(<LandingAuth />);
    expect(screen.getByTestId('login-email')).toBeDefined();
    expect(screen.getByTestId('login-password')).toBeDefined();
    expect(screen.getByTestId('login-submit')).toBeDefined();
  });

  it('submits form for corporate email', async () => {
    renderWithRouter(<LandingAuth />);
    
    fireEvent.change(screen.getByTestId('login-email'), { target: { value: 'user@im3brasil.com.br' } });
    fireEvent.change(screen.getByTestId('login-password'), { target: { value: 'password123' } });
    
    fireEvent.click(screen.getByTestId('login-submit'));
    
    expect(mockSignIn).toHaveBeenCalledWith({
      email: 'user@im3brasil.com.br',
      password: 'password123'
    });
  });

  it('shows loading state', () => {
    vi.mocked(useAuth).mockReturnValue({ ...mockAuth, loading: true } as any);
    renderWithRouter(<LandingAuth />);
    expect(screen.getByText(/Autenticando/i)).toBeDefined();
    expect(screen.getByTestId('login-submit').hasAttribute('disabled')).toBe(true);
  });

  it('shows success message when logged in', () => {
    vi.mocked(useAuth).mockReturnValue({ ...mockAuth, user: { id: 'u1' } } as any);
    renderWithRouter(<LandingAuth />);
    expect(screen.getByTestId('login-success-message')).toBeDefined();
    expect(screen.getByText(/Bem-vindo de volta/i)).toBeDefined();
  });

  it('renders error message when authError is present', () => {
    vi.mocked(useAuth).mockReturnValue({ ...mockAuth, error: 'Auth failed' } as any);
    renderWithRouter(<LandingAuth />);
    expect(screen.getByTestId('login-error-message')).toBeDefined();
    expect(screen.getByText(/Auth failed/i)).toBeDefined();
  });
});
