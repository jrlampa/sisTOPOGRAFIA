/**
 * Catálogo de estruturas de MT (Média Tensão) da Light S.A.
 * Fonte: RESUMO KITS MAIS USADOS.xlsx — sheets "KITS RESUMO" e "KITS_MATERIAIS"
 *
 * Cada entrada possui:
 *   code     — código do kit (ex: "13N1")
 *   label    — descrição curta (ex: "Normal Pino Simples Urb.")
 *   category — agrupamento visual no combobox
 */

export interface MtStructureEntry {
  code: string;
  label: string;
  category: string;
}

export const MT_STRUCTURE_CATALOG: MtStructureEntry[] = [
  // ── Rede Convencional 13,8kV — Normal ─────────────────────────────────────
  {
    code: "13N1",
    label: "Normal Pino Simples Urb. — alinhamento/tangente",
    category: "Conv. 13,8kV — Normal",
  },
  {
    code: "13N2",
    label: "Normal Pino Duplo Urb. — deflexão",
    category: "Conv. 13,8kV — Normal",
  },
  {
    code: "13N3",
    label: "Normal Um Fim Rede Urb.",
    category: "Conv. 13,8kV — Normal",
  },
  {
    code: "13N4",
    label: "Normal 2 Fins Rede Urb. — âncora dupla / derivação",
    category: "Conv. 13,8kV — Normal",
  },

  // ── Rede Convencional 13,8kV — Meio-Beco ──────────────────────────────────
  {
    code: "13M1",
    label: "Meio-Beco Pino Simples Urb. — alinhamento",
    category: "Conv. 13,8kV — Meio-Beco",
  },
  {
    code: "13M2",
    label: "Meio-Beco Pino Duplo Urb. — deflexão",
    category: "Conv. 13,8kV — Meio-Beco",
  },
  {
    code: "13M3",
    label: "Meio-Beco Um Fim Rede Urb.",
    category: "Conv. 13,8kV — Meio-Beco",
  },
  {
    code: "13M4",
    label: "Meio-Beco 2 Fins Rede Urb.",
    category: "Conv. 13,8kV — Meio-Beco",
  },

  // ── Rede Convencional 13,8kV — Beco ───────────────────────────────────────
  {
    code: "13B1",
    label: "Beco Pino Simples Urb. — alinhamento",
    category: "Conv. 13,8kV — Beco",
  },
  {
    code: "13B2",
    label: "Beco Pino Duplo Urb. — deflexão",
    category: "Conv. 13,8kV — Beco",
  },
  {
    code: "13B3",
    label: "Beco Um Fim Rede Urb.",
    category: "Conv. 13,8kV — Beco",
  },
  {
    code: "13B4",
    label: "Beco 2 Fins Rede Urb. — âncora dupla / derivação",
    category: "Conv. 13,8kV — Beco",
  },

  // ── Rede Convencional 13,8kV — Com Transformador ──────────────────────────
  {
    code: "13TR/N10",
    label: "Trafo Normal c/Chave Fus. 10kA c/P.R.",
    category: "Conv. 13,8kV — Trafo",
  },
  {
    code: "13TR/B10",
    label: "Trafo Beco c/Chave Fus. 10kA c/P.R.",
    category: "Conv. 13,8kV — Trafo",
  },

  // ── Rede Convencional 13,8kV — Chaves e Derivações ────────────────────────
  {
    code: "13N1/FU",
    label: "Chave Fusível c/Estrutura Normal",
    category: "Conv. 13,8kV — Chaves",
  },
  {
    code: "LCINTA",
    label: "Mont. Derivação c/Chave Fus. 10kA c/P.R.",
    category: "Conv. 13,8kV — Chaves",
  },
  {
    code: "13FA/DER",
    label: "Chave Faca em Derivação Normal",
    category: "Conv. 13,8kV — Chaves",
  },
  {
    code: "13FA/B",
    label: "Chave Faca Long. Red. Mont. Beco",
    category: "Conv. 13,8kV — Chaves",
  },
  {
    code: "13FA/M",
    label: "Chave Faca Long. Red. Meio-Beco",
    category: "Conv. 13,8kV — Chaves",
  },
  {
    code: "13FA/N",
    label: "Chave Faca Long. Rede Mont. Normal",
    category: "Conv. 13,8kV — Chaves",
  },

  // ── Rede Convencional 13,8kV — Cruzetas ───────────────────────────────────
  {
    code: "R-4/1",
    label: "Cruzeta Polimérica 2000 mm",
    category: "Conv. 13,8kV — Cruzetas",
  },
  {
    code: "R-4/2",
    label: "Cruzeta Polimérica 2400 mm",
    category: "Conv. 13,8kV — Cruzetas",
  },

  // ── Rede Convencional 13,8kV — Inversão de Fase ───────────────────────────
  {
    code: "13INV2A",
    label: "Inversão de Fase c/Derivação Simples",
    category: "Conv. 13,8kV — Inversão",
  },
  {
    code: "13INV3BA",
    label: "Inversão de Fase c/Fim Rede Simples",
    category: "Conv. 13,8kV — Inversão",
  },
  {
    code: "13INV4A",
    label: "Inversão de Fase Dupla c/Derivação",
    category: "Conv. 13,8kV — Inversão",
  },
  {
    code: "13INVBA",
    label: "Inversão de Fase c/Derivação",
    category: "Conv. 13,8kV — Inversão",
  },
  {
    code: "13INVD4A",
    label: "Inversão de Fase c/Derivação Especial",
    category: "Conv. 13,8kV — Inversão",
  },

  // ── Rede Convencional 13,8kV — Especiais ──────────────────────────────────
  {
    code: "13B4RCVT",
    label: "Beco c/Religador Sec. Conv. CVT",
    category: "Conv. 13,8kV — Especiais",
  },
  {
    code: "13BC/N",
    label: "Banco de Capacitores Fixo",
    category: "Conv. 13,8kV — Especiais",
  },

  // ── Rede Compacta XLPE 13,8kV — Estruturas Básicas ────────────────────────
  {
    code: "13CE1A",
    label: "Rd Ae Comp Braço Anti Vão Tangente — alinhamento",
    category: "Compacta 13,8kV — Básicas",
  },
  {
    code: "13CE2",
    label: "Rd Ae Compacta p/Deflexão Rede",
    category: "Compacta 13,8kV — Básicas",
  },
  {
    code: "13CE2.3",
    label: "Est Conjug Derivação c/Deflexão",
    category: "Compacta 13,8kV — Básicas",
  },
  {
    code: "13CE3",
    label: "Rd Ae Compacta p/Fim Rede",
    category: "Compacta 13,8kV — Básicas",
  },
  {
    code: "13CE3CE3",
    label: "Est Deriv Dois Fins de Rede",
    category: "Compacta 13,8kV — Básicas",
  },
  {
    code: "13CE4",
    label: "Rd Ae Compacta p/Deflexão Especial",
    category: "Compacta 13,8kV — Básicas",
  },
  {
    code: "13CE2CE3",
    label: "Rd Ae Comp Deriv Lado Oposto",
    category: "Compacta 13,8kV — Básicas",
  },
  {
    code: "13CE4CE3",
    label: "Rd Ae Comp Deriv Lado Oposto c/CE4",
    category: "Compacta 13,8kV — Básicas",
  },

  // ── Rede Compacta XLPE 13,8kV — Com Transformador ─────────────────────────
  {
    code: "13CE2JT",
    label: "Trafo Conv c/Braço Hor Jota",
    category: "Compacta 13,8kV — Trafo",
  },
  {
    code: "13CE2JT2",
    label: "Trafo Conv Paralelo c/Braço Hor Jota",
    category: "Compacta 13,8kV — Trafo",
  },
  {
    code: "13CE2JTA",
    label: "Trafo Ap c/Braço Horizontal Jota",
    category: "Compacta 13,8kV — Trafo",
  },
  {
    code: "13CE3T",
    label: "Trafo Conv em Fim de Rede",
    category: "Compacta 13,8kV — Trafo",
  },
  {
    code: "13CE3TA",
    label: "Trafo Autoprotegido",
    category: "Compacta 13,8kV — Trafo",
  },
  {
    code: "13CE1-TR",
    label: "Trafo Rede Compacta CE1",
    category: "Compacta 13,8kV — Trafo",
  },
  {
    code: "13CEJSCM",
    label: "Chave Faca Seccionadora c/Trafo",
    category: "Compacta 13,8kV — Trafo",
  },

  // ── Rede Compacta XLPE 13,8kV — Pára-Raios ────────────────────────────────
  {
    code: "13CE2JPR",
    label: "Instalação de Pára-Raios c/Deflexão",
    category: "Compacta 13,8kV — Pára-Raios",
  },
  {
    code: "13CE3PR",
    label: "Instalação de Pára-Raios Fim de Rede",
    category: "Compacta 13,8kV — Pára-Raios",
  },
  {
    code: "13CEN3PR",
    label: "Est Trans Rd Conv p/Compac s/Secci.",
    category: "Compacta 13,8kV — Pára-Raios",
  },
  {
    code: "13CE1-PR",
    label: "Pára-Raios Rede Compacta CE1",
    category: "Compacta 13,8kV — Pára-Raios",
  },

  // ── Rede Compacta XLPE 13,8kV — Chaves e Seccionadoras ────────────────────
  {
    code: "13CEJCF",
    label: "Chave Fusível e Deflexão Especial",
    category: "Compacta 13,8kV — Chaves",
  },
  {
    code: "13CEJSU",
    label: "Chave Seccionadora Unipolar",
    category: "Compacta 13,8kV — Chaves",
  },
  {
    code: "13CE4JC3",
    label: "Chave Faca c/Deflexão CE4",
    category: "Compacta 13,8kV — Chaves",
  },
  {
    code: "13CE4JR",
    label: "Chave Seccionadora Unipolar CE4",
    category: "Compacta 13,8kV — Chaves",
  },
  {
    code: "13CE4JS",
    label: "Chave Seccionadora Unipolar CE4 (variante)",
    category: "Compacta 13,8kV — Chaves",
  },
  {
    code: "13CEJRE",
    label: "Chave Seccionadora Unipolar c/Derivação",
    category: "Compacta 13,8kV — Chaves",
  },
  {
    code: "13CEJRS",
    label: "Chave Seccionadora Unipolar c/Fim Rede",
    category: "Compacta 13,8kV — Chaves",
  },
  {
    code: "13CEJSCF",
    label: "Chave Faca Seccionadora",
    category: "Compacta 13,8kV — Chaves",
  },
  {
    code: "13CEN3SU",
    label: "Est Trans Rd Conv p/Compac c/Secci. Unip.",
    category: "Compacta 13,8kV — Chaves",
  },
  {
    code: "13CE1-FA",
    label: "Chave Faca Rede Compacta CE1",
    category: "Compacta 13,8kV — Chaves",
  },
  {
    code: "13CE1ADT",
    label: "Rd Ae Comp CE1 c/Derivação p/Trafo",
    category: "Compacta 13,8kV — Chaves",
  },
];

/** Lista de categorias, preservando a ordem de inserção */
export const MT_STRUCTURE_CATEGORIES: string[] = Array.from(
  new Set(MT_STRUCTURE_CATALOG.map((e) => e.category)),
);

/** Mapa rápido código → entry */
export const MT_STRUCTURE_MAP: Map<string, MtStructureEntry> = new Map(
  MT_STRUCTURE_CATALOG.map((e) => [e.code, e]),
);

/** Apenas os códigos, p/ validação */
export const MT_STRUCTURE_CODES: string[] = MT_STRUCTURE_CATALOG.map(
  (e) => e.code,
);
