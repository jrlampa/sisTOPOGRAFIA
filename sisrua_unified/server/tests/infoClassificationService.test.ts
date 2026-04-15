/**
 * infoClassificationService.test.ts — Testes unitários do serviço de classificação (Item 128 [T1]).
 */
import {
  classificarRecurso,
  obterClassificacao,
  listarPorNivel,
  resumoClassificacoes,
  politicaAcessoPorNivel,
  _resetClassificacoes,
  NivelClassificacao,
} from "../services/infoClassificationService.js";

beforeEach(() => _resetClassificacoes());

describe("classificarRecurso", () => {
  it("classifica recurso e retorna classificação com timestamps", () => {
    const c = classificarRecurso("res-001", "documento", "interno", "Justificativa", "admin");
    expect(c.recursoId).toBe("res-001");
    expect(c.recursoTipo).toBe("documento");
    expect(c.nivel).toBe("interno");
    expect(c.classificadoEm).toBeInstanceOf(Date);
    expect(c.revisaoEm).toBeInstanceOf(Date);
  });

  it("calcula revisaoEm de 365 dias para público", () => {
    const c = classificarRecurso("r1", "tipo", "publico", "j", "admin");
    const diffDias = (c.revisaoEm.getTime() - c.classificadoEm.getTime()) / (24 * 60 * 60 * 1000);
    expect(diffDias).toBeCloseTo(365, 0);
  });

  it("calcula revisaoEm de 180 dias para interno", () => {
    const c = classificarRecurso("r2", "tipo", "interno", "j", "admin");
    const diffDias = (c.revisaoEm.getTime() - c.classificadoEm.getTime()) / (24 * 60 * 60 * 1000);
    expect(diffDias).toBeCloseTo(180, 0);
  });

  it("calcula revisaoEm de 90 dias para confidencial", () => {
    const c = classificarRecurso("r3", "tipo", "confidencial", "j", "admin");
    const diffDias = (c.revisaoEm.getTime() - c.classificadoEm.getTime()) / (24 * 60 * 60 * 1000);
    expect(diffDias).toBeCloseTo(90, 0);
  });

  it("calcula revisaoEm de 30 dias para restrito", () => {
    const c = classificarRecurso("r4", "tipo", "restrito", "j", "admin");
    const diffDias = (c.revisaoEm.getTime() - c.classificadoEm.getTime()) / (24 * 60 * 60 * 1000);
    expect(diffDias).toBeCloseTo(30, 0);
  });

  it("sobrescreve classificação existente para mesmo recursoId", () => {
    classificarRecurso("r5", "tipo", "publico", "j1", "user1");
    classificarRecurso("r5", "tipo", "restrito", "j2", "admin");
    const c = obterClassificacao("r5");
    expect(c?.nivel).toBe("restrito");
  });
});

describe("obterClassificacao", () => {
  it("retorna null para recurso não classificado", () => {
    expect(obterClassificacao("nao-existe")).toBeNull();
  });

  it("retorna classificação correta", () => {
    classificarRecurso("r10", "contrato", "confidencial", "Dados sensíveis", "gestor");
    const c = obterClassificacao("r10");
    expect(c).not.toBeNull();
    expect(c?.nivel).toBe("confidencial");
    expect(c?.classificadoPor).toBe("gestor");
  });
});

describe("listarPorNivel", () => {
  it("retorna lista vazia quando não há recursos do nível", () => {
    expect(listarPorNivel("restrito")).toEqual([]);
  });

  it("filtra corretamente por nível", () => {
    classificarRecurso("r1", "t", "publico", "j", "a");
    classificarRecurso("r2", "t", "publico", "j", "a");
    classificarRecurso("r3", "t", "restrito", "j", "admin");
    const publicos = listarPorNivel("publico");
    expect(publicos).toHaveLength(2);
    expect(publicos.every(c => c.nivel === "publico")).toBe(true);
  });

  it("lista todos os níveis separadamente", () => {
    const niveis: NivelClassificacao[] = ["publico", "interno", "confidencial", "restrito"];
    niveis.forEach((n, i) => classificarRecurso(`res-${i}`, "tipo", n, "j", "admin"));
    niveis.forEach(n => {
      expect(listarPorNivel(n)).toHaveLength(1);
    });
  });
});

describe("resumoClassificacoes", () => {
  it("retorna contagens zeradas inicialmente", () => {
    const resumo = resumoClassificacoes();
    expect(resumo.publico).toBe(0);
    expect(resumo.interno).toBe(0);
    expect(resumo.confidencial).toBe(0);
    expect(resumo.restrito).toBe(0);
  });

  it("conta corretamente após classificações", () => {
    classificarRecurso("r1", "t", "publico", "j", "a");
    classificarRecurso("r2", "t", "publico", "j", "a");
    classificarRecurso("r3", "t", "interno", "j", "a");
    classificarRecurso("r4", "t", "restrito", "j", "admin");
    const resumo = resumoClassificacoes();
    expect(resumo.publico).toBe(2);
    expect(resumo.interno).toBe(1);
    expect(resumo.confidencial).toBe(0);
    expect(resumo.restrito).toBe(1);
  });
});

describe("politicaAcessoPorNivel", () => {
  it("público permite visitante", () => {
    expect(politicaAcessoPorNivel("publico")).toContain("visitante");
  });

  it("interno não permite visitante", () => {
    expect(politicaAcessoPorNivel("interno")).not.toContain("visitante");
  });

  it("confidencial permite apenas admin, gestor, analista", () => {
    const papeis = politicaAcessoPorNivel("confidencial");
    expect(papeis).toContain("admin");
    expect(papeis).toContain("gestor");
    expect(papeis).toContain("analista");
    expect(papeis).not.toContain("operador");
    expect(papeis).not.toContain("visitante");
  });

  it("restrito permite apenas admin", () => {
    const papeis = politicaAcessoPorNivel("restrito");
    expect(papeis).toEqual(["admin"]);
  });
});
