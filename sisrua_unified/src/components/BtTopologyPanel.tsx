import React from "react";
import { Activity } from "lucide-react";
import {
  BtNetworkScenario,
  BtPoleRamalEntry,
  BtTopology,
  BtTransformerReading,
} from "../types";
import type {
  BtDerivedSummary,
  BtPoleAccumulatedDemand,
  BtClandestinoDisplay,
  BtTransformerDerived,
} from "../services/btDerivedService";
import { useBtTopologySelection } from "../hooks/useBtTopologySelection";
import {
  CURRENT_TO_DEMAND_CONVERSION,
} from "../constants/btPhysicalConstants";
import type { CriticalConfirmationConfig } from "./BtModals";
import {
  useBtTopologyPanelBulkImport,
} from "./BtTopologyPanel/useBtTopologyPanelBulkImport";
import BtPoleVerificationSection from "./BtTopologyPanel/BtPoleVerificationSection";
import BtTransformerEdgeSection from "./BtTopologyPanel/BtTransformerEdgeSection";

interface BtTopologyPanelProps {
  btTopology: BtTopology;
  accumulatedByPole: BtPoleAccumulatedDemand[];
  summary: BtDerivedSummary;
  pointDemandKva: number;
  projectType: "ramais" | "geral" | "clandestino";
  btNetworkScenario: BtNetworkScenario;
  clandestinoAreaM2: number;
  clandestinoDisplay: BtClandestinoDisplay;
  transformersDerived: BtTransformerDerived[];
  transformerDebugById?: Record<
    string,
    { assignedClients: number; estimatedDemandKw: number }
  >;
  onTopologyChange: (next: BtTopology) => void;
  onSelectedPoleChange?: (poleId: string) => void;
  onSelectedTransformerChange?: (transformerId: string) => void;
  onSelectedEdgeChange?: (edgeId: string) => void;
  onBtSetEdgeChangeFlag?: (
    edgeId: string,
    edgeChangeFlag: "existing" | "new" | "remove" | "replace",
  ) => void;
  onBtSetPoleChangeFlag?: (
    poleId: string,
    nodeChangeFlag: "existing" | "new" | "remove" | "replace",
  ) => void;
  onBtTogglePoleCircuitBreak?: (
    poleId: string,
    circuitBreakPoint: boolean,
  ) => void;
  onBtSetTransformerChangeFlag?: (
    transformerId: string,
    transformerChangeFlag: "existing" | "new" | "remove" | "replace",
  ) => void;
  onProjectTypeChange?: (next: "ramais" | "clandestino") => void;
  onClandestinoAreaChange?: (nextAreaM2: number) => void;
  onBtRenamePole?: (poleId: string, title: string) => void;
  onBtRenameTransformer?: (transformerId: string, title: string) => void;
  onRequestCriticalConfirmation?: (config: CriticalConfirmationConfig) => void;
}

import {
  NORMAL_CLIENT_RAMAL_TYPES,
  CLANDESTINO_RAMAL_TYPE,
  numberFromInput,
  normalizeNumericClipboardText,
} from "./BtTopologyPanel/BtTopologyPanelUtils";

const BtTopologyPanel: React.FC<BtTopologyPanelProps> = ({
  btTopology,
  accumulatedByPole,
  summary,
  pointDemandKva,
  projectType,
  btNetworkScenario,
  clandestinoAreaM2,
  clandestinoDisplay,
  transformersDerived,
  transformerDebugById = {},
  onTopologyChange,
  onSelectedPoleChange,
  onSelectedTransformerChange,
  onSelectedEdgeChange,
  onBtSetEdgeChangeFlag,
  onBtSetPoleChangeFlag,
  onBtTogglePoleCircuitBreak,
  onBtSetTransformerChangeFlag,
  onProjectTypeChange,
  onClandestinoAreaChange,
  onBtRenamePole,
  onBtRenameTransformer,
  onRequestCriticalConfirmation,
}) => {
  const {
    selectedPoleId,
    selectedTransformerId,
    selectedEdgeId,
    selectedPole,
    selectedTransformer,
    selectedEdge,
    isPoleDropdownOpen,
    isTransformerDropdownOpen,
    setIsPoleDropdownOpen,
    setIsTransformerDropdownOpen,
    selectPole,
    selectTransformer,
    selectEdge,
  } = useBtTopologySelection({
    btTopology,
    onSelectedPoleChange,
    onSelectedTransformerChange,
    onSelectedEdgeChange,
  });

  const {
    isBulkRamalModalOpen,
    setIsBulkRamalModalOpen,
    bulkRamalText,
    setBulkRamalText,
    bulkRamalFeedback,
    setBulkRamalFeedback,
    isBulkDropActive,
    setIsBulkDropActive,
    bulkImportReview,
    setBulkImportReview,
    bulkFileInputRef,
    handleReviewApplyCurrentPoleRamais,
    handleReviewSkipCurrentPole,
    handleReviewNextPole,
    applyBulkRamalInsert,
    importBulkRamaisFromWorkbook,
  } = useBtTopologyPanelBulkImport({
    btTopology,
    onTopologyChange,
    onSelectedPoleChange,
    onProjectTypeChange,
    onClandestinoAreaChange,
  });
  const selectedEdgeLengthLabel =
    typeof (selectedEdge?.cqtLengthMeters ?? selectedEdge?.lengthMeters) ===
    "number"
      ? `${Number(selectedEdge?.cqtLengthMeters ?? selectedEdge?.lengthMeters).toFixed(2)} m`
      : "-";
  const totalNetworkLengthLabel = `${Math.round(summary.totalLengthMeters)} m`;

  const verifiedPoles = btTopology.poles.filter((pole) => pole.verified).length;
  const verifiedEdges = btTopology.edges.filter((edge) => edge.verified).length;
  const verifiedTransformers = btTopology.transformers.filter(
    (transformer) => transformer.verified,
  ).length;

  const updatePoleVerified = (poleId: string, verified: boolean) => {
    onTopologyChange({
      ...btTopology,
      poles: btTopology.poles.map((pole) =>
        pole.id === poleId ? { ...pole, verified } : pole,
      ),
    });
  };

  const updatePoleRamais = (poleId: string, ramais: BtPoleRamalEntry[]) => {
    onTopologyChange({
      ...btTopology,
      poles: btTopology.poles.map((pole) =>
        pole.id === poleId ? { ...pole, ramais } : pole,
      ),
    });
  };

  const updateTransformerVerified = (
    transformerId: string,
    verified: boolean,
  ) => {
    onTopologyChange({
      ...btTopology,
      transformers: btTopology.transformers.map((transformer) =>
        transformer.id === transformerId
          ? { ...transformer, verified }
          : transformer,
      ),
    });
  };

  const updateEdgeVerified = (edgeId: string, verified: boolean) => {
    onTopologyChange({
      ...btTopology,
      edges: btTopology.edges.map((edge) =>
        edge.id === edgeId ? { ...edge, verified } : edge,
      ),
    });
  };

  const updateEdgeCqtLengthMeters = (edgeId: string, lengthMeters: number) => {
    const sanitized = Number.isFinite(lengthMeters)
      ? Math.max(0, Number(lengthMeters.toFixed(2)))
      : 0;

    onTopologyChange({
      ...btTopology,
      edges: btTopology.edges.map((edge) =>
        edge.id === edgeId ? { ...edge, cqtLengthMeters: sanitized } : edge,
      ),
    });
  };

  const updateTransformerReadings = (
    transformerId: string,
    readings: BtTransformerReading[],
  ) => {
    // Compute demandKw and monthlyBillBrl inline using physical constants from btPhysicalConstants.
    // The backend will recompute these in the next /api/bt/derived call for authoritative values.
    const monthlyBillBrl = readings.reduce(
      (acc, r) => acc + ((r as { billedBrl?: number }).billedBrl ?? 0),
      0,
    );
    const correctedDemands = readings.map((r) => {
      const currentMaxA = (r as { currentMaxA?: number }).currentMaxA ?? 0;
      const temperatureFactor =
        (r as { temperatureFactor?: number }).temperatureFactor ?? 1;
      return currentMaxA * CURRENT_TO_DEMAND_CONVERSION * temperatureFactor;
    });
    const demandKw = Number(Math.max(...correctedDemands, 0).toFixed(2));

    onTopologyChange({
      ...btTopology,
      transformers: btTopology.transformers.map((transformer) => {
        if (transformer.id !== transformerId) {
          return transformer;
        }

        return {
          ...transformer,
          readings,
          monthlyBillBrl,
          demandKw,
        };
      }),
    });
  };

  const updateTransformerProjectPower = (
    transformerId: string,
    projectPowerKva: number,
  ) => {
    onTopologyChange({
      ...btTopology,
      transformers: btTopology.transformers.map((transformer) =>
        transformer.id === transformerId
          ? { ...transformer, projectPowerKva }
          : transformer,
      ),
    });
  };

  const handleEditablePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (!(target instanceof HTMLInputElement) || target.type !== "number") {
      return;
    }

    const rawText = e.clipboardData.getData("text");
    const normalized = normalizeNumericClipboardText(rawText);
    if (!normalized) {
      return;
    }

    e.preventDefault();
    const start = target.selectionStart ?? target.value.length;
    const end = target.selectionEnd ?? target.value.length;
    const nextValue = `${target.value.slice(0, start)}${normalized}${target.value.slice(end)}`;
    target.value = nextValue;
    target.dispatchEvent(new Event("input", { bubbles: true }));
  };

  const updateEdgeConductors = (
    edgeId: string,
    conductors: BtTopology["edges"][number]["conductors"],
  ) => {
    onTopologyChange({
      ...btTopology,
      edges: btTopology.edges.map((edge) => {
        if (edge.id !== edgeId) {
          return edge;
        }

        return {
          ...edge,
          conductors,
        };
      }),
    });
  };

  const updateEdgeReplacementFromConductors = (
    edgeId: string,
    replacementFromConductors: BtTopology["edges"][number]["conductors"],
  ) => {
    onTopologyChange({
      ...btTopology,
      edges: btTopology.edges.map((edge) => {
        if (edge.id !== edgeId) {
          return edge;
        }

        return {
          ...edge,
          replacementFromConductors,
        };
      }),
    });
  };

  const clandestinoDemandKw =
    projectType === "clandestino" ? clandestinoDisplay.demandKw : 0;
  const clandestinoAreaRange = {
    min: clandestinoDisplay.areaMin,
    max: clandestinoDisplay.areaMax,
  };
  const clandestinoDemandKva =
    projectType === "clandestino" ? clandestinoDisplay.demandKva : null;
  const clandestinoDiversificationFactor =
    projectType === "clandestino"
      ? clandestinoDisplay.diversificationFactor
      : null;
  const clandestinoFinalDemandKva =
    projectType === "clandestino" ? clandestinoDisplay.finalDemandKva : 0;
  const isNormalProject = projectType !== "clandestino";
  const transformersWithReadings = btTopology.transformers.filter(
    (transformer) => transformer.readings.length > 0,
  ).length;
  const transformersWithoutReadings = Math.max(
    0,
    btTopology.transformers.length - transformersWithReadings,
  );
  const pointDemandCardClass =
    projectType === "clandestino"
      ? "border-emerald-300 bg-emerald-50 text-emerald-900"
      : btTopology.transformers.length === 0 || transformersWithReadings === 0
        ? "border-amber-300 bg-amber-50 text-amber-900"
        : transformersWithoutReadings > 0
          ? "border-yellow-300 bg-yellow-50 text-yellow-900"
          : "border-emerald-300 bg-emerald-50 text-emerald-900";
  const pointDemandStatus = !isNormalProject
    ? null
    : btTopology.transformers.length === 0
      ? "Sem transformador cadastrado. A demanda ficará zerada até inserir ao menos 1 trafo."
      : transformersWithReadings === 0
        ? "Sem leituras de trafo. Preencha as leituras para calcular a demanda por ponto."
        : transformersWithoutReadings > 0
          ? `Demanda parcial: ${transformersWithReadings}/${btTopology.transformers.length} trafo(s) com leituras.`
          : "Demanda consolidada com leituras em todos os trafos.";
  const poleTitleById = new Map(
    btTopology.poles.map((pole) => [pole.id, pole.title || pole.id]),
  );
  const clientDemandByPole = [...accumulatedByPole].sort(
    (a, b) => b.localTrechoDemandKva - a.localTrechoDemandKva,
  );

  return (
    <div
      className="space-y-4 rounded-2xl border border-slate-300 bg-white p-4 shadow-sm"
      onPasteCapture={handleEditablePaste}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-700">
          <Activity size={16} />
          <h3 className="text-[11px] font-black uppercase tracking-[0.16em]">
            Topologia BT
          </h3>
        </div>
        <span className="text-[10px] font-semibold text-slate-600 uppercase">
          {projectType} / {btNetworkScenario === "asis" ? "ATUAL" : "PROJETO"}
        </span>
      </div>

      <div
        className={`rounded-lg border p-2 text-[10px] ${btNetworkScenario === "asis" ? "border-cyan-300 bg-cyan-50 text-cyan-900" : "border-indigo-300 bg-indigo-50 text-indigo-900"}`}
      >
        {btNetworkScenario === "asis"
          ? "Cenário REDE ATUAL: painel voltado para leitura, conferência e cálculo sobre rede existente."
          : "Cenário REDE NOVA: painel voltado para projeto, lançamento e dimensionamento da nova topologia."}
      </div>

      <div className="space-y-2 rounded-lg border border-slate-300 bg-slate-50 p-3 text-[10px] text-slate-700">
        <div className="font-semibold uppercase tracking-wide text-slate-800">
          Fluxo de Lançamento BT
        </div>
        <div>
          0. Defina se o projeto é Normal ou Clandestino (m² obrigatório no
          clandestino).
        </div>
        <div>
          1. Informe a localização dos postes (ponto no mapa ou coordenadas).
        </div>
        <div>
          2/3. Trace os condutores e marque os postes com trafo (ordem livre).
        </div>
        <div>4. Informe os ramais (clientes) em cada poste.</div>
      </div>

      <div className="space-y-2 rounded-lg border border-cyan-300 bg-cyan-50 p-3 text-[10px] text-cyan-900">
        <div className="font-semibold uppercase tracking-wide">
          Passo 0 · Tipo de Projeto
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-cyan-900">
              Modo de cálculo
            </label>
            <select
              value={projectType === "clandestino" ? "clandestino" : "ramais"}
              onChange={(e) =>
                onProjectTypeChange?.(
                  e.target.value as "ramais" | "clandestino",
                )
              }
              title="Modo de cálculo do projeto BT"
              className="w-full rounded border border-cyan-300 bg-white p-2 text-xs text-slate-800"
            >
              <option value="ramais">Normal</option>
              <option value="clandestino">Clandestino</option>
            </select>
          </div>
          {projectType === "clandestino" && (
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-cyan-900">
                Área (m²)
              </label>
              <input
                type="number"
                min={0}
                step={1}
                value={clandestinoAreaM2}
                title="Área de clandestinos em metros quadrados"
                onFocus={(e) => e.target.select()}
                onClick={(e) => e.currentTarget.select()}
                onChange={(e) =>
                  onClandestinoAreaChange?.(
                    Math.max(0, Math.round(numberFromInput(e.target.value))),
                  )
                }
                className="w-28 rounded border border-cyan-300 bg-white p-2 text-xs text-slate-800"
              />
            </div>
          )}
        </div>
        {projectType !== "clandestino" && (
          <div className="rounded border border-cyan-300 bg-white p-2 text-[10px] text-slate-700">
            <div className="mb-1 font-semibold text-cyan-900">
              Entrada rapida de ramais
            </div>
            <div className="mb-2 text-[10px] text-slate-600">
              Cole tabela do Excel (N do Poste + colunas de tipos) para insercao
              em lote.
            </div>
            <button
              onClick={() => {
                setBulkRamalFeedback("");
                setIsBulkRamalModalOpen(true);
              }}
              className="rounded border border-cyan-300 bg-cyan-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-cyan-500"
            >
              Inserir bruto de ramais
            </button>
          </div>
        )}
      </div>

      {isBulkRamalModalOpen && (
        <div className="fixed inset-0 z-[980] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-3xl rounded-xl border border-slate-300 bg-white p-4 shadow-2xl">
            <div className="text-sm font-semibold text-slate-800">
              Insercao bruta de ramais
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Formato esperado: tabela colada do Excel com primeira coluna "N do
              Poste" e colunas de tipos de ramal (ex.: 13 DX 6 AWG, 70 MMX, 185
              MMX).
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              Compatibilidade legada: cabeçalhos 33 AA/33 AC/53 AA/53 AC também
              são aceitos automaticamente.
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsBulkDropActive(true);
              }}
              onDragEnter={(e) => {
                e.preventDefault();
                setIsBulkDropActive(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setIsBulkDropActive(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setIsBulkDropActive(false);
                const file = e.dataTransfer.files?.[0];
                if (!file) {
                  return;
                }
                void importBulkRamaisFromWorkbook(file);
              }}
              className={`mt-3 rounded border-2 border-dashed p-3 text-center text-xs ${isBulkDropActive ? "border-blue-500 bg-blue-50 text-blue-800" : "border-slate-300 bg-slate-50 text-slate-600"}`}
            >
              Arraste e solte a planilha (.xlsx/.xlsm) para ler a aba RAMAL
              automaticamente.
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => bulkFileInputRef.current?.click()}
                  className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-100"
                >
                  Selecionar arquivo
                </button>
              </div>
              <input
                ref={bulkFileInputRef}
                type="file"
                accept=".xlsx,.xlsm,.xls"
                className="hidden"
                aria-label="Selecionar planilha de ramais"
                title="Selecionar planilha de ramais"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    void importBulkRamaisFromWorkbook(file);
                  }
                  e.currentTarget.value = "";
                }}
              />
            </div>

            <textarea
              value={bulkRamalText}
              onChange={(e) => setBulkRamalText(e.target.value)}
              placeholder="Cole aqui a tabela"
              className="mt-3 h-56 w-full rounded border border-slate-300 bg-white p-2 text-[11px] text-slate-800"
            />

            {bulkRamalFeedback && (
              <div className="mt-2 rounded border border-slate-200 bg-slate-50 p-2 text-[10px] text-slate-700">
                {bulkRamalFeedback}
              </div>
            )}

            {bulkImportReview && (
              <div className="mt-2 rounded border border-cyan-200 bg-cyan-50 p-2 text-[10px] text-cyan-900">
                <div className="font-semibold">
                  Revisão sequencial ativa: poste{" "}
                  {bulkImportReview.currentPoleIndex + 1}/
                  {bulkImportReview.orderedPoleIds.length}
                </div>
                <div className="mt-1">
                  Poste atual:{" "}
                  {
                    bulkImportReview.orderedPoleIds[
                      bulkImportReview.currentPoleIndex
                    ]
                  }
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleReviewApplyCurrentPoleRamais}
                    className="rounded border border-emerald-500 bg-emerald-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-emerald-500"
                  >
                    Aplicar
                  </button>
                  <button
                    type="button"
                    onClick={handleReviewSkipCurrentPole}
                    className="rounded border border-amber-400 bg-amber-500 px-2 py-1 text-[10px] font-semibold text-white hover:bg-amber-400"
                  >
                    Pular
                  </button>
                  <button
                    type="button"
                    onClick={handleReviewNextPole}
                    className="rounded border border-cyan-400 bg-cyan-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-cyan-500"
                  >
                    Próximo
                  </button>
                </div>
              </div>
            )}

            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setIsBulkRamalModalOpen(false);
                  setBulkImportReview(null);
                }}
                className="rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
              >
                Fechar
              </button>
              <button
                onClick={applyBulkRamalInsert}
                className="rounded border border-blue-500 bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-500"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <div className="rounded-lg border border-slate-300 bg-white p-2 text-slate-700">
          Postes: {summary.poles}
        </div>
        <div className="rounded-lg border border-slate-300 bg-white p-2 text-slate-700">
          Condutores: {summary.edges}
        </div>
        <div className="rounded-lg border border-slate-300 bg-white p-2 text-slate-700">
          Trafos: {summary.transformers}
        </div>
        <div className="rounded-lg border border-slate-300 bg-white p-2 text-slate-700">
          Rede: {Math.round(summary.totalLengthMeters)} m
        </div>
      </div>

      {btNetworkScenario === "asis" && (
        <div className="grid grid-cols-3 gap-2 text-[10px]">
          <div className="rounded-lg border border-cyan-300 bg-cyan-50 p-2 text-cyan-900">
            Postes verificados: {verifiedPoles}/{summary.poles}
          </div>
          <div className="rounded-lg border border-cyan-300 bg-cyan-50 p-2 text-cyan-900">
            Condutores verificados: {verifiedEdges}/{summary.edges}
          </div>
          <div className="rounded-lg border border-cyan-300 bg-cyan-50 p-2 text-cyan-900">
            Trafos verificados: {verifiedTransformers}/{summary.transformers}
          </div>
        </div>
      )}

      <div
        className={`rounded-lg border p-2 text-[10px] ${pointDemandCardClass}`}
      >
        {projectType === "clandestino"
          ? `Demanda por ponto (regra clandestino): ${pointDemandKva.toFixed(2)} kVA`
          : `Demanda por ponto (leituras de trafo): ${pointDemandKva.toFixed(2)} kVA`}
        {pointDemandStatus && <div className="mt-1">{pointDemandStatus}</div>}
      </div>

      {clientDemandByPole.length > 0 && (
        <div className="rounded-lg border border-cyan-200 bg-slate-50 p-2 text-[10px] text-slate-700">
          <div className="mb-1 font-semibold uppercase tracking-wide text-cyan-800">
            Ranking Demanda de Clientes (Top 5)
          </div>
          {clientDemandByPole.slice(0, 5).map((item) => (
            <div
              key={item.poleId}
              className="flex items-center justify-between border-b border-cyan-200 py-0.5 last:border-b-0"
            >
              <span>{poleTitleById.get(item.poleId) ?? item.poleId}</span>
              <span className="flex items-center gap-1">
                CLT {item.localClients} | {item.localTrechoDemandKva.toFixed(2)}{" "}
                kVA
                {(typeof item.voltageV === "number" ||
                  typeof item.dvAccumPercent === "number") && (
                  <span
                    className={`rounded px-1 py-0.5 text-[9px] font-semibold ${item.cqtStatus === "CRÍTICO" ? "bg-red-100 text-red-700" : item.cqtStatus === "ATENÇÃO" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}
                    title="Indicador CQT no ponto"
                  >
                    {typeof item.voltageV === "number"
                      ? `${item.voltageV.toFixed(1)}V`
                      : "-"}{" "}
                    /{" "}
                    {typeof item.dvAccumPercent === "number"
                      ? `${item.dvAccumPercent.toFixed(2)}%`
                      : "-"}
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {projectType === "clandestino" && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-[10px] text-amber-900">
          {clandestinoDemandKva === null
            ? `Área clandestina inválida (${clandestinoAreaM2} m²). Faixa da planilha: ${clandestinoAreaRange.min}-${clandestinoAreaRange.max} m² (inteiros).`
            : `Carga base clandestinos (${clandestinoAreaM2} m²): ${clandestinoDemandKw.toFixed(2)} kVA`}
          {clandestinoDemandKva !== null && (
            <div className="mt-1 text-amber-900">
              Clientes:{" "}
              {btTopology.poles.reduce(
                (acc, p) =>
                  acc +
                  (p.ramais?.reduce((rAcc, r) => rAcc + r.quantity, 0) ?? 0),
                0,
              )}{" "}
              | Fator:{" "}
              {clandestinoDiversificationFactor?.toFixed(2) ?? "inválido"} |
              Demanda final: {clandestinoFinalDemandKva.toFixed(2)} kVA
            </div>
          )}
        </div>
      )}

      <BtPoleVerificationSection
        btTopology={btTopology}
        projectType={projectType}
        selectedPoleId={selectedPoleId}
        selectedPole={selectedPole}
        isPoleDropdownOpen={isPoleDropdownOpen}
        setIsPoleDropdownOpen={setIsPoleDropdownOpen}
        selectPole={selectPole}
        onBtRenamePole={onBtRenamePole}
        onBtSetPoleChangeFlag={onBtSetPoleChangeFlag}
        onBtTogglePoleCircuitBreak={onBtTogglePoleCircuitBreak}
        updatePoleVerified={updatePoleVerified}
        updatePoleRamais={updatePoleRamais}
      />

      <BtTransformerEdgeSection
        btTopology={btTopology}
        btNetworkScenario={btNetworkScenario}
        selectedTransformerId={selectedTransformerId}
        selectedTransformer={selectedTransformer}
        isTransformerDropdownOpen={isTransformerDropdownOpen}
        setIsTransformerDropdownOpen={setIsTransformerDropdownOpen}
        selectTransformer={selectTransformer}
        selectedEdgeId={selectedEdgeId}
        selectedEdge={selectedEdge}
        selectEdge={selectEdge}
        selectedEdgeLengthLabel={selectedEdgeLengthLabel}
        totalNetworkLengthLabel={totalNetworkLengthLabel}
        pointDemandKva={pointDemandKva}
        transformerDebugById={transformerDebugById}
        onTopologyChange={onTopologyChange}
        onBtRenameTransformer={onBtRenameTransformer}
        onBtSetTransformerChangeFlag={onBtSetTransformerChangeFlag}
        onBtSetEdgeChangeFlag={onBtSetEdgeChangeFlag}
        onRequestCriticalConfirmation={onRequestCriticalConfirmation}
        updateTransformerVerified={updateTransformerVerified}
        updateTransformerReadings={updateTransformerReadings}
        updateTransformerProjectPower={updateTransformerProjectPower}
        updateEdgeVerified={updateEdgeVerified}
        updateEdgeCqtLengthMeters={updateEdgeCqtLengthMeters}
        updateEdgeConductors={updateEdgeConductors}
        updateEdgeReplacementFromConductors={updateEdgeReplacementFromConductors}
      />
    </div>
  );
};

export default BtTopologyPanel;
