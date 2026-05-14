import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Drawer } from '@/components/ui/Drawer';
import { describe, it, expect, vi } from 'vitest';

// Mock focus trap to avoid issues with ref-based logic in tests
vi.mock('@/hooks/useFocusTrap', () => ({
  useFocusTrap: vi.fn()
}));

describe('Drawer component', () => {
  it('does not render when isOpen is false', () => {
    const { container } = render(
      <Drawer isOpen={false} onClose={() => {}}>
        <div>Content</div>
      </Drawer>
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders correctly when isOpen is true', () => {
    render(
      <Drawer isOpen={true} onClose={() => {}} title="My Drawer">
        <div>Content Area</div>
      </Drawer>
    );
    expect(screen.getByText('My Drawer')).toBeDefined();
    expect(screen.getByText('Content Area')).toBeDefined();
    expect(screen.getByRole('dialog')).toBeDefined();
  });

  it('calls onClose when close button is clicked', () => {
    const handleClose = vi.fn();
    render(
      <Drawer isOpen={true} onClose={handleClose}>
        <div>Content</div>
      </Drawer>
    );
    fireEvent.click(screen.getByLabelText('Close drawer'));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when escape key is pressed', () => {
    const handleClose = vi.fn();
    render(
      <Drawer isOpen={true} onClose={handleClose}>
        <div>Content</div>
      </Drawer>
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('applies correct position classes', () => {
    const { rerender } = render(
      <Drawer isOpen={true} onClose={() => {}} position="left">
        <div>Content</div>
      </Drawer>
    );
    expect(screen.getByRole('dialog').className).toContain('left-0');

    rerender(
      <Drawer isOpen={true} onClose={() => {}} position="right">
        <div>Content</div>
      </Drawer>
    );
    expect(screen.getByRole('dialog').className).toContain('right-0');
  });

  it('applies correct size classes', () => {
    const { rerender } = render(
      <Drawer isOpen={true} onClose={() => {}} size="sm">
        <div>Content</div>
      </Drawer>
    );
    expect(screen.getByRole('dialog').className).toContain('max-w-xs');

    rerender(
      <Drawer isOpen={true} onClose={() => {}} size="lg">
        <div>Content</div>
      </Drawer>
    );
    expect(screen.getByRole('dialog').className).toContain('max-w-md');
  });
});
