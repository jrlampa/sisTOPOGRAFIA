import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { SidebarWorkspace } from '@/components/SidebarWorkspace';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TopologyProvider } from '@/contexts/TopologyContext';
import { FeatureFlagProvider } from '@/contexts/FeatureFlagContext';

// Mock sub-components
vi.mock('@/components/SidebarSelectionControls', () => ({
  SidebarSelectionControls: () => <div data-testid="mock-selection">Selection</div>
}));
vi.mock('@/components/SidebarBtEditorSection', () => ({
  SidebarBtEditorSection: () => <div data-testid="mock-bt-editor">BT Editor</div>
}));
vi.mock('@/components/SidebarMtEditorSection', () => ({
  SidebarMtEditorSection: () => <div data-testid="mock-mt-editor">MT Editor</div>
}));
vi.mock('@/components/SidebarAnalysisResults', () => ({
  SidebarAnalysisResults: () => <div data-testid="mock-analysis">Analysis</div>
}));
vi.mock('@/components/CompliancePanel', () => ({
  CompliancePanel: () => <div data-testid="mock-compliance">Compliance</div>
}));
vi.mock('@/components/BudgetPanel', () => ({
  BudgetPanel: () => <div data-testid="mock-budget">Budget</div>
}));
vi.mock('@/components/MaintenancePanel', () => ({
  MaintenancePanel: () => <div data-testid="mock-maintenance">Maintenance</div>
}));

// Mock hooks
vi.mock('@/contexts/FeatureFlagContext', () => ({
  useFeatureFlags: vi.fn(() => ({ 
      flags: { 
          enableNbr9050: true, 
          enableSinapiBudget: true, 
          enableAiPredictiveMaintenance: true 
      } 
  })),
  FeatureFlagProvider: ({ children }: any) => <>{children}</>
}));

vi.mock('@/contexts/TopologyContext', () => ({
  useTopology: vi.fn(() => ({
    btTopology: { poles: [{ id: 'p1' }], transformers: [], edges: [] },
    mtTopology: { poles: [{ id: 'mt1' }], edges: [] },
  })),
  TopologyProvider: ({ children }: any) => <>{children}</>
}));

describe('SidebarWorkspace component', () => {
  const defaultProps: any = {
    locale: 'pt-BR',
    isCollapsed: false,
    onToggleCollapse: vi.fn(),
    isSidebarDockedForRamalModal: false,
    selectionControlsProps: { center: { lat: 0, lng: 0 } },
    btEditorSectionProps: {},
    mtEditorSectionProps: {},
    analysisResultsProps: {},
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all workflow stages icons', async () => {
    render(<SidebarWorkspace {...defaultProps} />);
    // Labels are split in the grid, e.g. "1. ÁREA" -> " ÁREA"
    expect(screen.getAllByText(/ÁREA/i)[0]).toBeDefined();
    expect(screen.getAllByText(/PROJETAR BT/i)[0]).toBeDefined();
    expect(screen.getAllByText(/PROJETAR MT/i)[0]).toBeDefined();
  });

  it('navigates through stages', async () => {
    render(<SidebarWorkspace {...defaultProps} />);
    
    // Initial stage is 1 (Selection)
    expect(await screen.findByTestId('mock-selection')).toBeDefined();

    // Click on Stage 2 (Network)
    const btEditorBtn = screen.getAllByText(/PROJETAR BT/i)[0].closest('button');
    if (btEditorBtn) fireEvent.click(btEditorBtn);
    
    expect(await screen.findByTestId('mock-bt-editor')).toBeDefined();
  });

  it('advances step via big button', async () => {
    render(<SidebarWorkspace {...defaultProps} />);
    
    const advanceBtn = screen.getByRole('button', { name: /Avançar etapa/i });
    fireEvent.click(advanceBtn);
    
    expect(await screen.findByTestId('mock-bt-editor')).toBeDefined();
  });

  it('handles collapse/expand', () => {
    const { rerender } = render(<SidebarWorkspace {...defaultProps} />);
    
    const collapseBtn = screen.getByLabelText(/Recolher Painel/i);
    fireEvent.click(collapseBtn);
    expect(defaultProps.onToggleCollapse).toHaveBeenCalledWith(true);

    rerender(<SidebarWorkspace {...defaultProps} isCollapsed={true} />);
    expect(screen.getByLabelText(/Expandir Painel/i)).toBeDefined();
  });

  it('disables next stage if requirements not met', () => {
    const propsNoArea = { ...defaultProps, selectionControlsProps: { center: null } };
    render(<SidebarWorkspace {...propsNoArea} />);
    
    const advanceBtn = screen.getByRole('button', { name: /Avançar etapa/i });
    expect(advanceBtn).toBeDisabled();
    expect(screen.getByText(/Defina uma área no mapa/i)).toBeDefined();
  });

  it('handles PageDown/PageUp hotkeys', async () => {
    render(<SidebarWorkspace {...defaultProps} />);
    
    // Initial is stage 1
    const areaBtn = screen.getAllByText(/ÁREA/i)[0].closest('button');
    expect(areaBtn).toHaveClass('bg-white/70');

    // PageDown to stage 2
    act(() => {
      fireKey('keydown', 'PageDown');
    });
    
    const btBtn = screen.getAllByText(/PROJETAR BT/i)[0].closest('button');
    expect(btBtn).toHaveClass('bg-white/70');
  });

  const fireKey = (type: 'keydown' | 'keyup', key: string) => {
    window.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true }));
  };
});
