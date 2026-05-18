import React from 'react';
import { render, screen } from '@testing-library/react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { describe, it, expect } from 'vitest';

describe('LoadingSpinner component', () => {
  it('renders correctly with default props', () => {
    const { container } = render(<LoadingSpinner />);
    // Check if the container div exists and has the spinner icon
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeDefined();
  });

  it('renders with label', () => {
    render(<LoadingSpinner label="Loading data..." />);
    expect(screen.getByText('Loading data...')).toBeDefined();
  });

  it('applies correct size classes', () => {
    const { rerender, container } = render(<LoadingSpinner size="sm" />);
    expect(container.querySelector('.h-16')).toBeDefined();

    rerender(<LoadingSpinner size="lg" />);
    expect(container.querySelector('.h-32')).toBeDefined();
  });

  it('renders fullScreen variant', () => {
    const { container } = render(<LoadingSpinner fullScreen />);
    // Check for fixed positioning
    const outer = container.querySelector('.fixed.inset-0');
    expect(outer).toBeDefined();
  });

  it('renders with overlay in fullScreen', () => {
    const { container } = render(<LoadingSpinner fullScreen overlay />);
    const overlay = container.querySelector('.bg-white\\/60');
    expect(overlay).toBeDefined();
  });
});
