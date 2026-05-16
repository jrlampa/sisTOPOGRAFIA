import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { debounce } from "../../src/utils/debounce";
import { renderHook } from "@testing-library/react";
import { useDebounce } from "../../src/utils/debounce";

// ---------------------------------------------------------------------------
// debounce
// ---------------------------------------------------------------------------

describe("debounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("delays callback execution until timeout elapses", () => {
    const callback = vi.fn();
    const debouncedFn = debounce(callback, 200);

    debouncedFn();
    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(200);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("cancels previous timer when called again before timeout", () => {
    const callback = vi.fn();
    const debouncedFn = debounce(callback, 200);

    debouncedFn();
    vi.advanceTimersByTime(100);
    debouncedFn();
    vi.advanceTimersByTime(100);

    // Callback should not have fired yet (timer was reset)
    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("passes arguments to the callback", () => {
    const callback = vi.fn();
    const debouncedFn = debounce(callback, 100);

    debouncedFn("hello", 42);
    vi.advanceTimersByTime(100);

    expect(callback).toHaveBeenCalledWith("hello", 42);
  });

  it("can be called multiple times sequentially with only last call firing", () => {
    const callback = vi.fn();
    const debouncedFn = debounce(callback, 100);

    debouncedFn("first");
    debouncedFn("second");
    debouncedFn("third");

    vi.advanceTimersByTime(100);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith("third");
  });

  it("allows another call after the timer fires", () => {
    const callback = vi.fn();
    const debouncedFn = debounce(callback, 100);

    debouncedFn();
    vi.advanceTimersByTime(100);
    expect(callback).toHaveBeenCalledTimes(1);

    debouncedFn();
    vi.advanceTimersByTime(100);
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it("works with a timeout of 0", () => {
    const callback = vi.fn();
    const debouncedFn = debounce(callback, 0);

    debouncedFn();
    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(0);
    expect(callback).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// useDebounce
// ---------------------------------------------------------------------------

describe("useDebounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns a stable debounced function reference across renders", () => {
    const callback = vi.fn();
    const { result, rerender } = renderHook(() =>
      useDebounce(callback, 200)
    );

    const fn1 = result.current;
    rerender();
    const fn2 = result.current;

    // Reference should be stable as long as callback and timeout don't change
    expect(fn1).toBe(fn2);
  });

  it("returned function delays callback execution", () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebounce(callback, 150));

    result.current("arg1");
    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(150);
    expect(callback).toHaveBeenCalledWith("arg1");
  });
});
