/**
 * Item 50 – Artifact Hardening
 *
 * Sanitização e validação de artefatos:
 *  - Proteção contra path traversal
 *  - Sanitização de conteúdo DXF (remoção de injeções e macros)
 *  - Verificação de ameaças em arquivos
 *  - Validação de tamanho
 */

import path from "path";
import { statSync } from "fs";
import { readFile } from "fs/promises";
import { logger } from "../utils/logger.js";

// ── Constantes de segurança ───────────────────────────────────────────────────

/** Tamanho máximo de arquivo de artefato: 100 MB */
const MAX_ARTIFACT_SIZE_BYTES = 100 * 1024 * 1024;

/** Grupos DXF permitidos (whitelist) – grupos fora desta lista são removidos se sensíveis */
const DXF_GROUP_WHITELIST = new Set([
  "HEADER",
  "CLASSES",
  "TABLES",
  "BLOCKS",
  "ENTITIES",
  "OBJECTS",
  "THUMBNAILIMAGE",
  "EOF",
]);

/** Padrões DXF considerados sensíveis/perigosos */
const DXF_DANGEROUS_GROUP_PATTERNS = [
  /ACAD_REACTORS/gi,
  /ACAD_XDICTIONARY/gi,
  /ACAD_PROXY_ENTITY/gi,
  /APPID(?!\s*\*)/gi, // APPID fora de tabelas padrão
  /MLEADERSTYLE/gi,
  /PLOTSETTINGS/gi,
];

/** Padrões de injeção de script em arquivos DXF */
const DXF_SCRIPT_INJECTION_PATTERNS = [
  /<script[\s\S]*?>/gi,
  /javascript:/gi,
  /vbscript:/gi,
  /on\w+\s*=/gi, // onload=, onclick=, etc.
  /eval\s*\(/gi,
  /expression\s*\(/gi,
  /\bexec\b/gi,
  /cmd\.exe/gi,
  /powershell/gi,
  /\bAutoLISP\b/gi,
  /\(command\s/gi, // Chamadas AutoLISP command
];

/** Padrões de ameaça genérica em artefatos binários/texto */
const GENERIC_THREAT_PATTERNS: Array<{ pattern: RegExp; threat: string }> = [
  { pattern: /\.\.[\\/]/g, threat: "path-traversal-content" },
  { pattern: /<\?php/gi, threat: "php-injection" },
  { pattern: /\$\{.*\}/g, threat: "template-injection" },
  { pattern: /EICAR-STANDARD-ANTIVIRUS-TEST-FILE/g, threat: "eicar-test" },
];

// ── Sanitização de filename ────────────────────────────────────────────────────

/**
 * Retorna um nome de arquivo seguro, removendo caracteres perigosos.
 * Preserva extensão e limita comprimento.
 */
function sanitizeFilename(filename: string): string {
  // Remove path separators e caracteres de controle
  let safe = path.basename(filename);

  // Permite apenas: letras, números, hífens, underscores, pontos
  safe = safe.replace(/[^\w\-_.]/g, "_");

  // Remove pontos consecutivos (evita extensões duplas como .php.dxf)
  safe = safe.replace(/\.{2,}/g, ".");

  // Limita a 200 caracteres
  if (safe.length > 200) {
    const ext = path.extname(safe);
    const base = safe.slice(0, 200 - ext.length);
    safe = `${base}${ext}`;
  }

  // Garante que não começa com ponto (arquivo oculto no Linux)
  if (safe.startsWith(".")) {
    safe = `_${safe}`;
  }

  return safe || "arquivo_sem_nome";
}

// ── Proteção contra path traversal ────────────────────────────────────────────

/**
 * Valida se um caminho de arquivo está dentro do diretório base esperado.
 * Lança erro se path traversal for detectado.
 */
function validateArtifactPath(
  filePath: string,
  baseDir?: string,
): { valid: boolean; reason?: string } {
  const resolved = path.resolve(filePath);
  const base = baseDir ? path.resolve(baseDir) : process.cwd();

  // Verifica se o caminho resolvido começa com o diretório base
  if (!resolved.startsWith(base + path.sep) && resolved !== base) {
    logger.warn("Path traversal detectado", {
      filePath,
      resolved,
      base,
    });
    return {
      valid: false,
      reason: `Path traversal: "${filePath}" está fora do diretório permitido`,
    };
  }

  // Verifica segmentos suspeitos no caminho original
  const segments = filePath.split(/[\\/]/);
  for (const seg of segments) {
    if (seg === ".." || seg === ".") {
      if (seg === "..") {
        return {
          valid: false,
          reason: `Segmento ".." detectado no caminho: "${filePath}"`,
        };
      }
    }
  }

  return { valid: true };
}

// ── Sanitização DXF ────────────────────────────────────────────────────────────

/**
 * Sanitiza o conteúdo de um arquivo DXF:
 * 1. Remove padrões de injeção de script
 * 2. Remove grupos sensíveis não permitidos (ACAD_REACTORS, ACAD_XDICTIONARY, etc.)
 * 3. Preserva a estrutura válida do arquivo
 */
function sanitizeDxfContent(content: string): string {
  let sanitized = content;

  // Remove padrões de script injection
  for (const pattern of DXF_SCRIPT_INJECTION_PATTERNS) {
    sanitized = sanitized.replace(pattern, "");
  }

  // Remove grupos DXF perigosos – seção completa delimitada por nome do grupo
  for (const pattern of DXF_DANGEROUS_GROUP_PATTERNS) {
    // Remove a linha contendo o grupo perigoso e a linha de valor subsequente
    sanitized = sanitized.replace(
      new RegExp(`^\\s*\\d+\\s*\\r?\\n\\s*${pattern.source}\\s*\\r?\\n`, "gim"),
      "",
    );
  }

  // Remove null bytes e caracteres de controle perigosos (exceto \n, \r, \t)
  // eslint-disable-next-line no-control-regex
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  return sanitized;
}

// ── Varredura de ameaças ───────────────────────────────────────────────────────

/**
 * Examina um arquivo em busca de ameaças conhecidas.
 * Verifica tamanho, padrões de conteúdo e integridade básica.
 */
async function scanArtifactForThreats(
  filePath: string,
): Promise<{ safe: boolean; threats: string[] }> {
  const threats: string[] = [];

  // Valida caminho
  const pathCheck = validateArtifactPath(filePath);
  if (!pathCheck.valid) {
    threats.push(`path-traversal: ${pathCheck.reason}`);
    return { safe: false, threats };
  }

  // Verifica se arquivo existe e obtém tamanho
  try {
    const stat = statSync(filePath);

    if (stat.size > MAX_ARTIFACT_SIZE_BYTES) {
      threats.push(
        `file-too-large: ${stat.size} bytes excede o limite de ${MAX_ARTIFACT_SIZE_BYTES} bytes`,
      );
    }

    if (stat.size === 0) {
      threats.push("file-empty: arquivo de tamanho zero");
    }
  } catch (err) {
    threats.push(`file-not-accessible: ${String(err)}`);
    return { safe: false, threats };
  }

  // Lê conteúdo para análise (limita a 10 MB para evitar OOM)
  let content: string;
  try {
    const buf = await readFile(filePath);
    const preview = buf.slice(0, 10 * 1024 * 1024);
    content = preview.toString("utf8");
  } catch (err) {
    threats.push(`read-error: ${String(err)}`);
    return { safe: threats.length === 0, threats };
  }

  // Verifica padrões de ameaça genérica
  for (const { pattern, threat } of GENERIC_THREAT_PATTERNS) {
    if (pattern.test(content)) {
      threats.push(threat);
    }
  }

  // Verifica injeções DXF se for arquivo DXF
  if (filePath.toLowerCase().endsWith(".dxf")) {
    for (const pattern of DXF_SCRIPT_INJECTION_PATTERNS) {
      if (pattern.test(content)) {
        threats.push(`dxf-script-injection: padrão "${pattern.source}"`);
      }
    }

    for (const pattern of DXF_DANGEROUS_GROUP_PATTERNS) {
      if (pattern.test(content)) {
        threats.push(`dxf-dangerous-group: "${pattern.source}"`);
      }
    }
  }

  if (threats.length > 0) {
    logger.warn("Ameaças detectadas em artefato", { filePath, threats });
  }

  return { safe: threats.length === 0, threats };
}

// ── Exportação do serviço ─────────────────────────────────────────────────────

export const artifactHardeningService = {
  sanitizeFilename,
  validateArtifactPath,
  sanitizeDxfContent,
  scanArtifactForThreats,
} as const;
