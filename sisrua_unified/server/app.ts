import express, { Express, NextFunction, Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import swaggerUi from 'swagger-ui-express';
import compression from 'compression';
import { randomUUID } from 'crypto';
import helmet from 'helmet';

import { config } from './config.js';
import { OllamaService } from './services/ollamaService.js';
import { logger } from './utils/logger.js';
import { requestContext } from './utils/requestContext.js';
import { extractCorrelationIds, setCorrelationResponseHeaders } from './utils/correlationIds.js';
import { listCircuitBreakers } from './utils/circuitBreaker.js';
import { generalRateLimiter } from './middleware/rateLimiter.js';
import { requestMetrics } from './middleware/requestMetrics.js';
import { monitoringMiddleware } from './middleware/monitoring.js';
import { specs } from './swagger.js';
import { errorHandler } from './errorHandler.js';
import { attachSupabaseUserIfPresent, requireAdminToken } from './middleware/authGuard.js';
import { detectSuspiciousPatterns, validatePayloadRate } from './middleware/validation-enhanced.js';

// ─── Health Check Cache ────────────────────────────────────────────────
type HealthCacheEntry = {
  body: Record<string, unknown>;
  statusCode: number;
} | null;

type OllamaGovernanceStatus = Awaited<ReturnType<typeof OllamaService.getGovernanceStatus>>;
type OllamaStatusLike = Omit<Partial<OllamaGovernanceStatus>, 'runtime'> & {
  runtime?: Partial<OllamaGovernanceStatus['runtime']>;
};

let lastHealthResponse: HealthCacheEntry = null;
let lastHealthTimestamp = 0;

let cachedDbStatus = 'disabled';
let lastDbCheckTime = 0;
const DB_CHECK_CACHE_TTL = 5000; // 5 seconds (more aggressive - DB checks are typically cheap)

let lastOllamaStatus: OllamaStatusLike = { runtime: { available: false } };
let lastOllamaCheckTime = 0;
const OLLAMA_STATUS_CACHE_TTL = 15000;

/** Clear health and DB check cache (exported for testability) */
export function clearHealthCache(): void {
  lastHealthResponse = null;
  lastHealthTimestamp = 0;
  cachedDbStatus = 'disabled';
  lastDbCheckTime = 0;
  lastOllamaStatus = { runtime: { available: false } };
  lastOllamaCheckTime = 0;
}

// ─────────────────────────────────────────────────────────────────────

// Import Routes
import elevationRoutes from './routes/elevationRoutes.js';
import searchRoutes from './routes/searchRoutes.js';
import osmRoutes from './routes/osmRoutes.js';
import ibgeRoutes from './routes/ibgeRoutes.js';
import indeRoutes from './routes/indeRoutes.js';
import analysisRoutes from './routes/analysisRoutes.js';
import constantsRoutes from './routes/constantsRoutes.js';
import catalogRoutes from './routes/catalogRoutes.js';
import complianceRoutes from './routes/complianceRoutes.js';
import identityLifecycleRoutes from './routes/identityLifecycleRoutes.js';
import multiTenantIsolationRoutes from './routes/multiTenantIsolationRoutes.js';
import jobIdempotencyRoutes from './routes/jobIdempotencyRoutes.js';
import operationalRunbookRoutes from './routes/operationalRunbookRoutes.js';
import sinapiRoutes from './routes/sinapiRoutes.js';
import bdiRoiRoutes from './routes/bdiRoiRoutes.js';
import lccRoutes from './routes/lccRoutes.js';
import esgAmbientalRoutes from './routes/esgAmbientalRoutes.js';
import vegetacaoInventarioRoutes from './routes/vegetacaoInventarioRoutes.js';
import creditosCarbonoRoutes from './routes/creditosCarbonoRoutes.js';
import servidoesFundiariosRoutes from './routes/servidoesFundiariosRoutes.js';
import investorAuditRoutes from './routes/investorAuditRoutes.js';
import perdasNaoTecnicasRoutes from './routes/perdasNaoTecnicasRoutes.js';
import expansaoCargasRoutes from './routes/expansaoCargasRoutes.js';
import speedDraftRoutes from './routes/speedDraftRoutes.js';
import licencaSocialRoutes from './routes/licencaSocialRoutes.js';
import lccFamiliaRoutes from './routes/lccFamiliaRoutes.js';
import eivRoutes from './routes/eivRoutes.js';
import remuneracaoRegulatoriaRoutes from './routes/remuneracaoRegulatoriaRoutes.js';
import tcoCapexOpexRoutes from './routes/tcoCapexOpexRoutes.js';
import servidoesFundiariasIncraRoutes from './routes/servidoesFundiariasIncraRoutes.js';
import esgSustentabilidadeRoutes from './routes/esgSustentabilidadeRoutes.js';
import medicaoPagamentoRoutes from './routes/medicaoPagamentoRoutes.js';
import produtividadeTerritorialRoutes from './routes/produtividadeTerritorialRoutes.js';
import edicaoColaborativaRoutes from './routes/edicaoColaborativaRoutes.js';
import academyRoutes from './routes/academyRoutes.js';
import qrRastreabilidadeRoutes from './routes/qrRastreabilidadeRoutes.js';
import asBuiltMobileRoutes from './routes/asBuiltMobileRoutes.js';
import lcpRoutes from './routes/lcpRoutes.js';
import nbr9050Routes from './routes/nbr9050Routes.js';
import sombreamento2D5Routes from './routes/sombreamento2D5Routes.js';
import nbrCalcadasRoutes from './routes/nbrCalcadasRoutes.js';
import teleEngenhariaArRoutes from './routes/teleEngenhariaArRoutes.js';
import acervoGedRoutes from './routes/acervoGedRoutes.js';
import hybridCloudRoutes from './routes/hybridCloudRoutes.js';
import portalStakeholderRoutes from './routes/portalStakeholderRoutes.js';
import provenienciaForenseRoutes from './routes/provenienciaForenseRoutes.js';
import assinaturaNuvemRoutes from './routes/assinaturaNuvemRoutes.js';
import gisHardeningRoutes from './routes/gisHardeningRoutes.js';
import corporateHardeningRoutes from './routes/corporateHardeningRoutes.js';
import enterpriseOnboardingRoutes from './routes/enterpriseOnboardingRoutes.js';
import onPremiseRoutes from './routes/onPremiseRoutes.js';
import modelRetrocompatRoutes from './routes/modelRetrocompatRoutes.js';
import gridLegibilityRoutes from './routes/gridLegibilityRoutes.js';
import chaosRoutes from './routes/chaosRoutes.js';
import formulaVersioningRoutes from './routes/formulaVersioningRoutes.js';
import zeroTrustRoutes from './routes/zeroTrustRoutes.js';
import knowledgeBaseRoutes from './routes/knowledgeBaseRoutes.js';
import pentestRoutes from './routes/pentestRoutes.js';
import predictiveObservabilityRoutes from './routes/predictiveObservabilityRoutes.js';
import releaseCabRoutes from './routes/releaseCabRoutes.js';
import tenantAuditExportRoutes from './routes/tenantAuditExportRoutes.js';
import authRoutes from './routes/authRoutes.js';
import { billingRoutes } from './routes/billingRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import dxfRoutes from './routes/dxfRoutes.js';
import serviceDeskRoutes from './routes/serviceDeskRoutes.js';
import rfpReadinessRoutes from './routes/rfpReadinessRoutes.js';
import supplyChainRoutes from './routes/supplyChainRoutes.js';
import jobRoutes from './routes/jobRoutes.js';
import dgRoutes from './routes/dgRoutes.js';
import encryptionAtRestRoutes from './routes/encryptionAtRestRoutes.js';
import auditColdStorageRoutes from './routes/auditColdStorageRoutes.js';
import bcpDrRoutes from './routes/bcpDrRoutes.js';
import environmentPromotionRoutes from './routes/environmentPromotionRoutes.js';
import blueGreenRoutes from './routes/blueGreenRoutes.js';
import contractualSlaRoutes from './routes/contractualSlaRoutes.js';
import enterpriseReadinessRoutes from './routes/enterpriseReadinessRoutes.js';
import { initDbClient, isDbAvailable, pingDb } from './repositories/dbClient.js';

// Use process.cwd() to avoid import.meta conflicts with Jest/ts-jest
const dirname = path.join(process.cwd(), 'server');

const app: Express = express();

// Security Hardening with Helmet
app.use(
  helmet({
    hidePoweredBy: true, // Force removal of X-Powered-By
    xContentTypeOptions: true, // Force nosniff
    frameguard: {
      action: 'sameorigin', // Force SAMEORIGIN
    },
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin',
    },
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'img-src': [
          "'self'",
          'data:',
          'blob:',
          'https://*.tile.openstreetmap.org',
          'https://server.arcgisonline.com',
        ],
        'connect-src': [
          "'self'",
          'https://*.posthog.com',
          'https://*.supabase.co',
          'https://overpass-api.de',
        ],
        'script-src': ["'self'", "'unsafe-inline'"],
      },
    },
  })
);

// Explicitly remove X-Powered-By (extra layer to satisfy tests)
app.disable('x-powered-by');

function resolveFrontendDistDirectory(): string {
  const candidates = [
    path.resolve(dirname, '../dist'),
    path.resolve(dirname, '../../dist'),
    path.resolve(dirname, '../../../dist'),
    path.resolve(process.cwd(), 'dist'),
  ];
  const existing = candidates.find(c => fs.existsSync(path.join(c, 'index.html')));
  const result = existing || candidates[0];
  console.log(`[Frontend] Serving from: ${result}`);
  return result;
}

const frontendDistDirectory = resolveFrontendDistDirectory();

// Middleware
const isProduction = config.NODE_ENV === 'production';
let allowedOrigins: string[] = [];

if (isProduction) {
  allowedOrigins = config.CORS_ORIGIN ? config.CORS_ORIGIN.split(',').map(o => o.trim()) : [];
} else {
  // Em desenvolvimento, permitimos portas específicas do localhost para segurança e flexibilidade (Audit P1)
  const allowedDevPorts = ['3000', '3001', '3002', '5173'];
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      try {
        const url = new URL(origin);
        if (
          (url.hostname === 'localhost' || url.hostname === '127.0.0.1') &&
          allowedDevPorts.includes(url.port)
        ) {
          res.header('Access-Control-Allow-Origin', origin);
          res.header('Access-Control-Allow-Credentials', 'true');
          res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
          res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-request-id');
        }
      } catch (_err) {
        // Invalid origin URL
      }
    }
    next();
  });
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || isProduction === false || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS policy: origin ${origin} not allowed`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-request-id',
      'x-operation-id',
      'x-projeto-id',
      'x-point-id',
      'x-ponto-id',
    ],
  })
);

app.use(
  express.json({
    limit: config.BODY_LIMIT,
    verify: (req: Request & { rawBody?: Buffer }, _res, buf) => {
      if (req.url?.includes('/api/billing/webhook')) {
        req.rawBody = buf;
      }
    },
  })
);
app.use(compression());

// DB Wake-up Middleware - Garante que o banco comece a acordar no primeiro acesso
app.use((_req, _res, next) => {
  const dbConfigured = config.useSupabaseJobs || config.useDbConstantsConfig;
  if (dbConfigured && !isDbAvailable()) {
    // Tenta inicializar em background (não bloqueia a requisição)
    initDbClient().catch(e => logger.error('[DB] Wake-up background fail', e));
  }
  next();
});

// Request ID Middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const requestId = (req.headers['x-request-id'] as string) || randomUUID();
  const correlationIds = extractCorrelationIds(req);

  res.locals.requestId = requestId;
  res.locals.operation_id = correlationIds.operation_id;
  res.locals.projeto_id = correlationIds.projeto_id;
  res.locals.ponto_id = correlationIds.ponto_id;

  res.setHeader('x-request-id', requestId);
  setCorrelationResponseHeaders(res, correlationIds);

  const store = new Map();
  store.set('requestId', requestId);
  if (correlationIds.operation_id) store.set('operation_id', correlationIds.operation_id);
  if (correlationIds.projeto_id) store.set('projeto_id', correlationIds.projeto_id);
  if (correlationIds.ponto_id) store.set('ponto_id', correlationIds.ponto_id);

  if (!requestContext) {
    logger.error('CRITICAL: requestContext AsyncLocalStorage is undefined - middleware bypass', {
      requestId,
      context: 'initialization_failure',
    });
    return next();
  }
  requestContext.run(store, () => next());
});

app.use('/api', attachSupabaseUserIfPresent);

app.use(monitoringMiddleware);
app.use(requestMetrics);
app.use(generalRateLimiter);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// Security Hardening (Audit April 2026)
app.use('/api', detectSuspiciousPatterns);
app.use('/api', validatePayloadRate(10)); // 10MB limit for general API payloads

app.get('/health', async (_req: Request, res: Response) => {
  const now = Date.now();
  const BACKGROUND_REFRESH_THRESHOLD = 10000; // 10s
  const MAX_CACHE_AGE = 60000; // 60s

  // 1. Serve from cache if fresh enough (Stale-While-Revalidate)
  if (lastHealthResponse && now - lastHealthTimestamp < MAX_CACHE_AGE) {
    const isStale = now - lastHealthTimestamp > BACKGROUND_REFRESH_THRESHOLD;

    if (isStale) {
      // Trigger background refresh (don't await)
      performHealthCheck().catch(err => logger.debug('Background health check failed', { err }));
    }

    logger.debug('Health check served from cache', {
      isStale,
      age: now - lastHealthTimestamp,
    });
    return res.status(lastHealthResponse.statusCode).json(lastHealthResponse.body);
  }

  // 2. Perform full check if cache missing or too old
  try {
    const result = await performHealthCheck();
    res.status(result.statusCode).json(result.body);
  } catch (err) {
    logger.error('Health check failed critically', { err });
    res.status(500).json({ status: 'error', message: 'Health check failed' });
  }
});

/**
 * Isolated health check logic for both sync and background execution (Audit P1)
 */
async function performHealthCheck() {
  const startTime = Date.now();
  const memoryUsage = process.memoryUsage();
  const externalCircuitBreakers = listCircuitBreakers();
  const hasOpenExternalCircuit = externalCircuitBreakers.some(cb => cb.state === 'OPEN');

  let dbStatus = 'disabled';
  const dbStart = Date.now();
  if (config.useSupabaseJobs || config.useDbConstantsConfig) {
    // ─── Use cached DB status if fresh ──────────────────────────────
    if (Date.now() - lastDbCheckTime < DB_CHECK_CACHE_TTL) {
      dbStatus = cachedDbStatus;
    } else {
      // ─── Check DB status and cache result ────────────────────────
      const isAlive = await pingDb();
      dbStatus = isAlive ? 'connected' : 'disconnected';
      cachedDbStatus = dbStatus;
      lastDbCheckTime = Date.now();
    }
  }
  const dbTime = Date.now() - dbStart;

  // ─── Use cached Ollama status, but force a bounded sync refresh on cold/unavailable cache ──
  let ollamaStatus = lastOllamaStatus;
  const now = Date.now();
  const shouldRefreshSync =
    !lastOllamaStatus?.runtime?.available || now - lastOllamaCheckTime > OLLAMA_STATUS_CACHE_TTL;

  if (shouldRefreshSync) {
    try {
      const boundedStatus: OllamaGovernanceStatus = await Promise.race([
        OllamaService.getGovernanceStatus(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Ollama status refresh timeout')), 1500)
        ),
      ]);
      lastOllamaStatus = boundedStatus;
      lastOllamaCheckTime = Date.now();
      ollamaStatus = boundedStatus;
    } catch (err) {
      logger.debug('Synchronous Ollama status refresh failed', { err });
    }
  }

  // Background update (fire and forget - don't block on Ollama)
  OllamaService.getGovernanceStatus()
    .then((status: OllamaGovernanceStatus) => {
      lastOllamaStatus = status;
      lastOllamaCheckTime = Date.now();
    })
    .catch(err => {
      logger.debug('Background Ollama status update failed', { err });
    });

  const healthData = {
    status: dbStatus === 'disconnected' || hasOpenExternalCircuit ? 'degraded' : 'online',
    service: 'sisRUA Unified Backend',
    version: config.APP_VERSION,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    system: {
      memory: {
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
      },
      nodeVersion: process.version,
      platform: process.platform,
    },
    dependencies: {
      database: dbStatus,
      ollama: ollamaStatus,
      externalApis: {
        openCircuits: externalCircuitBreakers.filter(cb => cb.state === 'OPEN').length,
        totalRegistered: externalCircuitBreakers.length,
      },
    },
    config: {
      environment: config.NODE_ENV,
      metricsEnabled: config.METRICS_ENABLED,
      dxfCleanupIntervalMs: config.DXF_CLEANUP_INTERVAL_MS,
      constantsCatalog: {
        useDbCqt: config.useDbConstantsCqt,
        useDbClandestino: config.useDbConstantsClandestino,
        useDbConfig: config.useDbConstantsConfig,
        enabledNamespaces: [
          ...(config.useDbConstantsCqt ? ['cqt'] : []),
          ...(config.useDbConstantsClandestino ? ['clandestino'] : []),
          ...(config.useDbConstantsConfig ? ['config'] : []),
        ],
      },
    },
  };

  const statusCode = healthData.status === 'online' ? 200 : 503;
  lastHealthResponse = { body: healthData, statusCode };
  lastHealthTimestamp = Date.now();

  logger.debug('Health check completed', {
    duration: Date.now() - startTime,
    dbTime,
  });

  return lastHealthResponse;
}

// Routes
app.use('/api/elevation', elevationRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/osm', osmRoutes);
app.use('/api/ibge', ibgeRoutes);
app.use('/api/inde', indeRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/analyze', analysisRoutes); // Alias para compatibilidade com frontend que usa singular
app.use('/api/constants', constantsRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/dxf', dxfRoutes);
app.use('/api/admin', requireAdminToken, adminRoutes);
app.use('/api/service-desk', serviceDeskRoutes);
app.use('/api/rfp-readiness', rfpReadinessRoutes);
app.use('/api/supply-chain', supplyChainRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/dg', dgRoutes);
app.use('/api/encryption-at-rest', encryptionAtRestRoutes);
app.use('/api/audit-cold-storage', auditColdStorageRoutes);
app.use('/api/bcp-dr', bcpDrRoutes);
app.use('/api/environment-promotion', environmentPromotionRoutes);
app.use('/api/blue-green', blueGreenRoutes);
app.use('/api/contractual-sla', contractualSlaRoutes);
app.use('/api/enterprise-readiness', enterpriseReadinessRoutes);
app.use('/api/compliance', requireAdminToken, complianceRoutes);
app.use('/api/identity-lifecycle', requireAdminToken, identityLifecycleRoutes);
app.use('/api/multi-tenant-isolation', requireAdminToken, multiTenantIsolationRoutes);
app.use('/api/job-idempotency', requireAdminToken, jobIdempotencyRoutes);
app.use('/api/operational-runbook', requireAdminToken, operationalRunbookRoutes);
app.use('/api/sinapi', sinapiRoutes);
app.use('/api/bdi-roi', bdiRoiRoutes);
app.use('/api/lcc', lccRoutes);
app.use('/api/esg-ambiental', esgAmbientalRoutes);
app.use('/api/vegetacao-inventario', vegetacaoInventarioRoutes);
app.use('/api/creditos-carbono', creditosCarbonoRoutes);
app.use('/api/servidoes-fundiarios', servidoesFundiariosRoutes);
app.use('/api/investor-audit', requireAdminToken, investorAuditRoutes);
app.use('/api/perdas-nao-tecnicas', perdasNaoTecnicasRoutes);
app.use('/api/expansao-cargas', expansaoCargasRoutes);
app.use('/api/speed-draft', speedDraftRoutes);
app.use('/api/licenca-social', licencaSocialRoutes);
app.use('/api/lcc-familia', lccFamiliaRoutes);
app.use('/api/eiv', eivRoutes);
app.use('/api/remuneracao-regulatoria', remuneracaoRegulatoriaRoutes);
app.use('/api/tco-capex-opex', tcoCapexOpexRoutes);
app.use('/api/servidoes-fundiarias-incra', servidoesFundiariasIncraRoutes);
app.use('/api/esg-sustentabilidade', esgSustentabilidadeRoutes);
app.use('/api/medicao-pagamento', medicaoPagamentoRoutes);
app.use('/api/produtividade-territorial', produtividadeTerritorialRoutes);
app.use('/api/edicao-colaborativa', edicaoColaborativaRoutes);
app.use('/api/academy', academyRoutes);
app.use('/api/qr-rastreabilidade', qrRastreabilidadeRoutes);
app.use('/api/as-built-mobile', asBuiltMobileRoutes);
app.use('/api/lcp', lcpRoutes);
app.use('/api/nbr-9050', nbr9050Routes);
app.use('/api/sombreamento-2d5', sombreamento2D5Routes);
app.use('/api/nbr-calcadas', nbrCalcadasRoutes);
app.use('/api/tele-engenharia-ar', teleEngenhariaArRoutes);
app.use('/api/acervo-ged', acervoGedRoutes);
app.use('/api/hybrid-cloud', hybridCloudRoutes);
app.use('/api/portal-stakeholder', portalStakeholderRoutes);
app.use('/api/proveniencia-forense', requireAdminToken, provenienciaForenseRoutes);
app.use('/api/assinatura-nuvem', assinaturaNuvemRoutes);
app.use('/api/gis-hardening', requireAdminToken, gisHardeningRoutes);
app.use('/api/corporate-hardening', requireAdminToken, corporateHardeningRoutes);
app.use('/api/enterprise-onboarding', requireAdminToken, enterpriseOnboardingRoutes);
app.use('/api/on-premise', requireAdminToken, onPremiseRoutes);
app.use('/api/model-retrocompat', requireAdminToken, modelRetrocompatRoutes);
app.use('/api/grid-legibility', requireAdminToken, gridLegibilityRoutes);
app.use('/api/chaos', requireAdminToken, chaosRoutes);
app.use('/api/formula-versions', formulaVersioningRoutes);
app.use('/api/zero-trust', zeroTrustRoutes);
app.use('/api/knowledge-base', knowledgeBaseRoutes);
app.use('/api/pentest', pentestRoutes);
app.use('/api/predictive-observability', predictiveObservabilityRoutes);
app.use('/api/release-cab', releaseCabRoutes);
app.use('/api/tenant-audit-export', tenantAuditExportRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/servicedesk', serviceDeskRoutes); // Alias legado
app.use('/api/rfp', rfpReadinessRoutes); // Alias legado

// Static files
app.use(express.static(frontendDistDirectory));

// Fallback to index.html for React Router
app.get('*all', (_req: Request, res: Response) => {
  res.sendFile(path.join(frontendDistDirectory, 'index.html'));
});

// Error Handler
app.use(errorHandler);

export default app;
