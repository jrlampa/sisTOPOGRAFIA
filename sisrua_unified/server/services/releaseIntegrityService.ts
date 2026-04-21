/**
 * releaseIntegrityService.ts — Integridade de Release e Proveniência de Build (16 [T1]).
 *
 * Responsabilidades:
 * - Gerar manifesto de release com hashes SHA-256 dos artefatos críticos.
 * - Assinar o manifesto com HMAC-SHA-256 para verificação de integridade.
 * - Verificar assinatura de manifesto recebido.
 * - Prover informações de proveniência do build (versão, env, git commit, node).
 *
 * Política de segurança:
 * - A chave de assinatura vem de RELEASE_SIGNING_SECRET (env var).
 * - Se não configurada, usa segredo derivado do conteúdo do package.json (fallback auditável).
 * - Nenhum segredo externo (ex: tokens de API pagos) é aceito.
 */

import crypto from "crypto";
import fs from "fs";
import path from "path";
import { logger } from "../utils/logger.js";

// ─── Tipos exportados ────────────────────────────────────────────────────────

/** Entrada de artefato no manifesto de release. */
export interface ArtifactEntry {
  name: string;
  /** Caminho relativo à raiz do projeto. */
  relativePath: string;
  sha256: string;
  sizeBytes: number;
}

/** Manifesto de release. */
export interface ReleaseManifest {
  version: string;
  packageName: string;
  buildTime: string;
  /** SHA-256 do conteúdo do package.json para rastreabilidade. */
  packageJsonHash: string;
  artifacts: ArtifactEntry[];
  /** Assinatura HMAC-SHA-256 do conteúdo serializado do manifesto (sem este campo). */
  signature: string | null;
}

/** Informações de proveniência do build. */
export interface BuildProvenance {
  version: string;
  packageName: string;
  buildTime: string;
  nodeVersion: string;
  environment: string;
  platform: string;
  arch: string;
  /** Hash do commit Git HEAD (se disponível via env GIT_COMMIT ou arquivo .git). */
  gitCommit: string | null;
  /** Branch Git (se disponível via GIT_BRANCH env var). */
  gitBranch: string | null;
}

/** Resultado da verificação de integridade. */
export interface IntegrityVerificationResult {
  valid: boolean;
  reason: string;
}

// ─── Configuração e helpers ──────────────────────────────────────────────────

/** Raiz do projeto (dois níveis acima de server/services). */
function resolveProjectRoot(): string {
  // __dirname funciona em CJS (Jest transform) e em ESM via tsconfig paths
  return path.resolve(__dirname, "..", "..");
}

/** Artefatos críticos monitorados por padrão. */
const CRITICAL_ARTIFACTS_RELATIVE = [
  "package.json",
  "VERSION",
  "metadata.json",
];

/**
 * Calcula SHA-256 de um arquivo.
 * Retorna null se o arquivo não existir.
 */
function sha256OfFile(filePath: string): { hash: string; sizeBytes: number } | null {
  try {
    const content = fs.readFileSync(filePath);
    const hash = crypto.createHash("sha256").update(content).digest("hex");
    return { hash, sizeBytes: content.length };
  } catch {
    return null;
  }
}

/**
 * Obtém a chave de assinatura.
 * Prioridade: env RELEASE_SIGNING_SECRET → derivada do package.json local.
 */
function getSigningKey(projectRoot: string): string {
  const envSecret = process.env.RELEASE_SIGNING_SECRET;
  if (envSecret && envSecret.length >= 16) {
    return envSecret;
  }

  // Fallback auditável: SHA-256 do package.json como segredo
  const pkgPath = path.join(projectRoot, "package.json");
  try {
    const content = fs.readFileSync(pkgPath, "utf8");
    return crypto.createHash("sha256").update(content).digest("hex");
  } catch {
    return "sisrua-release-fallback-key";
  }
}

/**
 * Lê o commit Git HEAD do arquivo .git/HEAD.
 * Retorna null se não disponível.
 */
function readGitCommit(projectRoot: string): string | null {
  // Preferência: env var (CI environments)
  if (process.env.GIT_COMMIT) {
    return process.env.GIT_COMMIT.slice(0, 12);
  }

  try {
    const headPath = path.join(projectRoot, ".git", "HEAD");
    const headContent = fs.readFileSync(headPath, "utf8").trim();

    if (headContent.startsWith("ref: ")) {
      const refPath = path.join(projectRoot, ".git", headContent.slice(5));
      const sha = fs.readFileSync(refPath, "utf8").trim();
      return sha.slice(0, 12);
    }
    return headContent.slice(0, 12);
  } catch {
    return null;
  }
}

/**
 * Lê a branch Git atual.
 * Retorna null se não disponível.
 */
function readGitBranch(projectRoot: string): string | null {
  if (process.env.GIT_BRANCH) {
    return process.env.GIT_BRANCH;
  }

  try {
    const headPath = path.join(projectRoot, ".git", "HEAD");
    const headContent = fs.readFileSync(headPath, "utf8").trim();
    if (headContent.startsWith("ref: refs/heads/")) {
      return headContent.slice("ref: refs/heads/".length);
    }
  } catch {
    // sem .git
  }
  return null;
}

// ─── Serviço ──────────────────────────────────────────────────────────────────

export class ReleaseIntegrityService {
  /**
   * Gera o manifesto de release com hashes SHA-256 dos artefatos críticos.
   * @param sign - Se true, assina o manifesto (padrão: true).
   */
  static generateManifest(sign = true): ReleaseManifest {
    const projectRoot = resolveProjectRoot();
    const pkgPath = path.join(projectRoot, "package.json");

    let version = "0.0.0";
    let packageName = "sisrua-unified";
    let packageJsonHash = "";

    try {
      const pkgContent = fs.readFileSync(pkgPath, "utf8");
      packageJsonHash = crypto
        .createHash("sha256")
        .update(pkgContent)
        .digest("hex");
      const pkg = JSON.parse(pkgContent) as { version?: string; name?: string };
      version = pkg.version ?? version;
      packageName = pkg.name ?? packageName;
    } catch (e) {
      logger.warn("[ReleaseIntegrity] Não foi possível ler package.json", {
        error: e,
      });
    }

    const artifacts: ArtifactEntry[] = [];
    for (const relPath of CRITICAL_ARTIFACTS_RELATIVE) {
      const absPath = path.join(projectRoot, relPath);
      const result = sha256OfFile(absPath);
      if (result) {
        artifacts.push({
          name: path.basename(relPath),
          relativePath: relPath,
          sha256: result.hash,
          sizeBytes: result.sizeBytes,
        });
      }
    }

    const manifest: ReleaseManifest = {
      version,
      packageName,
      buildTime: new Date().toISOString(),
      packageJsonHash,
      artifacts,
      signature: null,
    };

    if (sign) {
      manifest.signature = this.signManifest(manifest);
    }

    return manifest;
  }

  /**
   * Assina um manifesto com HMAC-SHA-256.
   * Serializa o manifesto sem o campo 'signature' antes de assinar.
   */
  static signManifest(manifest: Omit<ReleaseManifest, "signature"> & { signature?: string | null }): string {
    const projectRoot = resolveProjectRoot();
    const key = getSigningKey(projectRoot);
    const { signature: _ignored, ...rest } = manifest;
    const payload = JSON.stringify(rest, Object.keys(rest).sort());
    return crypto.createHmac("sha256", key).update(payload).digest("hex");
  }

  /**
   * Verifica a integridade de um manifesto recebido.
   */
  static verifyManifest(
    manifest: ReleaseManifest,
  ): IntegrityVerificationResult {
    if (!manifest.signature) {
      return { valid: false, reason: "Manifesto não possui assinatura." };
    }

    try {
      const expected = this.signManifest(manifest);
      // Comparação constante para prevenir timing attacks
      const expectedBuf = Buffer.from(expected, "hex");
      const receivedBuf = Buffer.from(manifest.signature, "hex");

      if (expectedBuf.length !== receivedBuf.length) {
        return { valid: false, reason: "Assinatura com comprimento inválido." };
      }

      const match = crypto.timingSafeEqual(expectedBuf, receivedBuf);
      return match
        ? { valid: true, reason: "Assinatura verificada com sucesso." }
        : { valid: false, reason: "Assinatura inválida — possível adulteração." };
    } catch (e) {
      logger.error("[ReleaseIntegrity] Erro na verificação de assinatura", {
        error: e,
      });
      return { valid: false, reason: "Erro interno na verificação." };
    }
  }

  /**
   * Retorna informações de proveniência do build atual.
   */
  static getBuildProvenance(): BuildProvenance {
    const projectRoot = resolveProjectRoot();
    const pkgPath = path.join(projectRoot, "package.json");

    let version = "0.0.0";
    let packageName = "sisrua-unified";
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as {
        version?: string;
        name?: string;
      };
      version = pkg.version ?? version;
      packageName = pkg.name ?? packageName;
    } catch {
      // usa defaults
    }

    return {
      version,
      packageName,
      buildTime: new Date().toISOString(),
      nodeVersion: process.version,
      environment: process.env.NODE_ENV ?? "development",
      platform: process.platform,
      arch: process.arch,
      gitCommit: readGitCommit(projectRoot),
      gitBranch: readGitBranch(projectRoot),
    };
  }
}
