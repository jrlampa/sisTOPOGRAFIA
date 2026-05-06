/**
 * Central database client (Repository Pattern – Item 2).
 *
 * Single shared postgres connection pool for the entire server.
 * All repositories receive this client via constructor injection, preventing
 * each service from creating its own isolated connection pool.
 *
 * SECURITY: SSL required in production (`NODE_ENV=production`).
 * RESILIENCE: connect_timeout + max pool size bounded to avoid exhaustion.
 */
import postgres from "postgres";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import { metricsService } from "../services/metricsService.js";

export type SqlClient = ReturnType<typeof postgres>;

interface PostgresClientWithStats extends SqlClient {
  stats?: {
    max?: number;
    idle?: number;
  };
}

// Singleton – lazily initialized on first use.
let _client: SqlClient | null = null;
let _available = false;

export async function initDbClient(): Promise<void> {
  if (_client || !config.DATABASE_URL) {
    return;
  }

  // Extrair metadados para wake-up e fallback
  const wakeupUrl = config.DATABASE_URL.includes("supabase.co") 
    ? config.DATABASE_URL.split("@")[1]?.split(":")[0] 
    : null;

  const maxAttempts = 5;
  const delayMs = 3000;
  let attempt = 0;

  while (attempt < maxAttempts) {
    attempt++;
    try {
      // Conexão robusta usando a URL do config (que já foi sanitizada)
      _client = postgres(config.DATABASE_URL, {
        ssl: config.NODE_ENV === "production" ? "require" : false,
        max: 5,
        connect_timeout: 10,
      });

      // Warm-up: verify connectivity
      await _client`SELECT 1`;
      _available = true;
      logger.info(`[DB] PostgreSQL conectado com sucesso! (Tentativa ${attempt})`);
      return;
    } catch (err) {
      _available = false;
      const errorMessage = (err as Error).message;
      
      if (wakeupUrl) {
        logger.warn(
          `[DB] Supabase dormindo ou falha de auth? Acordando projeto... (Tentativa ${attempt}/${maxAttempts})`,
          { error: errorMessage }
        );
        fetch(`https://${wakeupUrl}`).catch(() => undefined);
      } else {
        logger.warn(
          `[DB] Tentando conectar ao banco de dados... (${attempt}/${maxAttempts})`,
          { error: errorMessage }
        );
      }

      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      } else {
        logger.error("[DB] Falha crítica na inicialização do banco. Fallbacks ativos.");
      }
    }
  }
}

export async function closeDbClient(): Promise<void> {
  if (_client) {
    await _client.end({ timeout: 3 }).catch(() => undefined);
    _client = null;
    _available = false;
  }
}

/** Returns the client if available. Throws when required=true and DB is down. */
export function getDbClient(required = false): SqlClient | null {
  if (required && !_available) {
    throw new Error(
      "PostgreSQL unavailable and this operation requires a DB connection.",
    );
  }
  return _available ? _client : null;
}

export function isDbAvailable(): boolean {
  return _available;
}

/** Perfil real-time: perform a small query to verify connection status. */
export async function pingDb(): Promise<boolean> {
  if (!_client) return false;
  try {
    await _client`SELECT 1`;
    _available = true;

    const stats = (_client as PostgresClientWithStats).stats;
    if (stats) {
      metricsService.recordDbPoolState({
        size: stats.max || 0,
        used: (stats.max || 0) - (stats.idle || 0)
      });
    }

    return true;
  } catch (err) {
    _available = false;
    logger.error("[DB] Ping failed", { err });
    return false;
  }
}
