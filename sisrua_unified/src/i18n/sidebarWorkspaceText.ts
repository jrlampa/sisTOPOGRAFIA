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
    stage1Label: "1. Área",
    stage1Helper: "Seleção e parâmetros",
    stage2Label: "2. BT",
    stage2Helper: "Baixa Tensão (n1-n4)",
    stage3Label: "3. MT",
    stage3Helper: "Média Tensão (n1-n4)",
    stage4Label: "4. Análise",
    stage4Helper: "Insights e exportação",
    step1Tag: "Etapa 1",
    step1Title: "Captura da área",
    step2Tag: "Etapa 2",
    step2Title: "Edição da rede BT",
    step3Tag: "Etapa 3",
    step3Title: "Edição da rede MT",
    step4Tag: "Etapa 4",
    step4Title: "Análise e exportação",
    ariaContentStep1: "Conteúdo da etapa captura",
    ariaContentStep2: "Conteúdo da etapa BT",
    ariaContentStep3: "Conteúdo da etapa MT",
    ariaContentStep4: "Conteúdo da etapa análise",
    nextActionTag: "Próxima ação",
    pageNavigationHint: "Use PageUp/PageDown para navegar entre etapas",
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
    stage1Label: "1. Area",
    stage1Helper: "Selection and parameters",
    stage2Label: "2. LV",
    stage2Helper: "Low Voltage (n1-n4)",
    stage3Label: "3. MV",
    stage3Helper: "Medium Voltage (n1-n4)",
    stage4Label: "4. Analysis",
    stage4Helper: "Insights and export",
    step1Tag: "Step 1",
    step1Title: "Area capture",
    step2Tag: "Step 2",
    step2Title: "LV network editing",
    step3Tag: "Step 3",
    step3Title: "MV network editing",
    step4Tag: "Step 4",
    step4Title: "Analysis and export",
    ariaContentStep1: "Capture stage content",
    ariaContentStep2: "LV stage content",
    ariaContentStep3: "MV stage content",
    ariaContentStep4: "Analysis stage content",
    nextActionTag: "Next action",
    pageNavigationHint: "Use PageUp/PageDown to navigate between stages",
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
    stage1Label: "1. Área",
    stage1Helper: "Selección y parámetros",
    stage2Label: "2. BT",
    stage2Helper: "Baja Tensión (n1-n4)",
    stage3Label: "3. MT",
    stage3Helper: "Media Tensión (n1-n4)",
    stage4Label: "4. Análisis",
    stage4Helper: "Insights y exportación",
    step1Tag: "Paso 1",
    step1Title: "Captura de área",
    step2Tag: "Paso 2",
    step2Title: "Edición de red BT",
    step3Tag: "Paso 3",
    step3Title: "Edición de red MT",
    step4Tag: "Paso 4",
    step4Title: "Análisis y exportación",
    ariaContentStep1: "Contenido del paso de captura",
    ariaContentStep2: "Contenido del paso BT",
    ariaContentStep3: "Contenido del paso MT",
    ariaContentStep4: "Contenido del paso de análisis",
    nextActionTag: "Próxima acción",
    pageNavigationHint: "Use Re Pág/Av Pág para navegar entre etapas",
    guidanceCapture: "Defina el área objetivo y el modo de selección para desbloquear el paso BT.",
    guidanceNetwork: "Construya o revise la topología BT para habilitar la MT.",
    guidanceMt: "Modele las estructuras de MT (n1-n4) para habilitar el análisis y DXF.",
    guidanceAnalysis: "Ejecute el análisis y finalice con la exportación técnica.",
    advanceStep: "Avanzar paso",
    flowCompleted: "Flujo completado",
  },
};

export function getSidebarWorkspaceText(locale: AppLocale): SidebarWorkspaceText {
  return TEXTS[locale] ?? TEXTS["pt-BR"];
}
