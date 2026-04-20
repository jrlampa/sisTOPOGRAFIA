/**
 * licitacoesService.ts — Trilha de Evidências para Licitações (Ponto 120 [T1]).
 *
 * Gera pacote consolidado de conformidade técnica para editais e due diligence:
 * - Coleta evidências de todos os requisitos regulatórios mapeados
 * - Gera hash SHA-256 do pacote completo
 * - Exporta JSON estruturado para entregas em processos licitatórios
 */

import { createHash } from "crypto";
import {
  gerarRelatorio,
  listarItens,
} from "./rastreabilidadeRegulatoriaService.js";

export type StatusPacoteLicitacao = "rascunho" | "validado" | "emitido";

export interface SumarioConformidade {
  totalRequisitos: number;
  conformes: number;
  percentualConformidade: number;
  dataVerificacao: Date;
}

export interface EvidenciaLicitacao {
  referenciaRequisito: string;
  norma: string;
  descricao: string;
  artefatos: string[];
  statusConformidade: string;
}

export interface PacoteLicitacao {
  id: string;
  titulo: string;
  orgaoEdital?: string;
  numeroEdital?: string;
  status: StatusPacoteLicitacao;
  sumario: SumarioConformidade;
  evidencias: EvidenciaLicitacao[];
  hashPacote: string;
  geradoEm: Date;
  emitidoEm?: Date;
}

const pacotes = new Map<string, PacoteLicitacao>();
let seq = 1;

function gerarIdPacote(): string {
  return `LIC-${Date.now()}-${seq++}`;
}

function calcularHash(obj: unknown): string {
  const json = JSON.stringify(obj, null, 0);
  return createHash("sha256").update(json).digest("hex");
}

export function gerarPacote(
  titulo: string,
  orgaoEdital?: string,
  numeroEdital?: string,
): PacoteLicitacao {
  const relatorio = gerarRelatorio();
  const itens = listarItens();

  const evidencias: EvidenciaLicitacao[] = itens.map((item) => ({
    referenciaRequisito: item.id,
    norma: item.requisito.norma,
    descricao: item.requisito.descricao,
    artefatos: [
      ...item.implementacoes.map(
        (i) => `[${i.tipo.toUpperCase()}] ${i.referencia}`,
      ),
      ...item.testes.map((t) => `[TESTE] ${t.referencia}`),
    ],
    statusConformidade: item.status,
  }));

  const sumario: SumarioConformidade = {
    totalRequisitos: relatorio.totalItens,
    conformes: relatorio.conformes,
    percentualConformidade: relatorio.percentualConformidade,
    dataVerificacao: new Date(),
  };

  // Hash calculado sobre o conteúdo do pacote (sem o próprio hash)
  const conteudo = { titulo, orgaoEdital, numeroEdital, sumario, evidencias };
  const hashPacote = calcularHash(conteudo);

  const pacote: PacoteLicitacao = {
    id: gerarIdPacote(),
    titulo,
    orgaoEdital,
    numeroEdital,
    status: "rascunho",
    sumario,
    evidencias,
    hashPacote,
    geradoEm: new Date(),
  };

  pacotes.set(pacote.id, pacote);
  return pacote;
}

export function listarPacotes(): PacoteLicitacao[] {
  return [...pacotes.values()].sort(
    (a, b) => b.geradoEm.getTime() - a.geradoEm.getTime(),
  );
}

export function obterPacote(id: string): PacoteLicitacao | undefined {
  return pacotes.get(id);
}

export function validarPacote(id: string): PacoteLicitacao | null {
  const pacote = pacotes.get(id);
  if (!pacote) return null;
  if (pacote.status === "emitido") return pacote;
  pacote.status = "validado";
  // Recalcula hash após validação
  const conteudo = {
    titulo: pacote.titulo,
    orgaoEdital: pacote.orgaoEdital,
    numeroEdital: pacote.numeroEdital,
    sumario: pacote.sumario,
    evidencias: pacote.evidencias,
  };
  pacote.hashPacote = calcularHash(conteudo);
  return pacote;
}

export function emitirPacote(id: string): PacoteLicitacao | null {
  const pacote = pacotes.get(id);
  if (!pacote || pacote.status === "rascunho") return null;
  pacote.status = "emitido";
  pacote.emitidoEm = new Date();
  return pacote;
}

export function verificarIntegridade(id: string): {
  integro: boolean;
  hashEsperado: string;
  hashAtual: string;
} {
  const pacote = pacotes.get(id);
  if (!pacote) return { integro: false, hashEsperado: "", hashAtual: "" };
  const conteudo = {
    titulo: pacote.titulo,
    orgaoEdital: pacote.orgaoEdital,
    numeroEdital: pacote.numeroEdital,
    sumario: pacote.sumario,
    evidencias: pacote.evidencias,
  };
  const hashAtual = calcularHash(conteudo);
  return {
    integro: hashAtual === pacote.hashPacote,
    hashEsperado: pacote.hashPacote,
    hashAtual,
  };
}
