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
  try {
    _client = postgres(config.DATABASE_URL, {
      max: 5,
      connect_timeout: 8,
      ssl: config.NODE_ENV === "production" ? "require" : false,
    });
    // Warm-up: verify connectivity
    await _client`SELECT 1`;
    _available = true;
    logger.info("[DB] PostgreSQL connection pool initialised");
  } catch (err) {
    _available = false;
    logger.warn(
      "[DB] PostgreSQL unavailable – repositories will use fallbacks",
      { err },
    );
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
