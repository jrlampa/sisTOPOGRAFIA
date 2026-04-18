/**
 * LGPD Incident Playbook Service — Playbook de Incidentes Regulatórios (Item 39 – T1)
 *
 * Fluxo formal de resposta a incidentes com dados pessoais conforme:
 *   - Art. 48 LGPD — Notificação obrigatória à ANPD em 72h
 *   - Resolução CD/ANPD nº 4/2023 — prazo e conteúdo da notificação
 *
 * Etapas do playbook:
 *   1. Detecção e triagem
 *   2. Contenção imediata
 *   3. Avaliação de impacto (titulares afetados, categorias envolvidas)
 *   4. Notificação à ANPD (≤ 72h a partir da ciência)
 *   5. Comunicação aos titulares afetados
 *   6. Remediação e lições aprendidas
 */

import { randomUUID } from 'crypto';

// ─── Tipos de incidente ───────────────────────────────────────────────────────

export type TipoIncidente =
    | 'acesso_nao_autorizado'
    | 'divulgacao_indevida'
    | 'alteracao_nao_autorizada'
    | 'perda_destruicao'
    | 'ransomware'
    | 'phishing'
    | 'vazamento_interno'
    | 'outro';

export type SeveridadeIncidente = 'baixa' | 'media' | 'alta' | 'critica';

export type StatusIncidente =
    | 'detectado'
    | 'em_contencao'
    | 'contido'
    | 'notificado_anpd'
    | 'titulares_comunicados'
    | 'encerrado';

export type EtapaPlaybook =
    | 'deteccao_triagem'
    | 'contencao_imediata'
    | 'avaliacao_impacto'
    | 'notificacao_anpd'
    | 'comunicacao_titulares'
    | 'remediacao_licoes';

// ─── Estruturas ───────────────────────────────────────────────────────────────

export interface AcaoPlaybook {
    etapa: EtapaPlaybook;
    descricao: string;
    responsavel: string;
    prazoHoras: number;
    concluida: boolean;
    concluidaEm?: string;
    evidencia?: string;
}

export interface IncidenteLgpd {
    id: string;
    titulo: string;
    tipo: TipoIncidente;
    severidade: SeveridadeIncidente;
    status: StatusIncidente;
    /** Quantos titulares potencialmente afetados. */
    titularesAfetadosEstimado: number;
    /** Categorias de dados envolvidas. */
    categoriasEnvolvidas: string[];
    descricao: string;
    detectadoEm: string;
    /** Prazo ANPD: 72h após ciência (Art. 48 LGPD). */
    prazoNotificacaoAnpdISO: string;
    /** Notificação enviada à ANPD? */
    notificacaoAnpdEnviada: boolean;
    notificacaoAnpdEnviadaEm?: string;
    /** Titulares comunicados? */
    titularesComunicados: boolean;
    acoes: AcaoPlaybook[];
    encerradoEm?: string;
}

export interface ResumoIncidente {
    id: string;
    titulo: string;
    tipo: TipoIncidente;
    severidade: SeveridadeIncidente;
    status: StatusIncidente;
    detectadoEm: string;
    prazoAnpdISO: string;
    dentroDosPrazo: boolean;
    notificacaoAnpdEnviada: boolean;
}

// ─── Estado interno ───────────────────────────────────────────────────────────

const incidentesMap = new Map<string, IncidenteLgpd>();

const PRAZO_ANPD_HORAS = 72;

function isoNow(): string {
    return new Date().toISOString();
}

function calcularPrazoAnpd(detectadoEm: string): string {
    const d = new Date(detectadoEm);
    d.setHours(d.getHours() + PRAZO_ANPD_HORAS);
    return d.toISOString();
}

// ─── Geração do playbook de ações ────────────────────────────────────────────

function gerarAcoes(severidade: SeveridadeIncidente): AcaoPlaybook[] {
    const prazoContencao = severidade === 'critica' ? 2 : severidade === 'alta' ? 4 : 8;
    return [
        {
            etapa: 'deteccao_triagem',
            descricao: 'Confirmar o incidente, classificar tipo e severidade, acionar CISO/DPO.',
            responsavel: 'DPO / Equipe de Segurança',
            prazoHoras: 1,
            concluida: false,
        },
        {
            etapa: 'contencao_imediata',
            descricao: 'Isolar sistemas afetados, revogar acessos comprometidos, preservar evidências forenses.',
            responsavel: 'Equipe de Infraestrutura / DevOps',
            prazoHoras: prazoContencao,
            concluida: false,
        },
        {
            etapa: 'avaliacao_impacto',
            descricao: 'Quantificar titulares afetados, identificar categorias de dados, avaliar danos potenciais.',
            responsavel: 'DPO / Jurídico',
            prazoHoras: 24,
            concluida: false,
        },
        {
            etapa: 'notificacao_anpd',
            descricao: `Notificar ANPD via portal gov.br (prazo: ${PRAZO_ANPD_HORAS}h da ciência — Art. 48 LGPD + Res. CD/ANPD nº 4/2023). ` +
                'Incluir: natureza dos dados, categorias, titulares afetados, medidas adotadas.',
            responsavel: 'DPO / Jurídico',
            prazoHoras: PRAZO_ANPD_HORAS,
            concluida: false,
        },
        {
            etapa: 'comunicacao_titulares',
            descricao: 'Comunicar titulares afetados com linguagem clara sobre o incidente, dados envolvidos e medidas de proteção adotadas.',
            responsavel: 'DPO / Comunicação',
            prazoHoras: 168, // 7 dias
            concluida: false,
        },
        {
            etapa: 'remediacao_licoes',
            descricao: 'Corrigir vulnerabilidade raiz, atualizar controles, documentar lições aprendidas, revisar RIPD do fluxo afetado.',
            responsavel: 'Equipe de Engenharia / DPO',
            prazoHoras: 720, // 30 dias
            concluida: false,
        },
    ];
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Registra um novo incidente e gera automaticamente o playbook de ações.
 */
export function registrarIncidente(input: {
    titulo: string;
    tipo: TipoIncidente;
    severidade: SeveridadeIncidente;
    titularesAfetadosEstimado: number;
    categoriasEnvolvidas: string[];
    descricao: string;
}): IncidenteLgpd {
    const id = randomUUID();
    const detectadoEm = isoNow();
    const incidente: IncidenteLgpd = {
        id,
        titulo: input.titulo,
        tipo: input.tipo,
        severidade: input.severidade,
        status: 'detectado',
        titularesAfetadosEstimado: input.titularesAfetadosEstimado,
        categoriasEnvolvidas: input.categoriasEnvolvidas,
        descricao: input.descricao,
        detectadoEm,
        prazoNotificacaoAnpdISO: calcularPrazoAnpd(detectadoEm),
        notificacaoAnpdEnviada: false,
        titularesComunicados: false,
        acoes: gerarAcoes(input.severidade),
    };
    incidentesMap.set(id, incidente);
    return incidente;
}

/**
 * Conclui uma etapa do playbook registrando evidência.
 */
export function concluirEtapa(
    incidenteId: string,
    etapa: EtapaPlaybook,
    evidencia?: string,
): IncidenteLgpd | null {
    const inc = incidentesMap.get(incidenteId);
    if (!inc) return null;

    const acoes = inc.acoes.map((a) =>
        a.etapa === etapa
            ? { ...a, concluida: true, concluidaEm: isoNow(), evidencia }
            : a,
    );

    // Atualizar status do incidente com base na última etapa concluída
    let status: StatusIncidente = inc.status;
    if (etapa === 'contencao_imediata') status = 'contido';
    if (etapa === 'notificacao_anpd') status = 'notificado_anpd';
    if (etapa === 'comunicacao_titulares') status = 'titulares_comunicados';
    if (etapa === 'remediacao_licoes') status = 'encerrado';

    const updated: IncidenteLgpd = {
        ...inc,
        acoes,
        status,
        notificacaoAnpdEnviada: etapa === 'notificacao_anpd' ? true : inc.notificacaoAnpdEnviada,
        notificacaoAnpdEnviadaEm:
            etapa === 'notificacao_anpd' ? isoNow() : inc.notificacaoAnpdEnviadaEm,
        titularesComunicados:
            etapa === 'comunicacao_titulares' ? true : inc.titularesComunicados,
        encerradoEm: etapa === 'remediacao_licoes' ? isoNow() : inc.encerradoEm,
    };

    incidentesMap.set(incidenteId, updated);
    return updated;
}

/** Retorna um incidente pelo ID. */
export function obterIncidente(id: string): IncidenteLgpd | null {
    return incidentesMap.get(id) ?? null;
}

/** Lista todos os incidentes. */
export function listarIncidentes(): IncidenteLgpd[] {
    return Array.from(incidentesMap.values());
}

/** Lista incidentes não encerrados. */
export function listarIncidentesAbertos(): IncidenteLgpd[] {
    return Array.from(incidentesMap.values()).filter((i) => i.status !== 'encerrado');
}

/** Resumo de todos os incidentes para dashboard. */
export function resumoIncidentes(): ResumoIncidente[] {
    return Array.from(incidentesMap.values()).map((i) => ({
        id: i.id,
        titulo: i.titulo,
        tipo: i.tipo,
        severidade: i.severidade,
        status: i.status,
        detectadoEm: i.detectadoEm,
        prazoAnpdISO: i.prazoNotificacaoAnpdISO,
        dentroDosPrazo:
            i.notificacaoAnpdEnviada
                ? new Date(i.notificacaoAnpdEnviadaEm!).getTime() <=
                  new Date(i.prazoNotificacaoAnpdISO).getTime()
                : new Date().getTime() < new Date(i.prazoNotificacaoAnpdISO).getTime(),
        notificacaoAnpdEnviada: i.notificacaoAnpdEnviada,
    }));
}

/** Verifica incidentes com prazo ANPD vencido e não notificados. */
export function verificarPrazosVencidos(): ResumoIncidente[] {
    const agora = new Date().getTime();
    return resumoIncidentes().filter(
        (r) => !r.notificacaoAnpdEnviada && agora > new Date(r.prazoAnpdISO).getTime(),
    );
}

// ─── Reset para testes ────────────────────────────────────────────────────────

export function _resetIncidentesState(): void {
    incidentesMap.clear();
}
