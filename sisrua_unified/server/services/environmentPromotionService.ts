/**
 * environmentPromotionService.ts — Promotion Controlado entre Ambientes (20 [T1])
 */

import { logger } from "../utils/logger.js";

export type Environment = "dev" | "homolog" | "preprod" | "prod";

export interface BuildArtifact {
  id: string;
  version: string;
  gitCommit: string;
  artifactHash: string;
  createdAt: string;
  currentEnvironment: Environment;
}

export interface PromotionEvent {
  id: string;
  buildId: string;
  from: Environment;
  to: Environment;
  approvedBy: string;
  changeRequestId: string;
  checks: {
    testsPassed: boolean;
    securityGatePassed: boolean;
    observabilityGatePassed: boolean;
  };
  promotedAt: string;
}

const allowedFlow: Record<Environment, Environment[]> = {
  dev: ["homolog"],
  homolog: ["preprod"],
  preprod: ["prod"],
  prod: [],
};

const builds: BuildArtifact[] = [];
const promotions: PromotionEvent[] = [];

export class EnvironmentPromotionService {
  static registerBuild(data: Omit<BuildArtifact, "id" | "createdAt" | "currentEnvironment">): BuildArtifact {
    const build: BuildArtifact = {
      id: `build-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      version: data.version,
      gitCommit: data.gitCommit,
      artifactHash: data.artifactHash,
      createdAt: new Date().toISOString(),
      currentEnvironment: "dev",
    };
    builds.push(build);
    logger.info(`promotion: build registrada ${build.id} (${build.version})`);
    return build;
  }

  static listBuilds(): BuildArtifact[] {
    return [...builds];
  }

  static getBuildById(buildId: string): BuildArtifact | null {
    return builds.find((b) => b.id === buildId) ?? null;
  }

  static promote(data: {
    buildId: string;
    to: Environment;
    approvedBy: string;
    changeRequestId: string;
    checks: {
      testsPassed: boolean;
      securityGatePassed: boolean;
      observabilityGatePassed: boolean;
    };
  }): PromotionEvent {
    const build = builds.find((b) => b.id === data.buildId);
    if (!build) {
      throw new Error("Build não encontrado.");
    }

    const from = build.currentEnvironment;
    if (!allowedFlow[from].includes(data.to)) {
      throw new Error(`Promoção inválida: ${from} -> ${data.to}`);
    }

    if (!data.checks.testsPassed || !data.checks.securityGatePassed || !data.checks.observabilityGatePassed) {
      throw new Error("Policy gates de promoção não atendidos.");
    }

    const event: PromotionEvent = {
      id: `promo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      buildId: build.id,
      from,
      to: data.to,
      approvedBy: data.approvedBy,
      changeRequestId: data.changeRequestId,
      checks: data.checks,
      promotedAt: new Date().toISOString(),
    };

    build.currentEnvironment = data.to;
    promotions.push(event);

    logger.info(`promotion: build ${build.id} promovida ${from} -> ${data.to}`);
    return event;
  }

  static getPromotionHistory(buildId?: string): PromotionEvent[] {
    const history = buildId
      ? promotions.filter((p) => p.buildId === buildId)
      : promotions;

    return [...history].sort(
      (a, b) => new Date(b.promotedAt).getTime() - new Date(a.promotedAt).getTime(),
    );
  }

  static getPipelineState(): Array<{
    environment: Environment;
    builds: BuildArtifact[];
  }> {
    const envs: Environment[] = ["dev", "homolog", "preprod", "prod"];
    return envs.map((env) => ({
      environment: env,
      builds: builds.filter((b) => b.currentEnvironment === env),
    }));
  }
}
