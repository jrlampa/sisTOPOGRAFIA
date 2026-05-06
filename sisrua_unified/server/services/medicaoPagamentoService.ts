/**
 * T2-65 — Módulo de Medição para Pagamento (EAP/WBS)
 *
 * Referências normativas:
 *  - ABNT NBR 16280:2015 — Gestão de obras em edificações
 *  - PMI PMBOK 7ª Edição — WBS/EAP e Controle de Custos
 *  - ANEEL PRODIST Módulo 8 — Qualidade da Energia
 *  - Lei nº 8.666/1993 e 14.133/2021 — Contratos de Obras Públicas
 *  - SINAPI — Composições de Serviço de Infraestrutura
 */

import { createHash } from "crypto";

export type TipoServico =
  | "fornecimento_material"
  | "montagem_eletrica"
  | "obras_civis"
  | "instalacao_equipamentos"
  | "comissionamento"
  | "ensaios"
  | "supervisao"
  | "mobilizacao"
  | "desmobilizacao";

export type StatusMedicao =
  | "em_elaboracao"
  | "submetida"
  | "aprovada"
  | "rejeitada"
  | "homologada"
  | "paga";

export interface ItemMedicao {
  id: string;
  wbsCode: string;         // ex: "1.2.3"
  descricao: string;
  tipoServico: TipoServico;
  unidade: string;
  quantidadeContratada: number;
  quantidadeMedida: number;
  valorUnitario: number;
  valorTotal: number;      // calculado: quantidadeMedida × valorUnitario
  percentualContrato: number; // quantidadeMedida / quantidadeContratada × 100
}

export interface ResultadoMedicao {
  medicaoId: string;
  totalBruto: number;
  retencao: number;        // % retencaoPercentual sobre totalBruto
  totalLiquido: number;
  percentualGeralContrato: number;
  itensValidos: number;
  itensPendentes: number;
  hashIntegridade: string;
  calculadoEm: string;
}

export interface Medicao {
  id: string;
  tenantId: string;
  titulo: string;
  contratoRef: string;
  periodo: string;          // ex: "2024-03"
  medicaoNumero: number;
  concessionaria: string;
  responsavel: string;
  retencaoPercentual: number;  // padrão 5%
  status: StatusMedicao;
  itens: ItemMedicao[];
  resultado?: ResultadoMedicao;
  motivoRejeicao?: string;
  criadoEm: string;
  submetidoEm?: string;
  aprovadoEm?: string;
  homologadoEm?: string;
}

// ─── Estado em memória ───────────────────────────────────────────────────────
const medicoes = new Map<string, Medicao>();
let contMedicao = 0;
let contItem = 0;

// ─── Service ─────────────────────────────────────────────────────────────────

export class MedicaoPagamentoService {
  static _reset(): void {
    medicoes.clear();
    contMedicao = 0;
    contItem = 0;
  }

  static criarMedicao(params: {
    tenantId: string;
    titulo: string;
    contratoRef: string;
    periodo: string;
    medicaoNumero: number;
    concessionaria: string;
    responsavel: string;
    retencaoPercentual?: number;
  }): Medicao {
    contMedicao += 1;
    const medicao: Medicao = {
      id: `med-${contMedicao}`,
      tenantId: params.tenantId,
      titulo: params.titulo,
      contratoRef: params.contratoRef,
      periodo: params.periodo,
      medicaoNumero: params.medicaoNumero,
      concessionaria: params.concessionaria,
      responsavel: params.responsavel,
      retencaoPercentual: params.retencaoPercentual ?? 5,
      status: "em_elaboracao",
      itens: [],
      criadoEm: new Date().toISOString(),
    };
    medicoes.set(medicao.id, medicao);
    return medicao;
  }

  static listarMedicoes(tenantId?: string): Medicao[] {
    const lista = Array.from(medicoes.values());
    return tenantId ? lista.filter((m) => m.tenantId === tenantId) : lista;
  }

  static obterMedicao(id: string): Medicao | undefined {
    return medicoes.get(id);
  }

  static adicionarItem(
    medicaoId: string,
    params: {
      wbsCode: string;
      descricao: string;
      tipoServico: TipoServico;
      unidade: string;
      quantidadeContratada: number;
      quantidadeMedida: number;
      valorUnitario: number;
    }
  ): ItemMedicao {
    const medicao = medicoes.get(medicaoId);
    if (!medicao) throw new Error(`Medição ${medicaoId} não encontrada`);
    if (
      medicao.status !== "em_elaboracao" &&
      medicao.status !== "rejeitada"
    ) {
      throw new Error("Itens só podem ser alterados em medições em elaboração ou rejeitadas");
    }
    if (params.quantidadeMedida > params.quantidadeContratada) {
      throw new Error(
        `Quantidade medida (${params.quantidadeMedida}) não pode superar contratada (${params.quantidadeContratada})`
      );
    }
    contItem += 1;
    const item: ItemMedicao = {
      id: `im-${contItem}`,
      wbsCode: params.wbsCode,
      descricao: params.descricao,
      tipoServico: params.tipoServico,
      unidade: params.unidade,
      quantidadeContratada: params.quantidadeContratada,
      quantidadeMedida: params.quantidadeMedida,
      valorUnitario: params.valorUnitario,
      valorTotal: params.quantidadeMedida * params.valorUnitario,
      percentualContrato:
        params.quantidadeContratada > 0
          ? (params.quantidadeMedida / params.quantidadeContratada) * 100
          : 0,
    };
    medicao.itens.push(item);
    return item;
  }

  static calcularMedicao(medicaoId: string): ResultadoMedicao {
    const medicao = medicoes.get(medicaoId);
    if (!medicao) throw new Error(`Medição ${medicaoId} não encontrada`);
    if (medicao.itens.length === 0) {
      throw new Error("Adicione pelo menos um item antes de calcular");
    }

    const itensValidos = medicao.itens.filter((i) => i.quantidadeMedida > 0);
    const itensPendentes = medicao.itens.filter((i) => i.quantidadeMedida === 0);

    const totalBruto = medicao.itens.reduce((acc, i) => acc + i.valorTotal, 0);
    const retencao = totalBruto * (medicao.retencaoPercentual / 100);
    const totalLiquido = totalBruto - retencao;

    const totalContratado = medicao.itens.reduce(
      (acc, i) => acc + i.quantidadeContratada * i.valorUnitario,
      0
    );
    const percentualGeralContrato =
      totalContratado > 0 ? (totalBruto / totalContratado) * 100 : 0;

    const payload = JSON.stringify({
      medicaoId,
      totalBruto,
      retencao,
      itens: medicao.itens.map((i) => ({
        wbs: i.wbsCode,
        qtd: i.quantidadeMedida,
        vt: i.valorTotal,
      })),
    });
    const hashIntegridade = createHash("sha256").update(payload).digest("hex");
    const calculadoEm = new Date().toISOString();

    const resultado: ResultadoMedicao = {
      medicaoId,
      totalBruto,
      retencao,
      totalLiquido,
      percentualGeralContrato: Math.round(percentualGeralContrato * 100) / 100,
      itensValidos: itensValidos.length,
      itensPendentes: itensPendentes.length,
      hashIntegridade,
      calculadoEm,
    };
    medicao.resultado = resultado;
    return resultado;
  }

  static submeterMedicao(medicaoId: string): Medicao {
    const medicao = medicoes.get(medicaoId);
    if (!medicao) throw new Error(`Medição ${medicaoId} não encontrada`);
    if (!medicao.resultado) {
      throw new Error("Execute o cálculo antes de submeter");
    }
    if (
      medicao.status !== "em_elaboracao" &&
      medicao.status !== "rejeitada"
    ) {
      throw new Error("Medição não está em estado válido para submissão");
    }
    medicao.status = "submetida";
    medicao.submetidoEm = new Date().toISOString();
    return medicao;
  }

  static aprovarMedicao(medicaoId: string): Medicao {
    const medicao = medicoes.get(medicaoId);
    if (!medicao) throw new Error(`Medição ${medicaoId} não encontrada`);
    if (medicao.status !== "submetida") {
      throw new Error("Apenas medições submetidas podem ser aprovadas");
    }
    medicao.status = "aprovada";
    medicao.aprovadoEm = new Date().toISOString();
    return medicao;
  }

  static rejeitarMedicao(medicaoId: string, motivo: string): Medicao {
    const medicao = medicoes.get(medicaoId);
    if (!medicao) throw new Error(`Medição ${medicaoId} não encontrada`);
    if (medicao.status !== "submetida") {
      throw new Error("Apenas medições submetidas podem ser rejeitadas");
    }
    medicao.status = "rejeitada";
    medicao.motivoRejeicao = motivo;
    return medicao;
  }

  static homologarMedicao(medicaoId: string): Medicao {
    const medicao = medicoes.get(medicaoId);
    if (!medicao) throw new Error(`Medição ${medicaoId} não encontrada`);
    if (medicao.status !== "aprovada") {
      throw new Error("Apenas medições aprovadas podem ser homologadas");
    }
    medicao.status = "homologada";
    medicao.homologadoEm = new Date().toISOString();
    return medicao;
  }

  static listarTiposServico(): TipoServico[] {
    return [
      "fornecimento_material",
      "montagem_eletrica",
      "obras_civis",
      "instalacao_equipamentos",
      "comissionamento",
      "ensaios",
      "supervisao",
      "mobilizacao",
      "desmobilizacao",
    ];
  }
}
