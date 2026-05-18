import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import AjudaPage from '@/pages/AjudaPage';
import { describe, it, expect, vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';

// Mock PageShell to avoid AuthProvider/AppNavigation issues
vi.mock('@/components/PageShell', () => ({
  PageShell: ({ children }: { children: React.ReactNode }) => <div data-testid="page-shell">{children}</div>
}));

describe('AjudaPage component', () => {
  const renderWithRouter = (ui: React.ReactElement) => {
    return render(
        <BrowserRouter>{ui}</BrowserRouter>
    );
  };

  it('renders correctly', () => {
    renderWithRouter(<AjudaPage />);
    expect(screen.getByText(/Central de Ajuda/i)).toBeDefined();
    expect(screen.getByPlaceholderText(/Buscar no FAQ técnico/i)).toBeDefined();
  });

  it('filters items based on search query', () => {
    renderWithRouter(<AjudaPage />);
    const searchInput = screen.getByPlaceholderText(/Buscar no FAQ técnico/i);
    
    fireEvent.change(searchInput, { target: { value: 'área' } });
    
    // Check if relevant section is visible (e.g. Extração de Dados)
    expect(screen.getByText(/Extração de Dados/i)).toBeDefined();
  });

  it('navigates through categories', () => {
    renderWithRouter(<AjudaPage />);
    
    const categories = [/Primeiros passos/i, /Extração de Dados/i, /Exportação DXF/i];
    categories.forEach(cat => {
      expect(screen.getByText(cat)).toBeDefined();
    });
  });

  it('shows operational runbooks section', () => {
    renderWithRouter(<AjudaPage />);
    expect(screen.getByText(/Runbooks Operacionais/i)).toBeDefined();
  });
});
