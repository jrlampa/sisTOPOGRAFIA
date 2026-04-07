import {
    calculateDbIndicators,
    calculateDmdiWithMetadata,
    calculateGeralCqtNoPonto,
    calculateIb,
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

            return {
                trechoId: branch.trechoId,
                conductorName: branch.conductorName,
                fase: branch.fase,
                ib,
                inBreaker,
                izCable: cableData.iz,
                status: protection.status
            };
        });

        snapshot.branches = {
            items: calculatedBranches,
            okCount: calculatedBranches.filter((item) => item.status === 'OK').length,
            verificarCount: calculatedBranches.filter((item) => item.status === 'VERIFICAR').length
        };
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
