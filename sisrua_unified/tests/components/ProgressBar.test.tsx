import React from 'react';
import { render, screen } from '@testing-library/react';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { describe, it, expect } from 'vitest';

describe('ProgressBar component', () => {
  it('renders correctly with default props', () => {
    render(<ProgressBar value={50} />);
    expect(screen.getByText('50%')).toBeDefined();
  });

  it('clamps value between 0 and 100', () => {
    const { rerender } = render(<ProgressBar value={150} />);
    expect(screen.getByText('100%')).toBeDefined();

    rerender(<ProgressBar value={-50} />);
    expect(screen.getByText('0%')).toBeDefined();
  });

  it('renders custom label when provided', () => {
    render(<ProgressBar value={30} label="Processing..." />);
    expect(screen.getByText('Processing...')).toBeDefined();
    expect(screen.queryByText('30%')).toBeNull();
  });

  it('hides label when showLabel is false', () => {
    render(<ProgressBar value={50} showLabel={false} />);
    expect(screen.queryByText('50%')).toBeNull();
  });

  it('applies correct height class based on size', () => {
    const { container, rerender } = render(<ProgressBar value={50} size="xs" />);
    expect(container.querySelector('.h-1')).toBeDefined();

    rerender(<ProgressBar value={50} size="lg" />);
    expect(container.querySelector('.h-4')).toBeDefined();
  });

  it('applies correct color class based on variant', () => {
    const { container, rerender } = render(<ProgressBar value={50} variant="emerald" />);
    expect(container.querySelector('.fill-emerald-500')).toBeDefined();

    rerender(<ProgressBar value={50} variant="rose" />);
    expect(container.querySelector('.fill-rose-500')).toBeDefined();
  });

  it('sets SVG rect width correctly', () => {
    const { container } = render(<ProgressBar value={75} />);
    const rect = container.querySelector('rect');
    expect(rect?.getAttribute('width')).toBe('75');
  });
});
