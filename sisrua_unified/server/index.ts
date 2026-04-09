import express, { Express, NextFunction, Request, Response } from 'express';
import cors from 'cors';
import 'dotenv/config';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import swaggerUi from 'swagger-ui-express';

import { config } from './config.js';
import { OllamaService } from './services/ollamaService.js';
import { startFirestoreMonitoring, stopFirestoreMonitoring } from './services/firestoreService.js';
import { initializeDxfCleanup, markDxfDownloaded, stopDxfCleanup } from './services/dxfCleanupService.js';
import { stopTaskWorker } from './services/cloudTasksService.js';
import { constantsService } from './services/constantsService.js';
import { logger } from './utils/logger.js';
import { generalRateLimiter, refreshRateLimitersFromCatalog } from './middleware/rateLimiter.js';
import { requestMetrics } from './middleware/requestMetrics.js';
import { specs } from './swagger.js';
import { errorHandler, createError, asyncHandler } from './errorHandler.js';

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
import jobRoutes from './routes/jobRoutes.js';
import firestoreRoutes from './routes/firestoreRoutes.js';
import dxfRoutes from './routes/dxfRoutes.js';
import metricsRoutes from './routes/metricsRoutes.js';
import storageRoutes from './routes/storageRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Express = express();
const port = config.PORT;

// Ollama process management
let ollamaProcess: ReturnType<typeof spawn> | null = null;
const OLLAMA_MODEL = config.OLLAMA_MODEL;

// Directory resolution
function resolveDxfDirectory(): string {
    const candidates = [
        path.resolve(__dirname, '../public/dxf'),
        path.resolve(__dirname, '../../../public/dxf')
    ];
    const existing = candidates.find((c) => fs.existsSync(c));
    return existing || candidates[candidates.length - 1];
}

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

const dxfDirectory = resolveDxfDirectory();
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
    : ['http://localhost:5173', 'http://localhost:4173', 'http://127.0.0.1:5173']; // Vite dev/preview

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
app.use(express.json({ limit: config.BODY_LIMIT }));
app.use(requestMetrics);
app.use(generalRateLimiter);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// Controlled DXF download: stream file and delete it immediately after successful download.
app.get('/downloads/:filename', (req: Request, res: Response, next: NextFunction) => {
    const requested = req.params.filename || '';
    
    // Sanitize: allow only alphanumeric, dash, underscore, and dot
    if (!/^[\w\-\.]+$/.test(requested)) {
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
app.use('/api/analyze', analysisRoutes);
app.use('/api/constants', constantsRoutes);
app.use('/api/bt-history', btHistoryRoutes);
app.use('/api/bt', btDerivedRoutes);
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
    logger.info('Backend online', { service: 'sisRUA', version: config.APP_VERSION, port });
    if (config.useSupabaseJobs) {
        logger.info('Supabase/Postgres jobs persistence is enabled');
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
process.on('SIGTERM', () => { stopTaskWorker(); stopDxfCleanup(); stopOllama(); stopFirestoreMonitoring(); process.exit(0); });
process.on('SIGINT', () => { stopTaskWorker(); stopDxfCleanup(); stopOllama(); stopFirestoreMonitoring(); process.exit(0); });
