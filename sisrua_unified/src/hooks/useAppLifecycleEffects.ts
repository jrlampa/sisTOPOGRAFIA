import React from "react";
import { AppSettings, BtTopology } from "../types";
import { persistAppSettings } from "../utils/preferencesPersistence";

interface Params {
  settings: AppSettings;
  isDark: boolean;
  btTopology: BtTopology;
  btSectioningImpact: any;
  showToast: any;
  setAppState: any;
}

export function useAppLifecycleEffects({
  settings,
  isDark,
  btTopology,
  btSectioningImpact,
  showToast,
  setAppState,
}: Params) {
  // Auto-save: persist appSettings to localStorage
  React.useEffect(() => {
    persistAppSettings(settings);
  }, [settings]);

  // Sync theme with document attribute for CSS variables
  React.useEffect(() => {
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
    document.documentElement.lang = settings.locale;
    document.documentElement.setAttribute("data-locale", settings.locale);
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDark, settings.locale]);

  // Listen for OS color scheme changes
  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      const systemTheme = e.matches ? "dark" : "light";
      setAppState(
        (prev: any) => ({
          ...prev,
          settings: { ...prev.settings, theme: systemTheme },
        }),
        false,
      );
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [setAppState]);

  // Monitor transformer removal impact
  const previousTransformerCountRef = React.useRef(btTopology.transformers.length);
  React.useEffect(() => {
    const previousTransformerCount = previousTransformerCountRef.current;
    const currentTransformerCount = btTopology.transformers.length;
    const hadTransformerRemoval = currentTransformerCount < previousTransformerCount;

    if (hadTransformerRemoval && btSectioningImpact.unservedPoleIds.length > 0) {
      const unservedPolesCount = btSectioningImpact.unservedPoleIds.length;
      const unservedClients = btSectioningImpact.unservedClients;
      showToast(
        `Atenção: circuito sem transformador (${unservedPolesCount} poste(s), ${unservedClients} cliente(s) sem atendimento).`,
        "error",
      );
    }

    previousTransformerCountRef.current = currentTransformerCount;
  }, [
    btTopology.transformers.length,
    btSectioningImpact.unservedPoleIds.length,
    btSectioningImpact.unservedClients,
    showToast,
  ]);
}
