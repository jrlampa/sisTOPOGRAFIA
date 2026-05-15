import type { CanonicalConductorEntry, ConductorCatalogEntry } from '../types.canonical';

type ConductorCategory = 'BT' | 'MT' | 'HV' | 'EHV';
type ConductorMaterial = 'Al' | 'Cu' | 'Al-CONC' | 'Other';

interface CatalogApiResponse<T> {
  items?: T[];
  item?: T | null;
}

interface ConductorCatalogResponse {
  id: number | string;
  conductor_id: string;
  display_name: string;
  material: string;
  category: string;
  stranding_type?: string;
  section_mm2?: number | string;
  diameter_mm?: number | string;
  number_of_strands?: number | string;
  resistance_ohm_per_km?: number | string;
  reactance_mohm_per_km?: number | string;
  conductivity_siemens?: number | string;
  weight_kg_per_km?: number | string;
  tensile_strength_dan?: number | string;
  breaking_load_dan?: number | string;
  elastic_modulus_pa?: number | string;
  max_temperature_celsius?: number | string;
  coefficient_temp_res_per_c?: number | string;
  standard?: string;
  norm_document?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const CACHE_TTL = 5 * 60 * 1000;

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const conductorCache = new Map<string, CacheEntry<ConductorCatalogEntry>>();
const conductorByNameCache = new Map<string, CacheEntry<ConductorCatalogEntry | null>>();

const isCacheValid = (timestamp: number): boolean => Date.now() - timestamp < CACHE_TTL;

const toOptionalNumber = (value: number | string | undefined): number | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const mapToConductorCatalogEntry = (row: ConductorCatalogResponse): ConductorCatalogEntry => ({
  id: Number(row.id),
  conductorId: row.conductor_id,
  displayName: row.display_name,
  material: row.material as ConductorMaterial,
  category: row.category as ConductorCategory,
  strandingType: row.stranding_type,
  sectionMm2: toOptionalNumber(row.section_mm2),
  diameterMm: toOptionalNumber(row.diameter_mm),
  numberOfStrands: toOptionalNumber(row.number_of_strands),
  resistanceOhmPerKm: toOptionalNumber(row.resistance_ohm_per_km),
  reactanceMohmsPerKm: toOptionalNumber(row.reactance_mohm_per_km),
  conductivitySiemens: toOptionalNumber(row.conductivity_siemens),
  weightKgPerKm: toOptionalNumber(row.weight_kg_per_km),
  tensileStrengthDan: toOptionalNumber(row.tensile_strength_dan),
  breakingLoadDan: toOptionalNumber(row.breaking_load_dan),
  elasticModulusPa: toOptionalNumber(row.elastic_modulus_pa),
  maxTemperatureCelsius: toOptionalNumber(row.max_temperature_celsius),
  coefficientTempResPerC: toOptionalNumber(row.coefficient_temp_res_per_c),
  standard: row.standard,
  normDocument: row.norm_document,
  isActive: row.is_active,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

async function fetchCatalog<T>(url: string): Promise<CatalogApiResponse<T> | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as CatalogApiResponse<T>;
  } catch {
    return null;
  }
}

export async function findConductorById(
  conductorId: string
): Promise<ConductorCatalogEntry | null> {
  const cached = conductorCache.get(conductorId);
  if (cached && isCacheValid(cached.timestamp)) {
    return cached.data;
  }

  const encoded = encodeURIComponent(conductorId);
  const payload = await fetchCatalog<ConductorCatalogResponse>(
    `/api/catalog/conductors/lookup?name=${encoded}`
  );

  const row = payload?.item;
  if (!row) {
    return null;
  }

  const entry = mapToConductorCatalogEntry(row);
  conductorCache.set(conductorId, { data: entry, timestamp: Date.now() });
  return entry;
}

export async function findConductorByName(name: string): Promise<ConductorCatalogEntry | null> {
  const cacheKey = `by_name:${name}`;
  const cached = conductorByNameCache.get(cacheKey);
  if (cached && isCacheValid(cached.timestamp)) {
    return cached.data;
  }

  const encoded = encodeURIComponent(name);
  const payload = await fetchCatalog<ConductorCatalogResponse>(
    `/api/catalog/conductors/lookup?name=${encoded}`
  );

  const row = payload?.item;
  const entry = row ? mapToConductorCatalogEntry(row) : null;
  conductorByNameCache.set(cacheKey, { data: entry, timestamp: Date.now() });

  if (entry) {
    conductorCache.set(entry.conductorId, { data: entry, timestamp: Date.now() });
  }

  return entry;
}

export async function listConductorsByCategory(
  category: ConductorCategory
): Promise<ConductorCatalogEntry[]> {
  const payload = await fetchCatalog<ConductorCatalogResponse>(
    `/api/catalog/conductors?category=${encodeURIComponent(category)}`
  );

  return (payload?.items ?? []).map(mapToConductorCatalogEntry);
}

export async function listConductorsByMaterial(
  material: ConductorMaterial
): Promise<ConductorCatalogEntry[]> {
  const payload = await fetchCatalog<ConductorCatalogResponse>(
    `/api/catalog/conductors?material=${encodeURIComponent(material)}`
  );

  return (payload?.items ?? []).map(mapToConductorCatalogEntry);
}

export async function listAllConductors(): Promise<ConductorCatalogEntry[]> {
  const payload = await fetchCatalog<ConductorCatalogResponse>('/api/catalog/conductors');

  return (payload?.items ?? []).map(mapToConductorCatalogEntry);
}

export async function enrichConductorEntry(
  entry: CanonicalConductorEntry
): Promise<CanonicalConductorEntry> {
  const catalogData = await findConductorByName(entry.conductorName);
  if (catalogData) {
    entry.catalogData = catalogData;
  }
  return entry;
}

export async function enrichConductorEntries(
  entries: CanonicalConductorEntry[]
): Promise<CanonicalConductorEntry[]> {
  return Promise.all(entries.map(item => enrichConductorEntry(item)));
}

export async function isConductorNameValid(name: string): Promise<boolean> {
  const conductor = await findConductorByName(name);
  return conductor !== null;
}

export async function validateConductorNames(names: string[]): Promise<{
  valid: string[];
  invalid: string[];
}> {
  const checks = await Promise.all(
    names.map(async name => ({
      name,
      valid: await isConductorNameValid(name),
    }))
  );

  return {
    valid: checks.filter(item => item.valid).map(item => item.name),
    invalid: checks.filter(item => !item.valid).map(item => item.name),
  };
}

export async function createConductor(
  _data: Omit<ConductorCatalogEntry, 'id' | 'createdAt' | 'updatedAt'>
): Promise<ConductorCatalogEntry | null> {
  console.warn('[ConductorCatalog] createConductor não suportado no cliente web');
  return null;
}

export async function updateConductor(
  _id: number,
  _data: Partial<ConductorCatalogEntry>
): Promise<ConductorCatalogEntry | null> {
  console.warn('[ConductorCatalog] updateConductor não suportado no cliente web');
  return null;
}

export async function deactivateConductor(_id: number): Promise<boolean> {
  console.warn('[ConductorCatalog] deactivateConductor não suportado no cliente web');
  return false;
}

export function clearCache(): void {
  conductorCache.clear();
  conductorByNameCache.clear();
}

export function getCacheStats(): {
  conductorCacheSize: number;
  conductorByNameCacheSize: number;
  totalCacheSize: number;
} {
  return {
    conductorCacheSize: conductorCache.size,
    conductorByNameCacheSize: conductorByNameCache.size,
    totalCacheSize: conductorCache.size + conductorByNameCache.size,
  };
}
