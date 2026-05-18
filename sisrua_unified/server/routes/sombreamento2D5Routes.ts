/**
 * Rotas T2-61 — Análise de Sombreamento 2.5D
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { Sombreamento2D5Service } from '../services/sombreamento2D5Service.js';

const router = Router();

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Erro desconhecido';
}

const TipoAtivoEnum = z.enum([
  'poste',
  'transformador',
  'painel_solar',
  'medicao',
  'subestacao',
  'edificacao',
  'outro',
]);

const CriarAnaliseSchema = z.object({
  tenantId: z.string().min(2),
  projetoId: z.string().min(2),
  nomeAtivo: z.string().min(3),
  tipoAtivo: TipoAtivoEnum,
  coordenadas: z.object({
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
  }),
  alturaAtivo: z.number().positive(),
  alturaObstrucao: z.number().nonnegative(),
  distanciaObstrucaoM: z.number().nonnegative(),
  orientacaoGraus: z.number().min(0).max(360).default(0),
  dataAnalise: z.string().min(8),
});

const AutoShadingSchema = z.object({
  topology: z.object({
    poles: z.array(z.unknown()),
    transformers: z.array(z.unknown()),
    edges: z.array(z.unknown()),
  }),
  osmData: z.array(z.unknown()),
});

// --- Novas Rotas T2 Automatic ---

router.post('/auto', async (req: Request, res: Response) => {
  try {
    const parse = AutoShadingSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: 'Payload inválido' });
    const { topology, osmData } = parse.data;
    const topologyInput = topology as Parameters<
      typeof Sombreamento2D5Service.analisarSombreamentoAutomatico
    >[0];
    const osmInput = osmData as Parameters<
      typeof Sombreamento2D5Service.analisarSombreamentoAutomatico
    >[1];
    const results = Sombreamento2D5Service.analisarSombreamentoAutomatico(topologyInput, osmInput);
    return res.json({ timestamp: new Date().toISOString(), results });
  } catch (err: unknown) {
    return res.status(500).json({ error: getErrorMessage(err) });
  }
});

// --- Rotas Legadas / Manuais (Mantidas para compatibilidade de testes) ---

router.post('/analises', (req: Request, res: Response) => {
  const parse = CriarAnaliseSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ errors: parse.error.issues });
  return res.status(201).json(Sombreamento2D5Service.criarAnalise(parse.data));
});

router.get('/analises', (req: Request, res: Response) => {
  return res.json(Sombreamento2D5Service.listarAnalises(req.query.tenantId as string));
});

router.get('/analises/:id', (req: Request, res: Response) => {
  const a = Sombreamento2D5Service.obterAnalise(req.params.id);
  return a ? res.json(a) : res.status(404).json({ error: 'Not found' });
});

router.post('/analises/:id/calcular', (req: Request, res: Response) => {
  try {
    return res.json(Sombreamento2D5Service.calcularSombreamento(req.params.id));
  } catch (err: unknown) {
    return res.status(422).json({ error: getErrorMessage(err) });
  }
});

router.post('/analises/:id/aprovar', (req: Request, res: Response) => {
  try {
    return res.json(Sombreamento2D5Service.aprovarAnalise(req.params.id));
  } catch (err: unknown) {
    return res.status(422).json({ error: getErrorMessage(err) });
  }
});

router.get('/tipos-ativo', (_req: Request, res: Response) => {
  return res.json([
    'poste',
    'transformador',
    'painel_solar',
    'medicao',
    'subestacao',
    'edificacao',
    'outro',
  ]);
});

export default router;
