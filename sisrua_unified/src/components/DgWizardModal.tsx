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
import { useTranslation } from "react-i18next";
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
  FileCheck,
  Info,
} from "lucide-react";
import type { BtPoleNode } from "../types";
import { trackModalAbandonment } from "../utils/analytics";
import { useFocusTrap } from "../hooks/useFocusTrap";

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
  faixaKvaTrafoPermitida: [15, 30, 45, 75, 112.5, 150, 225, 300],
  maxSpanMeters: 40,
};

type Step = "DEMANDA" | "EXPANSAO" | "TECNICO" | "REVISAO";
const STEP_ORDER: Step[] = ["DEMANDA", "EXPANSAO", "TECNICO", "REVISAO"];

export function DgWizardModal({
  isOpen,
  poles,
  onClose,
  onExecute,
}: DgWizardModalProps) {
  const { t } = useTranslation();
  const modalRef = useFocusTrap(isOpen);
  const [step, setStep] = useState<Step>("DEMANDA");
  const [params, setParams] = useState<Omit<DgWizardParams, "poleOverrides">>(
    DEFAULT_WIZARD_PARAMS,
  );
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [poleOverrides, setPoleOverrides] = useState<Record<string, number>>(
    {},
  );

  const STEP_LABELS: Record<Step, string> = {
    DEMANDA: t("dgWizard.steps.DEMANDA"),
    EXPANSAO: t("dgWizard.steps.EXPANSAO"),
    TECNICO: t("dgWizard.steps.TECNICO"),
    REVISAO: t("dgWizard.steps.REVISAO"),
  };

  const [showIndividual, setShowIndividual] = useState(false);
  const mountTimeRef = React.useRef<number>(Date.now());
  const isExecutedRef = React.useRef(false);

  React.useEffect(() => {
    if (isOpen) {
      mountTimeRef.current = Date.now();
      isExecutedRef.current = false;
    }
  }, [isOpen]);

  const handleClose = React.useCallback(() => {
    if (!isExecutedRef.current) {
      trackModalAbandonment(
        "DgWizardModal",
        Date.now() - mountTimeRef.current,
        false,
        step,
      );
    }
    onClose();
  }, [onClose, step]);

  if (!isOpen) return null;

  const currentStepIndex = STEP_ORDER.indexOf(step);

  const handleNext = () => {
    if (currentStepIndex < STEP_ORDER.length - 1) {
      setStep(STEP_ORDER[currentStepIndex + 1]);
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setStep(STEP_ORDER[currentStepIndex - 1]);
    }
  };

  const updateParam = (
    key: keyof Omit<DgWizardParams, "poleOverrides">,
    value: any,
  ) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  };

  const markTouched = (key: string) => {
    setTouched((prev) => ({ ...prev, [key]: true }));
  };

  const updatePoleOverride = (poleId: string, value: number) => {
    setPoleOverrides((prev) => ({ ...prev, [poleId]: value }));
  };

  const fieldErrors = {
    clientesPorPoste:
      touched.clientesPorPoste &&
      (!Number.isFinite(params.clientesPorPoste) || params.clientesPorPoste <= 0),
    demandaMediaClienteKva:
      touched.demandaMediaClienteKva &&
      (!Number.isFinite(params.demandaMediaClienteKva) ||
        params.demandaMediaClienteKva <= 0),
    faixaKvaTrafoPermitida:
      touched.faixaKvaTrafoPermitida && params.faixaKvaTrafoPermitida.length === 0,
  };

  const validationError = (() => {
    if (fieldErrors.clientesPorPoste) {
      return t("dgWizard.validation.minClientes");
    }
    if (fieldErrors.demandaMediaClienteKva) {
      return t("dgWizard.validation.minDemanda");
    }
    if (fieldErrors.faixaKvaTrafoPermitida) {
      return t("dgWizard.validation.minTrafos");
    }

    const isInvalid =
      !Number.isFinite(params.clientesPorPoste) ||
      params.clientesPorPoste <= 0 ||
      !Number.isFinite(params.demandaMediaClienteKva) ||
      params.demandaMediaClienteKva <= 0 ||
      params.faixaKvaTrafoPermitida.length === 0;

    return isInvalid ? "INVALID" : null;
  })();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validationError === "INVALID") {
      setTouched({
        clientesPorPoste: true,
        demandaMediaClienteKva: true,
        faixaKvaTrafoPermitida: true,
      });
      return;
    }

    if (step === "REVISAO") {
      isExecutedRef.current = true;
      trackModalAbandonment(
        "DgWizardModal",
        Date.now() - mountTimeRef.current,
        true,
        "COMPLETED",
      );
      onExecute({ ...params, poleOverrides });
    } else {
      handleNext();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/50 backdrop-blur-sm p-4">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dg-wizard-title"
        className="w-full max-w-md rounded-3xl border-2 border-violet-700/30 bg-white shadow-2xl dark:bg-zinc-900 dark:border-violet-500/30 overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between bg-gradient-to-r from-violet-600 to-indigo-700 px-6 py-4 text-white shrink-0">
          <div className="flex items-center gap-2">
            <Zap size={18} className="text-yellow-300" />
            <h2
              id="dg-wizard-title"
              className="text-xs font-black uppercase tracking-[0.2em]"
            >
              {t("dgWizard.title")}
            </h2>
          </div>
          <button
            onClick={handleClose}
            aria-label={t("common.close")}
            title={t("common.close")}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <form
          onSubmit={handleSubmit}
          className="flex flex-col flex-1 overflow-hidden"
        >
          <div className="p-6 space-y-8 overflow-y-auto flex-1">
            {/* Progress Indicator (UX-06) */}
            <div className="relative pt-2">
              <div className="flex justify-between mb-2">
                {STEP_ORDER.map((s, i) => (
                  <div
                    key={s}
                    className="flex flex-col items-center gap-1.5 flex-1 relative"
                  >
                    <div
                      className={`z-10 flex h-6 w-6 items-center justify-center rounded-full text-xs font-black transition-all ${
                        step === s
                          ? "bg-violet-600 text-white scale-110 shadow-lg shadow-violet-500/20"
                          : i < currentStepIndex
                            ? "bg-emerald-500 text-white"
                            : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800"
                      }`}
                    >
                      {i + 1}
                    </div>
                    <span
                      className={`text-xs font-black uppercase tracking-wider transition-colors ${step === s ? "text-violet-600" : "text-zinc-400"}`}
                    >
                      {STEP_LABELS[s]}
                    </span>
                  </div>
                ))}
                {/* Connector lines */}
                <div className="absolute top-[14px] left-[12.5%] right-[12.5%] h-[2px] bg-zinc-100 dark:bg-zinc-800 -z-0" />
                <div
                  className="absolute top-[14px] left-[12.5%] h-[2px] bg-violet-600 transition-all duration-500 -z-0"
                  style={{
                    width: `${(currentStepIndex / (STEP_ORDER.length - 1)) * 75}%`,
                  }}
                />
              </div>
            </div>

            {step === "DEMANDA" && (
              <div className="space-y-5 animate-in fade-in slide-in-from-right-2 duration-300">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-violet-500/10 p-3 dark:bg-violet-500/5">
                    <Users className="text-violet-600" size={24} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-zinc-800 dark:text-zinc-100">
                      {t("dgWizard.demanda.title")}
                    </h3>
                    <p className="text-xs font-medium text-zinc-500">
                      {t("dgWizard.demanda.description")}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label
                      htmlFor="clientes-global"
                      className="text-xs font-black text-zinc-500 uppercase tracking-widest"
                    >
                      {t("dgWizard.demanda.labelClientesPorPoste")}
                    </label>
                    <div className="relative">
                      <input
                        id="clientes-global"
                        type="number"
                        value={params.clientesPorPoste}
                        onChange={(e) =>
                          updateParam(
                            "clientesPorPoste",
                            Number(e.target.value),
                          )
                        }
                        onBlur={() => markTouched("clientesPorPoste")}
                        className={`w-full rounded-xl border bg-zinc-50 pl-4 pr-12 py-3 text-sm font-bold focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none dark:bg-zinc-800 dark:text-white transition-all ${
                          fieldErrors.clientesPorPoste
                            ? "border-rose-500 dark:border-rose-500/50"
                            : "border-zinc-200 dark:border-zinc-700"
                        }`}
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-zinc-400 pointer-events-none">
                        {t("dgWizard.demanda.unitUnd")}
                      </div>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setShowIndividual(!showIndividual)}
                      className="flex items-center justify-between w-full py-3 px-4 rounded-xl bg-slate-50 border border-slate-200 text-xs font-black text-slate-600 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400 hover:bg-slate-100 transition-colors"
                    >
                      {t("dgWizard.demanda.adjustIndividual", {
                        count: poles.length,
                      })}
                      {showIndividual ? (
                        <ChevronUp size={14} />
                      ) : (
                        <ChevronDown size={14} />
                      )}
                    </button>

                    {showIndividual && (
                      <div className="mt-2 border border-zinc-200 rounded-xl overflow-hidden dark:border-zinc-700 max-h-48 overflow-y-auto shadow-inner bg-slate-50/50 dark:bg-zinc-950/20">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-white dark:bg-zinc-800 sticky top-0 border-b dark:border-zinc-700">
                            <tr>
                              <th className="px-4 py-2 font-black text-zinc-400 uppercase tracking-wider">
                                Poste
                              </th>
                              <th className="px-4 py-2 font-black text-zinc-400 uppercase tracking-wider text-right">
                                Clientes
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {poles.map((p) => (
                              <tr key={p.id}>
                                <td className="px-4 py-2 text-zinc-600 dark:text-zinc-300 font-bold">
                                  {p.title || p.id.slice(-4)}
                                </td>
                                <td className="px-4 py-1 text-right">
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
                                    className="w-16 rounded-lg border border-zinc-200 px-2 py-1 bg-white dark:bg-zinc-900 dark:border-zinc-700 outline-none focus:ring-1 focus:ring-violet-500 font-bold text-right"
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="demanda-media"
                      className="text-xs font-black text-zinc-500 uppercase tracking-widest"
                    >
                      {t("dgWizard.demanda.labelDemandaMedia")}
                    </label>
                    <div className="relative">
                      <input
                        id="demanda-media"
                        type="number"
                        placeholder="1.5"
                        step="0.1"
                        value={params.demandaMediaClienteKva}
                        onChange={(e) =>
                          updateParam(
                            "demandaMediaClienteKva",
                            Number(e.target.value),
                          )
                        }
                        onBlur={() => markTouched("demandaMediaClienteKva")}
                        className={`w-full rounded-xl border bg-zinc-50 pl-4 pr-12 py-3 text-sm font-bold focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none dark:bg-zinc-800 dark:text-white transition-all ${
                          fieldErrors.demandaMediaClienteKva
                            ? "border-rose-500 dark:border-rose-500/50"
                            : "border-zinc-200 dark:border-zinc-700"
                        }`}
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-zinc-400 pointer-events-none">
                        {t("dgWizard.demanda.unitKva")}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === "EXPANSAO" && (
              <div className="space-y-5 animate-in fade-in slide-in-from-right-2 duration-300">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-amber-500/10 p-3 dark:bg-amber-500/5">
                    <Shield className="text-amber-600" size={24} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-zinc-800 dark:text-zinc-100">
                      {t("dgWizard.expansao.title")}
                    </h3>
                    <p className="text-xs font-medium text-zinc-500">
                      {t("dgWizard.expansao.description")}
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="area-clandestina"
                    className="text-xs font-black text-zinc-500 uppercase tracking-widest"
                  >
                    {t("dgWizard.expansao.labelAreaClandestina")}
                  </label>
                  <div className="relative">
                    <input
                      id="area-clandestina"
                      type="number"
                      placeholder="0"
                      value={params.areaClandestinaM2}
                      onChange={(e) =>
                        updateParam("areaClandestinaM2", Number(e.target.value))
                      }
                      className="w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-4 pr-12 py-3 text-sm font-bold focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none dark:bg-zinc-800 dark:border-zinc-700 dark:text-white transition-all"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-zinc-400 pointer-events-none">
                      {t("dgWizard.expansao.unitM2")}
                    </div>
                  </div>
                  <div className="mt-4 rounded-xl bg-amber-50 p-4 border border-amber-100 dark:bg-amber-900/10 dark:border-amber-900/20">
                    <p className="text-sm font-bold text-amber-700 dark:text-amber-400 flex gap-2">
                      <Info size={14} className="shrink-0" />
                      {t("dgWizard.expansao.infoNote")}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {step === "TECNICO" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-indigo-500/10 p-3 dark:bg-indigo-500/5">
                    <Ruler className="text-indigo-600" size={24} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-zinc-800 dark:text-zinc-100">
                      {t("dgWizard.tecnico.title")}
                    </h3>
                    <p className="text-xs font-medium text-zinc-500">
                      {t("dgWizard.tecnico.description")}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label
                      htmlFor="max-span"
                      className="text-xs font-black text-zinc-500 uppercase tracking-widest"
                    >
                      {t("dgWizard.tecnico.labelMaxSpan")}
                    </label>
                    <input
                      id="max-span"
                      type="number"
                      placeholder="40"
                      value={params.maxSpanMeters}
                      onChange={(e) =>
                        updateParam("maxSpanMeters", Number(e.target.value))
                      }
                      className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none dark:bg-zinc-800 dark:border-zinc-700 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label
                      htmlFor="fator-simult"
                      className="text-xs font-black text-zinc-500 uppercase tracking-widest"
                    >
                      {t("dgWizard.tecnico.labelFatorSimult")}
                    </label>
                    <input
                      id="fator-simult"
                      type="number"
                      placeholder="0.8"
                      step="0.05"
                      value={params.fatorSimultaneidade}
                      onChange={(e) =>
                        updateParam(
                          "fatorSimultaneidade",
                          Number(e.target.value),
                        )
                      }
                      className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none dark:bg-zinc-800 dark:border-zinc-700 transition-all"
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-xs font-black text-zinc-500 uppercase tracking-widest">
                    {t("dgWizard.tecnico.labelTrafosPermitidos")}
                  </label>
                  <div
                    className={`flex flex-wrap gap-2 p-2 rounded-2xl border-2 transition-all ${
                      fieldErrors.faixaKvaTrafoPermitida
                        ? "border-rose-500 bg-rose-500/5"
                        : "border-transparent"
                    }`}
                  >
                    {[15, 30, 45, 75, 112.5, 150, 225, 300].map((kva) => {
                      const isSelected =
                        params.faixaKvaTrafoPermitida.includes(kva);
                      return (
                        <button
                          key={kva}
                          type="button"
                          onClick={() => {
                            const current = params.faixaKvaTrafoPermitida;
                            const next = current.includes(kva)
                              ? current.filter((k) => k !== kva)
                              : [...current, kva].sort((a, b) => a - b);
                            updateParam("faixaKvaTrafoPermitida", next);
                            markTouched("faixaKvaTrafoPermitida");
                          }}
                          className={`px-4 py-2 rounded-xl text-xs font-black transition-all border-2 ${
                            isSelected
                              ? "bg-violet-600 border-violet-600 text-white shadow-lg shadow-violet-500/20"
                              : "bg-white border-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:border-zinc-700"
                          }`}
                        >
                          {kva}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {step === "REVISAO" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-emerald-500/10 p-3 dark:bg-emerald-500/5">
                    <FileCheck className="text-emerald-600" size={24} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-zinc-800 dark:text-zinc-100">
                      {t("dgWizard.revisao.title")}
                    </h3>
                    <p className="text-xs font-medium text-zinc-500">
                      {t("dgWizard.revisao.description")}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100 dark:bg-zinc-800/50 dark:border-zinc-700">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">
                      {t("dgWizard.revisao.summaryCarga")}
                    </p>
                    <p className="text-lg font-black text-slate-700 dark:text-white">
                      {(
                        params.clientesPorPoste *
                        params.demandaMediaClienteKva *
                        params.fatorSimultaneidade
                      ).toFixed(2)}{" "}
                      <span className="text-xs text-slate-400">
                        {t("dgWizard.demanda.unitKva")}
                      </span>
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100 dark:bg-zinc-800/50 dark:border-zinc-700">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">
                      {t("dgWizard.revisao.summaryArea")}
                    </p>
                    <p className="text-lg font-black text-slate-700 dark:text-white">
                      {params.areaClandestinaM2}{" "}
                      <span className="text-xs text-slate-400">
                        {t("dgWizard.expansao.unitM2")}
                      </span>
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100 dark:bg-zinc-800/50 dark:border-zinc-700">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">
                      {t("dgWizard.revisao.summaryVan")}
                    </p>
                    <p className="text-lg font-black text-slate-700 dark:text-white">
                      {params.maxSpanMeters}{" "}
                      <span className="text-xs text-slate-400">m</span>
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100 dark:bg-zinc-800/50 dark:border-zinc-700">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">
                      {t("dgWizard.revisao.summaryAjustes")}
                    </p>
                    <p className="text-lg font-black text-slate-700 dark:text-white">
                      {Object.keys(poleOverrides).length}{" "}
                      <span className="text-xs text-slate-400">
                        {t("dgWizard.revisao.unitPostes")}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl bg-violet-50 p-4 border border-violet-100 dark:bg-violet-900/10 dark:border-violet-900/20">
                  <p className="text-xs font-black text-violet-500 uppercase tracking-widest mb-2">
                    {t("dgWizard.tecnico.labelTrafosPermitidos")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {params.faixaKvaTrafoPermitida.map((k) => (
                      <span
                        key={k}
                        className="px-2 py-0.5 rounded-lg bg-white border border-violet-200 text-xs font-black text-violet-600 dark:bg-zinc-800 dark:border-violet-500/30"
                      >
                        {k} kVA
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {validationError && validationError !== "INVALID" && (
              <div
                role="alert"
                className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 dark:border-rose-700/40 dark:bg-rose-950/30 dark:text-rose-300 animate-pulse"
              >
                {validationError}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-zinc-100 p-6 dark:border-zinc-800 shrink-0">
            <button
              type="button"
              onClick={step === "DEMANDA" ? handleClose : handleBack}
              className="flex items-center gap-2 text-xs font-black text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors uppercase tracking-widest"
            >
              {step === "DEMANDA" ? (
                t("common.cancel")
              ) : (
                <>
                  <ChevronLeft size={16} />
                  {t("common.back")}
                </>
              )}
            </button>
            <button
              type="submit"
              disabled={validationError === "INVALID"}
              className="group flex items-center gap-2 rounded-2xl bg-violet-600 px-8 py-4 text-sm font-black uppercase tracking-[0.2em] text-white shadow-xl shadow-violet-500/20 hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40 transition-all hover:-translate-y-0.5 active:translate-y-0"
            >
              {step === "REVISAO" ? (
                t("dgWizard.revisao.btnExecute")
              ) : (
                <>
                  {t("common.next")}
                  <ChevronRight
                    size={16}
                    className="transition-transform group-hover:translate-x-1"
                  />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
