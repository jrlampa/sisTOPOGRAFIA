import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import LayerToggle from '../../src/components/settings/LayerToggle';
import { Building2 } from 'lucide-react';

describe('LayerToggle', () => {
  it('renderiza o label corretamente', () => {
    render(
      <LayerToggle
        label="Edificações"
        icon={Building2}
        active={false}
        onClick={vi.fn()}
        colorClass="bg-yellow-500/20 text-yellow-500"
      />
    );
    expect(screen.getByText('Edificações')).toBeDefined();
  });

  it('chama onClick ao clicar no botão', () => {
    const onClick = vi.fn();
    render(
      <LayerToggle
        label="Edificações"
        icon={Building2}
        active={true}
        onClick={onClick}
        colorClass="bg-yellow-500/20 text-yellow-500"
      />
    );

    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('aplica estilos diferentes no estado ativo vs inativo', () => {
    const { rerender } = render(
      <LayerToggle
        label="Layer"
        icon={Building2}
        active={true}
        onClick={vi.fn()}
        colorClass="bg-yellow-500/20 text-yellow-500"
      />
    );

    // Active: border-white/40
    const activeButton = screen.getByRole('button');
    expect(activeButton.className).toContain('border-white/40');

    rerender(
      <LayerToggle
        label="Layer"
        icon={Building2}
        active={false}
        onClick={vi.fn()}
        colorClass="bg-yellow-500/20 text-yellow-500"
      />
    );

    // Inactive: border-white/20
    const inactiveButton = screen.getByRole('button');
    expect(inactiveButton.className).toContain('border-white/20');
  });

  it('indicador (dot) está visível no estado ativo e inativo', () => {
    const { container, rerender } = render(
      <LayerToggle
        label="Layer"
        icon={Building2}
        active={true}
        onClick={vi.fn()}
        colorClass="bg-blue-500/20 text-blue-500"
      />
    );

    // Active dot: style background-color applied
    const activeDot = container.querySelector('.ml-auto') as HTMLElement;
    expect(activeDot).not.toBeNull();

    rerender(
      <LayerToggle
        label="Layer"
        icon={Building2}
        active={false}
        onClick={vi.fn()}
        colorClass="bg-blue-500/20 text-blue-500"
      />
    );

    const inactiveDot = container.querySelector('.ml-auto') as HTMLElement;
    expect(inactiveDot?.className).toContain('bg-slate-400');
  });
});
