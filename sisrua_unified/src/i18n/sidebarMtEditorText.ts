import type { AppLocale } from "../types";

type SidebarMtEditorText = {
  btnNav: string;
  btnPole: string;
  btnEdge: string;
  loadingMtPanel: string;
};

const TEXTS: Record<AppLocale, SidebarMtEditorText> = {
  "pt-BR": {
    btnNav: "Nav",
    btnPole: "Poste",
    btnEdge: "Vão",
    loadingMtPanel: "Carregando painel MT…",
  },
  "en-US": {
    btnNav: "Nav",
    btnPole: "Pole",
    btnEdge: "Span",
    loadingMtPanel: "Loading MV panel…",
  },
  "es-ES": {
    btnNav: "Nav",
    btnPole: "Poste",
    btnEdge: "Vano",
    loadingMtPanel: "Cargando panel MT…",
  },
};

export function getSidebarMtEditorText(locale: AppLocale): SidebarMtEditorText {
  return TEXTS[locale] ?? TEXTS["pt-BR"];
}
