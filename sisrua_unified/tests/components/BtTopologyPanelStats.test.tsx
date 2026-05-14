import React from 'react';
import { render, screen } from '@testing-library/react';
import BtTopologyPanelStats from '@/components/BtTopologyPanel/BtTopologyPanelStats';
import { describe, it, expect } from 'vitest';

describe('BtTopologyPanelStats component', () => {
  const defaultProps = {
    locale: 'pt-BR' as const,
    poles: 10,
    transformers: 1,
    edges: 8,
    totalLengthMeters: 450,
    transformerDemandKva: 60,
    transformerNominalKva: 75,
    spanLengthsM: [35, 45, 55, 110],
  };

  it('renders basic counts and lengths', () => {
    render(<BtTopologyPanelStats {...defaultProps} />);
    expect(screen.getByText('10P')).toBeDefined();
    expect(screen.getByText('1T')).toBeDefined();
    expect(screen.getByText('8V')).toBeDefined();
    expect(screen.getByText('450m')).toBeDefined();
  });

  it('renders trafo utilization donut', () => {
    render(<BtTopologyPanelStats {...defaultProps} />);
    // utilPct = (60/75)*100 = 80%
    expect(screen.getByLabelText(/Utilização do trafo: 80.0%/i)).toBeDefined();
    expect(screen.getByText('60.0')).toBeDefined();
    expect(screen.getByText('/ 75 kVA')).toBeDefined();
  });

  it('renders span histogram labels', () => {
    render(<BtTopologyPanelStats {...defaultProps} />);
    expect(screen.getByLabelText(/Histograma de vãos/i)).toBeDefined();
    expect(screen.getByText('<30')).toBeDefined();
    expect(screen.getByText('30-50')).toBeDefined();
    expect(screen.getByText('>100')).toBeDefined();
  });

  it('shows empty message for spans when no data provided', () => {
    render(<BtTopologyPanelStats {...defaultProps} spanLengthsM={[]} />);
    expect(screen.getByText(/sem dados/i)).toBeDefined();
  });

  it('renders clandestine summary when active', () => {
    const clandestinoDisplay = {
        customersCount: 100,
        totalDemandKva: 150,
        finalDemandKva: 120,
        diversificationFactor: 0.8
    };
    render(
      <BtTopologyPanelStats 
        {...defaultProps} 
        isClandestino={true} 
        clandestinoDisplay={clandestinoDisplay} 
      />
    );
    expect(screen.getByText(/Modo Clandestino/i)).toBeDefined();
    expect(screen.getByText('120.00 kVA')).toBeDefined();
    expect(screen.getByText('0.80')).toBeDefined();
  });
});
