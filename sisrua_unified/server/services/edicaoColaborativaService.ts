/**
 * Serviço T2-56 / T3-134 — Edição Colaborativa em Tempo Real
 * Suporte para edição simultânea geoespacial multicanal via Supabase.
 */

import { getSupabaseAdminClient } from "./supabaseAdminService.js";
import { logger } from "../utils/logger.js";

// Helper: retorna o client admin com cast para `any` necessário pois as tabelas
// collaboration_sessions/collaboration_history ainda não foram regeneradas no
// tipo Database do frontend. Isola o workaround aqui para fácil remoção após
// `supabase gen types` ser executado com as migrações 065-068 aplicadas.
 
const adminDb = () => getSupabaseAdminClient() as any;

export type PapelParticipante = "editor" | "revisor" | "observador";
type StatusSessao = "aberta" | "bloqueada" | "encerrada";
export type TipoOperacao =
  | "adicionar_ponto"
  | "mover_ponto"
  | "remover_ponto"
  | "adicionar_trecho"
  | "remover_trecho"
  | "editar_atributo"
  | "comentar";

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
  participantes?: any[]; // Para compatibilidade com testes legados
}

// In-memory store para testes e fallback de resiliência
let inMemorySessoes: Map<string, any> = new Map();
let _inMemoryOps: Map<string, any[]> = new Map();

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
      const sessao: SessaoColaborativa = {
        id,
        tenantId: data.tenantId,
        projetoId: data.projetoId,
        nomeProjeto: data.nomeProjeto,
        responsavelId: data.responsavelId || "test-user",
        status: "aberta",
        versaoAtual: 0,
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
        participantes: []
      };
      inMemorySessoes.set(id, sessao);
      return sessao;
    }

    const { data: sessao, error } = await client
      .from("collaboration_sessions")
      .insert({
        tenant_id: data.tenantId,
        projeto_id: data.projetoId,
        nome_projeto: data.nomeProjeto,
        responsavel_id: data.responsavelId,
        status: "aberta",
        versao_atual: 0,
      })
      .select()
      .single();

    if (error) {
      logger.error("[Colaborativa] Erro ao criar sessão", error);
      throw new Error(error.message);
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

    let query = client.from("collaboration_sessions").select("*");
    if (tenantId) query = query.eq("tenant_id", tenantId);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

     
    return (data || []).map((s: any) => ({
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
  ): Promise<any> {
    const client = adminDb();
    
    if (!client) {
      const sessao = inMemorySessoes.get(sessaoId);
      if (!sessao) throw new Error("Sessão não encontrada");
      
      const partId = data.usuarioId || data.participanteId;
      const participante = (sessao.participantes || []).find((p: any) => p.id === partId);
      if (participante && participante.papel === "observador") {
        throw new Error("Observadores não podem registrar operações");
      }

      const conflito = data.versaoBase < sessao.versaoAtual;
      sessao.versaoAtual += 1;
      
      const op = {
        id: `op-${Date.now()}`,
        sessaoId,
        usuarioId: partId,
        tipoOperacao: data.tipoOperacao,
        payload: data.payload,
        versaoBase: data.versaoBase,
        versaoResultante: sessao.versaoAtual,
        conflito
      };
      
      return op;
    }

    const { data: sessao, error: sessaoErr } = await client
      .from("collaboration_sessions")
      .select("versao_atual, status")
      .eq("id", sessaoId)
      .single();

    if (sessaoErr || !sessao) throw new Error("Sessão não encontrada");
    if (sessao.status !== "aberta") throw new Error("Sessão bloqueada ou encerrada");

    const conflito = data.versaoBase < sessao.versao_atual;
    const novaVersao = sessao.versao_atual + 1;

    const { data: op, error: opErr } = await client
      .from("collaboration_history")
      .insert({
        sessao_id: sessaoId,
        usuario_id: data.usuarioId || data.participanteId,
        tipo_operacao: data.tipoOperacao,
        payload: data.payload,
        versao_base: data.versaoBase,
        versao_resultante: novaVersao,
        conflito,
      })
      .select()
      .single();

    if (opErr) throw new Error(opErr.message);

    await client
      .from("collaboration_sessions")
      .update({ versao_atual: novaVersao, updated_at: new Date().toISOString() })
      .eq("id", sessaoId);

    return {
       ...op,
       versaoResultante: novaVersao // CamelCase para compatibilidade com testes
    };
  }

  static async encerrarSessao(sessaoId: string): Promise<any> {
    const client = adminDb();
    
    if (!client) {
      const sessao = inMemorySessoes.get(sessaoId);
      if (sessao) {
        sessao.status = "encerrada";
        const now = new Date().toISOString();
        (sessao.participantes || []).forEach((p: any) => {
           p.status = "inativo";
           p.saidaEm = now;
        });
      }
      return sessao;
    }

    const { data, error } = await client
      .from("collaboration_sessions")
      .update({ status: "encerrada", updated_at: new Date().toISOString() })
      .eq("id", sessaoId)
      .select()
      .single();
      
    if (error) throw error;
    return data;
  }

  static async bloquearSessao(sessaoId: string): Promise<any> {
    const client = adminDb();
    if (!client) {
      const sessao = inMemorySessoes.get(sessaoId);
      if (sessao) sessao.status = "bloqueada";
      return sessao;
    }
    const { data, error } = await client
      .from("collaboration_sessions")
      .update({ status: "bloqueada", updated_at: new Date().toISOString() })
      .eq("id", sessaoId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  static async obterSessao(id: string): Promise<SessaoColaborativa | null> {
     const client = adminDb();
     if (!client) return inMemorySessoes.get(id) || null;
     
     const { data } = await client.from("collaboration_sessions").select("*").eq("id", id).single();
     return data ? {
        id: data.id,
        tenantId: data.tenant_id,
        projetoId: data.projeto_id,
        nomeProjeto: data.nome_projeto,
        responsavelId: data.responsavel_id,
        status: data.status,
        versaoAtual: data.versao_atual,
        criadoEm: data.created_at,
        atualizadoEm: data.updated_at
     } : null;
  }

  static async adicionarParticipante(sessaoId: string, data: any): Promise<any> {
     const client = adminDb();
     if (!client) {
        const sessao = inMemorySessoes.get(sessaoId);
        if (!sessao) throw new Error("Sessão não encontrada");
        if (sessao.status === "bloqueada") throw new Error("Sessão bloqueada");
        const p = { id: `pp-${(sessao.participantes || []).length + 1}`, ...data, status: "ativo" };
        sessao.participantes.push(p);
        return p;
     }
     // No Supabase usamos Presence, então este método pode ser um no-op ou log
     return { id: "remote-p", ...data, status: "ativo" };
  }

  static listarPapeis(): PapelParticipante[] {
    return ["editor", "revisor", "observador"];
  }
}
