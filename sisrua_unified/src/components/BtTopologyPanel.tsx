import React, { useState, useCallback } from 'react';
import { useBtDerivedState } from '../hooks/useBtDerivedState';
import {
    BtTopology,
    BtPole,
    BtConsumer,
    BtAccumulatedByPole,
} from '../services/btService';

/**
 * BtTopologyPanel
 *
 * Pure UI component for BT (Baixa Tensão) topology management.
 *
 * Responsibilities:
 *   - Render topology data received from the backend (via useBtDerivedState)
 *   - Handle user interaction events (add pole, remove pole, trigger calculation)
 *   - Display loading/error state
 *
 * This component contains ZERO electrical calculations.
 * All BT domain logic runs in the backend (server/services/btCalculationService.ts).
 */

// ── Types for local UI state only ─────────────────────────────────────────────

interface ConsumerFormState {
    id: string;
    label: string;
    powerKw: string;
    type: BtConsumer['type'];
    readingMode: BtConsumer['readingMode'];
    readingKwh: string;
}

interface PoleFormState {
    id: string;
    label: string;
    distanceFromTransformerM: string;
    conductorCrossSectionMm2: string;
    consumers: ConsumerFormState[];
}

// ── Default form values ───────────────────────────────────────────────────────

const defaultConsumer = (): ConsumerFormState => ({
    id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    label: '',
    powerKw: '0',
    type: 'residential',
    readingMode: 'auto',
    readingKwh: '',
});

const defaultPole = (): PoleFormState => ({
    id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    label: '',
    distanceFromTransformerM: '0',
    conductorCrossSectionMm2: '16',
    consumers: [defaultConsumer()],
});

// ── Sub-components ────────────────────────────────────────────────────────────

function ResultRow({ item }: { item: BtAccumulatedByPole }) {
    return (
        <tr className={item.withinLimit ? '' : 'bg-red-50'}>
            <td className="px-3 py-2 text-sm font-medium text-gray-900">{item.label}</td>
            <td className="px-3 py-2 text-sm text-right text-gray-700">
                {item.localDemandKw.toFixed(3)}
            </td>
            <td className="px-3 py-2 text-sm text-right text-gray-700">
                {item.accumulatedDemandKw.toFixed(3)}
            </td>
            <td className={`px-3 py-2 text-sm text-right ${item.withinLimit ? 'text-gray-700' : 'text-red-700 font-semibold'}`}>
                {item.voltageDropPercent.toFixed(2)}%
            </td>
            <td className="px-3 py-2 text-sm text-right text-gray-700">
                {item.currentA.toFixed(2)}
            </td>
        </tr>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

interface BtTopologyPanelProps {
    transformerId?: string;
    nominalVoltageV?: number;
    transformerRatedKva?: number;
}

export function BtTopologyPanel({
    transformerId = 'TR-001',
    nominalVoltageV = 220,
    transformerRatedKva = 75,
}: BtTopologyPanelProps) {
    const { result, isCalculating, error, calculate, reset } = useBtDerivedState({
        constants: { transformerRatedKva },
    });

    const [poles, setPoles] = useState<PoleFormState[]>([defaultPole()]);

    // ── Form helpers ──────────────────────────────────────────────────────────

    const addPole = useCallback(() => {
        setPoles((prev) => [...prev, defaultPole()]);
    }, []);

    const removePole = useCallback((poleId: string) => {
        setPoles((prev) => prev.filter((p) => p.id !== poleId));
    }, []);

    const updatePole = useCallback(
        (poleId: string, patch: Partial<PoleFormState>) => {
            setPoles((prev) =>
                prev.map((p) => (p.id === poleId ? { ...p, ...patch } : p)),
            );
        },
        [],
    );

    const addConsumer = useCallback((poleId: string) => {
        setPoles((prev) =>
            prev.map((p) =>
                p.id === poleId
                    ? { ...p, consumers: [...p.consumers, defaultConsumer()] }
                    : p,
            ),
        );
    }, []);

    const removeConsumer = useCallback((poleId: string, consumerId: string) => {
        setPoles((prev) =>
            prev.map((p) =>
                p.id === poleId
                    ? { ...p, consumers: p.consumers.filter((c) => c.id !== consumerId) }
                    : p,
            ),
        );
    }, []);

    const updateConsumer = useCallback(
        (poleId: string, consumerId: string, patch: Partial<ConsumerFormState>) => {
            setPoles((prev) =>
                prev.map((p) =>
                    p.id === poleId
                        ? {
                            ...p,
                            consumers: p.consumers.map((c) =>
                                c.id === consumerId ? { ...c, ...patch } : c,
                            ),
                        }
                        : p,
                ),
            );
        },
        [],
    );

    // ── Topology builder (UI → service contract) ──────────────────────────────

    const buildTopology = useCallback((): BtTopology => {
        const apiPoles: BtPole[] = poles.map((pf) => ({
            id: pf.id,
            label: pf.label || pf.id,
            distanceFromTransformerM: parseFloat(pf.distanceFromTransformerM) || 0,
            conductorCrossSectionMm2: parseFloat(pf.conductorCrossSectionMm2) || 16,
            consumers: pf.consumers.map(
                (cf): BtConsumer => ({
                    id: cf.id,
                    label: cf.label || cf.id,
                    powerKw: parseFloat(cf.powerKw) || 0,
                    type: cf.type,
                    readingMode: cf.readingMode,
                    readingKwh: cf.readingKwh ? parseFloat(cf.readingKwh) : undefined,
                }),
            ),
        }));

        return {
            transformerId,
            nominalVoltageV,
            poles: apiPoles,
        };
    }, [poles, transformerId, nominalVoltageV]);

    const handleCalculate = useCallback(async () => {
        if (poles.length === 0) return;
        await calculate(buildTopology());
    }, [calculate, buildTopology, poles.length]);

    const handleReset = useCallback(() => {
        setPoles([defaultPole()]);
        reset();
    }, [reset]);

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="flex flex-col gap-4 p-4">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-800">
                    Topologia BT — {transformerId}
                </h2>
                <span className="text-xs text-gray-400">{nominalVoltageV}V / {transformerRatedKva}kVA</span>
            </div>

            {/* Pole list */}
            {poles.map((pole) => (
                <div key={pole.id} className="rounded-lg border border-gray-200 p-3 bg-white">
                    <div className="flex items-center gap-2 mb-2">
                        <input
                            type="text"
                            placeholder="Label do poste"
                            value={pole.label}
                            onChange={(e) => updatePole(pole.id, { label: e.target.value })}
                            className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
                            aria-label="Label do poste"
                        />
                        <input
                            type="number"
                            placeholder="Distância (m)"
                            value={pole.distanceFromTransformerM}
                            onChange={(e) =>
                                updatePole(pole.id, { distanceFromTransformerM: e.target.value })
                            }
                            className="w-28 rounded border border-gray-300 px-2 py-1 text-sm"
                            aria-label="Distância do transformador (m)"
                        />
                        <input
                            type="number"
                            placeholder="Seção (mm²)"
                            value={pole.conductorCrossSectionMm2}
                            onChange={(e) =>
                                updatePole(pole.id, { conductorCrossSectionMm2: e.target.value })
                            }
                            className="w-24 rounded border border-gray-300 px-2 py-1 text-sm"
                            aria-label="Seção do condutor (mm²)"
                        />
                        <button
                            type="button"
                            onClick={() => removePole(pole.id)}
                            disabled={poles.length === 1}
                            className="rounded bg-red-100 px-2 py-1 text-xs text-red-700 hover:bg-red-200 disabled:opacity-40"
                            aria-label="Remover poste"
                        >
                            ✕
                        </button>
                    </div>

                    {/* Consumer list */}
                    {pole.consumers.map((consumer) => (
                        <div key={consumer.id} className="ml-4 flex items-center gap-2 mb-1">
                            <input
                                type="text"
                                placeholder="Consumidor"
                                value={consumer.label}
                                onChange={(e) =>
                                    updateConsumer(pole.id, consumer.id, { label: e.target.value })
                                }
                                className="flex-1 rounded border border-gray-200 px-2 py-1 text-xs"
                                aria-label="Label do consumidor"
                            />
                            <input
                                type="number"
                                placeholder="kW"
                                value={consumer.powerKw}
                                onChange={(e) =>
                                    updateConsumer(pole.id, consumer.id, { powerKw: e.target.value })
                                }
                                className="w-20 rounded border border-gray-200 px-2 py-1 text-xs"
                                aria-label="Demanda (kW)"
                            />
                            <select
                                value={consumer.type}
                                onChange={(e) =>
                                    updateConsumer(pole.id, consumer.id, {
                                        type: e.target.value as BtConsumer['type'],
                                    })
                                }
                                className="rounded border border-gray-200 px-1 py-1 text-xs"
                                aria-label="Tipo de consumidor"
                            >
                                <option value="residential">Residencial</option>
                                <option value="commercial">Comercial</option>
                                <option value="industrial">Industrial</option>
                                <option value="clandestine">Clandestino</option>
                            </select>
                            <select
                                value={consumer.readingMode}
                                onChange={(e) =>
                                    updateConsumer(pole.id, consumer.id, {
                                        readingMode: e.target.value as BtConsumer['readingMode'],
                                    })
                                }
                                className="rounded border border-gray-200 px-1 py-1 text-xs"
                                aria-label="Modo de leitura"
                            >
                                <option value="auto">Auto</option>
                                <option value="manual">Manual</option>
                                <option value="estimated">Estimado</option>
                            </select>
                            {consumer.readingMode === 'estimated' && (
                                <input
                                    type="number"
                                    placeholder="kWh/mês"
                                    value={consumer.readingKwh}
                                    onChange={(e) =>
                                        updateConsumer(pole.id, consumer.id, {
                                            readingKwh: e.target.value,
                                        })
                                    }
                                    className="w-24 rounded border border-gray-200 px-2 py-1 text-xs"
                                    aria-label="Leitura mensal (kWh)"
                                />
                            )}
                            <button
                                type="button"
                                onClick={() => removeConsumer(pole.id, consumer.id)}
                                disabled={pole.consumers.length === 1}
                                className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500 hover:bg-gray-200 disabled:opacity-40"
                                aria-label="Remover consumidor"
                            >
                                ✕
                            </button>
                        </div>
                    ))}

                    <button
                        type="button"
                        onClick={() => addConsumer(pole.id)}
                        className="ml-4 mt-1 text-xs text-blue-600 hover:underline"
                    >
                        + consumidor
                    </button>
                </div>
            ))}

            {/* Actions */}
            <div className="flex gap-2">
                <button
                    type="button"
                    onClick={addPole}
                    className="rounded bg-gray-100 px-3 py-2 text-sm text-gray-700 hover:bg-gray-200"
                >
                    + Poste
                </button>
                <button
                    type="button"
                    onClick={handleCalculate}
                    disabled={isCalculating || poles.length === 0}
                    className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                    {isCalculating ? 'Calculando…' : 'Calcular BT'}
                </button>
                <button
                    type="button"
                    onClick={handleReset}
                    className="rounded bg-gray-100 px-3 py-2 text-sm text-gray-600 hover:bg-gray-200"
                >
                    Limpar
                </button>
            </div>

            {/* Error display */}
            {error && (
                <div
                    role="alert"
                    className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700"
                >
                    {error}
                </div>
            )}

            {/* Results */}
            {result && (
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                    {/* Summary cards */}
                    <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <div className="rounded-lg bg-blue-50 p-3 text-center">
                            <div className="text-2xl font-bold text-blue-700">
                                {result.summary.totalDemandKw.toFixed(2)}
                            </div>
                            <div className="text-xs text-blue-500">kW demanda total</div>
                        </div>
                        <div className="rounded-lg bg-purple-50 p-3 text-center">
                            <div className="text-2xl font-bold text-purple-700">
                                {result.summary.totalDemandKva.toFixed(2)}
                            </div>
                            <div className="text-xs text-purple-500">kVA estimado</div>
                        </div>
                        <div
                            className={`rounded-lg p-3 text-center ${result.summary.withinVoltageDropLimit ? 'bg-green-50' : 'bg-red-50'}`}
                        >
                            <div
                                className={`text-2xl font-bold ${result.summary.withinVoltageDropLimit ? 'text-green-700' : 'text-red-700'}`}
                            >
                                {result.summary.maxVoltageDropPercent.toFixed(2)}%
                            </div>
                            <div
                                className={`text-xs ${result.summary.withinVoltageDropLimit ? 'text-green-500' : 'text-red-500'}`}
                            >
                                queda de tensão máx.
                            </div>
                        </div>
                        <div className="rounded-lg bg-orange-50 p-3 text-center">
                            <div className="text-2xl font-bold text-orange-700">
                                {result.summary.transformerLoadPercent.toFixed(1)}%
                            </div>
                            <div className="text-xs text-orange-500">carga transformador</div>
                        </div>
                    </div>

                    {/* Accumulated by pole table */}
                    {result.accumulatedByPole.length > 0 && (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 text-left">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Poste</th>
                                        <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 text-right">Local (kW)</th>
                                        <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 text-right">Acum. (kW)</th>
                                        <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 text-right">ΔU (%)</th>
                                        <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 text-right">I (A)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {result.accumulatedByPole.map((item) => (
                                        <ResultRow key={item.poleId} item={item} />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Sectioning impact */}
                    {result.sectioningImpact.length > 0 && (
                        <div className="mt-4">
                            <h3 className="mb-2 text-sm font-semibold text-gray-700">Impacto de Seccionamento</h3>
                            {result.sectioningImpact.map((sp) => (
                                <div
                                    key={sp.sectioningPointId}
                                    className="mb-2 rounded border border-yellow-200 bg-yellow-50 p-2 text-xs"
                                >
                                    <span className="font-medium">{sp.sectioningPointId}</span>
                                    {' — '}Montante: {sp.demandUpstreamKw.toFixed(3)} kW /
                                    Jusante: {sp.demandDownstreamKw.toFixed(3)} kW
                                    {' / '}{sp.affectedConsumers} consumidor(es) afetado(s)
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Clandestine alert */}
                    {result.summary.totalClandestine > 0 && (
                        <div
                            role="alert"
                            className="mt-3 rounded border border-orange-200 bg-orange-50 p-2 text-xs text-orange-700"
                        >
                            ⚠ {result.summary.totalClandestine} ligação(ões) clandestina(s) detectada(s).
                        </div>
                    )}

                    <p className="mt-3 text-right text-xs text-gray-400">
                        engine {result.version}
                    </p>
                </div>
            )}
        </div>
    );
}

export default BtTopologyPanel;
