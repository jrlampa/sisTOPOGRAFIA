/**
 * infoClassificationService.ts — Classificação da Informação & Segregação (Item 128 [T1]).
 */

export type NivelClassificacao = 'publico' | 'interno' | 'confidencial' | 'restrito';

export interface ClassificacaoRecurso {
  recursoId: string;
  recursoTipo: string;
  nivel: NivelClassificacao;
  justificativa: string;
  classificadoPor: string;
  classificadoEm: Date;
  revisaoEm: Date;
}

// Papéis permitidos por nível
const POLITICA_ACESSO: Record<NivelClassificacao, string[]> = {
  publico: ['admin', 'gestor', 'analista', 'operador', 'visitante'],
  interno: ['admin', 'gestor', 'analista', 'operador'],
  confidencial: ['admin', 'gestor', 'analista'],
  restrito: ['admin'],
};

// Dias até revisão por nível
const REVISAO_DIAS: Record<NivelClassificacao, number> = {
  publico: 365,
  interno: 180,
  confidencial: 90,
  restrito: 30,
};

const classificacoes = new Map<string, ClassificacaoRecurso>();

export function classificarRecurso(
  recursoId: string,
  recursoTipo: string,
  nivel: NivelClassificacao,
  justificativa: string,
  classificadoPor: string
): ClassificacaoRecurso {
  const agora = new Date();
  const revisaoEm = new Date(agora.getTime() + REVISAO_DIAS[nivel] * 24 * 60 * 60 * 1000);
  const classificacao: ClassificacaoRecurso = {
    recursoId, recursoTipo, nivel, justificativa, classificadoPor, classificadoEm: agora, revisaoEm,
  };
  classificacoes.set(recursoId, classificacao);
  return classificacao;
}

export function obterClassificacao(recursoId: string): ClassificacaoRecurso | null {
  return classificacoes.get(recursoId) ?? null;
}

export function listarPorNivel(nivel: NivelClassificacao): ClassificacaoRecurso[] {
  return Array.from(classificacoes.values()).filter(c => c.nivel === nivel);
}

export function resumoClassificacoes(): Record<NivelClassificacao, number> {
  const resumo: Record<NivelClassificacao, number> = { publico: 0, interno: 0, confidencial: 0, restrito: 0 };
  for (const c of classificacoes.values()) {
    resumo[c.nivel]++;
  }
  return resumo;
}

export function politicaAcessoPorNivel(nivel: NivelClassificacao): string[] {
  return POLITICA_ACESSO[nivel] ?? [];
}

/** Limpa estado (uso em testes) */
export function _resetClassificacoes(): void {
  classificacoes.clear();
}
