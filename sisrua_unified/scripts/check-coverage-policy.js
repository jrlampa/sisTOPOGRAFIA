import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

const policy = {
  critical20: {
    label: 'Críticos (20%)',
    source: 'coverage/frontend-risk/coverage-summary.json',
    target: { lines: 100, statements: 100, functions: 100, branches: 100 },
  },
  remaining80: {
    label: 'Restantes (>=80%)',
    source: 'coverage/backend/coverage-summary.json',
    target: { lines: 80, statements: 80, functions: 80, branches: 80 },
  },
};

const strict = process.argv.includes('--strict');

async function loadCoverageSummary(relativePath) {
  const fullPath = path.join(ROOT, relativePath);
  const content = await fs.readFile(fullPath, 'utf8');
  return JSON.parse(content).total;
}

function metricValue(summary, metric) {
  return Number(summary?.[metric]?.pct ?? 0);
}

async function run() {
  let hasFailure = false;

  console.log('📈 Política de cobertura');

  for (const config of Object.values(policy)) {
    try {
      const summary = await loadCoverageSummary(config.source);
      console.log(`\n${config.label} (${config.source})`);

      for (const [metric, expected] of Object.entries(config.target)) {
        const actual = metricValue(summary, metric);
        const ok = actual >= expected;
        const status = ok ? '✅' : '❌';

        if (!ok) hasFailure = true;

        console.log(`${status} ${metric}: ${actual.toFixed(2)}% (meta: ${expected}%)`);
      }
    } catch (error) {
      hasFailure = true;
      console.log(`\n❌ ${config.label}: não foi possível ler ${config.source}`);
      console.log(`   Motivo: ${error.message}`);
    }
  }

  if (hasFailure && strict) {
    console.error('\nFalha na política de cobertura (modo estrito).');
    process.exit(1);
  }

  if (hasFailure) {
    console.warn('\nHá metas de cobertura não atendidas.');
  } else {
    console.log('\n✅ Todas as metas de cobertura foram atendidas.');
  }
}

run().catch((error) => {
  console.error('Falha ao avaliar política de cobertura:', error);
  process.exit(1);
});
