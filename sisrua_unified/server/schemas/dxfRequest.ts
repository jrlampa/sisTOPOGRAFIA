import { z } from 'zod';

const btRamalSchema = z.object({
    id: z.string().min(1),
    quantity: z.coerce.number().min(0),
    ramalType: z.string().optional()
});

const btPoleSchema = z.object({
    id: z.string().min(1),
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180),
    title: z.string().min(1),
    verified: z.boolean().optional(),
    ramais: z.array(btRamalSchema).optional()
});

const btTransformerSchema = z.object({
    id: z.string().min(1),
    poleId: z.string().optional(),
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180),
    title: z.string().min(1),
    projectPowerKva: z.coerce.number().min(0).optional(),
    demandKw: z.coerce.number().min(0),
    verified: z.boolean().optional()
});

const btConductorSchema = z.object({
    id: z.string().min(1),
    quantity: z.coerce.number().min(0),
    conductorName: z.string().min(1)
});

const btEdgeSchema = z.object({
    id: z.string().min(1),
    fromPoleId: z.string().min(1),
    toPoleId: z.string().min(1),
    lengthMeters: z.coerce.number().min(0).optional(),
    verified: z.boolean().optional(),
    conductors: z.array(btConductorSchema)
});

const btAccumulatedPoleSchema = z.object({
    poleId: z.string().min(1),
    title: z.string().optional(),
    accumulatedClients: z.coerce.number().min(0),
    accumulatedDemandKva: z.coerce.number().min(0)
}).passthrough();

const btTopologySchema = z.object({
    poles: z.array(btPoleSchema),
    transformers: z.array(btTransformerSchema),
    edges: z.array(btEdgeSchema)
});

const cqtDmdiInputSchema = z.object({
    clandestinoEnabled: z.boolean(),
    aa24DemandBase: z.coerce.number(),
    sumClientsX: z.coerce.number(),
    ab35LookupDmdi: z.coerce.number()
});

const cqtGeralInputSchema = z.object({
    pontoRamal: z.string().min(1),
    qtMttr: z.coerce.number(),
    esqCqtByPonto: z.record(z.coerce.number()),
    dirCqtByPonto: z.record(z.coerce.number())
});

const cqtDbInputSchema = z.object({
    trAtual: z.coerce.number(),
    demAtual: z.coerce.number(),
    qtMt: z.coerce.number(),
    trafosZ: z.array(z.object({
        trafoKva: z.coerce.number(),
        qtFactor: z.coerce.number()
    })).optional()
});

const cqtBranchInputSchema = z.object({
    trechoId: z.string().min(1),
    fase: z.enum(['MONO', 'BIF', 'TRI']),
    acumuladaKva: z.coerce.number(),
    eta: z.coerce.number().positive(),
    tensaoTrifasicaV: z.coerce.number().positive(),
    conductorName: z.string().min(1),
    lengthMeters: z.coerce.number().min(0).optional(),
    temperatureC: z.coerce.number().optional()
});

const cqtComputationInputsSchema = z.object({
    scenario: z.enum(['atual', 'proj1', 'proj2']).optional(),
    dmdi: cqtDmdiInputSchema.optional(),
    geral: cqtGeralInputSchema.optional(),
    db: cqtDbInputSchema.optional(),
    branches: z.array(cqtBranchInputSchema).optional()
});

const btContextSchema = z.object({
    projectType: z.enum(['ramais', 'geral', 'clandestino']),
    btNetworkScenario: z.enum(['asis', 'projeto', 'proj1', 'proj2']).optional(),
    clandestinoAreaM2: z.coerce.number().min(0).optional(),
    totalTransformers: z.coerce.number().min(0),
    totalPoles: z.coerce.number().min(0),
    totalEdges: z.coerce.number().min(0),
    verifiedTransformers: z.coerce.number().min(0),
    verifiedPoles: z.coerce.number().min(0),
    verifiedEdges: z.coerce.number().min(0),
    accumulatedByPole: z.array(btAccumulatedPoleSchema),
    criticalPole: btAccumulatedPoleSchema.nullable().optional(),
    topology: btTopologySchema.nullable().optional(),
    cqtComputationInputs: cqtComputationInputsSchema.optional()
});

const dxfRequestSchema = z.object({
    lat: z.coerce.number().min(-90).max(90),
    lon: z.coerce.number().min(-180).max(180),
    radius: z.coerce.number().min(10).max(5000),
    mode: z.enum(['circle', 'polygon', 'bbox']),
    btContext: btContextSchema.nullish()
});

export { dxfRequestSchema };
