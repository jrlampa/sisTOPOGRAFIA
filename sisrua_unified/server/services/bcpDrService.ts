/**
 * bcpDrService.ts — BCP/DR com RTO/RPO Testados (51 [T1]) + Redundância Geográfica (52 [T1])
 *
 * Formaliza planos de Business Continuity + Disaster Recovery:
 * - Registro de cenários de DR com RTO/RPO definidos
 * - Agendamento e execução de testes semestrais
 * - Evidência de restore com hash de integridade
 * - Redundância geográfica com failover automático simulado
 */

export type StatusTeste = "agendado" | "em_execucao" | "aprovado" | "reprovado" | "cancelado";
export type TipoIncidente = "falha_bd" | "falha_storage" | "falha_rede" | "falha_total" | "ataque_cyber" | "desastre_fisico";
export type RegiaoCloud = "sa-east-1" | "us-east-1" | "us-west-2" | "eu-west-1" | "ap-southeast-1";

export interface CenarioDR {
  id: string;
  titulo: string;
  tipoIncidente: TipoIncidente;
  rtoMaxHoras: number;         // Recovery Time Objective
  rpoMaxHoras: number;         // Recovery Point Objective
  regiaoAtiva: RegiaoCloud;
  regiaoFallback: RegiaoCloud;
  criadoEm: string;
  descricao: string;
}

export interface TesteDR {
  id: string;
  cenarioId: string;
  agendadoParа: string;
  executadoEm?: string;
  status: StatusTeste;
  rtoRealHoras?: number;       // RTO medido
  rpoRealHoras?: number;       // RPO medido
  responsavel: string;
  evidenciaHash?: string;      // SHA-256 do artefato de evidência
  observacoes?: string;
  rtoAtingido?: boolean;
  rpoAtingido?: boolean;
}

export interface RegioStatus {
  regiao: RegiaoCloud;
  ativa: boolean;
  latenciaMs: number;
  ultimoCheckEm: string;
  saudavel: boolean;
}

import crypto from "crypto";

const cenarios = new Map<string, CenarioDR>();
const testes = new Map<string, TesteDR>();
const regioes = new Map<RegiaoCloud, RegioStatus>();
let cSeq = 1;
let tSeq = 1;

const REGIOES_DEFAULT: RegiaoCloud[] = ["sa-east-1", "us-east-1"];

// Inicializa regiões padrão
for (const r of REGIOES_DEFAULT) {
  regioes.set(r, {
    regiao: r,
    ativa: r === "sa-east-1",
    latenciaMs: r === "sa-east-1" ? 8 : 180,
    ultimoCheckEm: new Date().toISOString(),
    saudavel: true,
  });
}

export class BcpDrService {
  // ─── Cenários ──────────────────────────────────────────────────────────

  static criarCenario(dados: Omit<CenarioDR, "id" | "criadoEm">): CenarioDR {
    const id = `dr-cen-${cSeq++}`;
    const cenario: CenarioDR = { ...dados, id, criadoEm: new Date().toISOString() };
    cenarios.set(id, cenario);
    return cenario;
  }

  static listarCenarios(): CenarioDR[] {
    return [...cenarios.values()];
  }

  static getCenario(id: string): CenarioDR {
    const c = cenarios.get(id);
    if (!c) throw new Error(`Cenário '${id}' não encontrado`);
    return c;
  }

  // ─── Testes ────────────────────────────────────────────────────────────

  static agendarTeste(dados: {
    cenarioId: string;
    agendadoParа: string;
    responsavel: string;
  }): TesteDR {
    BcpDrService.getCenario(dados.cenarioId); // valida cenário
    const id = `dr-test-${tSeq++}`;
    const teste: TesteDR = { ...dados, id, status: "agendado" };
    testes.set(id, teste);
    return teste;
  }

  static executarTeste(
    testeId: string,
    resultado: {
      rtoRealHoras: number;
      rpoRealHoras: number;
      evidenciaConteudo: string;
      observacoes?: string;
    }
  ): TesteDR {
    const teste = testes.get(testeId);
    if (!teste) throw new Error(`Teste '${testeId}' não encontrado`);

    const cenario = BcpDrService.getCenario(teste.cenarioId);
    const rtoAtingido = resultado.rtoRealHoras <= cenario.rtoMaxHoras;
    const rpoAtingido = resultado.rpoRealHoras <= cenario.rpoMaxHoras;

    Object.assign(teste, {
      executadoEm: new Date().toISOString(),
      status: rtoAtingido && rpoAtingido ? "aprovado" : "reprovado",
      rtoRealHoras: resultado.rtoRealHoras,
      rpoRealHoras: resultado.rpoRealHoras,
      evidenciaHash: crypto.createHash("sha256").update(resultado.evidenciaConteudo).digest("hex"),
      observacoes: resultado.observacoes,
      rtoAtingido,
      rpoAtingido,
    });

    return { ...teste };
  }

  static listarTestes(cenarioId?: string): TesteDR[] {
    const todos = [...testes.values()];
    if (cenarioId) return todos.filter((t) => t.cenarioId === cenarioId);
    return todos;
  }

  // ─── Redundância Geográfica ──────────────────────────────────────────────

  static listarRegioes(): RegioStatus[] {
    return [...regioes.values()];
  }

  static atualizarStatusRegiao(
    regiao: RegiaoCloud,
    update: Partial<Pick<RegioStatus, "saudavel" | "latenciaMs">>
  ): RegioStatus {
    const r = regioes.get(regiao);
    if (!r) throw new Error(`Região '${regiao}' não registrada`);
    Object.assign(r, update, { ultimoCheckEm: new Date().toISOString() });
    return { ...r };
  }

  static simularFailover(regiaoFalha: RegiaoCloud): {
    regiaoAnterior: RegiaoCloud;
    regiaoAtual: RegiaoCloud;
    ts: string;
    motivo: string;
  } {
    const falha = regioes.get(regiaoFalha);
    if (falha) {
      falha.ativa = false;
      falha.saudavel = false;
    }

    // Ativa a primeira região saudável disponível
    const candidata = [...regioes.values()].find(
      (r) => r.regiao !== regiaoFalha && r.saudavel
    );
    if (candidata) {
      candidata.ativa = true;
    }

    return {
      regiaoAnterior: regiaoFalha,
      regiaoAtual: candidata?.regiao ?? regiaoFalha,
      ts: new Date().toISOString(),
      motivo: `Falha detectada em ${regiaoFalha} — failover automático`,
    };
  }

  static getResumo(): {
    cenarios: number;
    testesAprovados: number;
    testesReprovados: number;
    regioesAtivas: number;
    conforme: boolean;
  } {
    const todosTest = [...testes.values()];
    const aprovados = todosTest.filter((t) => t.status === "aprovado").length;
    const reprovados = todosTest.filter((t) => t.status === "reprovado").length;
    const ativas = [...regioes.values()].filter((r) => r.ativa && r.saudavel).length;
    return {
      cenarios: cenarios.size,
      testesAprovados: aprovados,
      testesReprovados: reprovados,
      regioesAtivas: ativas,
      conforme: reprovados === 0 && ativas >= 1,
    };
  }

  static _reset(): void {
    cenarios.clear();
    testes.clear();
    regioes.clear();
    cSeq = 1;
    tSeq = 1;
    for (const r of REGIOES_DEFAULT) {
      regioes.set(r, {
        regiao: r,
        ativa: r === "sa-east-1",
        latenciaMs: r === "sa-east-1" ? 8 : 180,
        ultimoCheckEm: new Date().toISOString(),
        saudavel: true,
      });
    }
  }
}
