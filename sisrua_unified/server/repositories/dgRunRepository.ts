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
  DgOptimizationOutput,
  DgRecommendation,
  DgScenario,
} from "../services/dg/dgTypes.js";

export interface IDgRunRepository {
  save(run: DgOptimizationOutput): Promise<void>;
  findById(runId: string): Promise<DgOptimizationOutput | null>;
  findScenarios(runId: string): Promise<DgScenario[] | null>;
  findRecommendation(runId: string): Promise<DgRecommendation | null>;
}

const inMemoryRuns = new Map<string, DgOptimizationOutput>();

function parseOutput(row: any): DgOptimizationOutput | null {
  const raw = row?.output_json;
  if (!raw) return null;
  try {
    return (typeof raw === "string" ? JSON.parse(raw) : raw) as DgOptimizationOutput;
  } catch {
    return null;
  }
}

export class PostgresDgRunRepository implements IDgRunRepository {
  async save(run: DgOptimizationOutput): Promise<void> {
    inMemoryRuns.set(run.runId, run);

    const sql = getDbClient();
    if (!sql) return;

    try {
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
    } catch (err) {
      logger.warn("[DgRunRepository] save failed; keeping in-memory fallback", {
        runId: run.runId,
        err,
      });
    }
  }

  async findById(runId: string): Promise<DgOptimizationOutput | null> {
    const memoryHit = inMemoryRuns.get(runId);
    if (memoryHit) return memoryHit;

    const sql = getDbClient();
    if (!sql) return null;

    try {
      const rows = await sql.unsafe(
        `SELECT output_json FROM dg_runs WHERE run_id = $1 LIMIT 1`,
        [runId],
      );
      const parsed = parseOutput((rows as any[])[0]);
      if (parsed) {
        inMemoryRuns.set(runId, parsed);
      }
      return parsed;
    } catch (err) {
      logger.warn("[DgRunRepository] findById failed", { runId, err });
      return null;
    }
  }

  async findScenarios(runId: string): Promise<DgScenario[] | null> {
    const run = await this.findById(runId);
    return run ? run.allScenarios : null;
  }

  async findRecommendation(runId: string): Promise<DgRecommendation | null> {
    const run = await this.findById(runId);
    return run?.recommendation ?? null;
  }
}

export const dgRunRepository: IDgRunRepository = new PostgresDgRunRepository();
