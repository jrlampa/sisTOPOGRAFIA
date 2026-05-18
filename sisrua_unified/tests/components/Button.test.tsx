import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '@/components/ui/Button';
import { describe, it, expect, vi } from 'vitest';

describe('Button component', () => {
  it('renders children correctly', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeDefined();
  });

  it('handles click events', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    fireEvent.click(screen.getByText('Click me'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('shows loading spinner when isLoading is true', () => {
    render(<Button isLoading>Click me</Button>);
    // Loader2 is a lucide-react component, it usually renders an svg
    // We can check if the button is disabled and text is not visible (based on Button.tsx logic)
    const button = screen.getByRole('button');
    expect(button.hasAttribute('disabled')).toBe(true);
    // In Button.tsx, children are not rendered when isLoading is true
    expect(screen.queryByText('Click me')).toBeNull();
  });

  it('renders icon when provided', () => {
    const Icon = () => <span data-testid="test-icon">Icon</span>;
    render(<Button icon={<Icon />}>With Icon</Button>);
    expect(screen.getByTestId('test-icon')).toBeDefined();
    expect(screen.getByText('With Icon')).toBeDefined();
  });

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled Button</Button>);
    const button = screen.getByRole('button');
    expect(button.hasAttribute('disabled')).toBe(true);
  });

  it('applies custom className', () => {
    render(<Button className="custom-class">Classy</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('custom-class');
  });

  it('applies variant classes', () => {
    const { rerender } = render(<Button variant="primary">Primary</Button>);
    expect(screen.getByRole('button').className).toContain('bg-brand-600');

    rerender(<Button variant="danger">Danger</Button>);
    expect(screen.getByRole('button').className).toContain('bg-severity-critical');
  });

  it('applies size classes', () => {
    const { rerender } = render(<Button size="sm">Small</Button>);
    expect(screen.getByRole('button').className).toContain('px-3 py-1.5');

    rerender(<Button size="lg">Large</Button>);
    expect(screen.getByRole('button').className).toContain('px-6 py-3');
  });
});
