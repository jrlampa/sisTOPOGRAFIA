import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const ARTIFACTS_DIR = path.join(ROOT, 'artifacts');
const OUTPUT_FILE = path.join(ARTIFACTS_DIR, 'test-suite-metrics.json');

// Caminho do arquivo de configuração: pode ser sobrescrito pela variável de ambiente.
const CONFIG_FILE = process.env.TEST_METRICS_CONFIG
  ? path.resolve(process.env.TEST_METRICS_CONFIG)
  : path.join(ROOT, 'test-metrics.config.json');

const DEFAULT_CONFIG = {
  // Raízes de descoberta de testes, relativas à raiz do projeto.
  // - unit: arquivos nessas pastas são sempre classificados como unitários.
  // - backend: arquivos nessas pastas passam pela heurística unit/integração.
  // - e2e: arquivos nessas pastas são sempre classificados como E2E.
  roots: {
    unit: ['tests'],
    backend: ['server/tests'],
    e2e: ['e2e'],
  },
  // Regex aplicado ao nome do arquivo de backend para identificar testes de integração.
  integrationPattern: '(routes?|api|auth|sanitization|validation|logging|idempotency|baseurl|radius)',
  // Palavra-chave no cabeçalho do arquivo (primeiras 500 chars, lowercase) que também indica integração.
  integrationHeaderKeyword: 'testes de integração',
  // Pastas ignoradas durante o percurso de arquivos.
  excludedDirectories: ['.git', 'node_modules', 'dist', 'coverage'],
};

async function loadConfig() {
  try {
    const raw = await fs.readFile(CONFIG_FILE, 'utf8');
    const loaded = JSON.parse(raw);
    return {
      roots: { ...DEFAULT_CONFIG.roots, ...loaded.roots },
      integrationPattern: loaded.integrationPattern ?? DEFAULT_CONFIG.integrationPattern,
      integrationHeaderKeyword:
        loaded.integrationHeaderKeyword ?? DEFAULT_CONFIG.integrationHeaderKeyword,
      excludedDirectories: loaded.excludedDirectories ?? DEFAULT_CONFIG.excludedDirectories,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

const TEST_FILE_RE = /\.(test|spec)\.(ts|tsx|js|jsx)$/i;
const E2E_FILE_RE = /\.spec\.(ts|tsx|js|jsx)$/i;
const TEST_CASE_RE = /\b(?:it|test)\s*\(/g;

async function walk(dir, excludedSet) {
  let entries = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const results = await Promise.all(
    entries
      .filter((entry) => !entry.name.startsWith('.') && !excludedSet.has(entry.name))
      .map(async (entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return walk(full, excludedSet);
        return full;
      }),
  );

  return results.flat();
}

function countTestCases(content) {
  const matches = content.match(TEST_CASE_RE);
  return matches ? matches.length : 0;
}

function makeClassifier(integrationPattern, integrationHeaderKeyword) {
  const re = new RegExp(integrationPattern, 'i');
  const keyword = integrationHeaderKeyword.toLowerCase();

  return function classifyBackendTest(filePath, content) {
    const fileName = path.basename(filePath);
    const header = content.slice(0, 500).toLowerCase();
    return header.includes(keyword) || re.test(fileName) ? 'integration' : 'unit';
  };
}

async function walkRoots(roots, excludedSet) {
  const all = await Promise.all(
    roots.map((rel) => walk(path.join(ROOT, rel), excludedSet)),
  );
  return all.flat();
}

async function collect() {
  const config = await loadConfig();
  const excluded = new Set(config.excludedDirectories);
  const classifyBackendTest = makeClassifier(
    config.integrationPattern,
    config.integrationHeaderKeyword,
  );

  const [unitFiles, backendFiles, e2eFiles] = await Promise.all([
    walkRoots(config.roots.unit, excluded),
    walkRoots(config.roots.backend, excluded),
    walkRoots(config.roots.e2e, excluded),
  ]);

  const unit = { files: 0, testCases: 0 };
  const integration = { files: 0, testCases: 0 };
  const e2e = { files: 0, testCases: 0 };

  for (const filePath of unitFiles) {
    if (!TEST_FILE_RE.test(filePath)) continue;
    const content = await fs.readFile(filePath, 'utf8');
    unit.files += 1;
    unit.testCases += countTestCases(content);
  }

  for (const filePath of backendFiles) {
    if (!TEST_FILE_RE.test(filePath)) continue;
    const content = await fs.readFile(filePath, 'utf8');
    const kind = classifyBackendTest(filePath, content);
    if (kind === 'integration') {
      integration.files += 1;
      integration.testCases += countTestCases(content);
    } else {
      unit.files += 1;
      unit.testCases += countTestCases(content);
    }
  }

  for (const filePath of e2eFiles) {
    if (!E2E_FILE_RE.test(filePath)) continue;
    const content = await fs.readFile(filePath, 'utf8');
    e2e.files += 1;
    e2e.testCases += countTestCases(content);
  }

  const total = {
    files: unit.files + integration.files + e2e.files,
    testCases: unit.testCases + integration.testCases + e2e.testCases,
  };

  const payload = {
    generatedAt: new Date().toISOString(),
    unit,
    integration,
    e2e,
    total,
  };

  await fs.mkdir(ARTIFACTS_DIR, { recursive: true });
  await fs.writeFile(OUTPUT_FILE, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  console.log('📊 Contagem de testes por tipo');
  console.log(`- Unitários: ${unit.testCases} testes em ${unit.files} arquivos`);
  console.log(`- Integração: ${integration.testCases} testes em ${integration.files} arquivos`);
  console.log(`- E2E: ${e2e.testCases} testes em ${e2e.files} arquivos`);
  console.log(`- Total: ${total.testCases} testes em ${total.files} arquivos`);
  console.log(`- Artefato: ${path.relative(ROOT, OUTPUT_FILE)}`);
}

collect().catch((error) => {
  console.error('Falha ao gerar métricas da suíte de testes:', error);
  process.exit(1);
});
