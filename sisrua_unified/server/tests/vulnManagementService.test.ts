/**
 * vulnManagementService.test.ts — Testes unitários do serviço de vulnerabilidades (Item 127 [T1]).
 */
import {
  registrarVuln,
  atualizarStatus,
  listarVulns,
  resumoCvss,
  _resetVulns,
  Vulnerabilidade,
  SeveridadeVuln,
  StatusVuln,
} from "../services/vulnManagementService.js";

function makeVulnInput(overrides: Partial<Omit<Vulnerabilidade, 'id' | 'prazoSla' | 'criadoEm'>> = {}) {
  return {
    titulo: "Teste Vulnerabilidade",
    cvssScore: 7.5,
    severidade: "alta" as SeveridadeVuln,
    status: "aberta" as StatusVuln,
    fonte: "scanner-interno",
    afetado: "servico-api",
    ...overrides,
  };
}

beforeEach(() => _resetVulns());

describe("registrarVuln", () => {
  it("gera id e timestamps automaticamente", () => {
    const vuln = registrarVuln(makeVulnInput());
    expect(vuln.id).toBeDefined();
    expect(vuln.id).toMatch(/^vuln-/);
    expect(vuln.criadoEm).toBeInstanceOf(Date);
    expect(vuln.prazoSla).toBeInstanceOf(Date);
  });

  it("calcula prazoSla de 7 dias para severidade critica", () => {
    const before = Date.now();
    const vuln = registrarVuln(makeVulnInput({ severidade: "critica" }));
    const diffDias = (vuln.prazoSla.getTime() - vuln.criadoEm.getTime()) / (24 * 60 * 60 * 1000);
    expect(diffDias).toBeCloseTo(7, 0);
  });

  it("calcula prazoSla de 30 dias para severidade alta", () => {
    const vuln = registrarVuln(makeVulnInput({ severidade: "alta" }));
    const diffDias = (vuln.prazoSla.getTime() - vuln.criadoEm.getTime()) / (24 * 60 * 60 * 1000);
    expect(diffDias).toBeCloseTo(30, 0);
  });

  it("calcula prazoSla de 90 dias para severidade media", () => {
    const vuln = registrarVuln(makeVulnInput({ severidade: "media" }));
    const diffDias = (vuln.prazoSla.getTime() - vuln.criadoEm.getTime()) / (24 * 60 * 60 * 1000);
    expect(diffDias).toBeCloseTo(90, 0);
  });

  it("calcula prazoSla de 180 dias para severidade baixa", () => {
    const vuln = registrarVuln(makeVulnInput({ severidade: "baixa" }));
    const diffDias = (vuln.prazoSla.getTime() - vuln.criadoEm.getTime()) / (24 * 60 * 60 * 1000);
    expect(diffDias).toBeCloseTo(180, 0);
  });

  it("cada vuln tem id único", () => {
    const v1 = registrarVuln(makeVulnInput());
    const v2 = registrarVuln(makeVulnInput());
    expect(v1.id).not.toBe(v2.id);
  });

  it("adiciona vuln à lista", () => {
    registrarVuln(makeVulnInput());
    expect(listarVulns()).toHaveLength(1);
  });
});

describe("atualizarStatus", () => {
  it("retorna false para id desconhecido", () => {
    expect(atualizarStatus("nao-existe", "resolvida")).toBe(false);
  });

  it("atualiza status com sucesso", () => {
    const vuln = registrarVuln(makeVulnInput());
    const ok = atualizarStatus(vuln.id, "em_tratamento");
    expect(ok).toBe(true);
    expect(listarVulns()[0].status).toBe("em_tratamento");
  });

  it("define resolvidoEm automaticamente ao marcar como resolvida", () => {
    const vuln = registrarVuln(makeVulnInput());
    atualizarStatus(vuln.id, "resolvida");
    expect(listarVulns()[0].resolvidoEm).toBeInstanceOf(Date);
  });

  it("usa resolvidoEm fornecido quando presente", () => {
    const vuln = registrarVuln(makeVulnInput());
    const data = new Date("2024-01-15T12:00:00Z");
    atualizarStatus(vuln.id, "resolvida", data);
    expect(listarVulns()[0].resolvidoEm?.toISOString()).toBe(data.toISOString());
  });

  it("permite marcar como aceita sem resolvidoEm", () => {
    const vuln = registrarVuln(makeVulnInput());
    atualizarStatus(vuln.id, "aceita");
    const updated = listarVulns()[0];
    expect(updated.status).toBe("aceita");
    expect(updated.resolvidoEm).toBeUndefined();
  });
});

describe("listarVulns", () => {
  it("retorna lista vazia inicialmente", () => {
    expect(listarVulns()).toEqual([]);
  });

  it("filtra por status", () => {
    const v1 = registrarVuln(makeVulnInput({ status: "aberta" }));
    const v2 = registrarVuln(makeVulnInput({ status: "resolvida" }));
    atualizarStatus(v2.id, "resolvida");
    const abertas = listarVulns({ status: "aberta" });
    expect(abertas.every(v => v.status === "aberta")).toBe(true);
  });

  it("filtra por severidade", () => {
    registrarVuln(makeVulnInput({ severidade: "critica" }));
    registrarVuln(makeVulnInput({ severidade: "baixa" }));
    const criticas = listarVulns({ severidade: "critica" });
    expect(criticas).toHaveLength(1);
    expect(criticas[0].severidade).toBe("critica");
  });

  it("retorna todas quando sem filtros", () => {
    registrarVuln(makeVulnInput({ severidade: "critica" }));
    registrarVuln(makeVulnInput({ severidade: "alta" }));
    registrarVuln(makeVulnInput({ severidade: "media" }));
    expect(listarVulns()).toHaveLength(3);
  });

  it("filtra combinado status + severidade", () => {
    const v1 = registrarVuln(makeVulnInput({ severidade: "alta", status: "aberta" }));
    registrarVuln(makeVulnInput({ severidade: "alta", status: "aberta" }));
    atualizarStatus(v1.id, "resolvida");
    const res = listarVulns({ severidade: "alta", status: "resolvida" });
    expect(res).toHaveLength(1);
  });
});

describe("resumoCvss", () => {
  it("retorna totais zerados inicialmente", () => {
    const resumo = resumoCvss();
    expect(resumo.total).toBe(0);
    expect(resumo.vencidas).toBe(0);
    expect(resumo.emPrazo).toBe(0);
  });

  it("conta por severidade corretamente", () => {
    registrarVuln(makeVulnInput({ severidade: "critica" }));
    registrarVuln(makeVulnInput({ severidade: "critica" }));
    registrarVuln(makeVulnInput({ severidade: "alta" }));
    registrarVuln(makeVulnInput({ severidade: "baixa" }));
    const resumo = resumoCvss();
    expect(resumo.total).toBe(4);
    expect(resumo.porSeveridade.critica).toBe(2);
    expect(resumo.porSeveridade.alta).toBe(1);
    expect(resumo.porSeveridade.baixa).toBe(1);
    expect(resumo.porSeveridade.media).toBe(0);
  });

  it("não conta resolvidas e aceitas em vencidas/emPrazo", () => {
    const v1 = registrarVuln(makeVulnInput());
    const v2 = registrarVuln(makeVulnInput());
    atualizarStatus(v1.id, "resolvida");
    atualizarStatus(v2.id, "aceita");
    const resumo = resumoCvss();
    expect(resumo.vencidas).toBe(0);
    expect(resumo.emPrazo).toBe(0);
  });

  it("conta abertas em emPrazo quando dentro do SLA", () => {
    registrarVuln(makeVulnInput({ severidade: "baixa" }));
    const resumo = resumoCvss();
    expect(resumo.emPrazo).toBe(1);
    expect(resumo.vencidas).toBe(0);
  });
});
