import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BtExportSummaryBanner } from '@/components/BtExportSummaryBanner';
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('BtExportSummaryBanner component', () => {
  const mockLatest = {
    criticalPoleId: 'P123',
    criticalAccumulatedClients: 10,
    criticalAccumulatedDemandKva: 15.5,
    btContextUrl: 'http://test.com/ctx.json',
    totalPoles: 10,
    verifiedPoles: 5,
    cqt: {
        scenario: 'atual',
        dmdi: 0.05,
        p31: 215,
        p32: 210,
        k10QtMttr: 0.001
    }
  };

  const mockHistory = [
    { 
        exportedAt: new Date().toISOString(), 
        projectType: 'ramais', 
        criticalPoleId: 'H1', 
        criticalAccumulatedDemandKva: 12,
        btContextUrl: '' 
    }
  ] as any;

  const defaultProps = {
    latestBtExport: mockLatest as any,
    btExportHistory: mockHistory,
    exportBtHistoryJson: vi.fn(),
    exportBtHistoryCsv: vi.fn(),
    clearBtExportHistory: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when no data provided', () => {
    const { container } = render(
      <BtExportSummaryBanner 
        {...defaultProps} 
        latestBtExport={null} 
        btExportHistory={[]} 
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders summary correctly when expanded', () => {
    render(<BtExportSummaryBanner {...defaultProps} />);
    expect(screen.getByText('P123')).toBeDefined();
    expect(screen.getByText('15.50 kVA')).toBeDefined();
    expect(screen.getByText('CQT ATUAL')).toBeDefined();
    expect(screen.getByText('5/10')).toBeDefined(); // Postes vericados/total
  });

  it('collapses and expands when clicked', () => {
    render(<BtExportSummaryBanner {...defaultProps} />);
    
    // Header click to collapse
    fireEvent.click(screen.getByTitle('Minimizar resumo'));
    expect(screen.queryByText('Ponto crítico:')).toBeNull();
    expect(screen.getByText(/\(clique para expandir\)/i)).toBeDefined();

    // Button click to expand
    fireEvent.click(screen.getByRole('button', { name: 'Expandir resumo BT' }));
    expect(screen.getByText('Ponto crítico:')).toBeDefined();
  });

  it('calls export functions', () => {
    render(<BtExportSummaryBanner {...defaultProps} />);
    
    fireEvent.click(screen.getByText('JSON'));
    expect(defaultProps.exportBtHistoryJson).toHaveBeenCalled();

    fireEvent.click(screen.getByText('CSV'));
    expect(defaultProps.exportBtHistoryCsv).toHaveBeenCalled();
  });

  it('calls clear history', () => {
    render(<BtExportSummaryBanner {...defaultProps} />);
    fireEvent.click(screen.getByText('Limpar'));
    expect(defaultProps.clearBtExportHistory).toHaveBeenCalled();
  });

  it('handles filters', () => {
    const onTypeChange = vi.fn();
    render(
      <BtExportSummaryBanner 
        {...defaultProps} 
        onHistoryProjectTypeFilterChange={onTypeChange} 
      />
    );
    
    const typeSelect = screen.getByLabelText(/Filtro de tipo de projeto/i);
    fireEvent.change(typeSelect, { target: { value: 'clandestino' } });
    expect(onTypeChange).toHaveBeenCalledWith('clandestino');
  });

  it('renders pagination controls for history', () => {
    // History with multiple items
    const manyItems = Array.from({ length: 10 }, (_, i) => ({
        ...mockHistory[0],
        criticalPoleId: `H${i}`
    }));
    
    render(<BtExportSummaryBanner {...defaultProps} btExportHistory={manyItems} />);
    
    expect(screen.getByLabelText(/Próxima página/i)).toBeDefined();
    expect(screen.getByText('Página 1/2')).toBeDefined();
  });
});
