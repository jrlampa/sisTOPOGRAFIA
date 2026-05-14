import { vi } from "vitest";

declare global {
  // eslint-disable-next-line no-var
  var jest: typeof vi;
}

globalThis.jest = vi;

vi.mock("../utils/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock Redis Service to avoid connectivity issues during tests
vi.mock("../services/redisService", () => {
  const store = new Map<string, string>();
  return {
    getRedisClient: vi.fn(() => ({
      scan: vi.fn(async (cursor: string) => ['0', Array.from(store.keys())]),
      del: vi.fn(async (...keys: string[]) => {
        keys.forEach(k => store.delete(k));
      }),
      smembers: vi.fn(async (key: string) => []),
      sadd: vi.fn(async (key: string, val: string) => {}),
      expire: vi.fn(async (key: string, ttl: number) => {}),
    })),
    redisService: {
      get: vi.fn(async (key: string) => store.get(key) || null),
      set: vi.fn(async (key: string, value: string) => {
        store.set(key, value);
      }),
      del: vi.fn(async (key: string) => {
        store.delete(key);
      }),
      clear: vi.fn(async () => {
        store.clear();
      }),
      getJobKeys: vi.fn(async () => {
        return Array.from(store.keys()).filter(k => k.startsWith('job:'));
      }),
      getKeys: vi.fn(async (pattern: string) => {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        return Array.from(store.keys()).filter(k => regex.test(k));
      }),
    },
  };
});
