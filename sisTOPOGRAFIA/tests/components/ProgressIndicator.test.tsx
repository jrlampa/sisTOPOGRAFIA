import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import ProgressIndicator from '../../src/components/ui/ProgressIndicator';

describe('ProgressIndicator', () => {
  it('não renderiza nada quando isVisible=false', () => {
    const { container } = render(
      <ProgressIndicator isVisible={false} progress={50} message="Processando..." />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renderiza o componente quando isVisible=true', () => {
    render(<ProgressIndicator isVisible={true} progress={50} message="Carregando dados..." />);
    expect(screen.getByText('Carregando dados...')).toBeDefined();
    expect(screen.getByText('Processando')).toBeDefined();
  });

  it('exibe a porcentagem correta arredondada', () => {
    render(<ProgressIndicator isVisible={true} progress={73.6} message="Processando..." />);
    expect(screen.getByText('74%')).toBeDefined();
  });

  it('exibe 0% quando progress=0', () => {
    render(<ProgressIndicator isVisible={true} progress={0} message="Iniciando..." />);
    expect(screen.getByText('0%')).toBeDefined();
  });

  it('exibe 100% quando progress=100', () => {
    render(<ProgressIndicator isVisible={true} progress={100} message="Concluído!" />);
    expect(screen.getByText('100%')).toBeDefined();
    expect(screen.getByText('Concluído!')).toBeDefined();
  });

  it('barra de progresso tem largura proporcional ao progress', () => {
    const { container } = render(
      <ProgressIndicator isVisible={true} progress={42} message="..." />
    );
    // Find the div with inline style width
    const progressBar = container.querySelector('[style*="width: 42%"]');
    expect(progressBar).not.toBeNull();
  });
});
