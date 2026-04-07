import { excelIfError, excelVLookupExact } from './cqtLookupService.js';

export interface DmdiInput {
    clandestinoEnabled: boolean;
    aa24DemandBase: number;
    sumClientsX: number;
    ab35LookupDmdi: number;
}

const safeDiv = (numerator: number, denominator: number): number => {
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
        throw new Error('Invalid division in DMDI calculation');
    }

    return numerator / denominator;
};

/**
 * Workbook parity (RAMAL!AA30):
 * IF(GERAL!I2="SIM", AB35, AA24 / SUM(X18:X77))
 */
export const calculateDmdi = (input: DmdiInput): number => {
    if (input.clandestinoEnabled) {
        return input.ab35LookupDmdi;
    }

    return excelIfError(
        () => safeDiv(input.aa24DemandBase, input.sumClientsX),
        0
    );
};

export interface DmdiResult {
    dmdi: number;
    source: 'lookup-ab35' | 'aa24-div-sumx';
}

export const calculateDmdiWithMetadata = (input: DmdiInput): DmdiResult => {
    if (input.clandestinoEnabled) {
        return {
            dmdi: input.ab35LookupDmdi,
            source: 'lookup-ab35'
        };
    }

    return {
        dmdi: calculateDmdi(input),
        source: 'aa24-div-sumx'
    };
};

export type CqtLado = 'ESQUERDO' | 'DIREITO' | 'TRAFO';

export interface GeralCqtNoPontoInput {
    lado: CqtLado;
    ponto: string;
    qtMttr: number;
    esqCqtByPonto: Record<string, number>;
    dirCqtByPonto: Record<string, number>;
}

/**
 * Workbook parity (GERAL!CQT NO PONTO):
 * ESQUERDO -> VLOOKUP(ponto, ESQ_ATUAL, col_eta_cqt, 0)
 * DIREITO  -> VLOOKUP(ponto, DIR_ATUAL, col_eta_cqt, 0)
 * TRAFO    -> 127 - 127 * QT_MTTR
 */
export const calculateGeralCqtNoPonto = (input: GeralCqtNoPontoInput): number => {
    if (input.lado === 'TRAFO') {
        return 127 - (127 * input.qtMttr);
    }

    const sourceTable = input.lado === 'ESQUERDO' ? input.esqCqtByPonto : input.dirCqtByPonto;

    return excelIfError(
        () => {
            const rows = Object.entries(sourceTable).map(([point, cqtValue]) => ({ point, cqtValue }));
            const value = excelVLookupExact(rows, input.ponto, 'point', 'cqtValue');

            if (typeof value !== 'number' || !Number.isFinite(value)) {
                throw new Error('Invalid CQT value in side table');
            }

            return value;
        },
        0
    );
};

export interface TrafosZRow {
    trafoKva: number;
    qtFactor: number;
}

export interface DbIndicatorsInput {
    trAtual: number;
    demAtual: number;
    qtMt: number;
    trafosZ: TrafosZRow[];
}

export interface DbIndicatorsResult {
    k6TrAtual: number;
    k7DemAtual: number;
    k8QtTr: number;
    k10QtMttr: number;
}

/**
 * Workbook parity (DB):
 * K6 = TR_ATUAL
 * K7 = DEM_ATUAL
 * K8 = (DEM_ATUAL / TR_ATUAL) * VLOOKUP(TR_ATUAL, TRAFOS_Z, 2, 0)
 * K10 = QT_MT + K8
 */
export const calculateDbIndicators = (input: DbIndicatorsInput): DbIndicatorsResult => {
    const k8QtTr = excelIfError(() => {
        const qtFactor = excelVLookupExact(input.trafosZ, input.trAtual, 'trafoKva', 'qtFactor');
        if (typeof qtFactor !== 'number' || !Number.isFinite(qtFactor)) {
            throw new Error('Invalid TRAFOS_Z factor');
        }

        return safeDiv(input.demAtual, input.trAtual) * qtFactor;
    }, 0);

    return {
        k6TrAtual: input.trAtual,
        k7DemAtual: input.demAtual,
        k8QtTr,
        k10QtMttr: input.qtMt + k8QtTr
    };
};

