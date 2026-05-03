import React from "react";

export function useAppGlobalHotkeys(
  setIsFocusModeManual: React.Dispatch<React.SetStateAction<boolean>>,
  setIsXRayMode: React.Dispatch<React.SetStateAction<boolean>>
) {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Focus Mode (Ctrl+F)
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        setIsFocusModeManual((prev) => !prev);
      }
      
      // X-Ray Mode (X or Shift)
      const k = e.key.toLowerCase();
      if (k === "x" || e.key === "Shift") {
        setIsXRayMode(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "x" || e.key === "Shift") {
        setIsXRayMode(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [setIsFocusModeManual, setIsXRayMode]);
}
