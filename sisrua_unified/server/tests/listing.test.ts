import { buildListMeta, comparePrimitiveValues } from '../utils/listing';

describe('listing utilities', () => {
    describe('buildListMeta', () => {
        it('should correctly calculate hasMore', () => {
            const meta = buildListMeta({
                limit: 10,
                offset: 0,
                total: 25,
                returned: 10,
                sortBy: 'id',
                sortOrder: 'asc',
                filters: {}
            });
            expect(meta.hasMore).toBe(true);
            
            const metaEnd = buildListMeta({
                limit: 10,
                offset: 20,
                total: 25,
                returned: 5,
                sortBy: 'id',
                sortOrder: 'asc',
                filters: {}
            });
            expect(metaEnd.hasMore).toBe(false);
        });
    });

    describe('comparePrimitiveValues', () => {
        it('should handle null/undefined correctly', () => {
            expect(comparePrimitiveValues(null, null, 'asc')).toBe(0);
            expect(comparePrimitiveValues(undefined, undefined, 'asc')).toBe(0);
            expect(comparePrimitiveValues(null, undefined, 'asc')).toBe(0);
            
            expect(comparePrimitiveValues(null, 'value', 'asc')).toBe(1);
            expect(comparePrimitiveValues('value', null, 'asc')).toBe(-1);
        });

        it('should compare numbers correctly (asc/desc)', () => {
            expect(comparePrimitiveValues(5, 10, 'asc')).toBeLessThan(0);
            expect(comparePrimitiveValues(10, 5, 'asc')).toBeGreaterThan(0);
            
            expect(comparePrimitiveValues(5, 10, 'desc')).toBeGreaterThan(0);
            expect(comparePrimitiveValues(10, 5, 'desc')).toBeLessThan(0);
        });

        it('should compare booleans correctly', () => {
            expect(comparePrimitiveValues(false, true, 'asc')).toBeLessThan(0); // 0 - 1 = -1
            expect(comparePrimitiveValues(true, false, 'desc')).toBeLessThan(0); // (1 - 0) * -1 = -1
        });

        it('should compare strings using localeCompare (pt-BR)', () => {
            // Note: localeCompare return values are not guaranteed to be 1/-1, just >0 or <0
            expect(comparePrimitiveValues('abacate', 'banana', 'asc')).toBeLessThan(0);
            expect(comparePrimitiveValues('çã', 'ca', 'asc')).toBe(0); // sensitivity: 'base' ignores accents/cedilla
            expect(comparePrimitiveValues('10', '2', 'asc')).toBeGreaterThan(0); // numeric: true
        });
    });
});
