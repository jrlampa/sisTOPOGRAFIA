import { Router } from "express";
import { z } from "zod";
import {
  MultiTenantIsolationService,
  type IsolationLevel,
} from "../services/multiTenantIsolationService.js";

const router = Router();

// ─── Schemas ────────────────────────────────────────────────────────────────

const IsolationLevelEnum = z.enum(["strict", "standard", "relaxed"]);

const RegistrarSchema = z.object({
  tenantId: z.string().min(1),
  level: IsolationLevelEnum.optional(),
});

const AcessoSchema = z.object({
  tenantId: z.string().min(1),
  solicitanteId: z.string().min(1),
});

const AtualizarLevelSchema = z.object({
  level: IsolationLevelEnum,
});

// ─── Endpoints ───────────────────────────────────────────────────────────────

// POST /api/tenant-isolation/tenants — registrar tenant
router.post("/tenants", (req, res) => {
  const parsed = RegistrarSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ erro: parsed.error.issues });
  const profile = MultiTenantIsolationService.registrarTenant(parsed.data);
  return res.status(201).json(profile);
});

// GET /api/tenant-isolation/tenants — listar tenants
router.get("/tenants", (_req, res) => {
  return res.json(MultiTenantIsolationService.listProfiles());
});

// GET /api/tenant-isolation/tenants/:tenantId — perfil de isolamento
router.get("/tenants/:tenantId", (req, res) => {
  const profile = MultiTenantIsolationService.getProfile(req.params.tenantId);
  if (!profile) return res.status(404).json({ erro: "Tenant não registrado" });
  return res.json(profile);
});

// PUT /api/tenant-isolation/tenants/:tenantId/level — atualizar nível de isolamento
router.put("/tenants/:tenantId/level", (req, res) => {
  const parsed = AtualizarLevelSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ erro: parsed.error.issues });
  try {
    const profile = MultiTenantIsolationService.atualizarLevel(
      req.params.tenantId,
      parsed.data.level as IsolationLevel,
    );
    return res.json(profile);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    return res.status(404).json({ erro: msg });
  }
});

// POST /api/tenant-isolation/verificar — verificar acesso cross-tenant
router.post("/verificar", (req, res) => {
  const parsed = AcessoSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ erro: parsed.error.issues });
  const resultado = MultiTenantIsolationService.verificarAcesso(parsed.data);
  const status = resultado.permitido ? 200 : 403;
  return res.status(status).json(resultado);
});

// POST /api/tenant-isolation/tenants/:tenantId/rotacionar-chave — rotacionar chave de criptografia
router.post("/tenants/:tenantId/rotacionar-chave", (req, res) => {
  try {
    const profile = MultiTenantIsolationService.rotacionarChave(req.params.tenantId);
    return res.json(profile);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    return res.status(404).json({ erro: msg });
  }
});

// GET /api/tenant-isolation/relatorio — relatório de isolamento
router.get("/relatorio", (_req, res) => {
  return res.json(MultiTenantIsolationService.getRelatorio());
});

export default router;
