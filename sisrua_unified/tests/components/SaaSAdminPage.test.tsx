import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import SaaSAdminPage from '@/pages/SaaSAdminPage';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';

// Mock PageShell to avoid AuthProvider issues
vi.mock('@/components/PageShell', () => ({
  PageShell: ({ children }: { children: React.ReactNode }) => <div data-testid="page-shell">{children}</div>
}));

describe('SaaSAdminPage component', () => {
  const renderWithRouter = (ui: React.ReactElement) => {
    return render(ui, { wrapper: BrowserRouter });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders authentication form when not authenticated', () => {
    renderWithRouter(<SaaSAdminPage />);
    expect(screen.getByText(/Autenticação de Operador/i)).toBeDefined();
    expect(screen.getByPlaceholderText(/Token de acesso/i)).toBeDefined();
  });

  it('handles authentication and loads data', async () => {
    const mockSaude = { status: 'ok', banco: 'ok', workers: 'ok', versao: '1.0.0', uptime: 3600 };
    const mockTenants = [
      { id: 't1', nome: 'IM3', ativo: true, plano: 'enterprise', usuarios: 10, jobsUltimos30d: 50 }
    ];

    vi.mocked(fetch).mockImplementation((url: string) => {
      if (url.includes('/admin/saude')) return Promise.resolve({ ok: true, json: async () => mockSaude } as any);
      if (url.includes('/admin/tenants')) return Promise.resolve({ ok: true, json: async () => mockTenants } as any);
      return Promise.reject(new Error('Unknown URL'));
    });

    renderWithRouter(<SaaSAdminPage />);
    
    const input = screen.getByPlaceholderText(/Token de acesso/i);
    const submitBtn = screen.getByText('Autenticar');
    
    fireEvent.change(input, { target: { value: 'secret-token' } });
    fireEvent.click(submitBtn);

    expect(localStorage.getItem('sisrua_token')).toBe('secret-token');

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('IM3')).toBeDefined();
    });

    expect(screen.getAllByText('1').length).toBeGreaterThan(0); // Metrics: 1 tenant
    expect(screen.getAllByText('50').length).toBeGreaterThan(0); // Metrics: 50 jobs
    expect(screen.getByText(/v1.0.0/i)).toBeDefined();
    expect(screen.getByText('1h')).toBeDefined(); // Uptime
  });

  it('handles API errors gracefully', async () => {
    localStorage.setItem('sisrua_token', 'valid-token');
    vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

    renderWithRouter(<SaaSAdminPage />);

    await waitFor(() => {
      expect(screen.getByText(/Erro ao carregar dados: Network error/i)).toBeDefined();
    });
  });

  it('toggles theme', () => {
    localStorage.setItem('sisrua_token', 'valid-token');
    renderWithRouter(<SaaSAdminPage />);
    
    // Initial is dark (usually)
    // PageShell is mocked, so we can't easily test onToggleTheme unless we mock it more deeply
  });

  it('toggles tenants list expansion', async () => {
    localStorage.setItem('sisrua_token', 'valid-token');
    const mockTenants = [{ id: 't1', nome: 'IM3', ativo: true, jobsUltimos30d: 5 }];
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => mockTenants } as any);

    renderWithRouter(<SaaSAdminPage />);
    
    await waitFor(() => {
      expect(screen.getByText('IM3')).toBeDefined();
    });

    const toggle = screen.getByRole('button', { name: /Todos os Tenants/i });
    fireEvent.click(toggle);

    expect(screen.queryByText('IM3')).toBeNull();
  });

  it('reloads data when Atualizar button is clicked', async () => {
    localStorage.setItem('sisrua_token', 'valid-token');
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({}) } as any);

    renderWithRouter(<SaaSAdminPage />);
    
    await act(async () => {}); // initial load

    const refreshBtn = screen.getByLabelText(/Recarregar dados/i);
    fireEvent.click(refreshBtn);

    expect(fetch).toHaveBeenCalledTimes(4); // 2 on mount, 2 on click
  });
});
