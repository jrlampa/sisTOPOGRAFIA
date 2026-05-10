/**
 * useBudget.ts — Hook para gerenciar orçamentação T2 (SINAPI, BDI, ROI).
 */

import { useState, useCallback } from "react";
import { API_BASE_URL } from "../config/api";
import { buildApiHeaders } from "../services/apiClient";
import type { BtTopology } from "../types";

export interface BudgetResult {
  sinapi: {
    id: string;
    custoDirectoTotal: number;
    itens: any[];
  } | null;
  bdi: {
    percentualBdi: number;
    custoComBdi: number;
    tributosTotais: number;
  } | null;
  roi: {
    vpl: number;
    tir: number;
    paybackSimples: number;
    viavel: boolean;
  } | null;
}

export function useBudget() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BudgetResult | null>(null);

  const calculateBudget = useCallback(
    async (topology: BtTopology, tenantId: string, projetoId: string) => {
      setLoading(true);
      setError(null);
      try {
        const headers = buildApiHeaders();

        // 1. Geração SINAPI Automática
        const sinapiRes = await fetch(`${API_BASE_URL}/sinapi/orcamento/auto`, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({
            tenantId,
            projetoId,
            uf: "SP", // Default UF
            topology,
          }),
        });
        const sinapiData = await sinapiRes.json();
        if (sinapiData.erro) throw new Error(sinapiData.erro);

        // 2. Cálculo BDI (Heurística baseada no custo direto)
        const bdiRes = await requestBdi(
          sinapiData.custoDirectoTotal,
          tenantId,
          projetoId,
        );

        // 3. Simulação ROI (Simplificada: Capex vs Economia estimada)
        const roiRes = await requestRoi(
          bdiRes.custoComBdi,
          tenantId,
          projetoId,
        );

        setResult({
          sinapi: sinapiData,
          bdi: bdiRes,
          roi: roiRes,
        });
      } catch (err: any) {
        setError(err.message || "Erro desconhecido na geração do orçamento.");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  async function requestBdi(
    custoDirecto: number,
    tenantId: string,
    projetoId: string,
  ) {
    const res = await fetch(`${API_BASE_URL}/bdi-roi/calcular-bdi`, {
      method: "POST",
      headers: { ...buildApiHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        tipoObra: "distribuicao_eletrica",
        tenantId,
        projetoId,
        custoDirectoBase: custoDirecto,
        componentes: {
          administracaoCentral: 0.05,
          seguroRisco: 0.02,
          despesasFinanceiras: 0.01,
          lucro: 0.1,
          iss: 0.05,
          pis: 0.0065,
          cofins: 0.03,
          irpjCsll: 0.0348,
        },
      }),
    });
    return res.json();
  }

  async function requestRoi(
    investimento: number,
    tenantId: string,
    projetoId: string,
  ) {
    // Simula uma receita anual de 15% do Capex (economia de perdas/manutenção)
    const fluxos = Array.from({ length: 15 }).map((_, i) => ({
      ano: i + 1,
      fluxo: investimento * 0.15,
    }));

    const res = await fetch(`${API_BASE_URL}/bdi-roi/calcular-roi`, {
      method: "POST",
      headers: { ...buildApiHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        descricao: "Análise ROI Automática",
        tenantId,
        projetoId,
        investimentoInicial: investimento,
        fluxosCaixa: fluxos,
        taxaDesconto: 0.08,
      }),
    });
    return res.json();
  }

  return {
    calculateBudget,
    loading,
    error,
    result,
  };
}
