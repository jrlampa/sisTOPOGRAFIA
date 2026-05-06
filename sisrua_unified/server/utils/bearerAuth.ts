import { timingSafeEqual } from "crypto";
import { Request, Response } from "express";

/**
 * Regra única para endpoints críticos:
 * - token configurado => Authorization: Bearer obrigatório
 * - token ausente => acesso permissivo
 */
export function isBearerRequestAuthorized(
  req: Request,
  token: string | undefined,
): boolean {
  if (!token) {
    return true;
  }

  const authHeader = req.headers.authorization ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return false;
  }

  const provided = Buffer.from(authHeader.slice("Bearer ".length), "utf8");
  const expected = Buffer.from(token, "utf8");
  if (provided.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(provided, expected);
}

export function setBearerChallenge(res: Response, realm: string): void {
  res.set("WWW-Authenticate", `Bearer realm="${realm}"`);
}
