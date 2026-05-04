import { beforeEach, describe, expect, it } from "vitest";
import {
  EnterpriseReadinessService,
  resetEnterpriseReadinessChecklist,
} from "../services/enterpriseReadinessService";

describe("EnterpriseReadinessService", () => {
  beforeEach(() => {
    resetEnterpriseReadinessChecklist();
    delete process.env.DEPLOYMENT_MODE;
    delete process.env.OFFLINE_MODE;
    delete process.env.ALLOW_EXTERNAL_APIS;
    delete process.env.ANTIVIRUS_PROFILE;
    delete process.env.ANTIVIRUS_EXCLUSIONS_OK;
    delete process.env.HTTP_PROXY;
    delete process.env.HTTPS_PROXY;
    delete process.env.NO_PROXY;
    delete process.env.NODE_EXTRA_CA_CERTS;
    delete process.env.JWT_SECRET;
    process.env.NODE_ENV = "test";
  });

  it("retorna checks de hardening incluindo rede restritiva e antivirus", async () => {
    process.env.DEPLOYMENT_MODE = "on_premise";
    process.env.OFFLINE_MODE = "true";
    process.env.ANTIVIRUS_PROFILE = "crowdstrike";
    process.env.JWT_SECRET = "x".repeat(32);

    const checks = await EnterpriseReadinessService.runHardeningChecks();
    const ids = checks.map((c) => c.id);

    expect(ids).toContain("hrd-dns-001");
    expect(ids).toContain("hrd-av-001");
    expect(checks.find((c) => c.id === "hrd-dns-001")?.status).toBe("ok");
    expect(checks.find((c) => c.id === "hrd-av-001")?.status).toBe("ok");
  });

  it("sinaliza avisos quando modo restritivo e AV não estão declarados", async () => {
    process.env.ALLOW_EXTERNAL_APIS = "true";
    process.env.JWT_SECRET = "curto";

    const checks = await EnterpriseReadinessService.runHardeningChecks();

    expect(checks.find((c) => c.id === "hrd-dns-001")?.status).toBe("aviso");
    expect(checks.find((c) => c.id === "hrd-av-001")?.status).toBe("aviso");
    expect(checks.find((c) => c.id === "hrd-cert-001")?.status).toBe("falha");
  });

  it("filtra checklist por area e calcula progresso com required pendente", () => {
    const rede = EnterpriseReadinessService.getOnboardingChecklist("rede");
    expect(rede.length).toBeGreaterThan(0);
    expect(rede.every((item) => item.area === "rede")).toBe(true);

    const progress = EnterpriseReadinessService.getOnboardingProgress();
    expect(progress.total).toBeGreaterThan(0);
    expect(progress.readyForProduction).toBe(false);
    expect(progress.pendingRequired.length).toBeGreaterThan(0);
  });

  it("marca item do checklist e permite reset para baseline", () => {
    const updated = EnterpriseReadinessService.markChecklistItem(
      "net-001",
      true,
      "ok",
    );
    expect(updated.verified).toBe(true);

    resetEnterpriseReadinessChecklist();
    const afterReset = EnterpriseReadinessService.getOnboardingChecklist()
      .find((item) => item.id === "net-001");

    expect(afterReset?.verified).toBe(false);
    expect(afterReset?.verificationNote).toBeNull();
  });

  it("lança erro para item inexistente no checklist", () => {
    expect(() =>
      EnterpriseReadinessService.markChecklistItem("nao-existe", true),
    ).toThrow("não encontrado");
  });

  it("detecta modo explicitamente e por inferencia", () => {
    process.env.DEPLOYMENT_MODE = "hibrido";
    const explicit = EnterpriseReadinessService.detectDeploymentMode();
    expect(explicit.detectedMode).toBe("hibrido");
    expect(explicit.confidence).toBe("alta");

    delete process.env.DEPLOYMENT_MODE;
    process.env.SUPABASE_URL = "https://x.supabase.io";
    process.env.GOOGLE_CLOUD_PROJECT = "corp-prd";

    const inferred = EnterpriseReadinessService.detectDeploymentMode();
    expect(inferred.detectedMode).toBe("cloud");
    expect(["media", "alta"]).toContain(inferred.confidence);
  });
});
