import { Router } from "express";
import { z } from "zod";
import { IdentityLifecycleService } from "../services/identityLifecycleService.js";

const router = Router();

// ─── Schemas ────────────────────────────────────────────────────────────────

const JoinerSchema = z.object({
  username: z.string().min(1),
  email: z.string().email(),
  nomeCompleto: z.string().min(1),
  departamento: z.string().min(1),
  cargo: z.string().min(1),
  tenantId: z.string().min(1),
  roles: z.array(z.string()).optional(),
  externalId: z.string().optional(),
  executor: z.string().min(1),
});

const MoverSchema = z.object({
  departamento: z.string().optional(),
  cargo: z.string().optional(),
  roles: z.array(z.string()).optional(),
  executor: z.string().min(1),
});

const LeaverSchema = z.object({
  executor: z.string().min(1),
});

const ScimCreateSchema = z.object({
  schemas: z.array(z.string()).optional(),
  userName: z.string().min(1),
  name: z
    .object({
      formatted: z.string().optional(),
      givenName: z.string().optional(),
      familyName: z.string().optional(),
    })
    .optional(),
  emails: z
    .array(z.object({ value: z.string(), primary: z.boolean().optional() }))
    .optional(),
  active: z.boolean().optional(),
  externalId: z.string().optional(),
  tenantId: z.string().min(1),
});

const ScimUpdateSchema = z.object({
  active: z.boolean().optional(),
  name: z.object({ formatted: z.string().optional() }).optional(),
  emails: z
    .array(z.object({ value: z.string(), primary: z.boolean().optional() }))
    .optional(),
});

// ─── JML Endpoints ──────────────────────────────────────────────────────────

// POST /api/identity/joiner — provisionar novo usuário (Joiner)
router.post("/joiner", (req, res) => {
  const parsed = JoinerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ erro: parsed.error.issues });
  const user = IdentityLifecycleService.joiner(parsed.data);
  return res.status(201).json(user);
});

// POST /api/identity/mover/:userId — mudança de função/departamento
router.post("/mover/:userId", (req, res) => {
  const parsed = MoverSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ erro: parsed.error.issues });
  try {
    const user = IdentityLifecycleService.mover({ userId: req.params.userId, ...parsed.data });
    return res.json(user);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    return res.status(404).json({ erro: msg });
  }
});

// POST /api/identity/leaver/:userId — desativação (Leaver)
router.post("/leaver/:userId", (req, res) => {
  const parsed = LeaverSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ erro: parsed.error.issues });
  try {
    const user = IdentityLifecycleService.leaver({ userId: req.params.userId, executor: parsed.data.executor });
    return res.json(user);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    return res.status(404).json({ erro: msg });
  }
});

// GET /api/identity/users — listar usuários
router.get("/users", (req, res) => {
  const tenantId = typeof req.query.tenantId === "string" ? req.query.tenantId : undefined;
  return res.json(IdentityLifecycleService.listUsers(tenantId));
});

// GET /api/identity/users/:id — obter usuário
router.get("/users/:id", (req, res) => {
  const user = IdentityLifecycleService.getUser(req.params.id);
  if (!user) return res.status(404).json({ erro: "Usuário não encontrado" });
  return res.json(user);
});

// GET /api/identity/audit — trilha de auditoria JML
router.get("/audit", (req, res) => {
  const tenantId = typeof req.query.tenantId === "string" ? req.query.tenantId : undefined;
  return res.json(IdentityLifecycleService.getAudit(tenantId));
});

// ─── SCIM v2 Endpoints ───────────────────────────────────────────────────────

// POST /api/identity/scim/v2/Users — criar usuário via SCIM
router.post("/scim/v2/Users", (req, res) => {
  const parsed = ScimCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ erro: parsed.error.issues });
  const scimUser = IdentityLifecycleService.scimCreateUser(parsed.data);
  return res.status(201).json(scimUser);
});

// GET /api/identity/scim/v2/Users — listar usuários SCIM
router.get("/scim/v2/Users", (req, res) => {
  const tenantId = typeof req.query.tenantId === "string" ? req.query.tenantId : undefined;
  return res.json(IdentityLifecycleService.scimListUsers(tenantId));
});

// GET /api/identity/scim/v2/Users/:id — obter usuário SCIM
router.get("/scim/v2/Users/:id", (req, res) => {
  const user = IdentityLifecycleService.scimGetUser(req.params.id);
  if (!user) return res.status(404).json({ erro: "Usuário não encontrado" });
  return res.json(user);
});

// PUT /api/identity/scim/v2/Users/:id — atualizar usuário SCIM
router.put("/scim/v2/Users/:id", (req, res) => {
  const parsed = ScimUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ erro: parsed.error.issues });
  try {
    const user = IdentityLifecycleService.scimUpdateUser(req.params.id, parsed.data);
    return res.json(user);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    return res.status(404).json({ erro: msg });
  }
});

// DELETE /api/identity/scim/v2/Users/:id — desativar usuário SCIM
router.delete("/scim/v2/Users/:id", (req, res) => {
  const deleted = IdentityLifecycleService.scimDeleteUser(req.params.id);
  if (!deleted) return res.status(404).json({ erro: "Usuário não encontrado" });
  return res.status(204).send();
});

export default router;
