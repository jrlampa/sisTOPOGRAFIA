/**
 * Item 16 – Release Integrity
 *
 * Proveniência de build, verificação de integridade de artefatos,
 * geração de manifesto com hashes SHA-256 e assinatura HMAC.
 */

import { createHash, createHmac } from "crypto";
import { createReadStream, statSync } from "fs";
import { readFile } from "fs/promises";
import path from "path";
import { logger } from "../utils/logger.js";

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface BuildProvenance {
  gitCommit: string;
  buildTime: string;
  nodeVersion: string;
  version: string;
  packageHash: string;
}

export interface ArtifactEntry {
  filePath: string;
  sha256: string;
  sizeBytes: number;
}

export interface ArtifactManifest {
  generatedAt: string;
  artifacts: ArtifactEntry[];
  totalFiles: number;
}

export interface SignedManifest extends ArtifactManifest {
  signature: string;
  algorithm: string;
}

// ── Utilitários internos ──────────────────────────────────────────────────────

function hashBuffer(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

async function hashFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);

    stream.on("data", (chunk) =>
      hash.update(chunk as Buffer),
    );
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

async function readPackageJson(): Promise<Record<string, unknown>> {
  try {
    // Sobe dois níveis a partir de server/services/ → raiz do projeto
    const pkgPath = path.resolve(
      path.dirname(new URL(import.meta.url).pathname),
      "../../package.json",
    );
    const raw = await readFile(pkgPath, "utf8");
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

// ── Funções públicas ──────────────────────────────────────────────────────────

/**
 * Retorna metadados de proveniência do build atual.
 * Lê commit, versão e hash do package.json via variáveis de ambiente e fs.
 */
async function getBuildProvenance(): Promise<BuildProvenance> {
  const pkg = await readPackageJson();
  const pkgStr = JSON.stringify(pkg);
  const packageHash = createHash("sha256")
    .update(pkgStr, "utf8")
    .digest("hex");

  return {
    gitCommit:
      process.env.GIT_COMMIT ??
      process.env.GITHUB_SHA ??
      process.env.COMMIT_SHA ??
      "unknown",
    buildTime:
      process.env.BUILD_TIME ??
      process.env.GITHUB_RUN_STARTED_AT ??
      new Date().toISOString(),
    nodeVersion: process.version,
    version: String(pkg.version ?? process.env.APP_VERSION ?? "unknown"),
    packageHash,
  };
}

/**
 * Verifica a integridade de um artefato comparando com o hash SHA-256 esperado.
 * Retorna false se o arquivo não existir ou o hash divergir.
 */
async function verifyArtifactIntegrity(
  filePath: string,
  expectedHash: string,
): Promise<boolean> {
  try {
    const actual = await hashFile(filePath);
    const match = actual === expectedHash.toLowerCase();

    if (!match) {
      logger.warn("Falha na verificação de integridade do artefato", {
        filePath,
        expected: expectedHash,
        actual,
      });
    }

    return match;
  } catch (err) {
    logger.error("Erro ao verificar integridade do artefato", {
      filePath,
      error: err,
    });
    return false;
  }
}

/**
 * Gera um manifesto com hash SHA-256 e tamanho de cada arquivo informado.
 */
async function generateArtifactManifest(
  filePaths: string[],
): Promise<ArtifactManifest> {
  const artifacts: ArtifactEntry[] = [];

  for (const filePath of filePaths) {
    try {
      const sha256 = await hashFile(filePath);
      const { size: sizeBytes } = statSync(filePath);
      artifacts.push({ filePath, sha256, sizeBytes });
    } catch (err) {
      logger.warn("Arquivo ignorado no manifesto (não acessível)", {
        filePath,
        error: err,
      });
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    artifacts,
    totalFiles: artifacts.length,
  };
}

/**
 * Assina um manifesto com HMAC-SHA256 usando a chave em ARTIFACT_SIGNING_KEY.
 * Se a variável não estiver definida, usa uma chave padrão de desenvolvimento
 * e emite aviso de segurança.
 */
function signManifest(manifest: ArtifactManifest): SignedManifest {
  const signingKey = process.env.ARTIFACT_SIGNING_KEY;

  if (!signingKey) {
    logger.warn(
      "ARTIFACT_SIGNING_KEY não definida – usando chave padrão de desenvolvimento. " +
        "Não use em produção.",
    );
  }

  const key = signingKey ?? "dev-only-signing-key";
  const payload = JSON.stringify({
    generatedAt: manifest.generatedAt,
    totalFiles: manifest.totalFiles,
    artifacts: manifest.artifacts.map((a) => ({
      filePath: a.filePath,
      sha256: a.sha256,
    })),
  });

  const signature = createHmac("sha256", key)
    .update(payload, "utf8")
    .digest("hex");

  return {
    ...manifest,
    signature,
    algorithm: "hmac-sha256",
  };
}

/**
 * Verifica a assinatura de um manifesto já assinado.
 */
function verifyManifestSignature(manifest: SignedManifest): boolean {
  const { signature, algorithm: _alg, ...base } = manifest;
  const unsigned = base as ArtifactManifest;
  const resigned = signManifest(unsigned);
  return resigned.signature === signature;
}

/**
 * Calcula o hash SHA-256 de um buffer ou string.
 */
function hashContent(content: string | Buffer): string {
  const input =
    typeof content === "string" ? Buffer.from(content, "utf8") : content;
  return hashBuffer(input);
}

// ── Exportação do serviço ─────────────────────────────────────────────────────

export const releaseIntegrityService = {
  getBuildProvenance,
  verifyArtifactIntegrity,
  generateArtifactManifest,
  signManifest,
  verifyManifestSignature,
  hashContent,
} as const;
