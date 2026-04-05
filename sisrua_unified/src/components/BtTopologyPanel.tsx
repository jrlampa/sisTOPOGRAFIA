import React from 'react';
import { Activity, Plus, Trash2, Sigma } from 'lucide-react';
import { BtTopology, BtTransformerReading } from '../types';
import {
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
  clandestinoAreaM2: number;
  onTopologyChange: (next: BtTopology) => void;
}

const numberFromInput = (value: string): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const nextId = (prefix: string): string => `${prefix}${Date.now()}${Math.floor(Math.random() * 1000)}`;

const BtTopologyPanel: React.FC<BtTopologyPanelProps> = ({
  btTopology,
  projectType,
  clandestinoAreaM2,
  onTopologyChange
}) => {
  const summary = calculateBtSummary(btTopology);
  const [selectedTransformerId, setSelectedTransformerId] = React.useState<string>('');
  const [selectedEdgeId, setSelectedEdgeId] = React.useState<string>('');

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

  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/40 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-300">
          <Activity size={16} />
          <h3 className="text-[11px] font-black uppercase tracking-[0.16em]">Topologia BT</h3>
        </div>
        <span className="text-[10px] font-semibold text-slate-400 uppercase">{projectType}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <div className="rounded-lg border border-white/10 bg-slate-900 p-2 text-slate-300">Postes: {summary.poles}</div>
        <div className="rounded-lg border border-white/10 bg-slate-900 p-2 text-slate-300">Arestas: {summary.edges}</div>
        <div className="rounded-lg border border-white/10 bg-slate-900 p-2 text-slate-300">Trafos: {summary.transformers}</div>
        <div className="rounded-lg border border-white/10 bg-slate-900 p-2 text-slate-300">Rede: {Math.round(summary.totalLengthMeters)} m</div>
      </div>

      <div className="rounded-lg border border-emerald-500/20 bg-emerald-950/20 p-2 text-[10px] text-emerald-200">
        {projectType === 'clandestino'
          ? `Demanda por ponto (regra clandestino): ${pointDemandKva.toFixed(2)} kVA`
          : `Demanda por ponto (leituras de trafo): ${pointDemandKva.toFixed(2)} kW`}
      </div>

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

      <div className="space-y-2 rounded-lg border border-white/10 bg-slate-950/50 p-3">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Transformador (leituras)</div>
        {btTopology.transformers.length === 0 ? (
          <div className="text-[10px] text-slate-500">Insira um transformador no mapa para editar leituras.</div>
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
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Aresta (ramais)</div>
        {btTopology.edges.length === 0 ? (
          <div className="text-[10px] text-slate-500">Insira arestas no mapa para informar ramais.</div>
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
                        { id: nextId('C'), quantity: 1, wireGaugeMm2: 16 }
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
                    <input
                      type="number"
                      min={1}
                      value={entry.wireGaugeMm2}
                      onChange={(e) => {
                        const wireGaugeMm2 = Math.max(1, numberFromInput(e.target.value));
                        updateEdgeConductors(
                          selectedEdge.id,
                          selectedEdge.conductors.map((item) => item.id === entry.id ? { ...item, wireGaugeMm2 } : item)
                        );
                      }}
                      className="rounded border border-white/10 bg-slate-900 p-1.5 text-[11px] text-slate-200"
                    />
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
                      Soma Qtd x Bitola: {selectedEdge.conductors.reduce((acc, entry) => acc + (entry.quantity * entry.wireGaugeMm2), 0).toFixed(2)}
                    </span>
                  </div>
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
