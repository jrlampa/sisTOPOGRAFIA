import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useKeyboardShortcuts } from "../../src/hooks/useKeyboardShortcuts";

describe("useKeyboardShortcuts", () => {
  const mockHandlers = {
    onCancel: vi.fn(),
    onSetEditorMode: vi.fn(),
    onSetSelectionMode: vi.fn(),
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    onToggleHelp: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should trigger onCancel when Escape is pressed", () => {
    renderHook(() => useKeyboardShortcuts(mockHandlers));

    const event = new KeyboardEvent("keydown", { key: "Escape" });
    window.dispatchEvent(event);

    expect(mockHandlers.onCancel).toHaveBeenCalled();
  });

  it("should trigger onSetEditorMode when P is pressed", () => {
    renderHook(() => useKeyboardShortcuts(mockHandlers));

    const event = new KeyboardEvent("keydown", { key: "p" });
    window.dispatchEvent(event);

    expect(mockHandlers.onSetEditorMode).toHaveBeenCalledWith("add-pole");
  });

  it("should trigger onUndo when Ctrl+Z is pressed", () => {
    renderHook(() => useKeyboardShortcuts(mockHandlers));

    const event = new KeyboardEvent("keydown", { key: "z", ctrlKey: true });
    window.dispatchEvent(event);

    expect(mockHandlers.onUndo).toHaveBeenCalled();
  });

  it("should trigger onRedo when Ctrl+Shift+Z is pressed", () => {
    renderHook(() => useKeyboardShortcuts(mockHandlers));

    const event = new KeyboardEvent("keydown", {
      key: "z",
      ctrlKey: true,
      shiftKey: true,
    });
    window.dispatchEvent(event);

    expect(mockHandlers.onRedo).toHaveBeenCalled();
  });

  it("should trigger onToggleHelp when / is pressed", () => {
    renderHook(() => useKeyboardShortcuts(mockHandlers));

    const event = new KeyboardEvent("keydown", { key: "/" });
    window.dispatchEvent(event);

    expect(mockHandlers.onToggleHelp).toHaveBeenCalled();
  });

  it("should trigger onToggleHelp when Ctrl+/ is pressed", () => {
    renderHook(() => useKeyboardShortcuts(mockHandlers));

    const event = new KeyboardEvent("keydown", { key: "/", ctrlKey: true });
    window.dispatchEvent(event);

    expect(mockHandlers.onToggleHelp).toHaveBeenCalled();
  });

  it("should NOT trigger shortcuts when typing in an input", () => {
    renderHook(() => useKeyboardShortcuts(mockHandlers));

    const input = document.createElement("input");
    const event = new KeyboardEvent("keydown", { key: "p", bubbles: true });

    // Mock target
    Object.defineProperty(event, "target", { value: input, enumerable: true });

    window.dispatchEvent(event);

    expect(mockHandlers.onSetEditorMode).not.toHaveBeenCalled();
  });

  it("should respect the enabled flag", () => {
    renderHook(() => useKeyboardShortcuts({ ...mockHandlers, enabled: false }));

    const event = new KeyboardEvent("keydown", { key: "p" });
    window.dispatchEvent(event);

    expect(mockHandlers.onSetEditorMode).not.toHaveBeenCalled();
  });
});
