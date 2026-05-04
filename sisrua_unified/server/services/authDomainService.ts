import { config } from "../config.js";

const EMAIL_SHAPE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function normalizeEmailAddress(email: string | null | undefined): string | null {
  if (typeof email !== "string") {
    return null;
  }

  const normalized = email.trim().toLowerCase();
  if (!normalized || !EMAIL_SHAPE.test(normalized)) {
    return null;
  }

  return normalized;
}

export function extractEmailDomain(email: string | null | undefined): string | null {
  const normalized = normalizeEmailAddress(email);
  if (!normalized) {
    return null;
  }

  const atIndex = normalized.lastIndexOf("@");
  return atIndex >= 0 ? normalized.slice(atIndex + 1) : null;
}

export function isAllowedSelfSignupEmail(
  email: string | null | undefined,
  allowedDomain = config.SUPABASE_ALLOWED_EMAIL_DOMAIN,
): boolean {
  const normalizedDomain = allowedDomain.trim().toLowerCase();
  return extractEmailDomain(email) === normalizedDomain;
}