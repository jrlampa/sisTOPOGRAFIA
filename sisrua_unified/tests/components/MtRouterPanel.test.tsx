import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import MtRouterPanel from '@/components/MtRouterPanel';
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('MtRouterPanel component', () => {
  const mockState = {
    source: null,
    terminals: [],
    roadCorridors: [],
    maxSnapDistanceMeters: 50,
    networkProfile: { conductorId: '35 Al', structureType: 'N1' },
    mtCqtParams: { voltageKv: 13.8, cqtLimitFraction: 0.05 },
    isCalculating: false,
    isParsingKmz: false,
    kmzWarnings: [],
    result: null,
    error: null,
    selectionMode: 'idle',
    isApplying: false,
  };

  const defaultProps: any = {
    state: mockState as any,
    onSetSelectionMode: vi.fn(),
    onRemoveTerminal: vi.fn(),
    onSetMaxSnapDistance: vi.fn(),
    onSetNetworkProfile: vi.fn(),
    onSetMtCqtParams: vi.fn(),
    onUploadKmz: vi.fn(),
    onCalculate: vi.fn(),
    onApply: vi.fn(),
    onReset: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders initial state correctly', () => {
    render(<MtRouterPanel {...defaultProps} />);
    expect(screen.getByText(/MT Router/i)).toBeDefined();
    expect(screen.getByText(/Importar KMZ \/ KML/i)).toBeDefined();
  });

  it('handles KMZ upload', () => {
    render(<MtRouterPanel {...defaultProps} />);
    const file = new File(['test'], 'test.kmz', { type: 'application/vnd.google-earth.kmz' });
    const input = screen.getByLabelText(/Importar KMZ \/ KML/i);

    fireEvent.change(input, { target: { files: [file] } });
    expect(defaultProps.onUploadKmz).toHaveBeenCalledWith(file);
  });

  it('toggles selection modes', () => {
    render(<MtRouterPanel {...defaultProps} />);

    const sourceBtn = screen.getByRole('button', { name: /Origem/i });
    fireEvent.click(sourceBtn);
    expect(defaultProps.onSetSelectionMode).toHaveBeenCalledWith('picking_source');

    const terminalBtn = screen.getByRole('button', { name: /Terminais/i });
    fireEvent.click(terminalBtn);
    expect(defaultProps.onSetSelectionMode).toHaveBeenCalledWith('picking_terminals');
  });

  it('shows source and terminals when provided', () => {
    const stateWithData = {
      ...mockState,
      source: { lat: -23, lon: -46 },
      terminals: [{ id: 't1', name: 'T1', position: { lat: -23.1, lon: -46.1 } }],
    };
    render(<MtRouterPanel {...defaultProps} state={stateWithData as any} />);

    expect(screen.getByText(/-23.00000, -46.00000/i)).toBeDefined();
    expect(screen.getByText(/T1/i)).toBeDefined();
  });

  it('updates snap distance and CQT params', () => {
    render(<MtRouterPanel {...defaultProps} />);

    const snapInput = screen.getByLabelText(/Snap max \(m\)/i);
    fireEvent.change(snapInput, { target: { value: '100' } });
    expect(defaultProps.onSetMaxSnapDistance).toHaveBeenCalledWith(100);

    const voltageInput = screen.getByLabelText(/Tensão de linha \(kV\)/i);
    fireEvent.change(voltageInput, { target: { value: '34.5' } });
    expect(defaultProps.onSetMtCqtParams).toHaveBeenCalledWith(
      expect.objectContaining({ voltageKv: 34.5 })
    );
  });

  it('renders routing result and allows applying', () => {
    const mockResult = {
      feasible: true,
      connectedTerminals: 1,
      totalEdgeLengthMeters: 5000,
      edges: [{}, {}],
      paths: [{ terminalId: 't1', totalDistanceMeters: 5000 }],
      unreachableTerminals: [],
      engineeringWarnings: [],
      poleDiagnostics: [],
      mtCqtReadiness: { note: 'CQT OK', pendingInputs: [] },
      mtTopologyDraft: {},
    };
    render(<MtRouterPanel {...defaultProps} state={{ ...mockState, result: mockResult } as any} />);

    expect(screen.getByText(/ROTEAMENTO VIÁVEL/i)).toBeDefined();
    expect(screen.getAllByText('5.00 km').length).toBeGreaterThan(0);

    const applyBtn = screen.getByText(/Aplicar Projeto MT/i);
    fireEvent.click(applyBtn);
    expect(defaultProps.onApply).toHaveBeenCalled();
  });

  it('shows error state', () => {
    render(
      <MtRouterPanel {...defaultProps} state={{ ...mockState, error: 'Engine timeout' } as any} />
    );
    expect(screen.getByText('Engine timeout')).toBeDefined();
  });
});
