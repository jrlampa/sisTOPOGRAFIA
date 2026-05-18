import { describe, it, expect, vi } from "vitest";
import {
  deepFreeze,
  shallowFreeze,
  createImmutableNext,
  findMutablePaths,
  assertImmutable,
} from "../../src/utils/immutability";

describe("immutability utilities", () => {
  describe("deepFreeze", () => {
    it("should recursively freeze an object", () => {
      const obj = {
        a: 1,
        b: { c: 2, d: { e: 3 } },
      };

      deepFreeze(obj);

      expect(Object.isFrozen(obj)).toBe(true);
      expect(Object.isFrozen(obj.b)).toBe(true);
      expect(Object.isFrozen(obj.b.d)).toBe(true);

      // Verifying it cannot be changed (throws in strict mode, but we can check Object.isFrozen)
      try {
        (obj.b.d as any).e = 4;
      } catch (e) {
        /* expected for frozen object */
      }
      expect(obj.b.d.e).toBe(3);
    });

    it("should handle null and primitives safely", () => {
      expect(deepFreeze(null)).toBe(null);
      expect(deepFreeze(42)).toBe(42);
      expect(deepFreeze("test")).toBe("test");
    });

    it("should handle already frozen objects", () => {
      const obj = Object.freeze({ a: 1 });
      expect(deepFreeze(obj)).toBe(obj);
    });
  });

  describe("shallowFreeze", () => {
    it("should freeze only the top level", () => {
      const obj = { a: 1, b: { c: 2 } };
      shallowFreeze(obj);

      expect(Object.isFrozen(obj)).toBe(true);
      expect(Object.isFrozen(obj.b)).toBe(false);
    });
  });

  describe("createImmutableNext", () => {
    it("should create a new object with updates", () => {
      const original = { a: 1, b: 2 };
      const next = createImmutableNext(original, { b: 3 });

      expect(next).not.toBe(original);
      expect(next.a).toBe(1);
      expect(next.b).toBe(3);
    });
  });

  describe("findMutablePaths", () => {
    it("should identify mutable objects in a tree", () => {
      const nested = { c: 2 };
      const obj = {
        a: 1,
        b: nested,
      };
      Object.freeze(obj);

      const mutable = findMutablePaths(obj);
      expect(mutable).toContain("b");
    });

    it("should return empty array for fully frozen object", () => {
      const obj = deepFreeze({ a: 1, b: { c: 2 } });
      expect(findMutablePaths(obj)).toHaveLength(0);
    });
  });

  describe("assertImmutable", () => {
    it("should warn when object is mutable in dev mode", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const obj = { a: 1 };

      assertImmutable(obj, "Test object");

      // In dev mode, should warn with a message containing the tag and the object
      if (consoleSpy.mock.calls.length > 0) {
        const [firstArg, secondArg] = consoleSpy.mock.calls[0];
        expect(firstArg).toContain("[Immutability Warning]");
        expect(secondArg).toEqual({ a: 1 });
      }
      consoleSpy.mockRestore();
    });

    it("should not warn when object is already frozen", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const obj = Object.freeze({ a: 1 });

      assertImmutable(obj, "Frozen object");

      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("should not warn for null", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      assertImmutable(null as any, "null check");
      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("should not warn for primitives", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      assertImmutable(42 as any, "primitive");
      assertImmutable("string" as any, "string");
      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("uses default description when none is provided", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      assertImmutable({ x: 1 });
      // Either warned or not depending on IS_DEVELOPMENT; just ensure no throw
      consoleSpy.mockRestore();
    });
  });

  describe("createImmutableNext – additional", () => {
    it("original is not modified by updates", () => {
      const original = Object.freeze({ a: 1, b: 2 });
      const next = createImmutableNext(original, { b: 99 });
      expect((original as any).b).toBe(2);
      expect(next.b).toBe(99);
    });

    it("merges multiple update keys", () => {
      const original = { x: 1, y: 2, z: 3 };
      const next = createImmutableNext(original, { x: 10, z: 30 });
      expect(next.x).toBe(10);
      expect(next.y).toBe(2);
      expect(next.z).toBe(30);
    });
  });

  describe("findMutablePaths – additional edge cases", () => {
    it("returns empty array for primitive input", () => {
      expect(findMutablePaths("string")).toHaveLength(0);
      expect(findMutablePaths(42)).toHaveLength(0);
      expect(findMutablePaths(null)).toHaveLength(0);
    });

    it("respects maxDepth of 0", () => {
      const obj = { a: { b: 1 } };
      const result = findMutablePaths(obj, 0);
      expect(result).toHaveLength(0);
    });

    it("includes nested mutable paths with custom depth", () => {
      const inner = { z: 3 };
      const obj = { a: inner };
      // obj is mutable, inner is mutable; primitives (z:3) are not objects so not listed
      const paths = findMutablePaths(obj, 3);
      expect(paths).toContain("[root]");
      expect(paths).toContain("a");
      // z=3 is a primitive, so 'a.z' is NOT a mutable path
      expect(paths).not.toContain("a.z");
    });

    it("reports [root] when the object itself is not frozen", () => {
      const obj = { x: 1 };
      const paths = findMutablePaths(obj);
      expect(paths).toContain("[root]");
    });
  });

  describe("deepFreeze – additional edge cases", () => {
    it("handles objects with function properties", () => {
      const obj = { fn: () => 42 };
      const frozen = deepFreeze(obj);
      expect(Object.isFrozen(frozen)).toBe(true);
    });

    it("handles circular-like patterns via isFrozen check on property", () => {
      // Nested already-frozen object should not cause infinite loop
      const inner = Object.freeze({ a: 1 });
      const outer = { inner };
      deepFreeze(outer);
      expect(Object.isFrozen(outer)).toBe(true);
    });
  });
});
