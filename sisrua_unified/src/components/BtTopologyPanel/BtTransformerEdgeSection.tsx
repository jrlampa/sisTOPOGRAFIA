import React from "react";
import { ChevronDown, Plus, Sigma, Trash2 } from "lucide-react";
import type {
  BtEdge,
  BtNetworkScenario,
  BtTopology,
  BtTransformer,
  BtTransformerReading,
} from "../../types";
import {
  BtEdgeChangeFlag,
  BtTransformerChangeFlag,
  CONDUCTOR_NAMES,
  NumericTextInput,
  formatBr,
  getEdgeChangeFlag,
  getTransformerChangeFlag,
  nextId,
  numberFromInput,
} from "./BtTopologyPanelUtils";
import {
  CURRENT_TO_DEMAND_CONVERSION,
  DEFAULT_TEMPERATURE_FACTOR,
} from "../../constants/btPhysicalConstants";
import type { CriticalConfirmationConfig } from "../BtModals";

interface BtTransformerEdgeSectionProps {
  btTopology: BtTopology;
  btNetworkScenario: BtNetworkScenario;
  selectedTransformerId: string;
  selectedTransformer: BtTransformer | null;
  isTransformerDropdownOpen: boolean;
  setIsTransformerDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  selectTransformer: (transformerId: string) => void;
  selectedEdgeId: string;
  selectedEdge: BtEdge | null;
  selectEdge: (edgeId: string) => void;
  selectedEdgeLengthLabel: string;
  totalNetworkLengthLabel: string;
  pointDemandKva: number;
  transformerDebugById: Record<
    string,
    { assignedClients: number; estimatedDemandKw: number }
  >;
  onTopologyChange: (next: BtTopology) => void;
  onBtRenameTransformer?: (transformerId: string, title: string) => void;
  onBtSetTransformerChangeFlag?: (
    transformerId: string,
    transformerChangeFlag: "existing" | "new" | "remove" | "replace",
  ) => void;
  onBtSetEdgeChangeFlag?: (
    edgeId: string,
    edgeChangeFlag: "existing" | "new" | "remove" | "replace",
  ) => void;
  onRequestCriticalConfirmation?: (config: CriticalConfirmationConfig) => void;
  updateTransformerVerified: (transformerId: string, verified: boolean) => void;
  updateTransformerReadings: (
    transformerId: string,
    readings: BtTransformerReading[],
  ) => void;
  updateTransformerProjectPower: (
    transformerId: string,
    projectPowerKva: number,
  ) => void;
  updateEdgeVerified: (edgeId: string, verified: boolean) => void;
  updateEdgeCqtLengthMeters: (edgeId: string, lengthMeters: number) => void;
  updateEdgeConductors: (
    edgeId: string,
    conductors: BtTopology["edges"][number]["conductors"],
  ) => void;
  updateEdgeReplacementFromConductors: (
    edgeId: string,
    replacementFromConductors: BtTopology["edges"][number]["conductors"],
  ) => void;
}

const BtTransformerEdgeSection: React.FC<BtTransformerEdgeSectionProps> = ({
  btTopology,
  btNetworkScenario,
  selectedTransformerId,
  selectedTransformer,
  isTransformerDropdownOpen,
  setIsTransformerDropdownOpen,
  selectTransformer,
  selectedEdgeId,
  selectedEdge,
  selectEdge,
  selectedEdgeLengthLabel,
  totalNetworkLengthLabel,
  pointDemandKva,
  transformerDebugById,
  onTopologyChange,
  onBtRenameTransformer,
  onBtSetTransformerChangeFlag,
  onBtSetEdgeChangeFlag,
  onRequestCriticalConfirmation,
  updateTransformerVerified,
  updateTransformerReadings,
  updateTransformerProjectPower,
  updateEdgeVerified,
  updateEdgeCqtLengthMeters,
  updateEdgeConductors,
  updateEdgeReplacementFromConductors,
}) => {
  return (
    <>
      <div className="space-y-2 rounded-lg border border-slate-300 bg-slate-50 p-3">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          Transformador (
          {btNetworkScenario === "asis"
            ? "leituras da rede atual"
            : "base de projeto"}
          )
        </div>
        {btTopology.transformers.length === 0 ? (
          <div className="text-[10px] text-slate-500">
            {btNetworkScenario === "asis"
              ? "Sem transformador identificado para conferência de leituras da rede existente."
              : "Insira um transformador no mapa para montar a nova topologia BT."}
          </div>
        ) : (
          <>
            <div className="relative">
              <input
                type="text"
                value={selectedTransformer?.title ?? ""}
                spellCheck={false}
                onChange={(e) => {
                  if (!selectedTransformer) {
                    return;
                  }

                  const nextTitle = e.target.value;
                  const selectedOtherTransformer = btTopology.transformers.find(
                    (transformer) =>
                      transformer.id !== selectedTransformer.id &&
                      transformer.title === nextTitle,
                  );
                  if (selectedOtherTransformer) {
                    selectTransformer(selectedOtherTransformer.id);
                    return;
                  }

                  onBtRenameTransformer?.(selectedTransformer.id, nextTitle);
                }}
                title="Nome/seleção do transformador"
                className="w-full rounded border border-slate-300 bg-white p-2 pr-8 text-xs font-medium text-slate-800"
              />
              <button
                type="button"
                onClick={() =>
                  setIsTransformerDropdownOpen((current) => !current)
                }
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                title="Selecionar transformador"
              >
                <ChevronDown size={14} />
              </button>
              {isTransformerDropdownOpen && (
                <div className="absolute z-20 mt-1 max-h-44 w-full overflow-auto rounded border border-slate-300 bg-white shadow-lg">
                  {btTopology.transformers.map((transformer) => (
                    <button
                      key={transformer.id}
                      type="button"
                      onClick={() => selectTransformer(transformer.id)}
                      className={`w-full px-2 py-1.5 text-left text-xs hover:bg-slate-100 ${selectedTransformerId === transformer.id ? "bg-slate-100 font-semibold text-slate-900" : "text-slate-700"}`}
                    >
                      {transformer.title}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedTransformer && (
              <button
                onClick={() =>
                  updateTransformerVerified(
                    selectedTransformer.id,
                    !selectedTransformer.verified,
                  )
                }
                className="rounded border border-cyan-400 px-3 py-1 text-[10px] text-cyan-900 hover:bg-cyan-100"
              >
                {selectedTransformer.verified
                  ? "Marcar trafo como não verificado"
                  : "Marcar trafo como verificado"}
              </button>
            )}

            {selectedTransformer && onBtSetTransformerChangeFlag && (
              <div className="flex flex-wrap gap-2 rounded border border-slate-200 bg-slate-100/70 p-2">
                <button
                  onClick={() =>
                    onBtSetTransformerChangeFlag(
                      selectedTransformer.id,
                      "remove",
                    )
                  }
                  className={`rounded border px-2 py-1 text-[10px] ${getTransformerChangeFlag(selectedTransformer) === "remove" ? "border-rose-400 bg-rose-50 text-rose-700" : "border-slate-300 bg-white text-slate-700"}`}
                >
                  Remoção
                </button>
                <button
                  onClick={() =>
                    onBtSetTransformerChangeFlag(selectedTransformer.id, "new")
                  }
                  className={`rounded border px-2 py-1 text-[10px] ${getTransformerChangeFlag(selectedTransformer) === "new" ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "border-slate-300 bg-white text-slate-700"}`}
                >
                  Novo
                </button>
                <button
                  onClick={() =>
                    onBtSetTransformerChangeFlag(
                      selectedTransformer.id,
                      "replace",
                    )
                  }
                  className={`rounded border px-2 py-1 text-[10px] ${getTransformerChangeFlag(selectedTransformer) === "replace" ? "border-yellow-400 bg-yellow-50 text-yellow-700" : "border-slate-300 bg-white text-slate-700"}`}
                >
                  Substituição
                </button>
                <button
                  onClick={() =>
                    onBtSetTransformerChangeFlag(
                      selectedTransformer.id,
                      "existing",
                    )
                  }
                  className={`rounded border px-2 py-1 text-[10px] ${getTransformerChangeFlag(selectedTransformer) === "existing" ? "border-fuchsia-400 bg-fuchsia-50 text-fuchsia-700" : "border-slate-300 bg-white text-slate-700"}`}
                >
                  Existente
                </button>
              </div>
            )}

            {selectedTransformer && (
              <div className="space-y-2">
                {(() => {
                  const transformerDebug =
                    transformerDebugById[selectedTransformer.id];
                  const baseReading = selectedTransformer.readings[0] ?? {
                    id: nextId("R"),
                    currentMaxA: 0,
                    temperatureFactor: DEFAULT_TEMPERATURE_FACTOR,
                    autoCalculated: false,
                  };
                  const currentMaxA = baseReading.currentMaxA ?? 0;
                  const temperatureFactor =
                    baseReading.temperatureFactor ?? DEFAULT_TEMPERATURE_FACTOR;
                  const hasReadings = selectedTransformer.readings.length > 0;
                  const demandMaxKw =
                    currentMaxA * CURRENT_TO_DEMAND_CONVERSION;
                  const correctedDemandKw = demandMaxKw * temperatureFactor;
                  const effectiveDemandKw = hasReadings
                    ? correctedDemandKw
                    : (selectedTransformer.demandKw ?? 0);
                  const projectPowerKva =
                    selectedTransformer.projectPowerKva ?? 0;
                  const loadingPct =
                    projectPowerKva > 0
                      ? (effectiveDemandKw / projectPowerKva) * 100
                      : null;
                  const totalClients = btTopology.poles.reduce(
                    (acc, pole) =>
                      acc +
                      (pole.ramais ?? []).reduce(
                        (sum, ramal) => sum + ramal.quantity,
                        0,
                      ),
                    0,
                  );
                  const dmdi = pointDemandKva;

                  return (
                    <>
                      <div className="rounded border border-slate-200 bg-white p-2">
                        <div className="grid grid-cols-4 gap-2">
                          <div className="text-[10px] text-slate-500">
                            Corrente maxima (A)
                          </div>
                          <div className="text-[10px] text-slate-500">
                            Demanda corrigida (kVA)
                          </div>
                          <div className="text-[10px] text-slate-500">
                            Fator temperatura
                          </div>
                          <div className="text-[10px] text-slate-500">
                            Trafo proj (kVA)
                          </div>
                          <NumericTextInput
                            value={currentMaxA}
                            title="Corrente máxima do transformador em ampères"
                            placeholder="Corrente máxima"
                            onChange={(next) => {
                              updateTransformerReadings(
                                selectedTransformer.id,
                                [
                                  {
                                    ...baseReading,
                                    currentMaxA: next,
                                    autoCalculated: false,
                                  },
                                ],
                              );
                            }}
                            className="rounded border border-emerald-300 bg-emerald-50 p-1.5 text-[11px] font-medium text-emerald-900"
                          />
                          <NumericTextInput
                            value={effectiveDemandKw}
                            title="Demanda corrigida do transformador em kVA"
                            placeholder="Demanda corrigida"
                            onChange={(nextCorrectedDemandKva) => {
                              if (!hasReadings) {
                                return;
                              }

                              const temperatureBase =
                                temperatureFactor > 0
                                  ? temperatureFactor
                                  : DEFAULT_TEMPERATURE_FACTOR;
                              const inferredCurrent =
                                Math.round(
                                  (nextCorrectedDemandKva /
                                    (CURRENT_TO_DEMAND_CONVERSION *
                                      temperatureBase)) *
                                    100,
                                ) / 100;
                              updateTransformerReadings(
                                selectedTransformer.id,
                                [
                                  {
                                    ...baseReading,
                                    currentMaxA: inferredCurrent,
                                    autoCalculated: false,
                                  },
                                ],
                              );
                            }}
                            className="rounded border border-emerald-300 bg-emerald-50 p-1.5 text-[11px] font-medium text-emerald-900"
                          />
                          <NumericTextInput
                            value={temperatureFactor}
                            title="Fator de temperatura do transformador"
                            placeholder="Fator de temperatura"
                            onChange={(next) => {
                              updateTransformerReadings(
                                selectedTransformer.id,
                                [
                                  {
                                    ...baseReading,
                                    temperatureFactor: next,
                                    autoCalculated: false,
                                  },
                                ],
                              );
                            }}
                            className="rounded border border-emerald-300 bg-emerald-50 p-1.5 text-[11px] font-medium text-emerald-900"
                          />
                          <NumericTextInput
                            value={projectPowerKva}
                            title="Potência de projeto do transformador em kVA"
                            placeholder="Potência de projeto"
                            onChange={(next) =>
                              updateTransformerProjectPower(
                                selectedTransformer.id,
                                next,
                              )
                            }
                            className="rounded border border-slate-300 bg-white p-1.5 text-[11px] text-slate-800"
                          />
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          const estimatedDemandKw =
                            transformerDebug?.estimatedDemandKw;
                          const fallbackDemandKw =
                            selectedTransformer.demandKw ?? 0;
                          const demandTargetKw =
                            Number.isFinite(estimatedDemandKw) &&
                            typeof estimatedDemandKw === "number" &&
                            estimatedDemandKw > 0
                              ? estimatedDemandKw
                              : fallbackDemandKw;
                          const temperatureBase =
                            temperatureFactor > 0
                              ? temperatureFactor
                              : DEFAULT_TEMPERATURE_FACTOR;
                          const inferredCurrent =
                            temperatureBase > 0
                              ? Math.round(
                                  (demandTargetKw /
                                    (CURRENT_TO_DEMAND_CONVERSION *
                                      temperatureBase)) *
                                    100,
                                ) / 100
                              : 0;

                          updateTransformerReadings(selectedTransformer.id, [
                            {
                              ...baseReading,
                              currentMaxA: inferredCurrent,
                              temperatureFactor: temperatureBase,
                              autoCalculated: true,
                            },
                          ]);
                        }}
                        className="w-full rounded border border-blue-400 bg-blue-50 px-3 py-1.5 text-[10px] font-semibold text-blue-800 hover:bg-blue-100"
                      >
                        Recalcular corrente maxima automaticamente
                      </button>

                      <div className="rounded border border-slate-300 bg-white p-2 text-[10px] text-slate-700 space-y-1">
                        <div>
                          Demanda corrigida: {formatBr(effectiveDemandKw)} kVA
                        </div>
                        <div>
                          Demanda maxima:{" "}
                          {formatBr(
                            hasReadings ? demandMaxKw : effectiveDemandKw,
                          )}{" "}
                          kVA
                        </div>
                        <div>
                          Carregamento atual:{" "}
                          {loadingPct === null
                            ? "#DIV/0!"
                            : `${loadingPct.toFixed(2)}%`}
                        </div>
                        <div>
                          DMDI (ramal):{" "}
                          {totalClients === 0 ? "#DIV/0!" : dmdi.toFixed(2)}
                        </div>
                        <div>Total clientes: {totalClients}</div>
                      </div>

                      {transformerDebug && (
                        <div className="rounded border border-indigo-300 bg-indigo-50 p-2 text-[10px] text-indigo-900 space-y-1">
                          <div className="font-semibold uppercase tracking-wide">
                            Atribuicao automatica
                          </div>
                          <div>
                            Clientes atribuidos ao trafo:{" "}
                            {transformerDebug.assignedClients}
                          </div>
                          <div>
                            Demanda estimada automatica:{" "}
                            {formatBr(transformerDebug.estimatedDemandKw)} kVA
                          </div>
                          <div>
                            Fonte: particao eletrica da rede considerando
                            seccionamentos BT.
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </>
        )}
      </div>

      <div className="space-y-2 rounded-lg border border-slate-300 bg-slate-50 p-3">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          Condutor
        </div>
        {btTopology.edges.length === 0 ? (
          <div className="text-[10px] text-slate-500">
            {btNetworkScenario === "asis"
              ? "Sem condutores cadastrados para representar os ramais existentes."
              : "Insira condutores no mapa para lançar os ramais da rede nova."}
          </div>
        ) : (
          <>
            <select
              className="w-full rounded border border-slate-300 bg-white p-2 text-xs text-slate-800"
              value={selectedEdgeId}
              title="Selecionar trecho BT"
              onChange={(e) => selectEdge(e.target.value)}
            >
              {btTopology.edges.map((edge) => {
                const fromTitle =
                  btTopology.poles.find((pole) => pole.id === edge.fromPoleId)
                    ?.title ?? edge.fromPoleId;
                const toTitle =
                  btTopology.poles.find((pole) => pole.id === edge.toPoleId)
                    ?.title ?? edge.toPoleId;
                return (
                  <option key={edge.id} value={edge.id}>
                    {edge.id} ({fromTitle}
                    {" <-> "}
                    {toTitle})
                  </option>
                );
              })}
            </select>

            {selectedEdge && (
              <div className="space-y-2">
                {(() => {
                  const selectedEdgeFlag: BtEdgeChangeFlag =
                    getEdgeChangeFlag(selectedEdge);
                  return (
                    <div className="rounded border border-slate-200 bg-slate-100/70 p-2">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        Condutores do trecho
                      </div>
                      <div className="mt-1 text-[10px] text-slate-600">
                        Preset padrão para novos trechos:{" "}
                        <span className="font-semibold text-fuchsia-700">
                          Existente (Magenta)
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => {
                            const deleteSelectedEdge = () => {
                              onTopologyChange({
                                ...btTopology,
                                edges: btTopology.edges.filter(
                                  (edge) => edge.id !== selectedEdge.id,
                                ),
                              });
                            };

                            if (onRequestCriticalConfirmation) {
                              onRequestCriticalConfirmation({
                                title: "Apagar trecho BT?",
                                message: `Apagar o trecho ${selectedEdge.id}? Esta ação não pode ser desfeita.`,
                                confirmLabel: "Apagar trecho",
                                tone: "danger",
                                onConfirm: deleteSelectedEdge,
                              });
                              return;
                            }

                            deleteSelectedEdge();
                          }}
                          className="inline-flex h-8 items-center gap-1 rounded border border-rose-500/40 px-2 text-xs text-rose-600 hover:bg-rose-50"
                          title="Apagar trecho selecionado"
                        >
                          <Trash2 size={12} /> Trecho
                        </button>
                        <button
                          onClick={() =>
                            onBtSetEdgeChangeFlag?.(selectedEdge.id, "remove")
                          }
                          className={`inline-flex h-8 items-center rounded border px-2 text-xs ${
                            selectedEdgeFlag === "remove"
                              ? "border-rose-400 bg-rose-50 text-rose-700 hover:bg-rose-100"
                              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                          }`}
                          title="Flag de remoção"
                        >
                          Remoção
                        </button>
                        <button
                          onClick={() =>
                            onBtSetEdgeChangeFlag?.(selectedEdge.id, "new")
                          }
                          className={`inline-flex h-8 items-center rounded border px-2 text-xs ${
                            selectedEdgeFlag === "new"
                              ? "border-emerald-400 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                          }`}
                          title="Flag de novo"
                        >
                          Novo
                        </button>
                        <button
                          onClick={() =>
                            onBtSetEdgeChangeFlag?.(selectedEdge.id, "replace")
                          }
                          className={`inline-flex h-8 items-center rounded border px-2 text-xs ${
                            selectedEdgeFlag === "replace"
                              ? "border-yellow-400 bg-yellow-50 text-yellow-700 hover:bg-yellow-100"
                              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                          }`}
                          title="Flag de substituição"
                        >
                          Substituição
                        </button>
                        <button
                          onClick={() =>
                            onBtSetEdgeChangeFlag?.(selectedEdge.id, "existing")
                          }
                          className={`inline-flex h-8 items-center rounded border px-2 text-xs ${
                            selectedEdgeFlag === "existing"
                              ? "border-fuchsia-400 bg-fuchsia-50 text-fuchsia-700 hover:bg-fuchsia-100"
                              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                          }`}
                          title="Preset existente"
                        >
                          Existente
                        </button>
                        <button
                          onClick={() =>
                            updateEdgeVerified(
                              selectedEdge.id,
                              !selectedEdge.verified,
                            )
                          }
                          className="inline-flex h-8 items-center rounded border border-cyan-400 bg-white px-2 text-xs text-cyan-900 hover:bg-cyan-100"
                        >
                          {selectedEdge.verified
                            ? "Condutor verificado"
                            : "Marcar verificado"}
                        </button>
                        <button
                          onClick={() => {
                            updateEdgeConductors(selectedEdge.id, [
                              ...selectedEdge.conductors,
                              {
                                id: nextId("C"),
                                quantity: 1,
                                conductorName: CONDUCTOR_NAMES[0],
                              },
                            ]);
                          }}
                          className="inline-flex h-8 items-center gap-1 rounded border border-slate-300 bg-white px-2 text-xs text-slate-700 hover:bg-slate-100"
                        >
                          <Plus size={12} />{" "}
                          {selectedEdgeFlag === "replace"
                            ? "Condutor que entra"
                            : "Condutor"}
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {getEdgeChangeFlag(selectedEdge) === "replace" && (
                  <div className="rounded border border-cyan-300 bg-cyan-50 p-2 text-[10px] text-cyan-900">
                    <div className="font-semibold uppercase tracking-wide">
                      Condutor que entra
                    </div>
                    <div className="mt-1">
                      Este bloco define o novo condutor que ficará no trecho
                      após a substituição.
                    </div>
                  </div>
                )}

                {selectedEdge.conductors.map((entry) => (
                  <div
                    key={entry.id}
                    className="grid max-w-full grid-cols-[64px_minmax(0,1fr)_28px] items-center gap-2"
                  >
                    <input
                      type="number"
                      min={1}
                      value={entry.quantity}
                      title={`Quantidade do condutor ${entry.id}`}
                      onChange={(e) => {
                        const quantity = Math.max(
                          1,
                          numberFromInput(e.target.value),
                        );
                        updateEdgeConductors(
                          selectedEdge.id,
                          selectedEdge.conductors.map((item) =>
                            item.id === entry.id ? { ...item, quantity } : item,
                          ),
                        );
                      }}
                      className="w-full min-w-0 rounded border border-slate-300 bg-white p-1.5 text-[11px] text-slate-800"
                    />
                    <select
                      value={entry.conductorName}
                      title={`Tipo do condutor ${entry.id}`}
                      onChange={(e) => {
                        const conductorName = e.target.value;
                        updateEdgeConductors(
                          selectedEdge.id,
                          selectedEdge.conductors.map((item) =>
                            item.id === entry.id
                              ? { ...item, conductorName }
                              : item,
                          ),
                        );
                      }}
                      className="min-w-0 w-full rounded border border-slate-300 bg-white p-1.5 text-[11px] text-slate-800"
                    >
                      {CONDUCTOR_NAMES.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => {
                        updateEdgeConductors(
                          selectedEdge.id,
                          selectedEdge.conductors.filter(
                            (item) => item.id !== entry.id,
                          ),
                        );
                      }}
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center justify-self-end rounded border border-rose-500/30 text-rose-300 hover:bg-rose-500/10"
                      title="Remover condutor"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}

                {getEdgeChangeFlag(selectedEdge) === "replace" && (
                  <div className="rounded border border-amber-300 bg-amber-50 p-2">
                    <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                      Condutor que sai
                    </div>
                    {(selectedEdge.replacementFromConductors ?? []).length ===
                      0 && (
                      <button
                        onClick={() => {
                          updateEdgeReplacementFromConductors(selectedEdge.id, [
                            {
                              id: nextId("RC"),
                              quantity: 1,
                              conductorName: CONDUCTOR_NAMES[0],
                            },
                          ]);
                        }}
                        className="inline-flex h-7 items-center gap-1 rounded border border-amber-400 bg-white px-2 text-[11px] text-amber-800 hover:bg-amber-100"
                      >
                        <Plus size={12} /> Inserir condutor que sai
                      </button>
                    )}

                    {(selectedEdge.replacementFromConductors ?? []).map(
                      (entry) => (
                        <div
                          key={entry.id}
                          className="mt-2 grid max-w-full grid-cols-[64px_minmax(0,1fr)_28px] items-center gap-2"
                        >
                          <input
                            type="number"
                            min={1}
                            value={entry.quantity}
                            title={`Quantidade do condutor de saída ${entry.id}`}
                            onChange={(e) => {
                              const quantity = Math.max(
                                1,
                                numberFromInput(e.target.value),
                              );
                              updateEdgeReplacementFromConductors(
                                selectedEdge.id,
                                (
                                  selectedEdge.replacementFromConductors ?? []
                                ).map((item) =>
                                  item.id === entry.id
                                    ? { ...item, quantity }
                                    : item,
                                ),
                              );
                            }}
                            className="w-full min-w-0 rounded border border-amber-300 bg-white p-1.5 text-[11px] text-slate-800"
                          />
                          <select
                            value={entry.conductorName}
                            title={`Tipo do condutor de saída ${entry.id}`}
                            onChange={(e) => {
                              const conductorName = e.target.value;
                              updateEdgeReplacementFromConductors(
                                selectedEdge.id,
                                (
                                  selectedEdge.replacementFromConductors ?? []
                                ).map((item) =>
                                  item.id === entry.id
                                    ? { ...item, conductorName }
                                    : item,
                                ),
                              );
                            }}
                            className="min-w-0 w-full rounded border border-amber-300 bg-white p-1.5 text-[11px] text-slate-800"
                          >
                            {CONDUCTOR_NAMES.map((name) => (
                              <option key={name} value={name}>
                                {name}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => {
                              updateEdgeReplacementFromConductors(
                                selectedEdge.id,
                                (
                                  selectedEdge.replacementFromConductors ?? []
                                ).filter((item) => item.id !== entry.id),
                              );
                            }}
                            className="inline-flex h-7 w-7 shrink-0 items-center justify-center justify-self-end rounded border border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
                            title="Remover condutor de saída"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ),
                    )}
                  </div>
                )}

                <div className="rounded border border-slate-300 bg-white p-2 text-[10px] text-slate-700">
                  {getEdgeChangeFlag(selectedEdge) === "remove" && (
                    <div className="mb-1 rounded border border-rose-300 bg-rose-50 px-2 py-1 text-rose-700">
                      Trecho marcado para remoção na execução do projeto.
                    </div>
                  )}
                  {getEdgeChangeFlag(selectedEdge) === "replace" && (
                    <div className="mb-1 rounded border border-yellow-300 bg-yellow-50 px-2 py-1 text-yellow-800">
                      Substituição: no DXF serão enviados condutor que entra e
                      condutor que sai.
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Sigma size={12} />
                    <span>
                      Total de trechos no projeto: {btTopology.edges.length}
                    </span>
                  </div>
                  <div className="mt-1">
                    Metragem do trecho selecionado: {selectedEdgeLengthLabel}
                  </div>
                  <div className="mt-1 grid grid-cols-[auto_120px] items-center gap-2">
                    <span>Metragem CQT manual (m):</span>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={Number(
                        selectedEdge.cqtLengthMeters ??
                          selectedEdge.lengthMeters ??
                          0,
                      )}
                      onChange={(e) => {
                        updateEdgeCqtLengthMeters(
                          selectedEdge.id,
                          numberFromInput(e.target.value),
                        );
                      }}
                      className="w-full rounded border border-slate-300 bg-white p-1 text-[11px] text-slate-800"
                      title="Metragem CQT utilizada no cálculo de tensão"
                    />
                  </div>
                  <div>Metragem total da rede: {totalNetworkLengthLabel}</div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
};

export default BtTransformerEdgeSection;
