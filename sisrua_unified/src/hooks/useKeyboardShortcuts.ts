import { useEffect } from "react";
import { BtEditorMode, SelectionMode } from "../types";

interface KeyboardShortcutsProps {
  onCancel: () => void;
  onSetEditorMode: (mode: BtEditorMode) => void;
  onSetSelectionMode: (mode: SelectionMode) => void;
  onUndo: () => void;
  onRedo: () => void;
  onToggleHelp?: () => void;
  enabled?: boolean;
}

export function useKeyboardShortcuts({
  onCancel,
  onSetEditorMode,
  onSetSelectionMode,
  onUndo,
  onRedo,
  onToggleHelp,
  enabled = true,
}: KeyboardShortcutsProps) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid triggering shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      const isHelpShortcut =
        e.key === "?" ||
        (e.key === "/" && !e.altKey && !e.shiftKey) ||
        ((e.ctrlKey || e.metaKey) && e.key === "/");

      if (isHelpShortcut) {
        e.preventDefault();
        onToggleHelp?.();
        return;
      }

      // Undo/Redo
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        if (e.shiftKey) {
          onRedo();
        } else {
          onUndo();
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        onRedo();
        return;
      }

      // Modes
      switch (e.key.toLowerCase()) {
        case "escape":
          onCancel();
          break;
        case "p":
          onSetEditorMode("add-pole");
          break;
        case "t":
          onSetEditorMode("add-transformer");
          break;
        case "e":
          onSetEditorMode("add-edge");
          break;
        case "v":
          onSetEditorMode("move-pole");
          break;
        case "n":
          onSetEditorMode("none");
          break;
        case "m":
          onSetSelectionMode("measure");
          break;
        case "c":
          onSetSelectionMode("circle");
          break;
        case "l":
          onSetSelectionMode("polygon");
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    onCancel,
    onSetEditorMode,
    onSetSelectionMode,
    onUndo,
    onRedo,
    onToggleHelp,
    enabled,
  ]);
}
