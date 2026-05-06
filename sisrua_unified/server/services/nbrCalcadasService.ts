/**
 * Serviço T2-108 — Verificador NBR 9050 (Acessibilidade Urbana) — Calçadas
 * Validação automática de faixas livres em calçadas urbanas.
 * Referência: ABNT NBR 9050:2020 §6.12 — Calçadas e vias de pedestres
 */

import { createHash } from "crypto";

export type TipoVia = "local" | "coletora" | "arterial" | "expressa";
export type TipoObstaculo =
  | "poste_iluminacao"
  | "poste_telefonia"
  | "arvore"
  | "banca_jornal"
  | "lixeira"
  | "placa_publicidade"
  | "mobiliario_urbano"
  | "outros";
export type StatusCalcada = "pendente" | "analisado" | "conforme" | "nao_conforme";

export interface Obstaculo {
  id: string;
  tipo: TipoObstaculo;
  posicaoM: number;
  larguraM: number;
  interfereFaixaLivre: boolean;
}

export interface ResultadoCalcada {
  conformeLarguraMinima: boolean;
  larguraMinimaExigidaM: number;
  faixaLivreDisponivelM: number;
  obstaculosNaFaixaLivre: number;
  desvios: string[];
  scoreConformidade: number;
  hashAnalise: string;
}

export interface RegistroCalcada {
  id: string;
  tenantId: string;
  logradouro: string;
  municipio: string;
  uf: string;
  tipoVia: TipoVia;
  larguraTotalM: number;
  faixaServicoM: number;
  faixaLivreM: number;
  faixaAcessoM: number;
  obstaculos: Obstaculo[];
  status: StatusCalcada;
  resultado?: ResultadoCalcada;
  tecnicoResponsavel: string;
  dataVistoria: string;
  criadoEm: string;
}

// Largura mínima da faixa livre por tipo de via (NBR 9050:2020 §6.12.1)
const FAIXA_LIVRE_MINIMA: Record<TipoVia, number> = {
  local: 1.2,
  coletora: 1.5,
  arterial: 2.0,
  expressa: 2.5,
};

let _registroCounter = 0;
let _obstaculoCounter = 0;
const _registros = new Map<string, RegistroCalcada>();

export class NbrCalcadasService {
  static _reset(): void {
    _registroCounter = 0;
    _obstaculoCounter = 0;
    _registros.clear();
  }

  static criarRegistro(data: {
    tenantId: string;
    logradouro: string;
    municipio: string;
    uf: string;
    tipoVia: TipoVia;
    larguraTotalM: number;
    faixaServicoM: number;
    faixaLivreM: number;
    faixaAcessoM: number;
    tecnicoResponsavel: string;
    dataVistoria: string;
  }): RegistroCalcada {
    const id = `rc-${++_registroCounter}`;
    const registro: RegistroCalcada = {
      id,
      tenantId: data.tenantId,
      logradouro: data.logradouro,
      municipio: data.municipio,
      uf: data.uf.toUpperCase().slice(0, 2),
      tipoVia: data.tipoVia,
      larguraTotalM: data.larguraTotalM,
      faixaServicoM: data.faixaServicoM,
      faixaLivreM: data.faixaLivreM,
      faixaAcessoM: data.faixaAcessoM,
      obstaculos: [],
      status: "pendente",
      tecnicoResponsavel: data.tecnicoResponsavel,
      dataVistoria: data.dataVistoria,
      criadoEm: new Date().toISOString(),
    };
    _registros.set(id, registro);
    return registro;
  }

  static listarRegistros(tenantId?: string): RegistroCalcada[] {
    const all = Array.from(_registros.values());
    return tenantId ? all.filter((r) => r.tenantId === tenantId) : all;
  }

  static obterRegistro(id: string): RegistroCalcada | undefined {
    return _registros.get(id);
  }

  static adicionarObstaculo(
    registroId: string,
    data: {
      tipo: TipoObstaculo;
      posicaoM: number;
      larguraM: number;
    }
  ): Obstaculo {
    const registro = _registros.get(registroId);
    if (!registro) throw new Error("Registro de calçada não encontrado");
    if (registro.status === "conforme" || registro.status === "nao_conforme") {
      throw new Error("Registro já analisado");
    }
    // Verifica se o obstáculo invade a faixa livre
    const faixaLivreDisponivel = registro.faixaLivreM;
    const obstaculoNaFaixaLivre = data.larguraM > 0 && faixaLivreDisponivel - data.larguraM < FAIXA_LIVRE_MINIMA[registro.tipoVia];
    const obstaculo: Obstaculo = {
      id: `ob-${++_obstaculoCounter}`,
      tipo: data.tipo,
      posicaoM: data.posicaoM,
      larguraM: data.larguraM,
      interfereFaixaLivre: obstaculoNaFaixaLivre,
    };
    registro.obstaculos.push(obstaculo);
    return obstaculo;
  }

  static analisarCalcada(registroId: string): RegistroCalcada {
    const registro = _registros.get(registroId);
    if (!registro) throw new Error("Registro de calçada não encontrado");
    const minimaExigida = FAIXA_LIVRE_MINIMA[registro.tipoVia];
    const desvios: string[] = [];
    let penalidades = 0;

    // Verifica largura total
    if (registro.larguraTotalM < minimaExigida + registro.faixaServicoM + registro.faixaAcessoM) {
      desvios.push(`Largura total insuficiente: ${registro.larguraTotalM.toFixed(2)} m (mínimo recomendado: ${(minimaExigida + registro.faixaServicoM + registro.faixaAcessoM).toFixed(2)} m)`);
      penalidades += 30;
    }

    // Verifica faixa livre
    const conformeLargura = registro.faixaLivreM >= minimaExigida;
    if (!conformeLargura) {
      desvios.push(`Faixa livre ${registro.faixaLivreM.toFixed(2)} m abaixo do mínimo de ${minimaExigida.toFixed(2)} m para via ${registro.tipoVia}`);
      penalidades += 40;
    }

    // Verifica obstáculos
    const obstNaFaixa = registro.obstaculos.filter((o) => o.interfereFaixaLivre);
    if (obstNaFaixa.length > 0) {
      desvios.push(`${obstNaFaixa.length} obstáculo(s) interfere(m) na faixa livre`);
      penalidades += obstNaFaixa.length * 15;
    }

    const score = Math.max(0, 100 - penalidades);
    const agora = new Date().toISOString();

    registro.resultado = {
      conformeLarguraMinima: conformeLargura,
      larguraMinimaExigidaM: minimaExigida,
      faixaLivreDisponivelM: registro.faixaLivreM,
      obstaculosNaFaixaLivre: obstNaFaixa.length,
      desvios,
      scoreConformidade: score,
      hashAnalise: createHash("sha256")
        .update(`${registroId}|${score}|${agora}`)
        .digest("hex"),
    };

    registro.status = score >= 70 ? "conforme" : "nao_conforme";
    return registro;
  }

  static listarTiposVia(): TipoVia[] {
    return ["local", "coletora", "arterial", "expressa"];
  }

  static obterLargurasMinimasPorTipoVia(): Record<TipoVia, number> {
    return { ...FAIXA_LIVRE_MINIMA };
  }
}
