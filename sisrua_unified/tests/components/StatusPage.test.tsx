import React from 'react';
import { render, screen, act, waitFor, fireEvent } from '@testing-library/react';
import StatusPage from '@/pages/StatusPage';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';

// Mock PageShell
vi.mock('@/components/PageShell', () => ({
  PageShell: ({ children }: { children: React.ReactNode }) => <div data-testid="page-shell">{children}</div>
}));

describe('StatusPage component', () => {
  const renderWithRouter = (ui: React.ReactElement) => {
    return render(ui, { wrapper: BrowserRouter });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders correctly and loads status data', async () => {
    const mockSaude = { status: 'ok', banco: 'ok', workers: 'ok', versao: '1.0.0', uptime: 3600 };
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => mockSaude } as any);

    renderWithRouter(<StatusPage />);
    
    expect(screen.getByText(/Status da Plataforma/i)).toBeDefined();
    
    await waitFor(() => {
      expect(screen.getByText('Todos os sistemas operacionais')).toBeDefined();
    });

    expect(screen.getByText('API Backend (Express)')).toBeDefined();
    expect(screen.getAllByText('Operacional').length).toBeGreaterThan(0);
  });

  it('shows degraded status when some components are not ok', async () => {
    const mockSaude = { status: 'ok', banco: 'degradado', workers: 'ok' };
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => mockSaude } as any);

    renderWithRouter(<StatusPage />);

    await waitFor(() => {
      expect(screen.getByText(/Degradação parcial detectada/i)).toBeDefined();
      expect(screen.getByText('Degradado')).toBeDefined();
    });
  });

  it('shows critical status when API is offline', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false } as any);

    renderWithRouter(<StatusPage />);

    await waitFor(() => {
      expect(screen.getByText(/Interrupção de serviço em curso/i)).toBeDefined();
      expect(screen.getByText('Fora do Ar')).toBeDefined();
    });
  });

  it('handles fetch failure', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

    renderWithRouter(<StatusPage />);

    await waitFor(() => {
      expect(screen.getByText('API Backend')).toBeDefined();
      expect(screen.getByText('Fora do Ar')).toBeDefined();
    });
  });

  it('reloads data when Verificar button is clicked', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({}) } as any);

    renderWithRouter(<StatusPage />);
    
    await act(async () => {});

    const refreshBtn = screen.getByLabelText(/Verificar novamente/i);
    fireEvent.click(refreshBtn);

    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
