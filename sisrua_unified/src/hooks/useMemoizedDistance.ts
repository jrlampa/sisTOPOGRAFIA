/**
 * Hook para cálculo memoizado de distâncias (Item 9).
 * Evita recálculos desnecessários em operações de topologia BT.
 * 
 * Pré-requisito: Foram identificadas múltiplas chamadas a distanceMeters()
 * em useBtCrudHandlers.ts sem memoização.
 * 
 * Solução: Memoizar baseado em pares de coordenadas.
 */
import { useMemo } from 'react';

type Coordinates = { lat: number; lng: number };

/** Cache LRU simples para pares de coordenadas (mantém últimas 100 combinações) */
const memoizedDistanceCache = new Map<string, number>();
const MAX_CACHE_SIZE = 100;

function cacheKey(from: Coordinates, to: Coordinates): string {
  return `${from.lat.toFixed(6)},${from.lng.toFixed(6)}-${to.lat.toFixed(6)},${to.lng.toFixed(6)}`;
}

/**
 * Calcula distância em metros entre dois pontos (Haversine).
 * Usa cache para evitar recálculos.
 */
export function distanceMetersWithCache(from: Coordinates, to: Coordinates): number {
  const key = cacheKey(from, to);
  
  if (memoizedDistanceCache.has(key)) {
    return memoizedDistanceCache.get(key)!;
  }
  
  // Fórmula Haversine
  const R = 6371000; // Terra em metros
  const dLat = ((to.lat - from.lat) * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((from.lat * Math.PI) / 180) *
      Math.cos((to.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  // Manter cache sob tamanho máximo
  if (memoizedDistanceCache.size >= MAX_CACHE_SIZE) {
    const firstKey = memoizedDistanceCache.keys().next().value;
    if (typeof firstKey === 'string') {
      memoizedDistanceCache.delete(firstKey);
    }
  }
  
  memoizedDistanceCache.set(key, distance);
  return distance;
}

/**
 * Hook React para distâncias memoizadas em uma lista de pares.
 * Útil para operações que envolvem múltiplos cálculos.
 * 
 * @example
 * const distances = useMemoizedDistances([
 *   { from: pole1, to: pole2 },
 *   { from: pole2, to: pole3 },
 * ]);
 */
export function useMemoizedDistances(
  pairs: Array<{ from: Coordinates; to: Coordinates }>
): number[] {
  return useMemo(() => {
    return pairs.map((pair) => distanceMetersWithCache(pair.from, pair.to));
  }, [JSON.stringify(pairs)]); // Nota: serialização é custo de memoização
}

/** Limpar cache se necessário (ex: antes de testes) */
export function clearMemoizedDistanceCache(): void {
  memoizedDistanceCache.clear();
}
