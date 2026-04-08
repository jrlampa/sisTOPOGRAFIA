import React from 'react';
import { Activity, Plus, Trash2, Sigma, ChevronDown } from 'lucide-react';
import { BtEdge, BtNetworkScenario, BtPoleNode, BtPoleRamalEntry, BtTopology, BtTransformer, BtTransformerReading } from '../types';
import type { BtDerivedSummary } from '../services/btDerivedService';
import { useBtTopologySelection } from '../hooks/useBtTopologySelection';
import {
  calculateClandestinoDemandKvaByAreaAndClients,
  calculateRamalDmdiKva,
  calculateTransformerDemandKw,
  calculateTransformerMonthlyBill,
  calculateClandestinoDemandKw,
  getClandestinoDiversificationFactorByClients,
  getClandestinoAreaRange,
  getClandestinoKvaByArea,
  type BtPoleAccumulatedDemand
} from '../utils/btCalculations';
import { LEGACY_ID_ENTROPY } from '../constants/magicNumbers';

interface BtTopologyPanelProps {
  btTopology: BtTopology;
  accumulatedByPole: BtPoleAccumulatedDemand[];
  summary: BtDerivedSummary;
  pointDemandKva: number;
  projectType: 'ramais' | 'geral' | 'clandestino';
  btNetworkScenario: BtNetworkScenario;
  clandestinoAreaM2: number;
  transformerDebugById?: Record<string, { assignedClients: number; estimatedDemandKw: number }>;
  onTopologyChange: (next: BtTopology) => void;
  onSelectedPoleChange?: (poleId: string) => void;
  onSelectedTransformerChange?: (transformerId: string) => void;
  onSelectedEdgeChange?: (edgeId: string) => void;
  onBtSetEdgeChangeFlag?: (edgeId: string, edgeChangeFlag: 'existing' | 'new' | 'remove' | 'replace') => void;
  onBtSetPoleChangeFlag?: (poleId: string, nodeChangeFlag: 'existing' | 'new' | 'remove' | 'replace') => void;
  onBtTogglePoleCircuitBreak?: (poleId: string, circuitBreakPoint: boolean) => void;
  onBtSetTransformerChangeFlag?: (transformerId: string, transformerChangeFlag: 'existing' | 'new' | 'remove' | 'replace') => void;
  onProjectTypeChange?: (next: 'ramais' | 'clandestino') => void;
  onClandestinoAreaChange?: (nextAreaM2: number) => void;
  onBtRenamePole?: (poleId: string, title: string) => void;
  onBtRenameTransformer?: (transformerId: string, title: string) => void;
}

type BtEdgeChangeFlag = NonNullable<BtEdge['edgeChangeFlag']>;
type BtPoleChangeFlag = NonNullable<BtPoleNode['nodeChangeFlag']>;
type BtTransformerChangeFlag = NonNullable<BtTransformer['transformerChangeFlag']>;

const getEdgeChangeFlag = (edge: BtEdge): BtEdgeChangeFlag => {
  if (edge.edgeChangeFlag) {
    return edge.edgeChangeFlag;
  }

  return edge.removeOnExecution ? 'remove' : 'existing';
};

const getPoleChangeFlag = (pole: BtPoleNode): BtPoleChangeFlag => pole.nodeChangeFlag ?? 'existing';
const getTransformerChangeFlag = (transformer: BtTransformer): BtTransformerChangeFlag => transformer.transformerChangeFlag ?? 'existing';

const CURRENT_TO_DEMAND_CONVERSION = 0.375;
const DEFAULT_TEMPERATURE_FACTOR = 1.2;
const NORMAL_CLIENT_RAMAL_TYPES = [
  '5 CC',
  '8 CC',
  '13 CC',
  '21 CC',
  '33 CC',
  '53 CC',
  '67 CC',
  '85 CC',
  '107 CC',
  '127 CC',
  '253 CC',
  '13 DX 6 AWG',
  '13 TX 6 AWG',
  '13 QX 6 AWG',
  '21 QX 4 AWG',
  '53 QX 1/0',
  '85 QX 3/0',
  '107 QX 4/0',
  '70 MMX',
  '185 MMX'
];
const CLANDESTINO_RAMAL_TYPE = 'Clandestino';
const CONDUCTOR_NAMES = [
  '70 Al - MX',
  '185 Al - MX',
  '240 Al - MX',
  '25 Al - Arm',
  '50 Al - Arm',
  '95 Al - Arm',
  '150 Al - Arm',
  '240 Al - Arm',
  '25 Al',
  '35 Cu',
  '70 Cu',
  '95 Al',
  '120 Cu',
  '240 Al',
  '240 Cu',
  '500 Cu',
  '10 Cu_CONC_bi',
  '10 Cu_CONC_Tri',
  '16 Al_CONC_bi',
  '16 Al_CONC_Tri',
  '13 Al - DX',
  '13 Al - TX',
  '13 Al - QX',
  '21 Al - QX',
  '53 Al - QX',
  '6 AWG',
  '2 AWG',
  '1/0 AWG',
  '3/0 AWG',
  '4/0 AWG'
];
const numberFromInput = (value: string, decimals?: number): number => {
  const normalized = value.replace(',', '.');
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  if (decimals === undefined) {
    return parsed;
  }

  const factor = 10 ** decimals;
  return Math.round(parsed * factor) / factor;
};

const selectAllInputText = (e: React.FocusEvent<HTMLInputElement> | React.MouseEvent<HTMLInputElement>) => {
  e.currentTarget.select();
};

const normalizeNumericClipboardText = (raw: string): string => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return '';
  }

  // Keep only digits, sign and separators commonly found in spreadsheets/emails.
  const cleaned = trimmed.replace(/\s+/g, '').replace(/[^0-9,.-]/g, '');
  if (!cleaned) {
    return '';
  }

  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');

  // If both separators exist, the rightmost one is treated as decimal separator.
  if (lastComma !== -1 && lastDot !== -1) {
    const decimalSeparator = lastComma > lastDot ? ',' : '.';
    const thousandSeparator = decimalSeparator === ',' ? '.' : ',';
    const withoutThousands = cleaned.split(thousandSeparator).join('');
    return decimalSeparator === ','
      ? withoutThousands.replace(',', '.')
      : withoutThousands;
  }

  // Single separator case: comma is decimal in pt-BR user flow.
  if (lastComma !== -1) {
    return cleaned.replace(',', '.');
  }

  return cleaned;
};

const formatBr = (n: number, decimals = 2): string =>
  n.toFixed(decimals).replace('.', ',');

const parseBr = (s: string): number => {
  const normalized = normalizeNumericClipboardText(s.trim());
  return parseFloat(normalized);
};

const nextId = (prefix: string): string => `${prefix}${Date.now()}${Math.floor(Math.random() * LEGACY_ID_ENTROPY)}`;

function NumericTextInput({
  value,
  decimals = 2,
  onChange,
  className,
  title,
  placeholder,
}: {
  value: number;
  decimals?: number;
  onChange: (val: number) => void;
  className?: string;
  title?: string;
  placeholder?: string;
}) {
  const [editing, setEditing] = React.useState(false);
  const [editDisplay, setEditDisplay] = React.useState('');

  // While not editing, always derive display from parent value (always comma-formatted).
  // While editing, display exactly what the user typed.
  const display = editing ? editDisplay : formatBr(value, decimals);

  return (
    <input
      type="text"
      inputMode="decimal"
      value={display}
      title={title}
      aria-label={title}
      placeholder={placeholder}
      onFocus={(e) => {
        setEditing(true);
        setEditDisplay(formatBr(value, decimals));
        e.target.select();
      }}
      onBlur={() => {
        setEditing(false);
      }}
      onClick={(e) => e.currentTarget.select()}
      onChange={(e) => {
        const raw = e.target.value;
        setEditDisplay(raw);
        const parsed = parseBr(raw);
        if (Number.isFinite(parsed)) {
          onChange(parsed);
        }
      }}
      className={className}
    />
  );
}

const BtTopologyPanel: React.FC<BtTopologyPanelProps> = ({
  btTopology,
  accumulatedByPole,
  summary,
  pointDemandKva,
  projectType,
  btNetworkScenario,
  clandestinoAreaM2,
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
  const selectedEdgeLengthLabel =
    typeof selectedEdge?.lengthMeters === 'number'
      ? `${Math.round(selectedEdge.lengthMeters)} m`
      : '-';
  const totalNetworkLengthLabel = `${Math.round(summary.totalLengthMeters)} m`;

  const verifiedPoles = btTopology.poles.filter((pole) => pole.verified).length;
  const verifiedEdges = btTopology.edges.filter((edge) => edge.verified).length;
  const verifiedTransformers = btTopology.transformers.filter((transformer) => transformer.verified).length;

  const updatePoleVerified = (poleId: string, verified: boolean) => {
    onTopologyChange({
      ...btTopology,
      poles: btTopology.poles.map((pole) => pole.id === poleId ? { ...pole, verified } : pole)
    });
  };

  const updatePoleRamais = (poleId: string, ramais: BtPoleRamalEntry[]) => {
    onTopologyChange({
      ...btTopology,
      poles: btTopology.poles.map((pole) => pole.id === poleId ? { ...pole, ramais } : pole)
    });
  };

  const updateTransformerVerified = (transformerId: string, verified: boolean) => {
    onTopologyChange({
      ...btTopology,
      transformers: btTopology.transformers.map((transformer) => transformer.id === transformerId ? { ...transformer, verified } : transformer)
    });
  };

  const updateEdgeVerified = (edgeId: string, verified: boolean) => {
    onTopologyChange({
      ...btTopology,
      edges: btTopology.edges.map((edge) => edge.id === edgeId ? { ...edge, verified } : edge)
    });
  };

  const updateTransformerReadings = (transformerId: string, readings: BtTransformerReading[]) => {
    const monthlyBillBrl = calculateTransformerMonthlyBill(readings);
    const demandKw = calculateTransformerDemandKw(readings);

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
          demandKw
        };
      })
    });
  };

  const updateTransformerProjectPower = (transformerId: string, projectPowerKva: number) => {
    onTopologyChange({
      ...btTopology,
      transformers: btTopology.transformers.map((transformer) =>
        transformer.id === transformerId ? { ...transformer, projectPowerKva } : transformer
      )
    });
  };

  const handleEditablePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (!(target instanceof HTMLInputElement) || target.type !== 'number') {
      return;
    }

    const rawText = e.clipboardData.getData('text');
    const normalized = normalizeNumericClipboardText(rawText);
    if (!normalized) {
      return;
    }

    e.preventDefault();
    const start = target.selectionStart ?? target.value.length;
    const end = target.selectionEnd ?? target.value.length;
    const nextValue = `${target.value.slice(0, start)}${normalized}${target.value.slice(end)}`;
    target.value = nextValue;
    target.dispatchEvent(new Event('input', { bubbles: true }));
  };

  const updateEdgeConductors = (edgeId: string, conductors: BtTopology['edges'][number]['conductors']) => {
    onTopologyChange({
      ...btTopology,
      edges: btTopology.edges.map((edge) => {
        if (edge.id !== edgeId) {
          return edge;
        }

        return {
          ...edge,
          conductors
        };
      })
    });
  };

  const updateEdgeReplacementFromConductors = (edgeId: string, replacementFromConductors: BtTopology['edges'][number]['conductors']) => {
    onTopologyChange({
      ...btTopology,
      edges: btTopology.edges.map((edge) => {
        if (edge.id !== edgeId) {
          return edge;
        }

        return {
          ...edge,
          replacementFromConductors
        };
      })
    });
  };

  const clandestinoDemandKw = projectType === 'clandestino'
    ? calculateClandestinoDemandKw(clandestinoAreaM2)
    : 0;
  const clandestinoAreaRange = getClandestinoAreaRange();
  const clandestinoDemandKva = projectType === 'clandestino'
    ? getClandestinoKvaByArea(clandestinoAreaM2)
    : null;
  const totalClandestinoClients = btTopology.poles.reduce(
    (acc, pole) => acc + (pole.ramais ?? []).reduce((sum, ramal) => sum + ramal.quantity, 0),
    0
  );
  const clandestinoDiversificationFactor = projectType === 'clandestino'
    ? getClandestinoDiversificationFactorByClients(totalClandestinoClients)
    : null;
  const clandestinoFinalDemandKva = projectType === 'clandestino'
    ? calculateClandestinoDemandKvaByAreaAndClients(clandestinoAreaM2, totalClandestinoClients)
    : 0;
  const isNormalProject = projectType !== 'clandestino';
  const transformersWithReadings = btTopology.transformers.filter((transformer) => transformer.readings.length > 0).length;
  const transformersWithoutReadings = Math.max(0, btTopology.transformers.length - transformersWithReadings);
  const pointDemandCardClass = projectType === 'clandestino'
    ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
    : btTopology.transformers.length === 0 || transformersWithReadings === 0
      ? 'border-amber-300 bg-amber-50 text-amber-900'
      : transformersWithoutReadings > 0
        ? 'border-yellow-300 bg-yellow-50 text-yellow-900'
        : 'border-emerald-300 bg-emerald-50 text-emerald-900';
  const pointDemandStatus = !isNormalProject
    ? null
    : btTopology.transformers.length === 0
      ? 'Sem transformador cadastrado. A demanda ficará zerada até inserir ao menos 1 trafo.'
      : transformersWithReadings === 0
        ? 'Sem leituras de trafo. Preencha as leituras para calcular a demanda por ponto.'
        : transformersWithoutReadings > 0
          ? `Demanda parcial: ${transformersWithReadings}/${btTopology.transformers.length} trafo(s) com leituras.`
          : 'Demanda consolidada com leituras em todos os trafos.';
  const clientDemandByPole = [...accumulatedByPole]
    .sort((a, b) => b.localTrechoDemandKva - a.localTrechoDemandKva);

  return (
    <div className="space-y-4 rounded-2xl border border-slate-300 bg-white p-4 shadow-sm" onPasteCapture={handleEditablePaste}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-700">
          <Activity size={16} />
          <h3 className="text-[11px] font-black uppercase tracking-[0.16em]">Topologia BT</h3>
        </div>
        <span className="text-[10px] font-semibold text-slate-600 uppercase">{projectType} / {btNetworkScenario === 'asis' ? 'ATUAL' : 'PROJETO'}</span>
      </div>

      <div className={`rounded-lg border p-2 text-[10px] ${btNetworkScenario === 'asis' ? 'border-cyan-300 bg-cyan-50 text-cyan-900' : 'border-indigo-300 bg-indigo-50 text-indigo-900'}`}>
        {btNetworkScenario === 'asis'
          ? 'Cenário REDE ATUAL: painel voltado para leitura, conferência e cálculo sobre rede existente.'
          : 'Cenário REDE NOVA: painel voltado para projeto, lançamento e dimensionamento da nova topologia.'}
      </div>

      <div className="space-y-2 rounded-lg border border-slate-300 bg-slate-50 p-3 text-[10px] text-slate-700">
        <div className="font-semibold uppercase tracking-wide text-slate-800">Fluxo de Lançamento BT</div>
        <div>0. Defina se o projeto é Normal ou Clandestino (m² obrigatório no clandestino).</div>
        <div>1. Informe a localização dos postes (ponto no mapa ou coordenadas).</div>
        <div>2/3. Trace os condutores e marque os postes com trafo (ordem livre).</div>
        <div>4. Informe os ramais (clientes) em cada poste.</div>
      </div>

      <div className="space-y-2 rounded-lg border border-cyan-300 bg-cyan-50 p-3 text-[10px] text-cyan-900">
        <div className="font-semibold uppercase tracking-wide">Passo 0 · Tipo de Projeto</div>
        <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-cyan-900">Modo de cálculo</label>
            <select
              value={projectType === 'clandestino' ? 'clandestino' : 'ramais'}
              onChange={(e) => onProjectTypeChange?.(e.target.value as 'ramais' | 'clandestino')}
              title="Modo de cálculo do projeto BT"
              className="w-full rounded border border-cyan-300 bg-white p-2 text-xs text-slate-800"
            >
              <option value="ramais">Normal</option>
              <option value="clandestino">Clandestino</option>
            </select>
          </div>
          {projectType === 'clandestino' && (
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-cyan-900">Área (m²)</label>
              <input
                type="number"
                min={0}
                step={1}
                value={clandestinoAreaM2}
                title="Área de clandestinos em metros quadrados"
                onFocus={(e) => e.target.select()}
                onClick={(e) => e.currentTarget.select()}
                onChange={(e) => onClandestinoAreaChange?.(Math.max(0, Math.round(numberFromInput(e.target.value))))}
                className="w-28 rounded border border-cyan-300 bg-white p-2 text-xs text-slate-800"
              />
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <div className="rounded-lg border border-slate-300 bg-white p-2 text-slate-700">Postes: {summary.poles}</div>
        <div className="rounded-lg border border-slate-300 bg-white p-2 text-slate-700">Condutores: {summary.edges}</div>
        <div className="rounded-lg border border-slate-300 bg-white p-2 text-slate-700">Trafos: {summary.transformers}</div>
        <div className="rounded-lg border border-slate-300 bg-white p-2 text-slate-700">Rede: {Math.round(summary.totalLengthMeters)} m</div>
      </div>

      {btNetworkScenario === 'asis' && (
        <div className="grid grid-cols-3 gap-2 text-[10px]">
          <div className="rounded-lg border border-cyan-300 bg-cyan-50 p-2 text-cyan-900">Postes verificados: {verifiedPoles}/{summary.poles}</div>
          <div className="rounded-lg border border-cyan-300 bg-cyan-50 p-2 text-cyan-900">Condutores verificados: {verifiedEdges}/{summary.edges}</div>
          <div className="rounded-lg border border-cyan-300 bg-cyan-50 p-2 text-cyan-900">Trafos verificados: {verifiedTransformers}/{summary.transformers}</div>
        </div>
      )}

      <div className={`rounded-lg border p-2 text-[10px] ${pointDemandCardClass}`}>
        {projectType === 'clandestino'
          ? `Demanda por ponto (regra clandestino): ${pointDemandKva.toFixed(2)} kVA`
          : `Demanda por ponto (leituras de trafo): ${pointDemandKva.toFixed(2)} kVA`}
        {pointDemandStatus && (
          <div className="mt-1">
            {pointDemandStatus}
          </div>
        )}
      </div>

      {clientDemandByPole.length > 0 && (
        <div className="rounded-lg border border-cyan-200 bg-slate-50 p-2 text-[10px] text-slate-700">
          <div className="mb-1 font-semibold uppercase tracking-wide text-cyan-800">Ranking Demanda de Clientes (Top 5)</div>
          {clientDemandByPole.slice(0, 5).map((item) => (
            <div key={item.poleId} className="flex items-center justify-between border-b border-cyan-200 py-0.5 last:border-b-0">
              <span>{item.poleId}</span>
              <span>
                CLT {item.localClients} | {item.localTrechoDemandKva.toFixed(2)} kVA
              </span>
            </div>
          ))}
        </div>
      )}

      {projectType === 'clandestino' && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-[10px] text-amber-900">
          {clandestinoDemandKva === null
            ? `Área clandestina inválida (${clandestinoAreaM2} m²). Faixa da planilha: ${clandestinoAreaRange.min}-${clandestinoAreaRange.max} m² (inteiros).`
            : `Carga base clandestinos (${clandestinoAreaM2} m²): ${clandestinoDemandKw.toFixed(2)} kVA`}
          {clandestinoDemandKva !== null && (
            <div className="mt-1 text-amber-900">
              Clientes: {totalClandestinoClients} | Fator: {clandestinoDiversificationFactor?.toFixed(2) ?? 'inválido'} | Demanda final: {clandestinoFinalDemandKva.toFixed(2)} kVA
            </div>
          )}
        </div>
      )}

      <div className="space-y-3 rounded-lg border border-cyan-200 bg-slate-50 p-3">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-cyan-800">Postes / Verificação</div>

        <div className="space-y-2">
          <div className="text-[10px] text-slate-400">Poste selecionado</div>
          {btTopology.poles.length === 0 ? (
            <div className="text-[10px] text-slate-500">Nenhum poste cadastrado.</div>
          ) : (
            <>
              <div className="relative">
                <input
                  type="text"
                  value={selectedPole?.title ?? ''}
                  spellCheck={false}
                  onChange={(e) => {
                    if (!selectedPole) {
                      return;
                    }

                    const nextTitle = e.target.value;
                    const selectedOtherPole = btTopology.poles.find((pole) => pole.id !== selectedPole.id && pole.title === nextTitle);
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
                        className={`w-full px-2 py-1.5 text-left text-xs hover:bg-slate-100 ${selectedPoleId === pole.id ? 'bg-slate-100 font-semibold text-slate-900' : 'text-slate-700'}`}
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
                    onClick={() => updatePoleVerified(selectedPole.id, !selectedPole.verified)}
                    className="rounded border border-cyan-400 px-3 py-1 text-[10px] text-cyan-900 hover:bg-cyan-100"
                  >
                    {selectedPole.verified ? 'Marcar como não verificado' : 'Marcar poste como verificado'}
                  </button>

                  {onBtSetPoleChangeFlag && (
                    <div className="flex flex-wrap gap-2 rounded border border-slate-200 bg-slate-100/70 p-2">
                      <button
                        onClick={() => onBtSetPoleChangeFlag(selectedPole.id, 'remove')}
                        className={`rounded border px-2 py-1 text-[10px] ${getPoleChangeFlag(selectedPole) === 'remove' ? 'border-rose-400 bg-rose-50 text-rose-700' : 'border-slate-300 bg-white text-slate-700'}`}
                      >
                        Remoção
                      </button>
                      <button
                        onClick={() => onBtSetPoleChangeFlag(selectedPole.id, 'new')}
                        className={`rounded border px-2 py-1 text-[10px] ${getPoleChangeFlag(selectedPole) === 'new' ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-slate-300 bg-white text-slate-700'}`}
                      >
                        Novo
                      </button>
                      <button
                        onClick={() => onBtSetPoleChangeFlag(selectedPole.id, 'replace')}
                        className={`rounded border px-2 py-1 text-[10px] ${getPoleChangeFlag(selectedPole) === 'replace' ? 'border-yellow-400 bg-yellow-50 text-yellow-700' : 'border-slate-300 bg-white text-slate-700'}`}
                      >
                        Substituição
                      </button>
                      <button
                        onClick={() => onBtTogglePoleCircuitBreak?.(selectedPole.id, !(selectedPole.circuitBreakPoint ?? false))}
                        title="Separa fisicamente o circuito neste poste"
                        className={`rounded border px-2 py-1 text-[10px] font-mono tracking-tight ${(selectedPole.circuitBreakPoint ?? false) ? 'border-sky-400 bg-sky-50 text-sky-700' : 'border-slate-300 bg-white text-slate-700'}`}
                      >
                        -| |-
                      </button>
                      <button
                        onClick={() => onBtSetPoleChangeFlag(selectedPole.id, 'existing')}
                        className={`rounded border px-2 py-1 text-[10px] ${getPoleChangeFlag(selectedPole) === 'existing' ? 'border-fuchsia-400 bg-fuchsia-50 text-fuchsia-700' : 'border-slate-300 bg-white text-slate-700'}`}
                      >
                        Existente
                      </button>
                    </div>
                  )}

                  {(selectedPole.circuitBreakPoint ?? false) && (
                    <div className="rounded border border-sky-300 bg-sky-50 px-2 py-1 text-[10px] text-sky-800">
                      Separacao fisica ativa: o circuito do trafo para neste poste.
                    </div>
                  )}

                  <div className="rounded border border-slate-300 bg-white p-2">
                    <div className="mb-2 flex items-center justify-between text-[10px] text-slate-600">
                      <span>Ramais do poste</span>
                      <button
                        onClick={() => {
                          const defaultRamalType = projectType === 'clandestino'
                            ? CLANDESTINO_RAMAL_TYPE
                            : NORMAL_CLIENT_RAMAL_TYPES[0];
                          updatePoleRamais(selectedPole.id, [
                            ...(selectedPole.ramais ?? []),
                            { id: nextId('RP'), quantity: 1, ramalType: defaultRamalType }
                          ]);
                        }}
                        className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-slate-700 hover:bg-slate-100"
                      >
                        <Plus size={12} /> Ramal
                      </button>
                    </div>

                    {(selectedPole.ramais ?? []).length === 0 ? (
                      <div className="text-[10px] text-slate-500">Sem ramais cadastrados neste poste.</div>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="rounded border border-slate-200 bg-slate-50 p-1.5 text-[10px] text-slate-600">
                          {(selectedPole.ramais ?? []).map((ramal) => {
                            const ramalType = ramal.ramalType ?? (projectType === 'clandestino' ? CLANDESTINO_RAMAL_TYPE : NORMAL_CLIENT_RAMAL_TYPES[0]);
                            return (
                              <div key={`summary-${ramal.id}`}>
                                {ramal.quantity} x {ramalType}
                              </div>
                            );
                          })}
                        </div>
                        {(selectedPole.ramais ?? []).map((ramal) => (
                          <div key={ramal.id} className="grid grid-cols-[84px_1fr_auto] gap-2">
                            <input
                              type="number"
                              min={1}
                              value={ramal.quantity}
                              title={`Quantidade do ramal ${ramal.id}`}
                              onFocus={(e) => e.target.select()}
                              onClick={(e) => e.currentTarget.select()}
                              onChange={(e) => {
                                const quantity = Math.max(1, numberFromInput(e.target.value));
                                updatePoleRamais(
                                  selectedPole.id,
                                  (selectedPole.ramais ?? []).map((item) => item.id === ramal.id ? { ...item, quantity } : item)
                                );
                              }}
                              className="rounded border border-slate-300 bg-white p-1.5 text-[11px] text-slate-800"
                            />
                            <select
                              value={ramal.ramalType ?? (projectType === 'clandestino' ? CLANDESTINO_RAMAL_TYPE : NORMAL_CLIENT_RAMAL_TYPES[0])}
                              title={`Tipo do ramal ${ramal.id}`}
                              onChange={(e) => {
                                const ramalType = e.target.value;
                                updatePoleRamais(
                                  selectedPole.id,
                                  (selectedPole.ramais ?? []).map((item) => item.id === ramal.id ? { ...item, ramalType } : item)
                                );
                              }}
                              className="rounded border border-slate-300 bg-white p-1.5 text-[11px] text-slate-800"
                            >
                              {(projectType === 'clandestino'
                                ? [CLANDESTINO_RAMAL_TYPE]
                                : NORMAL_CLIENT_RAMAL_TYPES
                              ).map((type) => (
                                <option key={type} value={type}>{type}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => {
                                updatePoleRamais(
                                  selectedPole.id,
                                  (selectedPole.ramais ?? []).filter((item) => item.id !== ramal.id)
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

      <div className="space-y-2 rounded-lg border border-slate-300 bg-slate-50 p-3">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Transformador ({btNetworkScenario === 'asis' ? 'leituras da rede atual' : 'base de projeto'})</div>
        {btTopology.transformers.length === 0 ? (
          <div className="text-[10px] text-slate-500">
            {btNetworkScenario === 'asis'
              ? 'Sem transformador identificado para conferência de leituras da rede existente.'
              : 'Insira um transformador no mapa para montar a nova topologia BT.'}
          </div>
        ) : (
          <>
            <div className="relative">
              <input
                type="text"
                value={selectedTransformer?.title ?? ''}
                spellCheck={false}
                onChange={(e) => {
                  if (!selectedTransformer) {
                    return;
                  }

                  const nextTitle = e.target.value;
                  const selectedOtherTransformer = btTopology.transformers.find(
                    (transformer) => transformer.id !== selectedTransformer.id && transformer.title === nextTitle
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
                onClick={() => setIsTransformerDropdownOpen((current) => !current)}
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
                      className={`w-full px-2 py-1.5 text-left text-xs hover:bg-slate-100 ${selectedTransformerId === transformer.id ? 'bg-slate-100 font-semibold text-slate-900' : 'text-slate-700'}`}
                    >
                      {transformer.title}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedTransformer && (
              <button
                onClick={() => updateTransformerVerified(selectedTransformer.id, !selectedTransformer.verified)}
                className="rounded border border-cyan-400 px-3 py-1 text-[10px] text-cyan-900 hover:bg-cyan-100"
              >
                {selectedTransformer.verified ? 'Marcar trafo como não verificado' : 'Marcar trafo como verificado'}
              </button>
            )}

            {selectedTransformer && onBtSetTransformerChangeFlag && (
              <div className="flex flex-wrap gap-2 rounded border border-slate-200 bg-slate-100/70 p-2">
                <button
                  onClick={() => onBtSetTransformerChangeFlag(selectedTransformer.id, 'remove')}
                  className={`rounded border px-2 py-1 text-[10px] ${getTransformerChangeFlag(selectedTransformer) === 'remove' ? 'border-rose-400 bg-rose-50 text-rose-700' : 'border-slate-300 bg-white text-slate-700'}`}
                >
                  Remoção
                </button>
                <button
                  onClick={() => onBtSetTransformerChangeFlag(selectedTransformer.id, 'new')}
                  className={`rounded border px-2 py-1 text-[10px] ${getTransformerChangeFlag(selectedTransformer) === 'new' ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-slate-300 bg-white text-slate-700'}`}
                >
                  Novo
                </button>
                <button
                  onClick={() => onBtSetTransformerChangeFlag(selectedTransformer.id, 'replace')}
                  className={`rounded border px-2 py-1 text-[10px] ${getTransformerChangeFlag(selectedTransformer) === 'replace' ? 'border-yellow-400 bg-yellow-50 text-yellow-700' : 'border-slate-300 bg-white text-slate-700'}`}
                >
                  Substituição
                </button>
                <button
                  onClick={() => onBtSetTransformerChangeFlag(selectedTransformer.id, 'existing')}
                  className={`rounded border px-2 py-1 text-[10px] ${getTransformerChangeFlag(selectedTransformer) === 'existing' ? 'border-fuchsia-400 bg-fuchsia-50 text-fuchsia-700' : 'border-slate-300 bg-white text-slate-700'}`}
                >
                  Existente
                </button>
              </div>
            )}

            {selectedTransformer && (
              <div className="space-y-2">
                {(() => {
                  const transformerDebug = transformerDebugById[selectedTransformer.id];
                  const baseReading = selectedTransformer.readings[0] ?? {
                    id: nextId('R'),
                    currentMaxA: 0,
                    temperatureFactor: DEFAULT_TEMPERATURE_FACTOR,
                    autoCalculated: false
                  };
                  const currentMaxA = baseReading.currentMaxA ?? 0;
                  const temperatureFactor = baseReading.temperatureFactor ?? DEFAULT_TEMPERATURE_FACTOR;
                  const hasReadings = selectedTransformer.readings.length > 0;
                  const demandMaxKw = currentMaxA * CURRENT_TO_DEMAND_CONVERSION;
                  const correctedDemandKw = demandMaxKw * temperatureFactor;
                  const effectiveDemandKw = hasReadings ? correctedDemandKw : (selectedTransformer.demandKw ?? 0);
                  const projectPowerKva = selectedTransformer.projectPowerKva ?? 0;
                  const loadingPct = projectPowerKva > 0 ? (effectiveDemandKw / projectPowerKva) * 100 : null;
                  const totalClients = btTopology.poles.reduce(
                    (acc, pole) => acc + (pole.ramais ?? []).reduce((sum, ramal) => sum + ramal.quantity, 0),
                    0
                  );
                  const dmdi = calculateRamalDmdiKva({
                    projectType,
                    aa24DemandBase: summary.transformerDemandKw,
                    sumClientsX: totalClients,
                    ab35LookupDmdi: calculateClandestinoDemandKvaByAreaAndClients(clandestinoAreaM2, totalClients)
                  });

                  return (
                    <>
                      <div className="rounded border border-slate-200 bg-white p-2">
                        <div className="grid grid-cols-4 gap-2">
                        <div className="text-[10px] text-slate-500">Corrente maxima (A)</div>
                        <div className="text-[10px] text-slate-500">Demanda corrigida (kVA)</div>
                        <div className="text-[10px] text-slate-500">Fator temperatura</div>
                        <div className="text-[10px] text-slate-500">Trafo proj (kVA)</div>
                        <NumericTextInput
                          value={currentMaxA}
                          title="Corrente máxima do transformador em ampères"
                          placeholder="Corrente máxima"
                          onChange={(next) => {
                            updateTransformerReadings(selectedTransformer.id, [{ ...baseReading, currentMaxA: next, autoCalculated: false }]);
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

                            const temperatureBase = temperatureFactor > 0 ? temperatureFactor : DEFAULT_TEMPERATURE_FACTOR;
                            const inferredCurrent = Math.round((nextCorrectedDemandKva / (CURRENT_TO_DEMAND_CONVERSION * temperatureBase)) * 100) / 100;
                            updateTransformerReadings(selectedTransformer.id, [{ ...baseReading, currentMaxA: inferredCurrent, autoCalculated: false }]);
                          }}
                          className="rounded border border-emerald-300 bg-emerald-50 p-1.5 text-[11px] font-medium text-emerald-900"
                        />
                        <NumericTextInput
                          value={temperatureFactor}
                          title="Fator de temperatura do transformador"
                          placeholder="Fator de temperatura"
                          onChange={(next) => {
                            updateTransformerReadings(selectedTransformer.id, [{ ...baseReading, temperatureFactor: next, autoCalculated: false }]);
                          }}
                          className="rounded border border-emerald-300 bg-emerald-50 p-1.5 text-[11px] font-medium text-emerald-900"
                        />
                        <NumericTextInput
                          value={projectPowerKva}
                          title="Potência de projeto do transformador em kVA"
                          placeholder="Potência de projeto"
                          onChange={(next) => updateTransformerProjectPower(selectedTransformer.id, next)}
                          className="rounded border border-slate-300 bg-white p-1.5 text-[11px] text-slate-800"
                        />
                      </div>
                      </div>

                      <button
                        onClick={() => {
                          const demandTargetKw = transformerDebug?.estimatedDemandKw ?? selectedTransformer.demandKw ?? 0;
                          const temperatureBase = temperatureFactor > 0 ? temperatureFactor : DEFAULT_TEMPERATURE_FACTOR;
                          const inferredCurrent = temperatureBase > 0
                            ? Math.round((demandTargetKw / (CURRENT_TO_DEMAND_CONVERSION * temperatureBase)) * 100) / 100
                            : 0;

                          updateTransformerReadings(selectedTransformer.id, [{
                            ...baseReading,
                            currentMaxA: inferredCurrent,
                            temperatureFactor: temperatureBase,
                            autoCalculated: true
                          }]);
                        }}
                        className="w-full rounded border border-blue-400 bg-blue-50 px-3 py-1.5 text-[10px] font-semibold text-blue-800 hover:bg-blue-100"
                      >
                        Recalcular corrente maxima automaticamente
                      </button>

                      <div className="rounded border border-slate-300 bg-white p-2 text-[10px] text-slate-700 space-y-1">
                        <div>Demanda corrigida: {formatBr(effectiveDemandKw)} kVA</div>
                        <div>Demanda maxima: {formatBr(hasReadings ? demandMaxKw : effectiveDemandKw)} kVA</div>
                        <div>Carregamento atual: {loadingPct === null ? '#DIV/0!' : `${loadingPct.toFixed(2)}%`}</div>
                        <div>DMDI (ramal): {totalClients === 0 ? '#DIV/0!' : dmdi.toFixed(2)}</div>
                        <div>Total clientes: {totalClients}</div>
                      </div>

                      {transformerDebug && (
                        <div className="rounded border border-indigo-300 bg-indigo-50 p-2 text-[10px] text-indigo-900 space-y-1">
                          <div className="font-semibold uppercase tracking-wide">Atribuicao automatica</div>
                          <div>Clientes atribuidos ao trafo: {transformerDebug.assignedClients}</div>
                          <div>Demanda estimada automatica: {formatBr(transformerDebug.estimatedDemandKw)} kVA</div>
                          <div>Fonte: particao eletrica da rede considerando seccionamentos BT.</div>
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
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Condutor</div>
        {btTopology.edges.length === 0 ? (
          <div className="text-[10px] text-slate-500">
            {btNetworkScenario === 'asis'
              ? 'Sem condutores cadastrados para representar os ramais existentes.'
              : 'Insira condutores no mapa para lançar os ramais da rede nova.'}
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
                const fromTitle = btTopology.poles.find((pole) => pole.id === edge.fromPoleId)?.title ?? edge.fromPoleId;
                const toTitle = btTopology.poles.find((pole) => pole.id === edge.toPoleId)?.title ?? edge.toPoleId;
                return (
                  <option key={edge.id} value={edge.id}>{edge.id} ({fromTitle}{' <-> '}{toTitle})</option>
                );
              })}
            </select>

            {selectedEdge && (
              <div className="space-y-2">
                {(() => {
                  const selectedEdgeFlag = getEdgeChangeFlag(selectedEdge);
                  return (
                <div className="rounded border border-slate-200 bg-slate-100/70 p-2">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Condutores do trecho</div>
                  <div className="mt-1 text-[10px] text-slate-600">Preset padrão para novos trechos: <span className="font-semibold text-fuchsia-700">Existente (Magenta)</span></div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => {
                        const confirmed = window.confirm(`Apagar o trecho ${selectedEdge.id}?`);
                        if (!confirmed) {
                          return;
                        }

                        onTopologyChange({
                          ...btTopology,
                          edges: btTopology.edges.filter((edge) => edge.id !== selectedEdge.id)
                        });
                      }}
                      className="inline-flex h-8 items-center gap-1 rounded border border-rose-500/40 px-2 text-xs text-rose-600 hover:bg-rose-50"
                      title="Apagar trecho selecionado"
                    >
                      <Trash2 size={12} /> Trecho
                    </button>
                    <button
                      onClick={() => onBtSetEdgeChangeFlag?.(selectedEdge.id, 'remove')}
                      className={`inline-flex h-8 items-center rounded border px-2 text-xs ${selectedEdgeFlag === 'remove'
                        ? 'border-rose-400 bg-rose-50 text-rose-700 hover:bg-rose-100'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                      }`}
                      title="Flag de remoção"
                    >
                      Remoção
                    </button>
                    <button
                      onClick={() => onBtSetEdgeChangeFlag?.(selectedEdge.id, 'new')}
                      className={`inline-flex h-8 items-center rounded border px-2 text-xs ${selectedEdgeFlag === 'new'
                        ? 'border-emerald-400 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                      }`}
                      title="Flag de novo"
                    >
                      Novo
                    </button>
                    <button
                      onClick={() => onBtSetEdgeChangeFlag?.(selectedEdge.id, 'replace')}
                      className={`inline-flex h-8 items-center rounded border px-2 text-xs ${selectedEdgeFlag === 'replace'
                        ? 'border-yellow-400 bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                      }`}
                      title="Flag de substituição"
                    >
                      Substituição
                    </button>
                    <button
                      onClick={() => onBtSetEdgeChangeFlag?.(selectedEdge.id, 'existing')}
                      className={`inline-flex h-8 items-center rounded border px-2 text-xs ${selectedEdgeFlag === 'existing'
                        ? 'border-fuchsia-400 bg-fuchsia-50 text-fuchsia-700 hover:bg-fuchsia-100'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                      }`}
                      title="Preset existente"
                    >
                      Existente
                    </button>
                    <button
                      onClick={() => updateEdgeVerified(selectedEdge.id, !selectedEdge.verified)}
                      className="inline-flex h-8 items-center rounded border border-cyan-400 bg-white px-2 text-xs text-cyan-900 hover:bg-cyan-100"
                    >
                      {selectedEdge.verified ? 'Condutor verificado' : 'Marcar verificado'}
                    </button>
                    <button
                      onClick={() => {
                        updateEdgeConductors(selectedEdge.id, [
                          ...selectedEdge.conductors,
                          { id: nextId('C'), quantity: 1, conductorName: CONDUCTOR_NAMES[0] }
                        ]);
                      }}
                      className="inline-flex h-8 items-center gap-1 rounded border border-slate-300 bg-white px-2 text-xs text-slate-700 hover:bg-slate-100"
                    >
                      <Plus size={12} /> {selectedEdgeFlag === 'replace' ? 'Condutor que entra' : 'Condutor'}
                    </button>
                  </div>
                </div>
                  );
                })()}

                {getEdgeChangeFlag(selectedEdge) === 'replace' && (
                  <div className="rounded border border-cyan-300 bg-cyan-50 p-2 text-[10px] text-cyan-900">
                    <div className="font-semibold uppercase tracking-wide">Condutor que entra</div>
                    <div className="mt-1">Este bloco define o novo condutor que ficará no trecho após a substituição.</div>
                  </div>
                )}

                {selectedEdge.conductors.map((entry) => (
                  <div key={entry.id} className="grid max-w-full grid-cols-[64px_minmax(0,1fr)_28px] items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      value={entry.quantity}
                      title={`Quantidade do condutor ${entry.id}`}
                      onChange={(e) => {
                        const quantity = Math.max(1, numberFromInput(e.target.value));
                        updateEdgeConductors(
                          selectedEdge.id,
                          selectedEdge.conductors.map((item) => item.id === entry.id ? { ...item, quantity } : item)
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
                          selectedEdge.conductors.map((item) => item.id === entry.id ? { ...item, conductorName } : item)
                        );
                      }}
                      className="min-w-0 w-full rounded border border-slate-300 bg-white p-1.5 text-[11px] text-slate-800"
                    >
                      {CONDUCTOR_NAMES.map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => {
                        updateEdgeConductors(
                          selectedEdge.id,
                          selectedEdge.conductors.filter((item) => item.id !== entry.id)
                        );
                      }}
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center justify-self-end rounded border border-rose-500/30 text-rose-300 hover:bg-rose-500/10"
                      title="Remover condutor"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}

                {getEdgeChangeFlag(selectedEdge) === 'replace' && (
                  <div className="rounded border border-amber-300 bg-amber-50 p-2">
                    <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-amber-700">Condutor que sai</div>
                    {(selectedEdge.replacementFromConductors ?? []).length === 0 && (
                      <button
                        onClick={() => {
                          updateEdgeReplacementFromConductors(selectedEdge.id, [
                            { id: nextId('RC'), quantity: 1, conductorName: CONDUCTOR_NAMES[0] }
                          ]);
                        }}
                        className="inline-flex h-7 items-center gap-1 rounded border border-amber-400 bg-white px-2 text-[11px] text-amber-800 hover:bg-amber-100"
                      >
                        <Plus size={12} /> Inserir condutor que sai
                      </button>
                    )}

                    {(selectedEdge.replacementFromConductors ?? []).map((entry) => (
                      <div key={entry.id} className="mt-2 grid max-w-full grid-cols-[64px_minmax(0,1fr)_28px] items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          value={entry.quantity}
                          title={`Quantidade do condutor de saída ${entry.id}`}
                          onChange={(e) => {
                            const quantity = Math.max(1, numberFromInput(e.target.value));
                            updateEdgeReplacementFromConductors(
                              selectedEdge.id,
                              (selectedEdge.replacementFromConductors ?? []).map((item) => item.id === entry.id ? { ...item, quantity } : item)
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
                              (selectedEdge.replacementFromConductors ?? []).map((item) => item.id === entry.id ? { ...item, conductorName } : item)
                            );
                          }}
                          className="min-w-0 w-full rounded border border-amber-300 bg-white p-1.5 text-[11px] text-slate-800"
                        >
                          {CONDUCTOR_NAMES.map((name) => (
                            <option key={name} value={name}>{name}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => {
                            updateEdgeReplacementFromConductors(
                              selectedEdge.id,
                              (selectedEdge.replacementFromConductors ?? []).filter((item) => item.id !== entry.id)
                            );
                          }}
                          className="inline-flex h-7 w-7 shrink-0 items-center justify-center justify-self-end rounded border border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
                          title="Remover condutor de saída"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="rounded border border-slate-300 bg-white p-2 text-[10px] text-slate-700">
                  {getEdgeChangeFlag(selectedEdge) === 'remove' && (
                    <div className="mb-1 rounded border border-rose-300 bg-rose-50 px-2 py-1 text-rose-700">
                      Trecho marcado para remoção na execução do projeto.
                    </div>
                  )}
                  {getEdgeChangeFlag(selectedEdge) === 'replace' && (
                    <div className="mb-1 rounded border border-yellow-300 bg-yellow-50 px-2 py-1 text-yellow-800">
                      Substituição: no DXF serão enviados condutor que entra e condutor que sai.
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Sigma size={12} />
                    <span>Total de trechos no projeto: {btTopology.edges.length}</span>
                  </div>
                  <div className="mt-1">Metragem do trecho selecionado: {selectedEdgeLengthLabel}</div>
                  <div>Metragem total da rede: {totalNetworkLengthLabel}</div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default BtTopologyPanel;
