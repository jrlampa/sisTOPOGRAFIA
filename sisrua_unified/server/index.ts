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
import { logger } from './utils/logger.js';
import { generalRateLimiter } from './middleware/rateLimiter.js';
import { requestMetrics } from './middleware/requestMetrics.js';
import { specs } from './swagger.js';

// Import Routes
import elevationRoutes from './routes/elevationRoutes.js';
import searchRoutes from './routes/searchRoutes.js';
import osmRoutes from './routes/osmRoutes.js';
import ibgeRoutes from './routes/ibgeRoutes.js';
import indeRoutes from './routes/indeRoutes.js';
import analysisRoutes from './routes/analysisRoutes.js';
import jobRoutes from './routes/jobRoutes.js';
import firestoreRoutes from './routes/firestoreRoutes.js';
import dxfRoutes from './routes/dxfRoutes.js';
import metricsRoutes from './routes/metricsRoutes.js';

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

initializeDxfCleanup(dxfDirectory);

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
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: config.BODY_LIMIT }));
app.use(requestMetrics);
app.use(generalRateLimiter);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// Controlled DXF download: stream file and delete it immediately after successful download.
app.get('/downloads/:filename', (req: Request, res: Response) => {
    const requested = req.params.filename || '';
    const safeName = path.basename(requested);

    if (!safeName || safeName !== requested) {
        return res.status(400).json({ error: 'Invalid filename' });
    }

    const filePath = path.join(dxfDirectory, safeName);
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
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
        environment: config.NODE_ENV
    });
});

// API Routes (Modular)
app.use('/api/elevation', elevationRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/osm', osmRoutes);
app.use('/api/ibge', ibgeRoutes);
app.use('/api/inde', indeRoutes);
app.use('/api/analyze', analysisRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/firestore', firestoreRoutes);
app.use('/api/dxf', dxfRoutes);
app.use('/metrics', metricsRoutes);

// Static files
app.use(express.static(frontendDistDirectory));
app.get('*', (_req: Request, res: Response) => {
    const indexPath = path.join(frontendDistDirectory, 'index.html');
    if (fs.existsSync(indexPath)) res.sendFile(indexPath);
    else res.status(404).json({ error: 'Frontend not found' });
});

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error('Error', { error: err.message });
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(port, async () => {
    logger.info('Backend online', { service: 'sisRUA', version: config.APP_VERSION, port });
    if (config.NODE_ENV === 'production') {
        await startFirestoreMonitoring().catch(e => logger.error('Firestore monitor failed', e));
    }
    await startOllama();
});

// Graceful shutdown
process.on('SIGTERM', () => { stopDxfCleanup(); stopOllama(); stopFirestoreMonitoring(); process.exit(0); });
process.on('SIGINT', () => { stopDxfCleanup(); stopOllama(); stopFirestoreMonitoring(); process.exit(0); });
