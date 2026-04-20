/**
 * licitacoesService.test.ts
 * Testes unitários para Trilha de Evidências para Licitações (Ponto 120 [T1]).
 */

import {
  gerarPacote,
  listarPacotes,
  obterPacote,
  validarPacote,
  emitirPacote,
  verificarIntegridade,
} from "../services/licitacoesService";

describe("licitacoesService", () => {
  describe("gerarPacote()", () => {
    it("gera pacote com status rascunho", () => {
      const pacote = gerarPacote("Licitação Teste ANEEL 2026");
      expect(pacote.id).toMatch(/^LIC-/);
      expect(pacote.status).toBe("rascunho");
      expect(pacote.titulo).toBe("Licitação Teste ANEEL 2026");
      expect(pacote.hashPacote).toHaveLength(64); // SHA-256 hex
    });

    it("inclui orgaoEdital e numeroEdital quando fornecidos", () => {
      const pacote = gerarPacote("Edital COPEL", "COPEL", "PE-2026-001");
      expect(pacote.orgaoEdital).toBe("COPEL");
      expect(pacote.numeroEdital).toBe("PE-2026-001");
    });

    it("sumário tem percentualConformidade entre 0 e 100", () => {
      const pacote = gerarPacote("Teste Sumário");
      expect(pacote.sumario.percentualConformidade).toBeGreaterThanOrEqual(0);
      expect(pacote.sumario.percentualConformidade).toBeLessThanOrEqual(100);
    });

    it("evidências incluem pelo menos um item", () => {
      const pacote = gerarPacote("Teste Evidências");
      expect(pacote.evidencias.length).toBeGreaterThan(0);
    });

    it("evidências contêm referências de artefato", () => {
      const pacote = gerarPacote("Teste Artefatos");
      const comArtefatos = pacote.evidencias.filter(
        (e) => e.artefatos.length > 0,
      );
      expect(comArtefatos.length).toBeGreaterThan(0);
    });

    it("geradoEm é uma data válida", () => {
      const pacote = gerarPacote("Data Teste");
      expect(pacote.geradoEm).toBeInstanceOf(Date);
    });
  });

  describe("listarPacotes()", () => {
    it("retorna array (possivelmente vazio ou com pacotes criados)", () => {
      const pacotes = listarPacotes();
      expect(Array.isArray(pacotes)).toBe(true);
    });

    it("lista inclui pacotes criados", () => {
      const p1 = gerarPacote("Pacote Ordem A");
      const p2 = gerarPacote("Pacote Ordem B");
      const lista = listarPacotes();
      expect(lista.some((p) => p.id === p1.id)).toBe(true);
      expect(lista.some((p) => p.id === p2.id)).toBe(true);
    });
  });

  describe("obterPacote()", () => {
    it("retorna pacote gerado", () => {
      const criado = gerarPacote("Busca Direta");
      const encontrado = obterPacote(criado.id);
      expect(encontrado).toBeDefined();
      expect(encontrado!.titulo).toBe("Busca Direta");
    });

    it("retorna undefined para ID inexistente", () => {
      expect(obterPacote("LIC-INEXISTENTE")).toBeUndefined();
    });
  });

  describe("validarPacote()", () => {
    it("promove rascunho para validado", () => {
      const pacote = gerarPacote("Validação Teste");
      expect(pacote.status).toBe("rascunho");
      const validado = validarPacote(pacote.id);
      expect(validado).toBeDefined();
      expect(validado!.status).toBe("validado");
    });

    it("retorna null para ID inexistente", () => {
      expect(validarPacote("LIC-NAOEXISTE")).toBeNull();
    });

    it("pacote emitido permanece emitido ao tentar revalidar", () => {
      const pacote = gerarPacote("Re-validação");
      validarPacote(pacote.id);
      emitirPacote(pacote.id);
      const resultado = validarPacote(pacote.id);
      expect(resultado!.status).toBe("emitido");
    });
  });

  describe("emitirPacote()", () => {
    it("promove validado para emitido com emitidoEm preenchido", () => {
      const pacote = gerarPacote("Emissão Teste");
      validarPacote(pacote.id);
      const emitido = emitirPacote(pacote.id);
      expect(emitido).toBeDefined();
      expect(emitido!.status).toBe("emitido");
      expect(emitido!.emitidoEm).toBeInstanceOf(Date);
    });

    it("retorna null para rascunho (não pode emitir sem validar)", () => {
      const pacote = gerarPacote("Emissão sem validação");
      const resultado = emitirPacote(pacote.id);
      expect(resultado).toBeNull();
    });

    it("retorna null para ID inexistente", () => {
      expect(emitirPacote("LIC-NAOEXISTE")).toBeNull();
    });
  });

  describe("verificarIntegridade()", () => {
    it("retorna integro=true para pacote não adulterado", () => {
      const pacote = gerarPacote("Integridade OK");
      const resultado = verificarIntegridade(pacote.id);
      expect(resultado.integro).toBe(true);
      expect(resultado.hashAtual).toBe(resultado.hashEsperado);
    });

    it("retorna integro=false para ID inexistente", () => {
      const resultado = verificarIntegridade("LIC-NAOEXISTE");
      expect(resultado.integro).toBe(false);
      expect(resultado.hashEsperado).toBe("");
    });

    it("hashes têm 64 caracteres (SHA-256)", () => {
      const pacote = gerarPacote("Hash Length");
      const resultado = verificarIntegridade(pacote.id);
      expect(resultado.hashEsperado).toHaveLength(64);
      expect(resultado.hashAtual).toHaveLength(64);
    });
  });
});
