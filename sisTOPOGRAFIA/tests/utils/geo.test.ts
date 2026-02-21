import { describe, it, expect } from 'vitest';
import { osmToGeoJSON, parseUtmQuery } from '../../src/utils/geo';
import type { OsmElement } from '../../src/types';

describe('osmToGeoJSON', () => {
  it('deve retornar null para entrada nula', () => {
    expect(osmToGeoJSON(null)).toBeNull();
  });

  it('deve retornar FeatureCollection vazia para array vazio', () => {
    const result = osmToGeoJSON([]);
    expect(result).toEqual({ type: 'FeatureCollection', features: [] });
  });

  it('deve converter node OSM para Feature do tipo Point', () => {
    const elements: OsmElement[] = [
      { type: 'node', id: 1, lat: -22.15, lon: -42.92, tags: { name: 'Marco A' } }
    ];
    const result = osmToGeoJSON(elements);
    expect(result.type).toBe('FeatureCollection');
    expect(result.features).toHaveLength(1);
    expect(result.features[0].geometry.type).toBe('Point');
    expect(result.features[0].geometry.coordinates).toEqual([-42.92, -22.15]);
    expect(result.features[0].properties.name).toBe('Marco A');
  });

  it('deve converter way OSM com geometry para Feature do tipo LineString', () => {
    const elements: OsmElement[] = [
      {
        type: 'way',
        id: 100,
        nodes: [1, 2],
        geometry: [
          { lat: -22.15, lon: -42.92 },
          { lat: -22.16, lon: -42.93 }
        ],
        tags: { highway: 'residential' }
      }
    ];
    const result = osmToGeoJSON(elements);
    expect(result.features).toHaveLength(1);
    expect(result.features[0].geometry.type).toBe('LineString');
    expect(result.features[0].geometry.coordinates).toEqual([
      [-42.92, -22.15],
      [-42.93, -22.16]
    ]);
  });

  it('deve ignorar way sem geometry (retorna null, filtrado)', () => {
    const elements: OsmElement[] = [
      { type: 'way', id: 200, nodes: [1, 2], tags: { highway: 'road' } }
    ];
    const result = osmToGeoJSON(elements);
    expect(result.features).toHaveLength(0);
  });

  it('deve ignorar relation (retorna null, filtrado)', () => {
    const elements: OsmElement[] = [
      { type: 'relation', id: 300, members: [], tags: { type: 'multipolygon' } }
    ];
    const result = osmToGeoJSON(elements);
    expect(result.features).toHaveLength(0);
  });

  it('deve filtrar features nulas e retornar apenas as válidas', () => {
    const elements: OsmElement[] = [
      { type: 'node', id: 1, lat: -22.15, lon: -42.92, tags: {} },
      { type: 'relation', id: 2, members: [], tags: {} },
      { type: 'node', id: 3, lat: -22.16, lon: -42.93, tags: { amenity: 'school' } }
    ];
    const result = osmToGeoJSON(elements);
    expect(result.features).toHaveLength(2);
  });

  it('deve usar objeto vazio quando tags é undefined', () => {
    const elements: OsmElement[] = [
      { type: 'node', id: 1, lat: -22.15, lon: -42.92 }
    ];
    const result = osmToGeoJSON(elements);
    expect(result.features[0].properties).toEqual({});
  });

  it('deve disparar evento uc-detected para elementos com tag is_uc (linhas 61-72)', () => {
    // Arrange: element with UC metadata triggers CustomEvent dispatch
    const dispatched: Event[] = [];
    const handler = (e: Event) => dispatched.push(e);
    window.addEventListener('uc-detected', handler);

    // Clear any previous uc_toasted set from other tests
    (window as any).__uc_toasted = undefined;

    const elements: OsmElement[] = [
      {
        type: 'node',
        id: 999,
        lat: -22.15,
        lon: -42.92,
        tags: { is_uc: 'yes', sisTOPO_type: 'UC_Estadual', name: 'Parque Teste' }
      }
    ];

    osmToGeoJSON(elements);

    // Should have fired one uc-detected event
    expect(dispatched).toHaveLength(1);
    const detail = (dispatched[0] as CustomEvent).detail;
    expect(detail.name).toBe('Parque Teste');
    expect(detail.type).toBe('UC_Estadual');

    // Second call with same name: should NOT dispatch again (deduplication via __uc_toasted)
    dispatched.length = 0;
    osmToGeoJSON(elements);
    expect(dispatched).toHaveLength(0);

    window.removeEventListener('uc-detected', handler);
  });
});

describe('parseUtmQuery', () => {
  it('deve retornar null para string inválida', () => {
    expect(parseUtmQuery('texto invalido')).toBeNull();
  });

  it('deve retornar null para zona UTM fora do intervalo (0)', () => {
    expect(parseUtmQuery('0K 788547 7634925')).toBeNull();
  });

  it('deve retornar null para string vazia', () => {
    expect(parseUtmQuery('')).toBeNull();
  });

  it('deve converter coordenadas UTM sul para WGS84', () => {
    // Coordenadas de teste padronizadas: 23K 714316 7549084 → -22.15018, -42.92185
    const result = parseUtmQuery('23K 714316 7549084');
    expect(result).not.toBeNull();
    expect(result!.lat).toBeCloseTo(-22.15, 0);
    expect(result!.lng).toBeCloseTo(-42.92, 0);
    expect(result!.label).toContain('UTM 23K');
  });

  it('deve converter coordenadas UTM norte para WGS84', () => {
    // UTM Zona 30U (hemisfério norte) — Londres, Reino Unido (~51.5°N)
    const result = parseUtmQuery('30U 699400 5710100');
    expect(result).not.toBeNull();
    expect(result!.lat).toBeGreaterThan(0);
    expect(result!.label).toContain('UTM 30U');
  });
});
