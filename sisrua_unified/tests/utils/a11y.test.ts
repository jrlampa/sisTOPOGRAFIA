import { describe, it, expect } from "vitest";
import {
  hexToRgb,
  relativeLuminance,
  contrastRatio,
  wcagContrastLevel,
  validarLangHtml,
  buildAriaLabel,
  gerarIdAcessivel,
  regrasObrigatorias,
  verificarComponente,
  REGRAS_A11Y,
} from "../../src/utils/a11y";

describe("a11y — hexToRgb", () => {
  it("converte hex de 6 dígitos", () => {
    expect(hexToRgb("#ffffff")).toEqual([255, 255, 255]);
    expect(hexToRgb("#000000")).toEqual([0, 0, 0]);
  });

  it("converte hex de 3 dígitos (shorthand)", () => {
    expect(hexToRgb("#fff")).toEqual([255, 255, 255]);
    expect(hexToRgb("#000")).toEqual([0, 0, 0]);
  });

  it("retorna null para hex inválido", () => {
    expect(hexToRgb("#gg")).toBeNull();
    expect(hexToRgb("#12")).toBeNull();
  });
});

describe("a11y — relativeLuminance", () => {
  it("preto tem luminância 0", () => {
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 5);
  });

  it("branco tem luminância 1", () => {
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 5);
  });

  it("retorna null para cor inválida", () => {
    expect(relativeLuminance("#xyz")).toBeNull();
  });
});

describe("a11y — contrastRatio", () => {
  it("preto sobre branco tem contraste 21:1", () => {
    const ratio = contrastRatio("#000000", "#ffffff");
    expect(ratio).toBeCloseTo(21, 0);
  });

  it("mesma cor tem contraste 1:1", () => {
    const ratio = contrastRatio("#888888", "#888888");
    expect(ratio).toBeCloseTo(1, 1);
  });

  it("retorna null se cor inválida", () => {
    expect(contrastRatio("#zzz", "#fff")).toBeNull();
  });
});

describe("a11y — wcagContrastLevel", () => {
  it("≥ 7 retorna AAA", () => {
    expect(wcagContrastLevel(7.1)).toBe("AAA");
    expect(wcagContrastLevel(21)).toBe("AAA");
  });

  it("≥ 4.5 e < 7 retorna AA", () => {
    expect(wcagContrastLevel(4.5)).toBe("AA");
    expect(wcagContrastLevel(6.9)).toBe("AA");
  });

  it("≥ 3 e < 4.5 retorna AA_LARGE", () => {
    expect(wcagContrastLevel(3)).toBe("AA_LARGE");
    expect(wcagContrastLevel(4.4)).toBe("AA_LARGE");
  });

  it("< 3 retorna Reprovado", () => {
    expect(wcagContrastLevel(2.9)).toBe("Reprovado");
    expect(wcagContrastLevel(1)).toBe("Reprovado");
  });
});

describe("a11y — validarLangHtml (eMAG 3.1)", () => {
  it("pt-BR é válido", () => {
    const result = validarLangHtml("pt-BR");
    expect(result.valido).toBe(true);
  });

  it("pt sem região é inválido mas reconhecido como pt", () => {
    const result = validarLangHtml("pt");
    expect(result.valido).toBe(false);
    expect(result.mensagem).toContain("pt-BR");
  });

  it("lang completamente diferente é inválido", () => {
    const result = validarLangHtml("en-US");
    expect(result.valido).toBe(false);
    expect(result.mensagem).toContain("pt-BR");
  });
});

describe("a11y — buildAriaLabel", () => {
  it("une partes com vírgula", () => {
    expect(buildAriaLabel(["Botão", "Salvar", "Projeto"])).toBe(
      "Botão, Salvar, Projeto"
    );
  });

  it("ignora partes vazias", () => {
    expect(buildAriaLabel(["Editar", "", "Poste"])).toBe("Editar, Poste");
  });

  it("retorna vazio se todas as partes forem vazias", () => {
    expect(buildAriaLabel(["", "  "])).toBe("");
  });
});

describe("a11y — gerarIdAcessivel", () => {
  it("gera ID sem acentos e em minúsculas", () => {
    const id = gerarIdAcessivel("input", "Nome Completo", 0);
    expect(id).toBe("input-nome-completo-0");
  });

  it("substitui espaços múltiplos por traço único", () => {
    const id = gerarIdAcessivel("btn", "Salvar  Dados", 1);
    expect(id).toContain("salvar-dados");
  });
});

describe("a11y — REGRAS_A11Y", () => {
  it("contém pelo menos 10 regras", () => {
    expect(REGRAS_A11Y.length).toBeGreaterThanOrEqual(10);
  });

  it("todas as regras têm id, fonte, criterio e nível", () => {
    for (const regra of REGRAS_A11Y) {
      expect(regra.id).toBeTruthy();
      expect(["WCAG2.1", "eMAG3.1"]).toContain(regra.fonte);
      expect(["A", "AA", "AAA"]).toContain(regra.nivel);
    }
  });
});

describe("a11y — regrasObrigatorias", () => {
  it("nível A retorna somente regras A obrigatórias", () => {
    const regras = regrasObrigatorias("A");
    expect(regras.every((r) => r.nivel === "A")).toBe(true);
  });

  it("nível AA inclui regras A e AA", () => {
    const regras = regrasObrigatorias("AA");
    const niveis = new Set(regras.map((r) => r.nivel));
    expect(niveis.has("A")).toBe(true);
    expect(niveis.has("AA")).toBe(true);
  });
});

describe("a11y — verificarComponente", () => {
  it("componente sem aria-label é não conforme", () => {
    const resultado = verificarComponente({ temAriaLabel: false });
    expect(resultado.conforme).toBe(false);
    expect(resultado.violacoes.length).toBeGreaterThan(0);
  });

  it("componente sem foco visível é não conforme", () => {
    const resultado = verificarComponente({ focoVisivelImplementado: false });
    expect(resultado.conforme).toBe(false);
  });

  it("contraste preto/branco retorna AAA — sem violação", () => {
    const resultado = verificarComponente({
      corForeground: "#000000",
      corBackground: "#ffffff",
    });
    expect(resultado.conforme).toBe(true);
    expect(resultado.violacoes).toHaveLength(0);
  });

  it("contraste muito baixo gera violação de contraste", () => {
    const resultado = verificarComponente({
      corForeground: "#cccccc",
      corBackground: "#ffffff",
    });
    expect(resultado.conforme).toBe(false);
    expect(resultado.violacoes.some((v) => v.includes("Contraste"))).toBe(true);
  });

  it("componente totalmente conforme não tem violações", () => {
    const resultado = verificarComponente({
      temAriaLabel: true,
      focoVisivelImplementado: true,
      corForeground: "#1a1a1a",
      corBackground: "#ffffff",
    });
    expect(resultado.conforme).toBe(true);
    expect(resultado.violacoes).toHaveLength(0);
  });
});
