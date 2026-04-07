import {
    calculateDbIndicators,
    calculateDmdiWithMetadata,
    calculateGeralCqtNoPonto,
    calculateIb,
    calculateCorrectedResistance,
    calculateQtPonto,
    evaluateProtection,
    lookupCaboElectricalData,
    lookupDisjuntorIn
} from './cqtEngine.js';
import { getCabosByScenario, getDisjuntoresByScenario, getTrafosZByScenario } from '../constants/cqtLookupTables.js';

type UnknownRecord = Record<string, unknown>;

interface CqtComputationInputs {
    scenario?: 'atual' | 'proj1' | 'proj2';
    dmdi?: {
        clandestinoEnabled: boolean;
        aa24DemandBase: number;
        sumClientsX: number;
        ab35LookupDmdi: number;
    };
    geral?: {
        pontoRamal: string;
        qtMttr: number;
        esqCqtByPonto: Record<string, number>;
        dirCqtByPonto: Record<string, number>;
    };
    db?: {
        trAtual: number;
        demAtual: number;
        qtMt: number;
        trafosZ?: { trafoKva: number; qtFactor: number }[];
    };
    branches?: Array<{
        trechoId: string;
        fase: 'MONO' | 'BIF' | 'TRI';
        acumuladaKva: number;
        eta: number;
        tensaoTrifasicaV: number;
        conductorName: string;
        lengthMeters?: number;
        temperatureC?: number;
        ponto?: string;
        lado?: 'ESQUERDO' | 'DIREITO';
    }>;
}

const isObject = (value: unknown): value is UnknownRecord =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Enriquecimento opcional de btContext.
 * Não bloqueia exportação se os insumos de CQT ainda não estiverem presentes.
 */
export const attachCqtSnapshotToBtContext = (btContext: unknown): UnknownRecord | null => {
    if (!isObject(btContext)) {
        return null;
    }

    const rawInputs = btContext.cqtComputationInputs;
    if (!isObject(rawInputs)) {
        return btContext;
    }

    const inputs = rawInputs as CqtComputationInputs;
    const snapshot: Record<string, unknown> = {
        generatedAt: new Date().toISOString(),
        scenario: inputs.scenario ?? 'atual'
    };

    if (inputs.dmdi) {
        snapshot.dmdi = calculateDmdiWithMetadata(inputs.dmdi);
    }

    if (inputs.geral) {
        snapshot.geral = {
            p31CqtNoPonto: calculateGeralCqtNoPonto({
                lado: 'ESQUERDO',
                ponto: inputs.geral.pontoRamal,
                qtMttr: inputs.geral.qtMttr,
                esqCqtByPonto: inputs.geral.esqCqtByPonto,
                dirCqtByPonto: inputs.geral.dirCqtByPonto
            }),
            p32CqtNoPonto: calculateGeralCqtNoPonto({
                lado: 'DIREITO',
                ponto: inputs.geral.pontoRamal,
                qtMttr: inputs.geral.qtMttr,
                esqCqtByPonto: inputs.geral.esqCqtByPonto,
                dirCqtByPonto: inputs.geral.dirCqtByPonto
            })
        };
    }

    if (inputs.db) {
        const scenario = inputs.scenario ?? 'atual';
        const trafosZ = inputs.db.trafosZ ?? getTrafosZByScenario(scenario);
        snapshot.db = calculateDbIndicators({
            ...inputs.db,
            trafosZ
        });
    }

    if (inputs.branches && inputs.branches.length > 0) {
        const scenario = inputs.scenario ?? 'atual';
        const cabos = getCabosByScenario(scenario);
        const disjuntores = getDisjuntoresByScenario(scenario);

        const calculatedBranches = inputs.branches.map((branch) => {
            const ib = calculateIb({
                fase: branch.fase,
                acumuladaKva: branch.acumuladaKva,
                eta: branch.eta,
                tensaoTrifasicaV: branch.tensaoTrifasicaV
            });
            const inBreaker = lookupDisjuntorIn(ib, disjuntores);
            const cableData = lookupCaboElectricalData(branch.conductorName, cabos);
            const protection = evaluateProtection(ib, inBreaker, cableData.iz);
            const correctedResistance = calculateCorrectedResistance({
                resistance: cableData.resistance,
                alpha: cableData.alpha,
                divisorR: cableData.divisorR,
                temperatureC: branch.temperatureC ?? 30
            });
            const qtPonto = calculateQtPonto({
                fase: branch.fase,
                acumuladaKva: branch.acumuladaKva,
                correctedResistance,
                reactance: cableData.reactance,
                tensaoTrifasicaV: branch.tensaoTrifasicaV,
                lengthMeters: branch.lengthMeters ?? 0
            });

            return {
                trechoId: branch.trechoId,
                ponto: branch.ponto,
                lado: branch.lado,
                conductorName: branch.conductorName,
                fase: branch.fase,
                ib,
                inBreaker,
                izCable: cableData.iz,
                correctedResistance,
                qtPonto,
                status: protection.status
            };
        });

        snapshot.branches = {
            items: calculatedBranches,
            okCount: calculatedBranches.filter((item) => item.status === 'OK').length,
            verificarCount: calculatedBranches.filter((item) => item.status === 'VERIFICAR').length
        };

        if (!snapshot.geral) {
            const sideRows = calculatedBranches.filter(
                (item): item is typeof item & { lado: 'ESQUERDO' | 'DIREITO'; ponto: string } =>
                    (item.lado === 'ESQUERDO' || item.lado === 'DIREITO') &&
                    typeof item.ponto === 'string' &&
                    item.ponto.length > 0
            );

            if (sideRows.length > 0) {
                const qtMttr =
                    (snapshot.db as { k10QtMttr?: number } | undefined)?.k10QtMttr ??
                    inputs.geral?.qtMttr ??
                    0;
                const baseVoltage = 127 - (127 * qtMttr);
                const esqCqtByPonto: Record<string, number> = {};
                const dirCqtByPonto: Record<string, number> = {};

                for (const row of sideRows) {
                    const cqtValue = baseVoltage - row.qtPonto;
                    if (row.lado === 'ESQUERDO') {
                        esqCqtByPonto[row.ponto] = cqtValue;
                    } else {
                        dirCqtByPonto[row.ponto] = cqtValue;
                    }
                }

                const fallbackPoint = sideRows[0].ponto;
                const pointCandidates = ['RAMAL', fallbackPoint];
                const pontoRamal = pointCandidates.find(
                    (point) => point in esqCqtByPonto || point in dirCqtByPonto
                ) ?? fallbackPoint;

                snapshot.geral = {
                    p31CqtNoPonto: calculateGeralCqtNoPonto({
                        lado: 'ESQUERDO',
                        ponto: pontoRamal,
                        qtMttr,
                        esqCqtByPonto,
                        dirCqtByPonto
                    }),
                    p32CqtNoPonto: calculateGeralCqtNoPonto({
                        lado: 'DIREITO',
                        ponto: pontoRamal,
                        qtMttr,
                        esqCqtByPonto,
                        dirCqtByPonto
                    }),
                    source: 'branches-derived'
                };
            }
        }
    }

    const hasComputedSection = Boolean(snapshot.dmdi || snapshot.geral || snapshot.db || snapshot.branches);
    if (!hasComputedSection) {
        return btContext;
    }

    return {
        ...btContext,
        cqtSnapshot: snapshot
    };
};
