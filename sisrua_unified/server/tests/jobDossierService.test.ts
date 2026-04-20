/**
 * jobDossierService.test.ts
 * Testa todas as funções públicas do JobDossierService.
 * Utiliza mock do módulo 'postgres' para isolar de DB real.
 */
import { jest } from "@jest/globals";
import { config } from "../config";

jest.mock("../utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const unsafeMock = jest.fn();
const endMock = jest.fn().mockResolvedValue(undefined);
const mockPostgres = jest.fn(() => ({ unsafe: unsafeMock, end: endMock }));

jest.mock("postgres", () => ({ __esModule: true, default: mockPostgres }));

jest.mock("../config", () => ({
  config: {
    DATABASE_URL: "postgresql://user:pass@localhost:5432/testdb",
    NODE_ENV: "test",
  },
}));

import {
  getJobDossier,
  listRecentJobs,
  replayFailedTask,
  previewFailedTaskSanitation,
  sanitizeAndReprocessFailedTasks,
  closeJobDossierConnection,
} from "../services/jobDossierService";

const NOW = new Date("2025-03-15T09:00:00Z");

function makeTaskRow(overrides: Record<string, unknown> = {}) {
  return {
    task_id: "task-001",
    status: "failed",
    attempts: 3,
    idempotency_key: "idem-001",
    artifact_sha256: null,
    error: "timeout error",
    created_at: NOW,
    updated_at: NOW,
    started_at: NOW,
    finished_at: NOW,
    payload: {
      lat: -23.5,
      lon: -46.6,
      radius: 500,
      mode: "circle",
      projection: "local",
    },
    ...overrides,
  };
}

describe("jobDossierService", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    // Reset module state between tests
    await closeJobDossierConnection();
  });

  afterAll(async () => {
    await closeJobDossierConnection();
  });

  // ── getJobDossier ─────────────────────────────────────────────────────────

  describe("getJobDossier", () => {
    it("retorna JobDossierEntry quando job encontrado", async () => {
      unsafeMock.mockResolvedValueOnce([makeTaskRow()]);
      const entry = await getJobDossier("task-001");
      expect(entry).not.toBeNull();
      expect(entry!.taskId).toBe("task-001");
      expect(entry!.status).toBe("failed");
      expect(entry!.attempts).toBe(3);
      expect(entry!.idempotencyKey).toBe("idem-001");
      expect(entry!.error).toBe("timeout error");
      expect(entry!.request?.lat).toBe(-23.5);
    });

    it("retorna null quando job não encontrado", async () => {
      unsafeMock.mockResolvedValueOnce([]);
      expect(await getJobDossier("missing")).toBeNull();
    });

    it("retorna null quando DB indisponível (postgres lança)", async () => {
      // Simula falha na conexão: postgres() lança, initConnection seta available=false
      mockPostgres.mockImplementationOnce(() => {
        throw new Error("connection refused");
      });
      expect(await getJobDossier("task-001")).toBeNull();
    });

    it("retorna null quando DATABASE_URL não configurado", async () => {
      // Simula ausência de DATABASE_URL — initConnection usa caminho warn+return
      const origUrl = config.DATABASE_URL;
      config.DATABASE_URL = "";
      await closeJobDossierConnection();
      const result = await getJobDossier("any-task");
      config.DATABASE_URL = origUrl;
      expect(result).toBeNull();
    });

    it("mapeia datas opcionais corretamente", async () => {
      unsafeMock.mockResolvedValueOnce([
        makeTaskRow({ started_at: null, finished_at: null }),
      ]);
      const entry = await getJobDossier("task-001");
      expect(entry!.startedAt).toBeUndefined();
      expect(entry!.finishedAt).toBeUndefined();
    });

    it("mapeia artifact_sha256 quando presente", async () => {
      unsafeMock.mockResolvedValueOnce([
        makeTaskRow({ artifact_sha256: "sha-xyz" }),
      ]);
      const entry = await getJobDossier("task-001");
      expect(entry!.artifactSha256).toBe("sha-xyz");
    });

    it("request é undefined quando payload é null", async () => {
      unsafeMock.mockResolvedValueOnce([makeTaskRow({ payload: null })]);
      const entry = await getJobDossier("task-001");
      expect(entry!.request).toBeUndefined();
    });
  });

  // ── listRecentJobs ────────────────────────────────────────────────────────

  describe("listRecentJobs", () => {
    it("retorna lista de jobs mapeados", async () => {
      unsafeMock.mockResolvedValueOnce([
        makeTaskRow({ task_id: "task-001" }),
        makeTaskRow({ task_id: "task-002", status: "completed" }),
      ]);
      const jobs = await listRecentJobs(10);
      expect(jobs).toHaveLength(2);
      expect(jobs[0].taskId).toBe("task-001");
      expect(jobs[1].status).toBe("completed");
    });

    it("usa limit padrão de 50", async () => {
      unsafeMock.mockResolvedValueOnce([]);
      await listRecentJobs();
      expect(unsafeMock.mock.calls[0][1]).toEqual([50]);
    });

    it("clipa limit máximo em 200", async () => {
      unsafeMock.mockResolvedValueOnce([]);
      await listRecentJobs(999);
      expect(unsafeMock.mock.calls[0][1]).toEqual([200]);
    });

    it("clipa limit mínimo em 1", async () => {
      unsafeMock.mockResolvedValueOnce([]);
      await listRecentJobs(0);
      expect(unsafeMock.mock.calls[0][1]).toEqual([1]);
    });

    it("retorna array vazio quando tabela está vazia", async () => {
      unsafeMock.mockResolvedValueOnce([]);
      expect(await listRecentJobs(10)).toEqual([]);
    });
  });

  // ── replayFailedTask ──────────────────────────────────────────────────────

  describe("replayFailedTask", () => {
    it("retorna replayed=true quando UPDATE bem-sucedido", async () => {
      unsafeMock.mockResolvedValueOnce([{ task_id: "task-001" }]);
      const result = await replayFailedTask("task-001");
      expect(result.replayed).toBe(true);
      expect(result.taskId).toBe("task-001");
      expect(result.message).toMatch(/recolocada/i);
    });

    it('retorna replayed=false com mensagem "não encontrada" quando task inexistente', async () => {
      unsafeMock
        .mockResolvedValueOnce([]) // UPDATE retorna vazio
        .mockResolvedValueOnce([]); // SELECT check retorna vazio
      const result = await replayFailedTask("missing");
      expect(result.replayed).toBe(false);
      expect(result.message).toMatch(/não encontrada/i);
    });

    it("retorna replayed=false com status atual quando task não está em failed", async () => {
      unsafeMock
        .mockResolvedValueOnce([]) // UPDATE retorna vazio
        .mockResolvedValueOnce([{ status: "queued" }]); // check
      const result = await replayFailedTask("task-001");
      expect(result.replayed).toBe(false);
      expect(result.message).toMatch(/queued/i);
    });

    it("retorna replayed=false quando DB indisponível (postgres lança)", async () => {
      mockPostgres.mockImplementationOnce(() => {
        throw new Error("connection refused");
      });
      const result = await replayFailedTask("task-001");
      expect(result.replayed).toBe(false);
      expect(result.message).toMatch(/indisponível/i);
    });
  });

  // ── previewFailedTaskSanitation ───────────────────────────────────────────

  describe("previewFailedTaskSanitation", () => {
    it("classifica missing_input para payload inválido", async () => {
      unsafeMock.mockResolvedValueOnce([
        makeTaskRow({ payload: null, error: null }),
      ]);
      const preview = await previewFailedTaskSanitation(10);
      expect(preview.analyzed).toBe(1);
      expect(preview.byClassification.missing_input).toBe(1);
      expect(preview.entries[0].action).toBe("cancel");
    });

    it("classifica python_runtime para erro de script python com payload válido", async () => {
      unsafeMock.mockResolvedValueOnce([
        makeTaskRow({ error: "python script failed: exit code 1" }),
      ]);
      const preview = await previewFailedTaskSanitation(10);
      expect(preview.byClassification.python_runtime).toBe(1);
      expect(preview.entries[0].action).toBe("requeue");
    });

    it("classifica missing_input para erro python com payload inválido (hasInvalidCoreInput tem prioridade)", async () => {
      // Quando o payload é inválido, o primeiro if (hasInvalidCoreInput) dispara antes do check python,
      // por isso o resultado é missing_input, não not_reprocessable.
      unsafeMock.mockResolvedValueOnce([
        makeTaskRow({
          error: "python script failed",
          payload: { lat: null, lon: null, radius: null },
        }),
      ]);
      const preview = await previewFailedTaskSanitation(10);
      expect(preview.byClassification.missing_input).toBe(1);
      expect(preview.entries[0].action).toBe("cancel");
    });

    it("classifica other para erro genérico com payload válido", async () => {
      unsafeMock.mockResolvedValueOnce([
        makeTaskRow({ error: "unknown error" }),
      ]);
      const preview = await previewFailedTaskSanitation(10);
      expect(preview.byClassification.other).toBe(1);
      expect(preview.entries[0].action).toBe("skip");
    });

    it("classifica missing_input por texto de erro", async () => {
      unsafeMock.mockResolvedValueOnce([
        makeTaskRow({ error: "Missing required parameters: lat" }),
      ]);
      const preview = await previewFailedTaskSanitation(10);
      expect(preview.byClassification.missing_input).toBe(1);
    });

    it("extrai source do requestMeta", async () => {
      unsafeMock.mockResolvedValueOnce([
        makeTaskRow({
          payload: {
            lat: -23.5,
            lon: -46.6,
            radius: 500,
            requestMeta: { source: "/api/dxf/generate", requestId: "req-abc" },
          },
        }),
      ]);
      const preview = await previewFailedTaskSanitation(10);
      expect(preview.entries[0].source).toBe("/api/dxf/generate");
      expect(preview.entries[0].requestId).toBe("req-abc");
    });

    it('usa "unknown_source" quando requestMeta ausente', async () => {
      unsafeMock.mockResolvedValueOnce([makeTaskRow()]);
      const preview = await previewFailedTaskSanitation(10);
      expect(preview.entries[0].source).toBe("unknown_source");
    });

    it("agrupa bySource corretamente", async () => {
      unsafeMock.mockResolvedValueOnce([
        makeTaskRow({
          payload: {
            lat: -23.5,
            lon: -46.6,
            radius: 500,
            requestMeta: { source: "api" },
          },
        }),
        makeTaskRow({
          task_id: "task-002",
          payload: {
            lat: -23.5,
            lon: -46.6,
            radius: 500,
            requestMeta: { source: "api" },
          },
        }),
      ]);
      const preview = await previewFailedTaskSanitation(10);
      expect(preview.bySource["api"]).toBe(2);
    });

    it("retorna preview vazio quando DB indisponível (postgres lança)", async () => {
      mockPostgres.mockImplementationOnce(() => {
        throw new Error("connection refused");
      });
      const preview = await previewFailedTaskSanitation(10);
      expect(preview.analyzed).toBe(0);
      expect(preview.entries).toEqual([]);
    });

    it("clipa limit em 500", async () => {
      unsafeMock.mockResolvedValueOnce([]);
      await previewFailedTaskSanitation(9999);
      expect(unsafeMock.mock.calls[0][1]).toEqual([500]);
    });
  });

  // ── sanitizeAndReprocessFailedTasks ───────────────────────────────────────

  describe("sanitizeAndReprocessFailedTasks", () => {
    it("cancela tarefas missing_input e retorna contagem", async () => {
      // 1ª chamada: fetchFailedTasks (via previewFailedTaskSanitation)
      unsafeMock.mockResolvedValueOnce([
        makeTaskRow({ payload: null, error: null }),
      ]);
      // 2ª chamada: UPDATE para cancel
      unsafeMock.mockResolvedValueOnce([{ task_id: "task-001" }]);

      const result = await sanitizeAndReprocessFailedTasks(10);
      expect(result.cancelled).toBe(1);
      expect(result.requeued).toBe(0);
      expect(result.skipped).toBe(0);
    });

    it("reprocessa tarefas python_runtime e retorna contagem", async () => {
      unsafeMock.mockResolvedValueOnce([
        makeTaskRow({ error: "python script error" }),
      ]);
      unsafeMock.mockResolvedValueOnce([{ task_id: "task-001" }]);

      const result = await sanitizeAndReprocessFailedTasks(10);
      expect(result.requeued).toBe(1);
      expect(result.cancelled).toBe(0);
      expect(result.skipped).toBe(0);
    });

    it("incrementa skipped quando UPDATE retorna vazio (cancel)", async () => {
      unsafeMock.mockResolvedValueOnce([
        makeTaskRow({ payload: null, error: null }),
      ]);
      unsafeMock.mockResolvedValueOnce([]); // UPDATE retorna vazio

      const result = await sanitizeAndReprocessFailedTasks(10);
      expect(result.skipped).toBe(1);
      expect(result.cancelled).toBe(0);
    });

    it("incrementa skipped quando UPDATE retorna vazio (requeue)", async () => {
      unsafeMock.mockResolvedValueOnce([
        makeTaskRow({ error: "python script error" }),
      ]);
      unsafeMock.mockResolvedValueOnce([]); // UPDATE retorna vazio

      const result = await sanitizeAndReprocessFailedTasks(10);
      expect(result.skipped).toBe(1);
      expect(result.requeued).toBe(0);
    });

    it("skipa tarefas com action=skip (other/not_reprocessable)", async () => {
      unsafeMock.mockResolvedValueOnce([
        makeTaskRow({ error: "unknown error" }),
      ]);

      const result = await sanitizeAndReprocessFailedTasks(10);
      expect(result.skipped).toBe(1);
      expect(result.cancelled).toBe(0);
      expect(result.requeued).toBe(0);
    });

    it("retorna resultado vazio quando DB indisponível (postgres lança)", async () => {
      mockPostgres.mockImplementationOnce(() => {
        throw new Error("connection refused");
      });
      const result = await sanitizeAndReprocessFailedTasks(10);
      expect(result.analyzed).toBe(0);
      expect(result.cancelled).toBe(0);
    });
  });

  // ── closeJobDossierConnection ─────────────────────────────────────────────

  describe("closeJobDossierConnection", () => {
    it("fecha a conexão quando disponível", async () => {
      // Garante conexão ativa
      unsafeMock.mockResolvedValueOnce([]);
      await getJobDossier("task-001");
      await closeJobDossierConnection();
      expect(endMock).toHaveBeenCalled();
    });

    it("é idempotente (fecha sem conexão ativa)", async () => {
      await expect(closeJobDossierConnection()).resolves.toBeUndefined();
    });
  });
});
