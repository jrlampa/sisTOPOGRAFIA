/**
 * featureFlags.ts — Definições e tipos para as funcionalidades modulares do SaaS.
 */

export interface FeatureFlags {
  // Engenharia
  enableDgWizard: boolean;
  enableMechanicalCalculation: boolean;
  enableSinapiBudget: boolean;
  
  // Compliance
  enableNbr9050: boolean;
  enableEnvironmentalAudit: boolean;
  enableVegetationAnalysis: boolean;
  enableSolarShading: boolean;
  
  // IA & Dados
  enableAiPredictiveMaintenance: boolean;
  enableTopodataElevation: boolean;
  
  // Colaboração
  enableMultiplayer: boolean;
  enableGhostMode: boolean;
  
  // Interface
  enableFinOpsDashboard: boolean;
}

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  enableDgWizard: true,
  enableMechanicalCalculation: true,
  enableSinapiBudget: true,
  enableNbr9050: true,
  enableEnvironmentalAudit: true,
  enableVegetationAnalysis: true,
  enableSolarShading: true,
  enableAiPredictiveMaintenance: true,
  enableTopodataElevation: true,
  enableMultiplayer: true,
  enableGhostMode: false,
  enableFinOpsDashboard: true,
};

export type FeaturePreset = "full" | "lightweight" | "compliance_only" | "engineering_only";

export const PRESETS: Record<FeaturePreset, { label: string, flags: Partial<FeatureFlags> }> = {
  full: {
    label: "Engenharia Plena (IM3 High-End)",
    flags: DEFAULT_FEATURE_FLAGS
  },
  lightweight: {
    label: "Modo Leve (Apenas Desenho)",
    flags: {
      enableDgWizard: false,
      enableMechanicalCalculation: false,
      enableSinapiBudget: false,
      enableNbr9050: false,
      enableEnvironmentalAudit: false,
      enableSolarShading: false,
      enableAiPredictiveMaintenance: false,
      enableMultiplayer: false,
      enableFinOpsDashboard: false,
    }
  },
  compliance_only: {
    label: "Auditoria de Compliance (ESG)",
    flags: {
      enableDgWizard: false,
      enableMechanicalCalculation: false,
      enableSinapiBudget: false,
      enableNbr9050: true,
      enableEnvironmentalAudit: true,
      enableSolarShading: true,
      enableAiPredictiveMaintenance: false,
      enableFinOpsDashboard: false,
    }
  },
  engineering_only: {
    label: "Foco em Engenharia & Custo",
    flags: {
      enableDgWizard: true,
      enableMechanicalCalculation: true,
      enableSinapiBudget: true,
      enableNbr9050: false,
      enableEnvironmentalAudit: false,
      enableSolarShading: false,
      enableAiPredictiveMaintenance: true,
      enableFinOpsDashboard: true,
    }
  },
};

export interface FeatureLabelInfo {
  label: string;
  description: string;
  category: string;
  performanceImpact: "low" | "medium" | "high";
  minRole?: "editor" | "admin" | "tech_lead";
  healthCheckUrl?: string;
}

export const FEATURE_LABELS: Record<keyof FeatureFlags, FeatureLabelInfo> = {
  enableDgWizard: { 
    label: "Design Generativo (DG)", 
    description: "Assistente IA para alocação automática de ativos.", 
    category: "Engenharia",
    performanceImpact: "high",
    minRole: "editor",
    healthCheckUrl: "/api/dg/health"
  },
  enableMechanicalCalculation: { 
    label: "Cálculo Mecânico", 
    description: "Análise de tração e esforços em tempo real.", 
    category: "Engenharia",
    performanceImpact: "high"
  },
  enableSinapiBudget: { 
    label: "Orçamentação SINAPI", 
    description: "Vinculação de custos e códigos SINAPI/ORSE.", 
    category: "Engenharia",
    performanceImpact: "medium",
    minRole: "tech_lead",
    healthCheckUrl: "/api/sinapi/health"
  },
  enableNbr9050: { 
    label: "Acessibilidade NBR 9050", 
    description: "Verificação de rotas acessíveis e obstáculos.", 
    category: "Compliance",
    performanceImpact: "low"
  },
  enableEnvironmentalAudit: { 
    label: "Auditoria Ambiental", 
    description: "Detecção de APPs e buffers de vegetação.", 
    category: "Compliance",
    performanceImpact: "medium"
  },
  enableVegetationAnalysis: { 
    label: "Análise de Vegetação", 
    description: "Cálculo de poda e riscos arbóreos em rede.", 
    category: "Compliance",
    performanceImpact: "medium"
  },
  enableSolarShading: { 
    label: "Sombreamento Solar 2.5D", 
    description: "Projeção de sombras baseada em dados solares.", 
    category: "Compliance",
    performanceImpact: "high"
  },
  enableAiPredictiveMaintenance: { 
    label: "Manutenção Preditiva IA", 
    description: "Diagnóstico de saúde de ativos via Ollama.", 
    category: "IA & Dados",
    performanceImpact: "high",
    minRole: "tech_lead",
    healthCheckUrl: "/api/maintenance/predictive/health"
  },
  enableTopodataElevation: { 
    label: "Elevação Topodata", 
    description: "Uso de dados de alta precisão do INPE.", 
    category: "IA & Dados",
    performanceImpact: "medium",
    healthCheckUrl: "/api/elevation/health"
  },
  enableMultiplayer: { 
    label: "Modo Multiplayer", 
    description: "Sincronização em tempo real entre usuários.", 
    category: "Colaboração",
    performanceImpact: "medium"
  },
  enableGhostMode: { 
    label: "Modo Fantasma", 
    description: "Visualizar projetos vizinhos sem editar.", 
    category: "Colaboração",
    performanceImpact: "low"
  },
  enableFinOpsDashboard: { 
    label: "Dashboard FinOps", 
    description: "Indicadores financeiros (ROI, Payback) no cockpit.", 
    category: "Interface",
    performanceImpact: "low",
    minRole: "tech_lead"
  },
};

export interface CustomPreset {
  id: string;
  label: string;
  flags: FeatureFlags;
  createdAt: string;
}
