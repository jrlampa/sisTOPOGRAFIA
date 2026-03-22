import { z } from 'zod';

/**
 * Validation schemas for API endpoints
 * Ensures all input data meets security and business requirements
 */

// Search endpoint schema
export const searchSchema = z.object({
    query: z.string()
        .min(1, 'Query cannot be empty')
        .max(500, 'Query too long')
        .trim()
});

// Elevation profile endpoint schema
export const elevationProfileSchema = z.object({
    start: z.object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180)
    }),
    end: z.object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180)
    }),
    steps: z.number().int().min(2).max(100).optional().default(25)
});

// Analysis endpoint schema
export const analysisSchema = z.object({
    stats: z.object({
        // OSM statistics
        buildings: z.number().int().nonnegative().optional(),
        roads: z.number().int().nonnegative().optional(),
        water: z.number().int().nonnegative().optional(),
        landuse: z.number().int().nonnegative().optional(),
        railways: z.number().int().nonnegative().optional(),
        // Additional fields
        totalElements: z.number().int().nonnegative().optional(),
        area: z.number().nonnegative().optional()
    }).passthrough(), // Allow additional fields but validate known ones
    locationName: z.string()
        .min(1, 'Location name required')
        .max(200, 'Location name too long')
        .trim()
        .optional()
});

// Polygon schema for DXF requests with polygon mode
export const polygonSchema = z.object({
    type: z.literal('Polygon'),
    coordinates: z.array(
        z.array(
            z.tuple([
                z.number().min(-180).max(180), // longitude
                z.number().min(-90).max(90)     // latitude
            ])
        ).min(4, 'Polygon must have at least 4 points (3 vertices + closing point)')
    ).max(1000, 'Polygon too complex (max 1000 points)')
}).strict();

// Layers configuration schema
export const layersSchema = z.object({
    buildings: z.boolean().optional(),
    roads: z.boolean().optional(),
    water: z.boolean().optional(),
    landuse: z.boolean().optional(),
    railways: z.boolean().optional()
}).strict();

// Extended DXF request schema with polygon and layers
export const dxfRequestExtendedSchema = z.object({
    lat: z.coerce.number().min(-90).max(90),
    lon: z.coerce.number().min(-180).max(180),
    radius: z.coerce.number().min(10).max(5000),
    mode: z.enum(['circle', 'polygon', 'bbox']),
    polygon: polygonSchema.optional(),
    layers: layersSchema.optional(),
    projection: z.enum(['local', 'utm']).optional()
});

// Analyze Pad (terraplenagem) endpoint schema
export const analyzePadSchema = z.object({
    polygon: z.string()
        .min(1, 'Polígono é obrigatório')
        .max(50000, 'Polígono muito complexo (limite: 50.000 caracteres)'),
    target_z: z.coerce.number()
        .min(-500, 'Cota alvo inválida (mínimo: -500m)')
        .max(9000, 'Cota alvo inválida (máximo: 9000m)'),
    autoBalance: z.coerce.boolean().optional().default(false)
});

// Batch row schema (for CSV processing)
export const batchRowSchema = z.object({
    name: z.string()
        .min(1, 'Name required')
        .max(100, 'Name too long')
        .regex(/^[a-zA-Z0-9_-]+$/, 'Name must be alphanumeric with underscores/hyphens only'),
    lat: z.coerce.number().min(-90).max(90),
    lon: z.coerce.number().min(-180).max(180),
    radius: z.coerce.number().min(10).max(5000),
    mode: z.enum(['circle', 'polygon', 'bbox']).optional().default('circle')
});
