import { renderHook, act } from '@testing-library/react';
import { useAriaAnnounce } from '@/hooks/useAriaAnnounce';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('useAriaAnnounce hook', () => {
  beforeEach(() => {
    const region = document.getElementById('aria-announce-region');
    if (region) region.remove();
  });

  afterEach(() => {
    const region = document.getElementById('aria-announce-region');
    if (region) region.remove();
  });

  it('creates aria-live region on mount', () => {
    renderHook(() => useAriaAnnounce());
    const region = document.getElementById('aria-announce-region');
    expect(region).not.toBeNull();
    expect(region?.getAttribute('aria-live')).toBe('polite');
  });

  it('updates region text when announcing', () => {
    const { result } = renderHook(() => useAriaAnnounce());
    const announce = result.current;

    act(() => {
      announce('Hello Accessibility');
    });

    const region = document.getElementById('aria-announce-region');
    expect(region?.textContent).toBe('Hello Accessibility');
  });
});
