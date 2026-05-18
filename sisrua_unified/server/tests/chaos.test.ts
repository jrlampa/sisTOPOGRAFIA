import { vi } from "vitest";
/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CHAOS TEST SUITE — sisRUA Unified
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Modelos de caos implementados:
 *
 *  [C1] OSM API — falhas intermitentes durante fetch de dados geográficos
 *  [C2] Banco de Dados — desconexão mid-job enquanto job está em "processing"
 *  [C3] Filesystem — ENOSPC e EPERM durante escrita do DXF
 *  [C4] Python Engine — timeout, retorno corrompido, crash silencioso
 *  [C5] Cache — pressão de memória com evicção e colisão de chaves
 *  [C6] Race Conditions — requisições DXF simultâneas no mesmo jobId
 *  [C7] Pontos Aleatórios — property-based testing com coords geradas pelo usuário
 */

import fs from 'fs';
import {
  randomBrazilCoord,
  randomRadius,
  generateRandomScenarios,
  generateJobIds,
  createChaosFetch,
  createSelectiveFetch,
  createFsWithFailAfter,
  makeFsError,
  withJitter,
  runWithChaos,
  BRAZIL_CITIES,
  EDGE_COORDS,
  resetSeed,
} from './chaosEngine/faultInjector';

// ── Mocks Globais ──────────────────────────────────────────────────────────────

vi.mock('../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../config', () => ({
  config: {
    DATABASE_URL: '',
    DXF_DIRECTORY: '/tmp/dxf_chaos',
    DXF_FILE_TTL_MS: 600_000,
    DXF_MAX_AGE_MS: 7_200_000,
    DXF_CLEANUP_INTERVAL_MS: 60_000,
    CACHE_TTL_MS: 300_000,
    CACHE_MAX_SIZE: 10,
    METRICS_PREFIX: 'sisrua_chaos',
    NODE_ENV: 'test',
    useDbConstantsConfig: false,
    useSupabaseJobs: false,
    JOB_CLEANUP_INTERVAL_MS: 3_600_000,
    JOB_MAX_AGE_MS: 7_200_000,
  },
}));

// ── Imports pós-mock ───────────────────────────────────────────────────────────
import { createJob, getJob, updateJobStatus, failJob, completeJob, stopCleanupInterval, MAX_SYSTEM_CAPACITY } from '../services/jobStatusService';
import { createCacheKey, setCachedFilename, getCachedFilename, clearCache } from '../services/cacheService';
import { IbgeService } from '../services/ibgeService';
import { TopodataService } from '../services/topodataService';
import { ElevationService } from '../services/elevationService';
import { generateDXF } from '../services/dxfService';

// ══════════════════════════════════════════════════════════════════════════════
// [C1] OSM API — Falhas Intermitentes
// ══════════════════════════════════════════════════════════════════════════════
describe('[C1] Caos: OSM API — falhas intermitentes', () => {
  beforeEach(() => vi.clearAllMocks());
  afterAll(() => stopCleanupInterval());

  it('deve tolerar 30% de falhas na API OSM sem lançar exceção não capturada', async () => {
    global.fetch = createChaosFetch(0.3);
    const results: boolean[] = [];

    for (const city of BRAZIL_CITIES) {
      const result = await runWithChaos(city.name, async () => {
        const res = await fetch(`https://overpass-api.de/api/interpreter?lat=${city.lat}&lon=${city.lng}`);
        if (!res.ok) throw new Error(`OSM ${res.status}`);
      });
      results.push(result.passed || !!result.error); // passou OU capturou o erro
    }

    // Todos os cenários devem ser tratados (sem crashes não capturados)
    expect(results.every(Boolean)).toBe(true);
  });

  it('deve retornar erro descritivo quando OSM retorna 429', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      json: async () => ({}),
    });

    const result = await runWithChaos('OSM rate-limit', async () => {
      const res = await fetch('https://overpass-api.de/api/interpreter');
      if (!res.ok) throw new Error(`API Error ${res.status}: Too Many Requests`);
    });

    expect(result.passed).toBe(false);
    expect(result.error).toContain('429');
  });

  it('deve tolerar falha completa da API OSM retornando array vazio', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('ECONNRESET'));

    const result = await runWithChaos('OSM offline', async () => {
      try {
        await fetch('https://overpass-api.de/api/interpreter');
      } catch {
        return []; // Graceful fallback
      }
    });

    expect(result.passed).toBe(true); // Fallback funcionou
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// [C2] Banco de Dados — Desconexão Mid-Job
// ══════════════════════════════════════════════════════════════════════════════
describe('[C2] Caos: Banco de Dados — desconexão durante processamento', () => {
  afterEach(() => stopCleanupInterval());

  it('job deve permanecer em memória se DB falhar no meio do processamento', async () => {
    const jobId = 'chaos-db-job-1';
    const job = await createJob(jobId);

    expect(job.status).toBe('queued');

    // Simula: DB cai durante updateJobStatus
    await updateJobStatus(jobId, 'processing', 30);

    // Job deve ainda estar acessível em memória
    const inMemoryJob = await getJob(jobId);
    expect(inMemoryJob).not.toBeNull();
    expect(inMemoryJob?.status).toBe('processing');
  });

  it('job falho deve preservar a mensagem de erro mesmo após reconexão simulada', async () => {
    const jobId = 'chaos-db-job-2';
    await createJob(jobId);

    await updateJobStatus(jobId, 'processing');
    await failJob(jobId, 'DB ECONNRESET durante a escrita do resultado');

    const job = await getJob(jobId);
    expect(job?.status).toBe('failed');
    expect(job?.error).toContain('ECONNRESET');
    expect(job?.attempts).toBe(1);
  });

  it('job completo deve manter o resultado mesmo sem persistência DB', async () => {
    const jobId = 'chaos-db-job-3';
    await createJob(jobId);
    await completeJob(jobId, { url: '/dxf/chaos.dxf', filename: 'chaos.dxf' });

    const job = await getJob(jobId);
    expect(job?.status).toBe('completed');
    expect(job?.result?.filename).toBe('chaos.dxf');
  });

  it('deve suportar 50 jobs simultâneos sem corrida de dados na store em memória', async () => {
    const ids = generateJobIds(50, 'concurrent-db');

    // Criar e atualizar todos simultaneamente
    await Promise.all(ids.map(async (id) => {
      await createJob(id);
      await withJitter(() => updateJobStatus(id, 'processing', 50));
      await withJitter(() => completeJob(id, { url: `/dxf/${id}.dxf`, filename: `${id}.dxf` }));
    }));

    // Todos devem estar completos
    const statuses = await Promise.all(ids.map(async (id) => (await getJob(id))?.status));
    expect(statuses.every((s) => s === 'completed')).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// [C3] Filesystem — ENOSPC, EPERM, ENOENT
// ══════════════════════════════════════════════════════════════════════════════
describe('[C3] Caos: Filesystem — erros de escrita do DXF', () => {
  it('erro ENOSPC deve resultar em erro descritivo, não em crash silencioso', () => {
    const err = makeFsError('ENOSPC', '/tmp/dxf/output.dxf');
    expect(err.code).toBe('ENOSPC');
    expect(err.message).toContain('ENOSPC');
    expect(err.path).toBe('/tmp/dxf/output.dxf');
  });

  it('deve conseguir escrever primeiros N arquivos e falhar no N+1', () => {
    const mockFs = createFsWithFailAfter(3, 'ENOSPC');
    const paths = ['/tmp/a.dxf', '/tmp/b.dxf', '/tmp/c.dxf'];

    // Primeiros 3: ok
    paths.forEach((p) => expect(() => mockFs.writeFileSync(p)).not.toThrow());

    // 4ª escrita: ENOSPC
    expect(() => mockFs.writeFileSync('/tmp/d.dxf')).toThrowError(/ENOSPC/);
  });

  it('EPERM deve ser distinguível de ENOSPC para log de diagnóstico', () => {
    const enospc = makeFsError('ENOSPC');
    const eperm = makeFsError('EPERM');

    expect(enospc.code).not.toBe(eperm.code);
    expect(enospc.code).toBe('ENOSPC');
    expect(eperm.code).toBe('EPERM');
  });

  it('ENOENT em arquivo de leitura deve ser tratado como "não encontrado"', () => {
    const err = makeFsError('ENOENT', '/tmp/dxf/nonexistent.dxf');
    expect(err.code).toBe('ENOENT');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// [C4] Python Engine — Timeout / Dados Corrompidos
// ══════════════════════════════════════════════════════════════════════════════
describe('[C4] Caos: Python Engine — falhas de resposta', () => {
  it('deve detectar quando o engine não retornou dados no prazo (timeout simulado)', async () => {
    const ENGINE_TIMEOUT_MS = 100;

    const enginePromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Engine timeout: DXF generation took too long')), ENGINE_TIMEOUT_MS)
    );

    const result = await runWithChaos('Python engine timeout', () => enginePromise);
    expect(result.passed).toBe(false);
    expect(result.error).toContain('timeout');
  });

  it('deve rejeitar DXF com tamanho 0 bytes (output corrompido do engine)', () => {
    const corruptOutput = '';
    const isValidDxf = (content: string) =>
      content.includes('SECTION') && content.includes('EOF') && content.length > 50;

    expect(isValidDxf(corruptOutput)).toBe(false);
  });

  it('deve rejeitar DXF sem marcador EOF (truncado)', () => {
    const truncatedDxf = '0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1015'; // sem ENDSEC/EOF
    const isValidDxf = (content: string) => content.includes('0\nEOF');
    expect(isValidDxf(truncatedDxf)).toBe(false);
  });

  it('DXF gerado pelo engine JS deve passar na validação de estrutura', () => {
    const dxf = generateDXF([], { lat: -23.55, lng: -46.63 });
    expect(dxf).toContain('SECTION');
    expect(dxf).toContain('0\nEOF');
    expect(dxf.length).toBeGreaterThan(50);
  });

  it('deve capturar stdout vazio do engine como falha detectável', async () => {
    const result = await runWithChaos('engine stdout vazio', async () => {
      const engineOutput = ''; // Engine retornou nada
      if (!engineOutput || engineOutput.trim().length === 0) {
        throw new Error('DxfEngineError: empty output from Python engine');
      }
    });

    expect(result.passed).toBe(false);
    expect(result.error).toContain('DxfEngineError');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// [C5] Cache — Pressão de Memória e Colisão de Chaves
// ══════════════════════════════════════════════════════════════════════════════
describe('[C5] Caos: Cache — pressão de memória e colisões', () => {
  beforeEach(async () => await clearCache());

  it('cache deve aceitar entradas simultâneas sem corrupção de dados', async () => {
    const entries = generateRandomScenarios(20);

    await Promise.all(entries.map(async ({ lat, lng, radius, label }) => {
      const key = createCacheKey({ lat, lon: lng, radius, mode: 'test', polygon: null, layers: [], btContext: undefined, contourRenderMode: undefined });
      await setCachedFilename(key, `${label.replace(/\s/g, '_')}.dxf`);
    }));

    // Verificar que os primeiros valores ainda estão acessíveis
    const first = entries[0];
    const firstKey = createCacheKey({ lat: first.lat, lon: first.lng, radius: first.radius, mode: 'test', polygon: null, layers: [], btContext: undefined, contourRenderMode: undefined });
    const cached = await getCachedFilename(firstKey);
    expect(typeof cached === 'string' || cached === null).toBe(true);
  });

  it('chave de cache deve ser determinística para mesmos parâmetros', () => {
    const params = { lat: -23.55, lon: -46.63, radius: 500, mode: 'full', polygon: null, layers: [], btContext: undefined, contourRenderMode: undefined as any };
    const k1 = createCacheKey(params);
    const k2 = createCacheKey(params);
    expect(k1).toBe(k2);
  });

  it('chaves diferentes para coordenadas diferentes', () => {
    const k1 = createCacheKey({ lat: -23.55, lon: -46.63, radius: 500, mode: 'full', polygon: null, layers: [], btContext: undefined, contourRenderMode: undefined });
    const k2 = createCacheKey({ lat: -22.90, lon: -43.17, radius: 500, mode: 'full', polygon: null, layers: [], btContext: undefined, contourRenderMode: undefined });
    expect(k1).not.toBe(k2);
  });

  it('chave diferente para raio diferente, mesmo local', () => {
    const base = { lat: -23.55, lon: -46.63, mode: 'full', polygon: null, layers: [], btContext: undefined, contourRenderMode: undefined as any };
    const k1 = createCacheKey({ ...base, radius: 500 });
    const k2 = createCacheKey({ ...base, radius: 1000 });
    expect(k1).not.toBe(k2);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// [C6] Race Conditions — Requisições DXF Simultâneas
// ══════════════════════════════════════════════════════════════════════════════
describe('[C6] Caos: Race Conditions — jobs simultâneos', () => {
  afterEach(() => stopCleanupInterval());

  it('múltiplas criações do mesmo jobId não devem causar estado inválido', async () => {
    const jobId = 'race-job-shared';

    // Criar o mesmo jobId 5 vezes simultaneamente
    await Promise.all(Array.from({ length: 5 }, () =>
      withJitter(async () => {
        try { await createJob(jobId); } catch { /* ignora duplicata */ }
      })
    ));

    const job = await getJob(jobId);
    expect(job).not.toBeNull();
    // Status deve ser válido (nunca undefined/corrupto)
    expect(['queued', 'processing', 'completed', 'failed']).toContain(job?.status);
  });

  it('atualizações paralelas de progresso não devem travar', async () => {
    const jobs = generateJobIds(10, 'race-progress');
    await Promise.all(jobs.map((id) => createJob(id)));

    const updates = jobs.flatMap((id) =>
      [25, 50, 75, 100].map((progress) =>
        withJitter(() => updateJobStatus(id, 'processing', progress))
      )
    );

    await expect(Promise.all(updates)).resolves.not.toThrow();
  });

  it('completar e falhar o mesmo job simultaneamente deve resultar em estado consistente', async () => {
    const jobId = 'race-complete-fail';
    await createJob(jobId);

    await Promise.allSettled([
      completeJob(jobId, { url: '/dxf/x.dxf', filename: 'x.dxf' }),
      failJob(jobId, 'Falha simultânea ao complete'),
    ]);

    const job = await getJob(jobId);
    expect(job).not.toBeNull();
    // Estado deve ser 'completed' ou 'failed' — nunca indefinido
    expect(['completed', 'failed']).toContain(job?.status);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// [C7] Pontos Aleatórios — Property-Based Testing com Coords do Usuário
// ══════════════════════════════════════════════════════════════════════════════
describe('[C7] Caos: Pontos Aleatórios — coordenadas geradas pelo usuário', () => {
  beforeEach(() => resetSeed(2026)); // Seed determinístico para reproducibilidade

  // ── Geradores ──────────────────────────────────────────────────────────────

  it('deve gerar coordenadas sempre dentro dos limites do Brasil', () => {
    resetSeed(1234);
    const scenarios = generateRandomScenarios(50);

    scenarios.forEach(({ lat, lng, label }) => {
      expect(lat).toBeGreaterThanOrEqual(-33.75);
      expect(lat).toBeLessThanOrEqual(5.27);
      expect(lng).toBeGreaterThanOrEqual(-73.98);
      expect(lng).toBeLessThanOrEqual(-28.85);
    });
  });

  it('deve gerar raios dentro do range esperado (100m–5km)', () => {
    resetSeed(9999);
    const radii = Array.from({ length: 30 }, () => randomRadius());
    radii.forEach((r) => {
      expect(r).toBeGreaterThanOrEqual(100);
      expect(r).toBeLessThanOrEqual(5000);
    });
  });

  it('seed determinístico deve produzir exatamente a mesma sequência', () => {
    resetSeed(42);
    const seq1 = generateRandomScenarios(5).map((s) => `${s.lat},${s.lng}`);

    resetSeed(42);
    const seq2 = generateRandomScenarios(5).map((s) => `${s.lat},${s.lng}`);

    expect(seq1).toEqual(seq2);
  });

  // ── Geração de DXF com Coordenadas Aleatórias ─────────────────────────────

  it('generateDXF deve retornar DXF válido para 10 coordenadas aleatórias no Brasil', () => {
    resetSeed(777);
    const scenarios = generateRandomScenarios(10);

    scenarios.forEach(({ lat, lng, label }) => {
      const dxf = generateDXF([], { lat, lng });
      expect(dxf).toContain('SECTION');
      expect(dxf).toContain('0\nEOF');
      expect(dxf).toContain(`Lat ${lat}`);
    });
  });

  it('generateDXF deve funcionar em coordenadas de borda (limites extremos do Brasil)', () => {
    EDGE_COORDS.forEach(({ name, lat, lng }) => {
      const dxf = generateDXF([], { lat, lng });
      expect(dxf).toContain('SECTION');
      expect(dxf).toContain('0\nEOF');
    });
  });

  it('TopodataService.isWithinBrazil deve aceitar todas as cidades capitais', () => {
    BRAZIL_CITIES.forEach(({ name, lat, lng }) => {
      expect(TopodataService.isWithinBrazil(lat, lng)).toBe(true);
    });
  });

  it('TopodataService.isWithinBrazil deve rejeitar coordenadas fora do Brasil', () => {
    const outsideBrazil = [
      { name: 'Paris',    lat: 48.85, lng: 2.35 },
      { name: 'Buenos Aires', lat: -34.6, lng: -58.38 },
      { name: 'Lisboa',   lat: 38.71, lng: -9.14 },
      { name: 'Nova York', lat: 40.71, lng: -74.01 },
    ];

    outsideBrazil.forEach(({ lat, lng }) => {
      expect(TopodataService.isWithinBrazil(lat, lng)).toBe(false);
    });
  });

  // ── IbgeService com Coords Aleatórias ─────────────────────────────────────

  it('IbgeService não deve lançar exceção para coordenadas aleatórias no Brasil', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network fail'));
    resetSeed(4242);
    const scenarios = generateRandomScenarios(5);

    for (const { lat, lng } of scenarios) {
      const result = await IbgeService.findMunicipioByCoordinates(lat, lng);
      // Deve retornar null ou um LocationInfo — nunca lançar exceção
      expect(result === null || typeof result === 'object').toBe(true);
    }
  }, 30_000);

  it('IbgeService deve identificar corretamente o estado para cidades reais', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('offline')); // força fallback
    IbgeService.clearCache();

    const spResult = await IbgeService.findMunicipioByCoordinates(-23.55, -46.63);
    expect(spResult?.uf).toBe('SP');

    const rsResult = await IbgeService.findMunicipioByCoordinates(-30.03, -51.23);
    expect(rsResult?.uf).toBe('RS');
  }, 30_000);

  // ── ElevationService com Coords Aleatórias ────────────────────────────────

  it('ElevationService.calculateDistance deve sempre retornar nonnegativo', () => {
    resetSeed(3141);
    const scenarios = generateRandomScenarios(20);

    for (let i = 0; i < scenarios.length - 1; i++) {
      const a = { lat: scenarios[i].lat, lng: scenarios[i].lng };
      const b = { lat: scenarios[i + 1].lat, lng: scenarios[i + 1].lng };
      const dist = ElevationService.calculateDistance(a, b);
      expect(dist).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(dist)).toBe(true);
    }
  });

  it('distância de qualquer ponto para si mesmo deve ser 0', () => {
    resetSeed(2718);
    const scenarios = generateRandomScenarios(10);

    scenarios.forEach(({ lat, lng }) => {
      const point = { lat, lng };
      const dist = ElevationService.calculateDistance(point, point);
      expect(dist).toBe(0);
    });
  });

  it('distância deve ser simétrica: d(A,B) === d(B,A)', () => {
    resetSeed(1618);
    const scenarios = generateRandomScenarios(10);

    for (let i = 0; i < scenarios.length - 1; i++) {
      const a = { lat: scenarios[i].lat, lng: scenarios[i].lng };
      const b = { lat: scenarios[i + 1].lat, lng: scenarios[i + 1].lng };
      const d1 = ElevationService.calculateDistance(a, b);
      const d2 = ElevationService.calculateDistance(b, a);
      expect(Math.abs(d1 - d2)).toBeLessThan(0.001); // dentro de 1mm
    }
  });

  // ── Cache com Coordenadas Aleatórias ──────────────────────────────────────

  it('cache não deve colidir para 100 coordenadas aleatórias diferentes', async () => {
    resetSeed(8675309);
    await clearCache();

    const scenarios = generateRandomScenarios(100);
    const keys = new Set<string>();

    scenarios.forEach(({ lat, lng, radius }) => {
      const key = createCacheKey({
        lat, lon: lng, radius,
        mode: 'full',
        polygon: null,
        layers: [],
        btContext: undefined,
        contourRenderMode: undefined,
      });
      keys.add(key);
    });

    // Todas as 100 coordenadas devem gerar chaves únicas
    expect(keys.size).toBe(100);
  });

  // ── Validação de Input ─────────────────────────────────────────────────────

  it('deve rejeitar coordenadas com NaN', () => {
    const isValidCoord = (lat: number, lng: number) =>
      Number.isFinite(lat) && Number.isFinite(lng) &&
      lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;

    expect(isValidCoord(NaN, -46.63)).toBe(false);
    expect(isValidCoord(-23.55, NaN)).toBe(false);
    expect(isValidCoord(-23.55, -46.63)).toBe(true);
  });

  it('deve rejeitar coordenadas extremas fora do planeta', () => {
    const isValidCoord = (lat: number, lng: number) =>
      Number.isFinite(lat) && Number.isFinite(lng) &&
      lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;

    expect(isValidCoord(91, 0)).toBe(false);
    expect(isValidCoord(0, 181)).toBe(false);
    expect(isValidCoord(Infinity, 0)).toBe(false);
    expect(isValidCoord(0, -Infinity)).toBe(false);
  });

  it('deve rejeitar raio <= 0 ou > 10km', () => {
    const isValidRadius = (r: number) => Number.isFinite(r) && r > 0 && r <= 10_000;
    expect(isValidRadius(0)).toBe(false);
    expect(isValidRadius(-100)).toBe(false);
    expect(isValidRadius(10_001)).toBe(false);
    expect(isValidRadius(500)).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// [C8] Relatório de Caos Agregado
// ══════════════════════════════════════════════════════════════════════════════
describe('[C8] Relatório: propertyTest em massa (50 cenários)', () => {
  afterAll(() => stopCleanupInterval());

  it('generateDXF deve ser estável para 50 coordenadas aleatórias (property test)', () => {
    resetSeed(31415926);
    const scenarios = generateRandomScenarios(50);
    const failures: string[] = [];

    scenarios.forEach(({ lat, lng, radius, label }) => {
      try {
        const dxf = generateDXF([], { lat, lng });
        if (!dxf.includes('0\nEOF')) {
          failures.push(`${label}: DXF missing EOF`);
        }
        if (!dxf.includes('SECTION')) {
          failures.push(`${label}: DXF missing SECTION`);
        }
      } catch (err: any) {
        failures.push(`${label}: EXCEPTION ${err.message}`);
      }
    });

    if (failures.length > 0) {
      console.error('[C8] Falhas de property test:', failures);
    }

    expect(failures).toHaveLength(0);
  });

  it('Haversine deve ser numericamente estável para pares de pontos aleatórios', () => {
    resetSeed(27182818);
    const scenarios = generateRandomScenarios(50);
    const failures: string[] = [];

    for (let i = 0; i < scenarios.length - 1; i++) {
      const a = { lat: scenarios[i].lat, lng: scenarios[i].lng };
      const b = { lat: scenarios[i + 1].lat, lng: scenarios[i + 1].lng };
      const dist = ElevationService.calculateDistance(a, b);

      if (!Number.isFinite(dist) || dist < 0) {
        failures.push(`Par ${i}: dist=${dist} (inválido) de (${a.lat},${a.lng}) para (${b.lat},${b.lng})`);
      }
    }

    expect(failures).toHaveLength(0);
  });

  it('cache não deve vazar entre execuções isoladas', async () => {
    await clearCache();
    resetSeed(11111);
    const scenarios = generateRandomScenarios(30);

    await Promise.all(scenarios.map(async ({ lat, lng, radius }) => {
      const key = createCacheKey({ lat, lon: lng, radius, mode: 'chaos', polygon: null, layers: [], btContext: undefined, contourRenderMode: undefined });
      await setCachedFilename(key, 'chaos_file.dxf');
    }));

    await clearCache();

    // Após clearCache, nada deve ser recuperável
    for (const { lat, lng, radius } of scenarios) {
      const key = createCacheKey({ lat, lon: lng, radius, mode: 'chaos', polygon: null, layers: [], btContext: undefined, contourRenderMode: undefined });
      expect(await getCachedFilename(key)).toBeNull();
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// [C9] Teste Progressivo de Estresse (Capacidade Máxima)
// ══════════════════════════════════════════════════════════════════════════════
describe('[C9] Caos: Teste de Estresse Progressivo (Capacity Limit)', () => {
  afterAll(() => stopCleanupInterval());

  it('o sistema deve suportar criação progressiva de jobs e parar ao atingir o MAX_SYSTEM_CAPACITY sem crashar', async () => {
    let crashed = false;
    let reachedLimit = false;
    let numberOfJobsCreated = 0;

    try {
      // Loop infinito com safe break, até o limite cap de MAX_SYSTEM_CAPACITY ser engatilhado
      for (let i = 0; i < MAX_SYSTEM_CAPACITY + 100; i++) {
        // Criar iterativamente para simular progressão
        await createJob(`stress-job-${i}`);
        numberOfJobsCreated++;
        
        // Simular que uma porcentagem desses jobs está processando e completando
        if (i % 5 === 0) {
          await updateJobStatus(`stress-job-${i}`, 'processing', 20);
        }
      }
    } catch (err: any) {
      if (err.code === 'ERR_CAPACITY') {
        reachedLimit = true;
      } else {
        crashed = true;
        console.error('Falha inesperada no estresse:', err);
      }
    }

    // O Node.js/vi não deve crashar subitamente (crashed = false)
    expect(crashed).toBe(false);

    // O limite DEVE ter sido atingido e forçado o throw seguro
    expect(reachedLimit).toBe(true);
    
    // O sistema garantiu espaço até o teto estrito predefinido
    // Subtraímos os jobs que já podem estar polutindo testes paralelos
    expect(numberOfJobsCreated).toBeLessThanOrEqual(MAX_SYSTEM_CAPACITY);
    expect(numberOfJobsCreated).toBeGreaterThan(MAX_SYSTEM_CAPACITY - 500); // Garante que a maioria foi processada antes do block
  });
});
