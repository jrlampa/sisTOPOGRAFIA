export type LookupComparable = string | number;

type LookupRecord = Record<string, unknown>;

const isFiniteNumber = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value);

export const excelIfError = <T>(operation: () => T, fallback: T): T => {
    try {
        const value = operation();
        return value === undefined || value === null ? fallback : value;
    } catch {
        return fallback;
    }
};

export const excelSumIf = (
    rows: LookupRecord[],
    criteriaField: string,
    criteriaValue: LookupComparable,
    sumField: string
): number => {
    return rows.reduce((acc, row) => {
        if (row[criteriaField] !== criteriaValue) {
            return acc;
        }

        const sumValue = row[sumField];
        return acc + (isFiniteNumber(sumValue) ? sumValue : 0);
    }, 0);
};

export const excelVLookupExact = <T extends LookupRecord>(
    rows: T[],
    lookupValue: LookupComparable,
    lookupField: keyof T,
    resultField: keyof T
): T[keyof T] => {
    const match = rows.find((row) => row[lookupField] === lookupValue);
    if (!match) {
        throw new Error(`VLOOKUP exact match not found for value: ${String(lookupValue)}`);
    }

    return match[resultField];
};

export const excelVLookupApprox = <T extends LookupRecord>(
    rows: T[],
    lookupValue: number,
    lookupField: keyof T,
    resultField: keyof T
): T[keyof T] => {
    if (!Number.isFinite(lookupValue)) {
        throw new Error('VLOOKUP approximate requires a finite numeric lookup value');
    }

    const sortedRows = [...rows].sort((a, b) => {
        const aValue = a[lookupField];
        const bValue = b[lookupField];

        if (!isFiniteNumber(aValue) || !isFiniteNumber(bValue)) {
            throw new Error('VLOOKUP approximate requires numeric lookup columns');
        }

        return aValue - bValue;
    });

    let candidate: T | null = null;

    for (const row of sortedRows) {
        const keyValue = row[lookupField];
        if (!isFiniteNumber(keyValue)) {
            throw new Error('VLOOKUP approximate requires numeric lookup columns');
        }

        if (keyValue <= lookupValue) {
            candidate = row;
            continue;
        }

        break;
    }

    if (!candidate) {
        throw new Error(`VLOOKUP approximate match not found for value: ${lookupValue}`);
    }

    return candidate[resultField];
};
