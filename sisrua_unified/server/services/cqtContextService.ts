import { calculateDbIndicators, calculateDmdiWithMetadata, calculateGeralCqtNoPonto } from './cqtEngine.js';
import { getTrafosZByScenario } from '../constants/cqtLookupTables.js';

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

    const hasComputedSection = Boolean(snapshot.dmdi || snapshot.geral || snapshot.db);
    if (!hasComputedSection) {
        return btContext;
    }

    return {
        ...btContext,
        cqtSnapshot: snapshot
    };
};
