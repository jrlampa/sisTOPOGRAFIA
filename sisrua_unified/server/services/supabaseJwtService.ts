import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { config } from "../config.js";

export interface SupabaseJwtPayload extends JWTPayload {
  email?: string;
  role?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}

export interface VerifiedSupabaseUser {
  userId: string;
  email: string | null;
  payload: SupabaseJwtPayload;
}

function readStringRecordValue(
  record: Record<string, unknown> | undefined,
  key: string,
): string | null {
  if (!record) {
    return null;
  }
  const value = record[key];
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

export function extractSupabaseTenantId(
  payload: SupabaseJwtPayload,
): string | null {
  const fromRoot =
    (typeof payload["tenant_id"] === "string" && payload["tenant_id"].trim()) ||
    (typeof payload["tenantId"] === "string" && payload["tenantId"].trim()) ||
    null;

  if (fromRoot) {
    return fromRoot;
  }

  return (
    readStringRecordValue(payload.app_metadata, "tenant_id") ||
    readStringRecordValue(payload.app_metadata, "tenantId") ||
    readStringRecordValue(payload.user_metadata, "tenant_id") ||
    readStringRecordValue(payload.user_metadata, "tenantId") ||
    null
  );
}

export function extractSupabaseRoleClaim(
  payload: SupabaseJwtPayload,
): string | null {
  const rootRole = typeof payload.role === "string" ? payload.role.trim() : "";
  if (rootRole.length > 0) {
    return rootRole;
  }

  return (
    readStringRecordValue(payload.app_metadata, "role") ||
    readStringRecordValue(payload.user_metadata, "role") ||
    null
  );
}

const supabaseBaseUrl = config.SUPABASE_URL?.replace(/\/+$/, "") ?? "";
const supabaseIssuer = supabaseBaseUrl ? `${supabaseBaseUrl}/auth/v1` : "";
const jwks = supabaseIssuer
  ? createRemoteJWKSet(new URL(`${supabaseIssuer}/.well-known/jwks.json`))
  : null;

export function isSupabaseAuthConfigured(): boolean {
  return Boolean(supabaseIssuer && jwks);
}

export function isLikelyJwt(token: string): boolean {
  return token.split(".").length === 3;
}

export async function verifySupabaseAccessToken(
  token: string,
): Promise<VerifiedSupabaseUser | null> {
  if (!jwks || !supabaseIssuer) {
    return null;
  }

  const { payload } = await jwtVerify(token, jwks, {
    issuer: supabaseIssuer,
    audience: config.SUPABASE_JWT_AUDIENCE?.trim() || "authenticated",
  });

  if (typeof payload.sub !== "string" || payload.sub.trim().length === 0) {
    throw new Error("Supabase JWT missing subject");
  }

  return {
    userId: payload.sub,
    email: typeof payload.email === "string" ? payload.email : null,
    payload: payload as SupabaseJwtPayload,
  };
}