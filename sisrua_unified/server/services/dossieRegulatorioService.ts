/**
 * Dossiê Regulatório ANEEL — Cadeia de Custódia (Item 54 – T1)
 *
 * Gera e gerencia pacotes exportáveis de conformidade regulatória para
 * entregas BDGD/ANEEL, com:
 *
 *   - Registro imutável de eventos de validação BDGD (trilha de auditoria)
 *   - Digest SHA-256 de cada pacote (cadeia de custódia)
 *   - RIPD regulatório vinculado à entrega (proveniência técnica)
 *   - Exportação em JSON canônico assinável (norma ABNT NBR ISO/IEC 27037)
 *   - Rastreabilidade de ciclo: rascunho → validado → submetido → arquivado
 *
 * Referências normativas:
 *   - PRODIST Módulo 2 / REN ANEEL 956/2021 (BDGD)
 *   - Resolução Normativa ANEEL nº 1.000/2021 (Procedimentos de Distribuição)
 *   - ABNT NBR ISO/IEC 27037:2013 (preservação de evidência digital)
 *   - Lei 12.682/2012 (digitalização e armazenamento de documentos)
 */

import { createHash } from 'crypto';
import { randomUUID } from 'crypto';
import { type BdgdValidationReport, type BdgdLayerReport } from './bdgdValidatorService.js';

// ─── Enumerações ──────────────────────────────────────────────────────────────

/** Ciclo de vida do dossiê. */
export type StatusDossie =
    | 'rascunho'      // em preenchimento
    | 'validado'      // validação BDGD concluída e conforme
    | 'submetido'     // entregue à ANEEL (protocolo registrado)
    | 'arquivado';    // arquivamento definitivo pós-prazo

/** Tipo de evento registrado na trilha de auditoria. */
export type TipoEventoDossie =
    | 'criacao'
    | 'validacao_bdgd'
    | 'adicao_artefato'
    | 'atualizacao_status'
    | 'submissao_aneel'
    | 'arquivamento';

// ─── Tipos de artefatos ───────────────────────────────────────────────────────

/** Artefato individual incluído no dossiê (arquivo de entrega). */
export interface ArtefatoDossie {
    id: string;
    nome: string;
    tipo: 'shapefile' | 'gdb' | 'dxf' | 'csv' | 'relatorio' | 'outro';
    descricao: string;
    /** SHA-256 do conteúdo (hex). */
    sha256: string;
    /** Tamanho em bytes. */
    tamanhoBytes: number;
    /** Camadas BDGD cobertas por este artefato. */
    camadasCobertas: string[];
    adicionadoEm: string;
}

/** Evento imutável na trilha de auditoria do dossiê. */
export interface EventoAuditoriaDossie {
    id: string;
    tipo: TipoEventoDossie;
    descricao: string;
    autor: string;
    timestamp: string;
    /** SHA-256 do snapshot do dossiê no momento do evento. */
    snapshotHash: string;
    metadados?: Record<string, unknown>;
}

/** Relatório BDGD vinculado ao dossiê. */
export interface ValidacaoBdgdVinculada {
    /** Timestamp da execução da validação. */
    executadaEm: string;
    /** Camadas verificadas. */
    camadas: string[];
    totalRegistros: number;
    totalIssues: number;
    erros: number;
    avisos: number;
    conforme: boolean;
    /** Spec ANEEL utilizada. */
    aneelSpec: string;
    /** Resumo por camada. */
    resumoCamadas: Array<{
        camada: string;
        descricao: string;
        totalRegistros: number;
        validRecords: number;
        conforme: boolean;
        issues: number;
    }>;
}

// ─── Estrutura principal do dossiê ────────────────────────────────────────────

export interface DossieRegulatorio {
    id: string;
    /** Ciclo de referência da entrega, ex: "2026-T1". */
    cicloReferencia: string;
    /** Distribuidora responsável. */
    distribuidora: string;
    /** Código CNPJ da distribuidora. */
    cnpj: string;
    /** Responsável técnico pela entrega. */
    responsavelTecnico: string;
    /** Prazo regulatório de entrega (ANEEL). */
    prazoEntregaISO: string;
    status: StatusDossie;
    /** Validações BDGD vinculadas. */
    validacoesBdgd: ValidacaoBdgdVinculada[];
    /** Artefatos que compõem o pacote de entrega. */
    artefatos: ArtefatoDossie[];
    /** Trilha de auditoria imutável. */
    trilhaAuditoria: EventoAuditoriaDossie[];
    /** Protocolo ANEEL após submissão. */
    protocoloAneel?: string;
    /** SHA-256 do pacote final exportado. */
    hashPacoteFinal?: string;
    criadoEm: string;
    atualizadoEm: string;
}

/** Resumo do dossiê para listagem. */
export interface ResumoDossie {
    id: string;
    cicloReferencia: string;
    distribuidora: string;
    status: StatusDossie;
    totalArtefatos: number;
    totalValidacoes: number;
    conformeBdgd: boolean;
    prazoEntregaISO: string;
    dentroDosPrazo: boolean;
    criadoEm: string;
    atualizadoEm: string;
}

/** Pacote exportável do dossiê — payload canônico JSON para arquivamento. */
export interface PacoteExportavel {
    /** Versão do schema de exportação. */
    schemaVersion: string;
    exportadoEm: string;
    /** SHA-256 do conteúdo canônico (sem este campo). */
    integrityHash: string;
    dossie: DossieRegulatorio;
}

// ─── Estado interno ───────────────────────────────────────────────────────────

const dossiesMap = new Map<string, DossieRegulatorio>();

function isoNow(): string {
    return new Date().toISOString();
}

// ─── Helpers de integridade ───────────────────────────────────────────────────

/**
 * Calcula SHA-256 de uma string JSON canônica (chaves ordenadas).
 */
export function sha256Hex(content: string): string {
    return createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * Serializa objeto em JSON canônico (chaves ordenadas recursivamente).
 * Garante determinismo para hashing.
 */
export function canonicalJson(obj: unknown): string {
    return JSON.stringify(obj, (_key, value) => {
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
            return Object.keys(value as object)
                .sort()
                .reduce<Record<string, unknown>>((acc, k) => {
                    acc[k] = (value as Record<string, unknown>)[k];
                    return acc;
                }, {});
        }
        return value;
    });
}

/** Gera snapshot hash do estado atual do dossiê (sem trilha para evitar recursão). */
function snapshotHash(dossie: Omit<DossieRegulatorio, 'trilhaAuditoria'>): string {
    return sha256Hex(canonicalJson(dossie));
}

function registrarEvento(
    dossie: DossieRegulatorio,
    tipo: TipoEventoDossie,
    descricao: string,
    autor: string,
    metadados?: Record<string, unknown>,
): EventoAuditoriaDossie {
    const { trilhaAuditoria: _trail, ...dossieBase } = dossie;
    const evento: EventoAuditoriaDossie = {
        id: randomUUID(),
        tipo,
        descricao,
        autor,
        timestamp: isoNow(),
        snapshotHash: snapshotHash(dossieBase),
        metadados,
    };
    return evento;
}

// ─── Helpers de conformidade ──────────────────────────────────────────────────

function conformeBdgdGeral(dossie: DossieRegulatorio): boolean {
    if (dossie.validacoesBdgd.length === 0) return false;
    return dossie.validacoesBdgd.every((v) => v.conforme);
}

function dentroDosPrazo(dossie: DossieRegulatorio): boolean {
    if (dossie.status === 'submetido' || dossie.status === 'arquivado') return true;
    return new Date().getTime() <= new Date(dossie.prazoEntregaISO).getTime();
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Cria um novo dossiê regulatório para um ciclo de entrega ANEEL.
 */
export function criarDossie(input: {
    cicloReferencia: string;
    distribuidora: string;
    cnpj: string;
    responsavelTecnico: string;
    prazoEntregaISO: string;
    autor: string;
}): DossieRegulatorio {
    const id = randomUUID();
    const agora = isoNow();
    const base = {
        id,
        cicloReferencia: input.cicloReferencia,
        distribuidora: input.distribuidora,
        cnpj: input.cnpj,
        responsavelTecnico: input.responsavelTecnico,
        prazoEntregaISO: input.prazoEntregaISO,
        status: 'rascunho' as StatusDossie,
        validacoesBdgd: [] as ValidacaoBdgdVinculada[],
        artefatos: [] as ArtefatoDossie[],
        criadoEm: agora,
        atualizadoEm: agora,
    };
    const eventoInicial = registrarEvento(
        { ...base, trilhaAuditoria: [] },
        'criacao',
        `Dossiê criado para ciclo ${input.cicloReferencia} — distribuidora ${input.distribuidora}`,
        input.autor,
    );
    const dossie: DossieRegulatorio = { ...base, trilhaAuditoria: [eventoInicial] };
    dossiesMap.set(id, dossie);
    return dossie;
}

/** Retorna um dossiê pelo ID. */
export function obterDossie(id: string): DossieRegulatorio | null {
    return dossiesMap.get(id) ?? null;
}

/** Lista todos os dossiês. */
export function listarDossies(): DossieRegulatorio[] {
    return Array.from(dossiesMap.values());
}

/** Resumo de todos os dossiês para dashboard. */
export function resumoDossies(): ResumoDossie[] {
    return Array.from(dossiesMap.values()).map((d) => ({
        id: d.id,
        cicloReferencia: d.cicloReferencia,
        distribuidora: d.distribuidora,
        status: d.status,
        totalArtefatos: d.artefatos.length,
        totalValidacoes: d.validacoesBdgd.length,
        conformeBdgd: conformeBdgdGeral(d),
        prazoEntregaISO: d.prazoEntregaISO,
        dentroDosPrazo: dentroDosPrazo(d),
        criadoEm: d.criadoEm,
        atualizadoEm: d.atualizadoEm,
    }));
}

/**
 * Vincula um relatório de validação BDGD (resultado de `buildBdgdValidationReport`)
 * ao dossiê, registrando evento na trilha de auditoria.
 */
export function vincularValidacaoBdgd(
    dossieId: string,
    report: BdgdValidationReport,
    autor: string,
): DossieRegulatorio | null {
    const dossie = dossiesMap.get(dossieId);
    if (!dossie) return null;

    const vinculada: ValidacaoBdgdVinculada = {
        executadaEm: report.generatedAt,
        camadas: report.layers.map((l: BdgdLayerReport) => l.layer),
        totalRegistros: report.totals.totalRecords,
        totalIssues: report.totals.totalIssues,
        erros: report.totals.errors,
        avisos: report.totals.warnings,
        conforme: report.conformant,
        aneelSpec: report.aneelSpec,
        resumoCamadas: report.layers.map((l: BdgdLayerReport) => ({
            camada: l.layer,
            descricao: l.description,
            totalRegistros: l.totalRecords,
            validRecords: l.validRecords,
            conforme: l.conformant,
            issues: l.issues.length,
        })),
    };

    const novasValidacoes = [...dossie.validacoesBdgd, vinculada];
    const agora = isoNow();
    const updated: DossieRegulatorio = {
        ...dossie,
        validacoesBdgd: novasValidacoes,
        status: (dossie.status === 'rascunho' && report.conformant) ? 'validado' : dossie.status,
        atualizadoEm: agora,
    };

    const evento = registrarEvento(
        updated,
        'validacao_bdgd',
        `Validação BDGD vinculada — ${report.layers.length} camada(s), ` +
        `${report.totals.totalRecords} registros, conforme=${report.conformant}`,
        autor,
        { aneelSpec: report.aneelSpec, conforme: report.conformant },
    );
    updated.trilhaAuditoria = [...dossie.trilhaAuditoria, evento];

    dossiesMap.set(dossieId, updated);
    return updated;
}

/**
 * Adiciona um artefato ao dossiê.
 * O SHA-256 é calculado sobre o conteúdo informado (string ou Buffer).
 */
export function adicionarArtefato(
    dossieId: string,
    input: {
        nome: string;
        tipo: ArtefatoDossie['tipo'];
        descricao: string;
        conteudo: string | Buffer;
        camadasCobertas: string[];
    },
    autor: string,
): DossieRegulatorio | null {
    const dossie = dossiesMap.get(dossieId);
    if (!dossie) return null;

    const conteudo = typeof input.conteudo === 'string'
        ? Buffer.from(input.conteudo, 'utf8')
        : input.conteudo;

    const artefato: ArtefatoDossie = {
        id: randomUUID(),
        nome: input.nome,
        tipo: input.tipo,
        descricao: input.descricao,
        sha256: createHash('sha256').update(conteudo).digest('hex'),
        tamanhoBytes: conteudo.length,
        camadasCobertas: input.camadasCobertas,
        adicionadoEm: isoNow(),
    };

    const updated: DossieRegulatorio = {
        ...dossie,
        artefatos: [...dossie.artefatos, artefato],
        atualizadoEm: isoNow(),
    };

    const evento = registrarEvento(
        updated,
        'adicao_artefato',
        `Artefato adicionado: "${artefato.nome}" (${artefato.tipo}, ${artefato.tamanhoBytes} bytes, SHA-256=${artefato.sha256.slice(0, 12)}…)`,
        autor,
        { artefatoId: artefato.id, sha256: artefato.sha256 },
    );
    updated.trilhaAuditoria = [...dossie.trilhaAuditoria, evento];

    dossiesMap.set(dossieId, updated);
    return updated;
}

/**
 * Registra a submissão do dossiê à ANEEL com número de protocolo.
 */
export function registrarSubmissao(
    dossieId: string,
    protocoloAneel: string,
    autor: string,
): DossieRegulatorio | null {
    const dossie = dossiesMap.get(dossieId);
    if (!dossie) return null;

    const updated: DossieRegulatorio = {
        ...dossie,
        status: 'submetido',
        protocoloAneel,
        atualizadoEm: isoNow(),
    };

    const evento = registrarEvento(
        updated,
        'submissao_aneel',
        `Dossiê submetido à ANEEL — Protocolo: ${protocoloAneel}`,
        autor,
        { protocoloAneel },
    );
    updated.trilhaAuditoria = [...dossie.trilhaAuditoria, evento];

    dossiesMap.set(dossieId, updated);
    return updated;
}

/**
 * Arquiva o dossiê (encerramento definitivo do ciclo).
 */
export function arquivarDossie(
    dossieId: string,
    autor: string,
): DossieRegulatorio | null {
    const dossie = dossiesMap.get(dossieId);
    if (!dossie) return null;

    const updated: DossieRegulatorio = {
        ...dossie,
        status: 'arquivado',
        atualizadoEm: isoNow(),
    };

    const evento = registrarEvento(
        updated,
        'arquivamento',
        `Dossiê arquivado definitivamente — ciclo ${dossie.cicloReferencia}`,
        autor,
    );
    updated.trilhaAuditoria = [...dossie.trilhaAuditoria, evento];

    dossiesMap.set(dossieId, updated);
    return updated;
}

/**
 * Exporta o dossiê como pacote canônico JSON com hash de integridade SHA-256.
 *
 * O campo `integrityHash` é o SHA-256 do JSON canônico do dossiê completo
 * (sem o próprio campo integrityHash), garantindo verificabilidade.
 */
export function exportarPacote(dossieId: string): PacoteExportavel | null {
    const dossie = dossiesMap.get(dossieId);
    if (!dossie) return null;

    const payload = {
        schemaVersion: '1.0',
        exportadoEm: isoNow(),
        dossie,
    };

    // Hash sobre o payload sem o campo integrityHash
    const integrityHash = sha256Hex(canonicalJson(payload));

    const pacote: PacoteExportavel = {
        ...payload,
        integrityHash,
    };

    // Registrar hash final no dossiê
    const updatedDossie: DossieRegulatorio = {
        ...dossie,
        hashPacoteFinal: integrityHash,
        atualizadoEm: isoNow(),
    };
    dossiesMap.set(dossieId, updatedDossie);

    return pacote;
}

/**
 * Verifica a integridade de um pacote exportado recalculando o hash.
 */
export function verificarIntegridadePacote(pacote: PacoteExportavel): boolean {
    const { integrityHash, ...payload } = pacote;
    const recalculado = sha256Hex(canonicalJson(payload));
    return recalculado === integrityHash;
}

// ─── Reset para testes ────────────────────────────────────────────────────────

export function _resetDossieState(): void {
    dossiesMap.clear();
}
