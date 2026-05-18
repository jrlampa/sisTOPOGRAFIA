/**
 * DgRunRepository – Persistência de execuções do Design Generativo.
 *
 * Estratégia:
 * 1) Tenta persistir em PostgreSQL quando disponível.
 * 2) Em caso de indisponibilidade/erro de schema, usa fallback em memória
 *    para não interromper o fluxo operacional.
 */
import { getDbClient } from "./dbClient.js";
import { logger } from "../utils/logger.js";
import type {
  DgConstraintCode,
  DgDiscardRateByConstraint,
  DgOptimizationOutput,
  DgRecommendation,
  DgRunSummary,
  DgScenario,
} from "../services/dg/dgTypes.js";

export interface IDgRunRepository {
  save(run: DgOptimizationOutput): Promise<void>;
  list(limit?: number, tenantId?: string): Promise<DgRunSummary[]>;
  listDiscardRates(
    limit?: number,
    tenantId?: string,
  ): Promise<DgDiscardRateByConstraint[]>;
  findById(
    runId: string,
    tenantId?: string,
  ): Promise<DgOptimizationOutput | null>;
  findScenarios(runId: string, tenantId?: string): Promise<DgScenario[] | null>;
  findRecommendation(
    runId: string,
    tenantId?: string,
  ): Promise<DgRecommendation | null>;
}

const MAX_IN_MEMORY_RUNS = 100;
const inMemoryRuns = new Map<string, DgOptimizationOutput>();

type DgRunOutputRow = Record<string, unknown>;
type DgDiscardRateRow = Record<string, unknown>;

/**
 * Adiciona um run ao cache em memória com política de despejo simples (FIFO-ish)
 */
function addToInMemoryCache(run: DgOptimizationOutput) {
  if (inMemoryRuns.size >= MAX_IN_MEMORY_RUNS) {
    const firstKey = inMemoryRuns.keys().next().value;
    if (firstKey !== undefined) inMemoryRuns.delete(firstKey);
  }
  inMemoryRuns.set(run.runId, run);
}

type RecommendationEntry = {
  rankOrder: number;
  kind: "best" | "alternative";
  scenarioId: string | null;
  objectiveScore: number | null;
  payload: unknown;
};

function buildRecommendationEntries(
  run: DgOptimizationOutput,
): RecommendationEntry[] {
  if (!run.recommendation) {
    return [
      {
        rankOrder: 0,
        kind: "best",
        scenarioId: null,
        objectiveScore: null,
        payload: {
          bestScenario: null,
          alternatives: [],
          discardedCount: run.allScenarios.length,
          discardReasonSummary: {},
        },
      },
    ];
  }

  const entries: RecommendationEntry[] = [
    {
      rankOrder: 0,
      kind: "best",
      scenarioId: run.recommendation.bestScenario.scenarioId,
      objectiveScore: run.recommendation.bestScenario.objectiveScore,
      payload: run.recommendation.bestScenario,
    },
  ];

  run.recommendation.alternatives.forEach((scenario, index) => {
    entries.push({
      rankOrder: index + 1,
      kind: "alternative",
      scenarioId: scenario.scenarioId,
      objectiveScore: scenario.objectiveScore,
      payload: scenario,
    });
  });

  return entries;
}

async function saveNormalizedDgData(
  sql: NonNullable<ReturnType<typeof getDbClient>>,
  run: DgOptimizationOutput,
): Promise<void> {
  await sql.unsafe(`BEGIN`);
  try {
    // Regrava as tabelas normalizadas de forma idempotente por run.
    await sql.unsafe(`DELETE FROM dg_constraints WHERE run_id = $1`, [
      run.runId,
    ]);
    await sql.unsafe(`DELETE FROM dg_recommendations WHERE run_id = $1`, [
      run.runId,
    ]);
    await sql.unsafe(`DELETE FROM dg_scenarios WHERE run_id = $1`, [run.runId]);
    await sql.unsafe(`DELETE FROM dg_candidates WHERE run_id = $1`, [
      run.runId,
    ]);

    // ── Candidatos (batch insert) ──────────────────────────────────────────
    const candidateMap = new Map<
      string,
      {
        candidateId: string;
        positionLatLon: { lat: number; lon: number };
        positionUtm: { x: number; y: number };
      }
    >();

    for (const scenario of run.allScenarios) {
      if (!candidateMap.has(scenario.candidateId)) {
        candidateMap.set(scenario.candidateId, {
          candidateId: scenario.candidateId,
          positionLatLon: scenario.trafoPositionLatLon,
          positionUtm: scenario.trafoPositionUtm,
        });
      }
    }

    const candidates = [...candidateMap.values()];
    if (candidates.length > 0) {
      const params: (string | null)[] = [];
      const rows = candidates.map((c, i) => {
        const base = i * 6;
        params.push(
          run.runId,
          run.tenantId ?? null,
          c.candidateId,
          null,
          JSON.stringify(c.positionLatLon),
          JSON.stringify(c.positionUtm),
        );
        return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5}::jsonb,$${base + 6}::jsonb,NOW())`;
      });
      await sql.unsafe(
        `INSERT INTO dg_candidates (run_id,tenant_id,candidate_id,source,position_latlon_json,position_utm_json,created_at) VALUES ${rows.join(",")}`,
        params,
      );
    }

    // ── Cenários + Constraints (um INSERT por cenário — volume controlado) ──
    for (const scenario of run.allScenarios) {
      await sql.unsafe(
        `INSERT INTO dg_scenarios (
           run_id,
            tenant_id,
           scenario_id,
           candidate_id,
           feasible,
           objective_score,
           electrical_json,
           score_components_json,
           violations_count,
           scenario_json,
           created_at
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10::jsonb,NOW()
         )`,
        [
          run.runId,
          run.tenantId ?? null,
          scenario.scenarioId,
          scenario.candidateId,
          scenario.feasible,
          scenario.objectiveScore,
          JSON.stringify(scenario.electricalResult),
          JSON.stringify(scenario.scoreComponents),
          scenario.violations.length,
          JSON.stringify(scenario),
        ],
      );

      for (let index = 0; index < scenario.violations.length; index += 1) {
        const violation = scenario.violations[index]!;
        await sql.unsafe(
          `INSERT INTO dg_constraints (
             run_id,
               tenant_id,
             scenario_id,
             ordinal,
             code,
             detail,
             entity_id,
             created_at
           ) VALUES (
             $1,$2,$3,$4,$5,$6,$7,NOW()
           )`,
          [
            run.runId,
            run.tenantId ?? null,
            scenario.scenarioId,
            index,
            violation.code,
            violation.detail,
            violation.entityId ?? null,
          ],
        );
      }
    }

    const recommendationEntries = buildRecommendationEntries(run);
    for (const entry of recommendationEntries) {
      await sql.unsafe(
        `INSERT INTO dg_recommendations (
           run_id,
            tenant_id,
           rank_order,
           scenario_id,
           kind,
           objective_score,
           recommendation_json,
           created_at
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7::jsonb,NOW()
         )`,
        [
          run.runId,
          run.tenantId ?? null,
          entry.rankOrder,
          entry.scenarioId,
          entry.kind,
          entry.objectiveScore,
          JSON.stringify(entry.payload),
        ],
      );
    }

    await sql.unsafe(`COMMIT`);
  } catch (err) {
    await sql.unsafe(`ROLLBACK`);
    throw err;
  }
}

function parseOutput(row: DgRunOutputRow): DgOptimizationOutput | null {
  const raw = row["output_json"];
  if (!raw) return null;
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return parsed as DgOptimizationOutput;
  } catch {
    return null;
  }
}

function toSummary(run: DgOptimizationOutput): DgRunSummary {
  return {
    runId: run.runId,
    tenantId: run.tenantId,
    inputHash: run.inputHash,
    computedAt: run.computedAt,
    totalCandidatesEvaluated: run.totalCandidatesEvaluated,
    totalFeasible: run.totalFeasible,
    bestObjectiveScore: run.recommendation?.bestScenario.objectiveScore ?? null,
    discardedCount:
      run.recommendation?.discardedCount ?? run.allScenarios.length,
  };
}

function sortByComputedAtDesc<T extends { computedAt: string }>(
  items: T[],
): T[] {
  return [...items].sort(
    (a, b) =>
      new Date(b.computedAt).getTime() - new Date(a.computedAt).getTime(),
  );
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function matchesTenant(run: DgOptimizationOutput, tenantId?: string): boolean {
  // Hardening: se houver tenantId, deve bater exatamente.
  // Se não houver tenantId na requisição, só permitimos se o run também for público/sistema (tenantId null)
  if (!tenantId) return !run.tenantId;
  return run.tenantId === tenantId;
}

async function persistRunLegacy(
  sql: NonNullable<ReturnType<typeof getDbClient>>,
  run: DgOptimizationOutput,
): Promise<void> {
  await sql.unsafe(
    `INSERT INTO dg_runs (
       run_id,
       input_hash,
       computed_at,
       total_candidates_evaluated,
       total_feasible,
       output_json,
       recommendation_json,
       scenarios_json,
       params_json,
       created_at,
       updated_at
     ) VALUES (
       $1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,NOW(),NOW()
     )
     ON CONFLICT (run_id) DO UPDATE
     SET input_hash = EXCLUDED.input_hash,
         computed_at = EXCLUDED.computed_at,
         total_candidates_evaluated = EXCLUDED.total_candidates_evaluated,
         total_feasible = EXCLUDED.total_feasible,
         output_json = EXCLUDED.output_json,
         recommendation_json = EXCLUDED.recommendation_json,
         scenarios_json = EXCLUDED.scenarios_json,
         params_json = EXCLUDED.params_json,
         updated_at = NOW()`,
    [
      run.runId,
      run.inputHash,
      run.computedAt,
      run.totalCandidatesEvaluated,
      run.totalFeasible,
      JSON.stringify(run),
      JSON.stringify(run.recommendation),
      JSON.stringify(run.allScenarios),
      JSON.stringify(run.params),
    ],
  );
}

async function persistRunTenantAware(
  sql: NonNullable<ReturnType<typeof getDbClient>>,
  run: DgOptimizationOutput,
): Promise<void> {
  await sql.unsafe(
    `INSERT INTO dg_runs (
       run_id,
       tenant_id,
       input_hash,
       computed_at,
       total_candidates_evaluated,
       total_feasible,
       output_json,
       recommendation_json,
       scenarios_json,
       params_json,
       created_at,
       updated_at
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb,NOW(),NOW()
     )
     ON CONFLICT (run_id) DO UPDATE
     SET tenant_id = EXCLUDED.tenant_id,
         input_hash = EXCLUDED.input_hash,
         computed_at = EXCLUDED.computed_at,
         total_candidates_evaluated = EXCLUDED.total_candidates_evaluated,
         total_feasible = EXCLUDED.total_feasible,
         output_json = EXCLUDED.output_json,
         recommendation_json = EXCLUDED.recommendation_json,
         scenarios_json = EXCLUDED.scenarios_json,
         params_json = EXCLUDED.params_json,
         updated_at = NOW()`,
    [
      run.runId,
      run.tenantId ?? null,
      run.inputHash,
      run.computedAt,
      run.totalCandidatesEvaluated,
      run.totalFeasible,
      JSON.stringify(run),
      JSON.stringify(run.recommendation),
      JSON.stringify(run.allScenarios),
      JSON.stringify(run.params),
    ],
  );
}

function buildDiscardRatesFromRun(
  run: DgOptimizationOutput,
): DgDiscardRateByConstraint[] {
  const scenariosPerCode = new Map<DgConstraintCode, Set<string>>();

  for (const scenario of run.allScenarios) {
    const seenCodes = new Set<DgConstraintCode>();
    for (const violation of scenario.violations) {
      if (seenCodes.has(violation.code)) continue;
      seenCodes.add(violation.code);
      if (!scenariosPerCode.has(violation.code)) {
        scenariosPerCode.set(violation.code, new Set<string>());
      }
      scenariosPerCode.get(violation.code)!.add(scenario.scenarioId);
    }
  }

  const totalScenarios = run.allScenarios.length;
  const rates: DgDiscardRateByConstraint[] = [];
  for (const [code, scenarioIds] of scenariosPerCode.entries()) {
    const discardedScenarios = scenarioIds.size;
    rates.push({
      runId: run.runId,
      code,
      discardedScenarios,
      totalScenarios,
      discardRatePercent:
        totalScenarios === 0
          ? 0
          : round2((discardedScenarios / totalScenarios) * 100),
    });
  }

  return rates.sort((a, b) => b.discardRatePercent - a.discardRatePercent);
}

export class PostgresDgRunRepository implements IDgRunRepository {
  async save(run: DgOptimizationOutput): Promise<void> {
    addToInMemoryCache(run);

    const sql = getDbClient();
    if (!sql) return;

    try {
      if (run.tenantId) {
        try {
          await persistRunTenantAware(sql, run);
        } catch (err) {
          logger.warn(
            "[DgRunRepository] tenant-aware save failed; retrying legacy dg_runs persistence",
            {
              runId: run.runId,
              tenantId: run.tenantId,
              err,
            },
          );
          await persistRunLegacy(sql, run);
        }
      } else {
        await persistRunLegacy(sql, run);
      }

      try {
        await saveNormalizedDgData(sql, run);
      } catch (err) {
        logger.warn(
          "[DgRunRepository] normalized save failed; run persisted in dg_runs",
          {
            runId: run.runId,
            err,
          },
        );
      }
    } catch (err) {
      logger.warn("[DgRunRepository] save failed; keeping in-memory fallback", {
        runId: run.runId,
        err,
      });
    }
  }

  async list(limit = 20, tenantId?: string): Promise<DgRunSummary[]> {
    const summaries = new Map<string, DgRunSummary>();

    for (const run of inMemoryRuns.values()) {
      if (!matchesTenant(run, tenantId)) continue;
      summaries.set(run.runId, toSummary(run));
    }

    const sql = getDbClient();
    if (sql) {
      try {
        const rows = tenantId
          ? await sql.unsafe(
              `SELECT output_json FROM dg_runs WHERE tenant_id = $1 ORDER BY computed_at DESC LIMIT $2`,
              [tenantId, limit],
            )
          : await sql.unsafe(
              `SELECT output_json FROM dg_runs WHERE tenant_id IS NULL ORDER BY computed_at DESC LIMIT $1`,
              [limit],
            );
        for (const row of rows as DgRunOutputRow[]) {
          const parsed = parseOutput(row);
          if (parsed && matchesTenant(parsed, tenantId)) {
            summaries.set(parsed.runId, toSummary(parsed));
          }
        }
      } catch (err) {
        logger.warn(
          "[DgRunRepository] list failed; using available fallback data",
          {
            limit,
            tenantId,
            err,
          },
        );
      }
    }

    return sortByComputedAtDesc([...summaries.values()]).slice(0, limit);
  }

  async listDiscardRates(
    limit = 100,
    tenantId?: string,
  ): Promise<DgDiscardRateByConstraint[]> {
    const rowsByRunAndCode = new Map<string, DgDiscardRateByConstraint>();

    const inMemoryRunsSorted = sortByComputedAtDesc([...inMemoryRuns.values()]);
    for (const run of inMemoryRunsSorted) {
      if (!matchesTenant(run, tenantId)) continue;
      for (const rate of buildDiscardRatesFromRun(run)) {
        rowsByRunAndCode.set(`${rate.runId}:${rate.code}`, {
          ...rate,
          tenantId: run.tenantId,
        });
      }
    }

    const sql = getDbClient();
    if (sql) {
      try {
        const rows = tenantId
          ? await sql.unsafe(
              `SELECT
                 v.run_id,
                 v.tenant_id,
                 v.code,
                 v.discarded_scenarios,
                 v.total_scenarios,
                 v.discard_rate_percent
               FROM dg_discard_rate_by_constraint_v v
               JOIN dg_runs r ON r.run_id = v.run_id
               WHERE v.tenant_id = $1
               ORDER BY r.computed_at DESC, v.discard_rate_percent DESC
               LIMIT $2`,
              [tenantId, limit],
            )
          : await sql.unsafe(
              `SELECT
                 v.run_id,
                 v.tenant_id,
                 v.code,
                 v.discarded_scenarios,
                 v.total_scenarios,
                 v.discard_rate_percent
               FROM dg_discard_rate_by_constraint_v v
               JOIN dg_runs r ON r.run_id = v.run_id
               WHERE v.tenant_id IS NULL
               ORDER BY r.computed_at DESC, v.discard_rate_percent DESC
               LIMIT $1`,
              [limit],
            );

        for (const row of rows as DgDiscardRateRow[]) {
          const tenantValue = row["tenant_id"];
          const item: DgDiscardRateByConstraint = {
            runId: String(row["run_id"]),
            tenantId: tenantValue ? String(tenantValue) : undefined,
            code: String(row["code"]) as DgConstraintCode,
            discardedScenarios: Number(row["discarded_scenarios"] ?? 0),
            totalScenarios: Number(row["total_scenarios"] ?? 0),
            discardRatePercent: Number(row["discard_rate_percent"] ?? 0),
          };
          rowsByRunAndCode.set(`${item.runId}:${item.code}`, item);
        }
      } catch (err) {
        logger.warn(
          "[DgRunRepository] listDiscardRates failed; using available fallback data",
          { limit, tenantId, err },
        );
      }
    }

    return [...rowsByRunAndCode.values()]
      .sort((a, b) => b.discardRatePercent - a.discardRatePercent)
      .slice(0, limit);
  }

  async findById(
    runId: string,
    tenantId?: string,
  ): Promise<DgOptimizationOutput | null> {
    const memoryHit = inMemoryRuns.get(runId);
    if (memoryHit && matchesTenant(memoryHit, tenantId)) return memoryHit;

    const sql = getDbClient();
    if (!sql) return null;

    try {
      const rows = tenantId
        ? await sql.unsafe(
            `SELECT output_json FROM dg_runs WHERE run_id = $1 AND tenant_id = $2 LIMIT 1`,
            [runId, tenantId],
          )
        : await sql.unsafe(
            `SELECT output_json FROM dg_runs WHERE run_id = $1 AND tenant_id IS NULL LIMIT 1`,
            [runId],
          );
      const outputRows = rows as DgRunOutputRow[];
      if (outputRows.length === 0) return null;

      const parsed = parseOutput(outputRows[0]);
      if (parsed && matchesTenant(parsed, tenantId)) {
        inMemoryRuns.set(runId, parsed);
        return parsed;
      }
      return null;
    } catch (err) {
      logger.warn("[DgRunRepository] findById failed", {
        runId,
        tenantId,
        err,
      });
      return null;
    }
  }

  async findScenarios(
    runId: string,
    tenantId?: string,
  ): Promise<DgScenario[] | null> {
    const run = await this.findById(runId, tenantId);
    return run ? run.allScenarios : null;
  }

  async findRecommendation(
    runId: string,
    tenantId?: string,
  ): Promise<DgRecommendation | null> {
    const run = await this.findById(runId, tenantId);
    return run?.recommendation ?? null;
  }
}

export const dgRunRepository: IDgRunRepository = new PostgresDgRunRepository();
