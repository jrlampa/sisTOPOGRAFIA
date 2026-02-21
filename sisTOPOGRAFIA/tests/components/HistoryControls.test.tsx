import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import HistoryControls from '../../src/components/layout/HistoryControls';

describe('HistoryControls', () => {
  it('renderiza os botões de undo e redo', () => {
    render(
      <HistoryControls canUndo={false} canRedo={false} onUndo={vi.fn()} onRedo={vi.fn()} />
    );
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);
  });

  it('botão undo fica desabilitado quando canUndo=false', () => {
    render(
      <HistoryControls canUndo={false} canRedo={true} onUndo={vi.fn()} onRedo={vi.fn()} />
    );
    const [undoBtn] = screen.getAllByRole('button');
    expect(undoBtn.hasAttribute('disabled')).toBe(true);
  });

  it('botão redo fica desabilitado quando canRedo=false', () => {
    render(
      <HistoryControls canUndo={true} canRedo={false} onUndo={vi.fn()} onRedo={vi.fn()} />
    );
    const [, redoBtn] = screen.getAllByRole('button');
    expect(redoBtn.hasAttribute('disabled')).toBe(true);
  });

  it('chama onUndo ao clicar no botão undo quando habilitado', () => {
    const onUndo = vi.fn();
    render(
      <HistoryControls canUndo={true} canRedo={false} onUndo={onUndo} onRedo={vi.fn()} />
    );
    const [undoBtn] = screen.getAllByRole('button');
    fireEvent.click(undoBtn);
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it('chama onRedo ao clicar no botão redo quando habilitado', () => {
    const onRedo = vi.fn();
    render(
      <HistoryControls canUndo={false} canRedo={true} onUndo={vi.fn()} onRedo={onRedo} />
    );
    const [, redoBtn] = screen.getAllByRole('button');
    fireEvent.click(redoBtn);
    expect(onRedo).toHaveBeenCalledTimes(1);
  });

  it('ambos os botões habilitados quando canUndo=true e canRedo=true', () => {
    render(
      <HistoryControls canUndo={true} canRedo={true} onUndo={vi.fn()} onRedo={vi.fn()} />
    );
    const [undoBtn, redoBtn] = screen.getAllByRole('button');
    expect(undoBtn.hasAttribute('disabled')).toBe(false);
    expect(redoBtn.hasAttribute('disabled')).toBe(false);
  });
});
