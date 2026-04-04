import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import 'dotenv/config';
import multer from 'multer';
import { z } from 'zod';
import swaggerUi from 'swagger-ui-express';
import { spawn } from 'child_process';

import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { GeocodingService } from './services/geocodingService.js';
import { ElevationService } from './services/elevationService.js';
import { AnalysisService } from './services/analysisService.js';
import { OllamaService } from './services/ollamaService.js';
import {
    createCacheKey,
    deleteCachedFilename,
    getCachedFilename,
    setCachedFilename
} from './services/cacheService.js';
import { createDxfTask } from './services/cloudTasksService.js';
import { createJob, getJob, updateJobStatus, completeJob, failJob } from './services/jobStatusService.js';
import { scheduleDxfDeletion } from './services/dxfCleanupService.js';
import { generateDxf } from './pythonBridge.js';
import { logger } from './utils/logger.js';
import { generalRateLimiter, dxfRateLimiter } from './middleware/rateLimiter.js';
import { verifyCloudTasksToken, webhookRateLimiter } from './middleware/auth.js';
import { dxfRequestSchema } from './schemas/dxfRequest.js';
import { 
    searchSchema, 
    elevationProfileSchema, 
    analysisSchema,
    batchRowSchema 
} from './schemas/apiSchemas.js';
import { parseBatchCsv, RawBatchRow } from './services/batchService.js';
import { specs } from './swagger.js';
import { startFirestoreMonitoring, stopFirestoreMonitoring, getFirestoreService } from './services/firestoreService.js';
import { IbgeService } from './services/ibgeService.js';
import { IndeService } from './services/indeService.js';
import { TopodataService } from './services/topodataService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Security constants
const MAX_ERROR_MESSAGE_LENGTH = 200;
const ALLOWED_PYTHON_COMMANDS = ['python3', 'python'];

const app: Express = express();
const port = process.env.PORT || 3001;

function resolveDxfDirectory(): string {
    const candidates = [
        path.resolve(__dirname, '../public/dxf'),
        path.resolve(__dirname, '../../../public/dxf')
    ];

    const existing = candidates.find((candidate) => fs.existsSync(candidate));
    if (existing) {
        return existing;
    }

    return candidates[candidates.length - 1];
}

function resolveFrontendDistDirectory(): string {
    const candidates = [
        path.resolve(__dirname, '../dist'),           // server/../dist -> dist
        path.resolve(__dirname, '../../dist'),      // server/../../dist -> project/dist
        path.resolve(__dirname, '../../../dist'),   // fallback
        path.resolve(process.cwd(), 'dist')         // cwd/dist
    ];

    logger.info('Frontend directory candidates', { candidates });

    const existing = candidates.find((candidate) => fs.existsSync(path.join(candidate, 'index.html')));
    if (existing) {
        logger.info('Found existing frontend directory', { existing });
        return existing;
    }

    return candidates[0]; // Default to first candidate
}

const dxfDirectory = resolveDxfDirectory();
const frontendDistDirectory = resolveFrontendDistDirectory();

// Debug logs for frontend directory
logger.info('Frontend directory configuration', {
    frontendDistDirectory,
    exists: fs.existsSync(path.join(frontendDistDirectory, 'index.html')),
    dirname: __dirname
});

/**
 * Get the base URL for the application
 * Uses environment variable if available, otherwise derives from request
 */
function getBaseUrl(req?: Request): string {
    // 1. Check for Cloud Run base URL (production)
    if (process.env.CLOUD_RUN_BASE_URL) {
        return process.env.CLOUD_RUN_BASE_URL;
    }
    
    // 2. Derive from request if available
    if (req) {
        const protocol = req.get('x-forwarded-proto') || req.protocol || 'http';
        const host = req.get('x-forwarded-host') || req.get('host') || `localhost:${port}`;
        return `${protocol}://${host}`;
    }
    
    // 3. Fallback to localhost (development)
    return `http://localhost:${port}`;
}
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }
});

// Batch row schema is now imported from apiSchemas.ts
// (removed local duplicate definition)

// Configuração
app.set('trust proxy', true);

// CORS Configuration - Allow requests from development and production origins
const corsOptions = {
    origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
        // Allow requests with no origin (like mobile apps, curl, Postman)
        if (!origin) return callback(null, true);
        
        // List of allowed origins
        const allowedOrigins = [
            'http://localhost:3000',  // Vite dev server
            'http://localhost:8080',  // Production server
            'http://127.0.0.1:3000',
            'http://127.0.0.1:8080',
        ];
        
        // Add Cloud Run URL if configured
        if (process.env.CLOUD_RUN_BASE_URL) {
            allowedOrigins.push(process.env.CLOUD_RUN_BASE_URL);
        }
        
        // CRITICAL FIX: Allow Cloud Run service to call itself
        // Cloud Run URLs follow pattern: https://{service}-{hash}.{region}.run.app
        // Security: Parse URL and check hostname ends with .run.app
        let isCloudRunOrigin = false;
        try {
            const originUrl = new URL(origin);
            isCloudRunOrigin = originUrl.hostname.endsWith('.run.app') || 
                             originUrl.hostname.endsWith('.southamerica-east1.run.app');
        } catch (e) {
            // Invalid URL, not a Cloud Run origin
            isCloudRunOrigin = false;
        }
        
        // Check if origin is allowed
        if (allowedOrigins.indexOf(origin) !== -1 || isCloudRunOrigin) {
            logger.info('CORS request allowed', { origin, isCloudRun: isCloudRunOrigin });
            callback(null, true);
        } else {
            // In development mode, allow with warning; in production, reject
            if (process.env.NODE_ENV === 'production') {
                logger.warn('CORS request rejected in production', { origin, allowedOrigins });
                callback(new Error('Not allowed by CORS'), false);
            } else {
                logger.info('CORS request from unlisted origin allowed in development', { origin });
                callback(null, true);
            }
        }
    },
    credentials: true
};

app.use(cors(corsOptions));
// Default body parser with reasonable 1MB limit for most endpoints
// This prevents large payload attacks on endpoints that don't need big requests
app.use(express.json({ limit: '1mb' }));
app.use(generalRateLimiter);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// Helper middleware for endpoints that need smaller body size limits
const smallBodyParser = express.json({ limit: '100kb' });

// Helper middleware for endpoints that need larger body size limits (used sparingly)
const largeBodyParser = express.json({ limit: '5mb' });

// DEBUG: Log environment variables on startup
logger.info('Server starting with environment configuration', {
    nodeEnv: process.env.NODE_ENV,
    port: process.env.PORT,
    dockerEnv: process.env.DOCKER_ENV,
    hasGroqApiKey: !!process.env.GROQ_API_KEY,
    // Removed groqKeyLength and groqKeyPrefix for security
    gcpProject: process.env.GCP_PROJECT || 'not-set',
    cloudRunBaseUrl: process.env.CLOUD_RUN_BASE_URL || 'not-set'
});

// Logging Middleware
app.use((req, _res, next) => {
    logger.info('Incoming request', {
        method: req.method,
        url: req.url,
        ip: req.ip
    });
    next();
});

// Health Check
app.get('/health', async (_req: Request, res: Response) => {
    try {
        const pythonCommand = process.env.PYTHON_COMMAND || 'python3';
        
        // Security: Validate Python command
        if (!ALLOWED_PYTHON_COMMANDS.includes(pythonCommand)) {
            logger.error('Invalid PYTHON_COMMAND', { pythonCommand });
            return res.json({
                status: 'degraded',
                service: 'sisRUA Unified Backend',
                version: '1.2.0',
                python: 'unavailable',
                error: 'Invalid Python command configuration'
            });
        }
        
        // Quick Python availability check (non-blocking)
        const pythonAvailable = await new Promise<boolean>((resolve) => {
            const timeout = setTimeout(() => {
                resolve(false);
            }, 2000); // 2 second timeout
            
            const proc = spawn(pythonCommand, ['--version']);
            
            proc.on('close', (code) => {
                clearTimeout(timeout);
                resolve(code === 0);
            });
            
            proc.on('error', () => {
                clearTimeout(timeout);
                resolve(false);
            });
        });

        res.json({
            status: 'online',
            service: 'sisRUA Unified Backend',
            version: '1.2.0',
            python: pythonAvailable ? 'available' : 'unavailable',
            environment: process.env.NODE_ENV || 'development',
            dockerized: process.env.DOCKER_ENV === 'true',
            // Include GROQ API key status for debugging
            groqApiKey: {
                configured: !!process.env.GROQ_API_KEY
                // Removed 'prefix' and 'length' fields for security
                // API key details should not be exposed in public endpoints
            }
        });
    } catch (error) {
        // If health check fails, still return 200 but with degraded status
        res.json({
            status: 'degraded',
            service: 'sisRUA Unified Backend',
            version: '1.2.0',
            error: 'Health check encountered an error'
        });
    }
});

// Firestore Status and Circuit Breaker Endpoint
app.get('/api/firestore/status', async (_req: Request, res: Response) => {
    try {
        const useFirestore = process.env.NODE_ENV === 'production' || process.env.USE_FIRESTORE === 'true';
        
        if (!useFirestore) {
            return res.json({
                enabled: false,
                mode: 'memory',
                message: 'Firestore is disabled (development mode)'
            });
        }

        const firestoreService = getFirestoreService();
        const circuitBreaker = firestoreService.getCircuitBreakerStatus();
        const quotaUsage = await firestoreService.getCurrentUsage();

        const quotaPercentages = {
            reads: (quotaUsage.reads / 50000 * 100).toFixed(2),
            writes: (quotaUsage.writes / 20000 * 100).toFixed(2),
            deletes: (quotaUsage.deletes / 20000 * 100).toFixed(2),
            storage: (quotaUsage.storageBytes / (1024 * 1024 * 1024) * 100).toFixed(2)
        };

        res.json({
            enabled: true,
            mode: 'firestore',
            circuitBreaker: {
                status: circuitBreaker.isOpen ? 'OPEN' : 'CLOSED',
                operation: circuitBreaker.operation || 'none',
                message: circuitBreaker.isOpen 
                    ? `Circuit breaker opened for ${circuitBreaker.operation} (${circuitBreaker.usage}/${circuitBreaker.limit})`
                    : 'All operations allowed'
            },
            quotas: {
                date: quotaUsage.date,
                reads: {
                    current: quotaUsage.reads,
                    limit: 50000,
                    percentage: `${quotaPercentages.reads}%`,
                    available: 50000 - quotaUsage.reads
                },
                writes: {
                    current: quotaUsage.writes,
                    limit: 20000,
                    percentage: `${quotaPercentages.writes}%`,
                    available: 20000 - quotaUsage.writes
                },
                deletes: {
                    current: quotaUsage.deletes,
                    limit: 20000,
                    percentage: `${quotaPercentages.deletes}%`,
                    available: 20000 - quotaUsage.deletes
                },
                storage: {
                    current: `${(quotaUsage.storageBytes / 1024 / 1024).toFixed(2)} MB`,
                    limit: '1024 MB',
                    percentage: `${quotaPercentages.storage}%`,
                    bytes: quotaUsage.storageBytes
                }
            },
            lastUpdated: quotaUsage.lastUpdated
        });
    } catch (error: any) {
        logger.error('Firestore status check failed', { error });
        res.status(500).json({
            enabled: true,
            error: error.message,
            message: 'Failed to retrieve Firestore status'
        });
    }
});

// Serve generated files
app.use('/downloads', express.static(dxfDirectory));

// Cloud Tasks Webhook - Process DXF Generation
// Protected by OIDC token validation and rate limiting
app.post('/api/tasks/process-dxf', 
    webhookRateLimiter,
    verifyCloudTasksToken,
    async (req: Request, res: Response) => {
    try {
        // OIDC token has been verified by middleware
        // Request is authenticated and authorized
        logger.info('DXF task webhook processing authenticated request', {
            taskId: req.body.taskId
        });

        const {
            taskId,
            lat,
            lon,
            radius,
            mode,
            polygon,
            layers,
            projection,
            outputFile,
            filename,
            cacheKey,
            downloadUrl
        } = req.body;

        if (!taskId) {
            return res.status(400).json({ error: 'Task ID is required' });
        }

        // Update job status to processing
        updateJobStatus(taskId, 'processing', 10);

        logger.info('Processing DXF generation task', {
            taskId,
            lat,
            lon,
            radius,
            mode,
            cacheKey
        });

        try {
            // Generate DXF using Python bridge
            await generateDxf({
                lat,
                lon,
                radius,
                mode,
                polygon,
                layers,
                projection,
                outputFile
            });

            // Cache the filename
            setCachedFilename(cacheKey, filename);

            // Schedule DXF file for deletion after 10 minutes
            scheduleDxfDeletion(outputFile);

            // Mark job as completed
            completeJob(taskId, {
                url: downloadUrl,
                filename
            });

            logger.info('DXF generation completed', {
                taskId,
                filename,
                cacheKey
            });

            return res.status(200).json({
                status: 'success',
                taskId,
                url: downloadUrl,
                filename
            });

        } catch (error: any) {
            logger.error('DXF generation failed', {
                taskId,
                error: error.message,
                stack: error.stack
            });

            failJob(taskId, error.message);

            return res.status(500).json({
                status: 'failed',
                taskId,
                error: error.message
            });
        }

    } catch (error: any) {
        logger.error('Task webhook error', {
            error: error.message,
            stack: error.stack
        });
        return res.status(500).json({
            error: 'Task processing failed',
            details: error.message
        });
    }
});

// Batch DXF Generation Endpoint
app.post('/api/batch/dxf', upload.single('file'), async (req: Request, res: Response) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'CSV file is required' });
        }

        const rows = await parseBatchCsv(req.file.buffer);
        if (rows.length === 0) {
            return res.status(400).json({ error: 'CSV is empty or invalid' });
        }

        const results: Array<{ name: string; status: string; jobId?: string | number; url?: string }> = [];
        const errors: Array<{ line: number; message: string; row: RawBatchRow }> = [];

        for (const entry of rows) {
            const validation = batchRowSchema.safeParse(entry.row);
            if (!validation.success) {
                errors.push({
                    line: entry.line,
                    message: validation.error.issues.map((issue) => issue.message).join(', '),
                    row: entry.row
                });
                continue;
            }

            const { name, lat, lon, radius, mode } = validation.data;
            const cacheKey = createCacheKey({
                lat,
                lon,
                radius,
                mode,
                polygon: [],
                layers: {}
            });

            const cachedFilename = getCachedFilename(cacheKey);
            if (cachedFilename) {
                const cachedFilePath = path.join(dxfDirectory, cachedFilename);
                if (fs.existsSync(cachedFilePath)) {
                    const baseUrl = getBaseUrl(req);
                    const cachedUrl = `${baseUrl}/downloads/${cachedFilename}`;
                    results.push({
                        name,
                        status: 'cached',
                        url: cachedUrl
                    });
                    continue;
                }

                deleteCachedFilename(cacheKey);
            }

            const safeName = name.toLowerCase().replace(/[^a-z0-9-_]+/g, '_').slice(0, 40) || 'batch';
            const filename = `dxf_${safeName}_${Date.now()}_${entry.line}.dxf`;
            const outputFile = path.join(dxfDirectory, filename);
            const baseUrl = getBaseUrl(req);
            const downloadUrl = `${baseUrl}/downloads/${filename}`;

            const { taskId } = await createDxfTask({
                lat,
                lon,
                radius,
                mode,
                polygon: '[]',
                layers: {},
                projection: 'local',
                outputFile,
                filename,
                cacheKey,
                downloadUrl
            });

            // Create job for status tracking
            createJob(taskId);

            results.push({
                name,
                status: 'queued',
                jobId: taskId
            });
        }

        if (results.length === 0) {
            return res.status(400).json({ error: 'No valid rows found', errors });
        }

        return res.status(200).json({ results, errors });
    } catch (err: any) {
        logger.error('Batch DXF upload failed', { error: err });
        return res.status(500).json({ error: 'Batch processing failed', details: err.message });
    }
});

// DXF Generation Endpoint (POST for large polygons)
// Uses larger body limit (5mb) to support complex polygon geometries
app.post('/api/dxf', largeBodyParser, dxfRateLimiter, async (req: Request, res: Response) => {
    try {
        const validation = dxfRequestSchema.safeParse(req.body);
        if (!validation.success) {
            logger.warn('DXF validation failed', {
                issues: validation.error.issues,
                ip: req.ip
            });
            return res.status(400).json({ error: 'Invalid request body', details: validation.error.issues });
        }

        const { lat, lon, radius, mode } = validation.data;
        const { polygon, layers, projection } = req.body;
        const resolvedMode = mode || 'circle';
        const cacheKey = createCacheKey({
            lat,
            lon,
            radius,
            mode: resolvedMode,
            polygon: typeof polygon === 'string' ? polygon : polygon ?? null,
            layers: layers ?? {}
        });

        const cachedFilename = getCachedFilename(cacheKey);
        if (cachedFilename) {
            const cachedFilePath = path.join(dxfDirectory, cachedFilename);
            if (fs.existsSync(cachedFilePath)) {
                const baseUrl = getBaseUrl(req);
                const cachedUrl = `${baseUrl}/downloads/${cachedFilename}`;
                logger.info('DXF cache hit', {
                    cacheKey,
                    filename: cachedFilename,
                    ip: req.ip
                });
                return res.json({
                    status: 'success',
                    message: 'DXF Generated',
                    url: cachedUrl
                });
            }

            deleteCachedFilename(cacheKey);
            logger.warn('DXF cache entry missing file', {
                cacheKey,
                filename: cachedFilename,
                ip: req.ip
            });
        } else {
            logger.info('DXF cache miss', {
                cacheKey,
                ip: req.ip
            });
        }

        const baseUrl = getBaseUrl(req);
        const filename = `dxf_${Date.now()}.dxf`;
        const outputFile = path.join(dxfDirectory, filename);
        const downloadUrl = `${baseUrl}/downloads/${filename}`;

        logger.info('Queueing DXF generation', {
            lat,
            lon,
            radius,
            mode: resolvedMode,
            projection: projection || 'local',
            cacheKey
        });

        const { taskId, alreadyCompleted } = await createDxfTask({
            lat,
            lon,
            radius,
            mode: resolvedMode,
            polygon: typeof polygon === 'string' ? polygon : JSON.stringify(polygon || []),
            layers: layers || {},
            projection: projection || 'local',
            outputFile,
            filename,
            cacheKey,
            downloadUrl
        });

        // Create job for status tracking (unless it's already completed in dev mode)
        // In dev mode, createJob is called inside createDxfTask, so we don't call it again
        if (!alreadyCompleted) {
            createJob(taskId);
        }
        
        const responseStatus = alreadyCompleted ? 'success' : 'queued';
        return res.status(alreadyCompleted ? 200 : 202).json({
            status: responseStatus,
            jobId: taskId,
            ...(alreadyCompleted && { 
                url: downloadUrl,
                message: 'DXF generated immediately in development mode' 
            })
        });

    } catch (err: any) {
        logger.error('DXF generation error', { error: err });
        return res.status(500).json({ error: 'Generation failed', details: err.message });
    }
});

// Job Status Endpoint
app.get('/api/jobs/:id', async (req: Request, res: Response) => {
    try {
        const job = getJob(req.params.id);
        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        return res.json({
            id: job.id,
            status: job.status,
            progress: job.progress,
            result: job.result,
            error: job.error
        });
    } catch (err: any) {
        logger.error('Job status lookup failed', { error: err });
        return res.status(500).json({ error: 'Failed to retrieve job status', details: err.message });
    }
});

// IBGE API Endpoints - Brazilian territorial data
// Get location info by coordinates (reverse geocoding)
app.get('/api/ibge/location', async (req: Request, res: Response) => {
    try {
        const { lat, lng } = req.query;
        
        if (!lat || !lng) {
            return res.status(400).json({ error: 'lat and lng query parameters required' });
        }

        const latitude = parseFloat(lat as string);
        const longitude = parseFloat(lng as string);

        if (isNaN(latitude) || isNaN(longitude)) {
            return res.status(400).json({ error: 'Invalid coordinates' });
        }

        logger.info('IBGE reverse geocoding', { lat: latitude, lng: longitude });
        
        const locationInfo = await IbgeService.findMunicipioByCoordinates(latitude, longitude);
        
        if (locationInfo) {
            return res.json(locationInfo);
        } else {
            return res.status(404).json({ error: 'Location not found in Brazilian territory' });
        }
    } catch (error: any) {
        logger.error('IBGE location endpoint error', { error });
        return res.status(500).json({ error: error.message });
    }
});

// Get all states
app.get('/api/ibge/states', async (_req: Request, res: Response) => {
    try {
        const states = await IbgeService.getStates();
        return res.json(states);
    } catch (error: any) {
        logger.error('IBGE states endpoint error', { error });
        return res.status(500).json({ error: error.message });
    }
});

// Get municipalities by state
app.get('/api/ibge/municipios/:uf', async (req: Request, res: Response) => {
    try {
        const { uf } = req.params;
        const municipios = await IbgeService.getMunicipiosByState(uf.toUpperCase());
        return res.json(municipios);
    } catch (error: any) {
        logger.error('IBGE municipios endpoint error', { error, uf: req.params.uf });
        return res.status(500).json({ error: error.message });
    }
});

// Get municipality boundary (GeoJSON)
app.get('/api/ibge/boundary/municipio/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const boundary = await IbgeService.getMunicipalityBoundary(id);
        
        if (boundary) {
            return res.json(boundary);
        } else {
            return res.status(404).json({ error: 'Municipality boundary not found' });
        }
    } catch (error: any) {
        logger.error('IBGE boundary endpoint error', { error, id: req.params.id });
        return res.status(500).json({ error: error.message });
    }
});

// INDE API Endpoints - WMS/WFS for official Brazilian geographic data
// Get WFS capabilities (available layers)
app.get('/api/inde/capabilities/:source', async (req: Request, res: Response) => {
    try {
        const { source } = req.params;
        const validSources = ['ibge', 'icmbio', 'ana', 'dnit'];
        
        if (!validSources.includes(source)) {
            return res.status(400).json({ error: 'Invalid source', validSources });
        }
        
        const capabilities = await IndeService.getWfsCapabilities(source as any);
        return res.json({ source, layers: capabilities });
    } catch (error: any) {
        logger.error('INDE capabilities endpoint error', { error, source: req.params.source });
        return res.status(500).json({ error: error.message });
    }
});

// Get features by bounding box
app.get('/api/inde/features/:source', async (req: Request, res: Response) => {
    try {
        const { source } = req.params;
        const { layer, west, south, east, north, limit = '1000' } = req.query;
        
        if (!layer || !west || !south || !east || !north) {
            return res.status(400).json({ 
                error: 'Required parameters: layer, west, south, east, north' 
            });
        }
        
        const features = await IndeService.getFeaturesByBBox(
            layer as string,
            parseFloat(west as string),
            parseFloat(south as string),
            parseFloat(east as string),
            parseFloat(north as string),
            source as any,
            parseInt(limit as string)
        );
        
        if (features) {
            return res.json(features);
        } else {
            return res.status(404).json({ error: 'No features found' });
        }
    } catch (error: any) {
        logger.error('INDE features endpoint error', { error });
        return res.status(500).json({ error: error.message });
    }
});

// Get WMS map URL
app.get('/api/inde/wms/:source', async (req: Request, res: Response) => {
    try {
        const { source } = req.params;
        const { layer, west, south, east, north, width = '1024', height = '768' } = req.query;
        
        if (!layer || !west || !south || !east || !north) {
            return res.status(400).json({ 
                error: 'Required parameters: layer, west, south, east, north' 
            });
        }
        
        const mapUrl = IndeService.getWmsMapUrl(
            layer as string,
            parseFloat(west as string),
            parseFloat(south as string),
            parseFloat(east as string),
            parseFloat(north as string),
            parseInt(width as string),
            parseInt(height as string),
            source as any
        );
        
        return res.json({ url: mapUrl });
    } catch (error: any) {
        logger.error('INDE WMS endpoint error', { error });
        return res.status(500).json({ error: error.message });
    }
});

// Coordinate Search Endpoint (Using GeocodingService)
// Uses smaller body limit (100kb) - only needs a query string
app.post('/api/search', smallBodyParser, async (req: Request, res: Response) => {
    try {
        // Validate request with Zod schema
        const validation = searchSchema.safeParse(req.body);
        if (!validation.success) {
            logger.warn('Search validation failed', {
                issues: validation.error.issues,
                ip: req.ip
            });
            return res.status(400).json({ 
                error: 'Invalid request',
                details: validation.error.issues.map(i => i.message).join(', ')
            });
        }

        const { query } = validation.data;
        const location = await GeocodingService.resolveLocation(query);

        if (location) {
            return res.json(location);
        } else {
            return res.status(404).json({ error: 'Location not found' });
        }
    } catch (error: any) {
        logger.error('Search error', { error });
        return res.status(500).json({ error: error.message });
    }
});

// Elevation Profile Endpoint (Delegating to ElevationService)
app.post('/api/elevation/profile', async (req: Request, res: Response) => {
    try {
        // Validate request with Zod schema
        const validation = elevationProfileSchema.safeParse(req.body);
        if (!validation.success) {
            logger.warn('Elevation profile validation failed', {
                issues: validation.error.issues,
                ip: req.ip
            });
            return res.status(400).json({ 
                error: 'Invalid request',
                details: validation.error.issues.map(i => i.message).join(', ')
            });
        }

        const { start, end, steps } = validation.data;
        logger.info('Fetching elevation profile', { start, end, steps });
        
        const profile = await ElevationService.getElevationProfile(start, end, steps);
        return res.json({ profile });
    } catch (error: any) {
        logger.error('Elevation profile error', { 
            error: error.message,
            stack: error.stack
        });
        return res.status(500).json({ error: error.message });
    }
});

// Elevation Profile Export Endpoint - Export to CSV or KML
app.post('/api/elevation/profile/export', async (req: Request, res: Response) => {
    try {
        const { start, end, steps = 50, format = 'csv' } = req.body;
        
        if (!start || !end || format !== 'csv' && format !== 'kml') {
            return res.status(400).json({ error: 'Required: start, end, format (csv|kml)' });
        }
        
        logger.info('Exporting elevation profile', { start, end, steps, format });
        
        const profile = await ElevationService.getElevationProfile(start, end, steps);
        
        if (format === 'csv') {
            // Generate CSV
            let csv = 'distance_m,latitude,longitude,elevation_m\n';
            profile.forEach((p: { dist: number; elev: number }, i: number) => {
                const t = i / (profile.length - 1);
                const lat = start.lat + (end.lat - start.lat) * t;
                const lng = start.lng + (end.lng - start.lng) * t;
                csv += `${p.dist.toFixed(2)},${lat.toFixed(6)},${lng.toFixed(6)},${p.elev.toFixed(2)}\n`;
            });
            
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="elevation_profile.csv"');
            return res.send(csv);
        } else {
            // Generate KML
            const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
    <name>Perfil de Elevação</name>
    <Style id="elevationLine">
        <LineStyle><color>ff0000ff</color><width>3</width></LineStyle>
    </Style>
    <Placemark>
        <name>Perfil de Elevação</name>
        <styleUrl>#elevationLine</styleUrl>
        <LineString>
            <tessellate>1</tessellate>
            <coordinates>
${profile.map((p: { elev: number }, i: number) => {
    const t = i / (profile.length - 1);
    const lng = start.lng + (end.lng - start.lng) * t;
    const lat = start.lat + (end.lat - start.lat) * t;
    return `                ${lng.toFixed(6)},${lat.toFixed(6)},${p.elev.toFixed(2)}`;
}).join('\n')}
            </coordinates>
        </LineString>
    </Placemark>
</Document>
</kml>`;
            
            res.setHeader('Content-Type', 'application/vnd.google-earth.kml+xml');
            res.setHeader('Content-Disposition', 'attachment; filename="elevation_profile.kml"');
            return res.send(kml);
        }
    } catch (error: any) {
        logger.error('Elevation profile export error', { error: error.message });
        return res.status(500).json({ error: error.message });
    }
});

// Elevation Statistics Endpoint - Get elevation stats for an area
app.get('/api/elevation/stats', async (req: Request, res: Response) => {
    try {
        const { lat, lng, radius = 500 } = req.query;
        
        if (!lat || !lng) {
            return res.status(400).json({ error: 'Required: lat, lng' });
        }
        
        const centerLat = parseFloat(lat as string);
        const centerLng = parseFloat(lng as string);
        const radiusM = parseInt(radius as string);
        
        // Convert radius to degrees (approximate)
        const radiusDeg = radiusM / 111000.0;
        
        const north = centerLat + radiusDeg;
        const south = centerLat - radiusDeg;
        const east = centerLng + radiusDeg;
        const west = centerLng - radiusDeg;
        
        logger.info('Fetching elevation stats', { centerLat, centerLng, radiusM });
        
        // Use ElevationService to get profile points for statistics
        const steps = 10;
        const points = [];
        const gridSize = 5;
        
        for (let i = 0; i < gridSize; i++) {
            for (let j = 0; j < gridSize; j++) {
                const tLat = i / (gridSize - 1);
                const tLng = j / (gridSize - 1);
                const pointLat = south + (north - south) * tLat;
                const pointLng = west + (east - west) * tLng;
                
                const elevation = await ElevationService.getElevationAt(pointLat, pointLng);
                if (elevation !== null) {
                    points.push(elevation);
                }
            }
        }
        
        if (points.length === 0) {
            return res.status(404).json({ error: 'No elevation data available' });
        }
        
        // Calculate statistics
        const min = Math.min(...points);
        const max = Math.max(...points);
        const avg = points.reduce((a, b) => a + b, 0) / points.length;
        const range = max - min;
        
        // Detect data source
        const useTopodata = TopodataService.isWithinBrazil(centerLat, centerLng);
        
        return res.json({
            source: useTopodata ? 'TOPODATA (INPE)' : 'Open-Elevation',
            resolution: useTopodata ? '30m' : '90m',
            points_sampled: points.length,
            min_elevation_m: Math.round(min * 100) / 100,
            max_elevation_m: Math.round(max * 100) / 100,
            avg_elevation_m: Math.round(avg * 100) / 100,
            range_m: Math.round(range * 100) / 100,
            center: { lat: centerLat, lng: centerLng },
            radius_m: radiusM
        });
    } catch (error: any) {
        logger.error('Elevation stats error', { error: error.message });
        return res.status(500).json({ error: error.message });
    }
});

// TOPODATA Cache Management Endpoints
// Get cache status
app.get('/api/elevation/cache/status', (req: Request, res: Response) => {
    try {
        const stats = TopodataService.getCacheStats();
        return res.json({
            ...stats,
            isBrazilianTerritory: true,
            source: 'INPE TOPODATA'
        });
    } catch (error: any) {
        logger.error('Cache status error', { error: error.message });
        return res.status(500).json({ error: error.message });
    }
});

// Clear cache (protected - should require auth in production)
app.post('/api/elevation/cache/clear', (req: Request, res: Response) => {
    try {
        TopodataService.clearCache();
        return res.json({ message: 'TOPODATA cache cleared successfully' });
    } catch (error: any) {
        logger.error('Cache clear error', { error: error.message });
        return res.status(500).json({ error: error.message });
    }
});

// Batch elevation lookup (efficient for multiple points)
app.post('/api/elevation/batch', async (req: Request, res: Response) => {
    try {
        const { points } = req.body;
        
        if (!points || !Array.isArray(points) || points.length === 0) {
            return res.status(400).json({ error: 'Required: points array with {lat, lng}' });
        }
        
        if (points.length > 100) {
            return res.status(400).json({ error: 'Maximum 100 points allowed per request' });
        }
        
        logger.info(`Batch elevation lookup for ${points.length} points`);
        
        const results = [];
        let topodataCount = 0;
        let openElevCount = 0;
        
        for (const point of points) {
            const { lat, lng } = point;
            const elevation = await ElevationService.getElevationAt(lat, lng);
            const isBrazil = TopodataService.isWithinBrazil(lat, lng);
            
            if (isBrazil) topodataCount++;
            else openElevCount++;
            
            results.push({
                lat,
                lng,
                elevation,
                source: isBrazil ? 'TOPODATA' : 'Open-Elevation'
            });
        }
        
        return res.json({
            points: results,
            summary: {
                total: points.length,
                topodata: topodataCount,
                openElevation: openElevCount
            }
        });
    } catch (error: any) {
        logger.error('Batch elevation error', { error: error.message });
        return res.status(500).json({ error: error.message });
    }
});

// AI Analyze Endpoint (Delegating to OllamaService)
// Uses Ollama local LLM instead of Groq cloud API
app.post('/api/analyze', smallBodyParser, async (req: Request, res: Response) => {
    try {
        // Validate request with Zod schema
        const validation = analysisSchema.safeParse(req.body);
        if (!validation.success) {
            logger.warn('Analysis validation failed', {
                issues: validation.error.issues,
                ip: req.ip
            });
            return res.status(400).json({ 
                error: 'Invalid request',
                details: validation.error.issues.map(i => i.message).join(', ')
            });
        }

        const { stats, locationName } = validation.data;
        
        // Provide default location name if not provided
        const location = locationName || 'Área Selecionada';
        
        // Check if Ollama is available
        const ollamaAvailable = await OllamaService.isAvailable();
        
        logger.info('Ollama AI analysis requested', {
            locationName: location,
            ollamaAvailable,
            timestamp: new Date().toISOString()
        });
        
        if (!ollamaAvailable) {
            logger.warn('Ollama service not available');
            return res.status(503).json({ 
                error: 'Ollama not available',
                message: 'O serviço Ollama não está disponível. Verifique a instalação.',
                analysis: '**Análise AI Indisponível**\n\nO serviço Ollama não está disponível. Verifique se:\n1. O Ollama está instalado: https://ollama.com\n2. O serviço está rodando: `ollama serve`\n3. O modelo llama3.2 está disponível: `ollama pull llama3.2`'
            });
        }

        logger.info('Processing Ollama AI analysis request', { locationName: location, hasStats: !!stats });
        const result = await OllamaService.analyzeArea(stats, location);
        logger.info('Ollama AI analysis completed successfully', { locationName: location });
        return res.json(result);
    } catch (error: any) {
        logger.error('Ollama analysis error', { 
            error: error.message,
            stack: error.stack,
            body: req.body,
            errorType: error.constructor.name
        });
        
        // Sanitize error message to prevent injection
        const sanitizedMessage = String(error.message || 'Unknown error').slice(0, MAX_ERROR_MESSAGE_LENGTH);
        
        return res.status(500).json({ 
            error: 'Analysis failed',
            details: sanitizedMessage,
            analysis: `**Erro na Análise AI**\n\nNão foi possível processar a análise. Erro: ${error.message}`
        });
    }
});

// Elevation Comparison Endpoint - Compare TOPODATA vs Open-Elevation
app.get('/api/elevation/compare', async (req: Request, res: Response) => {
    try {
        const { lat, lng } = req.query;
        
        if (!lat || !lng) {
            return res.status(400).json({ error: 'Required: lat, lng' });
        }
        
        const latitude = parseFloat(lat as string);
        const longitude = parseFloat(lng as string);
        
        logger.info('Comparing elevation sources', { lat: latitude, lng: longitude });
        
        // Get TOPODATA elevation
        const topodataElev = await TopodataService.getElevation(latitude, longitude);
        
        // Get Open-Elevation elevation
        let openElev = null;
        try {
            const response = await fetch("https://api.open-elevation.com/api/v1/lookup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ locations: [{ latitude, longitude }] }),
                signal: AbortSignal.timeout(10000)
            });
            if (response.ok) {
                const data = await response.json();
                openElev = data.results[0]?.elevation ?? null;
            }
        } catch (e) {
            logger.warn('Open-Elevation comparison fetch failed', { error: e });
        }
        
        const isBrazil = TopodataService.isWithinBrazil(latitude, longitude);
        
        return res.json({
            location: { lat: latitude, lng: longitude },
            isBrazilianTerritory: isBrazil,
            topodata: {
                elevation: topodataElev,
                resolution: '30m',
                source: 'INPE TOPODATA'
            },
            openElevation: {
                elevation: openElev,
                resolution: '90m',
                source: 'Open-Elevation'
            },
            difference: (topodataElev !== null && openElev !== null) 
                ? Math.round((topodataElev - openElev) * 100) / 100 
                : null
        });
    } catch (error: any) {
        logger.error('Elevation comparison error', { error: error.message });
        return res.status(500).json({ error: error.message });
    }
});

// Slope Analysis Endpoint - Calculate terrain slope using TOPODATA
app.get('/api/elevation/slope', async (req: Request, res: Response) => {
    try {
        const { lat, lng, radius = 100 } = req.query;
        
        if (!lat || !lng) {
            return res.status(400).json({ error: 'Required: lat, lng' });
        }
        
        const latitude = parseFloat(lat as string);
        const longitude = parseFloat(lng as string);
        const radiusM = parseInt(radius as string);
        
        // Convert radius to degrees (approximate)
        const radiusDeg = radiusM / 111000.0;
        
        logger.info('Calculating slope', { lat: latitude, lng: longitude, radiusM });
        
        // Get elevation at center and 4 surrounding points
        const centerElev = await TopodataService.getElevation(latitude, longitude);
        const northElev = await TopodataService.getElevation(latitude + radiusDeg, longitude);
        const southElev = await TopodataService.getElevation(latitude - radiusDeg, longitude);
        const eastElev = await TopodataService.getElevation(latitude, longitude + radiusDeg);
        const westElev = await TopodataService.getElevation(latitude, longitude - radiusDeg);
        
        if (centerElev === null) {
            return res.status(404).json({ error: 'No elevation data available for this location' });
        }
        
        // Calculate slope in each direction (percentage)
        const slopeNorth = northElev !== null ? ((northElev - centerElev) / radiusM * 100) : null;
        const slopeSouth = southElev !== null ? ((southElev - centerElev) / radiusM * 100) : null;
        const slopeEast = eastElev !== null ? ((eastElev - centerElev) / radiusM * 100) : null;
        const slopeWest = westElev !== null ? ((westElev - centerElev) / radiusM * 100) : null;
        
        // Calculate average slope magnitude
        const slopes = [slopeNorth, slopeSouth, slopeEast, slopeWest].filter(s => s !== null) as number[];
        const avgSlope = slopes.length > 0 ? slopes.reduce((a, b) => Math.abs(a) + Math.abs(b), 0) / slopes.length : 0;
        
        // Determine slope category
        let category = 'flat';
        if (avgSlope > 45) category = 'very_steep';
        else if (avgSlope > 25) category = 'steep';
        else if (avgSlope > 15) category = 'moderate';
        else if (avgSlope > 5) category = 'gentle';
        
        return res.json({
            location: { lat: latitude, lng: longitude },
            radius_m: radiusM,
            elevations: {
                center: centerElev,
                north: northElev,
                south: southElev,
                east: eastElev,
                west: westElev
            },
            slopes_percent: {
                north: slopeNorth,
                south: slopeSouth,
                east: slopeEast,
                west: slopeWest
            },
            average_slope_percent: Math.round(avgSlope * 100) / 100,
            category,
            source: 'TOPODATA (30m)',
            suitable_for: avgSlope < 15 ? 'construction' : avgSlope < 25 ? 'caution' : 'not_recommended'
        });
    } catch (error: any) {
        logger.error('Slope calculation error', { error: error.message });
        return res.status(500).json({ error: error.message });
    }
});

if (fs.existsSync(path.join(frontendDistDirectory, 'index.html'))) {
    app.use(express.static(frontendDistDirectory));

    app.get('*', (req: Request, res: Response, next) => {
        if (req.path.startsWith('/api') || req.path.startsWith('/downloads') || req.path.startsWith('/api-docs') || req.path === '/health') {
            return next();
        }

        return res.sendFile(path.join(frontendDistDirectory, 'index.html'));
    });
}

// Global error handler - must be after all routes
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    logger.error('Unhandled error', {
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method
    });
    
    // Ensure we always send JSON for API endpoints
    if (req.path.startsWith('/api')) {
        return res.status(err.status || 500).json({
            error: err.message || 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
    
    // For non-API routes, send error page if available
    return res.status(err.status || 500).send('Internal Server Error');
});

app.listen(port, async () => {
    const baseUrl = getBaseUrl();
    logger.info('Backend online', {
        service: 'sisRUA Unified Backend',
        version: '1.2.0',
        url: baseUrl,
        port: port
    });

    // Start Firestore monitoring if in production or if USE_FIRESTORE is enabled
    if (process.env.NODE_ENV === 'production' || process.env.USE_FIRESTORE === 'true') {
        try {
            await startFirestoreMonitoring();
            logger.info('Firestore monitoring started');
        } catch (error) {
            logger.error('Failed to start Firestore monitoring', { error });
        }
    } else {
        logger.info('Firestore disabled (development mode)');
    }
});

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    stopFirestoreMonitoring();
    process.exit(0);
});

process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    stopFirestoreMonitoring();
    process.exit(0);
});
