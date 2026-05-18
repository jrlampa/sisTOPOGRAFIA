/**
 * Serviço T2-56 / T3-134 — Edição Colaborativa em Tempo Real
 * Suporte para edição simultânea geoespacial multicanal via Supabase.
 */

import { getSupabaseAdminClient } from './supabaseAdminService.js';
import { logger } from '../utils/logger.js';

const adminDb = () => getSupabaseAdminClient();

type SessaoRow = {
  id: string;
  tenant_id: string;
  projeto_id: string;
  nome_projeto: string;
  responsavel_id: string;
  status: StatusSessao;
  versao_atual: number;
  created_at: string;
  updated_at: string;
};

type SessaoStatusRow = {
  versao_atual: number;
  status: StatusSessao;
};

type OperacaoHistoryRow = {
  id: string;
  sessao_id: string;
  usuario_id: string | null;
  tipo_operacao: TipoOperacao;
  payload: Record<string, unknown>;
  versao_base: number;
  versao_resultante: number;
  conflito: boolean;
};

export interface ParticipanteSessao {
  id: string;
  nome?: string;
  papel: PapelParticipante;
  status: 'ativo' | 'inativo';
  entradaEm?: string;
  saidaEm?: string;
}

type SessaoStore = SessaoColaborativa & {
  participantes: ParticipanteSessao[];
};

export interface OperacaoColaborativa {
  id: string;
  sessaoId: string;
  usuarioId?: string;
  tipoOperacao: TipoOperacao;
  payload: Record<string, unknown>;
  versaoBase: number;
  versaoResultante: number;
  versao_resultante?: number; // Compatibilidade legada
  conflito: boolean;
}

export type PapelParticipante = 'editor' | 'revisor' | 'observador';
type StatusSessao = 'aberta' | 'bloqueada' | 'encerrada';
export type TipoOperacao =
  | 'adicionar_ponto'
  | 'mover_ponto'
  | 'remover_ponto'
  | 'adicionar_trecho'
  | 'remover_trecho'
  | 'editar_atributo'
  | 'comentar';

export interface SessaoColaborativa {
  id: string;
  tenantId: string;
  projetoId: string;
  nomeProjeto: string;
  responsavelId: string;
  status: StatusSessao;
  versaoAtual: number;
  criadoEm: string;
  atualizadoEm: string;
  participantes?: ParticipanteSessao[]; // Para compatibilidade com testes legados
}

// In-memory store para testes e fallback de resiliência
let inMemorySessoes: Map<string, SessaoStore> = new Map();
let _inMemoryOps: Map<string, OperacaoColaborativa[]> = new Map();

export class EdicaoColaborativaService {
  /**
   * Reseta o estado em memória (uso interno para testes).
   */
  static _reset(): void {
    inMemorySessoes = new Map();
    _inMemoryOps = new Map();
  }

  /**
   * Cria uma nova sessão colaborativa.
   */
  static async criarSessao(data: {
    tenantId: string;
    projetoId: string;
    nomeProjeto: string;
    responsavelId?: string;
    responsavel?: string; // Legado para testes
  }): Promise<SessaoColaborativa> {
    const client = adminDb();

    if (!client) {
      const id = `sc-${inMemorySessoes.size + 1}`;
      const sessao: SessaoStore = {
        id,
        tenantId: data.tenantId,
        projetoId: data.projetoId,
        nomeProjeto: data.nomeProjeto,
        responsavelId: data.responsavelId || 'test-user',
        status: 'aberta',
        versaoAtual: 0,
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
        participantes: [],
      };
      inMemorySessoes.set(id, sessao);
      return sessao;
    }

    const sessionsTable = client.from('collaboration_sessions') as unknown as {
      insert: (values: Record<string, unknown>) => {
        select: () => {
          single: () => Promise<{ data: SessaoRow | null; error: { message: string } | null }>;
        };
      };
    };

    const { data: sessao, error } = await sessionsTable
      .insert({
        tenant_id: data.tenantId,
        projeto_id: data.projetoId,
        nome_projeto: data.nomeProjeto,
        responsavel_id: data.responsavelId || data.responsavel || 'system',
        status: 'aberta',
        versao_atual: 0,
      })
      .select()
      .single();

    if (error || !sessao) {
      logger.error('[Colaborativa] Erro ao criar sessão', error);
      throw new Error(error?.message || 'Falha ao criar sessão colaborativa');
    }

    return {
      id: sessao.id,
      tenantId: sessao.tenant_id,
      projetoId: sessao.projeto_id,
      nomeProjeto: sessao.nome_projeto,
      responsavelId: sessao.responsavel_id,
      status: sessao.status,
      versaoAtual: sessao.versao_atual,
      criadoEm: sessao.created_at,
      atualizadoEm: sessao.updated_at,
    };
  }

  /**
   * Lista sessões ativas por tenant.
   */
  static async listarSessoes(tenantId?: string): Promise<SessaoColaborativa[]> {
    const client = adminDb();

    if (!client) {
      const all = Array.from(inMemorySessoes.values());
      return tenantId ? all.filter(s => s.tenantId === tenantId) : all;
    }

    const sessionsTable = client.from('collaboration_sessions') as unknown as {
      select: (columns: string) => {
        eq: (
          column: string,
          value: string
        ) => Promise<{ data: SessaoRow[] | null; error: { message: string } | null }>;
      } & Promise<{ data: SessaoRow[] | null; error: { message: string } | null }>;
    };

    const { data, error } = tenantId
      ? await sessionsTable.select('*').eq('tenant_id', tenantId)
      : await sessionsTable.select('*');
    if (error) throw new Error(error.message);

    const rows = data || [];

    return rows.map(s => ({
      id: s.id,
      tenantId: s.tenant_id,
      projetoId: s.projeto_id,
      nomeProjeto: s.nome_projeto,
      responsavelId: s.responsavel_id,
      status: s.status,
      versaoAtual: s.versao_atual,
      criadoEm: s.created_at,
      atualizadoEm: s.updated_at,
    }));
  }

  /**
   * Registra uma operação atômica e atualiza a versão da sessão.
   */
  static async registrarOperacao(
    sessaoId: string,
    data: {
      usuarioId?: string;
      participanteId?: string; // Legado para testes
      tipoOperacao: TipoOperacao;
      payload: Record<string, unknown>;
      versaoBase: number;
    }
  ): Promise<OperacaoColaborativa> {
    const client = adminDb();

    if (!client) {
      const sessao = inMemorySessoes.get(sessaoId);
      if (!sessao) throw new Error('Sessão não encontrada');

      const partId = data.usuarioId || data.participanteId;
      const participante = (sessao.participantes || []).find(p => p.id === partId);
      if (participante && participante.papel === 'observador') {
        throw new Error('Observadores não podem registrar operações');
      }

      const conflito = data.versaoBase < sessao.versaoAtual;
      sessao.versaoAtual += 1;

      const op: OperacaoColaborativa = {
        id: `op-${Date.now()}`,
        sessaoId,
        usuarioId: partId,
        tipoOperacao: data.tipoOperacao,
        payload: data.payload,
        versaoBase: data.versaoBase,
        versaoResultante: sessao.versaoAtual,
        conflito,
      };

      return op;
    }

    const sessionsTable = client.from('collaboration_sessions') as unknown as {
      select: (columns: string) => {
        eq: (
          column: string,
          value: string
        ) => {
          single: () => Promise<{
            data: SessaoStatusRow | null;
            error: { message: string } | null;
          }>;
        };
      };
      update: (values: Record<string, unknown>) => {
        eq: (
          column: string,
          value: string
        ) => Promise<{ data: SessaoRow[] | null; error: { message: string } | null }>;
      };
    };

    const { data: sessao, error: sessaoErr } = await sessionsTable
      .select('versao_atual, status')
      .eq('id', sessaoId)
      .single();

    if (sessaoErr || !sessao) throw new Error('Sessão não encontrada');
    if (sessao.status !== 'aberta') throw new Error('Sessão bloqueada ou encerrada');

    const conflito = data.versaoBase < sessao.versao_atual;
    const novaVersao = sessao.versao_atual + 1;

    const historyTable = client.from('collaboration_history') as unknown as {
      insert: (values: Record<string, unknown>) => {
        select: () => {
          single: () => Promise<{
            data: OperacaoHistoryRow | null;
            error: { message: string } | null;
          }>;
        };
      };
    };

    const { data: op, error: opErr } = await historyTable
      .insert({
        sessao_id: sessaoId,
        usuario_id: data.usuarioId || data.participanteId || null,
        tipo_operacao: data.tipoOperacao,
        payload: data.payload,
        versao_base: data.versaoBase,
        versao_resultante: novaVersao,
        conflito,
      })
      .select()
      .single();

    if (opErr || !op) throw new Error(opErr?.message || 'Falha ao registrar operação colaborativa');

    await sessionsTable
      .update({ versao_atual: novaVersao, updated_at: new Date().toISOString() })
      .eq('id', sessaoId);

    return {
      id: op.id,
      sessaoId: op.sessao_id,
      usuarioId: op.usuario_id || undefined,
      tipoOperacao: op.tipo_operacao,
      payload: op.payload,
      versaoBase: op.versao_base,
      versaoResultante: novaVersao, // CamelCase para compatibilidade com testes
      versao_resultante: novaVersao,
      conflito: op.conflito,
    };
  }

  static async encerrarSessao(sessaoId: string): Promise<SessaoStore | SessaoRow | null> {
    const client = adminDb();

    if (!client) {
      const sessao = inMemorySessoes.get(sessaoId);
      if (sessao) {
        sessao.status = 'encerrada';
        const now = new Date().toISOString();
        (sessao.participantes || []).forEach(p => {
          p.status = 'inativo';
          p.saidaEm = now;
        });
      }
      return sessao || null;
    }

    const sessionsTable = client.from('collaboration_sessions') as unknown as {
      update: (values: Record<string, unknown>) => {
        eq: (
          column: string,
          value: string
        ) => {
          select: () => {
            single: () => Promise<{ data: SessaoRow | null; error: { message: string } | null }>;
          };
        };
      };
    };

    const { data, error } = await sessionsTable
      .update({ status: 'encerrada', updated_at: new Date().toISOString() })
      .eq('id', sessaoId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async bloquearSessao(sessaoId: string): Promise<SessaoStore | SessaoRow | null> {
    const client = adminDb();
    if (!client) {
      const sessao = inMemorySessoes.get(sessaoId);
      if (sessao) sessao.status = 'bloqueada';
      return sessao || null;
    }
    const sessionsTable = client.from('collaboration_sessions') as unknown as {
      update: (values: Record<string, unknown>) => {
        eq: (
          column: string,
          value: string
        ) => {
          select: () => {
            single: () => Promise<{ data: SessaoRow | null; error: { message: string } | null }>;
          };
        };
      };
    };
    const { data, error } = await sessionsTable
      .update({ status: 'bloqueada', updated_at: new Date().toISOString() })
      .eq('id', sessaoId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  static async obterSessao(id: string): Promise<SessaoColaborativa | null> {
    const client = adminDb();
    if (!client) return inMemorySessoes.get(id) || null;

    const sessionsTable = client.from('collaboration_sessions') as unknown as {
      select: (columns: string) => {
        eq: (
          column: string,
          value: string
        ) => {
          single: () => Promise<{ data: SessaoRow | null; error: { message: string } | null }>;
        };
      };
    };
    const { data } = await sessionsTable.select('*').eq('id', id).single();
    return data
      ? {
          id: data.id,
          tenantId: data.tenant_id,
          projetoId: data.projeto_id,
          nomeProjeto: data.nome_projeto,
          responsavelId: data.responsavel_id,
          status: data.status,
          versaoAtual: data.versao_atual,
          criadoEm: data.created_at,
          atualizadoEm: data.updated_at,
        }
      : null;
  }

  static async adicionarParticipante(
    sessaoId: string,
    data: Omit<ParticipanteSessao, 'id' | 'status'>
  ): Promise<ParticipanteSessao> {
    const client = adminDb();
    if (!client) {
      const sessao = inMemorySessoes.get(sessaoId);
      if (!sessao) throw new Error('Sessão não encontrada');
      if (sessao.status === 'bloqueada') throw new Error('Sessão bloqueada');
      const p: ParticipanteSessao = {
        id: `pp-${(sessao.participantes || []).length + 1}`,
        ...data,
        status: 'ativo',
      };
      sessao.participantes.push(p);
      return p;
    }
    // No Supabase usamos Presence, então este método pode ser um no-op ou log
    return { id: 'remote-p', ...data, status: 'ativo' };
  }

  static listarPapeis(): PapelParticipante[] {
    return ['editor', 'revisor', 'observador'];
  }
}
