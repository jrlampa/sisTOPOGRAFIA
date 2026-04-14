/**
 * Item 5 – Dependency Injection / IoC Container (manual pattern)
 *
 * Registro singleton com inicialização lazy. Não usa decoradores nem
 * bibliotecas externas (sem tsyringe/inversify) – apenas padrão manual
 * compatível com o moduleResolution NodeNext do projeto.
 */

// ── Tokens de serviço ─────────────────────────────────────────────────────────

export enum ServiceTokens {
  JOB_STATUS_SERVICE = "jobStatusService",
  METRICS_SERVICE = "metricsService",
  ROLE_SERVICE = "roleService",
  TOPOLOGY_VALIDATOR_SERVICE = "topologyValidatorService",
  DOMAIN_SNAPSHOT_SERVICE = "domainSnapshotService",
  FEATURE_FLAG_SERVICE = "featureFlagService",
}

// ── Tipos internos ────────────────────────────────────────────────────────────

type Factory<T> = () => T;

interface Registration<T> {
  factory: Factory<T>;
  instance?: T;
}

// ── Container ─────────────────────────────────────────────────────────────────

class DIContainer {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly registry = new Map<string, Registration<any>>();

  /**
   * Registra uma fábrica para o token informado.
   * A instância só é criada na primeira chamada a `get`.
   */
  register<T>(token: string, factory: Factory<T>): void {
    this.registry.set(token, { factory });
  }

  /**
   * Retorna a instância singleton do serviço associado ao token.
   * Lança erro se o token não foi registrado.
   */
  get<T>(token: string): T {
    const entry = this.registry.get(token) as Registration<T> | undefined;

    if (!entry) {
      throw new Error(
        `[DIContainer] Serviço não registrado: "${token}". ` +
          `Tokens disponíveis: [${[...this.registry.keys()].join(", ")}]`,
      );
    }

    if (entry.instance === undefined) {
      entry.instance = entry.factory();
    }

    return entry.instance;
  }

  /** Remove todos os registros (útil em testes). */
  reset(): void {
    this.registry.clear();
  }

  /** Lista os tokens atualmente registrados. */
  tokens(): string[] {
    return [...this.registry.keys()];
  }
}

// ── Instância global ──────────────────────────────────────────────────────────

export const container = new DIContainer();

// ── Registros padrão (lazy – importações ocorrem só quando solicitadas) ────────

container.register(ServiceTokens.JOB_STATUS_SERVICE, () => {
  // Importação dinâmica síncrona – o módulo já terá sido carregado pelo runtime
  // pois o Node.js cacheia módulos ESM após o primeiro import estático.
  // Usamos require-style apenas como referência; o objeto real é o namespace exportado.
  return import("../services/jobStatusService.js");
});

container.register(ServiceTokens.METRICS_SERVICE, () => {
  return import("../services/metricsService.js").then((m) => m.metricsService);
});

container.register(ServiceTokens.ROLE_SERVICE, () => {
  return import("../services/roleService.js");
});

container.register(ServiceTokens.TOPOLOGY_VALIDATOR_SERVICE, () => {
  return import("../services/topologyValidatorService.js").then(
    (m) => m.topologyValidatorService,
  );
});

container.register(ServiceTokens.DOMAIN_SNAPSHOT_SERVICE, () => {
  return import("../services/domainSnapshotService.js").then(
    (m) => m.domainSnapshotService,
  );
});

container.register(ServiceTokens.FEATURE_FLAG_SERVICE, () => {
  return import("../services/featureFlagService.js").then(
    (m) => m.featureFlagService,
  );
});
