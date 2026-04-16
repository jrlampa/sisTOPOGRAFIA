import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FRONTEND_RISK_COVERAGE_FILE =
  process.env.FRONTEND_RISK_COVERAGE_FILE ?? 'coverage/frontend-risk/coverage-final.json';
const BACKEND_COVERAGE_FILE =
  process.env.BACKEND_COVERAGE_FILE ?? 'coverage/backend/coverage-final.json';

const policy = {
  critical20: {
    label: 'Críticos (20%)',
    source: FRONTEND_RISK_COVERAGE_FILE,
    target: { lines: 100, statements: 100, functions: 100, branches: 100 },
  },
  remaining80: {
    label: 'Restantes (>=80%)',
    source: BACKEND_COVERAGE_FILE,
    target: { lines: 80, statements: 80, functions: 80, branches: 80 },
  },
};

const strict = process.argv.includes('--strict');

async function loadCoverageSummary(relativePath) {
  const fullPath = path.join(ROOT, relativePath);
  const content = await fs.readFile(fullPath, 'utf8');
  const parsed = JSON.parse(content);

  if (parsed.total) {
    return parsed.total;
  }

  const files = Object.values(parsed);

  const totals = {
    lines: { covered: 0, total: 0 },
    statements: { covered: 0, total: 0 },
    functions: { covered: 0, total: 0 },
    branches: { covered: 0, total: 0 },
  };

  for (const file of files) {
    if (!file || typeof file !== 'object') continue;

    // Usa file.l (mapa de linhas Istanbul: { [linha]: hits }) quando disponível —
    // mais preciso do que statementMap, que pode subcontar linhas com múltiplos statements.
    // Fallback para statementMap (com Set para deduplicar) em formatos sem file.l (e.g. ts-jest).
    if (file.l && Object.keys(file.l).length > 0) {
      const lineEntries = Object.entries(file.l);
      totals.lines.total += lineEntries.length;
      totals.lines.covered += lineEntries.filter(([, hits]) => Number(hits) > 0).length;
    } else {
      const statementEntries = Object.entries(file.s ?? {});
      const statementMap = file.statementMap ?? {};
      const coveredLines = new Set();
      const totalLines = new Set();

      for (const [statementId, hits] of statementEntries) {
        const line = statementMap?.[statementId]?.start?.line;
        if (typeof line !== 'number') continue;
        totalLines.add(line);
        if (Number(hits) > 0) coveredLines.add(line);
      }

      totals.lines.total += totalLines.size;
      totals.lines.covered += coveredLines.size;
    }

    const statements = Object.values(file.s ?? {});
    const functions = Object.values(file.f ?? {});
    const branches = Object.values(file.b ?? {}).flatMap((entry) =>
      Array.isArray(entry) ? entry : [],
    );

    totals.statements.total += statements.length;
    totals.statements.covered += statements.filter((hits) => Number(hits) > 0).length;

    totals.functions.total += functions.length;
    totals.functions.covered += functions.filter((hits) => Number(hits) > 0).length;

    totals.branches.total += branches.length;
    totals.branches.covered += branches.filter((hits) => Number(hits) > 0).length;
  }

  const toPct = (covered, total) => (total === 0 ? 0 : (covered / total) * 100);

  return {
    lines: { pct: toPct(totals.lines.covered, totals.lines.total) },
    statements: { pct: toPct(totals.statements.covered, totals.statements.total) },
    functions: { pct: toPct(totals.functions.covered, totals.functions.total) },
    branches: { pct: toPct(totals.branches.covered, totals.branches.total) },
  };
}

function metricValue(summary, metric) {
  return Number(summary?.[metric]?.pct ?? 0);
}

function isMissingFileError(error) {
  return error?.code === 'ENOENT';
}

async function run() {
  // hasFailure: cobertura medida e abaixo da meta → falha no modo estrito.
  // hasMissing: arquivo de cobertura ausente → sempre aviso, nunca falha.
  let hasFailure = false;
  let hasMissing = false;

  console.log('📈 Política de cobertura');

  for (const config of Object.values(policy)) {
    let summary;

    try {
      summary = await loadCoverageSummary(config.source);
    } catch (error) {
      hasMissing = true;
      const motivo = isMissingFileError(error)
        ? `arquivo não encontrado: ${config.source} (execute as suítes de teste antes)`
        : error.message;
      console.log(`\n⚠️  ${config.label}: ${motivo}`);
      continue;
    }

    console.log(`\n${config.label} (${config.source})`);

    for (const [metric, expected] of Object.entries(config.target)) {
      const actual = metricValue(summary, metric);
      const ok = actual + 1e-6 >= expected;
      const status = ok ? '✅' : '❌';

      if (!ok) hasFailure = true;

      console.log(`${status} ${metric}: ${actual.toFixed(2)}% (meta: ${expected}%)`);
    }
  }

  if (hasMissing) {
    console.warn('\n⚠️  Um ou mais arquivos de cobertura estão ausentes (execute npm run test primeiro).');
  }

  if (hasFailure && strict) {
    console.error('\nFalha na política de cobertura (modo estrito).');
    process.exit(1);
  }

  if (hasFailure) {
    console.warn('Há metas de cobertura não atendidas.');
  } else if (!hasMissing) {
    console.log('\n✅ Todas as metas de cobertura foram atendidas.');
  }
}

run().catch((error) => {
  console.error('Falha ao avaliar política de cobertura:', error);
  process.exit(1);
});
