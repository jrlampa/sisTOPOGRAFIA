import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUndoRedo } from '../../src/hooks/useUndoRedo';

describe('useUndoRedo', () => {
  // ── Initial State ────────────────────────────────────────────────────────

  it('inicializa com o valor inicial como present', () => {
    const { result } = renderHook(() => useUndoRedo('initial'));
    expect(result.current.state).toBe('initial');
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  // ── setState (commit = true) ─────────────────────────────────────────────

  it('set com commit=true atualiza present e adiciona ao histórico', () => {
    const { result } = renderHook(() => useUndoRedo('a'));

    act(() => { result.current.setState('b'); });

    expect(result.current.state).toBe('b');
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it('set com commit=true limpa o future', () => {
    const { result } = renderHook(() => useUndoRedo('a'));

    act(() => { result.current.setState('b'); });
    act(() => { result.current.undo(); }); // back to a, future=[b]
    expect(result.current.canRedo).toBe(true);

    act(() => { result.current.setState('c'); }); // new commit clears future
    expect(result.current.canRedo).toBe(false);
    expect(result.current.state).toBe('c');
  });

  it('set com o mesmo valor não cria entrada duplicada no histórico', () => {
    const { result } = renderHook(() => useUndoRedo({ x: 1 }));

    act(() => { result.current.setState({ x: 1 }); }); // same JSON
    // No duplicate — canUndo should remain false
    expect(result.current.canUndo).toBe(false);
  });

  it('set com commit=false atualiza present sem criar histórico', () => {
    const { result } = renderHook(() => useUndoRedo('a'));

    act(() => { result.current.setState('b', false); });

    expect(result.current.state).toBe('b');
    expect(result.current.canUndo).toBe(false); // no commit → no history
  });

  // ── undo ─────────────────────────────────────────────────────────────────

  it('undo reverte para o estado anterior', () => {
    const { result } = renderHook(() => useUndoRedo('a'));

    act(() => { result.current.setState('b'); });
    act(() => { result.current.undo(); });

    expect(result.current.state).toBe('a');
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);
  });

  it('undo múltiplas vezes percorre o histórico', () => {
    const { result } = renderHook(() => useUndoRedo('a'));

    act(() => { result.current.setState('b'); });
    act(() => { result.current.setState('c'); });
    act(() => { result.current.undo(); });

    expect(result.current.state).toBe('b');

    act(() => { result.current.undo(); });
    expect(result.current.state).toBe('a');
    expect(result.current.canUndo).toBe(false);
  });

  it('undo quando canUndo=false não altera estado', () => {
    const { result } = renderHook(() => useUndoRedo('a'));
    act(() => { result.current.undo(); });
    expect(result.current.state).toBe('a');
  });

  // ── redo ─────────────────────────────────────────────────────────────────

  it('redo avança para o próximo estado', () => {
    const { result } = renderHook(() => useUndoRedo('a'));

    act(() => { result.current.setState('b'); });
    act(() => { result.current.undo(); });
    act(() => { result.current.redo(); });

    expect(result.current.state).toBe('b');
    expect(result.current.canRedo).toBe(false);
    expect(result.current.canUndo).toBe(true);
  });

  it('redo múltiplos estados', () => {
    const { result } = renderHook(() => useUndoRedo('a'));

    act(() => { result.current.setState('b'); });
    act(() => { result.current.setState('c'); });
    act(() => { result.current.undo(); });
    act(() => { result.current.undo(); });

    // now at 'a' with future=[b, c]
    act(() => { result.current.redo(); });
    expect(result.current.state).toBe('b');

    act(() => { result.current.redo(); });
    expect(result.current.state).toBe('c');
    expect(result.current.canRedo).toBe(false);
  });

  it('redo quando canRedo=false não altera estado', () => {
    const { result } = renderHook(() => useUndoRedo('a'));
    act(() => { result.current.redo(); });
    expect(result.current.state).toBe('a');
  });

  // ── saveSnapshot ─────────────────────────────────────────────────────────

  it('saveSnapshot salva estado atual no past sem alterar present', () => {
    const { result } = renderHook(() => useUndoRedo('a'));

    act(() => { result.current.saveSnapshot(); });

    expect(result.current.state).toBe('a');
    expect(result.current.canUndo).toBe(true); // 'a' now in past

    // Commit-less change then undo should revert to snapshot
    act(() => { result.current.setState('b', false); });
    act(() => { result.current.undo(); });
    expect(result.current.state).toBe('a');
  });

  it('saveSnapshot limpa o future', () => {
    const { result } = renderHook(() => useUndoRedo('a'));

    act(() => { result.current.setState('b'); });
    act(() => { result.current.undo(); }); // future=[b]
    expect(result.current.canRedo).toBe(true);

    act(() => { result.current.saveSnapshot(); }); // should clear future
    expect(result.current.canRedo).toBe(false);
  });

  // ── canUndo / canRedo ────────────────────────────────────────────────────

  it('canUndo e canRedo refletem o estado correto após sequência completa', () => {
    const { result } = renderHook(() => useUndoRedo(0));

    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);

    act(() => { result.current.setState(1); });
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);

    act(() => { result.current.undo(); });
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);

    act(() => { result.current.redo(); });
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });
});
