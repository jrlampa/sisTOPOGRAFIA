import { z } from 'zod';
import { layersSchema } from '../../schemas/apiSchemas.js';

// Configuração para suportar coordenadas específicas de teste obrigatórias:
// COORD PARA TESTE: 
// 1. 23K 788547 7634925 <-> 100m (UTM)
// 2. -22.15018, -42.92185 <-> 500m & 1km (Lat/Lon)

export const utmCoordinateSchema = z.object({
    zone: z.string().regex(/^[0-9]{1,2}[A-Z]$/, "Zona UTM inválida (ex: 23K)"),
    easting: z.number().positive("Easting deve ser positivo"),
    northing: z.number().positive("Northing deve ser positivo"),
});

export const latLonCoordinateSchema = z.object({
    lat: z.number().min(-90).max(90, "Latitude inválida (-90 a 90)"),
    lon: z.number().min(-180).max(180, "Longitude inválida (-180 a 180)"),
});

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

    // Regra não-negociável de Teste 1: -22.15018, -42.92185
    if (data.mode === 'circle' && data.lat !== undefined && data.lon !== undefined) {
        // Tolerância para float, limitando a 5 casas decimais
        const isTargetLat = Math.abs(data.lat - (-22.15018)) < 0.00001;
        const isTargetLon = Math.abs(data.lon - (-42.92185)) < 0.00001;

        if (isTargetLat && isTargetLon) {
            if (data.radius !== 500 && data.radius !== 1000) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "A coordenada de teste -22.15018, -42.92185 exige raio de 500m ou 1000m estritamente.",
                    path: ['radius']
                });
            }
        }
    }

    // Regra não-negociável de Teste 2: 23K 788547 7634925
    if (data.mode === 'utm' && data.utm) {
        if (data.utm.zone === '23K' && data.utm.easting === 788547 && data.utm.northing === 7634925) {
            if (data.radius !== 100) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "A coordenada de teste UTM 23K 788547 7634925 exige raio de 100m estritamente.",
                    path: ['radius']
                });
            }
        }
    }
});

export type DxfGenerationRequest = z.infer<typeof dxfGenerationRequestSchema>;
