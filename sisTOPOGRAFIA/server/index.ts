/**
 * server/index.ts — Bootstrap do servidor sisTOPOGRAFIA
 *
 * Responsabilidade única: inicializar Express, registrar middlewares globais
 * e montar os routers modulares (DDD interface layer).
 * Toda lógica de negócio fica nos routers e use cases.
 */
import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import 'dotenv/config';
import swaggerUi from 'swagger-ui-express';

import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

import { logger } from './utils/logger.js';
import { generalRateLimiter, dxfRateLimiter } from './middleware/rateLimiter.js';
import { monitoringMiddleware } from './middleware/monitoring.js';
import { requireAuth, checkQuota } from './middleware/firebaseAuth.js';
import { GenerateDxfUseCase } from './application/GenerateDxfUseCase.js';
import { DxfController } from './interfaces/controllers/DxfController.js';
import { specs } from './swagger.js';
import { stopDxfCleanup } from './services/dxfCleanupService.js';
import { stopCleanupInterval as stopCacheCleanup } from './services/cacheServiceFirestore.js';
import { stopCleanupInterval as stopJobCleanup } from './services/jobStatusServiceFirestore.js';

// ── Routers modulares ──────────────────────────────────────────────────────
import systemRouter from './interfaces/routes/systemRoutes.js';
import geoRouter from './interfaces/routes/geoRoutes.js';
import analysisRouter from './interfaces/routes/analysisRoutes.js';
import taskRouter from './interfaces/routes/taskRoutes.js';
import { createBatchRouter } from './interfaces/routes/batchRoutes.js';

// ── Constantes de Segurança ────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Express = express();
const port = process.env.PORT || 3001;

// ── Path helpers ───────────────────────────────────────────────────────────
function resolveDxfDirectory(): string {
    const candidates = [
        path.resolve(__dirname, '../public/dxf'),
        path.resolve(__dirname, '../../../public/dxf')
    ];
    return candidates.find(fs.existsSync) ?? candidates.at(-1)!;
}

function resolveFrontendDistDirectory(): string {
    const candidates = [
        path.resolve(__dirname, '../../dist'),
        path.resolve(__dirname, '../../../dist')
    ];
    return candidates.find(c => fs.existsSync(path.join(c, 'index.html'))) ?? candidates.at(-1)!;
}

function getBaseUrl(req?: Request): string {
    if (process.env.CLOUD_RUN_BASE_URL) return process.env.CLOUD_RUN_BASE_URL;
    if (req) {
        const protocol = req.get('x-forwarded-proto') || req.protocol || 'http';
        const host = req.get('x-forwarded-host') || req.get('host') || `localhost:${port}`;
        return `${protocol}://${host}`;
    }
    return `http://localhost:${port}`;
}

const dxfDirectory = resolveDxfDirectory();
const frontendDistDirectory = resolveFrontendDistDirectory();

// ── DDD Wiring ─────────────────────────────────────────────────────────────
const generateDxfUseCase = new GenerateDxfUseCase(dxfDirectory, getBaseUrl);
const dxfController = new DxfController(generateDxfUseCase);

// ── CORS ───────────────────────────────────────────────────────────────────
const corsOptions = {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        if (!origin) return callback(null, true);

        const allowedOrigins = [
            'http://localhost:3000',
            'http://localhost:8080',
            'http://127.0.0.1:3000',
            'http://127.0.0.1:8080',
        ];
        if (process.env.CLOUD_RUN_BASE_URL) allowedOrigins.push(process.env.CLOUD_RUN_BASE_URL);

        let isCloudRunOrigin = false;
        try {
            const originUrl = new URL(origin);
            isCloudRunOrigin = originUrl.hostname.endsWith('.run.app');
        } catch { /* origin inválida */ }

        if (allowedOrigins.includes(origin) || isCloudRunOrigin) {
            return callback(null, true);
        }

        if (process.env.NODE_ENV === 'production') {
            logger.warn('CORS request rejected in production', { origin });
            return callback(new Error('Not allowed by CORS'), false);
        }

        logger.info('CORS: origin unlisted, allowed in development', { origin });
        callback(null, true);
    },
    credentials: true
};

// ── Middleware global ──────────────────────────────────────────────────────
// B3 FIX: trust proxy = 1 (aceita apenas o proxy mais próximo — Cloud Run LB)
app.set('trust proxy', 1);

// Apply Helmet with a strict default CSP for all routes.
// Swagger UI needs 'unsafe-inline' for scripts and styles, so its route gets
// a relaxed override below, keeping all other routes fully protected.
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'"],
            imgSrc: ["'self'", 'data:'],
        }
    },
    crossOriginEmbedderPolicy: false // Swagger UI loads cross-origin resources
}));

// Relax CSP for /api-docs (Swagger UI requires unsafe-inline)
app.use('/api-docs', (_req, res, next) => {
    res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:"
    );
    next();
});

app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use(generalRateLimiter);
app.use(monitoringMiddleware);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// Request logger
app.use((req, _res, next) => {
    logger.info('Incoming request', { method: req.method, url: req.url, ip: req.ip });
    next();
});

// B4 FIX: startup log sem vazar dados de produção
if (process.env.NODE_ENV !== 'production') {
    logger.info('Server starting (development)', {
        port: process.env.PORT,
        hasGroqApiKey: !!process.env.GROQ_API_KEY,
        gcpProject: process.env.GCP_PROJECT || 'not-set',
        cloudRunBaseUrl: process.env.CLOUD_RUN_BASE_URL || 'not-set'
    });
} else {
    logger.info('Server starting (production)', { port: process.env.PORT });
}

// ── Serve static generated DXFs ────────────────────────────────────────────
app.use('/downloads', express.static(dxfDirectory));

// ── API Routes ─────────────────────────────────────────────────────────────
app.use('/health', systemRouter);
app.use('/api', systemRouter);        // /api/firestore/status
app.use('/api', geoRouter);           // /api/search, /api/elevation/profile, /api/analyze-pad
app.use('/api/analyze', analysisRouter);
app.use('/api/tasks', taskRouter);
app.use('/api', taskRouter);          // /api/jobs/:id
app.use('/api/batch', createBatchRouter(dxfDirectory, getBaseUrl));

// DXF generation — auth + quota + large body
app.post(
    '/api/dxf',
    requireAuth,
    checkQuota,
    express.json({ limit: '5mb' }),
    dxfRateLimiter,
    (req, res) => dxfController.generate(req, res)
);

// ── Frontend SPA fallback ──────────────────────────────────────────────────
if (fs.existsSync(path.join(frontendDistDirectory, 'index.html'))) {
    app.use(express.static(frontendDistDirectory));
    app.get('*', (req: Request, res: Response, next) => {
        if (req.path.startsWith('/api') || req.path.startsWith('/downloads') ||
            req.path.startsWith('/api-docs') || req.path === '/health') return next();
        return res.sendFile(path.join(frontendDistDirectory, 'index.html'));
    });
}

// ── Global error handler ───────────────────────────────────────────────────
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    const status = (err as { status?: number })?.status;
    logger.error('Unhandled error', { error: msg, stack, path: req.path, method: req.method });
    if (req.path.startsWith('/api')) {
        return res.status(status || 500).json({
            error: msg || 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? stack : undefined
        });
    }
    return res.status(status || 500).send('Internal Server Error');
});

// ── Startup ────────────────────────────────────────────────────────────────
app.listen(port, async () => {
    logger.info('Backend online', { service: 'sisTOPOGRAFIA Backend', version: '1.0.0', port });
    if (process.env.NODE_ENV !== 'production' && process.env.USE_FIRESTORE !== 'true') {
        logger.info('Firestore disabled (development mode)');
    }
});

// Graceful shutdown
function gracefulShutdown(signal: string) {
    logger.info(`${signal} received — shutting down`);
    stopDxfCleanup();
    stopCacheCleanup();
    stopJobCleanup();
    process.exit(0);
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
