/**
 * Rotas LGPD — Residência de Dados Brasil (Item 41)
 * Base path: /api/lgpd/residencia
 */

import { Router, Request, Response } from 'express';
import {
    registrarLocalizacao,
    obterLocalizacao,
    listarLocalizacoes,
    listarLocalizacoesPorSistema,
    removerLocalizacao,
    verificarConformidadeSistema,
    gerarRelatorioResidencia,
    paisTemAdequacaoReconhecida,
    PaisArmazenamento,
    ProvedorCloud,
    BaseLegalTransferencia,
} from '../services/lgpdResidenciaService.js';

const router = Router();

// ── Localizações ──────────────────────────────────────────────────────────────

/** GET /api/lgpd/residencia/localizacoes — lista todas */
router.get('/localizacoes', (_req: Request, res: Response) => {
    res.json(listarLocalizacoes());
});

/** GET /api/lgpd/residencia/localizacoes/:id — detalhe */
router.get('/localizacoes/:id', (req: Request, res: Response) => {
    const loc = obterLocalizacao(req.params.id);
    if (!loc) return res.status(404).json({ error: 'Localização não encontrada' });
    return res.json(loc);
});

/** POST /api/lgpd/residencia/localizacoes — registra localização */
router.post('/localizacoes', (req: Request, res: Response) => {
    const {
        sistema, descricao, provedor, regiaoProvedor, pais,
        contemDadosPessoais, categorias, baseLegalTransferencia, referenciaContratual,
    } = req.body;

    if (!sistema || !descricao || !provedor || !regiaoProvedor || !pais ||
        typeof contemDadosPessoais !== 'boolean' || !Array.isArray(categorias)) {
        return res.status(400).json({ error: 'Campos obrigatórios ausentes' });
    }

    const loc = registrarLocalizacao({
        sistema, descricao,
        provedor: provedor as ProvedorCloud,
        regiaoProvedor,
        pais: pais as PaisArmazenamento,
        contemDadosPessoais,
        categorias,
        baseLegalTransferencia: baseLegalTransferencia as BaseLegalTransferencia | undefined,
        referenciaContratual,
    });
    return res.status(201).json(loc);
});

/** DELETE /api/lgpd/residencia/localizacoes/:id */
router.delete('/localizacoes/:id', (req: Request, res: Response) => {
    const ok = removerLocalizacao(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Localização não encontrada' });
    return res.json({ removido: true });
});

// ── Conformidade ──────────────────────────────────────────────────────────────

/** GET /api/lgpd/residencia/conformidade/:sistema — conformidade de um sistema */
router.get('/conformidade/:sistema', (req: Request, res: Response) => {
    const locs = listarLocalizacoesPorSistema(req.params.sistema);
    if (locs.length === 0) {
        return res.status(404).json({ error: 'Nenhuma localização registrada para o sistema' });
    }
    return res.json(verificarConformidadeSistema(req.params.sistema));
});

/** GET /api/lgpd/residencia/relatorio — relatório geral de todos os sistemas */
router.get('/relatorio', (_req: Request, res: Response) => {
    res.json(gerarRelatorioResidencia());
});

/** GET /api/lgpd/residencia/pais-adequado/:pais — consulta adequação ANPD */
router.get('/pais-adequado/:pais', (req: Request, res: Response) => {
    const pais = req.params.pais as PaisArmazenamento;
    res.json({
        pais,
        adequacaoReconhecida: paisTemAdequacaoReconhecida(pais),
        fonte: 'Resolução CD/ANPD nº 19/2024',
    });
});

export default router;
