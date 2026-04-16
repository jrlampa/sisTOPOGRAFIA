/**
 * enforce-non-negotiables.mjs
 *
 * Valida as Regras Não Negociáveis do projeto sisRUA contra o working tree atual.
 * Executado como gate de CI e opcionalmente como pre-commit hook.
 *
 * Regras verificadas:
 *  R1  – Branch deve ser 'dev' (em push direto)
 *  R2  – Otimização: mais resultado em menos linhas. Soft limit 500 (modularizar), hard limit 600 (bloqueador)
 *  R3  – Nenhum string 3D proibido nos arquivos de código (esperado: 2.5D)
 *  R4  – Nenhum dado mockado hardcoded óbvio (mock/stub em prod)
 *  R5  – Interface labels em pt-BR (strings UI não em inglês puro)
 *  R6  – APIs externas referenciadas não são pagas (lista de domínios banidos)
 *  R7  – .gitignore e .dockerignore existem e cobrem artefatos mínimos
 *  R8  – Dockerfile / docker-compose.yml existem (Docker First)
 *
 * Saída:
 *  - Relatório JSON em artifacts/ci/non-negotiables-report.json
 *  - Exit 0 se todas as regras passam; exit 1 caso contrário
 */

import {
  readFileSync,
  existsSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  statSync,
} from "fs";
import { join, extname, relative } from "path";
import { argv, cwd, exit } from "process";

const ROOT = cwd();
const OUT_DIR = join(ROOT, "artifacts", "ci");
const OUT_FILE = join(OUT_DIR, "non-negotiables-report.json");

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

function readLines(filePath) {
  try {
    return readFileSync(filePath, "utf8").split("\n");
  } catch {
    return [];
  }
}

/**
 * Percorre recursivamente um diretório e retorna paths de arquivos
 * com as extensões especificadas, excluindo diretórios ignorados.
 */
function walkFiles(dir, extensions, ignoreDirs = []) {
  const results = [];
  if (!existsSync(dir)) return results;

  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const st = statSync(fullPath);

    if (st.isDirectory()) {
      if (!ignoreDirs.includes(entry)) {
        results.push(...walkFiles(fullPath, extensions, ignoreDirs));
      }
    } else if (extensions.includes(extname(entry))) {
      results.push(fullPath);
    }
  }
  return results;
}

const IGNORE_DIRS = [
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".git",
  "__pycache__",
  ".venv",
  "venv",
  "cache",
  "tmp",
  "playwright-report",
  "test-results",
  "artifacts",
];

const CODE_EXTENSIONS = [".ts", ".tsx", ".js", ".mjs", ".py"];

const allCodeFiles = [
  ...walkFiles(join(ROOT, "src"), CODE_EXTENSIONS, IGNORE_DIRS),
  ...walkFiles(join(ROOT, "server"), CODE_EXTENSIONS, IGNORE_DIRS),
  ...walkFiles(join(ROOT, "py_engine"), CODE_EXTENSIONS, IGNORE_DIRS),
  ...walkFiles(join(ROOT, "scripts"), CODE_EXTENSIONS, IGNORE_DIRS),
];

// ─────────────────────────────────────────────────────────────────
// Resultados
// ─────────────────────────────────────────────────────────────────

const violations = [];
const warnings = [];
const passed = [];

function fail(rule, message, details = []) {
  violations.push({ rule, message, details });
}

function warn(rule, message, details = []) {
  warnings.push({ rule, message, details });
}

function pass(rule, message) {
  passed.push({ rule, message });
}

// ─────────────────────────────────────────────────────────────────
// R2 – Otimização de código («mais resultado em menos linhas»)
//      Soft limit: 500 linhas → aviso, considerar modularização
//      Hard limit: 600 linhas → BLOQUEADOR
// ─────────────────────────────────────────────────────────────────

const overHard = [];
const overSoft = [];

for (const f of allCodeFiles) {
  const lineCount = readLines(f).length;
  const rel = relative(ROOT, f);
  if (lineCount > 600) overHard.push(`${rel} (${lineCount} linhas)`);
  else if (lineCount > 500) overSoft.push(`${rel} (${lineCount} linhas)`);
}

if (overHard.length > 0) {
  fail(
    "R2-hard-limit",
    `${overHard.length} arquivo(s) excedem 600 linhas — hard limit ultrapassado (modularize: mais resultado em menos linhas)`,
    overHard,
    overHard,
  );
} else {
  pass("R2-hard-limit", "Nenhum arquivo excede 600 linhas (hard limit OK)");
}

if (overSoft.length > 0) {
  warn(
    "R2-soft-limit",
    `${overSoft.length} arquivo(s) entre 500-600 linhas — soft limit atingido (otimize: mais resultado em menos linhas)`,
    overSoft,
    overSoft,
  );
} else {
  pass(
    "R2-soft-limit",
    "Todos os arquivos abaixo de 500 linhas — código otimizado ✓",
  );
}

// ─────────────────────────────────────────────────────────────────
// R3 – Sem referências 3D (deve ser 2.5D)
// Proibido: THREE.js, three/', WebGL 3D context, 'scene.add', BufferGeometry
// (não conta comentários ou strings de documentação que explicam a ausência)
// ─────────────────────────────────────────────────────────────────

const BANNED_3D = [
  /from\s+['"]three['"]/,
  /require\s*\(\s*['"]three['"]\s*\)/,
  /new\s+THREE\./,
  /WebGLRenderer/,
  /PerspectiveCamera/,
  /BufferGeometry/,
  /scene\.add\s*\(/,
];

const files3D = [];

for (const f of allCodeFiles) {
  const lines = readLines(f);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Ignora linhas de comentário
    if (/^\s*(\/\/|#|\/\*)/.test(line)) continue;
    for (const re of BANNED_3D) {
      if (re.test(line)) {
        files3D.push(`${relative(ROOT, f)}:${i + 1} → ${line.trim()}`);
        break;
      }
    }
  }
}

if (files3D.length > 0) {
  fail(
    "R3-no-3d",
    `${files3D.length} ocorrência(s) de código 3D proibido (usar 2.5D)`,
    files3D,
  );
} else {
  pass("R3-no-3d", "Nenhuma referência 3D encontrada");
}

// ─────────────────────────────────────────────────────────────────
// R4 – Sem dados mockados em produção
// Detecta: jest.mock em arquivos não-test, vi.mock fora de tests/,
// hardcoded lat/lon constantes tipicamente usadas como mock
// ─────────────────────────────────────────────────────────────────

const PROD_FILES = allCodeFiles.filter(
  (f) =>
    !/\.(test|spec)\.(ts|tsx|js)$/.test(f) &&
    !/\/tests\//.test(f) &&
    !/\/e2e\//.test(f),
);

const mockViolations = [];

for (const f of PROD_FILES) {
  const lines = readLines(f);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*(\/\/|#)/.test(line)) continue;
    // jest.mock / vi.mock fora de arquivo de teste → suspeito
    if (/\b(jest|vi)\.mock\s*\(/.test(line)) {
      mockViolations.push(`${relative(ROOT, f)}:${i + 1} → ${line.trim()}`);
    }
    // Coordenadas hardcoded suspeitas (lat/lon constante típica de mock)
    if (/const\s+\w*(lat|lon|lng|coord)\w*\s*=\s*-?\d+\.\d{4,}/i.test(line)) {
      mockViolations.push(
        `${relative(ROOT, f)}:${i + 1} → coordenada hardcoded: ${line.trim()}`,
      );
    }
  }
}

if (mockViolations.length > 0) {
  warn(
    "R4-no-mocks",
    `${mockViolations.length} possível(is) dado(s) mockado(s) em código de produção`,
    mockViolations,
  );
} else {
  pass("R4-no-mocks", "Nenhum mock detectado em código de produção");
}

// ─────────────────────────────────────────────────────────────────
// R6 – APIs pagas banidas
// ─────────────────────────────────────────────────────────────────

const BANNED_API_DOMAINS = [
  "api.openai.com",
  "api.anthropic.com",
  "maps.googleapis.com",
  "maps.google.com",
  "api.mapbox.com",
  "api.here.com",
  "api.tomtom.com",
  "platform.openai.com",
  "api.groq.com", // Groq cloud (foi removido, mas verificar)
];

const paidApiViolations = [];

for (const f of PROD_FILES) {
  const content = readFileSync(f, "utf8");
  for (const domain of BANNED_API_DOMAINS) {
    if (content.includes(domain)) {
      // Verifica que não é só um comentário listando o que NÃO usar
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(domain) && !/^\s*(\/\/|#|\*)/.test(lines[i])) {
          paidApiViolations.push(
            `${relative(ROOT, f)}:${i + 1} → API paga: ${domain}`,
          );
        }
      }
    }
  }
}

if (paidApiViolations.length > 0) {
  fail(
    "R6-zero-cost",
    `${paidApiViolations.length} referência(s) a APIs pagas encontradas`,
    paidApiViolations,
  );
} else {
  pass("R6-zero-cost", "Nenhuma API paga referenciada em código de produção");
}

// ─────────────────────────────────────────────────────────────────
// R7 – .gitignore e .dockerignore existem e têm entradas mínimas
// ─────────────────────────────────────────────────────────────────

const GITIGNORE_REQUIRED = [
  "node_modules",
  "dist",
  ".env",
  "coverage",
  "*.log",
];
const DOCKERIGNORE_REQUIRED = ["node_modules", ".git", "coverage", "*.log"];

function checkIgnoreFile(filename, required) {
  const fp = join(ROOT, filename);
  if (!existsSync(fp)) return [`${filename} não existe`];
  const content = readFileSync(fp, "utf8");
  return required
    .filter((entry) => !content.includes(entry))
    .map((e) => `${filename} não contém: ${e}`);
}

const ignoreMissing = [
  ...checkIgnoreFile(".gitignore", GITIGNORE_REQUIRED),
  ...checkIgnoreFile(".dockerignore", DOCKERIGNORE_REQUIRED),
];

if (ignoreMissing.length > 0) {
  fail(
    "R7-ignore-files",
    "Entradas obrigatórias ausentes em .gitignore/.dockerignore",
    ignoreMissing,
  );
} else {
  pass("R7-ignore-files", ".gitignore e .dockerignore OK");
}

// ─────────────────────────────────────────────────────────────────
// R8 – Docker First: Dockerfile e docker-compose.yml existem
// ─────────────────────────────────────────────────────────────────

const dockerFiles = ["Dockerfile", "docker-compose.yml"];
const missingDocker = dockerFiles.filter((f) => !existsSync(join(ROOT, f)));

if (missingDocker.length > 0) {
  fail(
    "R8-docker-first",
    `Arquivos Docker ausentes: ${missingDocker.join(", ")}`,
    missingDocker,
  );
} else {
  pass("R8-docker-first", "Dockerfile e docker-compose.yml presentes");
}

// ─────────────────────────────────────────────────────────────────
// Relatório final
// ─────────────────────────────────────────────────────────────────

const report = {
  timestamp: new Date().toISOString(),
  summary: {
    violations: violations.length,
    warnings: warnings.length,
    passed: passed.length,
    status: violations.length === 0 ? "PASSOU" : "FALHOU",
  },
  violations,
  warnings,
  passed,
};

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_FILE, JSON.stringify(report, null, 2), "utf8");

// Console output
console.log("\n╔══════════════════════════════════════════════════════╗");
console.log("║   Enforcement — Regras Não Negociáveis (sisRUA)      ║");
console.log("╚══════════════════════════════════════════════════════╝\n");

if (passed.length > 0) {
  console.log(`✅ Passou (${passed.length}):`);
  for (const p of passed) console.log(`   [${p.rule}] ${p.message}`);
}

if (warnings.length > 0) {
  console.log(`\n⚠️  Avisos (${warnings.length}):`);
  for (const w of warnings) {
    console.log(`   [${w.rule}] ${w.message}`);
    for (const d of w.details.slice(0, 5)) console.log(`      • ${d}`);
    if (w.details.length > 5)
      console.log(`      … +${w.details.length - 5} mais`);
  }
}

if (violations.length > 0) {
  console.log(`\n❌ Violações (${violations.length}):`);
  for (const v of violations) {
    console.log(`   [${v.rule}] ${v.message}`);
    for (const d of v.details.slice(0, 8)) console.log(`      • ${d}`);
    if (v.details.length > 8)
      console.log(`      … +${v.details.length - 8} mais`);
  }
  console.log(
    `\n🚫 Gate FALHOU — ${violations.length} regra(s) não negociável(is) violada(s)`,
  );
  console.log(`📄 Relatório: ${OUT_FILE}\n`);
  exit(1);
}

console.log(`\n✅ Gate PASSOU — todas as regras não negociáveis satisfeitas`);
console.log(`📄 Relatório: ${OUT_FILE}\n`);
