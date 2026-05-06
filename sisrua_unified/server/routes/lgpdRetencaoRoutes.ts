/**
 * Rotas LGPD — Retenção, Classificação e Descarte (Item 40)
 * Base path: /api/lgpd/retencao
 */

import { Router, Request, Response } from 'express';
import {
    criarPoliticaRetencao,
    obterPolitica,
    listarPoliticas,
    listarPoliticasAtivas,
    desativarPolitica,
    metodoDescarteRecomendado,
    agendarDescarte,
    iniciarDescarte,
    concluirDescarte,
    cancelarDescarte,
    listarEventosDescarte,
    listarDescartesPendentes,
    listarCertificados,
    obterCertificado,
    NivelClassificacao,
    MetodoDescarte,
    MotivoConservacao,
} from '../services/lgpdRetencaoService.js';

const router = Router();

// ── Políticas ─────────────────────────────────────────────────────────────────

/** GET /api/lgpd/retencao/politicas — lista todas as políticas */
router.get('/politicas', (_req: Request, res: Response) => {
    res.json(listarPoliticas());
});

/** GET /api/lgpd/retencao/politicas/ativas — lista políticas ativas */
router.get('/politicas/ativas', (_req: Request, res: Response) => {
    res.json(listarPoliticasAtivas());
});

/** GET /api/lgpd/retencao/politicas/:id — detalhe de uma política */
router.get('/politicas/:id', (req: Request, res: Response) => {
    const p = obterPolitica(req.params.id);
    if (!p) return res.status(404).json({ error: 'Política não encontrada' });
    return res.json(p);
});

/** POST /api/lgpd/retencao/politicas — cria nova política */
router.post('/politicas', (req: Request, res: Response) => {
    const {
        nome, descricao, sistema, categorias, nivelClassificacao,
        retencaoOperacionalDias, retencaoLegalDias, motivoConservacao,
        embasamentoLegal, metodoDescarte,
    } = req.body;

    if (!nome || !descricao || !sistema || !Array.isArray(categorias) ||
        !nivelClassificacao || typeof retencaoOperacionalDias !== 'number') {
        return res.status(400).json({ error: 'Campos obrigatórios ausentes' });
    }

    const niveisValidos: NivelClassificacao[] = ['publico', 'interno', 'confidencial', 'restrito'];
    if (!niveisValidos.includes(nivelClassificacao)) {
        return res.status(400).json({ error: 'nivelClassificacao inválido' });
    }

    const p = criarPoliticaRetencao({
        nome, descricao, sistema, categorias,
        nivelClassificacao: nivelClassificacao as NivelClassificacao,
        retencaoOperacionalDias,
        retencaoLegalDias,
        motivoConservacao: motivoConservacao as MotivoConservacao | undefined,
        embasamentoLegal,
        metodoDescarte: metodoDescarte as MetodoDescarte | undefined,
    });
    return res.status(201).json(p);
});

/** DELETE /api/lgpd/retencao/politicas/:id — desativa política */
router.delete('/politicas/:id', (req: Request, res: Response) => {
    const p = desativarPolitica(req.params.id);
    if (!p) return res.status(404).json({ error: 'Política não encontrada' });
    return res.json(p);
});

/** GET /api/lgpd/retencao/metodo-recomendado/:nivel — método NIST recomendado */
router.get('/metodo-recomendado/:nivel', (req: Request, res: Response) => {
    const niveisValidos: NivelClassificacao[] = ['publico', 'interno', 'confidencial', 'restrito'];
    const nivel = req.params.nivel as NivelClassificacao;
    if (!niveisValidos.includes(nivel)) {
        return res.status(400).json({ error: 'Nível de classificação inválido' });
    }
    return res.json({ nivel, metodoRecomendado: metodoDescarteRecomendado(nivel) });
});

// ── Eventos de Descarte ───────────────────────────────────────────────────────

/** GET /api/lgpd/retencao/eventos — lista todos os eventos */
router.get('/eventos', (_req: Request, res: Response) => {
    res.json(listarEventosDescarte());
});

/** GET /api/lgpd/retencao/eventos/pendentes — descartes com prazo vencido */
router.get('/eventos/pendentes', (_req: Request, res: Response) => {
    res.json(listarDescartesPendentes());
});

/** POST /api/lgpd/retencao/eventos — agenda novo descarte */
router.post('/eventos', (req: Request, res: Response) => {
    const { politicaId, registrosEstimados, agendadoPara, observacao } = req.body;
    if (!politicaId || typeof registrosEstimados !== 'number' || !agendadoPara) {
        return res.status(400).json({ error: 'politicaId, registrosEstimados e agendadoPara são obrigatórios' });
    }
    const evento = agendarDescarte({ politicaId, registrosEstimados, agendadoPara, observacao });
    if (!evento) return res.status(404).json({ error: 'Política não encontrada' });
    return res.status(201).json(evento);
});

/** POST /api/lgpd/retencao/eventos/:id/iniciar — inicia execução */
router.post('/eventos/:id/iniciar', (req: Request, res: Response) => {
    const evento = iniciarDescarte(req.params.id);
    if (!evento) return res.status(404).json({ error: 'Evento não encontrado ou não está agendado' });
    return res.json(evento);
});

/** POST /api/lgpd/retencao/eventos/:id/concluir — conclui e emite certificado */
router.post('/eventos/:id/concluir', (req: Request, res: Response) => {
    const { registrosDescartados, executadoPor, observacao } = req.body;
    if (typeof registrosDescartados !== 'number' || !executadoPor) {
        return res.status(400).json({ error: 'registrosDescartados e executadoPor são obrigatórios' });
    }
    const result = concluirDescarte({
        eventoId: req.params.id,
        registrosDescartados,
        executadoPor,
        observacao,
    });
    if (!result) return res.status(404).json({ error: 'Evento não encontrado ou em estado inválido' });
    return res.json(result);
});

/** POST /api/lgpd/retencao/eventos/:id/cancelar — cancela evento agendado */
router.post('/eventos/:id/cancelar', (req: Request, res: Response) => {
    const { motivo } = req.body;
    if (!motivo) return res.status(400).json({ error: 'motivo é obrigatório' });
    const evento = cancelarDescarte(req.params.id, motivo);
    if (!evento) return res.status(404).json({ error: 'Evento não encontrado ou não está agendado' });
    return res.json(evento);
});

// ── Certificados ──────────────────────────────────────────────────────────────

/** GET /api/lgpd/retencao/certificados — lista certificados NIST 800-88 */
router.get('/certificados', (_req: Request, res: Response) => {
    res.json(listarCertificados());
});

/** GET /api/lgpd/retencao/certificados/:id — detalhe de certificado */
router.get('/certificados/:id', (req: Request, res: Response) => {
    const cert = obterCertificado(req.params.id);
    if (!cert) return res.status(404).json({ error: 'Certificado não encontrado' });
    return res.json(cert);
});

export default router;
