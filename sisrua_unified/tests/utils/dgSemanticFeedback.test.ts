import { describe, it, expect } from "vitest";
import {
  getSemanticFeedbackForConstraint,
  getSemanticErrorForException,
} from "../../src/utils/dgSemanticFeedback";

// ---------------------------------------------------------------------------
// getSemanticFeedbackForConstraint
// ---------------------------------------------------------------------------

describe("getSemanticFeedbackForConstraint", () => {
  it("returns span exceeded message for MAX_SPAN_EXCEEDED", () => {
    const msg = getSemanticFeedbackForConstraint("MAX_SPAN_EXCEEDED");
    expect(msg).toContain("Vão máximo excedido");
  });

  it("returns exclusion zone message for INSIDE_EXCLUSION_ZONE", () => {
    const msg = getSemanticFeedbackForConstraint("INSIDE_EXCLUSION_ZONE");
    expect(msg).toContain("zona de exclusão");
  });

  it("returns road corridor message for OUTSIDE_ROAD_CORRIDOR", () => {
    const msg = getSemanticFeedbackForConstraint("OUTSIDE_ROAD_CORRIDOR");
    expect(msg).toContain("corredor da via");
  });

  it("returns CQT message for CQT_LIMIT_EXCEEDED", () => {
    const msg = getSemanticFeedbackForConstraint("CQT_LIMIT_EXCEEDED");
    expect(msg).toContain("Queda de tensão");
  });

  it("returns transformer overload message for TRAFO_OVERLOAD", () => {
    const msg = getSemanticFeedbackForConstraint("TRAFO_OVERLOAD");
    expect(msg).toContain("Sobrecarga no transformador");
  });

  it("returns non-radial topology message for NON_RADIAL_TOPOLOGY", () => {
    const msg = getSemanticFeedbackForConstraint("NON_RADIAL_TOPOLOGY");
    expect(msg).toContain("Loop detectado");
  });

  it("returns generic optimization error for HTTP 400 code string", () => {
    const msg = getSemanticFeedbackForConstraint("HTTP 400 Bad Request");
    expect(msg).toContain("otimizar");
  });

  it("returns generic optimization error when code contains 'excedido'", () => {
    const msg = getSemanticFeedbackForConstraint("limite excedido");
    expect(msg).toContain("otimizar");
  });

  it("returns a fallback message for completely unknown codes", () => {
    const msg = getSemanticFeedbackForConstraint("UNKNOWN_CODE_XYZ");
    expect(msg).toContain("UNKNOWN_CODE_XYZ");
  });
});

// ---------------------------------------------------------------------------
// getSemanticErrorForException
// ---------------------------------------------------------------------------

describe("getSemanticErrorForException", () => {
  it("returns CQT-related message when error contains CQT", () => {
    const msg = getSemanticErrorForException("CQT limit exceeded");
    expect(msg).toContain("Queda de Tensão");
  });

  it("is case-insensitive for CQT check", () => {
    const msg = getSemanticErrorForException("cqt error occurred");
    expect(msg).toContain("Queda de Tensão");
  });

  it("returns transformer overload message when error contains TRAFO", () => {
    const msg = getSemanticErrorForException("TRAFO capacity exceeded");
    expect(msg).toContain("transformador");
  });

  it("returns transformer overload message when error contains OVERLOAD", () => {
    const msg = getSemanticErrorForException("network OVERLOAD detected");
    expect(msg).toContain("transformador");
  });

  it("returns span message when error contains SPAN", () => {
    const msg = getSemanticErrorForException("SPAN too large");
    expect(msg).toContain("Distância muito grande");
  });

  it("returns span message when error contains VÃO", () => {
    const msg = getSemanticErrorForException("VÃO excedido no trecho");
    expect(msg).toContain("Distância muito grande");
  });

  it("returns network error message for HTTP 5xx", () => {
    const msg = getSemanticErrorForException("HTTP 500 Internal Server Error");
    expect(msg).toContain("Falha de conexão");
  });

  it("returns network error message for NETWORK keyword", () => {
    const msg = getSemanticErrorForException("NETWORK timeout");
    expect(msg).toContain("Falha de conexão");
  });

  it("returns a generic technical message for unknown errors", () => {
    const msg = getSemanticErrorForException("some unknown issue");
    expect(msg).toContain("Erro Técnico");
    expect(msg).toContain("some unknown issue");
  });
});
