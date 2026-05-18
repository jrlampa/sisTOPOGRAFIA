import { renderHook, act } from '@testing-library/react';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('useFocusTrap hook', () => {
  it('traps focus correctly', () => {
    const div = document.createElement('div');
    const btn1 = document.createElement('button');
    const btn2 = document.createElement('button');
    div.appendChild(btn1);
    div.appendChild(btn2);
    document.body.appendChild(div);

    const ref = { current: div };
    renderHook(() => useFocusTrap(ref));

    // Initial focus should be on btn1
    expect(document.activeElement).toBe(btn1);

    // Tab on last element should wrap to first
    btn2.focus();
    div.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(document.activeElement).toBe(btn1);

    // Shift+Tab on first element should wrap to last
    btn1.focus();
    div.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }));
    expect(document.activeElement).toBe(btn2);

    document.body.removeChild(div);
  });
});
