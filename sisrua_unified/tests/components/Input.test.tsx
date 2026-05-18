import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Input } from '@/components/ui/Input';
import { describe, it, expect, vi } from 'vitest';

describe('Input component', () => {
  it('renders correctly with label', () => {
    render(<Input label="Username" placeholder="Enter username" />);
    expect(screen.getByText('Username')).toBeDefined();
    expect(screen.getByPlaceholderText('Enter username')).toBeDefined();
  });

  it('shows required asterisk when required prop is true', () => {
    render(<Input label="Username" required />);
    expect(screen.getByText('*')).toBeDefined();
  });

  it('displays error message and icon when error prop is provided', () => {
    render(<Input label="Username" error="Invalid username" />);
    expect(screen.getByText('Invalid username')).toBeDefined();
    // Check if it has the error class on the input
    const input = screen.getByRole('textbox');
    expect(input.className).toContain('border-severity-critical');
  });

  it('displays hint text when provided and no error exists', () => {
    render(<Input label="Username" hint="Must be at least 5 characters" />);
    expect(screen.getByText('Must be at least 5 characters')).toBeDefined();
  });

  it('renders icons at correct positions', () => {
    const Icon = () => <span data-testid="test-icon">Icon</span>;
    
    const { rerender } = render(
      <Input icon={<Icon />} iconPosition="left" />
    );
    expect(screen.getByRole('textbox').className).toContain('pl-10');
    expect(screen.getByTestId('test-icon')).toBeDefined();

    rerender(<Input icon={<Icon />} iconPosition="right" />);
    expect(screen.getByRole('textbox').className).toContain('pr-10');
  });

  it('handles onChange events', () => {
    const handleChange = vi.fn();
    render(<Input onChange={handleChange} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'new value' } });
    expect(handleChange).toHaveBeenCalledTimes(1);
  });

  it('is disabled when disabled prop is true', () => {
    render(<Input disabled />);
    const input = screen.getByRole('textbox');
    expect(input.hasAttribute('disabled')).toBe(true);
  });
});
