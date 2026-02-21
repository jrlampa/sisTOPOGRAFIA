import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import NestedLayerToggle from '../../src/components/settings/NestedLayerToggle';
import { Waves } from 'lucide-react';

const defaultProps = {
  label: 'Hidrografia',
  icon: Waves,
  active: false,
  onClick: vi.fn(),
  activeClasses: 'bg-slate-800 border-blue-500/50',
  iconActiveClass: 'text-blue-400',
  labelActiveClass: 'text-blue-200',
  dotActiveClass: 'bg-blue-500',
};

describe('NestedLayerToggle', () => {
  it('renderiza o label corretamente', () => {
    render(<NestedLayerToggle {...defaultProps} />);
    expect(screen.getByText('Hidrografia')).toBeDefined();
  });

  it('chama onClick ao clicar no botão', () => {
    const onClick = vi.fn();
    render(<NestedLayerToggle {...defaultProps} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('aplica activeClasses no container quando active=true', () => {
    const { container } = render(
      <NestedLayerToggle {...defaultProps} active={true} />
    );
    const outer = container.firstChild as HTMLElement;
    expect(outer.className).toContain('bg-slate-800');
    expect(outer.className).toContain('border-blue-500/50');
  });

  it('aplica classes padrão de inativo no container quando active=false', () => {
    const { container } = render(
      <NestedLayerToggle {...defaultProps} active={false} />
    );
    const outer = container.firstChild as HTMLElement;
    expect(outer.className).toContain('bg-slate-900');
    expect(outer.className).toContain('border-slate-800');
  });

  it('dot usa dotActiveClass quando active=true', () => {
    const { container } = render(
      <NestedLayerToggle {...defaultProps} active={true} />
    );
    const dot = container.querySelector('.ml-auto') as HTMLElement;
    expect(dot?.className).toContain('bg-blue-500');
  });

  it('dot usa bg-slate-700 quando active=false', () => {
    const { container } = render(
      <NestedLayerToggle {...defaultProps} active={false} />
    );
    const dot = container.querySelector('.ml-auto') as HTMLElement;
    expect(dot?.className).toContain('bg-slate-700');
  });
});
