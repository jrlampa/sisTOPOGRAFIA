/**
 * finOpsService.ts — FinOps: Controle de Custo Operacional (Item 130 [T1]).
 */
import { randomUUID } from "crypto";

export type AmbienteFinOps = 'dev' | 'homolog' | 'producao';
export type CategoriaFinOps = 'api_externa' | 'processamento' | 'armazenamento' | 'exportacao';

export interface RegistroCustoOp {
  id: string;
  ambiente: AmbienteFinOps;
  categoria: CategoriaFinOps;
  tenantId?: string;
  valorUsd: number;
  descricao: string;
  registradoEm: Date;
}

export interface OrcamentoAmbiente {
  ambiente: AmbienteFinOps;
  limiteMensalUsd: number;
  alertaPct: number;
}

const registros: RegistroCustoOp[] = [];
const orcamentos = new Map<AmbienteFinOps, OrcamentoAmbiente>();

export function registrarCusto(r: Omit<RegistroCustoOp, 'id' | 'registradoEm'>): RegistroCustoOp {
  const registro: RegistroCustoOp = { ...r, id: randomUUID(), registradoEm: new Date() };
  registros.push(registro);
  return registro;
}

export function definirOrcamento(o: OrcamentoAmbiente): void {
  orcamentos.set(o.ambiente, o);
}

export function consumoMensalPorAmbiente(ano: number, mes: number): Record<string, number> {
  const result: Record<string, number> = {};
  for (const r of registros) {
    if (r.registradoEm.getFullYear() === ano && r.registradoEm.getMonth() + 1 === mes) {
      result[r.ambiente] = (result[r.ambiente] ?? 0) + r.valorUsd;
    }
  }
  return result;
}

export function alertasOrcamento(ano: number, mes: number): Array<{ ambiente: string; consumoUsd: number; limiteMensalUsd: number; pctUsado: number; emAlerta: boolean }> {
  const consumo = consumoMensalPorAmbiente(ano, mes);
  const alertas: ReturnType<typeof alertasOrcamento> = [];
  for (const [ambiente, orc] of orcamentos.entries()) {
    const consumoUsd = consumo[ambiente] ?? 0;
    const pctUsado = orc.limiteMensalUsd > 0 ? (consumoUsd / orc.limiteMensalUsd) * 100 : 0;
    alertas.push({ ambiente, consumoUsd, limiteMensalUsd: orc.limiteMensalUsd, pctUsado, emAlerta: pctUsado >= orc.alertaPct });
  }
  return alertas;
}

export function resumoFinOps(): { totalRegistros: number; totalUsd: number; porAmbiente: Record<string, number>; porCategoria: Record<string, number> } {
  const porAmbiente: Record<string, number> = {};
  const porCategoria: Record<string, number> = {};
  let totalUsd = 0;
  for (const r of registros) {
    totalUsd += r.valorUsd;
    porAmbiente[r.ambiente] = (porAmbiente[r.ambiente] ?? 0) + r.valorUsd;
    porCategoria[r.categoria] = (porCategoria[r.categoria] ?? 0) + r.valorUsd;
  }
  return { totalRegistros: registros.length, totalUsd, porAmbiente, porCategoria };
}

/** Limpa estado (uso em testes) */
export function _resetFinOps(): void {
  registros.length = 0;
  orcamentos.clear();
}
