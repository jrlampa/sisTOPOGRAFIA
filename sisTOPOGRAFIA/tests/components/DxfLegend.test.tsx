import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import DxfLegend from '../../src/components/gis/DxfLegend';

describe('DxfLegend', () => {
  it('renderiza sem erros', () => {
    const { container } = render(<DxfLegend />);
    expect(container.firstChild).not.toBeNull();
  });

  it('exibe o título da legenda', () => {
    render(<DxfLegend />);
    expect(screen.getByText(/Padrão de Cores DXF/i)).toBeDefined();
  });

  it('renderiza todos os 8 itens de legenda', () => {
    render(<DxfLegend />);
    const expectedLabels = [
      'EDIFÍCIOS', 'RODOVIAS', 'VIAS PRINCIPAIS', 'VIAS LOCAIS',
      'VEGETAÇÃO', 'HIDROGRAFIA', 'INFRAESTRUTURA', 'TERRENO / CURVAS'
    ];
    expectedLabels.forEach(label => {
      expect(screen.getByText(label)).toBeDefined();
    });
  });

  it('cada item tem um índice de camada exibido em maiúsculas', () => {
    render(<DxfLegend />);
    const expectedLayers = [
      'INDEX: AMARELO', 'INDEX: VERMELHO', 'INDEX: MAGENTA', 'INDEX: LARANJA',
      'INDEX: VERDE', 'INDEX: AZUL', 'INDEX: CIANO', 'INDEX: CINZA'
    ];
    expectedLayers.forEach(layer => {
      expect(screen.getByText(layer)).toBeDefined();
    });
  });

  it('cada item tem um indicador de cor com backgroundColor definido', () => {
    const { container } = render(<DxfLegend />);
    const colorDots = container.querySelectorAll('[style*="background-color"]');
    // 8 color dots
    expect(colorDots.length).toBe(8);
  });
});
