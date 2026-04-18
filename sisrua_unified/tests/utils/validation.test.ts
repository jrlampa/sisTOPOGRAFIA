import { describe, it, expect } from "vitest";
import {
  parseAndValidateCoordinates,
  isCoordinateInputSyntaxValid,
  getCoordinateInputFeedback,
  getSearchQueryFeedback,
  shouldAutoSearch,
  validateFilename,
  validateBatchUploadFile,
  getPositiveIntegerFeedback,
  validateDxfExportInputs,
  validateAppSettings,
} from "../../src/utils/validation";

// ---------------------------------------------------------------------------
// parseAndValidateCoordinates
// ---------------------------------------------------------------------------

describe("parseAndValidateCoordinates", () => {
  it("parses valid lat/lng string", () => {
    const result = parseAndValidateCoordinates("-22.9068 -43.1729");
    expect(result).not.toBeNull();
    expect(result!.lat).toBeCloseTo(-22.9068);
    expect(result!.lng).toBeCloseTo(-43.1729);
  });

  it("returns null for empty string", () => {
    expect(parseAndValidateCoordinates("")).toBeNull();
  });

  it("returns null for plain text", () => {
    expect(parseAndValidateCoordinates("Rio de Janeiro")).toBeNull();
  });

  it("returns null for lat out of -90..90 range", () => {
    expect(parseAndValidateCoordinates("95 -43.0")).toBeNull();
  });

  it("returns null for lng out of -180..180 range", () => {
    expect(parseAndValidateCoordinates("-22.9 200.0")).toBeNull();
  });

  it("parses zero coordinates", () => {
    const result = parseAndValidateCoordinates("0 0");
    expect(result).not.toBeNull();
    expect(result!.lat).toBe(0);
    expect(result!.lng).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// isCoordinateInputSyntaxValid
// ---------------------------------------------------------------------------

describe("isCoordinateInputSyntaxValid", () => {
  it("returns true for valid lat/lng", () => {
    expect(isCoordinateInputSyntaxValid("-22.9068 -43.1729")).toBe(true);
  });

  it("returns true for UTM format", () => {
    expect(isCoordinateInputSyntaxValid("23K 635806 7462003")).toBe(true);
  });

  it("returns false for empty string", () => {
    expect(isCoordinateInputSyntaxValid("")).toBe(false);
  });

  it("returns false for plain text address", () => {
    expect(isCoordinateInputSyntaxValid("Rua das Flores")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getCoordinateInputFeedback
// ---------------------------------------------------------------------------

describe("getCoordinateInputFeedback", () => {
  it("returns default state for empty input", () => {
    const result = getCoordinateInputFeedback("");
    expect(result.state).toBe("default");
    expect(result.isValid).toBe(false);
  });

  it("returns success for valid lat/lng coordinates", () => {
    const result = getCoordinateInputFeedback("-22.9068 -43.1729");
    expect(result.state).toBe("success");
    expect(result.isValid).toBe(true);
  });

  it("returns success for valid UTM input", () => {
    const result = getCoordinateInputFeedback("23K 635806 7462003");
    expect(result.state).toBe("success");
    expect(result.isValid).toBe(true);
  });

  it("returns error when lat/lng format matches but values are out of range", () => {
    // Matches the regex but parseAndValidateCoordinates fails → hits the
    // LAT_LNG_INPUT_REGEX branch that returns 'error' with range hint
    const result = getCoordinateInputFeedback("95 200");
    expect(result.state).toBe("error");
    expect(result.isValid).toBe(false);
  });

  it("returns error for completely unrecognized format", () => {
    const result = getCoordinateInputFeedback("Rio de Janeiro");
    expect(result.state).toBe("error");
    expect(result.isValid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getSearchQueryFeedback
// ---------------------------------------------------------------------------

describe("getSearchQueryFeedback", () => {
  it("returns default state for empty query", () => {
    const result = getSearchQueryFeedback("");
    expect(result.state).toBe("default");
    expect(result.isValid).toBe(false);
  });

  it("returns success for coordinate input", () => {
    const result = getSearchQueryFeedback("-22.9068 -43.1729");
    expect(result.state).toBe("success");
    expect(result.isValid).toBe(true);
  });

  it("returns error for query shorter than 3 characters", () => {
    const result = getSearchQueryFeedback("Ri");
    expect(result.state).toBe("error");
    expect(result.isValid).toBe(false);
  });

  it("returns success for query 3+ characters", () => {
    const result = getSearchQueryFeedback("Rio de Janeiro");
    expect(result.state).toBe("success");
    expect(result.isValid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// shouldAutoSearch
// ---------------------------------------------------------------------------

describe("shouldAutoSearch", () => {
  it("returns true for coordinate input", () => {
    expect(shouldAutoSearch("-22.9 -43.1")).toBe(true);
  });

  it("returns true for query with 3+ characters", () => {
    expect(shouldAutoSearch("Rio")).toBe(true);
  });

  it("returns false for short non-coordinate input", () => {
    expect(shouldAutoSearch("Ri")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(shouldAutoSearch("")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateFilename
// ---------------------------------------------------------------------------

describe("validateFilename", () => {
  it("accepts a safe filename", () => {
    expect(validateFilename("relatorio-2025.pdf")).toBe(true);
    expect(validateFilename("arquivo_com_underline.csv")).toBe(true);
  });

  it("rejects filename with path traversal characters", () => {
    expect(validateFilename("../etc/passwd")).toBe(false);
    expect(validateFilename("/absolute/path")).toBe(false);
  });

  it("rejects filename with spaces", () => {
    expect(validateFilename("meu arquivo.txt")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(validateFilename("")).toBe(false);
  });

  it("rejects filename exceeding 255 characters", () => {
    expect(validateFilename("a".repeat(256))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateBatchUploadFile
// ---------------------------------------------------------------------------

describe("validateBatchUploadFile", () => {
  it("returns default state when file is null", () => {
    const result = validateBatchUploadFile(null);
    expect(result.state).toBe("default");
    expect(result.isValid).toBe(false);
  });

  it("returns default state when file is undefined", () => {
    const result = validateBatchUploadFile(undefined);
    expect(result.state).toBe("default");
    expect(result.isValid).toBe(false);
  });

  it("returns error for unsupported extension", () => {
    const result = validateBatchUploadFile({ name: "data.pdf", size: 100 });
    expect(result.state).toBe("error");
    expect(result.isValid).toBe(false);
  });

  it("returns error for empty file (size <= 0)", () => {
    const result = validateBatchUploadFile({ name: "data.csv", size: 0 });
    expect(result.state).toBe("error");
    expect(result.isValid).toBe(false);
  });

  it("returns success for valid CSV file", () => {
    const result = validateBatchUploadFile({ name: "dados.csv", size: 1024 });
    expect(result.state).toBe("success");
    expect(result.isValid).toBe(true);
  });

  it("returns success for valid XLSX file", () => {
    const result = validateBatchUploadFile({
      name: "planilha.xlsx",
      size: 4096,
    });
    expect(result.state).toBe("success");
    expect(result.isValid).toBe(true);
  });

  it("returns success for valid XLSM file", () => {
    const result = validateBatchUploadFile({ name: "macro.xlsm", size: 2048 });
    expect(result.state).toBe("success");
    expect(result.isValid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getPositiveIntegerFeedback
// ---------------------------------------------------------------------------

describe("getPositiveIntegerFeedback", () => {
  it("returns success for positive integer", () => {
    const result = getPositiveIntegerFeedback(5);
    expect(result.state).toBe("success");
    expect(result.isValid).toBe(true);
  });

  it("returns error for zero", () => {
    const result = getPositiveIntegerFeedback(0);
    expect(result.state).toBe("error");
    expect(result.isValid).toBe(false);
  });

  it("returns error for negative integer", () => {
    const result = getPositiveIntegerFeedback(-3);
    expect(result.state).toBe("error");
    expect(result.isValid).toBe(false);
  });

  it("returns error for float", () => {
    const result = getPositiveIntegerFeedback(2.5);
    expect(result.state).toBe("error");
    expect(result.isValid).toBe(false);
  });

  it("uses the provided label in the message", () => {
    const result = getPositiveIntegerFeedback(3, "ramais");
    expect(result.message.toLowerCase()).toContain("ramais");
  });
});

// ---------------------------------------------------------------------------
// validateDxfExportInputs
// ---------------------------------------------------------------------------

describe("validateDxfExportInputs", () => {
  const validCenter = { lat: -22.9, lng: -43.2 };
  const validRadius = 1000;
  const validLayers = { topo: true, bt: false };

  it("returns true for valid circle inputs", () => {
    expect(
      validateDxfExportInputs(
        validCenter,
        validRadius,
        "circle",
        [],
        validLayers,
      ),
    ).toBe(true);
  });

  it("returns true for valid polygon inputs with >= 3 points", () => {
    const polygon = [
      { lat: -22.9, lng: -43.2 },
      { lat: -22.91, lng: -43.2 },
      { lat: -22.91, lng: -43.21 },
    ];
    expect(
      validateDxfExportInputs(
        validCenter,
        validRadius,
        "polygon",
        polygon,
        validLayers,
      ),
    ).toBe(true);
  });

  it("returns false for polygon mode with fewer than 3 points", () => {
    const polygon = [
      { lat: -22.9, lng: -43.2 },
      { lat: -22.91, lng: -43.2 },
    ];
    expect(
      validateDxfExportInputs(
        validCenter,
        validRadius,
        "polygon",
        polygon,
        validLayers,
      ),
    ).toBe(false);
  });

  it("returns false for invalid center (lat out of range)", () => {
    expect(
      validateDxfExportInputs(
        { lat: 200, lng: -43.2 },
        validRadius,
        "circle",
        [],
        validLayers,
      ),
    ).toBe(false);
  });

  it("returns false for invalid radius (below minimum 10)", () => {
    expect(
      validateDxfExportInputs(validCenter, 5, "circle", [], validLayers),
    ).toBe(false);
  });

  it("returns false for invalid radius (above maximum 50000)", () => {
    expect(
      validateDxfExportInputs(validCenter, 99999, "circle", [], validLayers),
    ).toBe(false);
  });

  it("returns false for invalid selectionMode", () => {
    expect(
      validateDxfExportInputs(
        validCenter,
        validRadius,
        "invalid-mode",
        [],
        validLayers,
      ),
    ).toBe(false);
  });

  it("returns false for null center", () => {
    expect(
      validateDxfExportInputs(null, validRadius, "circle", [], validLayers),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateAppSettings
// ---------------------------------------------------------------------------

describe("validateAppSettings", () => {
  it("returns true for minimal valid settings object", () => {
    expect(validateAppSettings({})).toBe(true);
  });

  it("returns true for complete valid settings", () => {
    const settings = {
      enableAI: true,
      simplificationLevel: "medium",
      theme: "light",
      mapProvider: "satellite",
      contourInterval: 10,
      projectType: "ramais",
      btNetworkScenario: "asis",
      btEditorMode: "none",
      btTransformerCalculationMode: "automatic",
      btQtPontoCalculationMethod: "impedance_modulus",
      btCqtPowerFactor: 0.92,
      clandestinoAreaM2: 50,
    };
    expect(validateAppSettings(settings)).toBe(true);
  });

  it("returns false for null", () => {
    expect(validateAppSettings(null)).toBe(false);
  });

  it("returns false when a field has the wrong type", () => {
    expect(validateAppSettings({ enableAI: "yes" })).toBe(false);
  });

  it("returns false when contourInterval is out of range (> 100)", () => {
    expect(validateAppSettings({ contourInterval: 200 })).toBe(false);
  });

  it("returns false when btCqtPowerFactor is > 1", () => {
    expect(validateAppSettings({ btCqtPowerFactor: 1.5 })).toBe(false);
  });

  it("returns false when theme is an unknown value", () => {
    expect(validateAppSettings({ theme: "solarized" })).toBe(false);
  });

  it("returns false for a plain string instead of object", () => {
    expect(validateAppSettings("settings")).toBe(false);
  });
});
