import { Request, Response, Router } from 'express';
import { btExportHistoryService, BtExportHistoryPayload, BtExportHistoryIngestPayload } from '../services/btExportHistoryService.js';

const router = Router();

const parsePositiveInt = (raw: unknown, fallback: number): number => {
    const value = Number.parseInt(String(raw ?? ''), 10);
    if (!Number.isFinite(value)) {
        return fallback;
    }
    return Math.max(0, value);
};

const isProjectType = (value: unknown): value is 'ramais' | 'clandestino' => {
    return value === 'ramais' || value === 'clandestino';
};

const isCqtScenario = (value: unknown): value is 'atual' | 'proj1' | 'proj2' => {
    return value === 'atual' || value === 'proj1' || value === 'proj2';
};

const isSafeBtContextUrl = (value: string): boolean => {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
        return false;
    }

    // Prefer backend-generated local download URLs.
    if (trimmed.startsWith('/downloads/')) {
        return !trimmed.includes('..');
    }

    try {
        const parsed = new URL(trimmed);
        return (parsed.protocol === 'https:' || parsed.protocol === 'http:') && parsed.hostname.length > 0;
    } catch {
        return false;
    }
};

const validateCreatePayload = (body: unknown): { ok: true; value: BtExportHistoryPayload } | { ok: false; error: string } => {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return { ok: false, error: 'Payload inválido' };
    }

    const payload = body as Partial<BtExportHistoryPayload>;

    if (!isProjectType(payload.projectType)) {
        return { ok: false, error: 'projectType inválido' };
    }

    if (typeof payload.exportedAt !== 'string' || Number.isNaN(Date.parse(payload.exportedAt))) {
        return { ok: false, error: 'exportedAt inválido' };
    }

    if (typeof payload.btContextUrl !== 'string' || !isSafeBtContextUrl(payload.btContextUrl)) {
        return { ok: false, error: 'btContextUrl obrigatório' };
    }

    if (typeof payload.criticalPoleId !== 'string' || payload.criticalPoleId.trim().length === 0) {
        return { ok: false, error: 'criticalPoleId obrigatório' };
    }

    if (typeof payload.criticalAccumulatedClients !== 'number' || payload.criticalAccumulatedClients < 0) {
        return { ok: false, error: 'criticalAccumulatedClients inválido' };
    }

    if (typeof payload.criticalAccumulatedDemandKva !== 'number' || payload.criticalAccumulatedDemandKva < 0) {
        return { ok: false, error: 'criticalAccumulatedDemandKva inválido' };
    }

    return {
        ok: true,
        value: {
            exportedAt: payload.exportedAt,
            projectType: payload.projectType,
            btContextUrl: payload.btContextUrl,
            criticalPoleId: payload.criticalPoleId,
            criticalAccumulatedClients: payload.criticalAccumulatedClients,
            criticalAccumulatedDemandKva: payload.criticalAccumulatedDemandKva,
            verifiedPoles: typeof payload.verifiedPoles === 'number' ? payload.verifiedPoles : undefined,
            totalPoles: typeof payload.totalPoles === 'number' ? payload.totalPoles : undefined,
            verifiedEdges: typeof payload.verifiedEdges === 'number' ? payload.verifiedEdges : undefined,
            totalEdges: typeof payload.totalEdges === 'number' ? payload.totalEdges : undefined,
            verifiedTransformers: typeof payload.verifiedTransformers === 'number' ? payload.verifiedTransformers : undefined,
            totalTransformers: typeof payload.totalTransformers === 'number' ? payload.totalTransformers : undefined,
            cqt: payload.cqt,
        },
    };
};

const validateIngestPayload = (body: unknown): { ok: true; value: BtExportHistoryIngestPayload } | { ok: false; error: string } => {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return { ok: false, error: 'Payload inválido' };
    }

    const payload = body as Partial<BtExportHistoryIngestPayload>;
    if (!isProjectType(payload.projectType)) {
        return { ok: false, error: 'projectType inválido' };
    }

    if (typeof payload.btContextUrl !== 'string' || !isSafeBtContextUrl(payload.btContextUrl)) {
        return { ok: false, error: 'btContextUrl obrigatório' };
    }

    if (!payload.btContext || typeof payload.btContext !== 'object' || Array.isArray(payload.btContext)) {
        return { ok: false, error: 'btContext inválido' };
    }

    return {
        ok: true,
        value: {
            projectType: payload.projectType,
            btContextUrl: payload.btContextUrl,
            btContext: payload.btContext,
            exportedAt: typeof payload.exportedAt === 'string' ? payload.exportedAt : undefined,
        },
    };
};

router.get('/', async (req: Request, res: Response) => {
    const limit = parsePositiveInt(req.query.limit, 50);
    const offset = parsePositiveInt(req.query.offset, 0);
    const projectTypeRaw = req.query.projectType;
    const projectType = isProjectType(projectTypeRaw) ? projectTypeRaw : undefined;
    const cqtScenarioRaw = req.query.cqtScenario;
    const cqtScenario = isCqtScenario(cqtScenarioRaw) ? cqtScenarioRaw : undefined;

    const result = await btExportHistoryService.list(limit, offset, { projectType, cqtScenario });
    return res.json(result);
});

router.post('/', async (req: Request, res: Response) => {
    const validated = validateCreatePayload(req.body);
    if (!validated.ok) {
        return res.status(400).json({ error: validated.error });
    }

    const stored = await btExportHistoryService.create(validated.value);
    return res.status(201).json({ ok: true, stored });
});

router.post('/ingest', async (req: Request, res: Response) => {
    const validated = validateIngestPayload(req.body);
    if (!validated.ok) {
        return res.status(400).json({ error: validated.error });
    }

    const result = await btExportHistoryService.ingestFromContext(validated.value);
    if (!result.entry) {
        return res.status(422).json({ ok: false, error: 'Nao foi possivel extrair resumo BT do contexto informado' });
    }

    return res.status(201).json({ ok: true, ...result });
});

router.delete('/', async (req: Request, res: Response) => {
    const projectTypeRaw = req.query.projectType;
    const projectType = isProjectType(projectTypeRaw) ? projectTypeRaw : undefined;
    const cqtScenarioRaw = req.query.cqtScenario;
    const cqtScenario = isCqtScenario(cqtScenarioRaw) ? cqtScenarioRaw : undefined;

    const result = await btExportHistoryService.clear({ projectType, cqtScenario });
    return res.json({ ok: true, deletedCount: result.deleted });
});

export default router;
