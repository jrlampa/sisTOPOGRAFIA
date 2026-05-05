import { afterEach, describe, expect, it, vi } from "vitest";
import {
  analyzeArea,
  findLocationWithGemini,
} from "../../src/services/geminiService";

describe("geminiService analysis parsing", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns disabled summary when AI is off", async () => {
    const result = await analyzeArea({ buildings: 1 }, "Area Teste", false);
    expect(result).toBe("Analysis summary disabled.");
  });

  it("returns analysis text from JSON success response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ analysis: "Analise OK" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const result = await analyzeArea({ buildings: 1 }, "Area Teste", true);
    expect(result).toBe("Analise OK");
  });

  it("returns plain text when response is ok and not JSON", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("texto simples", {
        status: 200,
        headers: { "content-type": "text/plain" },
      }),
    );

    const result = await analyzeArea({ buildings: 1 }, "Area Teste", true);
    expect(result).toBe("texto simples");
  });

  it("returns API analysis message from error JSON body when available", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({ analysis: "Falha temporaria com contexto." }),
        {
          status: 400,
          headers: { "content-type": "application/json" },
        },
      ),
    );

    const result = await analyzeArea({ buildings: 1 }, "Area Teste", true);
    expect(result).toBe("Falha temporaria com contexto.");
  });

  it("returns formatted API error when message exists in JSON body", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "Entrada invalida" }), {
        status: 422,
        headers: { "content-type": "application/json" },
      }),
    );

    const result = await analyzeArea({ buildings: 1 }, "Area Teste", true);
    expect(result).toBe("**Erro na análise**: Entrada invalida");
  });

  it("returns ollama help text on 503 with invalid body", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("", {
        status: 503,
        headers: { "content-type": "text/plain" },
      }),
    );

    const result = await analyzeArea({ buildings: 1 }, "Area Teste", true);
    expect(result).toContain("Use o Ollama local");
    expect(result).toContain("ollama serve");
  });

  it("returns connection error when fetch throws", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
      new Error("network down"),
    );

    const result = await analyzeArea({ buildings: 1 }, "Area Teste", true);
    expect(result).toContain("**Erro de conexão**");
  });
});

describe("findLocationWithGemini", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null when AI is disabled", async () => {
    const result = await findLocationWithGemini("Praça XV", false);
    expect(result).toBeNull();
  });

  it("returns location when backend responds with success", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ lat: -22.9, lng: -43.2, label: "RJ" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const result = await findLocationWithGemini("Rio de Janeiro", true);
    expect(result).toEqual({ lat: -22.9, lng: -43.2, label: "RJ" });
  });

  it("returns null when backend responds with non-ok status", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("", { status: 500 }),
    );

    const result = await findLocationWithGemini("Rio de Janeiro", true);
    expect(result).toBeNull();
  });

  it("returns null when fetch throws", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
      new Error("network down"),
    );

    const result = await findLocationWithGemini("Rio de Janeiro", true);
    expect(result).toBeNull();
  });
});
