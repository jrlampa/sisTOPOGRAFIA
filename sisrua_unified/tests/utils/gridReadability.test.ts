import { describe, it, expect } from "vitest";
import {
  computeGridColumns,
  classificarDensidade,
  alturaLinhaPorDensidade,
  tamFontePorDensidade,
  truncarTexto,
  buildGridConfig,
  gridContainerClasses,
  gridCellClasses,
} from "../../src/utils/gridReadability";

describe("gridReadability — computeGridColumns", () => {
  it("container de 1280px com min 160px → 8 colunas", () => {
    expect(computeGridColumns(1280, 160)).toBe(8);
  });

  it("container de 320px com min 160px → 2 colunas", () => {
    expect(computeGridColumns(320, 160)).toBe(2);
  });

  it("container menor que min retorna 1 coluna", () => {
    expect(computeGridColumns(100, 200)).toBe(1);
  });

  it("respeita maxColunas", () => {
    expect(computeGridColumns(2000, 100, 6)).toBe(6);
  });

  it("container zero retorna 1 coluna", () => {
    expect(computeGridColumns(0, 160)).toBe(1);
  });
});

describe("gridReadability — classificarDensidade", () => {
  it("0 itens → baixa", () => {
    expect(classificarDensidade(0)).toBe("baixa");
  });

  it("50 itens → baixa", () => {
    expect(classificarDensidade(50)).toBe("baixa");
  });

  it("51 itens → media", () => {
    expect(classificarDensidade(51)).toBe("media");
  });

  it("200 itens → media", () => {
    expect(classificarDensidade(200)).toBe("media");
  });

  it("201 itens → alta", () => {
    expect(classificarDensidade(201)).toBe("alta");
  });

  it("500 itens → alta", () => {
    expect(classificarDensidade(500)).toBe("alta");
  });

  it("501 itens → muito_alta", () => {
    expect(classificarDensidade(501)).toBe("muito_alta");
  });
});

describe("gridReadability — alturaLinhaPorDensidade", () => {
  it("baixa → 48px", () => {
    expect(alturaLinhaPorDensidade("baixa")).toBe(48);
  });

  it("media → 40px", () => {
    expect(alturaLinhaPorDensidade("media")).toBe(40);
  });

  it("alta → 32px", () => {
    expect(alturaLinhaPorDensidade("alta")).toBe(32);
  });

  it("muito_alta → 28px", () => {
    expect(alturaLinhaPorDensidade("muito_alta")).toBe(28);
  });
});

describe("gridReadability — tamFontePorDensidade", () => {
  it("baixa → base", () => {
    expect(tamFontePorDensidade("baixa")).toBe("base");
  });

  it("media → sm", () => {
    expect(tamFontePorDensidade("media")).toBe("sm");
  });

  it("alta → xs", () => {
    expect(tamFontePorDensidade("alta")).toBe("xs");
  });

  it("muito_alta → xs", () => {
    expect(tamFontePorDensidade("muito_alta")).toBe("xs");
  });
});

describe("gridReadability — truncarTexto", () => {
  it("texto curto não é truncado", () => {
    const result = truncarTexto("Texto curto", 20);
    expect(result.truncado).toBe(false);
    expect(result.exibicao).toBe("Texto curto");
  });

  it("texto longo é truncado com reticências", () => {
    const result = truncarTexto("Rua das Palmeiras de Cima do Morro", 15);
    expect(result.truncado).toBe(true);
    expect(result.exibicao.endsWith("…")).toBe(true);
    expect(result.exibicao.length).toBe(15);
    expect(result.completo).toBe("Rua das Palmeiras de Cima do Morro");
  });

  it("texto com exatamente maxCaracteres não é truncado", () => {
    const texto = "abcde";
    const result = truncarTexto(texto, 5);
    expect(result.truncado).toBe(false);
  });
});

describe("gridReadability — buildGridConfig", () => {
  it("gera config para dashboard com 10 itens e 1280px de largura", () => {
    const config = buildGridConfig(1280, 10);
    expect(config.densidade).toBe("baixa");
    expect(config.colunas).toBeGreaterThanOrEqual(1);
    expect(config.alturaLinha).toBe(48);
    expect(config.tamanhoFonte).toBe("base");
  });

  it("gera config para 300 itens com largura reduzida", () => {
    const config = buildGridConfig(640, 300);
    expect(config.densidade).toBe("alta");
    expect(config.alturaLinha).toBe(32);
    expect(config.tamanhoFonte).toBe("xs");
  });

  it("densidade muito_alta gera gap e padding mínimos", () => {
    const config = buildGridConfig(1920, 600);
    expect(config.densidade).toBe("muito_alta");
    expect(config.gapPx).toBeLessThanOrEqual(4);
    expect(config.paddingPx).toBeLessThanOrEqual(4);
  });
});

describe("gridReadability — classes CSS", () => {
  it("gridContainerClasses inclui text-base para densidade baixa", () => {
    const config = buildGridConfig(1280, 10);
    const classes = gridContainerClasses(config);
    expect(classes).toContain("text-base");
    expect(classes).toContain("overflow-auto");
  });

  it("gridCellClasses inclui truncate e border-b", () => {
    const config = buildGridConfig(1280, 50);
    const classes = gridCellClasses(config);
    expect(classes).toContain("truncate");
    expect(classes).toContain("border-b");
  });
});
