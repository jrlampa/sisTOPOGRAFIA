import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const ARTIFACTS_DIR = path.join(ROOT, 'artifacts');
const OUTPUT_FILE = path.join(ARTIFACTS_DIR, 'test-suite-metrics.json');

const TEST_FILE_RE = /\.(test|spec)\.(ts|tsx|js|jsx)$/i;
const E2E_FILE_RE = /\.spec\.(ts|tsx|js|jsx)$/i;
const INTEGRATION_NAME_RE = /(routes?|api|auth|sanitization|validation|logging|idempotency|baseurl|radius)/i;
const TEST_CASE_RE = /\b(?:it|test)\s*\(/g;

async function walk(dir) {
  let entries = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const results = await Promise.all(
    entries
      .filter((entry) => !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'dist')
      .map(async (entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return walk(full);
        return full;
      }),
  );

  return results.flat();
}

function countTestCases(content) {
  const matches = content.match(TEST_CASE_RE);
  return matches ? matches.length : 0;
}

function classifyBackendTest(filePath, content) {
  const fileName = path.basename(filePath);
  const header = content.slice(0, 500).toLowerCase();

  if (header.includes('testes de integração') || INTEGRATION_NAME_RE.test(fileName)) {
    return 'integration';
  }

  return 'unit';
}

async function collect() {
  const [frontendFiles, backendFiles, e2eFiles] = await Promise.all([
    walk(path.join(ROOT, 'tests')),
    walk(path.join(ROOT, 'server', 'tests')),
    walk(path.join(ROOT, 'e2e')),
  ]);

  const unit = { files: 0, testCases: 0 };
  const integration = { files: 0, testCases: 0 };
  const e2e = { files: 0, testCases: 0 };

  for (const filePath of frontendFiles) {
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
