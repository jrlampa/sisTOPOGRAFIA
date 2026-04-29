import { vi } from "vitest";
/**
 * ─────────────────────────────────────────────────────────────────────────────
 * FaultInjector — Primitivas de Caos para sisRUA Unified
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Fornece "perturbadores" reutilizáveis que simulam falhas reais:
 *   - Falhas de rede intermitentes (OSM, Elevation, IBGE)
 *   - Disconexão de banco de dados mid-job
 *   - Erros de filesystem (ENOSPC, EPERM, ENOENT)
 *   - Timeouts e slowdowns no Python engine
 *   - Pressão de memória no cache de jobs
 *   - Race conditions em requisições simultâneas
 *   - Geração de pontos geográficos aleatórios (property-based)
 */

// ── Coordenadas do Brasil ────────────────────────────────────────────────────
export const BRAZIL_BOUNDS = {
  lat: { min: -33.75, max: 5.27 },
  lng: { min: -73.98, max: -28.85 },
};

/** Coordenadas de cidades brasileiras reais para testes. */
export const BRAZIL_CITIES: Array<{ name: string; lat: number; lng: number }> = [
  { name: 'São Paulo',       lat: -23.5505, lng: -46.6333 },
  { name: 'Rio de Janeiro',  lat: -22.9068, lng: -43.1729 },
  { name: 'Belo Horizonte',  lat: -19.9191, lng: -43.9386 },
  { name: 'Manaus',          lat:  -3.1190, lng: -60.0217 },
  { name: 'Belém',           lat:  -1.4558, lng: -48.4902 },
  { name: 'Porto Alegre',    lat: -30.0346, lng: -51.2177 },
  { name: 'Recife',          lat:  -8.0578, lng: -34.8829 },
  { name: 'Fortaleza',       lat:  -3.7172, lng: -38.5433 },
  { name: 'Brasília',        lat: -15.7942, lng: -47.8825 },
  { name: 'Curitiba',        lat: -25.4284, lng: -49.2733 },
];

/** Casos de borda geográficos extremos. */
export const EDGE_COORDS = [
  { name: 'Extremo Norte (Roraima)',   lat:  5.27,  lng: -60.2 },
  { name: 'Extremo Sul (RS)',           lat: -33.75, lng: -53.4 },
  { name: 'Extremo Leste (João Pessoa)',lat:  -7.11, lng: -34.86 },
  { name: 'Extremo Oeste (Acre)',       lat: -10.0,  lng: -73.98 },
  { name: 'Foz do Iguaçu',             lat: -25.5,  lng: -54.59 },
  { name: 'Ponto tríplice (AM/PA/RR)',  lat:   1.0,  lng: -59.8 },
];

// ── Gerador de Pontos Aleatórios ─────────────────────────────────────────────

/** Semente determinística para reproducibilidade de testes. */
let _seed = 42;

function seededRandom(): number {
  _seed = (_seed * 1664525 + 1013904223) & 0xffffffff;
  return ((_seed >>> 0) / 0xffffffff);
}

export function resetSeed(seed = 42): void {
  _seed = seed;
}

/**
 * Gera um par lat/lng aleatório dentro do Brasil.
 * Usa gerador determinístico (seeded) para reproducibilidade.
 */
export function randomBrazilCoord(): { lat: number; lng: number } {
  const lat = BRAZIL_BOUNDS.lat.min + seededRandom() * (BRAZIL_BOUNDS.lat.max - BRAZIL_BOUNDS.lat.min);
  const lng = BRAZIL_BOUNDS.lng.min + seededRandom() * (BRAZIL_BOUNDS.lng.max - BRAZIL_BOUNDS.lng.min);
  return {
    lat: parseFloat(lat.toFixed(6)),
    lng: parseFloat(lng.toFixed(6)),
  };
}

/**
 * Gera um raio aleatório típico de usuário (100m–5km).
 */
export function randomRadius(): number {
  const options = [100, 250, 500, 750, 1000, 1500, 2000, 3000, 5000];
  return options[Math.floor(seededRandom() * options.length)];
}

/**
 * Gera N cenários de coordenadas aleatórias dentro do Brasil.
 */
export function generateRandomScenarios(count: number): Array<{
  lat: number;
  lng: number;
  radius: number;
  label: string;
}> {
  return Array.from({ length: count }, (_, i) => {
    const coord = randomBrazilCoord();
    return {
      ...coord,
      radius: randomRadius(),
      label: `Cenário aleatório #${i + 1} (${coord.lat.toFixed(3)}, ${coord.lng.toFixed(3)})`,
    };
  });
}

// ── Perturbadores de Rede ────────────────────────────────────────────────────

export type FetchBehavior = 'ok' | 'fail' | 'timeout' | 'corrupt' | 'rate-limit' | 'partial';

/**
 * Cria um mock de fetch que falha de forma aleatória (chaos fetch).
 * @param failureRate — 0.0 (nunca falha) a 1.0 (sempre falha)
 */
export function createChaosFetch(failureRate = 0.3): vi.Mock {
  return vi.fn().mockImplementation(async (url: string) => {
    const roll = Math.random();

    if (roll < failureRate * 0.3) {
      // Timeout
      return new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('AbortError: Request timed out')), 50)
      );
    }

    if (roll < failureRate * 0.6) {
      // 503 Service Unavailable (rate limit)
      return { ok: false, status: 503, statusText: 'Service Unavailable', json: async () => ({}) };
    }

    if (roll < failureRate) {
      // Quebra de rede
      throw new Error(`ECONNRESET: Network error for ${url}`);
    }

    // Sucesso
    return {
      ok: true,
      status: 200,
      json: async () => ({ results: [] }),
      arrayBuffer: async () => new ArrayBuffer(0),
    };
  });
}

/**
 * Cria um mock de fetch que falha somente para URLs específicas.
 */
export function createSelectiveFetch(
  failOn: string[],
  fallbackData: any = {}
): vi.Mock {
  return vi.fn().mockImplementation(async (url: string) => {
    const shouldFail = failOn.some((pattern) => url.includes(pattern));
    if (shouldFail) {
      throw new Error(`Injected failure for URL: ${url}`);
    }
    return { ok: true, status: 200, json: async () => fallbackData };
  });
}

// ── Perturbadores de Filesystem ──────────────────────────────────────────────

export type FsErrorCode = 'ENOSPC' | 'EPERM' | 'ENOENT' | 'EACCES' | 'EMFILE';

export function makeFsError(code: FsErrorCode, path = '/tmp/file.dxf'): NodeJS.ErrnoException {
  const err = new Error(`${code}: ${path}`) as NodeJS.ErrnoException;
  err.code = code;
  err.path = path;
  return err;
}

/**
 * Cria mocks de fs que falham após N escritas bem-sucedidas.
 */
export function createFsWithFailAfter(
  successCount: number,
  failCode: FsErrorCode = 'ENOSPC'
): { writeFileSync: vi.Mock; existsSync: vi.Mock; unlinkSync: vi.Mock } {
  let writeCount = 0;
  return {
    writeFileSync: vi.fn().mockImplementation((path: string) => {
      writeCount++;
      if (writeCount > successCount) {
        throw makeFsError(failCode, path);
      }
    }),
    existsSync: vi.fn().mockReturnValue(true),
    unlinkSync: vi.fn(),
  };
}

// ── Perturbadores de Jobs ─────────────────────────────────────────────────────

/**
 * Gera N job IDs únicos para testes de concorrência.
 */
export function generateJobIds(count: number, prefix = 'chaos-job'): string[] {
  return Array.from({ length: count }, (_, i) => `${prefix}-${Date.now()}-${i}`);
}

/**
 * Simula latência variável (jitter) em um stub async.
 */
export async function withJitter<T>(fn: () => T, maxDelayMs = 20): Promise<T> {
  await new Promise((r) => setTimeout(r, Math.random() * maxDelayMs));
  return fn();
}

// ── Analisadores ─────────────────────────────────────────────────────────────

export interface ChaosResult {
  scenario: string;
  passed: boolean;
  error?: string;
  durationMs: number;
}

export async function runWithChaos<T>(
  label: string,
  fn: () => Promise<T>
): Promise<ChaosResult> {
  const start = Date.now();
  try {
    await fn();
    return { scenario: label, passed: true, durationMs: Date.now() - start };
  } catch (err: any) {
    return {
      scenario: label,
      passed: false,
      error: err.message,
      durationMs: Date.now() - start,
    };
  }
}

