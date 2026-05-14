import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BtUnifiedDashboard } from '@/components/BtTopologyPanel/BtUnifiedDashboard';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useBtTopologyContext } from '@/components/BtTopologyPanel/BtTopologyContext';

// Mock context hook
vi.mock('@/components/BtTopologyPanel/BtTopologyContext');

// Mock lazy tabs with correct aliased paths
vi.mock('@/components/BtTopologyPanel/BtUnifiedInfraTab', () => ({ default: () => <div data-testid="infra-tab">Infra</div> }));
vi.mock('@/components/BtTopologyPanel/BtUnifiedElectricalTab', () => ({ default: () => <div data-testid="electrical-tab">Electrical</div> }));
vi.mock('@/components/BtTopologyPanel/BtUnifiedCommercialTab', () => ({ default: () => <div data-testid="commercial-tab">Commercial</div> }));

describe('BtUnifiedDashboard component', () => {
  const mockContext = {
    locale: 'pt-BR' as const,
    selectedPole: null,
    selectedPoleIds: [],
    onSetSelectedPoleIds: vi.fn(),
    isCalculating: false,
    onBtSetPoleChangeFlag: vi.fn(),
    accumulatedByPole: [],
    mtTopology: { poles: [], edges: [] }, // Added
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useBtTopologyContext).mockReturnValue(mockContext as any);
  });

  it('renders loading state when isCalculating is true', () => {
    vi.mocked(useBtTopologyContext).mockReturnValue({ ...mockContext, isCalculating: true } as any);
    const { container } = render(<BtUnifiedDashboard />);
    expect(container.querySelector('.animate-pulse')).toBeDefined();
  });

  it('renders no selection message when nothing is selected', () => {
    render(<BtUnifiedDashboard />);
    expect(screen.getByText(/Selecione um item no mapa/i)).toBeDefined();
  });

  it('renders tabs when a single pole is selected', async () => {
    vi.mocked(useBtTopologyContext).mockReturnValue({ 
        ...mockContext, 
        selectedPole: { id: 'p1', title: 'Pole 1' },
        accumulatedByPole: [{ poleId: 'p1', dvAccumPercent: 5 }]
    } as any);
    
    render(<BtUnifiedDashboard />);
    
    expect(screen.getByText(/Infra/i)).toBeDefined();
    expect(screen.getByText(/Elétrica/i)).toBeDefined();
    
    // Default tab is Infra
    expect(await screen.findByTestId('infra-tab')).toBeDefined();
  });

  it('switches between tabs', async () => {
    vi.mocked(useBtTopologyContext).mockReturnValue({ 
        ...mockContext, 
        selectedPole: { id: 'p1', title: 'Pole 1' } 
    } as any);
    
    render(<BtUnifiedDashboard />);
    
    fireEvent.click(screen.getByText(/Elétrica/i));
    expect(await screen.findByTestId('electrical-tab')).toBeDefined();

    fireEvent.click(screen.getByText(/Comercial/i));
    expect(await screen.findByTestId('commercial-tab')).toBeDefined();
  });

  it('renders mass edit view when multiple poles are selected', () => {
    const onSetSelectedPoleIds = vi.fn();
    vi.mocked(useBtTopologyContext).mockReturnValue({ 
        ...mockContext, 
        selectedPoleIds: ['p1', 'p2'],
        onSetSelectedPoleIds
    } as any);
    
    render(<BtUnifiedDashboard />);
    
    expect(screen.getByText(/Edição em Massa/i)).toBeDefined();
    expect(screen.getByText(/2 postes selecionados/i)).toBeDefined();

    // Clear selection
    fireEvent.click(screen.getByTitle(/Limpar Seleção/i));
    expect(onSetSelectedPoleIds).toHaveBeenCalledWith([]);
  });

  it('triggers mass update action', () => {
    const onBtSetPoleChangeFlag = vi.fn();
    vi.mocked(useBtTopologyContext).mockReturnValue({ 
        ...mockContext, 
        selectedPoleIds: ['p1', 'p2'],
        onBtSetPoleChangeFlag
    } as any);
    
    render(<BtUnifiedDashboard />);
    
    fireEvent.click(screen.getByText(/Marcar todos para Substituição/i));
    expect(onBtSetPoleChangeFlag).toHaveBeenCalledWith('p1', 'replace');
    expect(onBtSetPoleChangeFlag).toHaveBeenCalledWith('p2', 'replace');
  });
});
