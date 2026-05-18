import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { LcpPanel } from '@/components/LcpPanel';
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('LcpPanel component', () => {
  const mockState = {
    source: null,
    terminals: [],
    roadSegments: [],
    costProfile: { id: 'urban', name: 'Urbano' },
    availableProfiles: [{ id: 'urban', name: 'Urbano' }, { id: 'rural', name: 'Rural' }],
    maxSnapDistanceMeters: 100,
    isCalculating: false,
    result: null,
    error: null,
    selectionMode: 'idle' as const,
  };

  const defaultProps = {
    state: mockState as any,
    locale: 'pt-BR' as const,
    onSetSelectionMode: vi.fn(),
    onRemoveTerminal: vi.fn(),
    onSetMaxSnapDistance: vi.fn(),
    onSetCostProfile: vi.fn(),
    onCalculate: vi.fn(),
    onReset: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders title and empty state', () => {
    render(<LcpPanel {...defaultProps} />);
    expect(screen.getByText(/Menor Custo de Traçado/i)).toBeDefined();
    expect(screen.getByText(/Não definida/i)).toBeDefined();
    expect(screen.getByText(/Nenhum terminal/i)).toBeDefined();
  });

  it('toggles selection mode for source', () => {
    render(<LcpPanel {...defaultProps} />);
    const btn = screen.getByText(/Definir Origem/i);
    fireEvent.click(btn);
    expect(defaultProps.onSetSelectionMode).toHaveBeenCalledWith('pickSource');
  });

  it('shows source coordinates when provided', () => {
    const stateWithSource = { ...mockState, source: { lat: -23.5, lon: -46.5 } };
    render(<LcpPanel {...defaultProps} state={stateWithSource as any} />);
    expect(screen.getByText(/-23.500000, -46.500000/i)).toBeDefined();
  });

  it('lists terminals and allows removal', () => {
    const stateWithTerminals = { 
        ...mockState, 
        terminals: [{ id: 't1', name: 'Terminal 1', lat: 0, lon: 0 }] 
    };
    render(<LcpPanel {...defaultProps} state={stateWithTerminals as any} />);
    
    expect(screen.getByText('Terminal 1')).toBeDefined();
    
    // Select the trash button by finding the list item
    const trashBtn = screen.getByRole('listitem').querySelector('button');
    if (trashBtn) fireEvent.click(trashBtn);
    
    expect(defaultProps.onRemoveTerminal).toHaveBeenCalledWith('t1');
  });

  it('changes cost profile', () => {
    render(<LcpPanel {...defaultProps} />);
    const select = screen.getByLabelText(/Perfil de Custo/i);
    fireEvent.change(select, { target: { value: 'rural' } });
    expect(defaultProps.onSetCostProfile).toHaveBeenCalledWith({ id: 'rural', name: 'Rural' });
  });

  it('renders results when feasible', () => {
    const mockResult = {
      feasible: true,
      totalLengthMeters: 1250,
      totalWeightedCost: 5000,
      connectedTerminals: 2,
      unreachableTerminals: [],
      paths: [
          { terminalId: 't1', totalLengthMeters: 600, totalWeightedCost: 2000, existingPolesReused: 2, sensitiveCrossings: 0 }
      ]
    };
    render(<LcpPanel {...defaultProps} state={{ ...mockState, result: mockResult } as any} />);
    
    expect(screen.getByText(/Traçado viável encontrado/i)).toBeDefined();
    expect(screen.getByText('1.25 km')).toBeDefined();
    expect(screen.getByText('5.000,00')).toBeDefined();
    expect(screen.getByText('t1')).toBeDefined();
  });

  it('renders error message', () => {
    render(<LcpPanel {...defaultProps} state={{ ...mockState, error: 'Calculo falhou' } as any} />);
    expect(screen.getByText('Calculo falhou')).toBeDefined();
  });
});
