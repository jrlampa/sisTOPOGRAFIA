import { describe, it, expect, vi, beforeEach } from "vitest";
import { ReleaseIntegrityService } from "../services/releaseIntegrityService.js";
import fs from "fs";
import crypto from "crypto";

vi.mock("fs", () => ({
  default: {
    readFileSync: vi.fn(),
    existsSync: vi.fn(),
  },
  readFileSync: vi.fn(),
  existsSync: vi.fn(),
}));

describe("ReleaseIntegrityService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock for package.json
    (fs.readFileSync as any).mockImplementation((p: string) => {
      if (p.endsWith("package.json")) {
        return JSON.stringify({ name: "sisrua-unified", version: "0.9.0" });
      }
      if (p.endsWith(".git/HEAD")) {
        return "ref: refs/heads/dev";
      }
      if (p.endsWith(".git/refs/heads/dev")) {
        return "a".repeat(40);
      }
      return "dummy content";
    });
    delete process.env.RELEASE_SIGNING_SECRET;
    delete process.env.GIT_COMMIT;
    delete process.env.GIT_BRANCH;
  });

  describe("generateManifest", () => {
    it("deve gerar um manifesto com versão e pacote corretos", () => {
      const manifest = ReleaseIntegrityService.generateManifest(false);
      expect(manifest.version).toBe("0.9.0");
      expect(manifest.packageName).toBe("sisrua-unified");
      expect(manifest.artifacts.length).toBeGreaterThan(0);
      expect(manifest.signature).toBeNull();
    });

    it("deve assinar o manifesto se solicitado", () => {
      const manifest = ReleaseIntegrityService.generateManifest(true);
      expect(manifest.signature).not.toBeNull();
      expect(typeof manifest.signature).toBe("string");
    });

    it("usa defaults se package.json falhar", () => {
      (fs.readFileSync as any).mockImplementationOnce(() => { throw new Error("read fail"); });
      const manifest = ReleaseIntegrityService.generateManifest(false);
      expect(manifest.version).toBe("0.0.0");
      expect(manifest.packageName).toBe("sisrua-unified");
    });
  });

  describe("signManifest with key logic", () => {
    it("usa segredo da env se tiver tamanho suficiente", () => {
      process.env.RELEASE_SIGNING_SECRET = "1234567890123456"; // 16 chars
      const manifest = ReleaseIntegrityService.generateManifest(true);
      expect(manifest.signature).toBeDefined();
    });

    it("usa fallback se segredo da env for curto", () => {
      process.env.RELEASE_SIGNING_SECRET = "short";
      const manifest = ReleaseIntegrityService.generateManifest(true);
      expect(manifest.signature).toBeDefined();
    });

    it("usa fallback absoluto se fs falhar em tudo", () => {
      (fs.readFileSync as any).mockImplementation(() => { throw new Error(); });
      const manifest = ReleaseIntegrityService.generateManifest(true);
      expect(manifest.signature).toBeDefined();
    });
  });

  describe("verifyManifest", () => {
    it("deve validar um manifesto assinado corretamente", () => {
      const manifest = ReleaseIntegrityService.generateManifest(true);
      const result = ReleaseIntegrityService.verifyManifest(manifest);
      expect(result.valid).toBe(true);
    });

    it("deve invalidar um manifesto sem assinatura", () => {
      const manifest = ReleaseIntegrityService.generateManifest(false);
      const result = ReleaseIntegrityService.verifyManifest(manifest);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("não possui assinatura");
    });

    it("deve invalidar um manifesto com assinatura alterada", () => {
      const manifest = ReleaseIntegrityService.generateManifest(true);
      manifest.signature = "abc"; // Erro de comprimento
      const result = ReleaseIntegrityService.verifyManifest(manifest);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("comprimento inválido");
    });

    it("deve invalidar um manifesto com conteúdo alterado", () => {
      const manifest = ReleaseIntegrityService.generateManifest(true);
      const originalSig = manifest.signature;
      manifest.version = "1.0.0"; // Adulteração
      manifest.signature = originalSig;
      const result = ReleaseIntegrityService.verifyManifest(manifest);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("Assinatura inválida");
    });

    it("lida com erro interno na verificação", () => {
      const manifest = ReleaseIntegrityService.generateManifest(true);
      // Forçar erro no crypto
      vi.spyOn(crypto, "createHmac").mockImplementationOnce(() => { throw new Error("crypto fail"); });
      const result = ReleaseIntegrityService.verifyManifest(manifest);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("Erro interno");
    });
  });

  describe("Git Metadata Reading", () => {
    it("lê commit da env var", () => {
      process.env.GIT_COMMIT = "abcdef123456";
      const prov = ReleaseIntegrityService.getBuildProvenance();
      expect(prov.gitCommit).toBe("abcdef123456");
    });

    it("lê commit direto de HEAD (se não for ref)", () => {
      (fs.readFileSync as any).mockImplementation((p: string) => {
        if (p.endsWith("HEAD")) return "b".repeat(40);
        return "dummy";
      });
      const prov = ReleaseIntegrityService.getBuildProvenance();
      expect(prov.gitCommit).toBe("b".repeat(12));
    });

    it("lê branch da env var", () => {
      process.env.GIT_BRANCH = "feat/feature-x";
      const prov = ReleaseIntegrityService.getBuildProvenance();
      expect(prov.gitBranch).toBe("feat/feature-x");
    });

    it("retorna null para git se fs falhar", () => {
      (fs.readFileSync as any).mockImplementation((p: string) => {
        if (p.includes(".git")) throw new Error();
        if (p.endsWith("package.json")) return "{}";
        return "dummy";
      });
      const prov = ReleaseIntegrityService.getBuildProvenance();
      expect(prov.gitCommit).toBeNull();
      expect(prov.gitBranch).toBeNull();
    });
  });

  describe("getBuildProvenance", () => {
    it("deve retornar informações do ambiente e do build", () => {
      const provenance = ReleaseIntegrityService.getBuildProvenance();
      expect(provenance.version).toBe("0.9.0");
      expect(provenance.nodeVersion).toBe(process.version);
      expect(provenance).toHaveProperty("environment");
    });
  });
});
