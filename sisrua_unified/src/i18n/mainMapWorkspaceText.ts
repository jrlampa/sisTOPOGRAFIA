import type { AppLocale } from "../types";

type MainMapWorkspaceText = {
  mapLoading: string;
  keyboardMouseFirst: string;
  openSidebar: string;
  navHintsTitle: string;
  navHintMove: string;
  navHintArrows: string;
  navHintScroll: string;
  navHintMiddleBtn: string;
  elevationProfileLoading: string;
  clickToDefineCenter: string;
  ghostEstimate: string;
  ghostDeltaCqt: string;
  ghostRealtimeImpact: string;
};

const TEXTS: Record<AppLocale, MainMapWorkspaceText> = {
  "pt-BR": {
    mapLoading: "Carregando mapa 2.5D...",
    keyboardMouseFirst: "Keyboard+Mouse First",
    openSidebar: "Abrir painel",
    navHintsTitle: "Hints de navegação",
    navHintMove: "W A S D: mover mapa",
    navHintArrows: "Setas: mover mapa",
    navHintScroll: "Roda do mouse: zoom",
    navHintMiddleBtn: "Botão do meio: pan livre",
    elevationProfileLoading: "Carregando perfil altimétrico",
    clickToDefineCenter: "Clique no mapa para definir o centro da análise.",
    ghostEstimate: "Estimativa",
    ghostDeltaCqt: "Δ CQT:",
    ghostRealtimeImpact: "Impacto em Tempo Real",
  },
  "en-US": {
    mapLoading: "Loading 2.5D map...",
    keyboardMouseFirst: "Keyboard+Mouse First",
    openSidebar: "Open panel",
    navHintsTitle: "Navigation hints",
    navHintMove: "W A S D: move map",
    navHintArrows: "Arrows: move map",
    navHintScroll: "Mouse wheel: zoom",
    navHintMiddleBtn: "Middle button: free pan",
    elevationProfileLoading: "Loading elevation profile",
    clickToDefineCenter: "Click on the map to define the analysis center.",
    ghostEstimate: "Estimate",
    ghostDeltaCqt: "Δ V.D.:",
    ghostRealtimeImpact: "Real-time Impact",
  },
  "es-ES": {
    mapLoading: "Cargando mapa 2.5D...",
    keyboardMouseFirst: "Teclado+Ratón Primero",
    openSidebar: "Abrir panel",
    navHintsTitle: "Sugerencias de navegación",
    navHintMove: "W A S D: mover mapa",
    navHintArrows: "Flechas: mover mapa",
    navHintScroll: "Rueda del ratón: zoom",
    navHintMiddleBtn: "Botón central: pan libre",
    elevationProfileLoading: "Cargando perfil altimétrico",
    clickToDefineCenter: "Haga clic en el mapa para definir el centro del análisis.",
    ghostEstimate: "Estimación",
    ghostDeltaCqt: "Δ C.V.:",
    ghostRealtimeImpact: "Impacto en Tiempo Real",
  },
};

export function getMainMapWorkspaceText(locale: AppLocale): MainMapWorkspaceText {
  return TEXTS[locale] ?? TEXTS["pt-BR"];
}
