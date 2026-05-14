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
    expect(screen.getByText(/Centro de Ajuda/i)).toBeDefined();
    expect(screen.getByPlaceholderText(/O que você deseja aprender/i)).toBeDefined();
  });

  it('filters items based on search query', () => {
    renderWithRouter(<AjudaPage />);
    const searchInput = screen.getByPlaceholderText(/O que você deseja aprender/i);
    
    fireEvent.change(searchInput, { target: { value: 'DXF' } });
    
    // Check if relevant section is visible
    expect(screen.getByText(/Exportação DXF/i)).toBeDefined();
    // Non-relevant sections should be hidden if logic works
  });

  it('navigates through categories', () => {
    renderWithRouter(<AjudaPage />);
    
    const categories = ['Primeiros Passos', 'Design Generativo', 'Comandos de Teclado'];
    categories.forEach(cat => {
      expect(screen.getByText(cat)).toBeDefined();
    });
  });

  it('shows video tutorials section', () => {
    renderWithRouter(<AjudaPage />);
    expect(screen.getByText(/Tutoriais em Vídeo/i)).toBeDefined();
  });
});
