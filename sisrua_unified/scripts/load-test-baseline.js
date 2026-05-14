import autocannon from 'autocannon';

async function runLoadTest() {
  const url = process.env.APP_URL || 'http://localhost:3001';
  
  console.log(`🚀 Iniciando Load Test Baseline em ${url}...`);

  const result = await autocannon({
    url,
    connections: 10,
    pipelining: 1,
    duration: 10,
    title: 'sisrua-baseline',
    requests: [
      {
        method: 'GET',
        path: '/api/admin/saude'
      }
    ]
  });

  console.log('📊 Resultados do Load Test:');
  console.log(`- Requests/sec: ${result.requests.average}`);
  console.log(`- Latência Média: ${result.latency.average} ms`);
  console.log(`- Latência P99: ${result.latency.p99} ms`);
  console.log(`- Erros: ${result.errors}`);

  if (result.non2xx > 0) {
    console.warn(`⚠️ Detectadas ${result.non2xx} respostas não-2xx.`);
  }

  return result;
}

runLoadTest().catch(console.error);
