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
    lat: -22.9068,
    lon: -43.1729,
    radius: 100,
    mode: 'circle',
    polygon: [
      [-43.1729, -22.9068],
      [-43.1730, -22.9069],
      [-43.1728, -22.9070],
      [-43.1729, -22.9068] // Fechar o polígono
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
        return 'completed';
      }

      const taskId = data.jobId;
      console.log(`  Job #${i+1} aceito. Job ID: ${taskId}`);
      
      // Polling para conclusão
      let status = 'queued';
      while (status === 'queued' || status === 'processing') {
        await new Promise(r => setTimeout(r, 2000));
        const statusRes = await fetch(`${BASE_URL}/api/jobs/${taskId}`);
        const statusData = await statusRes.json();
        status = statusData.status;
        console.log(`  Job #${i+1} status: ${status}`);
      }
      return status;
    });

    const results = await Promise.all(promises);
    const duration = (Date.now() - start) / 1000;
    
    console.log('\nResultados:');
    console.log(`- Tempo Total: ${duration.toFixed(2)}s`);
    console.log(`- Jobs Concluídos: ${results.filter(s => s === 'completed').length}`);
    console.log(`- Jobs Falhos: ${results.filter(s => s === 'failed').length}`);
    
  } catch (err) {
    console.error('❌ Erro no benchmark:', err.message);
  }
}

runDxfConcurrencyTest();
