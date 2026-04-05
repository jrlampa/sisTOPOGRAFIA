import React from 'react';
import { Activity, Plus, Trash2, Sigma } from 'lucide-react';
import { BtNetworkScenario, BtTopology, BtTransformerReading } from '../types';
import {
  calculateAccumulatedDemandByPole,
  calculateAccumulatedDemandKva,
  calculateBtSummary,
  calculateClandestinoDemandKvaByAreaAndClients,
  calculatePointDemandKva,
  calculateTransformerDemandKw,
  calculateTransformerMonthlyBill,
  calculateClandestinoDemandKw,
  getClandestinoDiversificationFactorByClients,
  getClandestinoAreaRange,
  getClandestinoKvaByArea
} from '../utils/btCalculations';

interface BtTopologyPanelProps {
  btTopology: BtTopology;
  projectType: 'ramais' | 'geral' | 'clandestino';
  btNetworkScenario: BtNetworkScenario;
  clandestinoAreaM2: number;
  onTopologyChange: (next: BtTopology) => void;
  onBtRenamePole?: (poleId: string, title: string) => void;
}

// Ampacity values extracted from the CABOS table (DB sheet) of the project workbook.
// Column B "(A)" = rated ampacity in Amperes; 0 = not rated in this dataset.
const CABOS_AMPACITY: Record<string, number> = {
  '25 Al - Arm':    0,
  '50 Al - Arm':    0,
  '95 Al - Arm':  237,
  '150 Al - Arm':   0,
  '240 Al - Arm': 395,
  '25 Al':          0,
  '35 Cu':          0,
  '70 Cu':          0,
  '95 Al':          0,
  '120 Cu':         0,
  '240 Al':       476,
  '240 Cu':       430,
  '500 Cu':         0,
  '10 Cu_CONC_bi':  63,
  '10 Cu_CONC_Tri': 63,
  '16 Al_CONC_bi':  63,
  '16 Al_CONC_Tri': 63,
  '13 Al - DX':     63,
  '13 Al - TX':     63,
  '13 Al - QX':     63,
  '21 Al - QX':     63,
  '53 Al - QX':     63,
  '70 Al - MX':   202,
  '185 Al - MX':  355,
  '240 Al - MX':  473,
};
// T_LINHA_MONO = DB!M14 = T_LINHA_TRF / √3 = 220 / √3 ≈ 127 V (monophasic phase voltage).
const T_LINHA_MONO = 127;
const CONDUCTOR_NAMES = Object.keys(CABOS_AMPACITY);
const getConductorAmpacity = (name: string): number => CABOS_AMPACITY[name] ?? 0;

const numberFromInput = (value: string): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const nextId = (prefix: string): string => `${prefix}${Date.now()}${Math.floor(Math.random() * 1000)}`;

const BtTopologyPanel: React.FC<BtTopologyPanelProps> = ({
  btTopology,
  projectType,
  btNetworkScenario,
  clandestinoAreaM2,
  onTopologyChange,
  onBtRenamePole,
}) => {
  const summary = calculateBtSummary(btTopology);
  const [selectedPoleId, setSelectedPoleId] = React.useState<string>('');
  const [selectedTransformerId, setSelectedTransformerId] = React.useState<string>('');
  const [selectedEdgeId, setSelectedEdgeId] = React.useState<string>('');

  React.useEffect(() => {
    if (!selectedPoleId && btTopology.poles.length > 0) {
      setSelectedPoleId(btTopology.poles[0].id);
    }

    if (selectedPoleId && !btTopology.poles.some((pole) => pole.id === selectedPoleId)) {
      setSelectedPoleId(btTopology.poles[0]?.id || '');
    }
  }, [btTopology.poles, selectedPoleId]);

  React.useEffect(() => {
    if (!selectedTransformerId && btTopology.transformers.length > 0) {
      setSelectedTransformerId(btTopology.transformers[0].id);
    }

    if (selectedTransformerId && !btTopology.transformers.some((t) => t.id === selectedTransformerId)) {
      setSelectedTransformerId(btTopology.transformers[0]?.id || '');
    }
  }, [btTopology.transformers, selectedTransformerId]);

  React.useEffect(() => {
    if (!selectedEdgeId && btTopology.edges.length > 0) {
      setSelectedEdgeId(btTopology.edges[0].id);
    }

    if (selectedEdgeId && !btTopology.edges.some((e) => e.id === selectedEdgeId)) {
      setSelectedEdgeId(btTopology.edges[0]?.id || '');
    }
  }, [btTopology.edges, selectedEdgeId]);

  const selectedTransformer = btTopology.transformers.find((transformer) => transformer.id === selectedTransformerId) || null;
  const selectedEdge = btTopology.edges.find((edge) => edge.id === selectedEdgeId) || null;
  const selectedPole = btTopology.poles.find((pole) => pole.id === selectedPoleId) || null;

  const verifiedPoles = btTopology.poles.filter((pole) => pole.verified).length;
  const verifiedEdges = btTopology.edges.filter((edge) => edge.verified).length;
  const verifiedTransformers = btTopology.transformers.filter((transformer) => transformer.verified).length;

  const updatePoleVerified = (poleId: string, verified: boolean) => {
    onTopologyChange({
      ...btTopology,
      poles: btTopology.poles.map((pole) => pole.id === poleId ? { ...pole, verified } : pole)
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

  const clandestinoDemandKw = projectType === 'clandestino'
    ? calculateClandestinoDemandKw(clandestinoAreaM2)
    : 0;
  const clandestinoAreaRange = getClandestinoAreaRange();
  const clandestinoDemandKva = projectType === 'clandestino'
    ? getClandestinoKvaByArea(clandestinoAreaM2)
    : null;
  const totalClandestinoClients = btTopology.edges.reduce(
    (acc, edge) => acc + edge.conductors.reduce((sum, ramal) => sum + ramal.quantity, 0),
    0
  );
  const clandestinoDiversificationFactor = projectType === 'clandestino'
    ? getClandestinoDiversificationFactorByClients(totalClandestinoClients)
    : null;
  const clandestinoFinalDemandKva = projectType === 'clandestino'
    ? calculateClandestinoDemandKvaByAreaAndClients(clandestinoAreaM2, totalClandestinoClients)
    : 0;
  const pointDemandKva = calculatePointDemandKva({
    projectType,
    transformerDemandKw: summary.transformerDemandKw,
    clandestinoAreaM2,
    clandestinoClients: totalClandestinoClients
  });
  const accumulatedDemandKva = calculateAccumulatedDemandKva({
    projectType,
    clandestinoAreaM2,
    accumulatedClients: totalClandestinoClients,
    downstreamAccumulatedKva: 0,
    totalTrechoKva: summary.transformerDemandKw
  });
  const accumulatedByPole = calculateAccumulatedDemandByPole(btTopology, projectType, clandestinoAreaM2);
  const criticalPole = accumulatedByPole[0] ?? null;

  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/40 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-300">
          <Activity size={16} />
          <h3 className="text-[11px] font-black uppercase tracking-[0.16em]">Topologia BT</h3>
        </div>
        <span className="text-[10px] font-semibold text-slate-400 uppercase">{projectType} / {btNetworkScenario === 'asis' ? 'AS-IS' : 'PROJETO'}</span>
      </div>

      <div className={`rounded-lg border p-2 text-[10px] ${btNetworkScenario === 'asis' ? 'border-cyan-500/20 bg-cyan-950/20 text-cyan-100' : 'border-indigo-500/20 bg-indigo-950/20 text-indigo-100'}`}>
        {btNetworkScenario === 'asis'
          ? 'Cenário AS-IS: painel voltado para leitura, conferência e cálculo sobre rede existente.'
          : 'Cenário REDE NOVA: painel voltado para projeto, lançamento e dimensionamento da nova topologia.'}
      </div>

      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <div className="rounded-lg border border-white/10 bg-slate-900 p-2 text-slate-300">Postes: {summary.poles}</div>
        <div className="rounded-lg border border-white/10 bg-slate-900 p-2 text-slate-300">Arestas: {summary.edges}</div>
        <div className="rounded-lg border border-white/10 bg-slate-900 p-2 text-slate-300">Trafos: {summary.transformers}</div>
        <div className="rounded-lg border border-white/10 bg-slate-900 p-2 text-slate-300">Rede: {Math.round(summary.totalLengthMeters)} m</div>
      </div>

      {btNetworkScenario === 'asis' && (
        <div className="grid grid-cols-3 gap-2 text-[10px]">
          <div className="rounded-lg border border-cyan-500/20 bg-slate-900 p-2 text-cyan-100">Postes verificados: {verifiedPoles}/{summary.poles}</div>
          <div className="rounded-lg border border-cyan-500/20 bg-slate-900 p-2 text-cyan-100">Arestas verificadas: {verifiedEdges}/{summary.edges}</div>
          <div className="rounded-lg border border-cyan-500/20 bg-slate-900 p-2 text-cyan-100">Trafos verificados: {verifiedTransformers}/{summary.transformers}</div>
        </div>
      )}

      <div className="rounded-lg border border-emerald-500/20 bg-emerald-950/20 p-2 text-[10px] text-emerald-200">
        {projectType === 'clandestino'
          ? `Demanda por ponto (regra clandestino): ${pointDemandKva.toFixed(2)} kVA`
          : `Demanda por ponto (leituras de trafo): ${pointDemandKva.toFixed(2)} kW`}
      </div>

      <div className="rounded-lg border border-cyan-500/20 bg-cyan-950/20 p-2 text-[10px] text-cyan-200">
        {projectType === 'clandestino'
          ? `ACUMULADA (GERAL!I, clandestino): ${accumulatedDemandKva.toFixed(2)} kVA`
          : `ACUMULADA (GERAL!I, normal): ${accumulatedDemandKva.toFixed(2)} kW`}
        {criticalPole && (
          <div className="mt-1 text-cyan-100">
            Ponto crítico: {criticalPole.poleId} | CLT acum.: {criticalPole.accumulatedClients} | Demanda acum.: {criticalPole.accumulatedDemandKva.toFixed(2)} {projectType === 'clandestino' ? 'kVA' : 'kW'}
          </div>
        )}
      </div>

      {accumulatedByPole.length > 0 && (
        <div className="rounded-lg border border-cyan-500/20 bg-slate-950/40 p-2 text-[10px] text-cyan-100">
          <div className="mb-1 font-semibold uppercase tracking-wide text-cyan-300">Ranking Acumulada (Top 5)</div>
          {accumulatedByPole.slice(0, 5).map((item) => (
            <div key={item.poleId} className="flex items-center justify-between border-b border-cyan-500/10 py-0.5 last:border-b-0">
              <span>{item.poleId}</span>
              <span>
                CLT {item.accumulatedClients} | {item.accumulatedDemandKva.toFixed(2)} {projectType === 'clandestino' ? 'kVA' : 'kW'}
              </span>
            </div>
          ))}
        </div>
      )}

      {projectType === 'clandestino' && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-950/20 p-2 text-[10px] text-amber-200">
          {clandestinoDemandKva === null
            ? `Área clandestina inválida (${clandestinoAreaM2} m²). Faixa da planilha: ${clandestinoAreaRange.min}-${clandestinoAreaRange.max} m² (inteiros).`
            : `Carga base clandestinos (${clandestinoAreaM2} m²): ${clandestinoDemandKw.toFixed(2)} kVA`}
          {clandestinoDemandKva !== null && (
            <div className="mt-1 text-amber-100">
              Clientes: {totalClandestinoClients} | Fator: {clandestinoDiversificationFactor?.toFixed(2) ?? 'inválido'} | Demanda final: {clandestinoFinalDemandKva.toFixed(2)} kVA
            </div>
          )}
        </div>
      )}

      <div className="space-y-3 rounded-lg border border-cyan-500/20 bg-slate-950/50 p-3">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-cyan-300">Postes / Verificação</div>

        <div className="space-y-2">
          <div className="text-[10px] text-slate-400">Poste selecionado</div>
          {btTopology.poles.length === 0 ? (
            <div className="text-[10px] text-slate-500">Nenhum poste cadastrado.</div>
          ) : (
            <>
              <select
                className="w-full rounded border border-white/10 bg-slate-900 p-2 text-xs text-slate-200"
                value={selectedPoleId}
                onChange={(e) => setSelectedPoleId(e.target.value)}
              >
                {btTopology.poles.map((pole) => (
                  <option key={pole.id} value={pole.id}>{pole.title}</option>
                ))}
              </select>
              {selectedPole && (
                <>
                  <input
                    type="text"
                    value={selectedPole.title}
                    onChange={(e) => onBtRenamePole?.(selectedPole.id, e.target.value)}
                    placeholder="Nome do poste"
                    className="w-full rounded border border-white/10 bg-slate-900 p-1.5 text-xs text-slate-200 focus:border-cyan-500/60 outline-none"
                  />
                  <button
                    onClick={() => updatePoleVerified(selectedPole.id, !selectedPole.verified)}
                    className="rounded border border-cyan-500/30 px-3 py-1 text-[10px] text-cyan-100 hover:bg-cyan-500/10"
                  >
                    {selectedPole.verified ? 'Marcar como não verificado' : 'Marcar poste como verificado'}
                  </button>
                </>
              )}
            </>
          )}
        </div>

        <div className="space-y-2">
          <div className="text-[10px] text-slate-400">Aresta</div>
          {selectedEdge ? (
            <button
              onClick={() => updateEdgeVerified(selectedEdge.id, !selectedEdge.verified)}
              className="rounded border border-cyan-500/30 px-3 py-1 text-[10px] text-cyan-100 hover:bg-cyan-500/10"
            >
              {selectedEdge.verified ? 'Marcar aresta como não verificada' : 'Marcar aresta como verificada'}
            </button>
          ) : (
            <div className="text-[10px] text-slate-500">Nenhuma aresta disponível para marcação.</div>
          )}
        </div>

        <div className="space-y-2">
          <div className="text-[10px] text-slate-400">Transformador</div>
          {selectedTransformer ? (
            <button
              onClick={() => updateTransformerVerified(selectedTransformer.id, !selectedTransformer.verified)}
              className="rounded border border-cyan-500/30 px-3 py-1 text-[10px] text-cyan-100 hover:bg-cyan-500/10"
            >
              {selectedTransformer.verified ? 'Marcar trafo como não verificado' : 'Marcar trafo como verificado'}
            </button>
          ) : (
            <div className="text-[10px] text-slate-500">Nenhum transformador disponível para marcação.</div>
          )}
        </div>
      </div>

      <div className="space-y-2 rounded-lg border border-white/10 bg-slate-950/50 p-3">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Transformador ({btNetworkScenario === 'asis' ? 'leituras AS-IS' : 'base de projeto'})</div>
        {btTopology.transformers.length === 0 ? (
          <div className="text-[10px] text-slate-500">
            {btNetworkScenario === 'asis'
              ? 'Sem transformador identificado para conferência de leituras da rede existente.'
              : 'Insira um transformador no mapa para montar a nova topologia BT.'}
          </div>
        ) : (
          <>
            <select
              className="w-full rounded border border-white/10 bg-slate-900 p-2 text-xs text-slate-200"
              value={selectedTransformerId}
              onChange={(e) => setSelectedTransformerId(e.target.value)}
            >
              {btTopology.transformers.map((transformer) => (
                <option key={transformer.id} value={transformer.id}>{transformer.title}</option>
              ))}
            </select>

            {selectedTransformer && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>Faturas</span>
                  <button
                    onClick={() => {
                      const newReading: BtTransformerReading = {
                        id: nextId('R'),
                        kwhMonth: 0,
                        unitRateBrlPerKwh: 0.95,
                        billedBrl: 0
                      };

                      updateTransformerReadings(selectedTransformer.id, [...selectedTransformer.readings, newReading]);
                    }}
                    className="inline-flex items-center gap-1 rounded border border-white/10 px-2 py-1 text-slate-300 hover:text-white"
                  >
                    <Plus size={12} /> Leitura
                  </button>
                </div>

                {selectedTransformer.readings.map((reading) => (
                  <div key={reading.id} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
                    <input
                      type="number"
                      placeholder="kWh"
                      value={reading.kwhMonth}
                      onChange={(e) => {
                        const kwhMonth = numberFromInput(e.target.value);
                        const billedBrl = Number((kwhMonth * reading.unitRateBrlPerKwh).toFixed(2));

                        updateTransformerReadings(
                          selectedTransformer.id,
                          selectedTransformer.readings.map((item) => item.id === reading.id
                            ? { ...item, kwhMonth, billedBrl }
                            : item)
                        );
                      }}
                      className="rounded border border-white/10 bg-slate-900 p-1.5 text-[11px] text-slate-200"
                    />
                    <input
                      type="number"
                      step="0.01"
                      placeholder="R$/kWh"
                      value={reading.unitRateBrlPerKwh}
                      onChange={(e) => {
                        const unitRateBrlPerKwh = numberFromInput(e.target.value);
                        const billedBrl = Number((reading.kwhMonth * unitRateBrlPerKwh).toFixed(2));

                        updateTransformerReadings(
                          selectedTransformer.id,
                          selectedTransformer.readings.map((item) => item.id === reading.id
                            ? { ...item, unitRateBrlPerKwh, billedBrl }
                            : item)
                        );
                      }}
                      className="rounded border border-white/10 bg-slate-900 p-1.5 text-[11px] text-slate-200"
                    />
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Fatura"
                      value={reading.billedBrl}
                      onChange={(e) => {
                        const billedBrl = numberFromInput(e.target.value);

                        updateTransformerReadings(
                          selectedTransformer.id,
                          selectedTransformer.readings.map((item) => item.id === reading.id
                            ? { ...item, billedBrl }
                            : item)
                        );
                      }}
                      className="rounded border border-white/10 bg-slate-900 p-1.5 text-[11px] text-slate-200"
                    />
                    <button
                      onClick={() => {
                        updateTransformerReadings(
                          selectedTransformer.id,
                          selectedTransformer.readings.filter((item) => item.id !== reading.id)
                        );
                      }}
                      className="rounded border border-rose-500/30 p-1.5 text-rose-300 hover:bg-rose-500/10"
                      title="Remover leitura"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}

                <div className="rounded border border-white/10 bg-slate-900 p-2 text-[10px] text-slate-300">
                  <div>Fatura mensal: R$ {selectedTransformer.monthlyBillBrl.toFixed(2)}</div>
                  <div>Demanda estimada: {selectedTransformer.demandKw.toFixed(2)} kW</div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="space-y-2 rounded-lg border border-white/10 bg-slate-950/50 p-3">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Aresta ({btNetworkScenario === 'asis' ? 'ramais existentes' : 'ramais de projeto'})</div>
        {btTopology.edges.length === 0 ? (
          <div className="text-[10px] text-slate-500">
            {btNetworkScenario === 'asis'
              ? 'Sem arestas cadastradas para representar os ramais existentes.'
              : 'Insira arestas no mapa para lançar os ramais da rede nova.'}
          </div>
        ) : (
          <>
            <select
              className="w-full rounded border border-white/10 bg-slate-900 p-2 text-xs text-slate-200"
              value={selectedEdgeId}
              onChange={(e) => setSelectedEdgeId(e.target.value)}
            >
              {btTopology.edges.map((edge) => (
                <option key={edge.id} value={edge.id}>{edge.id} ({edge.fromPoleId}{' -> '}{edge.toPoleId})</option>
              ))}
            </select>

            {selectedEdge && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>Condutores</span>
                  <button
                    onClick={() => {
                      updateEdgeConductors(selectedEdge.id, [
                        ...selectedEdge.conductors,
                        { id: nextId('C'), quantity: 1, conductorName: '95 Al - Arm' }
                      ]);
                    }}
                    className="inline-flex items-center gap-1 rounded border border-white/10 px-2 py-1 text-slate-300 hover:text-white"
                  >
                    <Plus size={12} /> Ramal
                  </button>
                </div>

                {selectedEdge.conductors.map((entry) => (
                  <div key={entry.id} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                    <input
                      type="number"
                      min={1}
                      value={entry.quantity}
                      onChange={(e) => {
                        const quantity = Math.max(1, numberFromInput(e.target.value));
                        updateEdgeConductors(
                          selectedEdge.id,
                          selectedEdge.conductors.map((item) => item.id === entry.id ? { ...item, quantity } : item)
                        );
                      }}
                      className="rounded border border-white/10 bg-slate-900 p-1.5 text-[11px] text-slate-200"
                    />
                    <select
                      value={entry.conductorName}
                      onChange={(e) => {
                        const conductorName = e.target.value;
                        updateEdgeConductors(
                          selectedEdge.id,
                          selectedEdge.conductors.map((item) => item.id === entry.id ? { ...item, conductorName } : item)
                        );
                      }}
                      className="rounded border border-white/10 bg-slate-900 p-1.5 text-[11px] text-slate-200"
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
                      className="rounded border border-rose-500/30 p-1.5 text-rose-300 hover:bg-rose-500/10"
                      title="Remover condutor"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}

                <div className="rounded border border-white/10 bg-slate-900 p-2 text-[10px] text-slate-300">
                  <div className="flex items-center gap-2">
                    <Sigma size={12} />
                    <span>
                      Total condutores: {selectedEdge.conductors.reduce((acc, entry) => acc + entry.quantity, 0)}
                    </span>
                  </div>
                </div>
                {(() => {
                  const toPoleEntry = accumulatedByPole.find((a) => a.poleId === selectedEdge.toPoleId);
                  const demandKva = toPoleEntry?.accumulatedDemandKva ?? 0;
                  const requiredAmps = demandKva > 0 ? Math.round((demandKva * 1000) / T_LINHA_MONO) : 0;
                  const capacityAmps = selectedEdge.conductors.reduce(
                    (sum, c) => sum + c.quantity * getConductorAmpacity(c.conductorName), 0
                  );
                  if (requiredAmps === 0 || capacityAmps === 0) return null;
                  const ratio = requiredAmps / capacityAmps;
                  const statusColor = ratio < 0.8 ? '#22c55e' : ratio < 1 ? '#f59e0b' : '#ef4444';
                  const statusText = ratio < 0.8 ? 'OK' : ratio < 1 ? 'Atenção' : 'Sobrecarga';
                  return (
                    <div className="rounded border border-white/10 bg-slate-900 p-2 text-[10px] text-slate-300">
                      <div className="flex items-center justify-between">
                        <span>Cap. condutores: {capacityAmps} A</span>
                        <span style={{ color: statusColor, fontWeight: 700 }}>{statusText}</span>
                      </div>
                      <div>Corrente est. ({T_LINHA_MONO} V mono): {requiredAmps} A</div>
                    </div>
                  );
                })()}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default BtTopologyPanel;
