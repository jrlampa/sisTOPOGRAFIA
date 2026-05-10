/**
 * benchmark_dxf_concurrency.js — Testa a capacidade de processamento paralelo de DXF.
 * 
 * Roadmap Item P3.3 [T1]: Load Testing Baseline.
 */

const BASE_URL = 'http://localhost:3001';
const CONCURRENT_JOBS = 2; // Reduzi para 2 para ser conservador na máquina do usuário
const ADMIN_USER_ID = 'system-admin';

async function runDxfConcurrencyTest() {
  console.log(`🚀 Iniciando Teste de Concorrência DXF (${CONCURRENT_JOBS} jobs)...`);

  const payload = {
    lat: -22.9519,
    lon: -43.2105,
    radius: 100,
    mode: 'circle',
    polygon: [
      [-43.2105, -22.9519],
      [-43.2106, -22.9520],
      [-43.2104, -22.9521],
      [-43.2105, -22.9519]
    ],
    client_name: 'BENCHMARK_USER'
  };

  const start = Date.now();
  
  try {
    const promises = Array.from({ length: CONCURRENT_JOBS }).map(async (_, i) => {
      console.log(`- Disparando Job #${i+1}...`);
      
      // Variar coordenadas para forçar Cache Miss
      const offset = (i + 1) * 0.0001;
      const jobPayload = {
        ...payload,
        lat: payload.lat + offset,
        lon: payload.lon + offset
      };

      const res = await fetch(`${BASE_URL}/api/dxf`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': ADMIN_USER_ID
        },
        body: JSON.stringify(jobPayload)
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao disparar job');
      
      if (data.status === 'success') {
        console.log(`  Job #${i+1} Cache Hit!`);
        return { status: 'completed' };
      }

      const taskId = data.jobId;
      console.log(`  Job #${i+1} aceito. Job ID: ${taskId}`);
      
      // Polling para conclusão
      let status = 'queued';
      let error = null;
      while (status === 'queued' || status === 'processing') {
        await new Promise(r => setTimeout(r, 2000));
        const statusRes = await fetch(`${BASE_URL}/api/jobs/${taskId}`, {
          headers: { 
            'x-user-id': ADMIN_USER_ID
          }
        });
        const statusData = await statusRes.json();
        status = statusData.status;
        error = statusData.error;
        console.log(`  Job #${i+1} status: ${status}${error ? ' - Erro: ' + error : ''}`);
      }
      return { status, error };
    });

    const results = await Promise.all(promises);
    const duration = (Date.now() - start) / 1000;
    
    console.log('\nResultados:');
    console.log(`- Tempo Total: ${duration.toFixed(2)}s`);
    console.log(`- Jobs Concluídos: ${results.filter(r => r.status === 'completed').length}`);
    console.log(`- Jobs Falhos: ${results.filter(r => r.status === 'failed').length}`);
    
    results.forEach((r, i) => {
      if (r.status === 'failed') {
        console.log(`  Erro Job #${i+1}: ${r.error}`);
      }
    });
    
  } catch (err) {
    console.error('❌ Erro no benchmark:', err.message);
  }
}

runDxfConcurrencyTest();
