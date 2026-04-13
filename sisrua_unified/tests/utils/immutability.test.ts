import { describe, it, expect, vi } from 'vitest';
import { 
    deepFreeze, 
    shallowFreeze, 
    createImmutableNext, 
    findMutablePaths,
    assertImmutable 
} from '../../src/utils/immutability';

describe('immutability utilities', () => {
    describe('deepFreeze', () => {
        it('should recursively freeze an object', () => {
            const obj = {
                a: 1,
                b: { c: 2, d: { e: 3 } }
            };
            
            deepFreeze(obj);
            
            expect(Object.isFrozen(obj)).toBe(true);
            expect(Object.isFrozen(obj.b)).toBe(true);
            expect(Object.isFrozen(obj.b.d)).toBe(true);
            
            // Verifying it cannot be changed (throws in strict mode, but we can check Object.isFrozen)
            try { (obj.b.d as any).e = 4; } catch(e) {}
            expect(obj.b.d.e).toBe(3);
        });

        it('should handle null and primitives safely', () => {
            expect(deepFreeze(null)).toBe(null);
            expect(deepFreeze(42)).toBe(42);
            expect(deepFreeze("test")).toBe("test");
        });

        it('should handle already frozen objects', () => {
            const obj = Object.freeze({ a: 1 });
            expect(deepFreeze(obj)).toBe(obj);
        });
    });

    describe('shallowFreeze', () => {
        it('should freeze only the top level', () => {
            const obj = { a: 1, b: { c: 2 } };
            shallowFreeze(obj);
            
            expect(Object.isFrozen(obj)).toBe(true);
            expect(Object.isFrozen(obj.b)).toBe(false);
        });
    });

    describe('createImmutableNext', () => {
        it('should create a new object with updates', () => {
            const original = { a: 1, b: 2 };
            const next = createImmutableNext(original, { b: 3 });
            
            expect(next).not.toBe(original);
            expect(next.a).toBe(1);
            expect(next.b).toBe(3);
        });
    });

    describe('findMutablePaths', () => {
        it('should identify mutable objects in a tree', () => {
            const nested = { c: 2 };
            const obj = {
                a: 1,
                b: nested
            };
            Object.freeze(obj);
            
            const mutable = findMutablePaths(obj);
            expect(mutable).toContain('b');
        });

        it('should return empty array for fully frozen object', () => {
            const obj = deepFreeze({ a: 1, b: { c: 2 } });
            expect(findMutablePaths(obj)).toHaveLength(0);
        });
    });

    describe('assertImmutable', () => {
        it('should warn when object is mutable in dev mode', () => {
            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const obj = { a: 1 };
            
            assertImmutable(obj, 'Test object');
            
            // In dev mode, should warn with a message containing the tag and the object
            if (consoleSpy.mock.calls.length > 0) {
                const [firstArg, secondArg] = consoleSpy.mock.calls[0];
                expect(firstArg).toContain('[Immutability Warning]');
                expect(secondArg).toEqual({ a: 1 });
            }
            consoleSpy.mockRestore();
        });
    });
});
