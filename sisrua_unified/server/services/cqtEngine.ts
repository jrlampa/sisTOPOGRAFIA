import { excelIfError, excelVLookupApprox, excelVLookupExact } from './cqtLookupService.js';

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
    [key: string]: unknown;
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

export type CqtFase = 'MONO' | 'BIF' | 'TRI';

export interface IbInput {
    fase: CqtFase;
    acumuladaKva: number;
    eta: number;
    tensaoTrifasicaV: number;
}

/**
 * Workbook parity (ESQ/DIR coluna Ib):
 * MONO: ACUMULADA*1000/(220*ETA)
 * BIF/TRI: ACUMULADA*1000/(SQRT(3)*V*ETA)
 */
export const calculateIb = (input: IbInput): number => {
    return excelIfError(() => {
        if (input.eta <= 0) {
            throw new Error('Invalid ETA');
        }

        if (input.fase === 'MONO') {
            return (input.acumuladaKva * 1000) / (220 * input.eta);
        }

        return (input.acumuladaKva * 1000) / (Math.sqrt(3) * input.tensaoTrifasicaV * input.eta);
    }, 0);
};

export interface DisjuntorLookupRow {
    ib: number;
    disjuntor: number;
    [key: string]: unknown;
}

export const lookupDisjuntorIn = (ib: number, table: DisjuntorLookupRow[]): number => {
    return excelIfError(() => {
        const result = excelVLookupApprox(table, ib, 'ib', 'disjuntor');
        if (typeof result !== 'number' || !Number.isFinite(result)) {
            throw new Error('Invalid disjuntor value');
        }

        return result;
    }, 0);
};

export interface CaboLookupRow {
    name: string;
    ampacity: number;
    resistance: number;
    reactance: number;
    alpha: number;
    divisorR: number;
    [key: string]: unknown;
}

export interface CaboElectricalData {
    iz: number;
    resistance: number;
    reactance: number;
    alpha: number;
    divisorR: number;
}

export const lookupCaboElectricalData = (
    conductorName: string,
    table: CaboLookupRow[]
): CaboElectricalData => {
    return excelIfError(() => {
        const row = excelVLookupExact(table, conductorName, 'name', 'name');
        if (typeof row !== 'string') {
            throw new Error('Invalid cable lookup row');
        }

        const found = table.find((item) => item.name === row);
        if (!found) {
            throw new Error('Cable row missing after lookup');
        }

        return {
            iz: found.ampacity,
            resistance: found.resistance,
            reactance: found.reactance,
            alpha: found.alpha,
            divisorR: found.divisorR
        };
    }, {
        iz: 0,
        resistance: 0,
        reactance: 0,
        alpha: 0,
        divisorR: 0
    });
};

export interface ProtectionResult {
    inBreaker: number;
    izCable: number;
    status: 'OK' | 'VERIFICAR';
}

/**
 * Workbook parity (PROTECAO): IF(AND(Ib<=In, In<=Iz),"OK","VERIFICAR")
 */
export const evaluateProtection = (
    ib: number,
    inBreaker: number,
    izCable: number
): ProtectionResult => {
    const status = ib <= inBreaker && inBreaker <= izCable ? 'OK' : 'VERIFICAR';
    return { inBreaker, izCable, status };
};

export interface CorrectedResistanceInput {
    resistance: number;
    alpha: number;
    divisorR: number;
    temperatureC: number;
}

/**
 * Workbook parity (R CORR):
 * (R / DIVISOR_R) * (1 + alpha * (T - 20))
 */
export const calculateCorrectedResistance = (input: CorrectedResistanceInput): number => {
    return excelIfError(() => {
        if (!Number.isFinite(input.divisorR) || input.divisorR === 0) {
            throw new Error('Invalid divisorR');
        }

        return (input.resistance / input.divisorR) * (1 + input.alpha * (input.temperatureC - 20));
    }, 0);
};

export interface QtPontoInput {
    fase: CqtFase;
    acumuladaKva: number;
    correctedResistance: number;
    reactance: number;
    tensaoTrifasicaV: number;
    lengthMeters: number;
}

/**
 * Aproximação alinhada ao workbook (QT-PONTO) para telemetria de paridade.
 */
export const calculateQtPonto = (input: QtPontoInput): number => {
    return excelIfError(() => {
        const phaseFactor = input.fase === 'MONO' ? 6 : input.fase === 'BIF' ? 2 : 1;
        const impedance = Math.sqrt((input.correctedResistance ** 2) + (input.reactance ** 2));
        const voltageFactor = (input.tensaoTrifasicaV ** 2) / 100;
        if (voltageFactor === 0) {
            throw new Error('Invalid voltageFactor');
        }

        return phaseFactor * input.acumuladaKva * (impedance / voltageFactor) * input.lengthMeters * 127 / 100;
    }, 0);
};

