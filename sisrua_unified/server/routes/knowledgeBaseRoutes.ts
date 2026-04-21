/**
 * knowledgeBaseRoutes.ts — Rotas Base de Conhecimento Forense (119 [T1])
 */

import { Router } from "express";
import { z } from "zod";
import {
  KnowledgeBaseService,
  type KbCategory,
  type KbSeverity,
} from "../services/knowledgeBaseService.js";

const router = Router();

// GET /api/knowledge/articles — lista artigos com filtros opcionais
router.get("/articles", (req, res) => {
  try {
    const { category, severity, preventionAutomated } = req.query as Record<string, string>;
    res.json(
      KnowledgeBaseService.getArticles({
        category: category as KbCategory | undefined,
        severity: severity as KbSeverity | undefined,
        preventionAutomated:
          preventionAutomated !== undefined
            ? preventionAutomated === "true"
            : undefined,
      }),
    );
  } catch (err) {
    res
      .status(500)
      .json({ error: "Erro ao listar artigos KB", detail: String(err) });
  }
});

// GET /api/knowledge/articles/recurrence — relatório de recorrências
router.get("/articles/recurrence", (_req, res) => {
  try {
    res.json(KnowledgeBaseService.getRecurrenceReport());
  } catch (err) {
    res
      .status(500)
      .json({ error: "Erro ao gerar relatório de recorrência", detail: String(err) });
  }
});

// GET /api/knowledge/search?q= — busca full-text
router.get("/search", (req, res) => {
  const query = (req.query.q as string) ?? "";
  if (!query.trim()) {
    return res
      .status(400)
      .json({ error: "Parâmetro 'q' é obrigatório para busca." });
  }
  try {
    res.json(KnowledgeBaseService.search(query));
  } catch (err) {
    res
      .status(500)
      .json({ error: "Erro na busca KB", detail: String(err) });
  }
});

// GET /api/knowledge/articles/:id — artigo por ID
router.get("/articles/:id", (req, res) => {
  try {
    const article = KnowledgeBaseService.getById(req.params.id);
    if (!article) {
      return res.status(404).json({ error: "Artigo não encontrado." });
    }
    res.json(article);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Erro ao buscar artigo KB", detail: String(err) });
  }
});

const CreateArticleSchema = z.object({
  title: z.string().min(1),
  category: z.enum([
    "exportacao_dxf",
    "calculo_bt",
    "autenticacao",
    "banco_de_dados",
    "integracao_api",
    "seguranca",
    "desempenho",
    "infraestrutura",
    "conformidade",
    "python_worker",
  ]),
  severity: z.enum(["critica", "alta", "media", "baixa", "informativa"]),
  problem: z.string().min(1),
  rootCause: z.string().min(1),
  solution: z.string().min(1),
  verificationSteps: z.array(z.string()).min(1),
  references: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  firstSeenAt: z.string(),
  lastSeenAt: z.string(),
  preventionAutomated: z.boolean().default(false),
});

// POST /api/knowledge/articles — cria novo artigo
router.post("/articles", (req, res) => {
  const parsed = CreateArticleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Payload inválido", detail: parsed.error.issues });
  }
  try {
    const article = KnowledgeBaseService.createArticle(parsed.data);
    res.status(201).json(article);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Erro ao criar artigo KB", detail: String(err) });
  }
});

// POST /api/knowledge/articles/:id/occurrence — registra nova ocorrência
router.post("/articles/:id/occurrence", (req, res) => {
  try {
    const article = KnowledgeBaseService.recordOccurrence(req.params.id);
    res.json(article);
  } catch (err) {
    res
      .status(422)
      .json({
        error: "Não foi possível registrar ocorrência.",
        detail: String(err),
      });
  }
});

export default router;
