import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import 'dotenv/config';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import swaggerUi from 'swagger-ui-express';

import { OllamaService } from './services/ollamaService.js';
import { startFirestoreMonitoring, stopFirestoreMonitoring } from './services/firestoreService.js';
import { logger } from './utils/logger.js';
import { generalRateLimiter } from './middleware/rateLimiter.js';
import { specs } from './swagger.js';

// Import Routes
import elevationRoutes from './routes/elevationRoutes.js';
import searchRoutes from './routes/searchRoutes.js';
import ibgeRoutes from './routes/ibgeRoutes.js';
import indeRoutes from './routes/indeRoutes.js';
import analysisRoutes from './routes/analysisRoutes.js';
import jobRoutes from './routes/jobRoutes.js';
import firestoreRoutes from './routes/firestoreRoutes.js';
import dxfRoutes from './routes/dxfRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Express = express();
const port = process.env.PORT || 3001;

// Ollama process management
let ollamaProcess: ReturnType<typeof spawn> | null = null;
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';

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
        const response = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(2000) });
        return response.ok;
    } catch { return false; }
}

async function startOllama(): Promise<void> {
    if (await isOllamaRunning()) return;
    try {
        ollamaProcess = spawn('ollama', ['serve'], { detached: false, stdio: 'pipe' });
        ollamaProcess.stdout?.on('data', (d) => logger.info(`Ollama: ${d.toString().trim()}`));
        await new Promise(r => setTimeout(r, 3000));
    } catch (e) { logger.error('Ollama start failed', e); }
}

function stopOllama(): void {
    if (ollamaProcess) { ollamaProcess.kill('SIGTERM'); ollamaProcess = null; }
}

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(generalRateLimiter);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));
app.use('/downloads', express.static(dxfDirectory));

// Health Check
app.get('/health', async (_req: Request, res: Response) => {
    res.json({
        status: 'online',
        service: 'sisRUA Unified Backend',
        version: '1.2.0',
        environment: process.env.NODE_ENV || 'development'
    });
});

// API Routes (Modular)
app.use('/api/elevation', elevationRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/ibge', ibgeRoutes);
app.use('/api/inde', indeRoutes);
app.use('/api/analyze', analysisRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/firestore', firestoreRoutes);
app.use('/api/dxf', dxfRoutes);

// Static files
app.use(express.static(frontendDistDirectory));
app.get('*', (_req: Request, res: Response) => {
    const indexPath = path.join(frontendDistDirectory, 'index.html');
    if (fs.existsSync(indexPath)) res.sendFile(indexPath);
    else res.status(404).json({ error: 'Frontend not found' });
});

// Error handler
app.use((err: Error, _req: Request, res: Response) => {
    logger.error('Error', { error: err.message });
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(port, async () => {
    logger.info('Backend online', { service: 'sisRUA', version: '1.2.0', port });
    if (process.env.NODE_ENV === 'production') {
        await startFirestoreMonitoring().catch(e => logger.error('Firestore monitor failed', e));
    }
    await startOllama();
});

// Graceful shutdown
process.on('SIGTERM', () => { stopOllama(); stopFirestoreMonitoring(); process.exit(0); });
process.on('SIGINT', () => { stopOllama(); stopFirestoreMonitoring(); process.exit(0); });
