import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BimInspectorDrawer } from '@/components/BimInspectorDrawer';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock focus trap
vi.mock('@/hooks/useFocusTrap', () => ({
  useFocusTrap: vi.fn()
}));

// Mock FeatureFlags
vi.mock('@/contexts/FeatureFlagContext', () => ({
  useFeatureFlags: vi.fn(() => ({
    flags: { enableMechanicalCalculation: true }
  }))
}));

describe('BimInspectorDrawer component', () => {
  const mockPole = {
    id: 'p123',
    title: 'Test Pole',
    lat: 10,
    lng: 20,
    poleSpec: { heightM: 11, material: 'CC' },
    btStructures: { si1: 'E1', si2: 'E2' },
    verified: false,
    dataSource: 'manual'
  };

  const mockAccumulated = {
    poleId: 'p123',
    dvAccumPercent: 5.5,
    voltageV: 215.2,
    localTrechoDemandKva: 2.1,
    accumulatedDemandKva: 15.4,
    accumulatedClients: 12,
    cqtStatus: 'NORMAL'
  };

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    pole: mockPole as any,
    accumulatedData: mockAccumulated as any,
    btTopology: { poles: [mockPole], transformers: [], edges: [] } as any,
    locale: 'pt-BR' as const,
    onRenamePole: vi.fn(),
    onSetPoleChangeFlag: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when pole is null', () => {
    const { container } = render(<BimInspectorDrawer {...defaultProps} pole={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders correctly when open', () => {
    render(<BimInspectorDrawer {...defaultProps} />);
    expect(screen.getByText(/Inspeção Deep BIM/i)).toBeDefined();
    expect(screen.getByText(/ASSET ID: p123/i)).toBeDefined();
    expect(screen.getByDisplayValue('Test Pole')).toBeDefined();
  });

  it('switches between tabs', () => {
    render(<BimInspectorDrawer {...defaultProps} />);
    
    // Default is Engineering
    expect(screen.getByText('CQT Acumulada')).toBeDefined();

    // Switch to BIM
    fireEvent.click(screen.getByText('BIM / Specs'));
    expect(screen.getByText('Especificações Físicas (BIM)')).toBeDefined();
    expect(screen.getByText('11m')).toBeDefined();
    expect(screen.getByText('CC')).toBeDefined();

    // Switch to Notes
    fireEvent.click(screen.getByText('Anotações'));
    expect(screen.getByText('Observações Gerais')).toBeDefined();
  });

  it('calls onRenamePole when title changes', () => {
    render(<BimInspectorDrawer {...defaultProps} />);
    const input = screen.getByDisplayValue('Test Pole');
    fireEvent.change(input, { target: { value: 'New Pole Name' } });
    expect(defaultProps.onRenamePole).toHaveBeenCalledWith('p123', 'New Pole Name');
  });

  it('calls onSetPoleChangeFlag when clicking Validate button', () => {
    render(<BimInspectorDrawer {...defaultProps} />);
    const validateBtn = screen.getByText('Validar Ativo');
    fireEvent.click(validateBtn);
    expect(defaultProps.onSetPoleChangeFlag).toHaveBeenCalledWith('p123', 'replace');
  });

  it('shows transformer info when provided', () => {
    const mockTransformer = { id: 't1', projectPowerKva: 75, demandKva: 45 };
    render(<BimInspectorDrawer {...defaultProps} transformer={mockTransformer as any} />);
    expect(screen.getByText('Transformador Ativo')).toBeDefined();
    expect(screen.getByText(/Potência: 75 kVA/i)).toBeDefined();
  });
});
