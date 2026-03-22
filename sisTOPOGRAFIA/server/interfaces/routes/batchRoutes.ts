import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { batchRowSchema } from '../../schemas/apiSchemas.js';
import { parseBatchCsv, RawBatchRow } from '../../services/batchService.js';
import { createDxfTask } from '../../services/cloudTasksService.js';
import { createJob } from '../../services/jobStatusServiceFirestore.js';
import {
    createCacheKey, getCachedFilename, setCachedFilename, deleteCachedFilename
} from '../../services/cacheServiceFirestore.js';
import { geoRateLimiter } from '../../middleware/rateLimiter.js';
import { logger } from '../../utils/logger.js';

// dxfDirectory é injetado no bootstrap via factory
export function createBatchRouter(dxfDirectory: string, getBaseUrl: (req: Request) => string) {
    const router = Router();
    const upload = multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: 5 * 1024 * 1024 },
        fileFilter: (_req, file, cb) => {
            if (file.mimetype === 'text/csv' || file.originalname.toLowerCase().endsWith('.csv')) {
                cb(null, true);
            } else {
                cb(new Error('Apenas arquivos CSV são permitidos'));
            }
        }
    });

    // POST /api/batch/dxf
    router.post('/dxf', geoRateLimiter, upload.single('file'), async (req: Request, res: Response) => {
        try {
            if (!req.file) return res.status(400).json({ error: 'Arquivo CSV é obrigatório' });

            const rows = await parseBatchCsv(req.file.buffer);
            if (rows.length === 0) return res.status(400).json({ error: 'CSV vazio ou inválido' });

            const results: Array<{ name: string; status: string; jobId?: string | number; url?: string }> = [];
            const errors: Array<{ line: number; message: string; row: RawBatchRow }> = [];

            for (const entry of rows) {
                const validation = batchRowSchema.safeParse(entry.row);
                if (!validation.success) {
                    errors.push({
                        line: entry.line,
                        message: validation.error.issues.map(issue => issue.message).join(', '),
                        row: entry.row
                    });
                    continue;
                }

                const { name, lat, lon, radius, mode } = validation.data;
                const cacheKey = createCacheKey({ lat, lon, radius, mode, polygon: [], layers: {} });
                const cachedFilename = await getCachedFilename(cacheKey);

                if (cachedFilename) {
                    const cachedFilePath = path.join(dxfDirectory, cachedFilename);
                    if (fs.existsSync(cachedFilePath)) {
                        results.push({ name, status: 'cached', url: `${getBaseUrl(req)}/downloads/${cachedFilename}` });
                        continue;
                    }
                    await deleteCachedFilename(cacheKey);
                }

                const safeName = name.toLowerCase().replace(/[^a-z0-9-_]+/g, '_').slice(0, 40) ||
                    /* istanbul ignore next */ 'batch';
                const filename = `dxf_${safeName}_${Date.now()}_${entry.line}.dxf`;
                // Defense-in-depth: verify the resolved output path stays inside dxfDirectory.
                // Under normal flow this branch is unreachable because safeName is already
                // sanitized to [a-z0-9-_], but guards against future regressions.
                const outputFile = path.resolve(dxfDirectory, filename);
                /* istanbul ignore next -- defense-in-depth guard, unreachable with sanitized filenames */
                if (!outputFile.startsWith(path.resolve(dxfDirectory))) {
                    logger.error('Path traversal attempt detected', { filename });
                    errors.push({ line: entry.line, message: 'Nome de arquivo inválido', row: entry.row });
                    continue;
                }
                const downloadUrl = `${getBaseUrl(req)}/downloads/${filename}`;

                const { taskId } = await createDxfTask({
                    lat, lon, radius, mode,
                    polygon: '[]', layers: {}, projection: 'local',
                    outputFile, filename, cacheKey, downloadUrl
                });

                await createJob(taskId);
                results.push({ name, status: 'queued', jobId: taskId });
            }

            if (results.length === 0) return res.status(400).json({ error: 'Nenhuma linha válida no CSV', errors });
            return res.status(200).json({ results, errors });

        } catch (err: unknown) {
            /* istanbul ignore next */
            const msg = err instanceof Error ? err.message : String(err);
            logger.error('Batch DXF upload failed', { error: err });
            return res.status(500).json({ error: 'Falha no processamento batch', details: msg });
        }
    });

    return router;
}
