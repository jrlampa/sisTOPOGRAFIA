/**
 * Dossiê Regulatório Routes (Item 54 – T1)
 *
 * ── Dossiês ───────────────────────────────────────────────────────────────────
 * GET  /api/dossie                         — lista resumos de dossiês
 * POST /api/dossie                         — cria novo dossiê
 * GET  /api/dossie/:id                     — obtém dossiê completo
 *
 * ── Validações BDGD ──────────────────────────────────────────────────────────
 * POST /api/dossie/:id/validacao           — vincula relatório de validação BDGD
 *
 * ── Artefatos ────────────────────────────────────────────────────────────────
 * POST /api/dossie/:id/artefatos           — adiciona artefato com hash SHA-256
 *
 * ── Ciclo de vida ────────────────────────────────────────────────────────────
 * POST /api/dossie/:id/submissao           — registra submissão à ANEEL
 * POST /api/dossie/:id/arquivar            — arquiva dossiê
 *
 * ── Exportação / Integridade ─────────────────────────────────────────────────
 * GET  /api/dossie/:id/exportar            — exporta pacote JSON com hash SHA-256
 * POST /api/dossie/verificar-integridade   — verifica integridade de pacote
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { logger } from '../utils/logger.js';
import {
    criarDossie,
    obterDossie,
    listarDossies,
    resumoDossies,
    vincularValidacaoBdgd,
    adicionarArtefato,
    registrarSubmissao,
    arquivarDossie,
    exportarPacote,
    verificarIntegridadePacote,
} from '../services/dossieRegulatorioService.js';

const router = Router();

// ─── Schemas ──────────────────────────────────────────────────────────────────

const criarDossieSchema = z.object({
    cicloReferencia: z.string().min(3).max(20),
    distribuidora: z.string().min(3).max(120),
    cnpj: z.string().regex(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/, 'CNPJ inválido (formato: XX.XXX.XXX/XXXX-XX)'),
    responsavelTecnico: z.string().min(3).max(120),
    prazoEntregaISO: z.string().datetime({ message: 'prazoEntregaISO deve ser ISO 8601' }),
    autor: z.string().min(2).max(100),
});

// Relatório BDGD mínimo esperado da rota POST /api/bdgd/validate
const bdgdLayerReportSchema = z.object({
    layer: z.string(),
    description: z.string(),
    totalRecords: z.number().int().nonnegative(),
    validRecords: z.number().int().nonnegative(),
    issues: z.array(z.unknown()),
    conformant: z.boolean(),
});

const bdgdValidationReportSchema = z.object({
    generatedAt: z.string(),
    aneelSpec: z.string(),
    layers: z.array(bdgdLayerReportSchema),
    totals: z.object({
        layersChecked: z.number().int(),
        layersConformant: z.number().int(),
        totalRecords: z.number().int(),
        totalIssues: z.number().int(),
        errors: z.number().int(),
        warnings: z.number().int(),
    }),
    conformant: z.boolean(),
});

const vincularValidacaoSchema = z.object({
    report: bdgdValidationReportSchema,
    autor: z.string().min(2).max(100),
});

const artefatoTiposValidos = ['shapefile', 'gdb', 'dxf', 'csv', 'relatorio', 'outro'] as const;

const adicionarArtefatoSchema = z.object({
    nome: z.string().min(3).max(200),
    tipo: z.enum(artefatoTiposValidos),
    descricao: z.string().min(5).max(500),
    /** Conteúdo do artefato em base64 ou texto plano. */
    conteudo: z.string().min(1),
    camadasCobertas: z.array(z.string().min(1)).min(1),
    autor: z.string().min(2).max(100),
});

const submissaoSchema = z.object({
    protocoloAneel: z.string().min(3).max(100),
    autor: z.string().min(2).max(100),
});

const arquivarSchema = z.object({
    autor: z.string().min(2).max(100),
});

// ─── Helper ───────────────────────────────────────────────────────────────────

function badRequest(res: Response, details: string[]): Response {
    return res.status(400).json({ erro: 'Entrada inválida', detalhes: details });
}

// ─── Dossiês ──────────────────────────────────────────────────────────────────

router.get('/', (_req: Request, res: Response) => {
    res.json({ dossies: resumoDossies() });
});

router.post('/', (req: Request, res: Response) => {
    const parsed = criarDossieSchema.safeParse(req.body);
    if (!parsed.success) {
        return badRequest(res, parsed.error.issues.map((i) => i.message));
    }
    const dossie = criarDossie(parsed.data);
    logger.info('Dossiê criado', { id: dossie.id, ciclo: dossie.cicloReferencia });
    return res.status(201).json(dossie);
});

router.get('/:id', (req: Request, res: Response) => {
    const dossie = obterDossie(req.params.id);
    if (!dossie) return res.status(404).json({ erro: 'Dossiê não encontrado' });
    return res.json(dossie);
});

// ─── Validação BDGD ───────────────────────────────────────────────────────────

router.post('/:id/validacao', (req: Request, res: Response) => {
    const parsed = vincularValidacaoSchema.safeParse(req.body);
    if (!parsed.success) {
        return badRequest(res, parsed.error.issues.map((i) => i.message));
    }
    const updated = vincularValidacaoBdgd(req.params.id, parsed.data.report as any, parsed.data.autor);
    if (!updated) return res.status(404).json({ erro: 'Dossiê não encontrado' });
    logger.info('Validação BDGD vinculada ao dossiê', {
        dossieId: req.params.id,
        conforme: parsed.data.report.conformant,
    });
    return res.json(updated);
});

// ─── Artefatos ────────────────────────────────────────────────────────────────

router.post('/:id/artefatos', (req: Request, res: Response) => {
    const parsed = adicionarArtefatoSchema.safeParse(req.body);
    if (!parsed.success) {
        return badRequest(res, parsed.error.issues.map((i) => i.message));
    }
    const { autor, ...artefatoInput } = parsed.data;
    const updated = adicionarArtefato(req.params.id, artefatoInput, autor);
    if (!updated) return res.status(404).json({ erro: 'Dossiê não encontrado' });
    const ultimo = updated.artefatos[updated.artefatos.length - 1];
    logger.info('Artefato adicionado ao dossiê', {
        dossieId: req.params.id,
        artefatoId: ultimo?.id,
        sha256: ultimo?.sha256,
    });
    return res.status(201).json(updated);
});

// ─── Submissão / Arquivamento ──────────────────────────────────────────────────

router.post('/:id/submissao', (req: Request, res: Response) => {
    const parsed = submissaoSchema.safeParse(req.body);
    if (!parsed.success) {
        return badRequest(res, parsed.error.issues.map((i) => i.message));
    }
    const updated = registrarSubmissao(req.params.id, parsed.data.protocoloAneel, parsed.data.autor);
    if (!updated) return res.status(404).json({ erro: 'Dossiê não encontrado' });
    logger.info('Dossiê submetido à ANEEL', {
        dossieId: req.params.id,
        protocolo: parsed.data.protocoloAneel,
    });
    return res.json(updated);
});

router.post('/:id/arquivar', (req: Request, res: Response) => {
    const parsed = arquivarSchema.safeParse(req.body);
    if (!parsed.success) {
        return badRequest(res, parsed.error.issues.map((i) => i.message));
    }
    const updated = arquivarDossie(req.params.id, parsed.data.autor);
    if (!updated) return res.status(404).json({ erro: 'Dossiê não encontrado' });
    return res.json(updated);
});

// ─── Exportação / Integridade ─────────────────────────────────────────────────

router.get('/:id/exportar', (req: Request, res: Response) => {
    const pacote = exportarPacote(req.params.id);
    if (!pacote) return res.status(404).json({ erro: 'Dossiê não encontrado' });
    logger.info('Pacote exportado', {
        dossieId: req.params.id,
        integrityHash: pacote.integrityHash,
    });
    return res.json(pacote);
});

router.post('/verificar-integridade', (req: Request, res: Response) => {
    const { pacote } = req.body as { pacote: unknown };
    if (!pacote || typeof pacote !== 'object') {
        return res.status(400).json({ erro: 'Campo "pacote" obrigatório' });
    }
    const integro = verificarIntegridadePacote(pacote as any);
    return res.json({ integro });
});

export default router;
