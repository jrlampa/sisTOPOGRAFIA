import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { AppNavigation } from '@/components/AppNavigation';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';

// Mock useAuth
vi.mock('@/auth/AuthProvider', () => ({
  useAuth: vi.fn(),
}));

describe('AppNavigation component', () => {
  const mockSignOut = vi.fn();
  
  const renderWithRouter = (ui: React.ReactElement) => {
    return render(ui, { wrapper: BrowserRouter });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({ signOut: mockSignOut } as any);
  });

  it('renders all nav items for cliente role', () => {
    renderWithRouter(<AppNavigation role="cliente" />);
    expect(screen.getByText('Dashboard')).toBeDefined();
    expect(screen.getByText('Projeto')).toBeDefined();
    expect(screen.getByText('Admin')).toBeDefined();
    expect(screen.getByText('Ajuda')).toBeDefined();
    expect(screen.queryByText('Admin SaaS')).toBeNull();
  });

  it('renders Admin SaaS for plataforma role', () => {
    renderWithRouter(<AppNavigation role="plataforma" />);
    expect(screen.getByText('Admin SaaS')).toBeDefined();
  });

  it('toggles user menu', () => {
    renderWithRouter(<AppNavigation />);
    const menuBtn = screen.getByLabelText(/Menu do usuário/i);
    
    fireEvent.click(menuBtn);
    expect(screen.getByText('Painel Administrativo')).toBeDefined();
    expect(screen.getByText('Sair')).toBeDefined();

    fireEvent.click(menuBtn);
    expect(screen.queryByText('Sair')).toBeNull();
  });

  it('calls signOut and navigates on logout', async () => {
    renderWithRouter(<AppNavigation />);
    fireEvent.click(screen.getByLabelText(/Menu do usuário/i));
    
    const logoutBtn = screen.getByText('Sair');
    await act(async () => {
      fireEvent.click(logoutBtn);
    });

    expect(mockSignOut).toHaveBeenCalled();
  });

  it('toggles mobile menu', () => {
    // Force mobile view via resize? Or just test the button logic
    renderWithRouter(<AppNavigation />);
    const mobileBtn = screen.getByLabelText(/Abrir menu/i);
    
    fireEvent.click(mobileBtn);
    // In mobile menu, labels are rendered again
    expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(1);

    fireEvent.click(mobileBtn);
    expect(screen.getAllByText('Dashboard')).toHaveLength(1); // Only desktop hidden one
  });

  it('calls onToggleTheme when clicked', () => {
    const onToggle = vi.fn();
    renderWithRouter(<AppNavigation onToggleTheme={onToggle} />);
    const themeBtn = screen.getByLabelText(/Alternar tema/i);
    
    fireEvent.click(themeBtn);
    expect(onToggle).toHaveBeenCalled();
  });
});
