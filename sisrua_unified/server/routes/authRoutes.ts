import { Router, type Request, type Response } from "express";
import { config } from "../config.js";
import { getUserRole } from "../services/roleService.js";
import { provisionAuthenticatedUserAccess } from "../services/authOnboardingService.js";
import type { VerifiedSupabaseUser } from "../services/supabaseJwtService.js";

const router = Router();

function getAuthenticatedUser(res: Response): VerifiedSupabaseUser | null {
  const authenticatedUser = res.locals.authenticatedUser;
  return authenticatedUser && typeof authenticatedUser.userId === "string"
    ? (authenticatedUser as VerifiedSupabaseUser)
    : null;
}

router.get("/me", async (_req: Request, res: Response) => {
  const authenticatedUser = getAuthenticatedUser(res);
  if (!authenticatedUser) {
    return res.json({ authenticated: false });
  }

  const access = await getUserRole(authenticatedUser.userId);
  const isSuperadmin =
    !!config.SUPABASE_SUPERADMIN_EMAIL &&
    authenticatedUser.email?.toLowerCase().trim() ===
      config.SUPABASE_SUPERADMIN_EMAIL.toLowerCase().trim();

  return res.json({
    authenticated: true,
    user: {
      id: authenticatedUser.userId,
      email: authenticatedUser.email,
    },
    access,
    superadmin: isSuperadmin,
    signupPolicy: {
      allowedDomain: config.SUPABASE_ALLOWED_EMAIL_DOMAIN,
      requiredEmailConfirmation: true,
    },
  });
});

router.post("/onboarding", async (_req: Request, res: Response) => {
  const authenticatedUser = getAuthenticatedUser(res);
  if (!authenticatedUser) {
    return res.status(401).json({
      error: "Unauthorized",
      code: "UNAUTHORIZED",
      message: "Supabase session required",
    });
  }

  const result = await provisionAuthenticatedUserAccess(authenticatedUser);

  if (result.status === "unavailable") {
    return res.status(503).json(result);
  }

  if (result.status === "domain-not-allowed") {
    return res.status(403).json(result);
  }

  if (result.status === "pending-email-confirmation") {
    return res.status(202).json(result);
  }

  return res.json(result);
});

export default router;
