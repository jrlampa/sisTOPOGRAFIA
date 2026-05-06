/**
 * enterpriseOnboardingRoutes.ts — Rotas REST para Onboarding Enterprise (122 [T1])
 */

import { Router } from "express";
import {
  generateEnterpriseOnboardingPackage,
  NETWORK_REQUIREMENTS,
  ENVIRONMENT_REQUIREMENTS,
} from "../services/enterpriseOnboardingService.js";

const router = Router();

/**
 * GET /api/enterprise-onboarding/package
 * Gera e retorna o pacote completo de homologação enterprise.
 */
router.get("/package", (_req, res) => {
  const pkg = generateEnterpriseOnboardingPackage();
  res.json(pkg);
});

/**
 * GET /api/enterprise-onboarding/network-requirements
 * Lista requisitos de portas e domínios para firewall/proxy corporativo.
 */
router.get("/network-requirements", (_req, res) => {
  res.json(NETWORK_REQUIREMENTS);
});

/**
 * GET /api/enterprise-onboarding/environment-requirements
 * Lista requisitos mínimos e recomendados de ambiente.
 */
router.get("/environment-requirements", (_req, res) => {
  res.json(ENVIRONMENT_REQUIREMENTS);
});

export default router;
