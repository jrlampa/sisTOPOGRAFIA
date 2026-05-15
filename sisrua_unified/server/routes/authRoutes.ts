import { Router, type Request, type Response } from "express";
import { config } from "../config.js";
import { getUserRole } from "../services/roleService.js";
import { provisionAuthenticatedUserAccess } from "../services/authOnboardingService.js";
import type { VerifiedSupabaseUser } from "../services/supabaseJwtService.js";

import { createError, asyncHandler } from "../errorHandler.js";

const router = Router();

function getAuthenticatedUser(res: Response): VerifiedSupabaseUser | null {
  const authenticatedUser = res.locals.authenticatedUser;
  return authenticatedUser && typeof authenticatedUser.userId === "string"
    ? (authenticatedUser as VerifiedSupabaseUser)
    : null;
}

router.get("/me", asyncHandler(async (_req: Request, res: Response) => {
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
}));

router.post("/onboarding", asyncHandler(async (_req: Request, res: Response) => {
  const authenticatedUser = getAuthenticatedUser(res);
  if (!authenticatedUser) {
    throw createError.authentication("Não autenticado", { 
      message: "Supabase session required" 
    });
  }

  const result = await provisionAuthenticatedUserAccess(authenticatedUser);

  // Adicionar campo 'erro' para compatibilidade se houver erro
  const enhancedResult = {
    ...result,
    erro: (result as any).reason || (result as any).error || undefined
  };

  if (result.status === "unavailable") {
    return res.status(503).json(enhancedResult);
  }

  if (result.status === "domain-not-allowed") {
    return res.status(403).json(enhancedResult);
  }

  if (result.status === "pending-email-confirmation") {
    return res.status(202).json(enhancedResult);
  }

  return res.json(enhancedResult);
}));

export default router;
