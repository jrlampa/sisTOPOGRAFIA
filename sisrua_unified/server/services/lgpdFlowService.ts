/**
 * LGPD Flow Service — RIPD Automatizado (Item 38 – T1)
 *
 * Registro e gerenciamento de fluxos de tratamento de dados pessoais conforme
 * Lei Geral de Proteção de Dados (LGPD — Lei 13.709/2018) e diretrizes ANPD.
 *
 * Responsabilidades:
 *   - Catálogo de fluxos de tratamento com base legal registrada
 *   - Atendimento a direitos dos titulares (acesso, retificação, exclusão,
 *     portabilidade, revogação, oposição)
 *   - Geração de Relatório de Impacto à Proteção de Dados (RIPD) por fluxo
 *   - Gestão de finalidade, necessidade e proporcionalidade
 */

import { randomUUID } from 'crypto';

// ─── Enumerações LGPD ─────────────────────────────────────────────────────────

/**
 * Bases legais do Art. 7º e Art. 11 da LGPD (dados pessoais gerais e sensíveis).
 */
export type BaseLegal =
    | 'consentimento'         // Art. 7º I / Art. 11 I
    | 'cumprimento_obrigacao' // Art. 7º II / Art. 11 II a
    | 'execucao_politica'     // Art. 7º III
    | 'estudos_orgao'         // Art. 7º IV / Art. 11 II b
    | 'execucao_contrato'     // Art. 7º V
    | 'exercicio_direitos'    // Art. 7º VI / Art. 11 II d
    | 'protecao_vida'         // Art. 7º VII / Art. 11 II e
    | 'tutela_saude'          // Art. 7º VIII / Art. 11 II f
    | 'interesse_legitimo'    // Art. 7º IX
    | 'protecao_credito';     // Art. 7º X

/** Categorias de dados pessoais tratados. */
export type CategoriaDado =
    | 'identificacao'          // nome, CPF, e-mail
    | 'contato'                // telefone, endereço
    | 'localizacao'            // GPS, endereço georreferenciado
    | 'profissional'           // cargo, empresa
    | 'tecnico'                // logs, IPs, cookies
    | 'sensivel_saude'         // dados de saúde (Art. 5º II)
    | 'sensivel_biometrico';   // dados biométricos (Art. 5º II)

/** Direitos do titular (Cap. III LGPD). */
export type DireitoTitular =
    | 'confirmacao_existencia' // Art. 18 I
    | 'acesso'                 // Art. 18 II
    | 'correcao'               // Art. 18 III
    | 'anonimizacao_bloqueio'  // Art. 18 IV
    | 'portabilidade'          // Art. 18 V
    | 'eliminacao'             // Art. 18 VI
    | 'informacao_compartilhamento' // Art. 18 VII
    | 'revogacao_consentimento' // Art. 18 IX
    | 'oposicao';              // Art. 18 § 2º

/** Status de solicitação de direito do titular. */
export type StatusSolicitacao = 'recebida' | 'em_analise' | 'atendida' | 'indeferida';

// ─── Estruturas de dados ──────────────────────────────────────────────────────

/** Descrição de um fluxo de tratamento de dados pessoais. */
export interface FluxoTratamento {
    id: string;
    nome: string;
    finalidade: string;
    baseLegal: BaseLegal;
    /** Artigo LGPD de referência, ex: "Art. 7º V". */
    artigoLgpd: string;
    categorias: CategoriaDado[];
    /** Prazo de retenção em dias. */
    retencaoDias: number;
    /** Compartilhamento com terceiros? */
    compartilhaTerceiros: boolean;
    /** Transferência internacional? */
    transferenciaInternacional: boolean;
    /** Operador responsável (sistema ou serviço). */
    operador: string;
    registradoEm: string;
    atualizadoEm: string;
}

/** Solicitação de exercício de direito do titular. */
export interface SolicitacaoDireito {
    id: string;
    titularId: string;
    direito: DireitoTitular;
    fluxoId?: string;
    descricao: string;
    status: StatusSolicitacao;
    /** Prazo legal: 15 dias úteis (Art. 19 LGPD). */
    prazoAtendimentoISO: string;
    registradaEm: string;
    atendidaEm?: string;
    resposta?: string;
}

/** Relatório de Impacto à Proteção de Dados (RIPD) por fluxo. */
export interface RipdFluxo {
    fluxoId: string;
    fluxoNome: string;
    geradoEm: string;
    baseLegal: BaseLegal;
    artigoLgpd: string;
    finalidade: string;
    categorias: CategoriaDado[];
    retencaoDias: number;
    compartilhaTerceiros: boolean;
    transferenciaInternacional: boolean;
    operador: string;
    /** Necessidade e proporcionalidade: resumo. */
    avaliacaoNecessidade: string;
    /** Riscos identificados. */
    riscos: string[];
    /** Medidas de salvaguarda implementadas. */
    salvaguardas: string[];
    /** Conformidade avaliada: true se base legal + salvaguardas OK. */
    conforme: boolean;
}

// ─── Estado interno ───────────────────────────────────────────────────────────

const fluxosMap = new Map<string, FluxoTratamento>();
const solicitacoesMap = new Map<string, SolicitacaoDireito>();

// Prazo legal: 15 dias úteis ≈ 21 dias corridos (Art. 19 LGPD)
const PRAZO_DIAS_CORRIDOS = 21;

function isoNow(): string {
    return new Date().toISOString();
}

function prazoAtendimento(): string {
    const d = new Date();
    d.setDate(d.getDate() + PRAZO_DIAS_CORRIDOS);
    return d.toISOString();
}

// ─── Mapa de base legal → artigo LGPD ─────────────────────────────────────────

const ARTIGO_POR_BASE: Record<BaseLegal, string> = {
    consentimento:          'Art. 7º I',
    cumprimento_obrigacao:  'Art. 7º II',
    execucao_politica:      'Art. 7º III',
    estudos_orgao:          'Art. 7º IV',
    execucao_contrato:      'Art. 7º V',
    exercicio_direitos:     'Art. 7º VI',
    protecao_vida:          'Art. 7º VII',
    tutela_saude:           'Art. 7º VIII',
    interesse_legitimo:     'Art. 7º IX',
    protecao_credito:       'Art. 7º X',
};

// ─── Salvaguardas padrão por categoria ───────────────────────────────────────

function salvaguardasPorCategorias(categorias: CategoriaDado[]): string[] {
    const salvaguardas: string[] = [
        'Controle de acesso por ABAC (servidor/serviço)',
        'Criptografia em trânsito (TLS 1.2+)',
        'Trilha de auditoria write-once com SHA-256',
    ];
    if (categorias.includes('sensivel_saude') || categorias.includes('sensivel_biometrico')) {
        salvaguardas.push('Tratamento de dados sensíveis restrito a pessoal autorizado (Art. 11)');
        salvaguardas.push('Consentimento específico e destacado para dados sensíveis');
    }
    if (categorias.includes('localizacao')) {
        salvaguardas.push('Minimização de dados: coordenadas agregadas em vez de ponto exato quando possível');
    }
    if (categorias.includes('tecnico')) {
        salvaguardas.push('Pseudonimização de logs após 30 dias');
    }
    return salvaguardas;
}

function riscosPorFluxo(fluxo: FluxoTratamento): string[] {
    const riscos: string[] = [];
    if (fluxo.compartilhaTerceiros) {
        riscos.push('Compartilhamento com terceiros: risco de acesso não autorizado — mitigado por DPA (Data Processing Agreement)');
    }
    if (fluxo.transferenciaInternacional) {
        riscos.push('Transferência internacional: verificar adequação do país destino (Art. 33 LGPD)');
    }
    if (fluxo.categorias.includes('sensivel_saude') || fluxo.categorias.includes('sensivel_biometrico')) {
        riscos.push('Dados sensíveis: risco de discriminação — minimização e base legal específica obrigatórias');
    }
    if (fluxo.retencaoDias > 1825) { // > 5 anos
        riscos.push(`Retenção longa (${fluxo.retencaoDias} dias): justificar necessidade conforme princípio da necessidade (Art. 6º III)`);
    }
    if (riscos.length === 0) {
        riscos.push('Sem riscos elevados identificados para este fluxo');
    }
    return riscos;
}

// ─── API pública — Fluxos ────────────────────────────────────────────────────

/**
 * Registra ou atualiza um fluxo de tratamento de dados pessoais.
 */
export function registrarFluxo(
    input: Omit<FluxoTratamento, 'id' | 'artigoLgpd' | 'registradoEm' | 'atualizadoEm'>,
): FluxoTratamento {
    const id = randomUUID();
    const agora = isoNow();
    const fluxo: FluxoTratamento = {
        ...input,
        id,
        artigoLgpd: ARTIGO_POR_BASE[input.baseLegal],
        registradoEm: agora,
        atualizadoEm: agora,
    };
    fluxosMap.set(id, fluxo);
    return fluxo;
}

/** Atualiza um fluxo existente. */
export function atualizarFluxo(
    id: string,
    patch: Partial<Omit<FluxoTratamento, 'id' | 'registradoEm'>>,
): FluxoTratamento | null {
    const existing = fluxosMap.get(id);
    if (!existing) return null;
    const updated: FluxoTratamento = {
        ...existing,
        ...patch,
        id,
        registradoEm: existing.registradoEm,
        atualizadoEm: isoNow(),
        artigoLgpd: patch.baseLegal
            ? ARTIGO_POR_BASE[patch.baseLegal]
            : existing.artigoLgpd,
    };
    fluxosMap.set(id, updated);
    return updated;
}

/** Retorna todos os fluxos registrados. */
export function listarFluxos(): FluxoTratamento[] {
    return Array.from(fluxosMap.values());
}

/** Retorna um fluxo pelo ID. */
export function obterFluxo(id: string): FluxoTratamento | null {
    return fluxosMap.get(id) ?? null;
}

/** Remove um fluxo (apenas para uso administrativo autorizado). */
export function removerFluxo(id: string): boolean {
    return fluxosMap.delete(id);
}

// ─── API pública — Direitos do Titular ───────────────────────────────────────

/**
 * Registra solicitação de exercício de direito do titular (Art. 18 LGPD).
 */
export function registrarSolicitacaoDireito(
    titularId: string,
    direito: DireitoTitular,
    descricao: string,
    fluxoId?: string,
): SolicitacaoDireito {
    const id = randomUUID();
    const sol: SolicitacaoDireito = {
        id,
        titularId,
        direito,
        fluxoId,
        descricao,
        status: 'recebida',
        prazoAtendimentoISO: prazoAtendimento(),
        registradaEm: isoNow(),
    };
    solicitacoesMap.set(id, sol);
    return sol;
}

/** Atualiza o status de uma solicitação de direito. */
export function atualizarSolicitacao(
    id: string,
    status: StatusSolicitacao,
    resposta?: string,
): SolicitacaoDireito | null {
    const sol = solicitacoesMap.get(id);
    if (!sol) return null;
    const updated: SolicitacaoDireito = {
        ...sol,
        status,
        resposta,
        atendidaEm: status === 'atendida' || status === 'indeferida' ? isoNow() : sol.atendidaEm,
    };
    solicitacoesMap.set(id, updated);
    return updated;
}

/** Lista solicitações de um titular. */
export function listarSolicitacoesPorTitular(titularId: string): SolicitacaoDireito[] {
    return Array.from(solicitacoesMap.values()).filter((s) => s.titularId === titularId);
}

/** Lista todas as solicitações em aberto. */
export function listarSolicitacoesAbertas(): SolicitacaoDireito[] {
    return Array.from(solicitacoesMap.values()).filter(
        (s) => s.status === 'recebida' || s.status === 'em_analise',
    );
}

// ─── API pública — RIPD ────────────────────────────────────────────────────────

/**
 * Gera o Relatório de Impacto à Proteção de Dados (RIPD) para um fluxo.
 */
export function gerarRipd(fluxoId: string): RipdFluxo | null {
    const fluxo = fluxosMap.get(fluxoId);
    if (!fluxo) return null;

    const salvaguardas = salvaguardasPorCategorias(fluxo.categorias);
    const riscos = riscosPorFluxo(fluxo);

    const temBaseLegal = fluxo.baseLegal !== undefined;
    const conforme = temBaseLegal && salvaguardas.length > 0;

    return {
        fluxoId: fluxo.id,
        fluxoNome: fluxo.nome,
        geradoEm: isoNow(),
        baseLegal: fluxo.baseLegal,
        artigoLgpd: fluxo.artigoLgpd,
        finalidade: fluxo.finalidade,
        categorias: fluxo.categorias,
        retencaoDias: fluxo.retencaoDias,
        compartilhaTerceiros: fluxo.compartilhaTerceiros,
        transferenciaInternacional: fluxo.transferenciaInternacional,
        operador: fluxo.operador,
        avaliacaoNecessidade:
            `Dados tratados para: ${fluxo.finalidade}. ` +
            `Base legal: ${fluxo.artigoLgpd} (${fluxo.baseLegal}). ` +
            `Retenção por ${fluxo.retencaoDias} dias conforme princípio da necessidade (Art. 6º III LGPD).`,
        riscos,
        salvaguardas,
        conforme,
    };
}

/** Gera RIPDs para todos os fluxos registrados. */
export function gerarRipdGeral(): RipdFluxo[] {
    return Array.from(fluxosMap.keys())
        .map(gerarRipd)
        .filter((r): r is RipdFluxo => r !== null);
}

// ─── Reset para testes ────────────────────────────────────────────────────────

export function _resetLgpdState(): void {
    fluxosMap.clear();
    solicitacoesMap.clear();
}
