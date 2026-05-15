import autocannon from 'autocannon';
import { logger } from './logger-adapter.js';

async function runLoadTest() {
  const url = process.env.APP_URL || 'http://localhost:3001';
  
  logger.info(`Iniciando Load Test Baseline em ${url}...`);

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

  logger.info('Resultados do Load Test:', {
    requestsPerSec: result.requests.average,
    latencyAvg: result.latency.average,
    latencyP99: result.latency.p99,
    errors: result.errors
  });

  if (result.non2xx > 0) {
    logger.warn(`Detectadas ${result.non2xx} respostas não-2xx.`);
  }

  return result;
}

runLoadTest().catch(console.error);
