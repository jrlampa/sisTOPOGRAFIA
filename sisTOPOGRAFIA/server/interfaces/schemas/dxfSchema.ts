import { z } from 'zod';
import { layersSchema } from '../../schemas/apiSchemas.js';

export const utmCoordinateSchema = z.object({
    zone: z.string().regex(/^[0-9]{1,2}[A-Z]$/, "Zona UTM inválida (ex: 23K)"),
    easting: z.number().positive("Easting deve ser positivo"),
    northing: z.number().positive("Northing deve ser positivo"),
});

export const latLonCoordinateSchema = z.object({
    lat: z.number().min(-90).max(90, "Latitude inválida (-90 a 90)"),
    lon: z.number().min(-180).max(180, "Longitude inválida (-180 a 180)"),
});

const MAX_POLYGON_POINTS = 1000;

export const dxfGenerationRequestSchema = z.object({
    mode: z.enum(['circle', 'polygon', 'utm']).default('circle'),
    lat: z.number().optional(),
    lon: z.number().optional(),
    utm: utmCoordinateSchema.optional(),
    radius: z.number().min(10, "Raio mínimo de 10m").max(5000, "Raio máximo de 5000m").default(100),
    polygon: z.any().optional(), // Pode ser string JSON ou Array de Coordenadas
    layers: layersSchema.optional(),
    projection: z.enum(['local', 'utm']).default('local')
}).superRefine((data: any, ctx: z.RefinementCtx) => {
    // Validação estrita: se for UTM, precisa dos dados UTM. Se for circle, precisa de Lat/Lon.
    if (data.mode === 'utm' && !data.utm) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Modo UTM exige objeto 'utm' preenchido.",
            path: ['utm']
        });
    }

    if (data.mode === 'circle' && (data.lat === undefined || data.lon === undefined)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Modo circle exige 'lat' e 'lon'.",
            path: ['lat', 'lon']
        });
    }

    if (data.mode === 'polygon') {
        const raw = data.polygon;
        let resolved: unknown = raw;

        if (typeof raw === 'string') {
            try {
                resolved = JSON.parse(raw);
            } catch {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "Modo polygon exige 'polygon' como array de coordenadas ou JSON string válida.",
                    path: ['polygon']
                });
                return;
            }
        }

        if (!Array.isArray(resolved) || resolved.length < 3) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Modo polygon exige 'polygon' com pelo menos 3 pontos.",
                path: ['polygon']
            });
            return;
        }

        if (resolved.length > MAX_POLYGON_POINTS) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Polygon não pode ter mais de ${MAX_POLYGON_POINTS} pontos.`,
                path: ['polygon']
            });
            return;
        }

        for (const pt of resolved) {
            if (!Array.isArray(pt) || pt.length < 2) continue;
            const [lon, lat] = pt as [number, number];
            if (typeof lat !== 'number' || typeof lon !== 'number' ||
                lat < -90 || lat > 90 || lon < -180 || lon > 180) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "Polygon contém coordenadas fora dos limites válidos.",
                    path: ['polygon']
                });
                return;
            }
        }
    }
});

export type DxfGenerationRequest = z.infer<typeof dxfGenerationRequestSchema>;
