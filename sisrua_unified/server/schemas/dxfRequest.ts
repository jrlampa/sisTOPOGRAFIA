import { z } from "zod";

const btRamalSchema = z.object({
  id: z.string().min(1),
  quantity: z.coerce.number().min(0),
  ramalType: z.string().optional(),
  notes: z.string().trim().max(80).optional(),
});

const btPoleSchema = z.object({
  id: z.string().min(1),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  title: z.string().min(1),
  verified: z.boolean().optional(),
  equipmentNotes: z.string().trim().max(500).optional(),
  generalNotes: z.string().trim().max(500).optional(),
  btStructures: z
    .object({
      si1: z.string().trim().max(120).optional(),
      si2: z.string().trim().max(120).optional(),
      si3: z.string().trim().max(120).optional(),
      si4: z.string().trim().max(120).optional(),
    })
    .optional(),
  conditionStatus: z
    .enum(["bom_estado", "desaprumado", "trincado", "condenado"])
    .optional(),
  ramais: z.array(btRamalSchema).optional(),
  poleSpec: z
    .object({
      heightM: z.coerce.number().positive().optional(),
      nominalEffortDan: z.coerce.number().positive().optional(),
    })
    .optional(),
});

const btTransformerSchema = z.object({
  id: z.string().min(1),
  poleId: z.string().optional(),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  title: z.string().min(1),
  projectPowerKva: z.coerce.number().min(0).optional(),
  demandKva: z.coerce.number().min(0).optional(),
  demandKw: z.coerce.number().min(0).optional(),
  verified: z.boolean().optional(),
});

const btConductorSchema = z.object({
  id: z.string().min(1),
  quantity: z.coerce.number().min(0),
  conductorName: z.string().min(1),
});

const btEdgeSchema = z.object({
  id: z.string().min(1),
  fromPoleId: z.string().min(1),
  toPoleId: z.string().min(1),
  lengthMeters: z.coerce.number().min(0).optional(),
  verified: z.boolean().optional(),
  conductors: z.array(btConductorSchema),
});

const btAccumulatedPoleSchema = z
  .object({
    poleId: z.string().min(1),
    title: z.string().optional(),
    accumulatedClients: z.coerce.number().min(0),
    accumulatedDemandKva: z.coerce.number().min(0),
  })
  .passthrough();

const btTopologySchema = z.object({
  poles: z.array(btPoleSchema),
  transformers: z.array(btTransformerSchema),
  edges: z.array(btEdgeSchema),
});

const cqtDmdiInputSchema = z.object({
  clandestinoEnabled: z.boolean(),
  aa24DemandBase: z.coerce.number(),
  sumClientsX: z.coerce.number(),
  ab35LookupDmdi: z.coerce.number(),
});

const cqtGeralInputSchema = z.object({
  pontoRamal: z.string().min(1),
  qtMttr: z.coerce.number(),
  esqCqtByPonto: z.record(z.string(), z.coerce.number()),
  dirCqtByPonto: z.record(z.string(), z.coerce.number()),
});

const cqtDbInputSchema = z.object({
  trAtual: z.coerce.number(),
  demAtual: z.coerce.number(),
  qtMt: z.coerce.number(),
  trafosZ: z
    .array(
      z.object({
        trafoKva: z.coerce.number(),
        qtFactor: z.coerce.number(),
      }),
    )
    .optional(),
});

const cqtBranchInputSchema = z.object({
  trechoId: z.string().min(1),
  fase: z.enum(["MONO", "BIF", "TRI"]),
  acumuladaKva: z.coerce.number(),
  eta: z.coerce.number().positive(),
  tensaoTrifasicaV: z.coerce.number().positive(),
  conductorName: z.string().min(1),
  lengthMeters: z.coerce.number().min(0).optional(),
  temperatureC: z.coerce.number().optional(),
  ponto: z.string().min(1).optional(),
  lado: z.enum(["ESQUERDO", "DIREITO"]).optional(),
});

const cqtComputationInputsSchema = z.object({
  scenario: z.enum(["atual", "proj1", "proj2"]).optional(),
  qtPontoCalculationMethod: z
    .enum(["impedance_modulus", "power_factor"])
    .optional(),
  powerFactor: z.coerce.number().positive().max(1).optional(),
  dmdi: cqtDmdiInputSchema.optional(),
  geral: cqtGeralInputSchema.optional(),
  db: cqtDbInputSchema.optional(),
  branches: z.array(cqtBranchInputSchema).optional(),
});

const btContextSchema = z.object({
  projectType: z.enum(["ramais", "geral", "clandestino"]),
  btNetworkScenario: z.enum(["asis", "projeto", "proj1", "proj2"]).optional(),
  clandestinoAreaM2: z.coerce.number().min(0).optional(),
  totalTransformers: z.coerce.number().min(0).optional(),
  totalPoles: z.coerce.number().min(0).optional(),
  totalEdges: z.coerce.number().min(0).optional(),
  verifiedTransformers: z.coerce.number().min(0).optional(),
  verifiedPoles: z.coerce.number().min(0).optional(),
  verifiedEdges: z.coerce.number().min(0).optional(),
  accumulatedByPole: z.array(btAccumulatedPoleSchema).optional(),
  criticalPole: btAccumulatedPoleSchema.nullable().optional(),
  topology: btTopologySchema.nullable().optional(),
  cqtComputationInputs: cqtComputationInputsSchema.optional(),
});

const mtPoleSchema = z.object({
  id: z.string().min(1),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  title: z.string().min(1),
  verified: z.boolean().optional(),
  mtStructures: z
    .object({
      n1: z.string().trim().max(120).optional(),
      n2: z.string().trim().max(120).optional(),
      n3: z.string().trim().max(120).optional(),
      n4: z.string().trim().max(120).optional(),
    })
    .optional(),
});

const mtEdgeSchema = z.object({
  id: z.string().min(1),
  fromPoleId: z.string().min(1),
  toPoleId: z.string().min(1),
  lengthMeters: z.coerce.number().min(0).optional(),
  verified: z.boolean().optional(),
  edgeChangeFlag: z.enum(["existing", "new", "remove", "replace"]).optional(),
});

const mtTopologySchema = z.object({
  poles: z.array(mtPoleSchema),
  edges: z.array(mtEdgeSchema).optional(),
});

const mtContextSchema = z.object({
  topology: mtTopologySchema.nullable().optional(),
});

// polygon: accepts a JSON string or a coordinate array; max 500 points to prevent DoS
const polygonSchema = z
  .union([
    z.string().max(50_000), // serialized JSON string
    z.array(z.tuple([z.number(), z.number()])).max(500), // [[lon,lat], ...]
  ])
  .nullish();

// layers: keys must be plain identifiers, values coerced to bool/unknown
const layersSchema = z
  .record(
    z
      .string()
      .max(64)
      .regex(/^[\w-]+$/),
    z.unknown(),
  )
  .nullish();

const dxfRequestSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().min(10).max(5000),
  mode: z.enum(["circle", "polygon", "bbox"]),
  projection: z
    .string()
    .max(32)
    .regex(/^[\w-]+$/)
    .optional(),
  contourRenderMode: z.enum(["spline", "polyline"]).optional(),
  polygon: polygonSchema,
  layers: layersSchema,
  btContext: btContextSchema.nullish(),
  mtContext: mtContextSchema.nullish(),
});

export { dxfRequestSchema };
