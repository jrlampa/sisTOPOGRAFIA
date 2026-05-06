/**
 * servidoesFundiariosService.ts — Gestão de Servidões e Memoriais Fundiários (T2-55).
 *
 * Roadmap Item 55 [T2]: Geração automatizada de memoriais de servidão e
 * cartas de anuência para faixa de passagem de redes elétricas.
 *
 * Referências:
 *   - NBR 14166:1998 — Rede de referência cadastral municipal
 *   - SIRGAS 2000 (EPSG:4674) — datum horizontal oficial Brasil
 *   - CC/2002 art. 1.378-1.389 — servidão predial no direito civil
 *   - Lei 9.427/1996 + Resolução ANEEL 414/2010 — faixa de servidão elétrica
 *   - INCRA — cadastro técnico rural (formato memorial descritivo)
 */

import { createHash } from "crypto";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type StatusProcesso =
  | "rascunho"
  | "memorial_gerado"
  | "carta_enviada"
  | "aprovado"
  | "registrado";

export interface CoordGeo {
  lat: number;  // WGS84 / SIRGAS 2000 decimal degrees
  lng: number;
  ordemPonto?: number;
}

export interface Imovel {
  id: string;
  matricula: string;               // Número de matrícula no cartório
  proprietario: string;            // Nome do proprietario(s)
  municipio: string;
  uf: string;
  cartorioRegistro?: string;       // Nome do cartório competente
  areaAfetadaM2: number;           // Área da servidão sobre este imóvel (m²)
  larguraFaixaM: number;           // Largura da faixa de servidão (m)
  comprimentoM?: number;           // Comprimento aproximado (m) — calculado se não informado
  coordenadas: CoordGeo[];         // Vértices do polígono de servidão (SIRGAS 2000)
  observacoes?: string;
}

export interface MemorialDescritivo {
  texto: string;
  dataGeracao: Date;
  hashIntegridade: string;
}

export interface CartaAnuencia {
  texto: string;
  dataGeracao: Date;
}

export interface ProcessoServidao {
  id: string;
  nome: string;
  tenantId: string;
  projetoId?: string;
  concessionaria?: string;
  tensaoKv?: number;              // Tensão nominal da linha (kV)
  imoveis: Imovel[];
  memorial?: MemorialDescritivo;
  cartasAnuencia?: CartaAnuencia[];
  status: StatusProcesso;
  criadoEm: Date;
  atualizadoEm: Date;
}

// ─── Estado interno ───────────────────────────────────────────────────────────

let processos: Map<string, ProcessoServidao> = new Map();
let contadorProcesso = 0;
let contadorImovel = 0;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatarDMS(decimal: number, tipo: "lat" | "lng"): string {
  const positivo = decimal >= 0;
  const abs = Math.abs(decimal);
  const graus = Math.floor(abs);
  const minutos = Math.floor((abs - graus) * 60);
  const segundos = ((abs - graus) * 60 - minutos) * 60;
  const direcao = tipo === "lat" ? (positivo ? "N" : "S") : (positivo ? "E" : "W");
  return `${graus}°${minutos}'${segundos.toFixed(2)}"${direcao}`;
}

function gerarTextoMemorial(processo: ProcessoServidao): string {
  const data = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const linhas: string[] = [
    `MEMORIAL DESCRITIVO DE SERVIDÃO DE PASSAGEM`,
    ``,
    `Processo: ${processo.nome}`,
    `Data: ${data}`,
    `Concessionária: ${processo.concessionaria ?? "N/D"}`,
    processo.tensaoKv ? `Tensão nominal: ${processo.tensaoKv} kV` : "",
    ``,
    `DESCRIÇÃO DOS IMÓVEIS AFETADOS`,
    ``,
  ];

  for (const imovel of processo.imoveis) {
    linhas.push(
      `Imóvel ${imovel.id}:`,
      `  Matrícula: ${imovel.matricula}`,
      `  Proprietário(s): ${imovel.proprietario}`,
      `  Município/UF: ${imovel.municipio}/${imovel.uf}`,
      imovel.cartorioRegistro ? `  Cartório: ${imovel.cartorioRegistro}` : "",
      `  Área afetada: ${imovel.areaAfetadaM2.toFixed(2)} m²`,
      `  Largura da faixa: ${imovel.larguraFaixaM.toFixed(1)} m`,
    );
    if (imovel.coordenadas.length > 0) {
      linhas.push(`  Vértices da faixa (SIRGAS 2000):`);
      imovel.coordenadas.forEach((c, i) => {
        linhas.push(`    V${i + 1}: ${formatarDMS(c.lat, "lat")} / ${formatarDMS(c.lng, "lng")}`);
      });
    }
    linhas.push("");
  }

  const areaTotal = processo.imoveis.reduce((s, i) => s + i.areaAfetadaM2, 0);
  linhas.push(
    `ÁREA TOTAL DE SERVIDÃO: ${areaTotal.toFixed(2)} m² (${(areaTotal / 10000).toFixed(4)} ha)`,
    ``,
    `Elaborado em conformidade com a NBR 14166:1998, SIRGAS 2000 (EPSG:4674),`,
    `CC/2002 art. 1.378-1.389 e Resolução ANEEL 414/2010.`,
  );
  return linhas.filter((l) => l !== "").join("\n");
}

function gerarCartaAnuencia(imovel: Imovel, processo: ProcessoServidao): CartaAnuencia {
  const data = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const texto = [
    `CARTA DE ANUÊNCIA — SERVIDÃO DE PASSAGEM`,
    ``,
    `Eu/Nós, ${imovel.proprietario}, proprietário(s) do imóvel com matrícula nº ${imovel.matricula}`,
    `registrada no Cartório ${imovel.cartorioRegistro ?? "competente"}, situado no município de`,
    `${imovel.municipio}/${imovel.uf}, DECLARO(AMOS) para os devidos fins que concordo(amos)`,
    `com a instituição de servidão de passagem sobre área de ${imovel.areaAfetadaM2.toFixed(2)} m²`,
    `para passagem de rede elétrica${processo.tensaoKv ? ` de ${processo.tensaoKv} kV` : ""} pela concessionária`,
    `${processo.concessionaria ?? "competente"}, conforme levantamento técnico referente ao`,
    `Processo ${processo.nome}, na data de ${data}.`,
    ``,
    `Local e Data: _____________________, ${data}`,
    ``,
    `Assinatura: _______________________________`,
    `Nome legível: ${imovel.proprietario}`,
    `CPF/CNPJ: ____________________________`,
  ].join("\n");

  return { texto, dataGeracao: new Date() };
}

// ─── Serviço ──────────────────────────────────────────────────────────────────

export class ServidoesFundiariosService {
  static _reset(): void {
    processos = new Map();
    contadorProcesso = 0;
    contadorImovel = 0;
  }

  static criarProcesso(params: {
    nome: string;
    tenantId: string;
    projetoId?: string;
    concessionaria?: string;
    tensaoKv?: number;
  }): ProcessoServidao {
    const id = `srv-${++contadorProcesso}`;
    const agora = new Date();
    const processo: ProcessoServidao = {
      id,
      nome: params.nome,
      tenantId: params.tenantId,
      projetoId: params.projetoId,
      concessionaria: params.concessionaria,
      tensaoKv: params.tensaoKv,
      imoveis: [],
      status: "rascunho",
      criadoEm: agora,
      atualizadoEm: agora,
    };
    processos.set(id, processo);
    return processo;
  }

  static listarProcessos(tenantId: string): ProcessoServidao[] {
    return Array.from(processos.values()).filter((p) => p.tenantId === tenantId);
  }

  static obterProcesso(id: string): ProcessoServidao | null {
    return processos.get(id) ?? null;
  }

  static adicionarImovel(
    processoId: string,
    params: {
      matricula: string;
      proprietario: string;
      municipio: string;
      uf: string;
      cartorioRegistro?: string;
      areaAfetadaM2: number;
      larguraFaixaM: number;
      comprimentoM?: number;
      coordenadas?: CoordGeo[];
      observacoes?: string;
    }
  ): ProcessoServidao | null {
    const proc = processos.get(processoId);
    if (!proc) return null;
    const imovel: Imovel = {
      id: `imovel-${++contadorImovel}`,
      ...params,
      coordenadas: params.coordenadas ?? [],
    };
    proc.imoveis.push(imovel);
    proc.status = "rascunho";
    proc.memorial = undefined;
    proc.cartasAnuencia = undefined;
    proc.atualizadoEm = new Date();
    return proc;
  }

  static gerarMemorial(id: string): ProcessoServidao | { erro: string } {
    const proc = processos.get(id);
    if (!proc) return { erro: "Processo não encontrado" };
    if (proc.imoveis.length === 0) return { erro: "Nenhum imóvel cadastrado no processo" };

    const texto = gerarTextoMemorial(proc);
    const hashIntegridade = createHash("sha256").update(texto).digest("hex");
    proc.memorial = { texto, dataGeracao: new Date(), hashIntegridade };
    proc.status = "memorial_gerado";
    proc.atualizadoEm = new Date();
    return proc;
  }

  static emitirCartasAnuencia(id: string): ProcessoServidao | { erro: string } {
    const proc = processos.get(id);
    if (!proc) return { erro: "Processo não encontrado" };
    if (proc.imoveis.length === 0) return { erro: "Nenhum imóvel cadastrado" };

    proc.cartasAnuencia = proc.imoveis.map((i) => gerarCartaAnuencia(i, proc));
    proc.status = "carta_enviada";
    proc.atualizadoEm = new Date();
    return proc;
  }

  static aprovarProcesso(id: string): ProcessoServidao | null {
    const proc = processos.get(id);
    if (!proc || proc.status === "rascunho") return null;
    proc.status = "aprovado";
    proc.atualizadoEm = new Date();
    return proc;
  }
}
