import { describe, expect, it } from "vitest";
import {
  extractEmailDomain,
  isAllowedSelfSignupEmail,
  normalizeEmailAddress,
} from "../services/authDomainService.js";

describe("authDomainService", () => {
  it("normalizes email address casing and whitespace", () => {
    expect(normalizeEmailAddress("  Fulano+teste@IM3Brasil.com.br ")).toBe(
      "fulano+teste@im3brasil.com.br",
    );
  });

  it("extracts the exact domain even when aliasing is used", () => {
    expect(extractEmailDomain("fulano+obra@im3brasil.com.br")).toBe(
      "im3brasil.com.br",
    );
  });

  it("accepts confirmed self-signup candidates from im3brasil.com.br", () => {
    expect(isAllowedSelfSignupEmail("fulano+obra@im3brasil.com.br")).toBe(
      true,
    );
  });

  it("rejects other domains", () => {
    expect(isAllowedSelfSignupEmail("fulano@gmail.com")).toBe(false);
  });
});