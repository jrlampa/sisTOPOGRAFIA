import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import Toast from '../../src/components/ui/Toast';

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('exibe a mensagem fornecida', () => {
    const onClose = vi.fn();
    render(<Toast message="Operação concluída!" type="success" onClose={onClose} />);
    expect(screen.getByText('Operação concluída!')).toBeDefined();
  });

  it('chama onClose automaticamente após a duração padrão (4000ms)', () => {
    const onClose = vi.fn();
    render(<Toast message="Teste" type="info" onClose={onClose} />);

    expect(onClose).not.toHaveBeenCalled();

    act(() => { vi.advanceTimersByTime(4000); });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('chama onClose após duração customizada', () => {
    const onClose = vi.fn();
    render(<Toast message="Teste" type="error" onClose={onClose} duration={1500} />);

    act(() => { vi.advanceTimersByTime(1499); });
    expect(onClose).not.toHaveBeenCalled();

    act(() => { vi.advanceTimersByTime(1); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('chama onClose ao clicar no botão X', () => {
    const onClose = vi.fn();
    render(<Toast message="Feche-me" type="success" onClose={onClose} />);

    // Find close button (the X button)
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renderiza todos os tipos: success, error, info', () => {
    const onClose = vi.fn();
    const { unmount, rerender } = render(<Toast message="A" type="success" onClose={onClose} />);
    expect(screen.getByText('A')).toBeDefined();

    rerender(<Toast message="B" type="error" onClose={onClose} />);
    expect(screen.getByText('B')).toBeDefined();

    rerender(<Toast message="C" type="info" onClose={onClose} />);
    expect(screen.getByText('C')).toBeDefined();
    unmount();
  });

  it('cancela o timer ao desmontar (sem chamar onClose após desmontagem)', () => {
    const onClose = vi.fn();
    const { unmount } = render(<Toast message="Teste" type="success" onClose={onClose} />);

    unmount();
    act(() => { vi.advanceTimersByTime(5000); });

    expect(onClose).not.toHaveBeenCalled();
  });
});
