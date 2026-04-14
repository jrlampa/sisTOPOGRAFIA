/**
 * Item 124 – Circuit Breakers para APIs Externas
 *
 * Implementação do padrão Circuit Breaker com três estados:
 * CLOSED (normal), OPEN (rejeitando), HALF_OPEN (testando recuperação).
 *
 * Instâncias pré-configuradas para APIs: TOPODATA, IBGE, INDE, OLLAMA.
 */

import { logger } from "./logger.js";

// ── Tipos e enumerações ───────────────────────────────────────────────────────

export enum CircuitState {
  /** Circuito fechado: requisições fluem normalmente */
  CLOSED = "CLOSED",
  /** Circuito aberto: requisições rejeitadas imediatamente */
  OPEN = "OPEN",
  /** Semi-aberto: uma requisição de sondagem permitida */
  HALF_OPEN = "HALF_OPEN",
}

export interface CircuitBreakerOptions {
  /** Nº de falhas consecutivas para abrir o circuito */
  failureThreshold: number;
  /** Nº de sucessos consecutivos (em HALF_OPEN) para fechar o circuito */
  successThreshold: number;
  /** Tempo em ms que o circuito permanece aberto antes de tentar HALF_OPEN */
  timeout: number;
}

export interface CircuitBreakerStats {
  name: string;
  state: CircuitState;
  failureCount: number;
  successCount: number;
  totalCalls: number;
  totalFailures: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
  nextAttemptTime?: Date;
}

// ── Classe CircuitBreaker ─────────────────────────────────────────────────────

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private totalCalls = 0;
  private totalFailures = 0;
  private lastFailureTime?: Date;
  private lastSuccessTime?: Date;
  private nextAttemptTime?: Date;

  constructor(
    private readonly name: string,
    private readonly options: CircuitBreakerOptions,
  ) {
    logger.info(`CircuitBreaker "${name}" inicializado`, {
      failureThreshold: options.failureThreshold,
      successThreshold: options.successThreshold,
      timeoutMs: options.timeout,
    });
  }

  // ── Getters de estado ───────────────────────────────────────────────────────

  getState(): CircuitState {
    return this.state;
  }

  getStats(): CircuitBreakerStats {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      totalCalls: this.totalCalls,
      totalFailures: this.totalFailures,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      nextAttemptTime: this.nextAttemptTime,
    };
  }

  // ── Transições de estado ────────────────────────────────────────────────────

  private transitionTo(newState: CircuitState): void {
    if (this.state === newState) return;

    logger.info(`CircuitBreaker "${this.name}": ${this.state} → ${newState}`, {
      failureCount: this.failureCount,
      successCount: this.successCount,
    });

    this.state = newState;

    if (newState === CircuitState.OPEN) {
      this.nextAttemptTime = new Date(Date.now() + this.options.timeout);
      this.successCount = 0;
    } else if (newState === CircuitState.HALF_OPEN) {
      this.successCount = 0;
      this.failureCount = 0;
    } else if (newState === CircuitState.CLOSED) {
      this.failureCount = 0;
      this.successCount = 0;
      this.nextAttemptTime = undefined;
    }
  }

  // ── Lógica de tentativa ─────────────────────────────────────────────────────

  private canAttempt(): boolean {
    if (this.state === CircuitState.CLOSED) return true;

    if (this.state === CircuitState.OPEN) {
      if (this.nextAttemptTime && Date.now() >= this.nextAttemptTime.getTime()) {
        this.transitionTo(CircuitState.HALF_OPEN);
        return true;
      }
      return false;
    }

    // HALF_OPEN: permite apenas uma sondagem por vez
    return true;
  }

  private onSuccess(): void {
    this.lastSuccessTime = new Date();
    this.successCount++;

    if (this.state === CircuitState.HALF_OPEN) {
      if (this.successCount >= this.options.successThreshold) {
        this.transitionTo(CircuitState.CLOSED);
      }
    } else if (this.state === CircuitState.CLOSED) {
      // Reseta contagem de falhas a cada sucesso (janela deslizante simplificada)
      this.failureCount = 0;
    }
  }

  private onFailure(error: unknown): void {
    this.lastFailureTime = new Date();
    this.totalFailures++;
    this.failureCount++;

    logger.warn(`CircuitBreaker "${this.name}": falha registrada`, {
      failureCount: this.failureCount,
      threshold: this.options.failureThreshold,
      error: error instanceof Error ? error.message : String(error),
    });

    if (this.state === CircuitState.HALF_OPEN) {
      // Qualquer falha em HALF_OPEN reabre o circuito
      this.transitionTo(CircuitState.OPEN);
    } else if (
      this.state === CircuitState.CLOSED &&
      this.failureCount >= this.options.failureThreshold
    ) {
      this.transitionTo(CircuitState.OPEN);
    }
  }

  // ── Método principal de execução ────────────────────────────────────────────

  /**
   * Executa a função protegida pelo circuit breaker.
   * Lança CircuitOpenError se o circuito estiver aberto.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalCalls++;

    if (!this.canAttempt()) {
      const err = new CircuitOpenError(
        this.name,
        this.nextAttemptTime,
      );
      logger.warn(`CircuitBreaker "${this.name}": requisição rejeitada (circuito aberto)`, {
        nextAttemptTime: this.nextAttemptTime?.toISOString(),
      });
      throw err;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      // Não trata CircuitOpenError como falha do serviço downstream
      if (error instanceof CircuitOpenError) throw error;

      this.onFailure(error);
      throw error;
    }
  }

  /** Força o reset do circuit breaker para o estado CLOSED (uso em testes/admin). */
  reset(): void {
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttemptTime = undefined;
    this.transitionTo(CircuitState.CLOSED);
    logger.info(`CircuitBreaker "${this.name}" resetado manualmente`);
  }
}

// ── Erro específico de circuito aberto ────────────────────────────────────────

export class CircuitOpenError extends Error {
  constructor(
    public readonly breakerName: string,
    public readonly retryAfter?: Date,
  ) {
    super(
      `Circuito "${breakerName}" está aberto.` +
        (retryAfter
          ? ` Próxima tentativa após: ${retryAfter.toISOString()}`
          : ""),
    );
    this.name = "CircuitOpenError";
  }
}

// ── Circuit breakers pré-configurados para APIs externas ─────────────────────

/** Circuit breaker para API de dados topográficos TOPODATA (INPE) */
export const topodataBreaker = new CircuitBreaker("TOPODATA", {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 30_000, // 30 segundos
});

/** Circuit breaker para API do IBGE (geocodificação, malha territorial) */
export const ibgeBreaker = new CircuitBreaker("IBGE", {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 60_000, // 60 segundos – IBGE pode demorar a se recuperar
});

/** Circuit breaker para INDE (Infraestrutura Nacional de Dados Espaciais) */
export const indeBreaker = new CircuitBreaker("INDE", {
  failureThreshold: 3,
  successThreshold: 1,
  timeout: 45_000, // 45 segundos
});

/** Circuit breaker para Ollama (LLM local) */
export const ollamaBreaker = new CircuitBreaker("OLLAMA", {
  failureThreshold: 3,
  successThreshold: 2,
  timeout: 15_000, // 15 segundos – processo local deve se recuperar mais rápido
});

/** Mapa centralizado de todos os circuit breakers registrados */
export const circuitBreakers: Record<string, CircuitBreaker> = {
  TOPODATA: topodataBreaker,
  IBGE: ibgeBreaker,
  INDE: indeBreaker,
  OLLAMA: ollamaBreaker,
};
