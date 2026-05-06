import { beforeEach, describe, expect, it } from "vitest";
import {
  ReleaseCabService,
  resetReleaseCabState,
} from "../services/releaseCabService";

describe("ReleaseCabService", () => {
  beforeEach(() => {
    resetReleaseCabState();
  });

  it("lista release seed e busca por id", () => {
    const releases = ReleaseCabService.getReleases();
    expect(releases.length).toBeGreaterThanOrEqual(1);

    const first = releases[0];
    expect(ReleaseCabService.getReleaseById(first.id)?.id).toBe(first.id);
  });

  it("bloqueia release normal em janela de congelamento e permite hotfix", () => {
    expect(() =>
      ReleaseCabService.registerRelease({
        version: "1.2.3",
        type: "minor",
        title: "Minor release",
        description: "desc",
        proposer: "tech-lead",
        scheduledAt: "2026-12-25T10:00:00.000Z",
        gitCommit: "abc123",
        maintenanceWindowUtc: "2026-12-25T10:00/2026-12-25T11:00",
        rollbackPlan: "git revert",
        changelogEntry: "entry",
      }),
    ).toThrow("congelamento");

    const hotfix = ReleaseCabService.registerRelease({
      version: "1.2.4",
      type: "hotfix",
      title: "Hotfix",
      description: "desc",
      proposer: "on-call",
      scheduledAt: "2026-12-25T10:00:00.000Z",
      gitCommit: "def456",
      maintenanceWindowUtc: "2026-12-25T10:00/2026-12-25T11:00",
      rollbackPlan: "git revert",
      changelogEntry: "entry",
    });

    expect(hotfix.status).toBe("planejado");
  });

  it("aprova release com regra de quorum", () => {
    const rel = ReleaseCabService.registerRelease({
      version: "2.0.0",
      type: "major",
      title: "Major",
      description: "desc",
      proposer: "tech-lead",
      scheduledAt: "2026-11-10T10:00:00.000Z",
      gitCommit: "abc999",
      maintenanceWindowUtc: "2026-11-10T10:00/2026-11-10T11:00",
      rollbackPlan: "rollback",
      changelogEntry: "entry",
    });

    const first = ReleaseCabService.approveRelease(rel.id, "cab-a");
    expect(first.status).toBe("planejado");

    const second = ReleaseCabService.approveRelease(rel.id, "cab-b");
    expect(second.status).toBe("aprovado");

    expect(() => ReleaseCabService.approveRelease(rel.id, "cab-c")).toThrow("não está em estado");
  });

  it("cria e aprova RDM com regras de prioridade", () => {
    const critical = ReleaseCabService.createChangeRequest({
      title: "Mudanca critica",
      description: "desc",
      type: "normal",
      priority: "critica",
      proposer: "dev-a",
      impactedSystems: ["api"],
      rollbackPlan: "rollback",
      testingEvidence: "tests",
      windowStartUtc: "2026-11-15T10:00:00.000Z",
      windowEndUtc: "2026-11-15T11:00:00.000Z",
    });

    const first = ReleaseCabService.approveChangeRequest(critical.id, "cab-a");
    expect(first.status).toBe("pendente_aprovacao");

    const second = ReleaseCabService.approveChangeRequest(critical.id, "cab-b");
    expect(second.status).toBe("aprovado");

    const normal = ReleaseCabService.createChangeRequest({
      title: "Mudanca normal",
      description: "desc",
      type: "padrao",
      priority: "media",
      proposer: "dev-b",
      impactedSystems: ["worker"],
      rollbackPlan: "rollback",
      testingEvidence: "tests",
      windowStartUtc: "2026-11-16T10:00:00.000Z",
      windowEndUtc: "2026-11-16T11:00:00.000Z",
    });

    const normalApproved = ReleaseCabService.approveChangeRequest(normal.id, "cab-a");
    expect(normalApproved.status).toBe("aprovado");

    const approvedOnly = ReleaseCabService.getChangeRequests("aprovado");
    expect(approvedOnly.length).toBeGreaterThanOrEqual(2);
  });

  it("bloqueia RDM em congelamento quando não emergencial", () => {
    expect(() =>
      ReleaseCabService.createChangeRequest({
        title: "Mudanca bloqueada",
        description: "desc",
        type: "normal",
        priority: "alta",
        proposer: "dev-a",
        impactedSystems: ["api"],
        rollbackPlan: "rollback",
        testingEvidence: "tests",
        windowStartUtc: "2026-12-25T10:00:00.000Z",
        windowEndUtc: "2026-12-25T11:00:00.000Z",
      }),
    ).toThrow("congelamento");

    const emergencial = ReleaseCabService.createChangeRequest({
      title: "Mudanca emergencial",
      description: "desc",
      type: "emergencial",
      priority: "alta",
      proposer: "dev-a",
      impactedSystems: ["api"],
      rollbackPlan: "rollback",
      testingEvidence: "tests",
      windowStartUtc: "2026-12-25T10:00:00.000Z",
      windowEndUtc: "2026-12-25T11:00:00.000Z",
    });

    expect(emergencial.status).toBe("pendente_aprovacao");
  });
});
