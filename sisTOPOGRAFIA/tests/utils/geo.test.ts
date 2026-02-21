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
    // Coordenadas de teste padronizadas do memory.md: 23K 788547 7634925
    const result = parseUtmQuery('23K 788547 7634925');
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
