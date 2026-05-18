import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SettingsModal from '@/components/SettingsModal';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock framer-motion locally
vi.mock('framer-motion', () => {
  const React = require('react');
  return {
    motion: {
      div: ({ children, ...props }: any) => React.createElement('div', props, children),
    },
    AnimatePresence: ({ children }: any) => children,
  };
});

// Mock sub-tabs
vi.mock('@/components/settings/SettingsModalProjectTab', () => ({
  SettingsModalProjectTab: () => <div data-testid="project-tab">Project Tab</div>
}));
vi.mock('@/components/settings/SettingsModalGeneralTab', () => ({
  SettingsModalGeneralTab: () => <div data-testid="general-tab">General Tab</div>
}));
vi.mock('@/components/settings/SettingsModalExportFooter', () => ({
  SettingsModalExportFooter: () => <div data-testid="export-footer">Footer</div>
}));

// Mock focus trap
vi.mock('@/hooks/useFocusTrap', () => ({
  useFocusTrap: vi.fn()
}));

describe('SettingsModal component', () => {
  const mockSettings: any = {
    locale: 'pt-BR',
    layers: {},
    projectMetadata: { projectName: 'Test' }
  };

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    settings: mockSettings,
    onUpdateSettings: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when closed', () => {
    const { container } = render(<SettingsModal {...defaultProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders correctly when open', () => {
    render(<SettingsModal {...defaultProps} />);
    expect(screen.getByRole('heading', { name: /Painel de Controle/i })).toBeDefined();
    // Default tab is general
    expect(screen.getByTestId('general-tab')).toBeDefined();
    expect(screen.getByTestId('export-footer')).toBeDefined();
  });

  it('switches tabs', () => {
    render(<SettingsModal {...defaultProps} />);
    
    const projectTabBtn = screen.getByText(/Projeto & Metadados/i);
    fireEvent.click(projectTabBtn);
    
    expect(screen.getByTestId('project-tab')).toBeDefined();
  });

  it('calls onClose when clicking the close button', () => {
    render(<SettingsModal {...defaultProps} />);
    const closeBtn = screen.getByText(/Fechar painel/i);
    fireEvent.click(closeBtn);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('calls onClose when pressing Escape', () => {
    render(<SettingsModal {...defaultProps} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(defaultProps.onClose).toHaveBeenCalled();
  });
});
