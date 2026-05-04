import { config } from "../config.js";
import { getUserRole, setUserRole, type UserRole } from "./roleService.js";
import {
  isAllowedSelfSignupEmail,
  normalizeEmailAddress,
} from "./authDomainService.js";
import { getSupabaseUserById } from "./supabaseAdminService.js";
import type { VerifiedSupabaseUser } from "./supabaseJwtService.js";

export type AuthOnboardingResult =
  | {
      status: "already-provisioned" | "provisioned";
      email: string;
      role: UserRole;
      tenantId: string;
      emailConfirmed: true;
      superadmin?: boolean;
    }
  | {
      status: "pending-email-confirmation";
      email: string;
      emailConfirmed: false;
    }
  | {
      status: "domain-not-allowed";
      email: string | null;
      allowedDomain: string;
    }
  | {
      status: "unavailable";
      reason: string;
    };

export async function provisionAuthenticatedUserAccess(
  authUser: VerifiedSupabaseUser,
): Promise<AuthOnboardingResult> {
  const supabaseUser = await getSupabaseUserById(authUser.userId);
  if (!supabaseUser) {
    return {
      status: "unavailable",
      reason: "Supabase admin client is not configured or user lookup failed",
    };
  }

  const email = normalizeEmailAddress(supabaseUser.email ?? authUser.email);

  // ── Superadmin fast-path ──────────────────────────────────────────────────
  const superadminEmail = config.SUPABASE_SUPERADMIN_EMAIL
    ? normalizeEmailAddress(config.SUPABASE_SUPERADMIN_EMAIL)
    : null;
  const isSuperadmin = !!superadminEmail && email === superadminEmail;

  if (isSuperadmin) {
    const currentAccess = await getUserRole(authUser.userId);
    if (
      currentAccess.role === "admin" &&
      currentAccess.tenantId === config.DEFAULT_TENANT_ID
    ) {
      return {
        status: "already-provisioned",
        email: email!,
        role: "admin",
        tenantId: config.DEFAULT_TENANT_ID,
        emailConfirmed: true,
        superadmin: true,
      };
    }
    const updated = await setUserRole(
      authUser.userId,
      "admin",
      "auth:superadmin-bootstrap",
      "Platform superadmin auto-provisioned",
      config.DEFAULT_TENANT_ID,
    );
    return updated
      ? {
          status: "provisioned",
          email: email!,
          role: "admin",
          tenantId: config.DEFAULT_TENANT_ID,
          emailConfirmed: true,
          superadmin: true,
        }
      : { status: "unavailable", reason: "Failed to persist superadmin role" };
  }

  // ── Regular domain self-signup ────────────────────────────────────────────
  if (!email || !isAllowedSelfSignupEmail(email)) {
    return {
      status: "domain-not-allowed",
      email,
      allowedDomain: config.SUPABASE_ALLOWED_EMAIL_DOMAIN,
    };
  }

  if (!supabaseUser.email_confirmed_at) {
    return {
      status: "pending-email-confirmation",
      email,
      emailConfirmed: false,
    };
  }

  const desiredRole = config.SUPABASE_ALLOWED_DOMAIN_ROLE as UserRole;
  const desiredTenantId = config.DEFAULT_TENANT_ID;
  const currentAccess = await getUserRole(authUser.userId);

  if (
    currentAccess.role === desiredRole &&
    currentAccess.tenantId === desiredTenantId
  ) {
    return {
      status: "already-provisioned",
      email,
      role: desiredRole,
      tenantId: desiredTenantId,
      emailConfirmed: true,
    };
  }

  const updated = await setUserRole(
    authUser.userId,
    desiredRole,
    "auth:onboarding",
    `Auto-approved confirmed ${config.SUPABASE_ALLOWED_EMAIL_DOMAIN} signup`,
    desiredTenantId,
  );

  if (!updated) {
    return {
      status: "unavailable",
      reason: "Failed to persist user onboarding state",
    };
  }

  return {
    status: "provisioned",
    email,
    role: desiredRole,
    tenantId: desiredTenantId,
    emailConfirmed: true,
  };
}
