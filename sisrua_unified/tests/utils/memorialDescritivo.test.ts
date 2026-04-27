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
  const jsPdfCtorMock = vi.fn(() => ({
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
  }));
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

import { downloadMemorialDescritivo } from "../../src/utils/memorialDescritivo";

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
