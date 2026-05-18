import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import FloatingLayerPanel from '@/components/FloatingLayerPanel';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadFloatingLayerPanelUiState } from '@/utils/preferencesPersistence';

// Mock preferencesPersistence
vi.mock('@/utils/preferencesPersistence', () => ({
  loadFloatingLayerPanelUiState: vi.fn(() => ({ isExpanded: false, searchQuery: '' })),
  persistFloatingLayerPanelUiState: vi.fn(),
}));

describe('FloatingLayerPanel component', () => {
  const mockSettings = {
    layers: {
      buildings: true,
      roads: false,
      btNetwork: true,
      mtNetwork: true,
      labels: false,
      dimensions: false,
      furniture: false,
      grid: false,
      nature: false,
      terrain: false,
      contours: false,
      electricalAudit: false,
      cqtHeatmap: false,
      disablePopups: false,
      curbs: false,
      slopeAnalysis: false,
    }
  };

  const mockOnUpdateSettings = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders closed by default', () => {
    render(<FloatingLayerPanel settings={mockSettings as any} onUpdateSettings={mockOnUpdateSettings} isDark={false} />);
    expect(screen.queryByText(/HUD de camadas/i)).toBeNull();
  });

  it('opens when the toggle button is clicked', () => {
    render(<FloatingLayerPanel settings={mockSettings as any} onUpdateSettings={mockOnUpdateSettings} isDark={false} />);
    const toggle = screen.getByLabelText(/Abrir painel de camadas/i);
    fireEvent.click(toggle);
    expect(screen.getByText(/HUD de camadas/i)).toBeDefined();
    expect(screen.getByText('3 ativas')).toBeDefined();
  });

  it('filters layers based on search query', () => {
    // Open panel first
    vi.mocked(loadFloatingLayerPanelUiState).mockReturnValue({ isExpanded: true, searchQuery: '' });
    
    render(<FloatingLayerPanel settings={mockSettings as any} onUpdateSettings={mockOnUpdateSettings} isDark={false} />);
    
    const searchInput = screen.getByPlaceholderText(/Filtrar/i);
    fireEvent.change(searchInput, { target: { value: 'Rede' } });
    
    expect(screen.getByText('Rede BT')).toBeDefined();
    expect(screen.getByText('Rede MT')).toBeDefined();
    expect(screen.queryByText('Edifícios')).toBeNull();
  });

  it('toggles an individual layer', () => {
    vi.mocked(loadFloatingLayerPanelUiState).mockReturnValue({ isExpanded: true, searchQuery: '' });

    render(<FloatingLayerPanel settings={mockSettings as any} onUpdateSettings={mockOnUpdateSettings} isDark={false} />);
    
    const buildingsBtn = screen.getByTitle('Edifícios');
    fireEvent.click(buildingsBtn);
    
    expect(mockOnUpdateSettings).toHaveBeenCalledWith(expect.objectContaining({
        layers: expect.objectContaining({ buildings: false })
    }));
  });

  it('applies a preset correctly', () => {
    vi.mocked(loadFloatingLayerPanelUiState).mockReturnValue({ isExpanded: true, searchQuery: '' });

    render(<FloatingLayerPanel settings={mockSettings as any} onUpdateSettings={mockOnUpdateSettings} isDark={false} />);
    
    const cleanPreset = screen.getByText('Mapa limpo');
    fireEvent.click(cleanPreset);
    
    expect(mockOnUpdateSettings).toHaveBeenCalled();
    // Verify that ONLY btNetwork and mtNetwork are true in the call
    const callArgs = mockOnUpdateSettings.mock.calls[0][0];
    expect(callArgs.layers.btNetwork).toBe(true);
    expect(callArgs.layers.buildings).toBe(false);
  });
});
