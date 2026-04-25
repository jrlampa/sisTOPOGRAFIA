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

  const maxAttempts = 5;
  let attempt = 0;

  while (attempt < maxAttempts) {
    attempt++;
    try {
      _client = postgres(config.DATABASE_URL, {
        max: 5,
        connect_timeout: 10,
        ssl: config.NODE_ENV === "production" ? "require" : false,
      });
      // Warm-up: verify connectivity
      await _client`SELECT 1`;
      _available = true;
      logger.info(`[DB] PostgreSQL initialised (Attempt ${attempt})`);
      return;
    } catch (err) {
      _available = false;
      const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
      logger.warn(
        `[DB] PostgreSQL connection attempt ${attempt}/${maxAttempts} failed. Retrying in ${delay}ms...`,
        { error: (err as Error).message },
      );
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        logger.error("[DB] PostgreSQL initialization failed after max attempts. Fallbacks active.");
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
