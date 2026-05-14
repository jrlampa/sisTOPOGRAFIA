import React from 'react';
import { render } from '@testing-library/react';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { describe, it, expect } from 'vitest';

describe('SkeletonLoader component', () => {
  it('renders correct number of items', () => {
    const { container } = render(<SkeletonLoader count={5} />);
    const items = container.querySelectorAll('.animate-pulse');
    expect(items.length).toBe(5);
  });

  it('applies default height and variant classes', () => {
    const { container } = render(<SkeletonLoader count={1} />);
    const item = container.querySelector('.animate-pulse');
    expect(item?.className).toContain('h-10');
    expect(item?.className).toContain('rounded-md');
  });

  it('applies avatar variant classes', () => {
    const { container } = render(<SkeletonLoader count={1} variant="avatar" />);
    const item = container.querySelector('.animate-pulse');
    expect(item?.className).toContain('rounded-full');
    expect(item?.className).toContain('w-12');
  });

  it('applies card variant classes', () => {
    const { container } = render(<SkeletonLoader count={1} variant="card" />);
    const item = container.querySelector('.animate-pulse');
    expect(item?.className).toContain('rounded-xl');
  });

  it('applies custom height', () => {
    const { container } = render(<SkeletonLoader count={1} height="h-20" />);
    const item = container.querySelector('.animate-pulse');
    expect(item?.className).toContain('h-20');
  });
});
