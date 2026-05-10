/**
 * corporateHardeningService.test.ts — Testes do serviço de Hardening Corporativo (121 [T1])
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { runCorporateHardeningChecks } from "../services/corporateHardeningService.js";

describe("corporateHardeningService", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("gera relatório yellow em ambiente limpo (sem variáveis específicas corporativas)", () => {
    // Limpa variáveis que podem afetar o teste
    delete process.env.HTTP_PROXY;
    delete process.env.HTTPS_PROXY;
    delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    delete process.env.NODE_TLS_MIN_VERSION;
    delete process.env.HELMET_ENABLED;
    delete process.env.NODE_EXTRA_CA_CERTS;
    delete process.env.HTTP_TIMEOUT_MS;

    const report = runCorporateHardeningChecks();
    // É yellow porque NODE_EXTRA_CA_CERTS ausente gera warning por padrão
    expect(report.overallStatus).toBe("yellow");
    expect(report.summary.warn).toBeGreaterThan(0);
  });

  it("gera relatório green quando CA corporativa está configurada", () => {
    delete process.env.HTTP_PROXY;
    delete process.env.HTTPS_PROXY;
    process.env.NODE_EXTRA_CA_CERTS = "/path/to/cert.pem";

    const report = runCorporateHardeningChecks();
    expect(report.overallStatus).toBe("green");
    expect(report.score).toBe(100);
  });

  it("detecta proxy com autenticação e gera status yellow", () => {
    process.env.HTTPS_PROXY = "http://user:pass@proxy.corp:8080";
    
    const report = runCorporateHardeningChecks();
    const proxyCheck = report.checks.find(c => c.id === "proxy-001");
    
    expect(proxyCheck?.status).toBe("warn");
    expect(report.overallStatus).toBe("yellow");
    expect(report.score).toBeLessThan(100);
  });

  it("detecta TLS min version insegura e gera status red", () => {
    process.env.NODE_TLS_MIN_VERSION = "TLSv1";
    
    const report = runCorporateHardeningChecks();
    const tlsCheck = report.checks.find(c => c.id === "tls-001");
    
    expect(tlsCheck?.status).toBe("fail");
    expect(report.overallStatus).toBe("red");
  });

  it("detecta NODE_TLS_REJECT_UNAUTHORIZED=0 como falha crítica", () => {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    
    const report = runCorporateHardeningChecks();
    const tlsCheck = report.checks.find(c => c.id === "tls-002");
    
    expect(tlsCheck?.status).toBe("fail");
    expect(report.overallStatus).toBe("red");
  });

  it("detecta variáveis de antivírus/DLP e gera alerta", () => {
    process.env.ZSCALER_PROXY = "1";
    
    const report = runCorporateHardeningChecks();
    const avCheck = report.checks.find(c => c.id === "av-001");
    
    expect(avCheck?.status).toBe("warn");
  });

  it("valida se helmet desativado gera falha", () => {
    process.env.HELMET_ENABLED = "false";
    
    const report = runCorporateHardeningChecks();
    const hdrCheck = report.checks.find(c => c.id === "hdr-001");
    
    expect(hdrCheck?.status).toBe("fail");
  });

  it("valida timeout de rede insuficiente", () => {
    process.env.HTTP_TIMEOUT_MS = "1000"; // Abaixo do threshold de 5000
    
    const report = runCorporateHardeningChecks();
    const netCheck = report.checks.find(c => c.id === "net-001");
    
    expect(netCheck?.status).toBe("warn");
  });

  it("valida path de sucesso para TLS Reject Unauthorized", () => {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "1";
    const report = runCorporateHardeningChecks();
    const check = report.checks.find(c => c.id === "tls-002");
    expect(check?.status).toBe("pass");
  });

  it("valida detecção de NODE_OPTIONS com flag tls-min", () => {
    process.env.NODE_OPTIONS = "--tls-min-v1.2";
    const report = runCorporateHardeningChecks();
    const check = report.checks.find(c => c.id === "tls-001");
    expect(check?.detail).toContain("Flag --tls-min-v1.2 detectada");
  });

  it("valida score zero em caso de muitas falhas", () => {
    process.env.HELMET_ENABLED = "false";
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    process.env.NODE_TLS_MIN_VERSION = "TLSv1";
    process.env.HTTP_PROXY = "http://user:pass@proxy"; // warn
    process.env.ZSCALER_PROXY = "1"; // warn
    process.env.HTTP_TIMEOUT_MS = "100"; // warn
    
    const report = runCorporateHardeningChecks();
    // 3 fails * 20 = 60
    // 3 warns * 5 = 15
    // score = 100 - 75 = 25
    expect(report.score).toBeLessThanOrEqual(25);
    expect(report.overallStatus).toBe("red");
  });
});
