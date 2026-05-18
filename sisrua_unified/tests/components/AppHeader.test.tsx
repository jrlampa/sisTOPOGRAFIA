import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppHeader } from '@/components/AppHeader';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';

// Mock analytics to avoid side effects
vi.mock('@/utils/analytics', () => ({
  trackHeaderAction: vi.fn(),
  trackAutoSaveStatus: vi.fn(),
  trackRework: vi.fn(),
}));

// Mock AB Test
vi.mock('@/hooks/useABTest', () => ({
  useABTest: vi.fn(() => true),
}));

describe('AppHeader component', () => {
  const defaultProps = {
    locale: 'pt-BR' as const,
    canUndo: true,
    canRedo: false,
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    onSaveProject: vi.fn(),
    onOpenProject: vi.fn(),
    onOpenSettings: vi.fn(),
    onOpenHelp: vi.fn(),
    onToggleMobileMenu: vi.fn(),
    isSidebarCollapsed: false,
    onToggleSidebarCollapsed: vi.fn(),
    isDark: false,
    backendStatus: 'online' as const,
    backendResponseTimeMs: 45,
    projectName: 'Test Project',
  };

  const renderWithRouter = (ui: React.ReactElement) => {
    return render(ui, { wrapper: BrowserRouter });
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders branding and project name', () => {
    renderWithRouter(<AppHeader {...defaultProps} />);
    expect(screen.getByText('sis')).toBeDefined();
    expect(screen.getByText('UNIFIED')).toBeDefined();
    expect(screen.getByText('Test Project')).toBeDefined();
  });

  it('shows backend status correctly (online)', () => {
    renderWithRouter(<AppHeader {...defaultProps} />);
    expect(screen.getByText('API Online')).toBeDefined();
  });

  it('shows backend status correctly (offline)', () => {
    renderWithRouter(<AppHeader {...defaultProps} backendStatus="offline" />);
    expect(screen.getByText('Offline')).toBeDefined();
  });

  it('triggers onUndo when undo button is clicked', () => {
    renderWithRouter(<AppHeader {...defaultProps} />);
    // HistoryControls has the buttons. We look for the one with 'Desfazer' title or icon
    const undoBtn = screen.getByTitle(/Desfazer/i);
    fireEvent.click(undoBtn);
    expect(defaultProps.onUndo).toHaveBeenCalled();
  });

  it('triggers onSaveProject when save button is clicked', () => {
    renderWithRouter(<AppHeader {...defaultProps} />);
    const saveBtn = screen.getByText(/Salvar/i);
    fireEvent.click(saveBtn);
    expect(defaultProps.onSaveProject).toHaveBeenCalled();
  });

  it('triggers onOpenSettings when settings button is clicked', () => {
    renderWithRouter(<AppHeader {...defaultProps} />);
    const settingsBtn = screen.getByTitle(/Configurações/i);
    fireEvent.click(settingsBtn);
    expect(defaultProps.onOpenSettings).toHaveBeenCalled();
  });

  it('triggers onToggleSidebarCollapsed when sidebar toggle is clicked', () => {
    renderWithRouter(<AppHeader {...defaultProps} />);
    // The button has aria-expanded
    const toggleBtn = screen.getByRole('button', { expanded: true });
    fireEvent.click(toggleBtn);
    expect(defaultProps.onToggleSidebarCollapsed).toHaveBeenCalled();
  });

  it('handles file upload trigger', () => {
    renderWithRouter(<AppHeader {...defaultProps} />);

    // Simula seleção de arquivo no input oculto de projeto
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['{}'], 'project.json', { type: 'application/json' });
    
    fireEvent.change(input, { target: { files: [file] } });
    expect(defaultProps.onOpenProject).toHaveBeenCalledWith(file);
  });
});
