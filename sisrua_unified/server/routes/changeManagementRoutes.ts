/**
 * changeManagementRoutes.ts — Gestão de Mudança e Janelas de Manutenção (118 [T1])
 *
 * Endpoints para controle formal de mudanças e janelas de manutenção.
 */

import { Router } from 'express';
import { z } from 'zod';
import {
  createMaintenanceWindow,
  listMaintenanceWindows,
  getMaintenanceWindow,
  isInMaintenanceWindow,
  cancelMaintenanceWindow,
  createChangeRequest,
  getChangeRequest,
  listChangeRequests,
  approveChangeRequest,
  rejectChangeRequest,
  completeChangeRequest,
  type ChangeStatus,
} from '../services/changeManagementService.js';

const router = Router();

// ─── Schemas ───────────────────────────────────────────────────────────────

const CreateWindowSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(''),
  affectedSystems: z.array(z.string()).default([]),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  createdBy: z.string().min(1),
});

const CreateChangeSchema = z.object({
  title: z.string().min(1),
  description: z.string().default(''),
  type: z.enum(['planned', 'emergency', 'standard']),
  requestedBy: z.string().min(1),
  justification: z.string().min(1),
  rollbackPlan: z.string().min(1),
  maintenanceWindowId: z.string().optional(),
  scheduledStart: z.string().datetime().optional(),
  scheduledEnd: z.string().datetime().optional(),
});

const ApproveRejectSchema = z.object({
  actor: z.string().min(1),
});

// ─── Janelas de Manutenção ─────────────────────────────────────────────────

// GET /api/change-management/windows
router.get('/windows', (_req, res) => {
  try {
    res.json(listMaintenanceWindows());
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar janelas', detail: String(err) });
  }
});

// GET /api/change-management/windows/active
router.get('/windows/active', (req, res) => {
  try {
    const atTime = typeof req.query.atTime === 'string' ? req.query.atTime : undefined;
    res.json(isInMaintenanceWindow(atTime));
  } catch (err) {
    res.status(500).json({ error: 'Erro ao verificar janela ativa', detail: String(err) });
  }
});

// GET /api/change-management/windows/:id
router.get('/windows/:id', (req, res) => {
  try {
    const w = getMaintenanceWindow(req.params.id);
    if (!w) return res.status(404).json({ error: 'Janela não encontrada' });
    res.json(w);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar janela', detail: String(err) });
  }
});

// POST /api/change-management/windows
router.post('/windows', (req, res) => {
  const parsed = CreateWindowSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Dados inválidos', detail: parsed.error.issues });
  try {
    const w = createMaintenanceWindow(parsed.data);
    res.status(201).json(w);
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

// DELETE /api/change-management/windows/:id
router.delete('/windows/:id', (req, res) => {
  try {
    const ok = cancelMaintenanceWindow(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Janela não encontrada ou já concluída' });
    res.json({ cancelled: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao cancelar janela', detail: String(err) });
  }
});

// ─── Requisições de Mudança ────────────────────────────────────────────────

// GET /api/change-management/changes
router.get('/changes', (req, res) => {
  try {
    const status = req.query.status as ChangeStatus | undefined;
    res.json(listChangeRequests(status));
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar requisições', detail: String(err) });
  }
});

// GET /api/change-management/changes/:id
router.get('/changes/:id', (req, res) => {
  try {
    const c = getChangeRequest(req.params.id);
    if (!c) return res.status(404).json({ error: 'Requisição não encontrada' });
    res.json(c);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar requisição', detail: String(err) });
  }
});

// POST /api/change-management/changes
router.post('/changes', (req, res) => {
  const parsed = CreateChangeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Dados inválidos', detail: parsed.error.issues });
  try {
    const c = createChangeRequest(parsed.data);
    res.status(201).json(c);
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

// POST /api/change-management/changes/:id/approve
router.post('/changes/:id/approve', (req, res) => {
  const parsed = ApproveRejectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Dados inválidos', detail: parsed.error.issues });
  try {
    const c = approveChangeRequest(req.params.id, parsed.data.actor);
    res.json(c);
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

// POST /api/change-management/changes/:id/reject
router.post('/changes/:id/reject', (req, res) => {
  const parsed = ApproveRejectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Dados inválidos', detail: parsed.error.issues });
  try {
    const c = rejectChangeRequest(req.params.id, parsed.data.actor);
    res.json(c);
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

// POST /api/change-management/changes/:id/complete
router.post('/changes/:id/complete', (req, res) => {
  try {
    const c = completeChangeRequest(req.params.id);
    res.json(c);
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

export default router;
