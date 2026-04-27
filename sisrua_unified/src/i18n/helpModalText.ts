import type { AppLocale } from "../types";

type HelpShortcut = {
  key: string;
  action: string;
};

type HelpStep = {
  title: string;
  description: string;
};

type HelpModalText = {
  title: string;
  subtitle: string;
  quickOpenHint: string;
  closeLabel: string;
  shortcutsTitle: string;
  workflowTitle: string;
  footerNote: string;
  shortcuts: HelpShortcut[];
  steps: HelpStep[];
};

const TEXTS: Record<AppLocale, HelpModalText> = {
  "pt-BR": {
    title: "Central de Ajuda e Onboarding",
    subtitle: "Use este guia rápido para começar no sisRUA em poucos minutos.",
    quickOpenHint: "Atalho: /, ? ou Ctrl+/ para abrir esta ajuda",
    closeLabel: "Fechar ajuda",
    shortcutsTitle: "Teclas de Atalho",
    workflowTitle: "Passo a Passo Recomendado",
    footerNote:
      "Dica: comece com um projeto pequeno para validar seu fluxo antes de escalar.",
    shortcuts: [
      { key: "/", action: "Abrir ajuda rápida" },
      { key: "?", action: "Abrir ajuda rápida" },
      { key: "Ctrl+/", action: "Abrir ajuda rápida" },
      { key: "Esc", action: "Cancelar edição ativa" },
      { key: "P", action: "Modo adicionar poste" },
      { key: "T", action: "Modo adicionar transformador" },
      { key: "E", action: "Modo adicionar trecho" },
      { key: "V", action: "Modo mover poste" },
      { key: "N", action: "Modo neutro" },
      { key: "M", action: "Modo medição" },
      { key: "C", action: "Seleção por círculo" },
      { key: "L", action: "Seleção por polígono" },
      { key: "Ctrl+Z", action: "Desfazer" },
      { key: "Ctrl+Shift+Z", action: "Refazer" },
      { key: "Ctrl+Y", action: "Refazer" },
    ],
    steps: [
      {
        title: "1. Defina área e contexto",
        description:
          "Pesquise o local, ajuste raio/polígono e confirme o tipo de seleção para análise.",
      },
      {
        title: "2. Rode a análise base",
        description:
          "Execute a análise para carregar dados OSM/terreno e destravar exportações e painéis técnicos.",
      },
      {
        title: "3. Modele a rede BT/MT",
        description:
          "Use os modos de edição para inserir postes, trafos e trechos; revise flags e verificações.",
      },
      {
        title: "4. Ajuste cenários de engenharia",
        description:
          "Configure cenários (as-is/projeto), parâmetros de cálculo e valide impactos na rede.",
      },
      {
        title: "5. Exporte e documente",
        description:
          "Gere DXF/GeoJSON e, se desejar, ative o memorial PDF junto ao DXF no painel de configurações.",
      },
    ],
  },
  "en-US": {
    title: "Help & Onboarding Center",
    subtitle: "Use this quick guide to get productive in sisRUA in minutes.",
    quickOpenHint: "Shortcut: /, ? or Ctrl+/ to open this help",
    closeLabel: "Close help",
    shortcutsTitle: "Keyboard Shortcuts",
    workflowTitle: "Recommended Walkthrough",
    footerNote:
      "Tip: start with a small project to validate your workflow before scaling.",
    shortcuts: [
      { key: "/", action: "Open quick help" },
      { key: "?", action: "Open quick help" },
      { key: "Ctrl+/", action: "Open quick help" },
      { key: "Esc", action: "Cancel active editing" },
      { key: "P", action: "Add pole mode" },
      { key: "T", action: "Add transformer mode" },
      { key: "E", action: "Add edge mode" },
      { key: "V", action: "Move pole mode" },
      { key: "N", action: "Neutral mode" },
      { key: "M", action: "Measurement mode" },
      { key: "C", action: "Circle selection" },
      { key: "L", action: "Polygon selection" },
      { key: "Ctrl+Z", action: "Undo" },
      { key: "Ctrl+Shift+Z", action: "Redo" },
      { key: "Ctrl+Y", action: "Redo" },
    ],
    steps: [
      {
        title: "1. Define area and context",
        description:
          "Search location, tune radius/polygon, and confirm selection mode for analysis.",
      },
      {
        title: "2. Run baseline analysis",
        description:
          "Run analysis to load OSM/terrain data and unlock exports plus technical panels.",
      },
      {
        title: "3. Model BT/MT network",
        description:
          "Use editor modes to add poles, transformers, and edges; review flags and checks.",
      },
      {
        title: "4. Adjust engineering scenarios",
        description:
          "Set scenario mode (as-is/project), tune calculation parameters, and validate impacts.",
      },
      {
        title: "5. Export and document",
        description:
          "Generate DXF/GeoJSON and optionally enable memorial PDF with DXF in settings.",
      },
    ],
  },
  "es-ES": {
    title: "Centro de Ayuda y Onboarding",
    subtitle: "Use esta guía rápida para empezar en sisRUA en pocos minutos.",
    quickOpenHint: "Atajo: /, ? o Ctrl+/ para abrir esta ayuda",
    closeLabel: "Cerrar ayuda",
    shortcutsTitle: "Atajos de Teclado",
    workflowTitle: "Paso a Paso Recomendado",
    footerNote:
      "Consejo: comience con un proyecto pequeño para validar su flujo antes de escalar.",
    shortcuts: [
      { key: "/", action: "Abrir ayuda rápida" },
      { key: "?", action: "Abrir ayuda rápida" },
      { key: "Ctrl+/", action: "Abrir ayuda rápida" },
      { key: "Esc", action: "Cancelar edición activa" },
      { key: "P", action: "Modo agregar poste" },
      { key: "T", action: "Modo agregar transformador" },
      { key: "E", action: "Modo agregar tramo" },
      { key: "V", action: "Modo mover poste" },
      { key: "N", action: "Modo neutro" },
      { key: "M", action: "Modo medición" },
      { key: "C", action: "Selección por círculo" },
      { key: "L", action: "Selección por polígono" },
      { key: "Ctrl+Z", action: "Deshacer" },
      { key: "Ctrl+Shift+Z", action: "Rehacer" },
      { key: "Ctrl+Y", action: "Rehacer" },
    ],
    steps: [
      {
        title: "1. Defina área y contexto",
        description:
          "Busque la ubicación, ajuste radio/polígono y confirme el modo de selección para el análisis.",
      },
      {
        title: "2. Ejecute el análisis base",
        description:
          "Ejecute el análisis para cargar datos OSM/terreno y habilitar exportaciones y paneles técnicos.",
      },
      {
        title: "3. Modele la red BT/MT",
        description:
          "Use los modos de edición para insertar postes, transformadores y tramos; revise banderas y validaciones.",
      },
      {
        title: "4. Ajuste escenarios de ingeniería",
        description:
          "Configure escenarios (as-is/proyecto), parámetros de cálculo y valide impactos en la red.",
      },
      {
        title: "5. Exporte y documente",
        description:
          "Genere DXF/GeoJSON y, si desea, active el memorial PDF junto con el DXF en configuración.",
      },
    ],
  },
};

export function getHelpModalText(locale: AppLocale): HelpModalText {
  return TEXTS[locale] ?? TEXTS["pt-BR"];
}
