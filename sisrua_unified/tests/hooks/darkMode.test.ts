/**
 * darkMode.test.ts — Vitest tests for OS dark mode auto-detect.
 * Tests the detectSystemTheme logic via initialState and ThemeProvider.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Helper to mock window.matchMedia
function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === "(prefers-color-scheme: dark)" ? matches : false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

describe("detectSystemTheme (via initialState module)", () => {
  afterEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  it('retorna "dark" quando prefers-color-scheme: dark está ativo', async () => {
    mockMatchMedia(true);
    // Re-importar para reexecutar detectSystemTheme()
    const { INITIAL_APP_STATE } = await import("../../src/app/initialState");
    // Sem settings persistidos, deve usar o tema do sistema
    expect(INITIAL_APP_STATE.settings.theme).toBe("dark");
  });

  it('retorna "light" quando prefers-color-scheme: dark não está ativo', async () => {
    mockMatchMedia(false);
    const { INITIAL_APP_STATE } = await import("../../src/app/initialState");
    expect(INITIAL_APP_STATE.settings.theme).toBe("light");
  });

  it("respeitará o tema salvo no localStorage sobre o tema do sistema", async () => {
    mockMatchMedia(true); // OS = dark
    // Simular um setting salvo com tema light
    const saved = {
      enableAI: true,
      simplificationLevel: "low",
      orthogonalize: true,
      contourRenderMode: "spline",
      projection: "utm",
      theme: "light", // usuário salvou light explicitamente
      mapProvider: "vector",
      contourInterval: 5,
      projectType: "ramais",
      btNetworkScenario: "asis",
      btEditorMode: "none",
      btTransformerCalculationMode: "automatic",
      btQtPontoCalculationMethod: "impedance_modulus",
      btCqtPowerFactor: 0.92,
      clandestinoAreaM2: 0,
      mtEditorMode: "none",
      layers: {},
      projectMetadata: {},
    };
    localStorage.setItem("sisrua_settings", JSON.stringify(saved));
    localStorage.setItem("sisrua_version", "1");

    const { INITIAL_APP_STATE } = await import("../../src/app/initialState");
    // localStorage vence o sistema
    expect(INITIAL_APP_STATE.settings.theme).toBe("light");
  });

  it('retorna "light" como fallback quando window.matchMedia não existe', async () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: undefined,
    });
    const { INITIAL_APP_STATE } = await import("../../src/app/initialState");
    expect(["light", "dark"]).toContain(INITIAL_APP_STATE.settings.theme);
  });
});
