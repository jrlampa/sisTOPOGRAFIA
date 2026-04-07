import {
    excelIfError,
    excelSumIf,
    excelVLookupApprox,
    excelVLookupExact
} from '../services/cqtLookupService';

describe('cqtLookupService', () => {
    const cableRows = [
        { code: '16 Al', ampacity: 72, resistance: 1.84 },
        { code: '25 Al', ampacity: 97, resistance: 1.2 },
        { code: '70 Al', ampacity: 178, resistance: 0.443 }
    ];

    const breakerRows = [
        { ib: 0, breaker: 16 },
        { ib: 16, breaker: 20 },
        { ib: 20, breaker: 25 },
        { ib: 25, breaker: 32 },
        { ib: 32, breaker: 40 }
    ];

    it('returns exact match for VLOOKUP exact', () => {
        const ampacity = excelVLookupExact(cableRows, '25 Al', 'code', 'ampacity');
        expect(ampacity).toBe(97);
    });

    it('throws when VLOOKUP exact has no match', () => {
        expect(() => excelVLookupExact(cableRows, '999 Al', 'code', 'ampacity'))
            .toThrow('VLOOKUP exact match not found');
    });

    it('returns nearest lower match for VLOOKUP approximate', () => {
        const breaker = excelVLookupApprox(breakerRows, 24.5, 'ib', 'breaker');
        expect(breaker).toBe(25);
    });

    it('throws when VLOOKUP approximate is lower than first key', () => {
        expect(() => excelVLookupApprox(breakerRows, -1, 'ib', 'breaker'))
            .toThrow('VLOOKUP approximate match not found');
    });

    it('sums only matching rows with SUMIF semantics', () => {
        const rows = [
            { trecho: 1, demand: 12.5 },
            { trecho: 1, demand: 7.5 },
            { trecho: 2, demand: 3 }
        ];

        const total = excelSumIf(rows, 'trecho', 1, 'demand');
        expect(total).toBe(20);
    });

    it('returns fallback when operation throws (IFERROR)', () => {
        const value = excelIfError(
            () => excelVLookupExact(cableRows, 'not-found', 'code', 'ampacity') as number,
            0
        );

        expect(value).toBe(0);
    });

    it('returns fallback when operation yields nullish (IFERROR)', () => {
        const value = excelIfError(() => null, 99);
        expect(value).toBe(99);
    });
});
