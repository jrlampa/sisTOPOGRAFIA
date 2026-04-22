/**
 * Serviço T2-67 — Ciclo As-Built Mobile
 * Retorno dinâmico de dados de campo para atualização do projeto original.
 */

import { createHash } from "crypto";

export type TipoDesvio =
  | "posicao"
  | "altura"
  | "tipo_equipamento"
  | "numeracao"
  | "circuito"
  | "carga"
  | "outro";

export type ImpactoDesvio = "baixo" | "medio" | "alto" | "critico";
export type StatusDesvio = "pendente" | "aceito" | "rejeitado";
export type StatusRegistro =
  | "em_campo"
  | "sincronizado"
  | "conflito"
  | "rejeitado"
  | "aprovado";

export interface DesvioAsBuilt {
  id: string;
  registroId: string;
  assetId: string;
  tipoDesvio: TipoDesvio;
  descricao: string;
  valorOriginal?: string;
  valorExecutado: string;
  coordenadasCampo?: { lat: number; lon: number };
  impacto: ImpactoDesvio;
  statusDesvio: StatusDesvio;
  criadoEm: string;
}

export interface RegistroAsBuilt {
  id: string;
  tenantId: string;
  projetoId: string;
  nomeProjeto: string;
  responsavelCampo: string;
  data: string;
  status: StatusRegistro;
  desvios: DesvioAsBuilt[];
  observacoesCampo: string;
  hashIntegridade?: string;
  aprovadoPor?: string;
  aprovadoEm?: string;
  motivoRejeicao?: string;
  criadoEm: string;
}

let _registroCounter = 0;
let _desvioCounter = 0;
const _registros = new Map<string, RegistroAsBuilt>();

export class AsBuiltMobileService {
  static _reset(): void {
    _registroCounter = 0;
    _desvioCounter = 0;
    _registros.clear();
  }

  static criarRegistro(data: {
    tenantId: string;
    projetoId: string;
    nomeProjeto: string;
    responsavelCampo: string;
    data: string;
    observacoesCampo?: string;
  }): RegistroAsBuilt {
    const id = `ab-${++_registroCounter}`;
    const registro: RegistroAsBuilt = {
      id,
      tenantId: data.tenantId,
      projetoId: data.projetoId,
      nomeProjeto: data.nomeProjeto,
      responsavelCampo: data.responsavelCampo,
      data: data.data,
      status: "em_campo",
      desvios: [],
      observacoesCampo: data.observacoesCampo ?? "",
      criadoEm: new Date().toISOString(),
    };
    _registros.set(id, registro);
    return registro;
  }

  static listarRegistros(tenantId?: string): RegistroAsBuilt[] {
    const all = Array.from(_registros.values());
    return tenantId ? all.filter((r) => r.tenantId === tenantId) : all;
  }

  static obterRegistro(id: string): RegistroAsBuilt | undefined {
    return _registros.get(id);
  }

  static adicionarDesvio(
    registroId: string,
    data: {
      assetId: string;
      tipoDesvio: TipoDesvio;
      descricao: string;
      valorOriginal?: string;
      valorExecutado: string;
      coordenadasCampo?: { lat: number; lon: number };
      impacto: ImpactoDesvio;
    }
  ): DesvioAsBuilt {
    const registro = _registros.get(registroId);
    if (!registro) throw new Error("Registro As-Built não encontrado");
    if (registro.status === "aprovado" || registro.status === "rejeitado") {
      throw new Error("Registro já finalizado — não é possível adicionar desvios");
    }
    const desvio: DesvioAsBuilt = {
      id: `dv-${++_desvioCounter}`,
      registroId,
      assetId: data.assetId,
      tipoDesvio: data.tipoDesvio,
      descricao: data.descricao,
      valorOriginal: data.valorOriginal,
      valorExecutado: data.valorExecutado,
      coordenadasCampo: data.coordenadasCampo,
      impacto: data.impacto,
      statusDesvio: "pendente",
      criadoEm: new Date().toISOString(),
    };
    registro.desvios.push(desvio);
    return desvio;
  }

  static sincronizarRegistro(registroId: string): RegistroAsBuilt {
    const registro = _registros.get(registroId);
    if (!registro) throw new Error("Registro As-Built não encontrado");
    if (registro.desvios.length === 0) {
      throw new Error("Registro deve ter ao menos 1 desvio para ser sincronizado");
    }
    if (registro.status === "aprovado" || registro.status === "rejeitado") {
      throw new Error("Registro já finalizado");
    }
    // Detecta conflito se há desvios críticos
    const temCritico = registro.desvios.some((d) => d.impacto === "critico");
    registro.status = temCritico ? "conflito" : "sincronizado";
    return registro;
  }

  static aprovarRegistro(
    registroId: string,
    aprovadoPor: string
  ): RegistroAsBuilt {
    const registro = _registros.get(registroId);
    if (!registro) throw new Error("Registro As-Built não encontrado");
    if (registro.status !== "sincronizado") {
      throw new Error("Registro deve estar sincronizado para ser aprovado");
    }
    const now = new Date().toISOString();
    registro.hashIntegridade = createHash("sha256")
      .update(
        JSON.stringify({
          id: registro.id,
          projetoId: registro.projetoId,
          desvios: registro.desvios.length,
          data: registro.data,
        })
      )
      .digest("hex");
    registro.status = "aprovado";
    registro.aprovadoPor = aprovadoPor;
    registro.aprovadoEm = now;
    // Aceita todos os desvios pendentes
    registro.desvios.forEach((d) => {
      if (d.statusDesvio === "pendente") d.statusDesvio = "aceito";
    });
    return registro;
  }

  static rejeitarRegistro(registroId: string, motivo: string): RegistroAsBuilt {
    const registro = _registros.get(registroId);
    if (!registro) throw new Error("Registro As-Built não encontrado");
    if (registro.status === "aprovado") {
      throw new Error("Registro já aprovado não pode ser rejeitado");
    }
    registro.status = "rejeitado";
    registro.motivoRejeicao = motivo;
    registro.desvios.forEach((d) => {
      if (d.statusDesvio === "pendente") d.statusDesvio = "rejeitado";
    });
    return registro;
  }

  static listarTiposDesvio(): TipoDesvio[] {
    return [
      "posicao",
      "altura",
      "tipo_equipamento",
      "numeracao",
      "circuito",
      "carga",
      "outro",
    ];
  }
}
