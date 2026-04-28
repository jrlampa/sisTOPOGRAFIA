import type { AppLocale } from "../types";

type SidebarWorkspaceText = {
  workflowTag: string;
  workflowTitle: string;
  stage1Label: string;
  stage1Helper: string;
  stage2Label: string;
  stage2Helper: string;
  stage3Label: string;
  stage3Helper: string;
  stage4Label: string;
  stage4Helper: string;
  step1Tag: string;
  step1Title: string;
  step2Tag: string;
  step2Title: string;
  step3Tag: string;
  step3Title: string;
  step4Tag: string;
  step4Title: string;
  ariaContentStep1: string;
  ariaContentStep2: string;
  ariaContentStep3: string;
  ariaContentStep4: string;
  nextActionTag: string;
  pageNavigationHint: string;
  guidanceCapture: string;
  guidanceNetwork: string;
  guidanceMt: string;
  guidanceAnalysis: string;
  advanceStep: string;
  flowCompleted: string;
};

const TEXTS: Record<AppLocale, SidebarWorkspaceText> = {
  "pt-BR": {
    workflowTag: "Workflow",
    workflowTitle: "Estação de trabalho guiada",
    stage1Label: "1. ÁREA",
    stage1Helper: "Definir região do projeto",
    stage2Label: "2. PROJETAR BT",
    stage2Helper: "Engenharia de Baixa Tensão",
    stage3Label: "3. PROJETAR MT",
    stage3Helper: "Modelagem de Média Tensão",
    stage4Label: "4. EXPORTAR",
    stage4Helper: "Relatórios e DXF técnico",
    step1Tag: "Definição",
    step1Title: "DEFINIR ÁREA DE ATUAÇÃO",
    step2Tag: "Projeto",
    step2Title: "PROJETAR REDE BT",
    step3Tag: "Projeto",
    step3Title: "PROJETAR REDE MT",
    step4Tag: "Finalização",
    step4Title: "VALIDAR & EXPORTAR",
    ariaContentStep1: "Conteúdo da etapa captura",
    ariaContentStep2: "Conteúdo da etapa BT",
    ariaContentStep3: "Conteúdo da etapa MT",
    ariaContentStep4: "Conteúdo da etapa análise",
    nextActionTag: "Próximo passo",
    pageNavigationHint: "Use PgUp/PgDn para navegar",
    guidanceCapture: "Defina a área-alvo e o modo de seleção para liberar a etapa BT.",
    guidanceNetwork: "Construa ou revise a topologia BT para habilitar a MT.",
    guidanceMt: "Modele as estruturas de MT (n1-n4) para habilitar análise e DXF.",
    guidanceAnalysis: "Execute a análise e finalize com a exportação técnica.",
    advanceStep: "Avançar etapa",
    flowCompleted: "Fluxo concluído",
  },
  "en-US": {
    workflowTag: "Workflow",
    workflowTitle: "Guided workstation",
    stage1Label: "1. DEFINE AREA",
    stage1Helper: "Set project region",
    stage2Label: "2. DESIGN LV",
    stage2Helper: "Low Voltage Engineering",
    stage3Label: "3. DESIGN MV",
    stage3Helper: "Medium Voltage Modeling",
    stage4Label: "4. EXPORT",
    stage4Helper: "Reports and technical DXF",
    step1Tag: "Definition",
    step1Title: "DEFINE WORK AREA",
    step2Tag: "Design",
    step2Title: "DESIGN LV NETWORK",
    step3Tag: "Design",
    step3Title: "DESIGN MV NETWORK",
    step4Tag: "Finalization",
    step4Title: "VALIDATE & EXPORT",
    ariaContentStep1: "Capture stage content",
    ariaContentStep2: "LV stage content",
    ariaContentStep3: "MV stage content",
    ariaContentStep4: "Analysis stage content",
    nextActionTag: "Next step",
    pageNavigationHint: "Use PgUp/PgDn to navigate",
    guidanceCapture: "Define the target area and selection mode to unlock the LV stage.",
    guidanceNetwork: "Build or review the LV topology to enable MV.",
    guidanceMt: "Model the MV structures (n1-n4) to enable analysis and DXF.",
    guidanceAnalysis: "Run the analysis and finish with the technical export.",
    advanceStep: "Advance stage",
    flowCompleted: "Flow completed",
  },
  "es-ES": {
    workflowTag: "Workflow",
    workflowTitle: "Estación de trabajo guiada",
    stage1Label: "1. DEFINIR ÁREA",
    stage1Helper: "Definir región del proyecto",
    stage2Label: "2. DISEÑO BT",
    stage2Helper: "Ingeniería de Baja Tensión",
    stage3Label: "3. DISEÑO MT",
    stage3Helper: "Modelado de Media Tensión",
    stage4Label: "4. EXPORTAR",
    stage4Helper: "Informes y DXF técnico",
    step1Tag: "Definición",
    step1Title: "DEFINIR ÁREA DE TRABAJO",
    step2Tag: "Diseño",
    step2Title: "DISEÑAR RED BT",
    step3Tag: "Diseño",
    step3Title: "DISEÑAR RED MT",
    step4Tag: "Finalización",
    step4Title: "VALIDAR Y EXPORTAR",
    ariaContentStep1: "Contenido del paso de captura",
    ariaContentStep2: "Contenido del paso BT",
    ariaContentStep3: "Contenido del paso MT",
    ariaContentStep4: "Contenido del paso de análisis",
    nextActionTag: "Próximo paso",
    pageNavigationHint: "Use Re Pág/Av Pág para navegar",
    guidanceCapture: "Defina el área objetivo y el modo de selección para desbloquear el paso BT.",
    guidanceNetwork: "Construya o revise la topologia BT para habilitar la MT.",
    guidanceMt: "Modele las estructuras de MT (n1-n4) para habilitar el análisis y DXF.",
    guidanceAnalysis: "Ejecute el análisis y finalice con la exportación técnica.",
    advanceStep: "Avanzar paso",
    flowCompleted: "Flujo completado",
  },
};

export function getSidebarWorkspaceText(locale: AppLocale): SidebarWorkspaceText {
  return TEXTS[locale] ?? TEXTS["pt-BR"];
}
