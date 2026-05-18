import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BtViolationJumpList } from '@/components/BtViolationJumpList';
import { describe, it, expect, vi } from 'vitest';
import type { Violation } from '@/types';

describe('BtViolationJumpList component', () => {
  const mockViolations: Violation[] = [
    { id: 'v1', type: 'warning', message: 'Warning message', location: { lat: 1, lng: 1 } },
    { id: 'v2', type: 'critical', message: 'Critical message', location: { lat: 2, lng: 2 } },
    { id: 'v3', type: 'info', message: 'Info message', location: { lat: 3, lng: 3 } },
  ];

  it('renders nothing when violations list is empty', () => {
    const { container } = render(<BtViolationJumpList violations={[]} onJumpToLocation={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders summary counts correctly', () => {
    render(<BtViolationJumpList violations={mockViolations} onJumpToLocation={() => {}} />);
    expect(screen.getByText('1 crítico')).toBeDefined();
    expect(screen.getByText('1 alerta')).toBeDefined();
  });

  it('renders all violation messages', () => {
    render(<BtViolationJumpList violations={mockViolations} onJumpToLocation={() => {}} />);
    expect(screen.getByText('Critical message')).toBeDefined();
    expect(screen.getByText('Warning message')).toBeDefined();
    expect(screen.getByText('Info message')).toBeDefined();
  });

  it('sorts violations by severity (critical first)', () => {
    const { container } = render(<BtViolationJumpList violations={mockViolations} onJumpToLocation={() => {}} />);
    const rows = container.querySelectorAll('.flex-1.text-xs');
    expect(rows[0].textContent).toBe('Critical message');
    expect(rows[1].textContent).toBe('Warning message');
    expect(rows[2].textContent).toBe('Info message');
  });

  it('triggers onJumpToLocation when button is clicked', () => {
    const handleJump = vi.fn();
    render(<BtViolationJumpList violations={mockViolations} onJumpToLocation={handleJump} />);
    
    // Find button for the critical violation
    const jumpButtons = screen.getAllByTitle('Localizar no mapa');
    fireEvent.click(jumpButtons[0]); // First one is critical message due to sorting
    
    expect(handleJump).toHaveBeenCalledWith(2, 2);
  });
});
