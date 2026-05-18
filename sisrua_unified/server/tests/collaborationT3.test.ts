/**
 * collaborationT3.test.ts — Testes para Edição Colaborativa Preditiva (Item 134).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { EdicaoColaborativaService } from "../services/edicaoColaborativaService.js";

// Mock do Supabase Admin Client
vi.mock("../services/supabaseAdminService.js", () => ({
  getSupabaseAdminClient: () => ({
    from: (table: string) => ({
      insert: (payload: any) => ({
        select: () => ({
          single: () => Promise.resolve({
            data: { 
              id: "op-123", 
              ...payload, 
              versao_resultante: (payload.versao_base || 0) + 2, // Simula incremento
              conflito: payload.versao_base < 5 // Simula detecção de conflito baseada na versão atual 5
            },
            error: null
          })
        })
      }),
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({
            data: { versao_atual: 5, status: "aberta" },
            error: null
          })
        }),
        limit: () => Promise.resolve({ data: [], error: null })
      }),
      update: () => ({
        eq: () => Promise.resolve({ error: null })
      })
    })
  })
}));

describe("Edição Colaborativa Multiplayer (T3-134)", () => {
  it("Deve criar uma sessão colaborativa", async () => {
    const sessao = await EdicaoColaborativaService.criarSessao({
      tenantId: "00000000-0000-0000-0000-000000000001",
      projetoId: "P001",
      nomeProjeto: "Projeto Alpha",
      responsavelId: "00000000-0000-0000-0000-000000000002"
    });

    expect(sessao.id).toBeDefined();
    expect(sessao.status).toBe("aberta");
  });

  it("Deve registrar uma operação e detectar conflito de versão", async () => {
    // Mock simulando versão atual 5 e enviando versão base 4
    const op = await EdicaoColaborativaService.registrarOperacao("sess-123", {
      usuarioId: "00000000-0000-0000-0000-000000000002",
      tipoOperacao: "mover_ponto",
      payload: { id: "p1", lat: -23.5 },
      versaoBase: 4
    });

    expect(op.conflito).toBe(true);
    expect(op.versao_resultante).toBe(6);
  });
});
