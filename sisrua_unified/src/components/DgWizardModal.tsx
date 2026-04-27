/**
 * DgWizardModal – Modal de Projeto BT Guiado (Frente DG Wizard).
 *
 * Coleta parâmetros técnicos para dimensionamento automático de trafo
 * e rede BT em modo Greenfield (sem trafo inicial ou com rede projetada).
 *
 * Permite edição individual de clientes por poste.
 *
 * Referência: docs/DG_IMPLEMENTATION_ADDENDUM_2026.md
 */

import React, { useState } from "react";
import {
  X,
  ChevronRight,
  ChevronLeft,
  Zap,
  Users,
  Shield,
  Ruler,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { BtPoleNode } from "../types";

interface DgWizardModalProps {
  isOpen: boolean;
  poles: BtPoleNode[];
  onClose: () => void;
  onExecute: (params: DgWizardParams) => void;
}

export interface DgWizardParams {
  clientesPorPoste: number;
  areaClandestinaM2: number;
  demandaMediaClienteKva: number;
  fatorSimultaneidade: number;
  faixaKvaTrafoPermitida: number[];
  maxSpanMeters: number;
  poleOverrides: Record<string, number>;
}

const DEFAULT_WIZARD_PARAMS: Omit<DgWizardParams, "poleOverrides"> = {
  clientesPorPoste: 1,
  areaClandestinaM2: 0,
  demandaMediaClienteKva: 1.5,
  fatorSimultaneidade: 0.8,
  faixaKvaTrafoPermitida: [15, 30, 45, 75, 112.5],
  maxSpanMeters: 40,
};

type Step = "DEMANDA" | "EXPANSAO" | "TECNICO" | "REVISAO";

export function DgWizardModal({
  isOpen,
  poles,
  onClose,
  onExecute,
}: DgWizardModalProps) {
  const [step, setStep] = useState<Step>("DEMANDA");
  const [params, setParams] = useState<Omit<DgWizardParams, "poleOverrides">>(
    DEFAULT_WIZARD_PARAMS,
  );
  const [poleOverrides, setPoleOverrides] = useState<Record<string, number>>(
    {},
  );
  const [showIndividual, setShowIndividual] = useState(false);

  if (!isOpen) return null;

  const handleNext = () => {
    if (step === "DEMANDA") setStep("EXPANSAO");
    else if (step === "EXPANSAO") setStep("TECNICO");
    else if (step === "TECNICO") setStep("REVISAO");
  };

  const handleBack = () => {
    if (step === "REVISAO") setStep("TECNICO");
    else if (step === "TECNICO") setStep("EXPANSAO");
    else if (step === "EXPANSAO") setStep("DEMANDA");
  };

  const updateParam = (
    key: keyof Omit<DgWizardParams, "poleOverrides">,
    value: any,
  ) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  };

  const updatePoleOverride = (poleId: string, value: number) => {
    setPoleOverrides((prev) => ({ ...prev, [poleId]: value }));
  };

  const validationError = (() => {
    if (
      !Number.isFinite(params.clientesPorPoste) ||
      params.clientesPorPoste <= 0
    ) {
      return "Informe ao menos 1 cliente por poste.";
    }
    if (
      !Number.isFinite(params.demandaMediaClienteKva) ||
      params.demandaMediaClienteKva <= 0
    ) {
      return "A demanda média por cliente deve ser maior que zero.";
    }
    if (params.faixaKvaTrafoPermitida.length === 0) {
      return "Selecione ao menos uma faixa de kVA permitida.";
    }
    return null;
  })();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border-2 border-violet-700/30 bg-white shadow-2xl dark:bg-zinc-900 dark:border-violet-500/30 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between bg-violet-50 px-4 py-3 dark:bg-violet-950/20 shrink-0">
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-violet-700 dark:text-violet-400" />
            <h2 className="text-[11px] font-black uppercase tracking-widest text-violet-900 dark:text-violet-100">
              Wizard Projeto BT
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar wizard"
            title="Fechar wizard"
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-6 overflow-y-auto">
          {/* Progress Indicator */}
          <div className="flex justify-between shrink-0">
            {["DEMANDA", "EXPANSAO", "TECNICO", "REVISAO"].map((s, i) => (
              <div
                key={s}
                className={`h-1.5 flex-1 mx-0.5 rounded-full ${
                  step === s
                    ? "bg-violet-600"
                    : i <
                        ["DEMANDA", "EXPANSAO", "TECNICO", "REVISAO"].indexOf(
                          step,
                        )
                      ? "bg-violet-300"
                      : "bg-zinc-200 dark:bg-zinc-800"
                }`}
              />
            ))}
          </div>

          {step === "DEMANDA" && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-300">
              <div className="flex items-center gap-3">
                <Users className="text-violet-600" size={20} />
                <div>
                  <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                    Passo 1: Demanda Base
                  </h3>
                  <p className="text-[10px] text-zinc-500">
                    Defina a carga inicial por ponto de entrega.
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="space-y-1">
                  <label
                    htmlFor="clientes-global"
                    className="text-[10px] font-bold text-zinc-600 uppercase"
                  >
                    Clientes por poste (médio)
                  </label>
                  <input
                    id="clientes-global"
                    type="number"
                    value={params.clientesPorPoste}
                    onChange={(e) =>
                      updateParam("clientesPorPoste", Number(e.target.value))
                    }
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs focus:ring-2 focus:ring-violet-500 outline-none dark:bg-zinc-800 dark:border-zinc-700"
                  />
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => setShowIndividual(!showIndividual)}
                    className="flex items-center justify-between w-full py-2 px-3 rounded-lg bg-zinc-50 border border-zinc-100 text-[10px] font-bold text-zinc-600 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400"
                  >
                    AJUSTAR CLIENTES POR POSTE ({poles.length})
                    {showIndividual ? (
                      <ChevronUp size={14} />
                    ) : (
                      <ChevronDown size={14} />
                    )}
                  </button>

                  {showIndividual && (
                    <div className="mt-2 border border-zinc-100 rounded-lg overflow-hidden dark:border-zinc-700 max-h-48 overflow-y-auto shadow-inner bg-zinc-50/30 dark:bg-zinc-950/20">
                      <table className="w-full text-left text-[10px]">
                        <thead className="bg-zinc-100 dark:bg-zinc-800 sticky top-0">
                          <tr>
                            <th className="px-3 py-2 font-bold text-zinc-500">
                              Poste
                            </th>
                            <th className="px-3 py-2 font-bold text-zinc-500">
                              Clientes
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                          {poles.map((p) => (
                            <tr key={p.id}>
                              <td className="px-3 py-2 text-zinc-600 dark:text-zinc-300 font-medium">
                                {p.title || p.id.slice(-4)}
                              </td>
                              <td className="px-2 py-1">
                                <input
                                  type="number"
                                  title={`Clientes do poste ${p.title || p.id}`}
                                  placeholder={String(params.clientesPorPoste)}
                                  value={
                                    poleOverrides[p.id] ??
                                    p.ramais?.length ??
                                    params.clientesPorPoste
                                  }
                                  onChange={(e) =>
                                    updatePoleOverride(
                                      p.id,
                                      Number(e.target.value),
                                    )
                                  }
                                  className="w-16 rounded border border-zinc-200 px-2 py-1 bg-white dark:bg-zinc-900 dark:border-zinc-700 outline-none focus:ring-1 focus:ring-violet-500"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-600 uppercase">
                    Demanda média por cliente (kVA)
                  </label>
                  <input
                    type="number"
                    title="Demanda média por cliente (kVA)"
                    placeholder="1.5"
                    step="0.1"
                    value={params.demandaMediaClienteKva}
                    onChange={(e) =>
                      updateParam(
                        "demandaMediaClienteKva",
                        Number(e.target.value),
                      )
                    }
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs focus:ring-2 focus:ring-violet-500 outline-none dark:bg-zinc-800 dark:border-zinc-700"
                  />
                </div>
              </div>
            </div>
          )}

          {step === "EXPANSAO" && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-300">
              <div className="flex items-center gap-3">
                <Shield className="text-violet-600" size={20} />
                <div>
                  <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                    Passo 2: Expansão / Clandestino
                  </h3>
                  <p className="text-[10px] text-zinc-500">
                    Parâmetros para áreas de ocupação informal.
                  </p>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-600 uppercase">
                  Área Clandestina Adicional (m²)
                </label>
                <input
                  type="number"
                  title="Área clandestina adicional (m²)"
                  placeholder="0"
                  value={params.areaClandestinaM2}
                  onChange={(e) =>
                    updateParam("areaClandestinaM2", Number(e.target.value))
                  }
                  className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs focus:ring-2 focus:ring-violet-500 outline-none dark:bg-zinc-800 dark:border-zinc-700"
                />
                <p className="text-[9px] text-zinc-400 mt-1 italic">
                  Carga de 20W/m² será aplicada nesta área e rateada nos postes.
                </p>
              </div>
            </div>
          )}

          {step === "TECNICO" && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-300">
              <div className="flex items-center gap-3">
                <Ruler className="text-violet-600" size={20} />
                <div>
                  <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                    Passo 3: Regras Técnicas
                  </h3>
                  <p className="text-[10px] text-zinc-500">
                    Limites de projeto e dimensionamento.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-600 uppercase">
                    Vão Máximo (m)
                  </label>
                  <input
                    type="number"
                    title="Vão máximo (m)"
                    placeholder="40"
                    value={params.maxSpanMeters}
                    onChange={(e) =>
                      updateParam("maxSpanMeters", Number(e.target.value))
                    }
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs focus:ring-2 focus:ring-violet-500 outline-none dark:bg-zinc-800 dark:border-zinc-700"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-600 uppercase">
                    Fator Simult.
                  </label>
                  <input
                    type="number"
                    title="Fator de simultaneidade"
                    placeholder="0.8"
                    step="0.05"
                    value={params.fatorSimultaneidade}
                    onChange={(e) =>
                      updateParam("fatorSimultaneidade", Number(e.target.value))
                    }
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs focus:ring-2 focus:ring-violet-500 outline-none dark:bg-zinc-800 dark:border-zinc-700"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-600 uppercase">
                  Faixas de kVA Permitidas
                </label>
                <div className="flex flex-wrap gap-2">
                  {[15, 30, 45, 75, 112.5].map((kva) => (
                    <button
                      key={kva}
                      onClick={() => {
                        const current = params.faixaKvaTrafoPermitida;
                        const next = current.includes(kva)
                          ? current.filter((k) => k !== kva)
                          : [...current, kva].sort((a, b) => a - b);
                        updateParam("faixaKvaTrafoPermitida", next);
                      }}
                      className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all ${
                        params.faixaKvaTrafoPermitida.includes(kva)
                          ? "bg-violet-600 text-white"
                          : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800"
                      }`}
                    >
                      {kva}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === "REVISAO" && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-300">
              <div className="flex items-center gap-3">
                <Zap className="text-violet-600" size={20} />
                <div>
                  <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                    Revisão Final
                  </h3>
                  <p className="text-[10px] text-zinc-500">
                    Confirme os parâmetros para simulação.
                  </p>
                </div>
              </div>
              <div className="rounded-xl bg-zinc-50 p-4 space-y-2 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-700">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500">Demanda/Poste (Média):</span>
                  <span className="font-bold text-zinc-700 dark:text-zinc-300">
                    {(
                      params.clientesPorPoste *
                      params.demandaMediaClienteKva *
                      params.fatorSimultaneidade
                    ).toFixed(2)}{" "}
                    kVA
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500">Ajustes Manuais:</span>
                  <span className="font-bold text-zinc-700 dark:text-zinc-300">
                    {Object.keys(poleOverrides).length} postes
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500">Área Clandestina:</span>
                  <span className="font-bold text-zinc-700 dark:text-zinc-300">
                    {params.areaClandestinaM2} m²
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500">Faixas kVA:</span>
                  <span className="font-bold text-zinc-700 dark:text-zinc-300">
                    {params.faixaKvaTrafoPermitida.join(", ")}
                  </span>
                </div>
              </div>
            </div>
          )}

          {validationError && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] text-amber-800 dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-300">
              {validationError}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-zinc-100 p-4 dark:border-zinc-800 shrink-0">
          <button
            onClick={step === "DEMANDA" ? onClose : handleBack}
            className="flex items-center gap-1 text-[10px] font-bold text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            {step === "DEMANDA" ? (
              "CANCELAR"
            ) : (
              <>
                <ChevronLeft size={14} />
                VOLTAR
              </>
            )}
          </button>
          <button
            onClick={
              step === "REVISAO"
                ? () => onExecute({ ...params, poleOverrides })
                : handleNext
            }
            disabled={validationError !== null}
            className="flex items-center gap-1 rounded-xl bg-violet-700 px-6 py-2 text-[10px] font-black text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {step === "REVISAO" ? (
              "EXECUTAR PROJETO"
            ) : (
              <>
                PRÓXIMO
                <ChevronRight size={14} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
