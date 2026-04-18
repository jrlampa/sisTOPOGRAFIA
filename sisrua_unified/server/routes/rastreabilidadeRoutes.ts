/**
 * rastreabilidadeRoutes.ts — API REST para Matriz de Rastreabilidade Regulatória (Ponto 116 [T1]).
 *
 * GET  /api/rastreabilidade          → lista todos os itens (query: fonte, status)
 * GET  /api/rastreabilidade/:id      → detalhe de um requisito
 * GET  /api/rastreabilidade/relatorio → relatório consolidado de conformidade
 * POST /api/rastreabilidade          → adiciona item personalizado
 * PATCH /api/rastreabilidade/:id/status → atualiza status de conformidade
 */

import { Router, Request, Response } from 'express';
import {
  listarItens,
  obterItem,
  adicionarItem,
  atualizarStatus,
  gerarRelatorio,
  type FonteNorma,
  type StatusConformidade,
} from '../services/rastreabilidadeRegulatoriaService.js';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  const fonte = _req.query['fonte'] as FonteNorma | undefined;
  const status = _req.query['status'] as StatusConformidade | undefined;
  res.json(listarItens(fonte, status));
});

router.get('/relatorio', (req: Request, res: Response) => {
  const fonte = req.query['fonte'] as FonteNorma | undefined;
  const status = req.query['status'] as StatusConformidade | undefined;
  res.json(gerarRelatorio(fonte, status));
});

router.get('/:id', (req: Request, res: Response) => {
  const item = obterItem(req.params['id']!);
  if (!item) return res.status(404).json({ error: 'Item não encontrado' });
  return res.json(item);
});

router.post('/', (req: Request, res: Response) => {
  const { requisito, implementacoes, testes, status, observacao } = req.body as Record<string, unknown>;
  if (!requisito || !implementacoes || !testes || !status) {
    return res.status(400).json({ error: 'requisito, implementacoes, testes e status são obrigatórios' });
  }
  const item = adicionarItem({ requisito, implementacoes, testes, status, observacao } as Parameters<typeof adicionarItem>[0]);
  return res.status(201).json(item);
});

router.patch('/:id/status', (req: Request, res: Response) => {
  const { status, observacao } = req.body as { status?: StatusConformidade; observacao?: string };
  if (!status) return res.status(400).json({ error: 'status é obrigatório' });
  const ok = atualizarStatus(req.params['id']!, status, observacao);
  if (!ok) return res.status(404).json({ error: 'Item não encontrado ou é canônico (imutável)' });
  return res.json({ ok: true });
});

export default router;
