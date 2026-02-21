import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import ErrorBoundary from '../../src/components/ui/ErrorBoundary';
import Logger from '../../src/utils/logger';

// ── Helper to suppress React error output during error boundary tests ───────
const suppressConsoleError = () => vi.spyOn(console, 'error').mockImplementation(() => {});

// Component that throws on first render
const ThrowOnRender: React.FC<{ shouldThrow?: boolean }> = ({ shouldThrow = true }) => {
  if (shouldThrow) throw new Error('Test render error');
  return <div>Normal child</div>;
};

describe('ErrorBoundary', () => {
  it('renderiza children quando não há erro', () => {
    render(
      <ErrorBoundary>
        <div data-testid="child">OK</div>
      </ErrorBoundary>
    );
    expect(screen.getByTestId('child')).toBeDefined();
  });

  it('captura erro e exibe fallback padrão de erro', () => {
    const spy = suppressConsoleError();
    vi.spyOn(Logger, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowOnRender />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something Went Wrong')).toBeDefined();
    expect(screen.getByText(/Test render error/)).toBeDefined();

    spy.mockRestore();
  });

  it('exibe fallback customizado quando prop fallback é fornecida', () => {
    const spy = suppressConsoleError();
    vi.spyOn(Logger, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary fallback={<div data-testid="custom-fallback">Erro customizado</div>}>
        <ThrowOnRender />
      </ErrorBoundary>
    );

    expect(screen.getByTestId('custom-fallback')).toBeDefined();
    expect(screen.queryByText('Something Went Wrong')).toBeNull();

    spy.mockRestore();
  });

  it('botão "Try Again" reseta o estado de erro e re-renderiza children', () => {
    const spy = suppressConsoleError();
    vi.spyOn(Logger, 'error').mockImplementation(() => {});

    let shouldThrow = true;

    const MaybeThrowing: React.FC = () => {
      if (shouldThrow) throw new Error('Controlled error');
      return <div data-testid="recovered">Recuperado!</div>;
    };

    const { rerender } = render(
      <ErrorBoundary>
        <MaybeThrowing />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something Went Wrong')).toBeDefined();

    shouldThrow = false;
    fireEvent.click(screen.getByText('Try Again'));

    rerender(
      <ErrorBoundary>
        <MaybeThrowing />
      </ErrorBoundary>
    );

    // After reset the boundary should try rendering children again
    expect(screen.queryByText('Something Went Wrong')).toBeNull();
    expect(screen.getByTestId('recovered').textContent).toBe('Recuperado!');

    spy.mockRestore();
  });

  it('botão "Reload Page" chama window.location.reload()', () => {
    const spy = suppressConsoleError();
    vi.spyOn(Logger, 'error').mockImplementation(() => {});
    const reloadSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { reload: reloadSpy },
      writable: true
    });

    render(
      <ErrorBoundary>
        <ThrowOnRender />
      </ErrorBoundary>
    );

    fireEvent.click(screen.getByText('Reload Page'));
    expect(reloadSpy).toHaveBeenCalled();

    spy.mockRestore();
  });

  it('loga o erro usando Logger.error', () => {
    const spy = suppressConsoleError();
    const logSpy = vi.spyOn(Logger, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowOnRender />
      </ErrorBoundary>
    );

    expect(logSpy).toHaveBeenCalled();

    spy.mockRestore();
  });
});
