/**
 * LGPD Residência de Dados Brasil (Item 41 – T1)
 *
 * Garantia de soberania e residência de dados pessoais em território nacional,
 * conforme:
 *   - Art. 33 LGPD — transferência internacional de dados pessoais
 *   - Art. 34 LGPD — transferência para países com grau de proteção adequado
 *   - Resolução CD/ANPD nº 19/2024 — requisitos de transferência internacional
 *   - Marco Civil da Internet (Lei 12.965/2014) Art. 11 — dados de brasileiros
 *
 * Responsabilidades:
 *   - Registro de localizações de armazenamento de cada sistema/serviço
 *   - Validação de conformidade (dados pessoais ≠ armazenamento fora do Brasil
 *     sem base legal de transferência internacional)
 *   - Inventário de infraestrutura com região e provedor
 *   - Relatório de conformidade de residência por sistema
 */

import { randomUUID } from 'crypto';

// ─── Enumerações ──────────────────────────────────────────────────────────────

/** País/região de armazenamento. */
export type PaisArmazenamento =
    | 'BR'   // Brasil
    | 'US'   // Estados Unidos
    | 'EU'   // União Europeia (coletivo)
    | 'DE'   // Alemanha
    | 'IE'   // Irlanda
    | 'NL'   // Países Baixos
    | 'CA'   // Canadá
    | 'GB'   // Reino Unido
    | 'JP'   // Japão
    | 'AU'   // Austrália
    | 'outro';

/** Provedores de infraestrutura. */
export type ProvedorCloud =
    | 'aws'
    | 'azure'
    | 'gcp'
    | 'oracle_cloud'
    | 'digitalocean'
    | 'linode'
    | 'local_datacenter'
    | 'outro';

/** Base legal para transferência internacional (Art. 33 LGPD). */
export type BaseLegalTransferencia =
    | 'pais_adequado'          // Art. 33 I — país com grau de proteção adequado (ANPD)
    | 'garantias_adequadas'    // Art. 33 II — cláusulas contratuais padrão, BCR
    | 'cooperacao_juridica'    // Art. 33 III — cooperação jurídica internacional
    | 'vida_protecao'          // Art. 33 IV — proteção de vida
    | 'consentimento'          // Art. 33 V — consentimento específico
    | 'execucao_contrato'      // Art. 33 VI — execução de contrato
    | 'exercicio_direitos'     // Art. 33 VII — exercício regular de direitos
    | 'nenhuma';               // sem base legal (não conforme)

/** Status de conformidade de residência. */
export type StatusResidencia = 'conforme' | 'nao_conforme' | 'sob_analise';

// ─── Estruturas ───────────────────────────────────────────────────────────────

/** Localização de infraestrutura onde dados são armazenados. */
export interface LocalizacaoDados {
    id: string;
    sistema: string;
    descricao: string;
    provedor: ProvedorCloud;
    /** Identificador da região no provedor (ex: "sa-east-1", "brazilsouth"). */
    regiaoProvedor: string;
    pais: PaisArmazenamento;
    /** Contém dados pessoais de titulares brasileiros? */
    contemDadosPessoais: boolean;
    /** Categorias de dados armazenados nessa localização. */
    categorias: string[];
    /** Se fora do Brasil: base legal da transferência internacional. */
    baseLegalTransferencia?: BaseLegalTransferencia;
    /** Referência ao contrato DPA / BCR / cláusula, se aplicável. */
    referenciaContratual?: string;
    registradaEm: string;
    atualizadaEm: string;
}

/** Resultado da verificação de conformidade de residência para um sistema. */
export interface ConformidadeResidencia {
    sistema: string;
    localizacoes: LocalizacaoDados[];
    totalLocalizacoes: number;
    localizacoesBrasil: number;
    localizacoesForaDoBrasil: number;
    /** Localizações fora do Brasil com dados pessoais e SEM base legal. */
    violacoes: LocalizacaoDados[];
    status: StatusResidencia;
    geradoEm: string;
}

/** Relatório geral de residência de dados de todos os sistemas. */
export interface RelatorioResidenciaGeral {
    geradoEm: string;
    totalSistemas: number;
    sistemasConformes: number;
    sistemasNaoConformes: number;
    sistemasEmAnalise: number;
    totalLocalizacoes: number;
    localizacoesBrasil: number;
    localizacoesForaDoBrasil: number;
    totalViolacoes: number;
    conformeGeral: boolean;
    sistemas: ConformidadeResidencia[];
}

// ─── Estado interno ───────────────────────────────────────────────────────────

const localizacoesMap = new Map<string, LocalizacaoDados>();

function isoNow(): string {
    return new Date().toISOString();
}

// ─── Países com adequação reconhecida pela ANPD (lista indicativa 2026) ───────
// Fonte: Resolução CD/ANPD nº 19/2024 e decisões de adequação UE aplicadas por analogia

const PAISES_ADEQUADOS: Set<PaisArmazenamento> = new Set([
    'EU', 'DE', 'IE', 'NL', 'CA', 'GB', 'JP',
]);

/**
 * Verifica se um país tem grau de proteção adequado reconhecido.
 */
export function paisTemAdequacaoReconhecida(pais: PaisArmazenamento): boolean {
    return PAISES_ADEQUADOS.has(pais);
}

// ─── API pública — Localizações ───────────────────────────────────────────────

/**
 * Registra uma localização de armazenamento de dados para um sistema.
 */
export function registrarLocalizacao(input: {
    sistema: string;
    descricao: string;
    provedor: ProvedorCloud;
    regiaoProvedor: string;
    pais: PaisArmazenamento;
    contemDadosPessoais: boolean;
    categorias: string[];
    baseLegalTransferencia?: BaseLegalTransferencia;
    referenciaContratual?: string;
}): LocalizacaoDados {
    const id = randomUUID();
    const agora = isoNow();
    const loc: LocalizacaoDados = {
        id,
        sistema: input.sistema,
        descricao: input.descricao,
        provedor: input.provedor,
        regiaoProvedor: input.regiaoProvedor,
        pais: input.pais,
        contemDadosPessoais: input.contemDadosPessoais,
        categorias: input.categorias,
        baseLegalTransferencia: input.baseLegalTransferencia,
        referenciaContratual: input.referenciaContratual,
        registradaEm: agora,
        atualizadaEm: agora,
    };
    localizacoesMap.set(id, loc);
    return loc;
}

/** Retorna localização pelo ID. */
export function obterLocalizacao(id: string): LocalizacaoDados | null {
    return localizacoesMap.get(id) ?? null;
}

/** Lista todas as localizações. */
export function listarLocalizacoes(): LocalizacaoDados[] {
    return Array.from(localizacoesMap.values());
}

/** Lista localizações de um sistema específico. */
export function listarLocalizacoesPorSistema(sistema: string): LocalizacaoDados[] {
    return Array.from(localizacoesMap.values()).filter((l) => l.sistema === sistema);
}

/** Remove uma localização. */
export function removerLocalizacao(id: string): boolean {
    return localizacoesMap.delete(id);
}

// ─── Conformidade por sistema ─────────────────────────────────────────────────

/**
 * Verifica se uma localização com dados pessoais fora do Brasil é não conforme.
 * É não conforme quando:
 *   - País ≠ BR
 *   - Contém dados pessoais
 *   - Base legal é 'nenhuma' ou não informada
 */
function isViolacao(loc: LocalizacaoDados): boolean {
    if (loc.pais === 'BR') return false;
    if (!loc.contemDadosPessoais) return false;
    return !loc.baseLegalTransferencia || loc.baseLegalTransferencia === 'nenhuma';
}

/**
 * Verifica conformidade de residência de dados para um sistema específico.
 */
export function verificarConformidadeSistema(sistema: string): ConformidadeResidencia {
    const locs = listarLocalizacoesPorSistema(sistema);
    const fora = locs.filter((l) => l.pais !== 'BR');
    const brasil = locs.filter((l) => l.pais === 'BR');
    const violacoes = locs.filter(isViolacao);

    let status: StatusResidencia;
    if (violacoes.length > 0) {
        status = 'nao_conforme';
    } else if (fora.some((l) => l.contemDadosPessoais && l.baseLegalTransferencia !== 'nenhuma')) {
        status = 'sob_analise'; // tem base legal mas merece revisão
    } else {
        status = 'conforme';
    }

    return {
        sistema,
        localizacoes: locs,
        totalLocalizacoes: locs.length,
        localizacoesBrasil: brasil.length,
        localizacoesForaDoBrasil: fora.length,
        violacoes,
        status,
        geradoEm: isoNow(),
    };
}

/**
 * Gera relatório geral de residência de dados para todos os sistemas registrados.
 */
export function gerarRelatorioResidencia(): RelatorioResidenciaGeral {
    // Agrupa por sistema
    const sistemas = Array.from(
        new Set(Array.from(localizacoesMap.values()).map((l) => l.sistema)),
    );

    const conformidades = sistemas.map(verificarConformidadeSistema);

    const all = Array.from(localizacoesMap.values());

    return {
        geradoEm: isoNow(),
        totalSistemas: sistemas.length,
        sistemasConformes: conformidades.filter((c) => c.status === 'conforme').length,
        sistemasNaoConformes: conformidades.filter((c) => c.status === 'nao_conforme').length,
        sistemasEmAnalise: conformidades.filter((c) => c.status === 'sob_analise').length,
        totalLocalizacoes: all.length,
        localizacoesBrasil: all.filter((l) => l.pais === 'BR').length,
        localizacoesForaDoBrasil: all.filter((l) => l.pais !== 'BR').length,
        totalViolacoes: conformidades.reduce((sum, c) => sum + c.violacoes.length, 0),
        conformeGeral: conformidades.every((c) => c.status !== 'nao_conforme'),
        sistemas: conformidades,
    };
}

// ─── Reset para testes ────────────────────────────────────────────────────────

export function _resetResidenciaState(): void {
    localizacoesMap.clear();
}
