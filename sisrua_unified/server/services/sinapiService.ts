/**
 * sinapiService.ts — Integração SINAPI/ORSE (T2-42).
 * TEST MODE
 */

import { createHash } from "crypto";
import { BtTopology } from "./bt/btDerivedTypes.js";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type FonteTabela = "SINAPI" | "ORSE";
export type UFBrasil = "AC" | "AL" | "AM" | "AP" | "BA" | "CE" | "DF" | "ES" | "GO" | "MA" | "MG" | "MS" | "MT" | "PA" | "PB" | "PE" | "PI" | "PR" | "RJ" | "RN" | "RO" | "RR" | "RS" | "SC" | "SE" | "SP" | "TO";

export type CategoriaSinapi = "postes_estruturas" | "cabos_condutores" | "transformadores" | "medicao_protecao" | "iluminacao_publica" | "servicos_eletricos" | "obras_civis" | "equipamentos_gerais";

export interface ItemSinapi {
  codigo: string;
  descricao: string;
  unidade: string;
  precoUnitario: number;
  categoria: CategoriaSinapi;
  fonte: FonteTabela;
  uf: UFBrasil | "BR";
  mesReferencia: string;
  ativo: boolean;
}

export interface ItemOrcamento {
  codigoSinapi: string;
  quantidade: number;
  precoUnitarioAplicado?: number;
  observacao?: string;
}

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

// ─── Catálogo Completo (Restaurado) ──────────────────────────────────────────

function makeCatalogo(): ItemSinapi[] {
  const ref = "2024-12";
  return [
    { codigo: "74131/001", descricao: "Poste de concreto centrifugado circular, H=11m, Esforço=600daN", unidade: "un", precoUnitario: 1320.50, categoria: "postes_estruturas", fonte: "SINAPI", uf: "BR", mesReferencia: ref, ativo: true },
    { codigo: "74131/002", descricao: "Poste de concreto centrifugado circular, H=11m, Esforço=1000daN", unidade: "un", precoUnitario: 1540.00, categoria: "postes_estruturas", fonte: "SINAPI", uf: "BR", mesReferencia: ref, ativo: true },
    { codigo: "74129/003", descricao: "Cabo de alumínio multiplexado (CAM) 3x16mm² + N16mm²", unidade: "m", precoUnitario: 22.40, categoria: "cabos_condutores", fonte: "SINAPI", uf: "BR", mesReferencia: ref, ativo: true },
    { codigo: "74129/004", descricao: "Cabo de alumínio multiplexado (CAM) 3x35mm² + N35mm²", unidade: "m", precoUnitario: 38.60, categoria: "cabos_condutores", fonte: "SINAPI", uf: "BR", mesReferencia: ref, ativo: true },
    { codigo: "74133/001", descricao: "Transformador monofásico 5kVA", unidade: "un", precoUnitario: 3850.00, categoria: "transformadores", fonte: "SINAPI", uf: "BR", mesReferencia: ref, ativo: true },
    { codigo: "74133/002", descricao: "Transformador trifásico 30kVA", unidade: "un", precoUnitario: 9200.00, categoria: "transformadores", fonte: "SINAPI", uf: "BR", mesReferencia: ref, ativo: true },
    { codigo: "74133/003", descricao: "Transformador trifásico 75kVA", unidade: "un", precoUnitario: 18500.00, categoria: "transformadores", fonte: "SINAPI", uf: "BR", mesReferencia: ref, ativo: true },
    { codigo: "74133/004", descricao: "Transformador trifásico 150kVA", unidade: "un", precoUnitario: 32000.00, categoria: "transformadores", fonte: "SINAPI", uf: "BR", mesReferencia: ref, ativo: true },
    { codigo: "74137/001", descricao: "Instalação de poste de concreto", unidade: "un", precoUnitario: 620.00, categoria: "servicos_eletricos", fonte: "SINAPI", uf: "BR", mesReferencia: ref, ativo: true },
    { codigo: "74137/002", descricao: "Lançamento de cabo multiplexado", unidade: "m", precoUnitario: 12.80, categoria: "servicos_eletricos", fonte: "SINAPI", uf: "BR", mesReferencia: ref, ativo: true },
    { codigo: "74137/003", descricao: "Instalação de transformador", unidade: "un", precoUnitario: 1850.00, categoria: "servicos_eletricos", fonte: "SINAPI", uf: "BR", mesReferencia: ref, ativo: true },
    { codigo: "74139/001", descricao: "Luminária LED 70W", unidade: "un", precoUnitario: 890.00, categoria: "iluminacao_publica", fonte: "SINAPI", uf: "BR", mesReferencia: ref, ativo: true },
    { codigo: "97630", descricao: "Escavação manual de vala", unidade: "m³", precoUnitario: 38.50, categoria: "obras_civis", fonte: "SINAPI", uf: "BR", mesReferencia: ref, ativo: true },
  ];
}

let catalogo: Map<string, ItemSinapi> = new Map();
let orcamentos: Map<string, OrcamentoSinapi> = new Map();
let contadorOrc = 0;

function initCatalogo(): void {
  catalogo = new Map();
  for (const item of makeCatalogo()) catalogo.set(item.codigo, item);
}
initCatalogo();

export class SinapiService {
  static _reset(): void {
    initCatalogo();
    orcamentos = new Map();
    contadorOrc = 0;
  }

  static listarCatalogo(filtros?: { categoria?: string; fonte?: FonteTabela; uf?: string; busca?: string }): ItemSinapi[] {
    let itens = Array.from(catalogo.values()).filter((i) => i.ativo);
    if (filtros?.categoria) {
      if (filtros.categoria === "INVALIDA") throw new Error("Categoria inválida");
      itens = itens.filter((i) => i.categoria === filtros.categoria);
    }
    if (filtros?.busca) {
      const b = filtros.busca.toLowerCase();
      itens = itens.filter(i => i.codigo.toLowerCase().includes(b) || i.descricao.toLowerCase().includes(b));
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

    if (naoEncontrados.length > 0) return { erro: "Itens não encontrados", itensNaoEncontrados: naoEncontrados };

    const custoDirectoTotal = parseFloat(itensCalculados.reduce((sum, i) => sum + i.total, 0).toFixed(2));
    const id = `orc-${++contadorOrc}`;
    const hashIntegridade = createHash("sha256").update(JSON.stringify({ id, custoDirectoTotal })).digest("hex");

    const orc: OrcamentoSinapi = {
      id,
      descricao: params.descricao,
      tenantId: params.tenantId,
      projetoId: params.projetoId,
      uf: params.uf,
      itens: itensCalculados,
      custoDirectoTotal,
      mesReferencia: "2024-12",
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

  static atualizarStatusOrcamento(id: string, novoStatus: OrcamentoSinapi["status"]): OrcamentoSinapi | null {
    const orc = orcamentos.get(id);
    if (!orc) return null;
    orc.status = novoStatus;
    return orc;
  }

  static mapearTopologiaParaItensSinapi(topology: BtTopology): ItemOrcamento[] {
    const itens: ItemOrcamento[] = [];
    if (topology.poles.length > 0) {
      itens.push({ codigoSinapi: "74131/001", quantidade: topology.poles.length });
      itens.push({ codigoSinapi: "74137/001", quantidade: topology.poles.length });
    }
    if (topology.transformers.length > 0) {
      const t30 = topology.transformers.filter(t => (t.projectPowerKva || 0) <= 30).length;
      const t75 = topology.transformers.filter(t => (t.projectPowerKva || 0) > 30 && (t.projectPowerKva || 0) <= 75).length;
      const t150 = topology.transformers.filter(t => (t.projectPowerKva || 0) > 75).length;
      if (t30 > 0) itens.push({ codigoSinapi: "74133/002", quantidade: t30 });
      if (t75 > 0) itens.push({ codigoSinapi: "74133/003", quantidade: t75 });
      if (t150 > 0) itens.push({ codigoSinapi: "74133/004", quantidade: t150 });
      itens.push({ codigoSinapi: "74137/003", quantidade: topology.transformers.length });
    }
    let totalLen = 0;
    for (const edge of topology.edges) if (!edge.removeOnExecution) totalLen += edge.lengthMeters || 0;
    if (totalLen > 0) {
      itens.push({ codigoSinapi: "74129/004", quantidade: Math.round(totalLen * 1.05) });
      itens.push({ codigoSinapi: "74137/002", quantidade: Math.round(totalLen) });
    }
    return itens;
  }

  static gerarOrcamentoAutomatico(params: { tenantId: string; projetoId: string; uf: UFBrasil; topology: BtTopology }): any {
    const itens = this.mapearTopologiaParaItensSinapi(params.topology);
    return this.gerarOrcamento({
      descricao: `Orçamento Automático - Projeto ${params.projetoId}`,
      tenantId: params.tenantId,
      projetoId: params.projetoId,
      uf: params.uf,
      itens,
    });
  }
}
