import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearCache,
  findConductorByName,
  listConductorsByCategory,
} from '../../src/services/conductorCatalogRepository';
import { listActivePoles } from '../../src/services/poleCatalogRepository';

describe('Catalog repositories mapping (node contract)', () => {
  beforeEach(() => {
    clearCache();
    vi.restoreAllMocks();
  });

  it('conductor repository deve normalizar campos numéricos string para number', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [
            {
              id: '2',
              conductor_id: '70 Al - MX',
              display_name: '70 mm² Alumínio Meia Dura',
              material: 'Al',
              category: 'BT',
              section_mm2: '70.00',
              diameter_mm: '9.450',
              resistance_ohm_per_km: '0.61800',
              weight_kg_per_km: '0.1910',
              tensile_strength_dan: '1700.00',
              is_active: true,
              created_at: '2026-05-15T13:46:27.182Z',
              updated_at: '2026-05-15T13:46:27.182Z',
            },
          ],
        }),
      })
    );

    const result = await listConductorsByCategory('BT');

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(2);
    expect(result[0].sectionMm2).toBe(70);
    expect(result[0].diameterMm).toBe(9.45);
    expect(result[0].resistanceOhmPerKm).toBe(0.618);
    expect(result[0].weightKgPerKm).toBe(0.191);
    expect(result[0].tensileStrengthDan).toBe(1700);
  });

  it('conductor repository deve retornar null em lookup sem item', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ item: null }),
      })
    );

    const result = await findConductorByName('CONDUTOR-INEXISTENTE');
    expect(result).toBeNull();
  });

  it('pole repository deve normalizar id e métricas numéricas', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [
            {
              id: '1',
              pole_id: '8.5m-150daN-CC',
              display_name: '8,5 m / 150 daN - Concreto Circular',
              material: 'CC',
              pole_type: 'circular',
              height_m: '8.50',
              nominal_effort_dan: '150.00',
              is_active: true,
            },
          ],
        }),
      })
    );

    const result = await listActivePoles();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
    expect(result[0].heightM).toBe(8.5);
    expect(result[0].nominalEffortDan).toBe(150);
  });

  it('repositories devem retornar array vazio quando fetch falhar', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));

    const [conductors, poles] = await Promise.all([
      listConductorsByCategory('BT'),
      listActivePoles(),
    ]);

    expect(conductors).toEqual([]);
    expect(poles).toEqual([]);
  });
});
