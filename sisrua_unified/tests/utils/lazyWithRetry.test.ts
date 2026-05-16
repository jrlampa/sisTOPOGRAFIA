import { describe, it, expect, vi, afterEach } from "vitest";
import { lazyWithRetry, resetChunkReloadFlag } from "../../src/utils/lazyWithRetry";

// ---------------------------------------------------------------------------
// lazyWithRetry
// ---------------------------------------------------------------------------

afterEach(() => {
  // Clean up the session storage flag between tests
  sessionStorage.removeItem("__sisrua_chunk_reload_once__");
  vi.restoreAllMocks();
});

describe("lazyWithRetry", () => {
  it("resolves successfully when the import factory succeeds", async () => {
    const fakeModule = { default: {} as object };
    const factory = vi.fn().mockResolvedValue(fakeModule);

    const result = await lazyWithRetry(factory);
    expect(result).toBe(fakeModule);
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it("re-throws non-chunk errors immediately without reloading", async () => {
    const error = new Error("network error");
    const factory = vi.fn().mockRejectedValue(error);

    await expect(lazyWithRetry(factory)).rejects.toThrow("network error");
  });

  it("re-throws chunk error if reload flag is already set", async () => {
    sessionStorage.setItem("__sisrua_chunk_reload_once__", "1");

    const error = new Error("Failed to fetch dynamically imported module");
    const factory = vi.fn().mockRejectedValue(error);

    // Should throw without trying to reload again
    await expect(lazyWithRetry(factory)).rejects.toThrow();
  });

  it("sets the reload flag and reloads on a chunk load error", async () => {
    const reloadSpy = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { reload: reloadSpy },
    });

    const error = new Error("Failed to fetch dynamically imported module");
    const factory = vi.fn().mockRejectedValue(error);

    await expect(lazyWithRetry(factory)).rejects.toThrow();
    expect(sessionStorage.getItem("__sisrua_chunk_reload_once__")).toBe("1");
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it("recognises all known chunk error message patterns", async () => {
    const patterns = [
      "error loading dynamically imported module",
      "importing a module script failed",
      "loading chunk",
      "ChunkLoadError",
    ];

    for (const pattern of patterns) {
      sessionStorage.removeItem("__sisrua_chunk_reload_once__");

      const reloadSpy = vi.fn();
      Object.defineProperty(window, "location", {
        configurable: true,
        value: { reload: reloadSpy },
      });

      const error = new Error(pattern);
      const factory = vi.fn().mockRejectedValue(error);

      await expect(lazyWithRetry(factory)).rejects.toThrow();
      expect(reloadSpy).toHaveBeenCalled();
    }
  });
});

// ---------------------------------------------------------------------------
// clearClientCaches – branches via lazyWithRetry trigger
// ---------------------------------------------------------------------------

describe("clearClientCaches – serviceWorker and caches branches", () => {
  afterEach(() => {
    sessionStorage.removeItem("__sisrua_chunk_reload_once__");
    vi.restoreAllMocks();
  });

  it("unregisters service workers when serviceWorker is in navigator", async () => {
    const unregisterSpy = vi.fn().mockResolvedValue(true);
    const getRegistrationsSpy = vi.fn().mockResolvedValue([
      { unregister: unregisterSpy },
    ]);

    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { getRegistrations: getRegistrationsSpy },
    });

    const reloadSpy = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { reload: reloadSpy },
    });

    const error = new Error("Failed to fetch dynamically imported module");
    const factory = vi.fn().mockRejectedValue(error);

    await expect(lazyWithRetry(factory)).rejects.toThrow();
    expect(getRegistrationsSpy).toHaveBeenCalled();
    expect(unregisterSpy).toHaveBeenCalled();

    // Cleanup – remove serviceWorker property
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: undefined,
    });
  });

  it("deletes caches when caches is in window", async () => {
    const deleteSpy = vi.fn().mockResolvedValue(true);
    const keysSpy = vi.fn().mockResolvedValue(["cache-v1", "cache-v2"]);

    // Stub globalThis.caches so both "caches" in window AND caches.keys() work
    vi.stubGlobal("caches", { keys: keysSpy, delete: deleteSpy });

    // Ensure serviceWorker is not in navigator to avoid interference from previous test
    Reflect.deleteProperty(navigator, "serviceWorker");

    const reloadSpy = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { reload: reloadSpy },
    });

    sessionStorage.removeItem("__sisrua_chunk_reload_once__");
    const error = new Error("Failed to fetch dynamically imported module");
    const factory = vi.fn().mockRejectedValue(error);

    await expect(lazyWithRetry(factory)).rejects.toThrow();
    expect(keysSpy).toHaveBeenCalled();
    expect(deleteSpy).toHaveBeenCalledTimes(2); // once per cache key

    vi.unstubAllGlobals();
  });
});

// ---------------------------------------------------------------------------
// resetChunkReloadFlag
// ---------------------------------------------------------------------------

describe("resetChunkReloadFlag", () => {
  it("removes the reload flag from session storage", () => {
    sessionStorage.setItem("__sisrua_chunk_reload_once__", "1");
    resetChunkReloadFlag();
    expect(sessionStorage.getItem("__sisrua_chunk_reload_once__")).toBeNull();
  });

  it("does nothing when the flag is not set", () => {
    expect(() => resetChunkReloadFlag()).not.toThrow();
  });
});
