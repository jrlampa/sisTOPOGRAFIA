/**
 * creditosCarbonoRoutes.ts — Rotas para Calculadora de Créditos de Carbono (T2-47).
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { CreditosCarbonoService, TipoAcaoReducao } from '../services/creditosCarbonoService.js';
import {
  enforceTenantConsistency,
  requireAuthenticatedWrite,
} from '../middleware/writeAuthPolicy.js';

const router = Router();

router.use(requireAuthenticatedWrite);

// Schema: tipos de ação válidos
const tiposAcaoValidos: [TipoAcaoReducao, ...TipoAcaoReducao[]] = [
  'trocar_luminaria_convencional_led',
  'reducao_perdas_rede',
  'substituicao_veiculo_diesel',
  'plantio_compensatorio_arvores',
  'reflorestamento_ha',
];

const criarCalculoSchema = z.object({
  nome: z.string().min(2),
  tenantId: z.string().min(1),
  projetoId: z.string().optional(),
});

const adicionarAcaoSchema = z.object({
  tipo: z.enum(tiposAcaoValidos),
  quantidade: z.number().positive(),
  descricao: z.string().optional(),
});

// ─── POST /calculos ───────────────────────────────────────────────────────────
router.post(
  '/calculos',
  enforceTenantConsistency(req => (req.body as { tenantId?: unknown })?.tenantId),
  (req: Request, res: Response) => {
    const parse = criarCalculoSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ erro: 'Dados inválidos', detalhes: parse.error.flatten() });
    }
    const calculo = CreditosCarbonoService.criarCalculo(parse.data);
    return res.status(201).json(calculo);
  }
);

// ─── GET /calculos?tenantId= ──────────────────────────────────────────────────
router.get(
  '/calculos',
  enforceTenantConsistency(req => req.query['tenantId']),
  (req: Request, res: Response) => {
    const tenantId = req.query['tenantId'] as string | undefined;
    if (!tenantId) {
      return res.status(400).json({ erro: 'Parâmetro tenantId obrigatório' });
    }
    return res.json(CreditosCarbonoService.listarCalculos(tenantId));
  }
);

// ─── GET /calculos/:id ────────────────────────────────────────────────────────
router.get('/calculos/:id', (req: Request, res: Response) => {
  const calc = CreditosCarbonoService.obterCalculo(req.params['id']!);
  if (!calc) return res.status(404).json({ erro: 'Cálculo não encontrado' });
  return res.json(calc);
});

// ─── POST /calculos/:id/acoes ─────────────────────────────────────────────────
router.post('/calculos/:id/acoes', (req: Request, res: Response) => {
  const parse = adicionarAcaoSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ erro: 'Dados inválidos', detalhes: parse.error.flatten() });
  }
  const calc = CreditosCarbonoService.adicionarAcao(req.params['id']!, parse.data);
  if (!calc) return res.status(404).json({ erro: 'Cálculo não encontrado' });
  return res.status(201).json(calc);
});

// ─── POST /calculos/:id/calcular ──────────────────────────────────────────────
router.post('/calculos/:id/calcular', (req: Request, res: Response) => {
  const resultado = CreditosCarbonoService.calcular(req.params['id']!);
  if ('erro' in resultado) {
    return res.status(422).json(resultado);
  }
  return res.json(resultado);
});

// ─── POST /calculos/:id/certificar ───────────────────────────────────────────
router.post('/calculos/:id/certificar', (req: Request, res: Response) => {
  const calc = CreditosCarbonoService.emitirCertificado(req.params['id']!);
  if (!calc) {
    return res
      .status(422)
      .json({ erro: "Cálculo não encontrado ou não está no status 'calculado'" });
  }
  return res.json(calc);
});

// ─── GET /tipos-acao ──────────────────────────────────────────────────────────
router.get('/tipos-acao', (_req: Request, res: Response) => {
  return res.json(CreditosCarbonoService.listarTiposAcao());
});

export default router;
