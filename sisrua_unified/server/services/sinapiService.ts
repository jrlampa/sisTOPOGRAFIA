/**
 * sinapiService.ts — Integração SINAPI/ORSE (T2-42).
 *
 * Roadmap Item 42 [T2]: Integração SINAPI/ORSE — Motor de orçamentação
 * com tabelas de preços oficiais.
 *
 * SINAPI: Sistema Nacional de Pesquisa de Custos e Índices da Construção Civil
 *   (IBGE/Caixa Econômica Federal). Tabela oficial de preços unitários de
 *   materiais, mão de obra e serviços da construção civil no Brasil.
 *
 * ORSE: Orçamento de Obras do Estado de Sergipe — tabela complementar
 *   frequentemente adotada por concessionárias de energia para obras de
 *   distribuição elétrica quando SINAPI não contempla o insumo.
 *
 * Funcionalidades:
 *   - Catálogo pré-carregado de itens SINAPI representativos de obras elétricas
 *   - Consulta por código, descrição, estado, categoria
 *   - Geração de orçamento com quantidades → custo direto
 *   - Relatório de orçamento com hashIntegridade SHA-256
 */

import { createHash, randomUUID } from "crypto";

// ─── Tipos ────────────────────────────────────────────────────────────────────

/** Origem da tabela de preços. */
export type FonteTabela = "SINAPI" | "ORSE";

/** Estado federativo (UF). */
export type UFBrasil =
  | "AC" | "AL" | "AM" | "AP" | "BA" | "CE" | "DF" | "ES" | "GO"
  | "MA" | "MG" | "MS" | "MT" | "PA" | "PB" | "PE" | "PI" | "PR"
  | "RJ" | "RN" | "RO" | "RR" | "RS" | "SC" | "SE" | "SP" | "TO";

/** Categoria de serviço/material. */
export type CategoriaSinapi =
  | "postes_estruturas"
  | "cabos_condutores"
  | "transformadores"
  | "medicao_protecao"
  | "iluminacao_publica"
  | "servicos_eletricos"
  | "obras_civis"
  | "equipamentos_gerais";

/** Item do catálogo SINAPI. */
export interface ItemSinapi {
  codigo: string;
  descricao: string;
  unidade: string;
  /** Preço unitário desonerado em R$. */
  precoUnitario: number;
  categoria: CategoriaSinapi;
  fonte: FonteTabela;
  /** UF de referência; "BR" = nacional. */
  uf: UFBrasil | "BR";
  mesReferencia: string; // "YYYY-MM"
  ativo: boolean;
}

/** Item de orçamento: associação de ItemSinapi a quantidade. */
export interface ItemOrcamento {
  codigoSinapi: string;
  quantidade: number;
  /** Preço unitário aplicado (pode sobrescrever o catálogo para cotação). */
  precoUnitarioAplicado?: number;
  observacao?: string;
}

/** Orçamento completo. */
export interface OrcamentoSinapi {
  id: string;
  descricao: string;
  tenantId: string;
  projetoId?: string;
  uf: UFBrasil;
  itens: ItemOrcamentoCalculado[];
  custoDirectoTotal: number;
  mesReferencia: string;
  hashIntegridade: string;
  criadoEm: Date;
  status: "rascunho" | "validado" | "aprovado";
}

/** Item com cálculo detalhado. */
export interface ItemOrcamentoCalculado {
  codigoSinapi: string;
  descricao: string;
  unidade: string;
  quantidade: number;
  precoUnitario: number;
  total: number;
  categoria: CategoriaSinapi;
  fonte: FonteTabela;
  observacao?: string;
}

// ─── Catálogo pré-carregado (itens representativos de obras elétricas) ────────

function makeCatalogo(): ItemSinapi[] {
  const ref = "2024-12";
  return [
    // Postes e Estruturas
    {
      codigo: "74131/001",
      descricao: "Poste de concreto centrifugado circular, H=11m, Esforço=600daN",
      unidade: "un",
      precoUnitario: 1320.50,
      categoria: "postes_estruturas",
      fonte: "SINAPI",
      uf: "BR",
      mesReferencia: ref,
      ativo: true,
    },
    {
      codigo: "74131/002",
      descricao: "Poste de concreto centrifugado circular, H=11m, Esforço=1000daN",
      unidade: "un",
      precoUnitario: 1540.00,
      categoria: "postes_estruturas",
      fonte: "SINAPI",
      uf: "BR",
      mesReferencia: ref,
      ativo: true,
    },
    {
      codigo: "74131/003",
      descricao: "Poste de concreto centrifugado circular, H=13m, Esforço=600daN",
      unidade: "un",
      precoUnitario: 1680.75,
      categoria: "postes_estruturas",
      fonte: "SINAPI",
      uf: "BR",
      mesReferencia: ref,
      ativo: true,
    },
    {
      codigo: "74131/004",
      descricao: "Poste de madeira imunizado, H=9m",
      unidade: "un",
      precoUnitario: 480.00,
      categoria: "postes_estruturas",
      fonte: "SINAPI",
      uf: "BR",
      mesReferencia: ref,
      ativo: true,
    },
    // Cabos e Condutores
    {
      codigo: "74129/001",
      descricao: "Cabo de alumínio nu, 35mm², classe ACSR",
      unidade: "m",
      precoUnitario: 8.90,
      categoria: "cabos_condutores",
      fonte: "SINAPI",
      uf: "BR",
      mesReferencia: ref,
      ativo: true,
    },
    {
      codigo: "74129/002",
      descricao: "Cabo de alumínio nu, 70mm², classe ACSR",
      unidade: "m",
      precoUnitario: 14.20,
      categoria: "cabos_condutores",
      fonte: "SINAPI",
      uf: "BR",
      mesReferencia: ref,
      ativo: true,
    },
    {
      codigo: "74129/003",
      descricao: "Cabo de alumínio multiplexado (CAM) 3x16mm² + N16mm²",
      unidade: "m",
      precoUnitario: 22.40,
      categoria: "cabos_condutores",
      fonte: "SINAPI",
      uf: "BR",
      mesReferencia: ref,
      ativo: true,
    },
    {
      codigo: "74129/004",
      descricao: "Cabo de alumínio multiplexado (CAM) 3x35mm² + N35mm²",
      unidade: "m",
      precoUnitario: 38.60,
      categoria: "cabos_condutores",
      fonte: "SINAPI",
      uf: "BR",
      mesReferencia: ref,
      ativo: true,
    },
    {
      codigo: "74129/005",
      descricao: "Cabo de alumínio compacto (CAC) 4x35mm² protegido",
      unidade: "m",
      precoUnitario: 45.80,
      categoria: "cabos_condutores",
      fonte: "SINAPI",
      uf: "BR",
      mesReferencia: ref,
      ativo: true,
    },
    // Transformadores
    {
      codigo: "74133/001",
      descricao: "Transformador monofásico 5kVA, 13,8kV/220V",
      unidade: "un",
      precoUnitario: 3850.00,
      categoria: "transformadores",
      fonte: "SINAPI",
      uf: "BR",
      mesReferencia: ref,
      ativo: true,
    },
    {
      codigo: "74133/002",
      descricao: "Transformador trifásico 30kVA, 13,8kV/220-127V",
      unidade: "un",
      precoUnitario: 9200.00,
      categoria: "transformadores",
      fonte: "SINAPI",
      uf: "BR",
      mesReferencia: ref,
      ativo: true,
    },
    {
      codigo: "74133/003",
      descricao: "Transformador trifásico 75kVA, 13,8kV/220-127V",
      unidade: "un",
      precoUnitario: 18500.00,
      categoria: "transformadores",
      fonte: "SINAPI",
      uf: "BR",
      mesReferencia: ref,
      ativo: true,
    },
    {
      codigo: "74133/004",
      descricao: "Transformador trifásico 150kVA, 13,8kV/380-220V",
      unidade: "un",
      precoUnitario: 32000.00,
      categoria: "transformadores",
      fonte: "SINAPI",
      uf: "BR",
      mesReferencia: ref,
      ativo: true,
    },
    // Medição e Proteção
    {
      codigo: "74135/001",
      descricao: "Chave fusível tipo K (cutout), 15kV, 100A",
      unidade: "un",
      precoUnitario: 285.00,
      categoria: "medicao_protecao",
      fonte: "SINAPI",
      uf: "BR",
      mesReferencia: ref,
      ativo: true,
    },
    {
      codigo: "74135/002",
      descricao: "Para-raios de distribuição 12kV, 10kA, ZnO",
      unidade: "un",
      precoUnitario: 195.00,
      categoria: "medicao_protecao",
      fonte: "SINAPI",
      uf: "BR",
      mesReferencia: ref,
      ativo: true,
    },
    {
      codigo: "74135/003",
      descricao: "Relé de proteção digital multifunção 7SJ66",
      unidade: "un",
      precoUnitario: 8900.00,
      categoria: "medicao_protecao",
      fonte: "SINAPI",
      uf: "BR",
      mesReferencia: ref,
      ativo: true,
    },
    // Serviços Elétricos
    {
      codigo: "74137/001",
      descricao: "Instalação de poste de concreto com equipamentos, H=11m",
      unidade: "un",
      precoUnitario: 620.00,
      categoria: "servicos_eletricos",
      fonte: "SINAPI",
      uf: "BR",
      mesReferencia: ref,
      ativo: true,
    },
    {
      codigo: "74137/002",
      descricao: "Lançamento de cabo multiplexado CAM em rede aérea, até 70m vão",
      unidade: "m",
      precoUnitario: 12.80,
      categoria: "servicos_eletricos",
      fonte: "SINAPI",
      uf: "BR",
      mesReferencia: ref,
      ativo: true,
    },
    {
      codigo: "74137/003",
      descricao: "Instalação de transformador trifásico, até 150kVA",
      unidade: "un",
      precoUnitario: 1850.00,
      categoria: "servicos_eletricos",
      fonte: "SINAPI",
      uf: "BR",
      mesReferencia: ref,
      ativo: true,
    },
    {
      codigo: "74137/004",
      descricao: "Instalação de chave fusível com para-raios",
      unidade: "un",
      precoUnitario: 320.00,
      categoria: "servicos_eletricos",
      fonte: "SINAPI",
      uf: "BR",
      mesReferencia: ref,
      ativo: true,
    },
    // Iluminação Pública
    {
      codigo: "74139/001",
      descricao: "Luminária LED para iluminação pública 70W, IP66",
      unidade: "un",
      precoUnitario: 890.00,
      categoria: "iluminacao_publica",
      fonte: "SINAPI",
      uf: "BR",
      mesReferencia: ref,
      ativo: true,
    },
    {
      codigo: "74139/002",
      descricao: "Luminária LED para iluminação pública 150W, IP66",
      unidade: "un",
      precoUnitario: 1250.00,
      categoria: "iluminacao_publica",
      fonte: "SINAPI",
      uf: "BR",
      mesReferencia: ref,
      ativo: true,
    },
    // Obras Civis
    {
      codigo: "97630",
      descricao: "Escavação manual de vala em solo de 1ª categoria, prof. até 1,5m",
      unidade: "m³",
      precoUnitario: 38.50,
      categoria: "obras_civis",
      fonte: "SINAPI",
      uf: "BR",
      mesReferencia: ref,
      ativo: true,
    },
    {
      codigo: "97631",
      descricao: "Reaterro compactado de vala com material de 1ª categoria",
      unidade: "m³",
      precoUnitario: 22.10,
      categoria: "obras_civis",
      fonte: "SINAPI",
      uf: "BR",
      mesReferencia: ref,
      ativo: true,
    },
    // ORSE complementar
    {
      codigo: "ORSE-EL-001",
      descricao: "Fornecimento e instalação de caixa de medição monofásica padrão concessionária",
      unidade: "un",
      precoUnitario: 650.00,
      categoria: "medicao_protecao",
      fonte: "ORSE",
      uf: "SE",
      mesReferencia: ref,
      ativo: true,
    },
    {
      codigo: "ORSE-EL-002",
      descricao: "Fornecimento e instalação de ramal de ligação multiplexado até 15m",
      unidade: "un",
      precoUnitario: 420.00,
      categoria: "servicos_eletricos",
      fonte: "ORSE",
      uf: "SE",
      mesReferencia: ref,
      ativo: true,
    },
  ];
}

// ─── Estado interno ───────────────────────────────────────────────────────────

let catalogo: Map<string, ItemSinapi> = new Map();
let orcamentos: Map<string, OrcamentoSinapi> = new Map();
let contadorOrc = 0;

function initCatalogo(): void {
  catalogo = new Map();
  for (const item of makeCatalogo()) {
    catalogo.set(item.codigo, item);
  }
}

initCatalogo();

// ─── Serviço ──────────────────────────────────────────────────────────────────

export class SinapiService {
  static _reset(): void {
    initCatalogo();
    orcamentos = new Map();
    contadorOrc = 0;
  }

  // ── Catálogo ──────────────────────────────────────────────────────────────

  static listarCatalogo(filtros?: {
    categoria?: CategoriaSinapi;
    fonte?: FonteTabela;
    uf?: UFBrasil | "BR";
    busca?: string;
  }): ItemSinapi[] {
    let itens = Array.from(catalogo.values()).filter((i) => i.ativo);
    if (filtros?.categoria) itens = itens.filter((i) => i.categoria === filtros.categoria);
    if (filtros?.fonte) itens = itens.filter((i) => i.fonte === filtros.fonte);
    if (filtros?.uf) itens = itens.filter((i) => i.uf === filtros.uf || i.uf === "BR");
    if (filtros?.busca) {
      const b = filtros.busca.toLowerCase();
      itens = itens.filter(
        (i) => i.codigo.toLowerCase().includes(b) || i.descricao.toLowerCase().includes(b)
      );
    }
    return itens;
  }

  static obterItemPorCodigo(codigo: string): ItemSinapi | null {
    return catalogo.get(codigo) ?? null;
  }

  static listarCategorias(): CategoriaSinapi[] {
    const cats = new Set<CategoriaSinapi>();
    for (const item of catalogo.values()) cats.add(item.categoria);
    return Array.from(cats);
  }

  // ── Orçamento ─────────────────────────────────────────────────────────────

  static gerarOrcamento(params: {
    descricao: string;
    tenantId: string;
    uf: UFBrasil;
    itens: ItemOrcamento[];
    projetoId?: string;
  }): OrcamentoSinapi | { erro: string; itensNaoEncontrados: string[] } {
    const naoEncontrados: string[] = [];
    const itensCalculados: ItemOrcamentoCalculado[] = [];

    for (const itemReq of params.itens) {
      const ref = catalogo.get(itemReq.codigoSinapi);
      if (!ref) {
        naoEncontrados.push(itemReq.codigoSinapi);
        continue;
      }
      const preco = itemReq.precoUnitarioAplicado ?? ref.precoUnitario;
      itensCalculados.push({
        codigoSinapi: ref.codigo,
        descricao: ref.descricao,
        unidade: ref.unidade,
        quantidade: itemReq.quantidade,
        precoUnitario: preco,
        total: parseFloat((preco * itemReq.quantidade).toFixed(2)),
        categoria: ref.categoria,
        fonte: ref.fonte,
        observacao: itemReq.observacao,
      });
    }

    if (naoEncontrados.length > 0) {
      return { erro: "Itens não encontrados no catálogo", itensNaoEncontrados: naoEncontrados };
    }

    const custoDirectoTotal = parseFloat(
      itensCalculados.reduce((sum, i) => sum + i.total, 0).toFixed(2)
    );
    const mesReferencia = itensCalculados[0]?.fonte === "SINAPI"
      ? (catalogo.values().next().value as ItemSinapi | undefined)?.mesReferencia ?? "2024-12"
      : "2024-12";

    const id = `orc-${++contadorOrc}`;
    const hashIntegridade = createHash("sha256")
      .update(JSON.stringify({ id, itensCalculados, custoDirectoTotal }))
      .digest("hex");

    const orc: OrcamentoSinapi = {
      id,
      descricao: params.descricao,
      tenantId: params.tenantId,
      projetoId: params.projetoId,
      uf: params.uf,
      itens: itensCalculados,
      custoDirectoTotal,
      mesReferencia,
      hashIntegridade,
      criadoEm: new Date(),
      status: "rascunho",
    };
    orcamentos.set(id, orc);
    return orc;
  }

  static listarOrcamentos(tenantId: string): OrcamentoSinapi[] {
    return Array.from(orcamentos.values()).filter((o) => o.tenantId === tenantId);
  }

  static obterOrcamento(id: string): OrcamentoSinapi | null {
    return orcamentos.get(id) ?? null;
  }

  static atualizarStatusOrcamento(
    id: string,
    novoStatus: OrcamentoSinapi["status"]
  ): OrcamentoSinapi | null {
    const orc = orcamentos.get(id);
    if (!orc) return null;
    orc.status = novoStatus;
    return orc;
  }
}
