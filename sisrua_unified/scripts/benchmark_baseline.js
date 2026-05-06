import autocannon from 'autocannon';

/**
 * benchmark_baseline.js — Estabelece o baseline de performance para o sisRUA Unified.
 * 
 * Roadmap Item P3.3 [T1]: Load Testing Baseline.
 * 
 * Este script testa:
 * 1. Latência do endpoint /health (overhead do Node.js + DB basic check).
 * 2. Throughput de requests administrativos leves.
 */

async function runBenchmark() {
  console.log('🚀 Iniciando Benchmark Baseline...');

  const url = process.env.BENCHMARK_URL || 'http://localhost:3001';
  
  // 1. Benchmark do Health Check
  console.log(`\n--- Testando /health em ${url} ---`);
  const healthResult = await autocannon({
    url: `${url}/health`,
    connections: 10,
    duration: 10,
    pipelining: 1,
  });
  
  console.log('Resultados /health:');
  console.log(`- Requests/sec: ${healthResult.requests.average}`);
  console.log(`- Latência Média: ${healthResult.latency.average} ms`);
  console.log(`- Erros: ${healthResult.errors + healthResult.timeouts}`);

  // 2. Benchmark do Admin Saúde (requer token)
  const adminToken = process.env.ADMIN_TOKEN;
  if (adminToken) {
    console.log(`\n--- Testando /api/admin/saude em ${url} ---`);
    const adminResult = await autocannon({
      url: `${url}/api/admin/saude`,
      connections: 5,
      duration: 10,
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });

    console.log('Resultados /api/admin/saude:');
    console.log(`- Requests/sec: ${adminResult.requests.average}`);
    console.log(`- Latência Média: ${adminResult.latency.average} ms`);
  } else {
    console.log('\n⚠️ ADMIN_TOKEN não configurado. Pulando benchmark administrativo.');
  }

  console.log('\n✅ Benchmark Baseline concluído.');
}

runBenchmark().catch(err => {
  console.error('❌ Erro no benchmark:', err);
  process.exit(1);
});
