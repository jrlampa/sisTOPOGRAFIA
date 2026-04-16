import React from "react";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import type { BtPoleNode, BtPoleRamalEntry, BtTopology } from "../../types";
import {
  CLANDESTINO_RAMAL_TYPE,
  NORMAL_CLIENT_RAMAL_TYPES,
  getPoleChangeFlag,
  nextId,
  numberFromInput,
} from "./BtTopologyPanelUtils";

interface BtPoleVerificationSectionProps {
  btTopology: BtTopology;
  projectType: "ramais" | "geral" | "clandestino";
  selectedPoleId: string;
  selectedPole: BtPoleNode | null;
  isPoleDropdownOpen: boolean;
  setIsPoleDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  selectPole: (poleId: string) => void;
  onBtRenamePole?: (poleId: string, title: string) => void;
  onBtSetPoleChangeFlag?: (
    poleId: string,
    nodeChangeFlag: "existing" | "new" | "remove" | "replace",
  ) => void;
  onBtTogglePoleCircuitBreak?: (
    poleId: string,
    circuitBreakPoint: boolean,
  ) => void;
  updatePoleVerified: (poleId: string, verified: boolean) => void;
  updatePoleRamais: (poleId: string, ramais: BtPoleRamalEntry[]) => void;
}

const BtPoleVerificationSection: React.FC<BtPoleVerificationSectionProps> = ({
  btTopology,
  projectType,
  selectedPoleId,
  selectedPole,
  isPoleDropdownOpen,
  setIsPoleDropdownOpen,
  selectPole,
  onBtRenamePole,
  onBtSetPoleChangeFlag,
  onBtTogglePoleCircuitBreak,
  updatePoleVerified,
  updatePoleRamais,
}) => {
  return (
    <div className="space-y-3 rounded-lg border border-cyan-200 bg-slate-50 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-cyan-800">
        Postes / Verificação
      </div>

      <div className="space-y-2">
        <div className="text-[10px] text-slate-400">Poste selecionado</div>
        {btTopology.poles.length === 0 ? (
          <div className="text-[10px] text-slate-500">
            Nenhum poste cadastrado.
          </div>
        ) : (
          <>
            <div className="relative">
              <input
                type="text"
                value={selectedPole?.title ?? ""}
                spellCheck={false}
                onChange={(e) => {
                  if (!selectedPole) {
                    return;
                  }

                  const nextTitle = e.target.value;
                  const selectedOtherPole = btTopology.poles.find(
                    (pole) =>
                      pole.id !== selectedPole.id && pole.title === nextTitle,
                  );
                  if (selectedOtherPole) {
                    selectPole(selectedOtherPole.id);
                    return;
                  }

                  onBtRenamePole?.(selectedPole.id, nextTitle);
                }}
                title="Nome/seleção do poste"
                className="w-full rounded border border-slate-300 bg-white p-2 pr-8 text-xs font-medium text-slate-800 focus:border-cyan-500/60 outline-none"
              />
              <button
                type="button"
                onClick={() => setIsPoleDropdownOpen((current) => !current)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                title="Selecionar poste"
              >
                <ChevronDown size={14} />
              </button>
              {isPoleDropdownOpen && (
                <div className="absolute z-20 mt-1 max-h-44 w-full overflow-auto rounded border border-slate-300 bg-white shadow-lg">
                  {btTopology.poles.map((pole) => (
                    <button
                      key={pole.id}
                      type="button"
                      onClick={() => selectPole(pole.id)}
                      className={`w-full px-2 py-1.5 text-left text-xs hover:bg-slate-100 ${selectedPoleId === pole.id ? "bg-slate-100 font-semibold text-slate-900" : "text-slate-700"}`}
                    >
                      {pole.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {selectedPole && (
              <>
                <button
                  onClick={() =>
                    updatePoleVerified(selectedPole.id, !selectedPole.verified)
                  }
                  className="rounded border border-cyan-400 px-3 py-1 text-[10px] text-cyan-900 hover:bg-cyan-100"
                >
                  {selectedPole.verified
                    ? "Marcar como não verificado"
                    : "Marcar poste como verificado"}
                </button>

                {onBtSetPoleChangeFlag && (
                  <div className="flex flex-wrap gap-2 rounded border border-slate-200 bg-slate-100/70 p-2">
                    <button
                      onClick={() =>
                        onBtSetPoleChangeFlag(selectedPole.id, "remove")
                      }
                      className={`rounded border px-2 py-1 text-[10px] ${getPoleChangeFlag(selectedPole) === "remove" ? "border-rose-400 bg-rose-50 text-rose-700" : "border-slate-300 bg-white text-slate-700"}`}
                    >
                      Remoção
                    </button>
                    <button
                      onClick={() =>
                        onBtSetPoleChangeFlag(selectedPole.id, "new")
                      }
                      className={`rounded border px-2 py-1 text-[10px] ${getPoleChangeFlag(selectedPole) === "new" ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "border-slate-300 bg-white text-slate-700"}`}
                    >
                      Novo
                    </button>
                    <button
                      onClick={() =>
                        onBtSetPoleChangeFlag(selectedPole.id, "replace")
                      }
                      className={`rounded border px-2 py-1 text-[10px] ${getPoleChangeFlag(selectedPole) === "replace" ? "border-yellow-400 bg-yellow-50 text-yellow-700" : "border-slate-300 bg-white text-slate-700"}`}
                    >
                      Substituição
                    </button>
                    <button
                      onClick={() =>
                        onBtTogglePoleCircuitBreak?.(
                          selectedPole.id,
                          !(selectedPole.circuitBreakPoint ?? false),
                        )
                      }
                      title="Separa fisicamente o circuito neste poste"
                      className={`rounded border px-2 py-1 text-[10px] font-mono tracking-tight ${(selectedPole.circuitBreakPoint ?? false) ? "border-sky-400 bg-sky-50 text-sky-700" : "border-slate-300 bg-white text-slate-700"}`}
                    >
                      -| |-
                    </button>
                    <button
                      onClick={() =>
                        onBtSetPoleChangeFlag(selectedPole.id, "existing")
                      }
                      className={`rounded border px-2 py-1 text-[10px] ${getPoleChangeFlag(selectedPole) === "existing" ? "border-fuchsia-400 bg-fuchsia-50 text-fuchsia-700" : "border-slate-300 bg-white text-slate-700"}`}
                    >
                      Existente
                    </button>
                  </div>
                )}

                {(selectedPole.circuitBreakPoint ?? false) && (
                  <div className="rounded border border-sky-300 bg-sky-50 px-2 py-1 text-[10px] text-sky-800">
                    Separacao fisica ativa: o circuito do trafo para neste
                    poste.
                  </div>
                )}

                <div className="rounded border border-slate-300 bg-white p-2">
                  <div className="mb-2 flex items-center justify-between text-[10px] text-slate-600">
                    <span>Ramais do poste</span>
                    <button
                      onClick={() => {
                        const defaultRamalType =
                          projectType === "clandestino"
                            ? CLANDESTINO_RAMAL_TYPE
                            : NORMAL_CLIENT_RAMAL_TYPES[0];
                        updatePoleRamais(selectedPole.id, [
                          ...(selectedPole.ramais ?? []),
                          {
                            id: nextId("RP"),
                            quantity: 1,
                            ramalType: defaultRamalType,
                          },
                        ]);
                      }}
                      className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-slate-700 hover:bg-slate-100"
                    >
                      <Plus size={12} /> Ramal
                    </button>
                  </div>

                  {(selectedPole.ramais ?? []).length === 0 ? (
                    <div className="text-[10px] text-slate-500">
                      Sem ramais cadastrados neste poste.
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="rounded border border-slate-200 bg-slate-50 p-1.5 text-[10px] text-slate-600">
                        {(selectedPole.ramais ?? []).map((ramal) => {
                          const ramalType =
                            ramal.ramalType ??
                            (projectType === "clandestino"
                              ? CLANDESTINO_RAMAL_TYPE
                              : NORMAL_CLIENT_RAMAL_TYPES[0]);
                          return (
                            <div key={`summary-${ramal.id}`}>
                              {ramal.quantity} x {ramalType}
                            </div>
                          );
                        })}
                      </div>
                      {(selectedPole.ramais ?? []).map((ramal) => (
                        <div
                          key={ramal.id}
                          className="grid grid-cols-[84px_1fr_auto] gap-2"
                        >
                          <input
                            type="number"
                            min={1}
                            value={ramal.quantity}
                            title={`Quantidade do ramal ${ramal.id}`}
                            onFocus={(e) => e.target.select()}
                            onClick={(e) => e.currentTarget.select()}
                            onChange={(e) => {
                              const quantity = Math.max(
                                1,
                                numberFromInput(e.target.value),
                              );
                              updatePoleRamais(
                                selectedPole.id,
                                (selectedPole.ramais ?? []).map((item) =>
                                  item.id === ramal.id
                                    ? { ...item, quantity }
                                    : item,
                                ),
                              );
                            }}
                            className="rounded border border-slate-300 bg-white p-1.5 text-[11px] text-slate-800"
                          />
                          <select
                            value={
                              ramal.ramalType ??
                              (projectType === "clandestino"
                                ? CLANDESTINO_RAMAL_TYPE
                                : NORMAL_CLIENT_RAMAL_TYPES[0])
                            }
                            title={`Tipo do ramal ${ramal.id}`}
                            onChange={(e) => {
                              const ramalType = e.target.value;
                              updatePoleRamais(
                                selectedPole.id,
                                (selectedPole.ramais ?? []).map((item) =>
                                  item.id === ramal.id
                                    ? { ...item, ramalType }
                                    : item,
                                ),
                              );
                            }}
                            className="rounded border border-slate-300 bg-white p-1.5 text-[11px] text-slate-800"
                          >
                            {(projectType === "clandestino"
                              ? [CLANDESTINO_RAMAL_TYPE]
                              : NORMAL_CLIENT_RAMAL_TYPES
                            ).map((type) => (
                              <option key={type} value={type}>
                                {type}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => {
                              updatePoleRamais(
                                selectedPole.id,
                                (selectedPole.ramais ?? []).filter(
                                  (item) => item.id !== ramal.id,
                                ),
                              );
                            }}
                            className="rounded border border-rose-300 p-1.5 text-rose-700 hover:bg-rose-50"
                            title="Remover ramal"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default BtPoleVerificationSection;
