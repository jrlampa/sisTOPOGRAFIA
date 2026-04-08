/**
 * Frontend input validation using Zod.
 * Ensures data integrity before sending to backend.
 */
import { z } from 'zod';

// ── Geographic inputs ───────────────────────────────────────────────────────

export const LatLngSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  label: z.string().optional(),
});

export const RadiusSchema = z.number().min(100).max(50000).int();

export const PolygonSchema = z.array(LatLngSchema).min(3).max(1000);

// ── DXF export inputs ───────────────────────────────────────────────────────

export const LayerConfigSchema = z.record(z.string(), z.boolean());

export const ProjectionSchema = z.enum(['local', 'utm']);

export const ContourRenderModeSchema = z.enum(['spline', 'polyline']);

export const SelectionModeSchema = z.enum(['circle', 'polygon', 'measure']);

export const DxfExportSchema = z.object({
  center: LatLngSchema,
  radius: RadiusSchema,
  selectionMode: SelectionModeSchema,
  polygon: z.array(LatLngSchema).default([]),
  layers: LayerConfigSchema,
  projection: ProjectionSchema.default('utm'),
  contourRenderMode: ContourRenderModeSchema.default('spline'),
});

// ── Application settings ────────────────────────────────────────────────────

export const AppSettingsSchema = z.object({
  enableAI: z.boolean().default(true),
  simplificationLevel: z.enum(['low', 'medium', 'high']).default('low'),
  orthogonalize: z.boolean().default(true),
  contourRenderMode: ContourRenderModeSchema.default('spline'),
  projection: ProjectionSchema.default('utm'),
  theme: z.enum(['dark', 'light']).default('dark'),
  mapProvider: z.enum(['vector', 'satellite']).default('vector'),
  contourInterval: z.number().min(1).max(100).int().default(5),
  projectType: z.enum(['ramais', 'clandestino']).default('ramais'),
  btNetworkScenario: z.enum(['asis', 'projeto', 'proj1', 'proj2']).default('asis'),
  btEditorMode: z.enum(['none', 'add-pole', 'add-edge', 'add-transformer', 'move-pole']).default('none'),
  btTransformerCalculationMode: z.enum(['automatic', 'manual']).default('automatic'),
  clandestinoAreaM2: z.number().nonnegative().int().default(0),
});

// ── Coordinate parsing ──────────────────────────────────────────────────────

/**
 * Parse and validate coordinate input.
 * Supports: "-22.9068 -43.1729" or "23K 635806 7462003" (UTM)
 */
export function parseAndValidateCoordinates(input: string): { lat: number; lng: number } | null {
  const trimmed = input.trim();
  
  // LatLng format: "-22.9068 -43.1729"
  const latLngMatch = trimmed.match(/^(-?\d+\.?\d*)\s+(-?\d+\.?\d*)$/);
  if (latLngMatch) {
    const lat = parseFloat(latLngMatch[1]);
    const lng = parseFloat(latLngMatch[2]);
    try {
      LatLngSchema.parse({ lat, lng });
      return { lat, lng };
    } catch {
      return null;
    }
  }
  
  return null;
}

// ── Safe file name validation ────────────────────────────────────────────────

const SafeFilenameSchema = z.string().regex(/^[\w\-\.]+$/).max(255);

export function validateFilename(filename: string): boolean {
  return SafeFilenameSchema.safeParse(filename).success;
}

// ── Batch operations ────────────────────────────────────────────────────────

export function validateDxfExportInputs(
  center: unknown,
  radius: unknown,
  selectionMode: unknown,
  polygon: unknown,
  layers: unknown
): boolean {
  try {
    LatLngSchema.parse(center);
    RadiusSchema.parse(radius);
    SelectionModeSchema.parse(selectionMode);
    PolygonSchema.parse(polygon);
    LayerConfigSchema.parse(layers);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate all application settings before state save.
 */
export function validateAppSettings(settings: unknown): settings is z.infer<typeof AppSettingsSchema> {
  return AppSettingsSchema.safeParse(settings).success;
}
