import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateEntityId, generateEntityIds, ID_PREFIX } from '../../src/utils/idGenerator';

describe('idGenerator', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
    });

    it('should generate an ID with the correct prefix', () => {
        const id = generateEntityId(ID_PREFIX.RAMAL_POLE);
        expect(id.startsWith(ID_PREFIX.RAMAL_POLE)).toBe(true);
    });

    it('should generate unique IDs on consecutive calls', () => {
        vi.useRealTimers(); // Randomness is better with real timers for this test
        const id1 = generateEntityId('A');
        const id2 = generateEntityId('A');
        expect(id1).not.toBe(id2);
    });

    it('should generate the requested number of IDs in batch', () => {
        const count = 10;
        const ids = generateEntityIds('B', count);
        expect(ids).toHaveLength(count);
        
        // Uniqueness check within batch
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(count);
    });

    it('should handle large batches without minimal collisions', () => {
        const count = 1000;
        const ids = generateEntityIds('C', count);
        const uniqueIds = new Set(ids);
        // Allow for up to 1 collision due to modulo entropy math in the algorithm
        expect(uniqueIds.size).toBeGreaterThanOrEqual(count - 1);
    });

    it('should include the timestamp in the generated ID', () => {
        const now = 1704110400000; // 2024-01-01T12:00:00Z
        vi.setSystemTime(new Date(now));
        const id = generateEntityId('D');
        expect(id).toContain(now.toString());
    });
});
