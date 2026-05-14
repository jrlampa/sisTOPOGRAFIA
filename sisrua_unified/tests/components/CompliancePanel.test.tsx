import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { CompliancePanel } from '@/components/CompliancePanel';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCompliance } from '@/hooks/useCompliance';
import { useFeatureFlags } from '../../src/contexts/FeatureFlagContext';

// Mock hooks
vi.mock('@/hooks/useCompliance');
vi.mock('../../src/contexts/FeatureFlagContext');

describe('CompliancePanel component', () => {
  const mockRunAnalysis = vi.fn();
  const mockCompliance = {
    runAnalysis: mockRunAnalysis,
    loading: false,
    result: null,
    error: null,
  };

  const mockFlags = {
    flags: {
      enableNbr9050: true,
      enableEnvironmentalAudit: true,
      enableSolarShading: true,
    }
  };

  const defaultProps = {
    topology: { poles: [{ id: 'p1' }], transformers: [], edges: [] } as any,
    osmData: [],
    locale: 'pt-BR',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useCompliance).mockReturnValue(mockCompliance as any);
    vi.mocked(useFeatureFlags).mockReturnValue(mockFlags as any);
  });

  it('renders initial state correctly', () => {
    render(<CompliancePanel {...defaultProps} />);
    expect(screen.getByText(/Clique no ícone de atualização/i)).toBeDefined();
    expect(screen.getByTitle(/Executar Análise Automática/i)).toBeDefined();
  });

  it('triggers analysis when button is clicked', () => {
    render(<CompliancePanel {...defaultProps} />);
    const btn = screen.getByTitle(/Executar Análise Automática/i);
    fireEvent.click(btn);
    expect(mockRunAnalysis).toHaveBeenCalledWith(defaultProps.topology, defaultProps.osmData);
  });

  it('shows loading state', () => {
    vi.mocked(useCompliance).mockReturnValue({ ...mockCompliance, loading: true } as any);
    render(<CompliancePanel {...defaultProps} />);
    // Check for animate-spin on the icon
    expect(document.querySelector('.animate-spin')).toBeDefined();
  });

  it('shows error state', () => {
    vi.mocked(useCompliance).mockReturnValue({ ...mockCompliance, error: 'Analysis failed' } as any);
    render(<CompliancePanel {...defaultProps} />);
    expect(screen.getByText('Analysis failed')).toBeDefined();
  });

  it('renders all sections when results are provided', () => {
    const mockResult = {
      land: { totalConflitos: 1, conflicts: [{ poleId: 'p1', propertyName: 'Prop A' }] },
      environmental: { riskLevel: 'BAIXO' },
      vegetation: { riscoOperacional: 'baixo' },
      urban: { score: 95 },
      solar: { results: [] }
    };
    vi.mocked(useCompliance).mockReturnValue({ ...mockCompliance, result: mockResult } as any);
    
    render(<CompliancePanel {...defaultProps} />);
    
    expect(screen.getByText(/Gestão Fundiária/i)).toBeDefined();
    expect(screen.getByText(/Auditoria Ambiental/i)).toBeDefined();
    expect(screen.getByText(/Análise de Vegetação/i)).toBeDefined();
    expect(screen.getByText(/Acessibilidade Urbana/i)).toBeDefined();
    expect(screen.getByText(/Irradiação e Sombreamento/i)).toBeDefined();
    
    expect(screen.getByText('Prop A')).toBeDefined();
    expect(screen.getByText('95%')).toBeDefined();
  });

  it('hides sections based on feature flags', () => {
    vi.mocked(useFeatureFlags).mockReturnValue({
        flags: {
            enableNbr9050: false,
            enableEnvironmentalAudit: false,
            enableSolarShading: false,
        }
    } as any);

    const mockResult = {
      land: { totalConflitos: 0, conflicts: [] },
      environmental: { riskLevel: 'BAIXO' },
      urban: { score: 100 }
    };
    vi.mocked(useCompliance).mockReturnValue({ ...mockCompliance, result: mockResult } as any);

    render(<CompliancePanel {...defaultProps} />);
    
    expect(screen.queryByText(/Auditoria Ambiental/i)).toBeNull();
    expect(screen.queryByText(/Acessibilidade Urbana/i)).toBeNull();
    expect(screen.getByText(/Gestão Fundiária/i)).toBeDefined();
  });
});
