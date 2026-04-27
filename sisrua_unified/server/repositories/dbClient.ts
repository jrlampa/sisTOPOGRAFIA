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

export type SqlClient = ReturnType<typeof postgres>;

// Singleton – lazily initialized on first use.
let _client: SqlClient | null = null;
let _available = false;

export async function initDbClient(): Promise<void> {
  if (_client || !config.DATABASE_URL) {
    return;
  }

  // Extrair metadados para wake-up e fallback
  const projectMatch = config.DATABASE_URL.match(/postgres\.([^:@/]+)/);
  const projectId = projectMatch ? projectMatch[1] : null;
  const wakeupUrl = projectId ? `https://${projectId}.supabase.co` : null;

  const maxAttempts = 10;
  const delayMs = 5000;
  let attempt = 0;

  while (attempt < maxAttempts) {
    attempt++;
    try {
      // Conexão robusta usando parâmetros explícitos
      _client = postgres({
        host: "aws-1-us-east-1.pooler.supabase.com",
        port: 5432,
        database: "postgres",
        username: "postgres.zqtewkmqweicgacycnap",
        password: (config as any).SUPABASE_PASSWORD || "Oliva100%$#@!",
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
      const isTenantError = errorMessage.includes("Tenant or user not found") || 
                           errorMessage.includes("password authentication failed");
      
      if (isTenantError && wakeupUrl) {
        logger.warn(
          `[DB] Supabase dormindo ou falha de auth? Acordando projeto '${projectId}'... (Tentativa ${attempt}/${maxAttempts})`,
          { url: wakeupUrl, error: errorMessage }
        );
        fetch(wakeupUrl).catch(() => undefined);
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
    return true;
  } catch (err) {
    _available = false;
    logger.error("[DB] Ping failed", { err });
    return false;
  }
}
