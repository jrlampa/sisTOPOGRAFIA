// Mock logger before importing the service
jest.mock('../utils/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
    }
}));

import { ElevationService } from '../services/elevationService';

// Mock global fetch for getElevationProfile tests
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

beforeEach(() => {
    mockFetch.mockClear();
});

describe('ElevationService', () => {
  describe('calculateDistance', () => {
    it('should calculate distance between two close points', () => {
      const start = { lat: -23.5505, lng: -46.6333 };
      const end = { lat: -23.5506, lng: -46.6334 };
      const distance = ElevationService.calculateDistance(start, end);
      
      // Distance should be around 15 meters
      expect(distance).toBeGreaterThan(10);
      expect(distance).toBeLessThan(20);
    });

    it('should return 0 for same points', () => {
      const point = { lat: -23.5505, lng: -46.6333 };
      const distance = ElevationService.calculateDistance(point, point);
      expect(distance).toBeCloseTo(0, 5);
    });

    it('should calculate distance between distant points', () => {
      const start = { lat: -23.5505, lng: -46.6333 }; // São Paulo
      const end = { lat: -22.9068, lng: -43.1729 }; // Rio de Janeiro
      const distance = ElevationService.calculateDistance(start, end);
      
      // Distance should be around 350-400km
      expect(distance).toBeGreaterThan(350000);
      expect(distance).toBeLessThan(450000);
    });

    it('deve calcular distância usando coordenadas de teste padrão do projeto', () => {
      // Coordenadas de teste padronizadas: -22.15018, -42.92185
      const start = { lat: -22.15018, lng: -42.92185 };
      const end = { lat: -22.15018 + 0.0045, lng: -42.92185 }; // ~500m norte
      const distance = ElevationService.calculateDistance(start, end);
      expect(distance).toBeGreaterThan(400);
      expect(distance).toBeLessThan(600);
    });

    it('deve retornar valor positivo para quaisquer dois pontos distintos', () => {
      const start = { lat: 0, lng: 0 };
      const end = { lat: 1, lng: 1 };
      expect(ElevationService.calculateDistance(start, end)).toBeGreaterThan(0);
    });
  });

  describe('getElevationProfile', () => {
    const start = { lat: -22.15018, lng: -42.92185 };
    const end = { lat: -22.15518, lng: -42.92685 };

    it('deve retornar array com steps+1 pontos quando API responde com sucesso', async () => {
      const steps = 5;
      const mockResults = Array.from({ length: steps + 1 }, (_, i) => ({
        elevation: 100 + i * 2
      }));
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: mockResults })
      });

      const profile = await ElevationService.getElevationProfile(start, end, steps);
      expect(profile).toHaveLength(steps + 1);
      expect(profile[0]).toHaveProperty('dist');
      expect(profile[0]).toHaveProperty('elev');
    });

    it('deve retornar dados de fallback (terreno plano) quando API falha', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      const steps = 10;
      const profile = await ElevationService.getElevationProfile(start, end, steps);
      expect(profile).toHaveLength(steps + 1);
      // Fallback retorna elevação 0
      expect(profile.every((p: any) => p.elev === 0)).toBe(true);
    });

    it('deve retornar fallback quando erro não-Error é lançado (cobre String(error))', async () => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      mockFetch.mockRejectedValueOnce('non-error rejection');
      const profile = await ElevationService.getElevationProfile(start, end, 5);
      expect(profile).toHaveLength(6);
      expect(profile.every((p: any) => p.elev === 0)).toBe(true);
    });

    it('deve retornar fallback quando API retorna status não-ok', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable'
      });
      const profile = await ElevationService.getElevationProfile(start, end, 5);
      expect(profile).toHaveLength(6);
      expect(profile.every((p: any) => p.elev === 0)).toBe(true);
    });

    it('o primeiro ponto deve ter dist=0', async () => {
      const steps = 4;
      const mockResults = Array.from({ length: steps + 1 }, () => ({ elevation: 50 }));
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: mockResults })
      });
      const profile = await ElevationService.getElevationProfile(start, end, steps);
      expect(profile[0].dist).toBe(0);
    });

    it('deve usar 25 steps por padrão', async () => {
      const mockResults = Array.from({ length: 26 }, () => ({ elevation: 200 }));
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: mockResults })
      });
      const profile = await ElevationService.getElevationProfile(start, end);
      expect(profile).toHaveLength(26);
    });
  });
});

