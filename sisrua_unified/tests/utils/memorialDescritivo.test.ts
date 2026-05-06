import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  saveMock,
  setFontMock,
  setFontSizeMock,
  addPageMock,
  textMock,
  splitTextToSizeMock,
  jsPdfCtorMock,
  downloadTextMock,
} = vi.hoisted(() => {
  const saveMock = vi.fn();
  const setFontMock = vi.fn();
  const setFontSizeMock = vi.fn();
  const addPageMock = vi.fn();
  const textMock = vi.fn();
  const splitTextToSizeMock = vi.fn((section: string) => [section]);
  const jsPdfCtorMock = vi.fn(function () {
    return {
      internal: {
        pageSize: {
          getWidth: () => 595,
          getHeight: () => 842,
        },
      },
      setFont: setFontMock,
      setFontSize: setFontSizeMock,
      splitTextToSize: splitTextToSizeMock,
      addPage: addPageMock,
      text: textMock,
      save: saveMock,
    };
  });
  const downloadTextMock = vi.fn();

  return {
    saveMock,
    setFontMock,
    setFontSizeMock,
    addPageMock,
    textMock,
    splitTextToSizeMock,
    jsPdfCtorMock,
    downloadTextMock,
  };
});

vi.mock("jspdf", () => ({
  jsPDF: jsPdfCtorMock,
}));

vi.mock("../../src/utils/downloads", () => ({
  sanitizeFilename: (name: string) => name,
  downloadText: downloadTextMock,
}));

import {
  buildMemorialDescritivo,
  downloadMemorialDescritivo,
} from "../../src/utils/memorialDescritivo";

describe("buildMemorialDescritivo", () => {
  it("inclui seção DG quando dgResults está presente no contexto", () => {
    const content = buildMemorialDescritivo(
      {
        dgResults: {
          selectedKva: 75,
          cqtMax: 0.0312,
          trafoUtilization: 0.82,
          totalCableLength: 450,
          score: 88.5,
          discardedCount: 12,
          scoreComponents: {
            cableCostScore: 70,
            poleCostScore: 85,
            trafoCostScore: 90,
            cqtPenaltyScore: 95,
            overloadPenaltyScore: 100,
          },
        },
      },
      { projectName: "Teste DG" },
    );

    expect(content).toContain("Dimensionamento Automatico (Design Generativo)");
    expect(content).toContain("75,0 kVA");
    expect(content).toContain("3,12%");
    expect(content).toContain("82,0%");
    expect(content).toContain("450 m");
    expect(content).toContain("88,5 / 100");
    expect(content).toContain("12");
    expect(content).toContain("Decomposicao do Score Tecnico");
    // seção BT deve ser renumerada
    expect(content).toContain("## 6. Caracterizacao da Rede BT");
  });

  it("não inclui seção DG quando dgResults ausente", () => {
    const content = buildMemorialDescritivo({}, { projectName: "Sem DG" });

    expect(content).not.toContain("Design Generativo");
    expect(content).toContain("## 5. Caracterizacao da Rede BT");
  });
});

describe("downloadMemorialDescritivo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exports memorial as PDF and returns .pdf filename", () => {
    const result = downloadMemorialDescritivo(
      {
        totalPoles: 10,
        totalTransformers: 1,
        totalEdges: 9,
      },
      {
        projectName: "Projeto Piloto",
        engineerName: "Eng Teste",
      },
    );

    expect(jsPdfCtorMock).toHaveBeenCalledTimes(1);
    expect(setFontMock).toHaveBeenCalledWith("helvetica", "normal");
    expect(setFontSizeMock).toHaveBeenCalledWith(11);
    expect(textMock).toHaveBeenCalled();
    expect(saveMock).toHaveBeenCalledTimes(1);
    expect(downloadTextMock).not.toHaveBeenCalled();
    expect(result).toMatch(/\.pdf$/);
  });

  it("falls back to text download when PDF generation fails", () => {
    saveMock.mockImplementationOnce(() => {
      throw new Error("pdf-failure");
    });

    const result = downloadMemorialDescritivo(
      {
        totalPoles: 3,
      },
      {
        projectName: "Fallback Test",
      },
    );

    expect(downloadTextMock).toHaveBeenCalledTimes(1);
    expect(result).toMatch(/\.txt$/);
  });
});
