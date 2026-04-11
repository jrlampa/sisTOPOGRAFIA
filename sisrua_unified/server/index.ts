import express, { Express, NextFunction, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import 'dotenv/config';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import swaggerUi from 'swagger-ui-express';

import { config } from './config.js';
import { startFirestoreMonitoring, stopFirestoreMonitoring } from './services/firestoreService.js';
import { initializeDxfCleanup, markDxfDownloaded, stopDxfCleanup } from './services/dxfCleanupService.js';
import { stopCacheCleanup } from './services/cacheService.js';
import { stopTaskWorker } from './services/cloudTasksService.js';
import { constantsService } from './services/constantsService.js';
import { logger } from './utils/logger.js';
import { analyzeRateLimiter, downloadsRateLimiter, generalRateLimiter, refreshRateLimitersFromCatalog } from './middleware/rateLimiter.js';
import { requestMetrics } from './middleware/requestMetrics.js';
import { specs } from './swagger.js';
import { errorHandler, createError } from './errorHandler.js';
import { resolveDxfDirectory } from './utils/dxfDirectory.js';

// Import Routes
import elevationRoutes from './routes/elevationRoutes.js';
import searchRoutes from './routes/searchRoutes.js';
import osmRoutes from './routes/osmRoutes.js';
import ibgeRoutes from './routes/ibgeRoutes.js';
import indeRoutes from './routes/indeRoutes.js';
import analysisRoutes from './routes/analysisRoutes.js';
import constantsRoutes from './routes/constantsRoutes.js';
import btHistoryRoutes from './routes/btHistoryRoutes.js';
import btDerivedRoutes from './routes/btDerivedRoutes.js';
import btCalculationRoutes from './routes/btCalculationRoutes.js';
import jobRoutes from './routes/jobRoutes.js';
import firestoreRoutes from './routes/firestoreRoutes.js';
import dxfRoutes from './routes/dxfRoutes.js';
import metricsRoutes from './routes/metricsRoutes.js';
import storageRoutes from './routes/storageRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Express = express();
const port = config.PORT;

// Explicit trust proxy configuration is required for accurate req.ip behind reverse proxies.
app.set('trust proxy', config.trustProxy);

// Ollama process management
let ollamaProcess: ReturnType<typeof spawn> | null = null;
const OLLAMA_MODEL = config.OLLAMA_MODEL;

function resolveFrontendDistDirectory(): string {
    const candidates = [
        path.resolve(__dirname, '../dist'),
        path.resolve(__dirname, '../../dist'),
        path.resolve(__dirname, '../../../dist'),
        path.resolve(process.cwd(), 'dist')
    ];
    const existing = candidates.find((c) => fs.existsSync(path.join(c, 'index.html')));
    return existing || candidates[0];
}

const dxfDirectory = config.DXF_DIRECTORY;
const frontendDistDirectory = resolveFrontendDistDirectory();

// Ensure DXF directory exists
if (!fs.existsSync(dxfDirectory)) {
    fs.mkdirSync(dxfDirectory, { recursive: true });
}

// Ollama management
async function isOllamaRunning(): Promise<boolean> {
    try {
        const response = await fetch(`${config.OLLAMA_HOST}/api/tags`, { signal: AbortSignal.timeout(config.OLLAMA_CHECK_TIMEOUT_MS) });
        return response.ok;
    } catch { return false; }
}

async function startOllama(): Promise<void> {
    if (await isOllamaRunning()) return;
    try {
        ollamaProcess = spawn('ollama', ['serve'], { detached: false, stdio: 'pipe' });
        ollamaProcess.stdout?.on('data', (d) => logger.info(`Ollama: ${d.toString().trim()}`));
        await new Promise(r => setTimeout(r, config.OLLAMA_STARTUP_WAIT_MS));
    } catch (e) { logger.error('Ollama start failed', e); }
}

function stopOllama(): void {
    if (ollamaProcess) { ollamaProcess.kill('SIGTERM'); ollamaProcess = null; }
}

// Middleware

// CORS configuration: restrict to specific origins based on environment
const allowedOrigins =
  config.NODE_ENV === 'production'
    ? (config.CORS_ORIGIN
        ? config.CORS_ORIGIN.split(',').map((o) => o.trim())
        : [])
    : ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:4173', 'http://127.0.0.1:5173']; // Vite dev/preview

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS policy: origin ${origin} not allowed`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(helmet({
    // Allow cross-origin resource fetches for current frontend/backend split deployments.
    crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(express.json({ limit: config.BODY_LIMIT }));
app.use(requestMetrics);
app.use(generalRateLimiter);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// Controlled DXF download: stream file and delete it immediately after successful download.
app.get('/downloads/:filename', downloadsRateLimiter, (req: Request, res: Response, next: NextFunction) => {
    const requested = req.params.filename || '';
    
    // Sanitize: allow only alphanumeric, dash, underscore, and dot
    if (!/^[\w.-]+$/.test(requested)) {
        return next(createError.validation('Invalid filename format', { received: requested }));
    }
    
    // Path traversal protection
    const safeName = path.basename(requested);
    if (!safeName || safeName !== requested) {
        return next(createError.validation('Invalid filename'));
    }

    const filePath = path.join(dxfDirectory, safeName);
    
    // Verify the resolved path is still within dxfDirectory
    const resolvedPath = path.resolve(filePath);
    const resolvedDir = path.resolve(dxfDirectory);
    if (!resolvedPath.startsWith(resolvedDir)) {
        return next(createError.authorization('Access denied', { reason: 'path traversal detected' }));
    }
    
    if (!fs.existsSync(filePath)) {
        return next(createError.notFound('DXF file'));
    }

    res.download(filePath, safeName, (err) => {
        if (err) {
            logger.warn('DXF download failed', { filePath, error: err.message });
            return;
        }

        markDxfDownloaded(filePath);
    });
});

// Health Check
app.get('/health', async (_req: Request, res: Response) => {
    res.json({
        status: 'online',
        service: 'sisRUA Unified Backend',
        version: config.APP_VERSION,
        environment: config.NODE_ENV,
        constantsCatalog: {
            enabledNamespaces: {
                cqt: config.useDbConstantsCqt,
                clandestino: config.useDbConstantsClandestino,
                config: config.useDbConstantsConfig,
            },
            cache: constantsService.stats(),
        }
    });
});

// API Routes (Modular)
app.use('/api/elevation', elevationRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/osm', osmRoutes);
app.use('/api/ibge', ibgeRoutes);
app.use('/api/inde', indeRoutes);
app.use('/api/analyze', analyzeRateLimiter, analysisRoutes);
app.use('/api/constants', constantsRoutes);
app.use('/api/bt-history', btHistoryRoutes);
app.use('/api/bt', btDerivedRoutes);
app.use('/api/bt', btCalculationRoutes);
app.use('/api/jobs', jobRoutes);
if (config.useFirestore) {
    app.use('/api/firestore', firestoreRoutes);
}
app.use('/api/storage', storageRoutes);
app.use('/api/dxf', dxfRoutes);
app.use('/metrics', metricsRoutes);

// Static files
app.use(express.static(frontendDistDirectory));
app.get('*', (_req: Request, res: Response) => {
    const indexPath = path.join(frontendDistDirectory, 'index.html');
    if (fs.existsSync(indexPath)) res.sendFile(indexPath);
    else res.status(404).json({ error: 'Frontend not found' });
});

// Error handler - must be last middleware
app.use(errorHandler);

// Start server
app.listen(port, async () => {
    logger.info('Backend online', {
        service: 'sisRUA',
        version: config.APP_VERSION,
        port,
        trustProxy: config.trustProxy,
    });
    if (config.useSupabaseJobs) {
        logger.info('Supabase/Postgres jobs persistence is enabled');
    }
    if (!config.CONSTANTS_REFRESH_TOKEN?.trim()) {
        logger.warn('CONSTANTS_REFRESH_TOKEN is not configured. Constants refresh admin endpoints will be unavailable.', {
            environment: config.NODE_ENV,
        });
    }
    const dbConstantsNamespaces: string[] = [
        ...(config.useDbConstantsCqt ? ['cqt'] : []),
        ...(config.useDbConstantsClandestino ? ['clandestino'] : []),
        ...(config.useDbConstantsConfig ? ['config'] : []),
    ];
    if (dbConstantsNamespaces.length > 0) {
        await constantsService.warmUp(dbConstantsNamespaces).catch(
            (e: Error) => logger.warn('Constants warmup failed — hardcoded fallback active', { error: e.message })
        );
        refreshRateLimitersFromCatalog();
    }
    initializeDxfCleanup(dxfDirectory);
    if (config.NODE_ENV === 'production' && config.useFirestore) {
        await startFirestoreMonitoring().catch(e => logger.error('Firestore monitor failed', e));
    }
    await startOllama();
});

// Graceful shutdown
let shuttingDown = false;

async function shutdown(signal: 'SIGTERM' | 'SIGINT'): Promise<void> {
    if (shuttingDown) {
        return;
    }
    shuttingDown = true;

    logger.info('Shutdown signal received', { signal });
    try {
        await stopTaskWorker();
    } catch (error) {
        logger.error('Failed to stop task worker gracefully', { error });
    }

    stopDxfCleanup();
    stopCacheCleanup();
    stopOllama();
    stopFirestoreMonitoring();
    process.exit(0);
}

process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
});
process.on('SIGINT', () => {
    void shutdown('SIGINT');
});
