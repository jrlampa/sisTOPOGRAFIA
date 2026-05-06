/**
 * repositories.test.ts
 *
 * Testes unitários para todos os repositórios PostgreSQL.
 * Estratégia: mock do getDbClient — testa lógica de mapeamento,
 * fallback quando DB é null e tratamento de erro.
 */

import { vi } from "vitest";

// ─── Mock logger ─────────────────────────────────────────────────────────────
vi.mock("../utils/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ─── Mock dbClient ────────────────────────────────────────────────────────────
const mockUnsafe = vi.fn<(...args: any[]) => Promise<any[]>>();

const mockSql = { unsafe: mockUnsafe } as any;

vi.mock("../repositories/dbClient", () => ({
  getDbClient: vi.fn(() => mockSql),
  isDbAvailable: vi.fn(() => true),
  initDbClient: vi.fn(),
  closeDbClient: vi.fn(),
  pingDb: vi.fn(async () => true),
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────
import { PostgresBtExportHistoryRepository } from "../repositories/btExportHistoryRepository.js";
import { PostgresDxfTaskRepository } from "../repositories/dxfTaskRepository.js";
import { PostgresJobRepository } from "../repositories/jobRepository.js";
import { PostgresMaintenanceRepository } from "../repositories/maintenanceRepository.js";
import { PostgresRoleRepository } from "../repositories/roleRepository.js";
import {
  getDbClient,
  isDbAvailable,
  pingDb,
} from "../repositories/dbClient.js";
import * as repoIndex from "../repositories/index.js";

const mockGetDbClient = getDbClient as vi.Mock;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setDbNull() {
  mockGetDbClient.mockReturnValue(null);
}
function setDb() {
  mockGetDbClient.mockReturnValue(mockSql);
}

// ═════════════════════════════════════════════════════════════════════════════
// dbClient
// ═════════════════════════════════════════════════════════════════════════════

describe("dbClient helpers", () => {
  it("isDbAvailable returns mocked value", () => {
    expect(isDbAvailable()).toBe(true);
  });

  it("pingDb resolves to true", async () => {
    expect(await pingDb()).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// BtExportHistoryRepository
// ═════════════════════════════════════════════════════════════════════════════

describe("PostgresBtExportHistoryRepository", () => {
  let repo: PostgresBtExportHistoryRepository;

  beforeEach(() => {
    repo = new PostgresBtExportHistoryRepository();
    setDb();
    mockUnsafe.mockReset();
  });

  const baseRow = {
    projectType: "BT",
    btContextUrl: "https://example.com/ctx.json",
    criticalPoleId: "P001",
    criticalAccumulatedClients: 12,
    criticalAccumulatedDemandKva: 45.5,
    verifiedPoles: 10,
    verifiedEdges: 9,
    verifiedTransformers: 1,
    totalPoles: 10,
    totalEdges: 9,
    totalTransformers: 1,
    cqtScenario: "A",
    cqtDmdi: 0.5,
    cqtP31: 0.8,
    cqtP32: 0.9,
    cqtK10QtMttr: 0.1,
    cqtParityStatus: "pass",
    cqtParityPassed: 5,
    cqtParityFailed: 0,
    metadata: { extra: "data" },
  };

  // ── insert ──────────────────────────────────────────────────────────────────

  it("insert: returns id from DB", async () => {
    mockUnsafe.mockResolvedValue([{ id: "uuid-123" }]);
    const id = await repo.insert(baseRow);
    expect(id).toBe("uuid-123");
    expect(mockUnsafe).toHaveBeenCalledTimes(1);
  });

  it("insert: throws when DB unavailable", async () => {
    setDbNull();
    await expect(repo.insert(baseRow)).rejects.toThrow("DB unavailable");
  });

  it("insert: passes null metadata as null string", async () => {
    mockUnsafe.mockResolvedValue([{ id: "uuid-456" }]);
    await repo.insert({ ...baseRow, metadata: null });
    const args = mockUnsafe.mock.calls[0][1] as any[];
    // metadata param is last (index 19)
    expect(args[19]).toBeNull();
  });

  // ── findAll ─────────────────────────────────────────────────────────────────

  it("findAll: maps rows from DB", async () => {
    const dbRow = {
      id: "r1",
      project_type: "BT",
      bt_context_url: null,
      critical_pole_id: null,
      critical_accumulated_clients: "5",
      critical_accumulated_demand_kva: "10.5",
      verified_poles: "3",
      verified_edges: "2",
      verified_transformers: "1",
      total_poles: "3",
      total_edges: "2",
      total_transformers: "1",
      cqt_scenario: "A",
      cqt_dmdi: "0.5",
      cqt_p31: "0.8",
      cqt_p32: "0.9",
      cqt_k10_qt_mttr: "0.1",
      cqt_parity_status: "pass",
      cqt_parity_passed: "5",
      cqt_parity_failed: "0",
      metadata: null,
      created_at: "2026-01-01T00:00:00Z",
    };
    mockUnsafe.mockResolvedValue([dbRow]);
    const rows = await repo.findAll({
      projectType: "BT",
      limit: 10,
      offset: 0,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("r1");
    expect(rows[0].criticalAccumulatedClients).toBe(5);
    expect(rows[0].cqtDmdi).toBe(0.5);
    expect(rows[0].metadata).toBeNull();
  });

  it("findAll: returns empty array when DB is null", async () => {
    setDbNull();
    expect(await repo.findAll()).toEqual([]);
  });

  it("findAll: returns empty array on DB error", async () => {
    mockUnsafe.mockRejectedValue(new Error("connection refused"));
    expect(await repo.findAll()).toEqual([]);
  });

  it("findAll: applies cqtScenario filter", async () => {
    mockUnsafe.mockResolvedValue([]);
    await repo.findAll({ cqtScenario: "B" });
    const sql = mockUnsafe.mock.calls[0][0] as string;
    expect(sql).toContain("cqt_scenario");
  });

  // ── count ───────────────────────────────────────────────────────────────────

  it("count: returns numeric count", async () => {
    mockUnsafe.mockResolvedValue([{ cnt: "42" }]);
    expect(await repo.count({ projectType: "BT" })).toBe(42);
  });

  it("count: returns 0 when DB is null", async () => {
    setDbNull();
    expect(await repo.count()).toBe(0);
  });

  it("count: handles missing cnt gracefully", async () => {
    mockUnsafe.mockResolvedValue([{}]);
    expect(await repo.count()).toBe(0);
  });

  // ── deleteOlderThan ─────────────────────────────────────────────────────────

  it("deleteOlderThan: returns count of deleted rows", async () => {
    mockUnsafe.mockResolvedValue([{ cnt: "7" }]);
    expect(await repo.deleteOlderThan(new Date("2025-01-01"))).toBe(7);
  });

  it("deleteOlderThan: returns 0 when DB is null", async () => {
    setDbNull();
    expect(await repo.deleteOlderThan(new Date())).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// DxfTaskRepository
// ═════════════════════════════════════════════════════════════════════════════

describe("PostgresDxfTaskRepository", () => {
  let repo: PostgresDxfTaskRepository;

  beforeEach(() => {
    repo = new PostgresDxfTaskRepository();
    setDb();
    mockUnsafe.mockReset();
  });

  const basePayload = {
    lat: -23.5,
    lon: -46.6,
    radius: 500,
    outputFile: "/tmp/out.dxf",
  };

  const dbTaskRow = {
    task_id: "task-001",
    status: "queued",
    payload: JSON.stringify(basePayload),
    attempts: "0",
    idempotency_key: "key-abc",
    error: null,
    artifact_sha256: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    started_at: null,
    finished_at: null,
  };

  // ── enqueue ─────────────────────────────────────────────────────────────────

  it("enqueue: returns true when row inserted", async () => {
    mockUnsafe.mockResolvedValue([{ task_id: "task-001" }]);
    expect(await repo.enqueue("task-001", basePayload, "key-abc")).toBe(true);
  });

  it("enqueue: returns false on duplicate (empty result)", async () => {
    mockUnsafe.mockResolvedValue([]);
    expect(await repo.enqueue("task-001", basePayload, "key-abc")).toBe(false);
  });

  it("enqueue: returns false when DB is null", async () => {
    setDbNull();
    expect(await repo.enqueue("task-001", basePayload)).toBe(false);
  });

  it("enqueue: returns false on DB error", async () => {
    mockUnsafe.mockRejectedValue(new Error("fail"));
    expect(await repo.enqueue("task-001", basePayload)).toBe(false);
  });

  // ── dequeue ─────────────────────────────────────────────────────────────────

  it("dequeue: returns null when DB is null", async () => {
    setDbNull();
    expect(await repo.dequeue()).toBeNull();
  });

  it("dequeue: returns null when no tasks", async () => {
    mockUnsafe.mockResolvedValue([]);
    expect(await repo.dequeue()).toBeNull();
  });

  it("dequeue: maps row correctly", async () => {
    mockUnsafe.mockResolvedValue([dbTaskRow]);
    const task = await repo.dequeue();
    expect(task).not.toBeNull();
    expect(task!.taskId).toBe("task-001");
    expect(task!.status).toBe("queued");
    expect(task!.payload.lat).toBe(-23.5);
    expect(task!.attempts).toBe(0);
    expect(task!.startedAt).toBeNull();
  });

  it("dequeue: parses payload when string", async () => {
    mockUnsafe.mockResolvedValue([
      { ...dbTaskRow, payload: '{"lat":1,"lon":2,"radius":100}' },
    ]);
    const task = await repo.dequeue();
    expect(task!.payload.lat).toBe(1);
  });

  // ── setProcessing / setCompleted / setFailed ────────────────────────────────

  it("setProcessing: calls unsafe with correct taskId", async () => {
    mockUnsafe.mockResolvedValue([]);
    await repo.setProcessing("task-001");
    expect(mockUnsafe).toHaveBeenCalledTimes(1);
    expect(mockUnsafe.mock.calls[0][1]).toContain("task-001");
  });

  it("setProcessing: no-op when DB null", async () => {
    setDbNull();
    await expect(repo.setProcessing("task-001")).resolves.toBeUndefined();
  });

  it("setCompleted: passes sha256 to DB", async () => {
    mockUnsafe.mockResolvedValue([]);
    await repo.setCompleted("task-001", "sha256abc");
    expect(mockUnsafe.mock.calls[0][1]).toContain("sha256abc");
  });

  it("setCompleted: uses null when no sha256", async () => {
    mockUnsafe.mockResolvedValue([]);
    await repo.setCompleted("task-001");
    expect(mockUnsafe.mock.calls[0][1]).toContain(null);
  });

  it("setCompleted: no-op when DB null", async () => {
    setDbNull();
    await expect(repo.setCompleted("task-001")).resolves.toBeUndefined();
  });

  it("setFailed: passes error string", async () => {
    mockUnsafe.mockResolvedValue([]);
    await repo.setFailed("task-001", "timeout");
    expect(mockUnsafe.mock.calls[0][1]).toContain("timeout");
  });

  it("setFailed: no-op when DB null", async () => {
    setDbNull();
    await expect(repo.setFailed("task-001", "err")).resolves.toBeUndefined();
  });

  // ── findByIdempotencyKey ───────────────────────────────────────────────────

  it("findByIdempotencyKey: returns null when DB null", async () => {
    setDbNull();
    expect(await repo.findByIdempotencyKey("key")).toBeNull();
  });

  it("findByIdempotencyKey: returns null when not found", async () => {
    mockUnsafe.mockResolvedValue([]);
    expect(await repo.findByIdempotencyKey("key")).toBeNull();
  });

  it("findByIdempotencyKey: maps row", async () => {
    mockUnsafe.mockResolvedValue([dbTaskRow]);
    const task = await repo.findByIdempotencyKey("key-abc");
    expect(task!.idempotencyKey).toBe("key-abc");
  });

  // ── findById ────────────────────────────────────────────────────────────────

  it("findById: returns null when DB null", async () => {
    setDbNull();
    expect(await repo.findById("task-001")).toBeNull();
  });

  it("findById: maps row", async () => {
    mockUnsafe.mockResolvedValue([
      { ...dbTaskRow, started_at: "2026-01-02T00:00:00Z" },
    ]);
    const task = await repo.findById("task-001");
    expect(task!.startedAt).toBeInstanceOf(Date);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// JobRepository
// ═════════════════════════════════════════════════════════════════════════════

describe("PostgresJobRepository", () => {
  let repo: PostgresJobRepository;

  beforeEach(() => {
    repo = new PostgresJobRepository();
    setDb();
    mockUnsafe.mockReset();
  });

  const dbJobRow = {
    id: "job-001",
    status: "pending",
    progress: "0",
    result: null,
    error: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    attempts: "0",
  };

  // ── upsert ──────────────────────────────────────────────────────────────────

  it("upsert: calls DB with correct args", async () => {
    mockUnsafe.mockResolvedValue([]);
    await repo.upsert("job-001", "t1", "processing", 50);
    expect(mockUnsafe.mock.calls[0][1]).toEqual(["job-001", "t1", "processing", 50]);
  });

  it("upsert: no-op when DB null", async () => {
    setDbNull();
    await expect(
      repo.upsert("job-001", "t1", "processing", 0),
    ).resolves.toBeUndefined();
  });

  it("upsert: silently handles DB error", async () => {
    mockUnsafe.mockRejectedValue(new Error("conflict"));
    await expect(
      repo.upsert("job-001", "t1", "processing", 0),
    ).resolves.toBeUndefined();
  });

  // ── complete ─────────────────────────────────────────────────────────────────

  it("complete: passes result payload", async () => {
    mockUnsafe.mockResolvedValue([]);
    await repo.complete("job-001", "t1", {
      url: "/dl/x.dxf",
      filename: "x.dxf",
      artifactSha256: "sha",
    });
    expect(mockUnsafe.mock.calls[0][1]).toContain("job-001");
    expect(mockUnsafe.mock.calls[0][1]).toContain("t1");
  });

  it("complete: no-op when DB null", async () => {
    setDbNull();
    await expect(
      repo.complete("job-001", "t1", { url: "/dl/x.dxf", filename: "x.dxf" }),
    ).resolves.toBeUndefined();
  });

  it("complete: handles DB error silently", async () => {
    mockUnsafe.mockRejectedValue(new Error("update failed"));
    await expect(
      repo.complete("job-001", "t1", { url: "/dl/x.dxf", filename: "x.dxf" }),
    ).resolves.toBeUndefined();
  });

  // ── fail ─────────────────────────────────────────────────────────────────────

  it("fail: passes error string to DB", async () => {
    mockUnsafe.mockResolvedValue([]);
    await repo.fail("job-001", "timeout error");
    expect(mockUnsafe.mock.calls[0][1]).toContain("timeout error");
  });

  it("fail: no-op when DB null", async () => {
    setDbNull();
    await expect(repo.fail("job-001", "err")).resolves.toBeUndefined();
  });

  // ── findById ─────────────────────────────────────────────────────────────────

  it("findById: returns null when DB null", async () => {
    setDbNull();
    expect(await repo.findById("job-001")).toBeNull();
  });

  it("findById: returns null when not found", async () => {
    mockUnsafe.mockResolvedValue([]);
    expect(await repo.findById("job-001")).toBeNull();
  });

  it("findById: maps row correctly", async () => {
    mockUnsafe.mockResolvedValue([dbJobRow]);
    const job = await repo.findById("job-001");
    expect(job!.id).toBe("job-001");
    expect(job!.status).toBe("pending");
    expect(job!.progress).toBe(0);
    expect(job!.attempts).toBe(0);
    expect(job!.createdAt).toBeInstanceOf(Date);
  });

  // ── findRecent ────────────────────────────────────────────────────────────────

  it("findRecent: returns empty array when DB null", async () => {
    setDbNull();
    expect(await repo.findRecent(5)).toEqual([]);
  });

  it("findRecent: maps multiple rows", async () => {
    mockUnsafe.mockResolvedValue([dbJobRow, { ...dbJobRow, id: "job-002" }]);
    const rows = await repo.findRecent(2);
    expect(rows).toHaveLength(2);
    expect(rows[1].id).toBe("job-002");
  });

  // ── deleteOld ─────────────────────────────────────────────────────────────────

  it("deleteOld: returns count", async () => {
    mockUnsafe.mockResolvedValue([{ cnt: "3" }]);
    expect(await repo.deleteOld(86_400_000, 604_800_000)).toBe(3);
  });

  it("deleteOld: returns 0 when DB null", async () => {
    setDbNull();
    expect(await repo.deleteOld(86_400_000, 604_800_000)).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// MaintenanceRepository
// ═════════════════════════════════════════════════════════════════════════════

describe("PostgresMaintenanceRepository", () => {
  let repo: PostgresMaintenanceRepository;

  beforeEach(() => {
    repo = new PostgresMaintenanceRepository();
    setDb();
    mockUnsafe.mockReset();
  });

  // ── deleteOldAuditLogs ───────────────────────────────────────────────────────

  it("deleteOldAuditLogs: returns deleted count", async () => {
    mockUnsafe.mockResolvedValue([{ cnt: "15" }]);
    expect(await repo.deleteOldAuditLogs(90)).toBe(15);
    expect(mockUnsafe.mock.calls[0][1]).toContain("90");
  });

  it("deleteOldAuditLogs: returns 0 when DB null", async () => {
    setDbNull();
    expect(await repo.deleteOldAuditLogs(90)).toBe(0);
  });

  it("deleteOldAuditLogs: returns 0 on DB error", async () => {
    mockUnsafe.mockRejectedValue(new Error("table missing"));
    expect(await repo.deleteOldAuditLogs(90)).toBe(0);
  });

  it("deleteOldAuditLogs: handles missing cnt", async () => {
    mockUnsafe.mockResolvedValue([{}]);
    expect(await repo.deleteOldAuditLogs(90)).toBe(0);
  });

  // ── deleteOldJobs ────────────────────────────────────────────────────────────

  it("deleteOldJobs: returns deleted count", async () => {
    mockUnsafe.mockResolvedValue([{ cnt: "8" }]);
    expect(await repo.deleteOldJobs(86_400_000, 604_800_000)).toBe(8);
  });

  it("deleteOldJobs: returns 0 when DB null", async () => {
    setDbNull();
    expect(await repo.deleteOldJobs(86_400_000, 604_800_000)).toBe(0);
  });

  it("deleteOldJobs: returns 0 on DB error", async () => {
    mockUnsafe.mockRejectedValue(new Error("syntax error"));
    expect(await repo.deleteOldJobs(86_400_000, 604_800_000)).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// RoleRepository
// ═════════════════════════════════════════════════════════════════════════════

describe("PostgresRoleRepository", () => {
  let repo: PostgresRoleRepository;

  beforeEach(() => {
    repo = new PostgresRoleRepository();
    setDb();
    mockUnsafe.mockReset();
  });

  const dbRoleRow = {
    user_id: "user-001",
    role: "admin",
    assigned_by: "superadmin",
    reason: "initial setup",
    assigned_at: "2026-01-01T00:00:00Z",
    last_updated: "2026-01-01T00:00:00Z",
  };

  // ── findByUserId ────────────────────────────────────────────────────────────

  it("findByUserId: returns null when DB null", async () => {
    setDbNull();
    expect(await repo.findByUserId("user-001")).toBeNull();
  });

  it("findByUserId: returns null when not found", async () => {
    mockUnsafe.mockResolvedValue([]);
    expect(await repo.findByUserId("user-001")).toBeNull();
  });

  it("findByUserId: maps row correctly", async () => {
    mockUnsafe.mockResolvedValue([dbRoleRow]);
    const row = await repo.findByUserId("user-001");
    expect(row!.userId).toBe("user-001");
    expect(row!.role).toBe("admin");
    expect(row!.assignedBy).toBe("superadmin");
    expect(row!.reason).toBe("initial setup");
    expect(row!.assignedAt).toBeInstanceOf(Date);
  });

  it("findByUserId: returns null on DB error", async () => {
    mockUnsafe.mockRejectedValue(new Error("conn error"));
    expect(await repo.findByUserId("user-001")).toBeNull();
  });

  it("findByUserId: handles null assigned_by / reason", async () => {
    mockUnsafe.mockResolvedValue([
      { ...dbRoleRow, assigned_by: null, reason: null },
    ]);
    const row = await repo.findByUserId("user-001");
    expect(row!.assignedBy).toBeNull();
    expect(row!.reason).toBeNull();
  });

  // ── findByRole ──────────────────────────────────────────────────────────────

  it("findByRole: returns empty array when DB null", async () => {
    setDbNull();
    expect(await repo.findByRole("admin")).toEqual([]);
  });

  it("findByRole: maps multiple rows", async () => {
    mockUnsafe.mockResolvedValue([
      dbRoleRow,
      { ...dbRoleRow, user_id: "user-002" },
    ]);
    const rows = await repo.findByRole("admin");
    expect(rows).toHaveLength(2);
  });

  it("findByRole: returns empty array on DB error", async () => {
    mockUnsafe.mockRejectedValue(new Error("error"));
    expect(await repo.findByRole("admin")).toEqual([]);
  });

  // ── countByRole ──────────────────────────────────────────────────────────────

  it("countByRole: returns defaults when DB null", async () => {
    setDbNull();
    const counts = await repo.countByRole();
    expect(counts.admin).toBe(0);
    expect(counts.technician).toBe(0);
    expect(counts.viewer).toBe(0);
    expect(counts.guest).toBe(0);
  });

  it("countByRole: aggregates counts from DB rows", async () => {
    mockUnsafe.mockResolvedValue([
      { role: "admin", cnt: "3" },
      { role: "viewer", cnt: "10" },
    ]);
    const counts = await repo.countByRole();
    expect(counts.admin).toBe(3);
    expect(counts.viewer).toBe(10);
    expect(counts.technician).toBe(0);
  });

  it("countByRole: returns defaults on DB error", async () => {
    mockUnsafe.mockRejectedValue(new Error("fail"));
    const counts = await repo.countByRole();
    expect(counts.admin).toBe(0);
  });

  // ── upsert ───────────────────────────────────────────────────────────────────

  it("upsert: calls DB with correct params", async () => {
    mockUnsafe.mockResolvedValue([]);
    await repo.upsert("user-001", "technician", "admin-user", "role change");
    const params = mockUnsafe.mock.calls[0][1] as any[];
    expect(params[0]).toBe("user-001");
    expect(params[1]).toBe("technician");
    expect(params[2]).toBe("admin-user");
    expect(params[3]).toBe("role change");
  });

  it("upsert: passes null when no reason", async () => {
    mockUnsafe.mockResolvedValue([]);
    await repo.upsert("user-001", "viewer", "admin-user");
    const params = mockUnsafe.mock.calls[0][1] as any[];
    expect(params[3]).toBeNull();
  });

  it("upsert: no-op when DB null", async () => {
    setDbNull();
    await expect(
      repo.upsert("user-001", "admin", "superadmin"),
    ).resolves.toBeUndefined();
  });

  it("upsert: silently handles DB error", async () => {
    mockUnsafe.mockRejectedValue(new Error("constraint"));
    await expect(
      repo.upsert("user-001", "admin", "superadmin"),
    ).resolves.toBeUndefined();
  });
});

// ─── repositories/index.ts barrel ────────────────────────────────────────────
describe("repositories/index barrel exports", () => {
  it("exporta initDbClient, closeDbClient, getDbClient, isDbAvailable, pingDb", () => {
    expect(typeof repoIndex.initDbClient).toBe("function");
    expect(typeof repoIndex.closeDbClient).toBe("function");
    expect(typeof repoIndex.getDbClient).toBe("function");
    expect(typeof repoIndex.isDbAvailable).toBe("function");
    expect(typeof repoIndex.pingDb).toBe("function");
  });

  it("exporta classes dos repositórios", () => {
    expect(repoIndex.PostgresJobRepository).toBeDefined();
    expect(repoIndex.PostgresDxfTaskRepository).toBeDefined();
    expect(repoIndex.PostgresRoleRepository).toBeDefined();
    expect(repoIndex.PostgresBtExportHistoryRepository).toBeDefined();
    expect(repoIndex.PostgresMaintenanceRepository).toBeDefined();
  });

  it("exporta instâncias singleton dos repositórios", () => {
    expect(repoIndex.jobRepository).toBeDefined();
    expect(repoIndex.dxfTaskRepository).toBeDefined();
    expect(repoIndex.roleRepository).toBeDefined();
    expect(repoIndex.btExportHistoryRepository).toBeDefined();
    expect(repoIndex.maintenanceRepository).toBeDefined();
  });
});

