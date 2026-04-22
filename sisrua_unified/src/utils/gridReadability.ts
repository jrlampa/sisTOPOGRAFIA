/**
 * Utilitário de legibilidade de grid para dashboards de alta densidade (T1-27).
 *
 * Fornece cálculos responsivos de colunas, classificação de densidade,
 * truncamento de texto e configuração de espaçamento otimizado para
 * operação industrial em sisTOPOGRAFIA.
 */

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type NivelDensidade = "baixa" | "media" | "alta" | "muito_alta";

export interface GridReadabilityConfig {
  colunas: number;
  alturaLinha: number;
  gapPx: number;
  paddingPx: number;
  tamanhoFonte: "xs" | "sm" | "base";
  densidade: NivelDensidade;
}

// ---------------------------------------------------------------------------
// Cálculo de colunas responsivas
// ---------------------------------------------------------------------------

/**
 * Calcula o número ideal de colunas para um container de largura fixa,
 * garantindo que cada coluna tenha ao menos `larguraMinimaColuna` px.
 *
 * Retorna entre 1 e `maxColunas` colunas.
 */
export function computeGridColumns(
  larguraContainer: number,
  larguraMinimaColuna: number,
  maxColunas = 12,
): number {
  if (larguraContainer <= 0 || larguraMinimaColuna <= 0) return 1;
  const colunas = Math.floor(larguraContainer / larguraMinimaColuna);
  return Math.max(1, Math.min(colunas, maxColunas));
}

// ---------------------------------------------------------------------------
// Classificação de densidade
// ---------------------------------------------------------------------------

/**
 * Classifica o nível de densidade de um grid com base no número de itens.
 *
 * - baixa:     ≤ 50 itens
 * - media:     51 – 200 itens
 * - alta:      201 – 500 itens
 * - muito_alta: > 500 itens
 */
export function classificarDensidade(totalItens: number): NivelDensidade {
  if (totalItens <= 50) return "baixa";
  if (totalItens <= 200) return "media";
  if (totalItens <= 500) return "alta";
  return "muito_alta";
}

// ---------------------------------------------------------------------------
// Altura de linha por densidade
// ---------------------------------------------------------------------------

/**
 * Retorna a altura recomendada de linha (em px) para cada nível de densidade.
 * Garante legibilidade mínima mesmo em grids compactos.
 */
export function alturaLinhaPorDensidade(densidade: NivelDensidade): number {
  const mapa: Record<NivelDensidade, number> = {
    baixa: 48,
    media: 40,
    alta: 32,
    muito_alta: 28,
  };
  return mapa[densidade];
}

// ---------------------------------------------------------------------------
// Tamanho de fonte por densidade
// ---------------------------------------------------------------------------

/**
 * Retorna a classe de tamanho de fonte (Tailwind) recomendada por densidade.
 */
export function tamFontePorDensidade(
  densidade: NivelDensidade,
): "xs" | "sm" | "base" {
  if (densidade === "muito_alta" || densidade === "alta") return "xs";
  if (densidade === "media") return "sm";
  return "base";
}

// ---------------------------------------------------------------------------
// Truncamento de texto
// ---------------------------------------------------------------------------

/**
 * Trunca texto para exibição em células de grid compactas.
 * Adiciona reticências e retorna o texto original como title para tooltip.
 */
export function truncarTexto(
  texto: string,
  maxCaracteres: number,
): { exibicao: string; completo: string; truncado: boolean } {
  if (texto.length <= maxCaracteres) {
    return { exibicao: texto, completo: texto, truncado: false };
  }
  return {
    exibicao: texto.slice(0, maxCaracteres - 1) + "…",
    completo: texto,
    truncado: true,
  };
}

// ---------------------------------------------------------------------------
// Configuração consolidada
// ---------------------------------------------------------------------------

/**
 * Gera uma configuração completa de legibilidade de grid para um dado
 * container e volume de dados.
 *
 * @param larguraContainer - Largura disponível em px
 * @param totalItens       - Número de itens a exibir
 * @param larguraMinimaColuna - Largura mínima por coluna (default 160px)
 */
export function buildGridConfig(
  larguraContainer: number,
  totalItens: number,
  larguraMinimaColuna = 160,
): GridReadabilityConfig {
  const densidade = classificarDensidade(totalItens);
  const colunas = computeGridColumns(larguraContainer, larguraMinimaColuna);
  const alturaLinha = alturaLinhaPorDensidade(densidade);
  const tamanhoFonte = tamFontePorDensidade(densidade);

  const gapPx = densidade === "muito_alta" ? 4 : densidade === "alta" ? 6 : 8;
  const paddingPx = densidade === "muito_alta" ? 4 : densidade === "alta" ? 6 : 12;

  return {
    colunas,
    alturaLinha,
    gapPx,
    paddingPx,
    tamanhoFonte,
    densidade,
  };
}

// ---------------------------------------------------------------------------
// Classes CSS Tailwind recomendadas
// ---------------------------------------------------------------------------

/**
 * Retorna classes Tailwind para o container do grid conforme a densidade.
 * Compatível com o sistema de tokens de `src/index.css`.
 */
export function gridContainerClasses(config: GridReadabilityConfig): string {
  const fontClass = `text-${config.tamanhoFonte}`;
  return [
    "w-full",
    "overflow-auto",
    fontClass,
    "leading-snug",
    "tabular-nums",
  ].join(" ");
}

/**
 * Retorna classes Tailwind para uma célula de grid conforme a densidade.
 */
export function gridCellClasses(config: GridReadabilityConfig): string {
  const paddingClass =
    config.paddingPx >= 12
      ? "px-3 py-2"
      : config.paddingPx >= 6
        ? "px-2 py-1"
        : "px-1 py-0.5";
  return [
    paddingClass,
    "truncate",
    "border-b",
    "border-slate-200",
    "dark:border-slate-700",
    "align-middle",
  ].join(" ");
}
