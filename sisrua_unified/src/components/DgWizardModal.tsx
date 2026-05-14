/**
 * DgWizardModal – Modal de Projeto BT Guiado (Frente DG Wizard).
 * Modularizado para seguir as Regras Não Negociáveis (Modularity / Responsabilidade Única).
 */

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  X,
  ChevronRight,
  ChevronLeft,
  Zap,
} from "lucide-react";
import type { BtPoleNode } from "../types";
import { trackModalAbandonment, trackDgParameterDivergence } from "../utils/analytics";
import { useFocusTrap } from "../hooks/useFocusTrap";

import { StepDemanda } from "./DgWizard/StepDemanda";
import { StepExpansao } from "./DgWizard/StepExpansao";
import { StepTecnico } from "./DgWizard/StepTecnico";
import { StepRevisao } from "./DgWizard/StepRevisao";

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
      trackDgParameterDivergence(params, poleOverrides);
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
            {/* Progress Indicator */}
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
                      className={`text-[8px] font-black uppercase tracking-wider transition-colors ${step === s ? "text-violet-600" : "text-zinc-400"}`}
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
              <StepDemanda 
                clientesPorPoste={params.clientesPorPoste}
                demandaMediaClienteKva={params.demandaMediaClienteKva}
                onUpdateParam={updateParam}
                onMarkTouched={markTouched}
                fieldErrors={fieldErrors}
                poles={poles}
                poleOverrides={poleOverrides}
                onUpdatePoleOverride={updatePoleOverride}
              />
            )}

            {step === "EXPANSAO" && (
              <StepExpansao 
                areaClandestinaM2={params.areaClandestinaM2}
                onUpdateParam={updateParam}
              />
            )}

            {step === "TECNICO" && (
              <StepTecnico 
                maxSpanMeters={params.maxSpanMeters}
                fatorSimultaneidade={params.fatorSimultaneidade}
                faixaKvaTrafoPermitida={params.faixaKvaTrafoPermitida}
                onUpdateParam={updateParam}
                onMarkTouched={markTouched}
                fieldErrors={fieldErrors}
              />
            )}

            {step === "REVISAO" && (
              <StepRevisao 
                params={params}
                poleOverrides={poleOverrides}
              />
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
              disabled={!!validationError}
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
