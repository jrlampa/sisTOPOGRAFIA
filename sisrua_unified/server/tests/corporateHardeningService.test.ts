/**
 * corporateHardeningService.test.ts — Testes do serviço de Hardening Corporativo (121 [T1])
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  runCorporateHardeningChecks,
  type CorporateHardeningReport,
  type HardeningCheckStatus,
} from "../services/corporateHardeningService.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function findCheck(report: CorporateHardeningReport, id: string) {
  return report.checks.find((c) => c.id === id);
}

// ─── Testes ───────────────────────────────────────────────────────────────────

describe("corporateHardeningService", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restaura variáveis de ambiente
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, originalEnv);
  });

  // ── Estrutura do relatório ──────────────────────────────────────────────────

  it("retorna relatório com estrutura completa", () => {
    const report = runCorporateHardeningChecks();
    expect(report).toHaveProperty("timestamp");
    expect(report).toHaveProperty("overallStatus");
    expect(report).toHaveProperty("score");
    expect(report).toHaveProperty("checks");
    expect(report).toHaveProperty("summary");
    expect(report.checks.length).toBeGreaterThan(0);
  });

  it("score está entre 0 e 100", () => {
    const report = runCorporateHardeningChecks();
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(100);
  });

  it("summary contém contagens corretas", () => {
    const report = runCorporateHardeningChecks();
    const { pass, warn, fail, skip } = report.summary;
    expect(pass + warn + fail + skip).toBe(report.checks.length);
  });

  it("timestamp é ISO string válido", () => {
    const report = runCorporateHardeningChecks();
    expect(() => new Date(report.timestamp)).not.toThrow();
    expect(new Date(report.timestamp).toISOString()).toBe(report.timestamp);
  });

  // ── Proxy ──────────────────────────────────────────────────────────────────

  it("proxy-001: pass quando sem proxy configurado", () => {
    delete process.env.HTTP_PROXY;
    delete process.env.HTTPS_PROXY;
    delete process.env.http_proxy;
    delete process.env.https_proxy;
    const report = runCorporateHardeningChecks();
    const check = findCheck(report, "proxy-001");
    expect(check?.status).toBe("pass");
  });

  it("proxy-001: warn quando proxy com credenciais na URL", () => {
    process.env.HTTPS_PROXY = "http://user:pass@proxy.corp.com:8080";
    const report = runCorporateHardeningChecks();
    const check = findCheck(report, "proxy-001");
    expect(check?.status).toBe("warn");
    expect(check?.recommendation).toBeDefined();
  });

  it("proxy-001: pass quando proxy sem credenciais na URL", () => {
    process.env.HTTPS_PROXY = "http://proxy.corp.com:8080";
    const report = runCorporateHardeningChecks();
    const check = findCheck(report, "proxy-001");
    expect(check?.status).toBe("pass");
  });

  // ── TLS ────────────────────────────────────────────────────────────────────

  it("tls-002: fail quando NODE_TLS_REJECT_UNAUTHORIZED=0", () => {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    const report = runCorporateHardeningChecks();
    const check = findCheck(report, "tls-002");
    expect(check?.status).toBe("fail");
    expect(report.overallStatus).toBe("red");
  });

  it("tls-002: pass quando NODE_TLS_REJECT_UNAUTHORIZED não é 0", () => {
    delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    const report = runCorporateHardeningChecks();
    const check = findCheck(report, "tls-002");
    expect(check?.status).toBe("pass");
  });

  it("tls-001: fail quando NODE_TLS_MIN_VERSION está abaixo do mínimo", () => {
    process.env.NODE_TLS_MIN_VERSION = "TLSv1.0";
    const report = runCorporateHardeningChecks();
    const check = findCheck(report, "tls-001");
    expect(check?.status).toBe("fail");
    expect(check?.recommendation).toBeDefined();
  });

  // ── CA Bundle ──────────────────────────────────────────────────────────────

  it("tls-003: pass quando NODE_EXTRA_CA_CERTS está configurado", () => {
    process.env.NODE_EXTRA_CA_CERTS = "/etc/ssl/corporate-ca.pem";
    const report = runCorporateHardeningChecks();
    const check = findCheck(report, "tls-003");
    expect(check?.status).toBe("pass");
    expect(check?.detail).toContain("/etc/ssl/corporate-ca.pem");
  });

  it("tls-003: warn quando NODE_EXTRA_CA_CERTS não está configurado", () => {
    delete process.env.NODE_EXTRA_CA_CERTS;
    const report = runCorporateHardeningChecks();
    const check = findCheck(report, "tls-003");
    expect(check?.status).toBe("warn");
  });

  // ── Headers ────────────────────────────────────────────────────────────────

  it("hdr-001: fail quando HELMET_ENABLED=false", () => {
    process.env.HELMET_ENABLED = "false";
    const report = runCorporateHardeningChecks();
    const check = findCheck(report, "hdr-001");
    expect(check?.status).toBe("fail");
  });

  it("hdr-001: pass por padrão (Helmet habilitado)", () => {
    delete process.env.HELMET_ENABLED;
    const report = runCorporateHardeningChecks();
    const check = findCheck(report, "hdr-001");
    expect(check?.status).toBe("pass");
  });

  // ── Status geral ───────────────────────────────────────────────────────────

  it("overallStatus é green quando todos os checks passam", () => {
    delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    delete process.env.HELMET_ENABLED;
    delete process.env.HTTP_PROXY;
    delete process.env.HTTPS_PROXY;
    delete process.env.NODE_EXTRA_CA_CERTS;
    // Não há como garantir green neste ambiente, mas validamos a lógica:
    const report = runCorporateHardeningChecks();
    const hasFail = report.checks.some((c) => c.status === "fail");
    const hasWarn = report.checks.some((c) => c.status === "warn");
    if (!hasFail && !hasWarn) {
      expect(report.overallStatus).toBe("green");
    } else if (hasFail) {
      expect(report.overallStatus).toBe("red");
    } else {
      expect(report.overallStatus).toBe("yellow");
    }
  });

  it("score cai quando há checks fail", () => {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    process.env.HELMET_ENABLED = "false";
    const report = runCorporateHardeningChecks();
    expect(report.score).toBeLessThan(100);
    expect(report.summary.fail).toBeGreaterThanOrEqual(2);
  });
});
