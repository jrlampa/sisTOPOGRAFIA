/**
 * gridLegibilityService.ts — Foco em Legibilidade de Grid (27 [T1])
 *
 * Responsabilidades:
 * - Gerenciar perfis de densidade de exibição para dashboards industriais.
 * - Fornecer configurações de legibilidade para grids de alta densidade.
 * - Calcular métricas de legibilidade com base em resolução e densidade de dados.
 * - Persistir preferências de perfil por usuário/sessão via env/config.
 */

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type DensityProfile = "compact" | "comfortable" | "spacious" | "industrial";

export type ColorScheme = "light" | "dark" | "high-contrast" | "industrial-dark";

export interface GridDisplayProfile {
  id: string;
  name: string;
  densityProfile: DensityProfile;
  colorScheme: ColorScheme;
  rowHeightPx: number;
  fontSizePx: number;
  cellPaddingPx: number;
  columnMinWidthPx: number;
  maxVisibleRows: number;
  showGridLines: boolean;
  alternateRowColors: boolean;
  stickyHeader: boolean;
  virtualScrollThreshold: number;  // nº de linhas acima do qual ativa virtual scroll
  description: string;
}

export interface LegibilityMetrics {
  profile: DensityProfile;
  rowsVisible: number;
  estimatedReadingTimeMs: number;    // tempo estimado para ler uma linha
  accessibilityScore: number;        // 0-100 (WCAG AA = 70+, AAA = 90+)
  recommendations: string[];
}

// ─── Perfis pré-definidos ─────────────────────────────────────────────────────

const DISPLAY_PROFILES: GridDisplayProfile[] = [
  {
    id: "compact",
    name: "Compacto",
    densityProfile: "compact",
    colorScheme: "light",
    rowHeightPx: 28,
    fontSizePx: 12,
    cellPaddingPx: 4,
    columnMinWidthPx: 80,
    maxVisibleRows: 30,
    showGridLines: true,
    alternateRowColors: false,
    stickyHeader: true,
    virtualScrollThreshold: 100,
    description: "Máxima densidade de dados. Ideal para monitoramento em tela grande (≥27\").",
  },
  {
    id: "comfortable",
    name: "Confortável",
    densityProfile: "comfortable",
    colorScheme: "light",
    rowHeightPx: 40,
    fontSizePx: 14,
    cellPaddingPx: 8,
    columnMinWidthPx: 100,
    maxVisibleRows: 20,
    showGridLines: true,
    alternateRowColors: true,
    stickyHeader: true,
    virtualScrollThreshold: 200,
    description: "Balanceia densidade e legibilidade. Padrão para uso geral.",
  },
  {
    id: "spacious",
    name: "Espaçoso",
    densityProfile: "spacious",
    colorScheme: "light",
    rowHeightPx: 56,
    fontSizePx: 16,
    cellPaddingPx: 12,
    columnMinWidthPx: 120,
    maxVisibleRows: 12,
    showGridLines: false,
    alternateRowColors: true,
    stickyHeader: true,
    virtualScrollThreshold: 500,
    description: "Alta legibilidade. Recomendado para apresentações e treinamentos.",
  },
  {
    id: "industrial",
    name: "Industrial",
    densityProfile: "industrial",
    colorScheme: "industrial-dark",
    rowHeightPx: 32,
    fontSizePx: 13,
    cellPaddingPx: 6,
    columnMinWidthPx: 90,
    maxVisibleRows: 25,
    showGridLines: true,
    alternateRowColors: false,
    stickyHeader: true,
    virtualScrollThreshold: 150,
    description:
      "Otimizado para ambientes industriais: fundo escuro, alto contraste, mínimo de ruído visual. NOC/SOC/field operations.",
  },
];

// ─── Funções ──────────────────────────────────────────────────────────────────

export function getAllProfiles(): GridDisplayProfile[] {
  return DISPLAY_PROFILES;
}

export function getProfileById(profileId: string): GridDisplayProfile | undefined {
  return DISPLAY_PROFILES.find((p) => p.id === profileId);
}

export function getDefaultProfile(): GridDisplayProfile {
  return DISPLAY_PROFILES.find((p) => p.id === "comfortable")!;
}

/**
 * Calcula métricas de legibilidade para um perfil e contexto de dados.
 *
 * @param profileId - ID do perfil de display
 * @param totalRows - número total de linhas de dados
 * @param screenHeightPx - altura útil da tela em pixels (padrão: 900)
 */
export function calculateLegibilityMetrics(
  profileId: string,
  totalRows: number,
  screenHeightPx = 900
): LegibilityMetrics {
  const profile = getProfileById(profileId) ?? getDefaultProfile();

  // Linhas visíveis na tela sem scroll
  const headerHeightPx = 48;
  const rowsVisible = Math.min(
    Math.floor((screenHeightPx - headerHeightPx) / profile.rowHeightPx),
    profile.maxVisibleRows
  );

  // Heurística: tempo de leitura baseado no tamanho da fonte e densidade
  const baseMsPerRow = 200;
  const fontPenalty = Math.max(0, (14 - profile.fontSizePx) * 20);  // penalidade por fonte <14px
  const paddingBonus = Math.min(50, profile.cellPaddingPx * 3);       // bônus por padding
  const estimatedReadingTimeMs = Math.max(100, baseMsPerRow - paddingBonus + fontPenalty);

  // Score de acessibilidade heurístico (WCAG)
  let accessibilityScore = 70; // base WCAG AA
  if (profile.fontSizePx >= 16) accessibilityScore += 15;
  else if (profile.fontSizePx >= 14) accessibilityScore += 5;
  else if (profile.fontSizePx < 12) accessibilityScore -= 20;

  if (profile.colorScheme === "high-contrast") accessibilityScore += 15;
  if (profile.colorScheme === "industrial-dark") accessibilityScore += 5;
  if (profile.alternateRowColors) accessibilityScore += 5;
  if (profile.cellPaddingPx >= 8) accessibilityScore += 5;

  accessibilityScore = Math.min(100, Math.max(0, accessibilityScore));

  // Recomendações automáticas
  const recommendations: string[] = [];

  if (totalRows > profile.virtualScrollThreshold) {
    recommendations.push(
      `Com ${totalRows} linhas, ative virtual scroll para manter performance (limite do perfil: ${profile.virtualScrollThreshold}).`
    );
  }

  if (totalRows > profile.maxVisibleRows * 3 && profile.densityProfile === "spacious") {
    recommendations.push(
      `Volume de dados elevado (${totalRows} linhas). Considere o perfil 'compact' ou 'industrial' para maior densidade.`
    );
  }

  if (profile.fontSizePx < 13) {
    recommendations.push(
      "Fonte abaixo de 13px pode dificultar leitura em telas de baixa resolução. Considere 'comfortable' ou 'spacious'."
    );
  }

  if (accessibilityScore < 70) {
    recommendations.push(
      "Score de acessibilidade abaixo de WCAG AA (70). Considere aumentar tamanho de fonte ou usar perfil 'high-contrast'."
    );
  }

  return {
    profile: profile.densityProfile,
    rowsVisible,
    estimatedReadingTimeMs,
    accessibilityScore,
    recommendations,
  };
}

/**
 * Sugere o perfil mais adequado dado o volume de dados e contexto de uso.
 */
export function suggestProfile(
  totalRows: number,
  context: "office" | "field" | "noc" | "presentation"
): GridDisplayProfile {
  if (context === "presentation") return getProfileById("spacious")!;
  if (context === "noc" || context === "field") return getProfileById("industrial")!;
  if (totalRows > 1000) return getProfileById("compact")!;
  if (totalRows > 200) return getProfileById("comfortable")!;
  return getDefaultProfile();
}
