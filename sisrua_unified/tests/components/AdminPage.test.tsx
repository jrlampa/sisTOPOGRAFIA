import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import AdminPage from '@/components/AdminPage/AdminPage';
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('AdminPage component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders correctly with default settings', () => {
    render(<AdminPage />);
    expect(screen.getByText(/Configurações de Admin/i)).toBeDefined();
    expect(screen.getByDisplayValue('API Core')).toBeDefined();
  });

  it('handles form submission successfully', async () => {
    render(<AdminPage />);
    
    const saveBtn = screen.getByText('Salvar Alterações');
    fireEvent.click(saveBtn);

    // Should show "Processando..."
    expect(screen.getByText('Processando...')).toBeDefined();

    // Advance timer for the mock save promise (800ms)
    await act(async () => {
      vi.advanceTimersByTime(850);
    });

    expect(screen.getByText(/Configurações salvas com sucesso/i)).toBeDefined();

    // Advance timer for success message dismissal (3000ms)
    await act(async () => {
      vi.advanceTimersByTime(3100);
    });

    expect(screen.queryByText(/Configurações salvas com sucesso/i)).toBeNull();
  });

  it('resets form when Descartar button is clicked', () => {
    render(<AdminPage />);
    
    const themeSelect = screen.getByLabelText(/Tema/i);
    fireEvent.change(themeSelect, { target: { value: 'light' } });
    expect(themeSelect.value).toBe('light');

    const resetBtn = screen.getByText('Descartar Tudo');
    fireEvent.click(resetBtn);

    expect(themeSelect.value).toBe('dark'); // Back to default
  });
});
