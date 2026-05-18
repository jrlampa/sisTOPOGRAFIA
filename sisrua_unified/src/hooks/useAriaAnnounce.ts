import React from "react";

export function useAriaAnnounce() {
  const announceRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    // Create aria-live region if doesn't exist
    if (!document.getElementById("aria-announce-region")) {
      const region = document.createElement("div");
      region.id = "aria-announce-region";
      region.setAttribute("aria-live", "polite");
      region.setAttribute("aria-atomic", "true");
      region.className = "sr-only";
      document.body.appendChild(region);
      announceRef.current = region;
    }
  }, []);

  const announce = (message: string) => {
    const region =
      announceRef.current || document.getElementById("aria-announce-region");
    if (region) {
      region.textContent = message;
    }
  };

  return announce;
}
