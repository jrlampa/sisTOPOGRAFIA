/**
 * serviceDeskRoutes.ts — Rotas de Service Desk L1/L2/L3 (113 [T1])
 */

import { Router } from "express";
import { z } from "zod";
import { ServiceDeskService } from "../services/serviceDeskService.js";

const router = Router();

// GET /api/servicedesk/tickets — lista tickets com filtros opcionais
router.get("/tickets", (req, res) => {
  try {
    const { status, level, priority, tenantId } = req.query as Record<string, string>;
    res.json(
      ServiceDeskService.getTickets({
        status: status as never,
        level: level as never,
        priority: priority as never,
        tenantId,
      }),
    );
  } catch (err) {
    res
      .status(500)
      .json({ error: "Erro ao listar tickets", detail: String(err) });
  }
});

// GET /api/servicedesk/metrics — métricas do service desk
router.get("/metrics", (_req, res) => {
  try {
    res.json(ServiceDeskService.getMetrics());
  } catch (err) {
    res
      .status(500)
      .json({ error: "Erro ao obter métricas", detail: String(err) });
  }
});

// GET /api/servicedesk/sla-alerts — tickets com SLA em risco
router.get("/sla-alerts", (_req, res) => {
  try {
    res.json(ServiceDeskService.getSlaAlerts());
  } catch (err) {
    res
      .status(500)
      .json({ error: "Erro ao obter alertas de SLA", detail: String(err) });
  }
});

// GET /api/servicedesk/tickets/:id — ticket por ID
router.get("/tickets/:id", (req, res) => {
  try {
    const ticket = ServiceDeskService.getTicketById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: "Ticket não encontrado." });
    }
    res.json(ticket);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Erro ao buscar ticket", detail: String(err) });
  }
});

const CreateTicketSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  category: z.enum([
    "exportacao_dxf",
    "calculo_bt",
    "autenticacao",
    "desempenho",
    "integracao",
    "conformidade",
    "outro",
  ]),
  priority: z.enum(["critica", "alta", "media", "baixa"]),
  reporter: z.string().min(1),
  tenantId: z.string().optional(),
});

// POST /api/servicedesk/tickets — cria novo ticket
router.post("/tickets", (req, res) => {
  const parsed = CreateTicketSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Payload inválido", detail: parsed.error.issues });
  }
  try {
    const ticket = ServiceDeskService.createTicket(parsed.data);
    res.status(201).json(ticket);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Erro ao criar ticket", detail: String(err) });
  }
});

const CommentSchema = z.object({
  author: z.string().min(1),
  message: z.string().min(1),
  newStatus: z
    .enum([
      "aberto",
      "em_atendimento",
      "escalado",
      "pendente_cliente",
      "resolvido",
      "encerrado",
      "cancelado",
    ])
    .optional(),
});

// POST /api/servicedesk/tickets/:id/comment — adiciona comentário
router.post("/tickets/:id/comment", (req, res) => {
  const parsed = CommentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Payload inválido", detail: parsed.error.issues });
  }
  try {
    const ticket = ServiceDeskService.addComment(
      req.params.id,
      parsed.data.author,
      parsed.data.message,
      parsed.data.newStatus,
    );
    res.json(ticket);
  } catch (err) {
    res
      .status(422)
      .json({ error: "Não foi possível adicionar comentário.", detail: String(err) });
  }
});

const EscalateSchema = z.object({
  author: z.string().min(1),
  reason: z.string().min(1),
});

// POST /api/servicedesk/tickets/:id/escalate — escalona ticket
router.post("/tickets/:id/escalate", (req, res) => {
  const parsed = EscalateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Payload inválido", detail: parsed.error.issues });
  }
  try {
    const ticket = ServiceDeskService.escalateTicket(
      req.params.id,
      parsed.data.author,
      parsed.data.reason,
    );
    res.json(ticket);
  } catch (err) {
    res
      .status(422)
      .json({ error: "Não foi possível escalonar ticket.", detail: String(err) });
  }
});

const CloseSchema = z.object({
  author: z.string().min(1),
  resolution: z.string().min(1),
});

// POST /api/servicedesk/tickets/:id/close — encerra ticket
router.post("/tickets/:id/close", (req, res) => {
  const parsed = CloseSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Payload inválido", detail: parsed.error.issues });
  }
  try {
    const ticket = ServiceDeskService.closeTicket(
      req.params.id,
      parsed.data.author,
      parsed.data.resolution,
    );
    res.json(ticket);
  } catch (err) {
    res
      .status(422)
      .json({ error: "Não foi possível encerrar ticket.", detail: String(err) });
  }
});

export default router;
