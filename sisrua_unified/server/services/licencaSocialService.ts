/**
 * licencaSocialService.ts — Gestão de Licença Social / Public Opinion Insights (T2-82).
 *
 * Roadmap Item 82 [T2]: Controle de audiências públicas, consultas populares e
 * manifestações para gestão da licença social de empreendimentos de energia.
 *
 * Referências:
 *   - CONAMA Resolução 001/1986 e 009/1987: audiências públicas em EIA/RIMA
 *   - Lei 9.784/1999: processo administrativo federal — participação popular
 *   - ANEEL REN 395/2009 e REN 876/2020: audiências públicas do setor elétrico
 *   - NBR ISO 26000:2010: responsabilidade social — engajamento comunitário
 *   - Protocolo IFC (IFC Performance Standard 5): reacomodação e consulta
 */

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type TipoConsulta =
  | "audiencia_publica"              // Audiência pública formal (ANEEL / CONAMA)
  | "consulta_publica"               // Consulta pública por edital
  | "reuniao_comunitaria"            // Reunião direta com comunidade
  | "pesquisa_percepcao"             // Survey de percepção social
  | "oficina_participativa";         // Oficina de co-construção

export type StatusConsulta =
  | "planejado"
  | "em_consulta"
  | "concluido"
  | "aprovado"
  | "reprovado"
  | "cancelado";

export type NivelAceitacao =
  | "alto"     // >= 70% de aprovação
  | "moderado" // >= 50%
  | "baixo"    // >= 30%
  | "critico"; // < 30%

export type SegmentoStakeholder =
  | "comunidade_local"
  | "poder_publico"
  | "organizacoes_sociedade_civil"
  | "setor_privado"
  | "academia"
  | "imprensa"
  | "orgaos_ambientais";

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface Manifestacao {
  id: string;
  autor: string;
  segmento: SegmentoStakeholder;
  favoravel: boolean;
  descricao: string;
  dataRegistro: Date;
}

export interface ResultadoConsulta {
  totalManifestacoes: number;
  favoraveis: number;
  contrarias: number;
  indiceFavoresPct: number;
  nivelAceitacao: NivelAceitacao;
  porSegmento: Partial<Record<SegmentoStakeholder, { favoraveis: number; contrarias: number }>>;
  calculadoEm: Date;
}

export interface ConsultaPopular {
  id: string;
  nome: string;
  tenantId: string;
  projetoId?: string;
  municipio: string;
  uf: string;
  tipo: TipoConsulta;
  dataInicio: string;          // ISO date
  dataFim?: string;
  localRealizacao?: string;
  numParticipantes?: number;
  manifestacoes: Manifestacao[];
  resultado?: ResultadoConsulta;
  status: StatusConsulta;
  observacoes?: string;
  criadoEm: Date;
  atualizadoEm: Date;
}

// ─── Estado interno ───────────────────────────────────────────────────────────

let consultas: Map<string, ConsultaPopular> = new Map();
let contadorConsulta = 0;
let contadorManifestacao = 0;

// ─── Serviço ──────────────────────────────────────────────────────────────────

export class LicencaSocialService {
  static _reset(): void {
    consultas = new Map();
    contadorConsulta = 0;
    contadorManifestacao = 0;
  }

  static criarConsulta(params: {
    nome: string;
    tenantId: string;
    projetoId?: string;
    municipio: string;
    uf: string;
    tipo: TipoConsulta;
    dataInicio: string;
    dataFim?: string;
    localRealizacao?: string;
    observacoes?: string;
  }): ConsultaPopular {
    const id = `ls-${++contadorConsulta}`;
    const agora = new Date();
    const consulta: ConsultaPopular = {
      id,
      nome: params.nome,
      tenantId: params.tenantId,
      projetoId: params.projetoId,
      municipio: params.municipio,
      uf: params.uf.toUpperCase(),
      tipo: params.tipo,
      dataInicio: params.dataInicio,
      dataFim: params.dataFim,
      localRealizacao: params.localRealizacao,
      manifestacoes: [],
      status: "planejado",
      observacoes: params.observacoes,
      criadoEm: agora,
      atualizadoEm: agora,
    };
    consultas.set(id, consulta);
    return consulta;
  }

  static listarConsultas(tenantId: string): ConsultaPopular[] {
    return Array.from(consultas.values()).filter((c) => c.tenantId === tenantId);
  }

  static obterConsulta(id: string): ConsultaPopular | null {
    return consultas.get(id) ?? null;
  }

  static iniciarConsulta(id: string): ConsultaPopular | { erro: string } {
    const c = consultas.get(id);
    if (!c) return { erro: "Consulta não encontrada" };
    if (c.status !== "planejado") return { erro: "Consulta já foi iniciada ou encerrada" };
    c.status = "em_consulta";
    c.atualizadoEm = new Date();
    return c;
  }

  static registrarManifestacao(
    id: string,
    params: {
      autor: string;
      segmento: SegmentoStakeholder;
      favoravel: boolean;
      descricao: string;
    }
  ): ConsultaPopular | { erro: string } {
    const c = consultas.get(id);
    if (!c) return { erro: "Consulta não encontrada" };
    if (c.status !== "em_consulta") return { erro: "Consulta não está aberta para manifestações" };
    const manifestacao: Manifestacao = {
      id: `mf-${++contadorManifestacao}`,
      autor: params.autor,
      segmento: params.segmento,
      favoravel: params.favoravel,
      descricao: params.descricao,
      dataRegistro: new Date(),
    };
    c.manifestacoes.push(manifestacao);
    c.resultado = undefined;
    c.atualizadoEm = new Date();
    return c;
  }

  static calcularResultado(id: string): ConsultaPopular | { erro: string } {
    const c = consultas.get(id);
    if (!c) return { erro: "Consulta não encontrada" };
    if (c.manifestacoes.length === 0) return { erro: "Nenhuma manifestação registrada" };

    const total = c.manifestacoes.length;
    const favoraveis = c.manifestacoes.filter((m) => m.favoravel).length;
    const contrarias = total - favoraveis;
    const indiceFavor = (favoraveis / total) * 100;

    let nivelAceitacao: NivelAceitacao;
    if (indiceFavor >= 70) nivelAceitacao = "alto";
    else if (indiceFavor >= 50) nivelAceitacao = "moderado";
    else if (indiceFavor >= 30) nivelAceitacao = "baixo";
    else nivelAceitacao = "critico";

    const porSegmento: Partial<Record<SegmentoStakeholder, { favoraveis: number; contrarias: number }>> = {};
    for (const m of c.manifestacoes) {
      if (!porSegmento[m.segmento]) porSegmento[m.segmento] = { favoraveis: 0, contrarias: 0 };
      if (m.favoravel) porSegmento[m.segmento]!.favoraveis++;
      else porSegmento[m.segmento]!.contrarias++;
    }

    c.resultado = {
      totalManifestacoes: total,
      favoraveis,
      contrarias,
      indiceFavoresPct: parseFloat(indiceFavor.toFixed(1)),
      nivelAceitacao,
      porSegmento,
      calculadoEm: new Date(),
    };
    c.status = "concluido";
    c.atualizadoEm = new Date();
    return c;
  }

  static aprovarConsulta(id: string): ConsultaPopular | { erro: string } {
    const c = consultas.get(id);
    if (!c) return { erro: "Consulta não encontrada" };
    if (c.status !== "concluido") return { erro: "Calcule o resultado antes de aprovar" };
    if (!c.resultado) return { erro: "Resultado não calculado" };
    if (c.resultado.nivelAceitacao === "critico") {
      c.status = "reprovado";
    } else {
      c.status = "aprovado";
    }
    c.atualizadoEm = new Date();
    return c;
  }

  static listarTiposConsulta(): TipoConsulta[] {
    return [
      "audiencia_publica",
      "consulta_publica",
      "reuniao_comunitaria",
      "pesquisa_percepcao",
      "oficina_participativa",
    ];
  }
}
