/**
 * Utilitário de conformidade com WCAG 2.1 & eMAG 3.1 (T1-24).
 *
 * Referências:
 *  - WCAG 2.1: https://www.w3.org/TR/WCAG21/
 *  - eMAG 3.1: http://emag.governoeletronico.gov.br/
 *
 * Todas as mensagens estão em pt-BR conforme padrão do projeto.
 */

// ---------------------------------------------------------------------------
// Cálculo de contraste (WCAG 1.4.3 / eMAG 3.1 seção 4.4)
// ---------------------------------------------------------------------------

/**
 * Converte hex 3 ou 6 dígitos para componentes RGB [0, 255].
 */
export function hexToRgb(hex: string): [number, number, number] | null {
  const sanitized = hex.replace(/^#/, "");
  const isValidHex = /^[0-9a-fA-F]+$/.test(sanitized);
  if (!isValidHex) return null;
  if (sanitized.length === 3) {
    const r = parseInt(sanitized[0] + sanitized[0], 16);
    const g = parseInt(sanitized[1] + sanitized[1], 16);
    const b = parseInt(sanitized[2] + sanitized[2], 16);
    return [r, g, b];
  }
  if (sanitized.length === 6) {
    const r = parseInt(sanitized.slice(0, 2), 16);
    const g = parseInt(sanitized.slice(2, 4), 16);
    const b = parseInt(sanitized.slice(4, 6), 16);
    return [r, g, b];
  }
  return null;
}

/**
 * Calcula luminância relativa de um canal RGB (WCAG formula).
 */
function channelLuminance(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/**
 * Calcula luminância relativa de uma cor hex.
 * Retorna valor entre 0 (preto) e 1 (branco).
 */
export function relativeLuminance(hex: string): number | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb;
  return (
    0.2126 * channelLuminance(r) +
    0.7152 * channelLuminance(g) +
    0.0722 * channelLuminance(b)
  );
}

/**
 * Calcula a taxa de contraste entre duas cores hex.
 * Retorna null se qualquer cor for inválida.
 */
export function contrastRatio(foreground: string, background: string): number | null {
  const l1 = relativeLuminance(foreground);
  const l2 = relativeLuminance(background);
  if (l1 === null || l2 === null) return null;
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Nível de conformidade WCAG baseado na taxa de contraste.
 * - "AAA": ≥ 7:1 (WCAG 2.1 critério 1.4.6)
 * - "AA":  ≥ 4.5:1 para texto normal (critério 1.4.3)
 * - "AA_LARGE": ≥ 3:1 para texto grande (critério 1.4.3)
 * - "Reprovado": abaixo de 3:1
 */
export type ContrastLevel = "AAA" | "AA" | "AA_LARGE" | "Reprovado";

export function wcagContrastLevel(ratio: number): ContrastLevel {
  if (ratio >= 7) return "AAA";
  if (ratio >= 4.5) return "AA";
  if (ratio >= 3) return "AA_LARGE";
  return "Reprovado";
}

// ---------------------------------------------------------------------------
// Atributos de acessibilidade (eMAG 3.1 + WCAG 2.1)
// ---------------------------------------------------------------------------

/**
 * Valida o atributo lang do HTML para conformidade com eMAG 3.1 seção 1.2.
 * eMAG exige lang="pt-BR" para sistemas do governo brasileiro.
 */
export function validarLangHtml(lang: string): {
  valido: boolean;
  mensagem: string;
} {
  if (lang === "pt-BR") {
    return { valido: true, mensagem: "Atributo lang correto para eMAG 3.1." };
  }
  if (lang.startsWith("pt")) {
    return {
      valido: false,
      mensagem:
        `Lang '${lang}' não está em conformidade com eMAG 3.1. Use 'pt-BR'.`,
    };
  }
  return {
    valido: false,
    mensagem: `Lang '${lang}' inválido. eMAG 3.1 exige 'pt-BR' para sistemas governamentais.`,
  };
}

/**
 * Gera um aria-label composto a partir de partes textuais (pt-BR).
 * Remove partes vazias e une com vírgula.
 */
export function buildAriaLabel(partes: string[]): string {
  return partes
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .join(", ");
}

/**
 * Gera um ID único para associação de label/input (WCAG 1.3.1 + eMAG 3.1 seção 4.5).
 * Prefixo + slug do texto + índice para garantir unicidade.
 */
export function gerarIdAcessivel(prefixo: string, texto: string, indice: number): string {
  const slug = texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${prefixo}-${slug}-${indice}`;
}

// ---------------------------------------------------------------------------
// Catálogo de regras WCAG 2.1 / eMAG 3.1 relevantes para o sistema
// ---------------------------------------------------------------------------

export interface RegraA11y {
  id: string;
  fonte: "WCAG2.1" | "eMAG3.1";
  criterio: string;
  descricao: string;
  nivel: "A" | "AA" | "AAA";
  obrigatorio: boolean;
}

export const REGRAS_A11Y: RegraA11y[] = [
  {
    id: "wcag-1.1.1",
    fonte: "WCAG2.1",
    criterio: "1.1.1 Conteúdo não textual",
    descricao: "Imagens e ícones devem ter texto alternativo (alt/aria-label).",
    nivel: "A",
    obrigatorio: true,
  },
  {
    id: "wcag-1.3.1",
    fonte: "WCAG2.1",
    criterio: "1.3.1 Informação e relações",
    descricao: "Estrutura semântica deve refletir a apresentação visual (headings, listas, tabelas).",
    nivel: "A",
    obrigatorio: true,
  },
  {
    id: "wcag-1.4.3",
    fonte: "WCAG2.1",
    criterio: "1.4.3 Contraste (mínimo)",
    descricao: "Contraste de texto normal ≥ 4,5:1; texto grande ≥ 3:1.",
    nivel: "AA",
    obrigatorio: true,
  },
  {
    id: "wcag-2.1.1",
    fonte: "WCAG2.1",
    criterio: "2.1.1 Teclado",
    descricao: "Toda funcionalidade disponível por mouse deve ser acessível por teclado.",
    nivel: "A",
    obrigatorio: true,
  },
  {
    id: "wcag-2.4.3",
    fonte: "WCAG2.1",
    criterio: "2.4.3 Ordem de foco",
    descricao: "Ordem de foco por teclado (Tab) deve ser lógica e preservar o significado.",
    nivel: "A",
    obrigatorio: true,
  },
  {
    id: "wcag-2.4.7",
    fonte: "WCAG2.1",
    criterio: "2.4.7 Foco visível",
    descricao: "Qualquer componente focável deve ter indicador visual de foco.",
    nivel: "AA",
    obrigatorio: true,
  },
  {
    id: "wcag-3.1.1",
    fonte: "WCAG2.1",
    criterio: "3.1.1 Idioma da página",
    descricao: "O idioma padrão do conteúdo deve ser identificado via atributo lang.",
    nivel: "A",
    obrigatorio: true,
  },
  {
    id: "emag-1.2",
    fonte: "eMAG3.1",
    criterio: "eMAG 1.2 Idioma",
    descricao: "Sistemas governamentais brasileiros devem usar lang='pt-BR'.",
    nivel: "A",
    obrigatorio: true,
  },
  {
    id: "emag-4.4",
    fonte: "eMAG3.1",
    criterio: "eMAG 4.4 Contraste",
    descricao: "Conformidade com contraste mínimo de 4,5:1 para texto sobre fundo.",
    nivel: "AA",
    obrigatorio: true,
  },
  {
    id: "emag-4.5",
    fonte: "eMAG3.1",
    criterio: "eMAG 4.5 Formulários",
    descricao: "Campos de formulário devem ter rótulos explícitos associados via label/for ou aria-label.",
    nivel: "A",
    obrigatorio: true,
  },
];

/**
 * Retorna todas as regras obrigatórias para o nível informado e superiores.
 */
export function regrasObrigatorias(nivel: "A" | "AA" | "AAA"): RegraA11y[] {
  const hierarquia: Record<string, number> = { A: 1, AA: 2, AAA: 3 };
  const maxNivel = hierarquia[nivel];
  return REGRAS_A11Y.filter(
    (r) => r.obrigatorio && hierarquia[r.nivel] <= maxNivel
  );
}

// ---------------------------------------------------------------------------
// Verificação de conformidade de componente
// ---------------------------------------------------------------------------

export interface CheckComponenteResult {
  conforme: boolean;
  violacoes: string[];
  avisos: string[];
}

export interface ComponenteA11yProps {
  temAriaLabel?: boolean;
  temAlt?: boolean;
  focoVisivelImplementado?: boolean;
  conteudoSoTexto?: boolean;
  corForeground?: string;
  corBackground?: string;
}

/**
 * Verifica conformidade básica de um componente com WCAG 2.1 AA + eMAG 3.1.
 */
export function verificarComponente(props: ComponenteA11yProps): CheckComponenteResult {
  const violacoes: string[] = [];
  const avisos: string[] = [];

  if (props.temAriaLabel === false) {
    violacoes.push("Elemento interativo sem aria-label ou label associado (WCAG 1.1.1, eMAG 4.5).");
  }

  if (props.temAlt === false && props.conteudoSoTexto !== true) {
    violacoes.push("Imagem sem atributo alt (WCAG 1.1.1).");
  }

  if (props.focoVisivelImplementado === false) {
    violacoes.push("Indicador de foco não visível (WCAG 2.4.7).");
  }

  if (props.corForeground && props.corBackground) {
    const ratio = contrastRatio(props.corForeground, props.corBackground);
    if (ratio !== null) {
      const nivel = wcagContrastLevel(ratio);
      if (nivel === "Reprovado") {
        violacoes.push(
          `Contraste insuficiente (${ratio.toFixed(2)}:1) — mínimo 3:1 para texto grande (WCAG 1.4.3, eMAG 4.4).`
        );
      } else if (nivel === "AA_LARGE") {
        avisos.push(
          `Contraste ${ratio.toFixed(2)}:1 aprovado apenas para texto grande. Use ≥ 4,5:1 para texto normal.`
        );
      }
    } else {
      avisos.push("Cores inválidas — não foi possível calcular contraste.");
    }
  }

  return {
    conforme: violacoes.length === 0,
    violacoes,
    avisos,
  };
}
