import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import BtTopologyPanel from '@/components/BtTopologyPanel';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useBtTopologyPanelBulkImport } from '@/components/BtTopologyPanel/useBtTopologyPanelBulkImport';

// Mock sub-components
vi.mock('@/components/BtTopologyPanel/BtTopologyPanelStats', () => ({
  default: () => <div data-testid="mock-stats">Stats</div>
}));
vi.mock('@/components/BtTopologyPanel/BtUnifiedDashboard', () => ({
  default: () => <div data-testid="mock-dashboard">Dashboard</div>
}));
vi.mock('@/components/BtTopologyPanel/BtTopologyPanelBulkImportModal', () => ({
  default: ({ isOpen }: { isOpen: boolean }) => isOpen ? <div data-testid="mock-bulk-modal">Bulk Modal</div> : null
}));

const mockBulkImport = {
  isBulkRamalModalOpen: false,
  setIsBulkRamalModalOpen: vi.fn(),
  bulkRamalText: '',
  setBulkRamalText: vi.fn(),
  bulkRamalFeedback: null,
  bulkImportReview: null,
  applyBulkRamalInsert: vi.fn(),
  importBulkRamaisFromWorkbook: vi.fn(),
  bulkFileInputRef: { current: null },
  handleReviewNext: vi.fn(),
};

// Mock hooks
vi.mock('@/components/BtTopologyPanel/useBtTopologyPanelBulkImport', () => ({
  useBtTopologyPanelBulkImport: vi.fn(() => mockBulkImport)
}));

vi.mock('@/components/BtTopologyPanel/useBtTopologyUpdaters', () => ({
  useBtTopologyUpdaters: vi.fn(() => ({
    updatePole: vi.fn(),
    updateTransformer: vi.fn(),
    updateEdge: vi.fn(),
  }))
}));

describe('BtTopologyPanel component', () => {
  const defaultProps = {
    locale: 'pt-BR' as const,
    btTopology: {
      poles: [{ id: 'p1', lat: 0, lng: 0, title: 'Pole 1' }],
      transformers: [{ id: 'tr1', lat: 0, lng: 0, title: 'TR 1' }],
      edges: [{ id: 'e1', fromPoleId: 'p1', toPoleId: 'p2', conductors: [] }]
    },
    onTopologyChange: vi.fn(),
    projectType: 'ramais' as const,
    onProjectTypeChange: vi.fn(),
    clandestinoAreaM2: 0,
    onClandestinoAreaChange: vi.fn(),
    accumulatedByPole: [],
    summary: { 
        poles: 1, 
        transformers: 1, 
        edges: 1, 
        totalLengthMeters: 100, 
        transformerDemandKva: 50,
        trafoUtilization: 0.5
    },
    clandestinoDisplay: { customersCount: 0, totalDemandKva: 0 },
    transformersDerived: [],
    transformerDebugById: {},
    mtTopology: { poles: [], edges: [] },
    onSetSelectedPoleId: vi.fn(),
    onSelectedPoleChange: vi.fn(),
    onSetSelectedTransformerId: vi.fn(),
    onSelectedTransformerChange: vi.fn(),
    onSetSelectedEdgeId: vi.fn(),
    onSelectedEdgeChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders stats and dashboard', () => {
    render(<BtTopologyPanel {...defaultProps} />);
    expect(screen.getByTestId('mock-stats')).toBeDefined();
    expect(screen.getByTestId('mock-dashboard')).toBeDefined();
  });

  it('allows changing project type', () => {
    render(<BtTopologyPanel {...defaultProps} />);
    const select = screen.getByLabelText(/Tipo de Projeto/i);
    fireEvent.change(select, { target: { value: 'clandestino' } });
    expect(defaultProps.onProjectTypeChange).toHaveBeenCalledWith('clandestino');
  });

  it('shows clandestino inputs when project type is clandestino', () => {
    render(<BtTopologyPanel {...defaultProps} projectType="clandestino" />);
    expect(screen.getByLabelText(/m² Médio por Cliente/i)).toBeDefined();
    expect(screen.getByLabelText(/Área de clandestinos/i)).toBeDefined();
  });

  it('triggers bulk import modal', () => {
    render(<BtTopologyPanel {...defaultProps} />);
    const bulkBtn = screen.getByText(/Importação em Massa/i);
    fireEvent.click(bulkBtn);
    
    expect(mockBulkImport.setIsBulkRamalModalOpen).toHaveBeenCalledWith(true);
  });

  it('auto-selects first items if none selected', () => {
    render(<BtTopologyPanel {...defaultProps} selectedPoleId="" />);
    expect(defaultProps.onSetSelectedPoleId).toHaveBeenCalledWith('p1');
    expect(defaultProps.onSelectedPoleChange).toHaveBeenCalledWith('p1');
  });

  it('updates clandestino area', () => {
    render(<BtTopologyPanel {...defaultProps} projectType="clandestino" />);
    const input = screen.getByLabelText(/m² Médio por Cliente/i);
    fireEvent.change(input, { target: { value: '15.5' } });
    expect(defaultProps.onClandestinoAreaChange).toHaveBeenCalledWith(15.5);
  });
});
