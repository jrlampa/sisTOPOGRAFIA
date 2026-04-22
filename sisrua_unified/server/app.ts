import express, { Express, NextFunction, Request, Response } from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import swaggerUi from "swagger-ui-express";
import compression from "compression";
import { randomUUID } from "crypto";

import { config } from "./config.js";
import { OllamaService } from "./services/ollamaService.js";
import { constantsService } from "./services/constantsService.js";
import { logger } from "./utils/logger.js";
import { requestContext } from "./utils/requestContext.js";
import {
  extractCorrelationIds,
  setCorrelationResponseHeaders,
} from "./utils/correlationIds.js";
import { listCircuitBreakers } from "./utils/circuitBreaker.js";
import { generalRateLimiter } from "./middleware/rateLimiter.js";
import { requestMetrics } from "./middleware/requestMetrics.js";
import { monitoringMiddleware } from "./middleware/monitoring.js";
import { specs } from "./swagger.js";
import { errorHandler } from "./errorHandler.js";

// Import Routes
import elevationRoutes from "./routes/elevationRoutes.js";
import searchRoutes from "./routes/searchRoutes.js";
import osmRoutes from "./routes/osmRoutes.js";
import ibgeRoutes from "./routes/ibgeRoutes.js";
import indeRoutes from "./routes/indeRoutes.js";
import analysisRoutes from "./routes/analysisRoutes.js";
import constantsRoutes from "./routes/constantsRoutes.js";
import btHistoryRoutes from "./routes/btHistoryRoutes.js";
import btDerivedRoutes from "./routes/btDerivedRoutes.js";
import btCalculationRoutes from "./routes/btCalculationRoutes.js";
import dgRoutes from "./routes/dgRoutes.js";
import jobRoutes from "./routes/jobRoutes.js";
import firestoreRoutes from "./routes/firestoreRoutes.js";
import dxfRoutes from "./routes/dxfRoutes.js";
import metricsRoutes from "./routes/metricsRoutes.js";
import featureFlagRoutes from "./routes/featureFlagRoutes.js";
import quotaRoutes from "./routes/quotaRoutes.js";
import costCenterRoutes from "./routes/costCenterRoutes.js";
import businessKpiRoutes from "./routes/businessKpiRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import dataRetentionRoutes from "./routes/dataRetentionRoutes.js";
import capacityPlanningRoutes from "./routes/capacityPlanningRoutes.js";
import vulnManagementRoutes from "./routes/vulnManagementRoutes.js";
import infoClassificationRoutes from "./routes/infoClassificationRoutes.js";
import holdingRoutes from "./routes/holdingRoutes.js";
import finOpsRoutes from "./routes/finOpsRoutes.js";
import opsRoutes from "./routes/opsRoutes.js";
import storageRoutes from "./routes/storageRoutes.js";
import bdgdRoutes from "./routes/bdgdRoutes.js";
import lgpdRoutes from "./routes/lgpdRoutes.js";
import dossieRoutes from "./routes/dossieRoutes.js";
import lgpdRetencaoRoutes from "./routes/lgpdRetencaoRoutes.js";
import lgpdResidenciaRoutes from "./routes/lgpdResidenciaRoutes.js";
import sreRoutes from "./routes/sreRoutes.js";
import rastreabilidadeRoutes from "./routes/rastreabilidadeRoutes.js";
import licitacoesRoutes from "./routes/licitacoesRoutes.js";
import ollamaGovernanceRoutes from "./routes/ollamaGovernanceRoutes.js";
import releaseIntegrityRoutes from "./routes/releaseIntegrityRoutes.js";
import releaseCabRoutes from "./routes/releaseCabRoutes.js";
import serviceDeskRoutes from "./routes/serviceDeskRoutes.js";
import contractualSlaRoutes from "./routes/contractualSlaRoutes.js";
import rfpReadinessRoutes from "./routes/rfpReadinessRoutes.js";
import knowledgeBaseRoutes from "./routes/knowledgeBaseRoutes.js";
import enterpriseReadinessRoutes from "./routes/enterpriseReadinessRoutes.js";
import supplyChainRoutes from "./routes/supplyChainRoutes.js";
import predictiveObservabilityRoutes from "./routes/predictiveObservabilityRoutes.js";
import encryptionAtRestRoutes from "./routes/encryptionAtRestRoutes.js";
import auditColdStorageRoutes from "./routes/auditColdStorageRoutes.js";
import environmentPromotionRoutes from "./routes/environmentPromotionRoutes.js";
import tenantAuditExportRoutes from "./routes/tenantAuditExportRoutes.js";
import zeroTrustRoutes from "./routes/zeroTrustRoutes.js";
import blueGreenRoutes from "./routes/blueGreenRoutes.js";
import pentestRoutes from "./routes/pentestRoutes.js";
import bcpDrRoutes from "./routes/bcpDrRoutes.js";
import complianceRoutes from "./routes/complianceRoutes.js";
import identityLifecycleRoutes from "./routes/identityLifecycleRoutes.js";
import multiTenantIsolationRoutes from "./routes/multiTenantIsolationRoutes.js";
import jobIdempotencyRoutes from "./routes/jobIdempotencyRoutes.js";
import operationalRunbookRoutes from "./routes/operationalRunbookRoutes.js";
import sinapiRoutes from "./routes/sinapiRoutes.js";
import bdiRoiRoutes from "./routes/bdiRoiRoutes.js";
import lccRoutes from "./routes/lccRoutes.js";
import esgAmbientalRoutes from "./routes/esgAmbientalRoutes.js";
import vegetacaoInventarioRoutes from "./routes/vegetacaoInventarioRoutes.js";
import creditosCarbonoRoutes from "./routes/creditosCarbonoRoutes.js";
import servidoesFundiariosRoutes from "./routes/servidoesFundiariosRoutes.js";
import investorAuditRoutes from "./routes/investorAuditRoutes.js";
import perdasNaoTecnicasRoutes from "./routes/perdasNaoTecnicasRoutes.js";
import expansaoCargasRoutes from "./routes/expansaoCargasRoutes.js";
import speedDraftRoutes from "./routes/speedDraftRoutes.js";
import licencaSocialRoutes from "./routes/licencaSocialRoutes.js";
import lccFamiliaRoutes from "./routes/lccFamiliaRoutes.js";
import eivRoutes from "./routes/eivRoutes.js";
import remuneracaoRegulatoriaRoutes from "./routes/remuneracaoRegulatoriaRoutes.js";
import tcoCapexOpexRoutes from "./routes/tcoCapexOpexRoutes.js";
import servidoesFundiariasIncraRoutes from "./routes/servidoesFundiariasIncraRoutes.js";
import esgSustentabilidadeRoutes from "./routes/esgSustentabilidadeRoutes.js";
import medicaoPagamentoRoutes from "./routes/medicaoPagamentoRoutes.js";
import produtividadeTerritorialRoutes from "./routes/produtividadeTerritorialRoutes.js";
import edicaoColaborativaRoutes from "./routes/edicaoColaborativaRoutes.js";
import academyRoutes from "./routes/academyRoutes.js";
import qrRastreabilidadeRoutes from "./routes/qrRastreabilidadeRoutes.js";
import asBuiltMobileRoutes from "./routes/asBuiltMobileRoutes.js";
import lcpRoutes from "./routes/lcpRoutes.js";
import nbr9050Routes from "./routes/nbr9050Routes.js";
import sombreamento2D5Routes from "./routes/sombreamento2D5Routes.js";
import nbrCalcadasRoutes from "./routes/nbrCalcadasRoutes.js";
import teleEngenhariaArRoutes from "./routes/teleEngenhariaArRoutes.js";
import acervoGedRoutes from "./routes/acervoGedRoutes.js";
import hybridCloudRoutes from "./routes/hybridCloudRoutes.js";
import portalStakeholderRoutes from "./routes/portalStakeholderRoutes.js";
import { pingDb } from "./repositories/index.js";

// Use process.cwd() to avoid import.meta conflicts with Jest/ts-jest
const dirname = path.join(process.cwd(), "server");

const app: Express = express();

function resolveFrontendDistDirectory(): string {
  const candidates = [
    path.resolve(dirname, "../dist"),
    path.resolve(dirname, "../../dist"),
    path.resolve(dirname, "../../../dist"),
    path.resolve(process.cwd(), "dist"),
  ];
  const existing = candidates.find((c) =>
    fs.existsSync(path.join(c, "index.html")),
  );
  return existing || candidates[0];
}

const frontendDistDirectory = resolveFrontendDistDirectory();

// Middleware
const isProduction = config.NODE_ENV === "production";
let allowedOrigins: string[];
if (isProduction) {
  if (!config.CORS_ORIGIN) {
    allowedOrigins = [];
  } else {
    allowedOrigins = config.CORS_ORIGIN.split(",")
      .map((o) => o.trim())
      .filter((o) => o !== "*" && o.length > 0);
  }
} else {
  allowedOrigins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:4173",
    "http://127.0.0.1:5173",
  ];
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS policy: origin ${origin} not allowed`));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-request-id",
      "x-operation-id",
      "x-projeto-id",
      "x-point-id",
      "x-ponto-id",
    ],
  }),
);
app.use(express.json({ limit: config.BODY_LIMIT }));
app.use(compression());

// Request ID Middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const requestId = (req.headers["x-request-id"] as string) || randomUUID();
  const correlationIds = extractCorrelationIds(req);

  res.locals.requestId = requestId;
  res.locals.operation_id = correlationIds.operation_id;
  res.locals.projeto_id = correlationIds.projeto_id;
  res.locals.ponto_id = correlationIds.ponto_id;

  res.setHeader("x-request-id", requestId);
  setCorrelationResponseHeaders(res, correlationIds);

  const store = new Map();
  store.set("requestId", requestId);
  if (correlationIds.operation_id)
    store.set("operation_id", correlationIds.operation_id);
  if (correlationIds.projeto_id)
    store.set("projeto_id", correlationIds.projeto_id);
  if (correlationIds.ponto_id) store.set("ponto_id", correlationIds.ponto_id);
  if (!requestContext) {
    logger.error(
      "CRITICAL: requestContext AsyncLocalStorage is undefined - middleware bypass",
      {
        requestId,
        context: "initialization_failure",
      },
    );
    return next();
  }
  requestContext.run(store, () => next());
});

app.use(monitoringMiddleware);
app.use(requestMetrics);
app.use(generalRateLimiter);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs));

app.get("/health", async (_req: Request, res: Response) => {
  try {
    const memoryUsage = process.memoryUsage();
    const externalCircuitBreakers = listCircuitBreakers();
    const hasOpenExternalCircuit = externalCircuitBreakers.some(
      (cb) => cb.state === "OPEN",
    );

    let dbStatus = "disabled";
    if (config.useSupabaseJobs || config.useDbConstantsConfig) {
      const isAlive = await pingDb();
      dbStatus = isAlive ? "connected" : "disconnected";
    }

    const healthData = {
      status:
        dbStatus === "disconnected" || hasOpenExternalCircuit
          ? "degraded"
          : "online",
      service: "sisRUA Unified Backend",
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
        ollama: await OllamaService.getGovernanceStatus(),
        externalApis: {
          openCircuits: externalCircuitBreakers.filter(
            (cb) => cb.state === "OPEN",
          ).length,
          totalRegistered: externalCircuitBreakers.length,
        },
      },
      config: {
        environment: config.NODE_ENV,
        constantsCatalog: {
          cacheSize: Object.keys(constantsService.stats()).length,
        },
      },
    };

    const statusCode = healthData.status === "online" ? 200 : 503;
    res.status(statusCode).json(healthData);
  } catch (err: any) {
    logger.error("Health check failed", { error: err.message });
    res.status(500).json({ status: "error", error: err.message });
  }
});

// Routes
app.use("/api/elevation", elevationRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/osm", osmRoutes);
app.use("/api/ibge", ibgeRoutes);
app.use("/api/inde", indeRoutes);
app.use("/api/analyze", analysisRoutes);
app.use("/api/constants", constantsRoutes);
app.use("/api/bt-history", btHistoryRoutes);
app.use("/api/bt", btDerivedRoutes);
app.use("/api/bt", btCalculationRoutes);
app.use("/api/dg", dgRoutes);
app.use("/api/jobs", jobRoutes);
if (config.useFirestore) app.use("/api/firestore", firestoreRoutes);
app.use("/api/storage", storageRoutes);
app.use("/api/dxf", dxfRoutes);
app.use("/api/ops", opsRoutes);
app.use("/metrics", metricsRoutes);
app.use("/api/feature-flags", featureFlagRoutes);
app.use("/api/tenant-quotas", quotaRoutes);
app.use("/api/cost-centers", costCenterRoutes);
app.use("/api/business-kpi", businessKpiRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/retencao", dataRetentionRoutes);
app.use("/api/capacidade", capacityPlanningRoutes);
app.use("/api/vulns", vulnManagementRoutes);
app.use("/api/classificacao", infoClassificationRoutes);
app.use("/api/holdings", holdingRoutes);
app.use("/api/finops", finOpsRoutes);
app.use("/api/bdgd", bdgdRoutes);
app.use("/api/lgpd", lgpdRoutes);
app.use("/api/dossie", dossieRoutes);
app.use("/api/lgpd/retencao", lgpdRetencaoRoutes);
app.use("/api/lgpd/residencia", lgpdResidenciaRoutes);
app.use("/api/sre", sreRoutes);
app.use("/api/rastreabilidade", rastreabilidadeRoutes);
app.use("/api/licitacoes", licitacoesRoutes);
app.use("/api/ollama/governance", ollamaGovernanceRoutes);
app.use("/api/release", releaseIntegrityRoutes);
app.use("/api/cab", releaseCabRoutes);
app.use("/api/servicedesk", serviceDeskRoutes);
app.use("/api/sla", contractualSlaRoutes);
app.use("/api/rfp", rfpReadinessRoutes);
app.use("/api/knowledge", knowledgeBaseRoutes);
app.use("/api/enterprise", enterpriseReadinessRoutes);
app.use("/api/supply-chain", supplyChainRoutes);
app.use("/api/observability", predictiveObservabilityRoutes);
app.use("/api/encryption", encryptionAtRestRoutes);
app.use("/api/audit-cold", auditColdStorageRoutes);
app.use("/api/promotion", environmentPromotionRoutes);
app.use("/api/tenant-audit", tenantAuditExportRoutes);
app.use("/api/zero-trust", zeroTrustRoutes);
app.use("/api/blue-green", blueGreenRoutes);
app.use("/api/pentest", pentestRoutes);
app.use("/api/bcp-dr", bcpDrRoutes);
app.use("/api/compliance", complianceRoutes);
app.use("/api/identity", identityLifecycleRoutes);
app.use("/api/tenant-isolation", multiTenantIsolationRoutes);
app.use("/api/idempotency", jobIdempotencyRoutes);
app.use("/api/runbooks", operationalRunbookRoutes);
app.use("/api/sinapi", sinapiRoutes);
app.use("/api/bdi-roi", bdiRoiRoutes);
app.use("/api/lcc", lccRoutes);
app.use("/api/esg-ambiental", esgAmbientalRoutes);
app.use("/api/vegetacao-inventario", vegetacaoInventarioRoutes);
app.use("/api/creditos-carbono", creditosCarbonoRoutes);
app.use("/api/servidoes-fundiarios", servidoesFundiariosRoutes);
app.use("/api/investor-audit", investorAuditRoutes);
app.use("/api/perdas-nao-tecnicas", perdasNaoTecnicasRoutes);
app.use("/api/expansao-cargas", expansaoCargasRoutes);
app.use("/api/speed-draft", speedDraftRoutes);
app.use("/api/licenca-social", licencaSocialRoutes);
app.use("/api/lcc-familia", lccFamiliaRoutes);
app.use("/api/eiv", eivRoutes);
app.use("/api/remuneracao-regulatoria", remuneracaoRegulatoriaRoutes);
app.use("/api/tco-capex-opex", tcoCapexOpexRoutes);
app.use("/api/servidoes-incra", servidoesFundiariasIncraRoutes);
app.use("/api/esg-sustentabilidade", esgSustentabilidadeRoutes);
app.use("/api/medicao-pagamento", medicaoPagamentoRoutes);
app.use("/api/produtividade-territorial", produtividadeTerritorialRoutes);
app.use("/api/edicao-colaborativa", edicaoColaborativaRoutes);
app.use("/api/academy", academyRoutes);
app.use("/api/qr-rastreabilidade", qrRastreabilidadeRoutes);
app.use("/api/as-built", asBuiltMobileRoutes);
app.use("/api/lcp", lcpRoutes);
app.use("/api/nbr9050", nbr9050Routes);
app.use("/api/sombreamento", sombreamento2D5Routes);
app.use("/api/nbr-calcadas", nbrCalcadasRoutes);
app.use("/api/tele-engenharia", teleEngenhariaArRoutes);
app.use("/api/acervo-ged", acervoGedRoutes);
app.use("/api/hybrid-cloud", hybridCloudRoutes);
app.use("/api/portal-stakeholder", portalStakeholderRoutes);
app.use(express.static(frontendDistDirectory));
app.get("*", (_req: Request, res: Response) => {
  const indexPath = path.join(frontendDistDirectory, "index.html");
  if (fs.existsSync(indexPath)) res.sendFile(indexPath);
  else res.status(404).json({ error: "Frontend not found" });
});

app.use(errorHandler);

export default app;
