/**
 * LGPD Retenção, Classificação e Descarte (Item 40 – T1)
 *
 * Política formal de ciclo de vida de dados pessoais conforme:
 *   - Art. 15 LGPD — término do tratamento
 *   - Art. 16 LGPD — conservação após término (exceções)
 *   - NIST SP 800-88 Rev.1 — Guidelines for Media Sanitization
 *   - ISO/IEC 27001:2022 Annex A.8.10 — Information deletion
 *
 * Responsabilidades:
 *   - Registro de políticas de retenção por categoria/sistema
 *   - Classificação de dados por nível de sensibilidade
 *   - Agendamento e execução de eventos de descarte
 *   - Certificado de descarte NIST 800-88 (Clear/Purge/Destroy)
 *   - Trilha de auditoria de descartes realizados
 */

import { randomUUID, createHash } from 'crypto';

// ─── Enumerações ──────────────────────────────────────────────────────────────

/**
 * Nível de classificação do dado conforme sensibilidade regulatória.
 * Alinhado com LGPD + ISO/IEC 27001 Information Classification.
 */
export type NivelClassificacao =
    | 'publico'         // sem restrição de acesso
    | 'interno'         // uso interno, não pessoal
    | 'confidencial'    // dado pessoal (Art. 5º I LGPD)
    | 'restrito';       // dado sensível (Art. 5º II LGPD)

/**
 * Método de descarte conforme NIST SP 800-88 Rev.1.
 */
export type MetodoDescarte =
    | 'clear'    // NIST Clear — sobrescrita lógica (mídia reutilizável)
    | 'purge'    // NIST Purge — sobrescrita criptográfica ou degaussing
    | 'destroy'; // NIST Destroy — destruição física (shredding, disintegration)

/** Status do evento de descarte. */
export type StatusDescarte =
    | 'agendado'
    | 'em_execucao'
    | 'concluido'
    | 'cancelado';

/** Motivo legal para conservação após término do tratamento (Art. 16 LGPD). */
export type MotivoConservacao =
    | 'cumprimento_obrigacao_legal'  // Art. 16 I
    | 'estudo_pesquisa'              // Art. 16 II
    | 'transferencia_terceiros'      // Art. 16 III
    | 'uso_exclusivo_controlador'    // Art. 16 IV
    | 'exercicio_direitos';          // defesa em processo judicial/adm

// ─── Estruturas ───────────────────────────────────────────────────────────────

/** Política de retenção para uma categoria de dados em um sistema. */
export interface PoliticaRetencao {
    id: string;
    nome: string;
    descricao: string;
    /** Sistema ou serviço que trata os dados. */
    sistema: string;
    /** Categorias de dados cobertas. */
    categorias: string[];
    nivelClassificacao: NivelClassificacao;
    /** Prazo primário de retenção em dias (uso operacional). */
    retencaoOperacionalDias: number;
    /** Prazo de retenção legal (obrigação regulatória), se aplicável. */
    retencaoLegalDias?: number;
    /** Motivo de conservação além do tratamento, se aplicável (Art. 16). */
    motivoConservacao?: MotivoConservacao;
    /** Referência normativa para retenção legal, ex: "Lei 12.682/2012, Art. 7º". */
    embasamentoLegal?: string;
    /** Método de descarte a ser aplicado ao final do prazo. */
    metodoDescarte: MetodoDescarte;
    ativa: boolean;
    criadaEm: string;
    atualizadaEm: string;
}

/** Evento de descarte de dados — pode ser agendado ou imediato. */
export interface EventoDescarte {
    id: string;
    politicaId: string;
    politicaNome: string;
    sistema: string;
    categorias: string[];
    nivelClassificacao: NivelClassificacao;
    metodoDescarte: MetodoDescarte;
    status: StatusDescarte;
    /** Quantidade estimada de registros a descartar. */
    registrosEstimados: number;
    /** Quantidade efetivamente descartada (preenchido ao concluir). */
    registrosDescartados?: number;
    agendadoPara: string;
    iniciadoEm?: string;
    concluidoEm?: string;
    /** Identificador do operador/sistema que executou. */
    executadoPor?: string;
    /** Observação ou justificativa de cancelamento. */
    observacao?: string;
    criadoEm: string;
}

/** Certificado de descarte NIST 800-88 emitido após conclusão. */
export interface CertificadoDescarte {
    id: string;
    eventoDescarteId: string;
    sistema: string;
    categorias: string[];
    nivelClassificacao: NivelClassificacao;
    metodoDescarte: MetodoDescarte;
    /** Referência normativa NIST. */
    normaAplicada: string;
    registrosDescartados: number;
    executadoPor: string;
    dataExecucao: string;
    /** Hash SHA-256 do payload do certificado para rastreabilidade. */
    integrityHash: string;
}

// ─── Estado interno ───────────────────────────────────────────────────────────

const politicasMap = new Map<string, PoliticaRetencao>();
const eventosMap = new Map<string, EventoDescarte>();
const certificadosMap = new Map<string, CertificadoDescarte>();

function isoNow(): string {
    return new Date().toISOString();
}

// ─── Mapa NIST 800-88 por nível de classificação ─────────────────────────────

const NIST_RECOMENDADO: Record<NivelClassificacao, MetodoDescarte> = {
    publico: 'clear',
    interno: 'clear',
    confidencial: 'purge',
    restrito: 'destroy',
};

const NIST_NORMA_REF: Record<MetodoDescarte, string> = {
    clear: 'NIST SP 800-88 Rev.1 §2.3 — Clear (sobrescrita lógica)',
    purge: 'NIST SP 800-88 Rev.1 §2.4 — Purge (sobrescrita criptográfica / degaussing)',
    destroy: 'NIST SP 800-88 Rev.1 §2.5 — Destroy (destruição física irreversível)',
};

// ─── API pública — Políticas ──────────────────────────────────────────────────

/**
 * Cria ou registra uma política de retenção e descarte.
 */
export function criarPoliticaRetencao(input: {
    nome: string;
    descricao: string;
    sistema: string;
    categorias: string[];
    nivelClassificacao: NivelClassificacao;
    retencaoOperacionalDias: number;
    retencaoLegalDias?: number;
    motivoConservacao?: MotivoConservacao;
    embasamentoLegal?: string;
    metodoDescarte?: MetodoDescarte;
}): PoliticaRetencao {
    const id = randomUUID();
    const agora = isoNow();
    const politica: PoliticaRetencao = {
        id,
        nome: input.nome,
        descricao: input.descricao,
        sistema: input.sistema,
        categorias: input.categorias,
        nivelClassificacao: input.nivelClassificacao,
        retencaoOperacionalDias: input.retencaoOperacionalDias,
        retencaoLegalDias: input.retencaoLegalDias,
        motivoConservacao: input.motivoConservacao,
        embasamentoLegal: input.embasamentoLegal,
        metodoDescarte: input.metodoDescarte ?? NIST_RECOMENDADO[input.nivelClassificacao],
        ativa: true,
        criadaEm: agora,
        atualizadaEm: agora,
    };
    politicasMap.set(id, politica);
    return politica;
}

/** Retorna política pelo ID. */
export function obterPolitica(id: string): PoliticaRetencao | null {
    return politicasMap.get(id) ?? null;
}

/** Lista todas as políticas. */
export function listarPoliticas(): PoliticaRetencao[] {
    return Array.from(politicasMap.values());
}

/** Lista políticas ativas. */
export function listarPoliticasAtivas(): PoliticaRetencao[] {
    return Array.from(politicasMap.values()).filter((p) => p.ativa);
}

/** Desativa uma política (mantém histórico). */
export function desativarPolitica(id: string): PoliticaRetencao | null {
    const p = politicasMap.get(id);
    if (!p) return null;
    const updated: PoliticaRetencao = { ...p, ativa: false, atualizadaEm: isoNow() };
    politicasMap.set(id, updated);
    return updated;
}

/**
 * Retorna o método de descarte recomendado por NIST 800-88
 * para um dado nível de classificação.
 */
export function metodoDescarteRecomendado(nivel: NivelClassificacao): MetodoDescarte {
    return NIST_RECOMENDADO[nivel];
}

// ─── API pública — Eventos de descarte ───────────────────────────────────────

/**
 * Agenda um evento de descarte vinculado a uma política.
 */
export function agendarDescarte(input: {
    politicaId: string;
    registrosEstimados: number;
    agendadoPara: string;
    observacao?: string;
}): EventoDescarte | null {
    const politica = politicasMap.get(input.politicaId);
    if (!politica) return null;

    const id = randomUUID();
    const evento: EventoDescarte = {
        id,
        politicaId: politica.id,
        politicaNome: politica.nome,
        sistema: politica.sistema,
        categorias: politica.categorias,
        nivelClassificacao: politica.nivelClassificacao,
        metodoDescarte: politica.metodoDescarte,
        status: 'agendado',
        registrosEstimados: input.registrosEstimados,
        agendadoPara: input.agendadoPara,
        observacao: input.observacao,
        criadoEm: isoNow(),
    };
    eventosMap.set(id, evento);
    return evento;
}

/**
 * Inicia a execução de um evento de descarte agendado.
 */
export function iniciarDescarte(eventoId: string): EventoDescarte | null {
    const evento = eventosMap.get(eventoId);
    if (!evento || evento.status !== 'agendado') return null;
    const updated: EventoDescarte = {
        ...evento,
        status: 'em_execucao',
        iniciadoEm: isoNow(),
    };
    eventosMap.set(eventoId, updated);
    return updated;
}

/**
 * Conclui um evento de descarte e emite o certificado NIST 800-88.
 */
export function concluirDescarte(input: {
    eventoId: string;
    registrosDescartados: number;
    executadoPor: string;
    observacao?: string;
}): { evento: EventoDescarte; certificado: CertificadoDescarte } | null {
    const evento = eventosMap.get(input.eventoId);
    if (!evento || (evento.status !== 'em_execucao' && evento.status !== 'agendado')) return null;

    const agora = isoNow();
    const updatedEvento: EventoDescarte = {
        ...evento,
        status: 'concluido',
        registrosDescartados: input.registrosDescartados,
        executadoPor: input.executadoPor,
        concluidoEm: agora,
        iniciadoEm: evento.iniciadoEm ?? agora,
        observacao: input.observacao ?? evento.observacao,
    };
    eventosMap.set(input.eventoId, updatedEvento);

    // Emitir certificado
    const certPayload = {
        eventoDescarteId: input.eventoId,
        sistema: evento.sistema,
        categorias: evento.categorias,
        nivelClassificacao: evento.nivelClassificacao,
        metodoDescarte: evento.metodoDescarte,
        normaAplicada: NIST_NORMA_REF[evento.metodoDescarte],
        registrosDescartados: input.registrosDescartados,
        executadoPor: input.executadoPor,
        dataExecucao: agora,
    };

    const integrityHash: string = createHash('sha256')
        .update(JSON.stringify(certPayload))
        .digest('hex');

    const certificado: CertificadoDescarte = {
        id: randomUUID(),
        ...certPayload,
        integrityHash,
    };
    certificadosMap.set(certificado.id, certificado);

    return { evento: updatedEvento, certificado };
}

/** Cancela um evento de descarte agendado. */
export function cancelarDescarte(eventoId: string, motivo: string): EventoDescarte | null {
    const evento = eventosMap.get(eventoId);
    if (!evento || evento.status !== 'agendado') return null;
    const updated: EventoDescarte = {
        ...evento,
        status: 'cancelado',
        observacao: motivo,
    };
    eventosMap.set(eventoId, updated);
    return updated;
}

/** Lista todos os eventos de descarte. */
export function listarEventosDescarte(): EventoDescarte[] {
    return Array.from(eventosMap.values());
}

/** Lista eventos agendados com prazo vencido (não executados). */
export function listarDescartesPendentes(): EventoDescarte[] {
    const agora = new Date().getTime();
    return Array.from(eventosMap.values()).filter(
        (e) => e.status === 'agendado' && new Date(e.agendadoPara).getTime() <= agora,
    );
}

/** Lista certificados de descarte emitidos. */
export function listarCertificados(): CertificadoDescarte[] {
    return Array.from(certificadosMap.values());
}

/** Retorna certificado pelo ID. */
export function obterCertificado(id: string): CertificadoDescarte | null {
    return certificadosMap.get(id) ?? null;
}

// ─── Reset para testes ────────────────────────────────────────────────────────

export function _resetRetencaoState(): void {
    politicasMap.clear();
    eventosMap.clear();
    certificadosMap.clear();
}
