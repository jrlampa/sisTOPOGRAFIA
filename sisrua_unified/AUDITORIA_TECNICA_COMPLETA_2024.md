# 🔍 AUDITORIA TÉCNICA COMPLETA - SIS RUA UNIFIED

**Data:** 2024 | **Versão do Projeto:** 0.9.0 | **Status:** ⚠️ RECOMENDAÇÕES CRÍTICAS IDENTIFICADAS

---

## 📋 RESUMO EXECUTIVO

O projeto **SIS RUA Unified** é uma arquitetura sofisticada de geoespacialização + engenharia CAD com 3 camadas (React/Vite + Node.js/Express + Python/Geospatial). A auditoria identificou **7 áreas críticas** com oportunidades de melhoria:

| Categoria | Status | Prioridade | Ação |
|-----------|--------|-----------|------|
| 🔐 Segurança | ⚠️ CRÍTICO | P0 | Corrigir exposições de rotas, validação de entrada |
| ⚡ Performance | 🟡 ALTO | P1 | Otimizar cache, async operations, conexão DB |
| 🏗️ Arquitetura | 🟢 BOM | P2 | Simplificar roteamento, reduzir combinatória |
| 🐳 DevOps | 🟡 MÉDIO | P2 | Melhorar CI/CD, multi-stage builds, secrets |
| 🧪 Testes | 🟡 MÉDIO | P2 | Aumentar cobertura, E2E assíncrono |
| 📚 Documentação | 🟢 BOM | P3 | Consolidar, reducir duplicação |
| 📦 Dependências | 🟡 MÉDIO | P1 | Atualizar packages desatualizados |

---

# 🔐 1. AUDITORIA DE SEGURANÇA E VULNERABILIDADES

## 1.1 EXPOSIÇÃO CRÍTICA: Roteamento Descontrolado

### Problema Identificado
```typescript
// server/app.ts - LÍNEA ~200+
app.use("/api/admin", adminRoutes);                    // ✅ Protegido (Token)
app.use("/api/metrics", metricsRoutes);                // ⚠️ Potencialmente exposto
app.use("/api/encryption-at-rest", encryptionAtRestRoutes);  // ❌ Sem proteção
app.use("/api/identity-lifecycle", identityLifecycleRoutes); // ❌ Sem proteção
// ... 47+ rotas sem validação clara de autorização
```

**Impacto:** Qualquer cliente pode acessar endpoints críticos (métricas, configuração, identidade).

### ✅ SOLUÇÃO RECOMENDADA

Implementar middleware de autorização baseado em token para rotas críticas:

```typescript
// server/middleware/authGuard.ts
import { Request, Response, NextFunction } from "express";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

/**
 * Middleware que protege rotas críticas com Bearer token
 * Usado para: /api/metrics, /api/admin, /api/encryption-at-rest, etc
 */
export const requireAdminToken = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  
  if (!config.ADMIN_TOKEN) {
    logger.warn("ADMIN_TOKEN not configured - endpoint is open");
    return next();
  }

  if (!token || token !== config.ADMIN_TOKEN) {
    logger.warn("Unauthorized access attempt", {
      path: req.path,
      ip: req.ip,
    });
    return res.status(403).json({ error: "Forbidden" });
  }

  next();
};

export const requireMetricsToken = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  
  if (!config.METRICS_TOKEN) {
    logger.warn("METRICS_TOKEN not configured - metrics endpoint is open");
    return next();
  }

  if (!token || token !== config.METRICS_TOKEN) {
    return res.status(403).json({ error: "Forbidden" });
  }

  next();
};
```

**Aplicação em app.ts:**
```typescript
// Proteger rotas críticas
app.use("/api/metrics", requireMetricsToken, metricsRoutes);
app.use("/api/admin", requireAdminToken, adminRoutes);
app.use("/api/encryption-at-rest", requireAdminToken, encryptionAtRestRoutes);
app.use("/api/identity-lifecycle", requireAdminToken, identityLifecycleRoutes);
app.use("/api/zero-trust", requireAdminToken, zeroTrustRoutes);
app.use("/api/pentest", requireAdminToken, pentestRoutes);
app.use("/api/compliance", requireAdminToken, complianceRoutes);
```

---

## 1.2 Validação de Entrada Insuficiente

### Problema
```typescript
// server/middleware/validation.ts
export const validators = {
  dxfRequest: [
    body("polygon").isArray(),
    body("polygon.*.lat").isFloat({ min: -90, max: 90 }),
    body("polygon.*.lon").isFloat({ min: -180, max: 180 }),
    // ❌ SEM limite de tamanho do array
    // ❌ SEM sanitização de dados numéricos
    // ❌ SEM verificação de valores duplicados
  ],
};
```

### ✅ SOLUÇÃO RECOMENDADA

Expandir validações com sanitização e limites:

```typescript
// server/middleware/validation.ts - IMPROVED
import { body, query } from "express-validator";
import { logger } from "../utils/logger.js";

export const validators = {
  dxfRequest: [
    body("polygon")
      .isArray({ min: 3, max: 1000 })
      .withMessage("Polygon must have 3-1000 points"),
    body("polygon.*.lat")
      .isFloat({ min: -90, max: 90 })
      .trim()
      .toFloat()
      .withMessage("Invalid latitude"),
    body("polygon.*.lon")
      .isFloat({ min: -180, max: 180 })
      .trim()
      .toFloat()
      .withMessage("Invalid longitude"),
    body("utm_zone")
      .optional()
      .isInt({ min: 1, max: 60 })
      .withMessage("Invalid UTM zone (1-60)"),
    body("buffer_m")
      .optional()
      .isInt({ min: 0, max: 10000 })
      .withMessage("Buffer must be 0-10km"),
    // Nova: Validar checksum/fingerprint para detectar replay attacks
    body("request_fingerprint")
      .optional()
      .isString()
      .isLength({ max: 256 })
      .withMessage("Invalid request fingerprint"),
  ],

  topology: [
    body("poles")
      .isArray({ min: 1, max: 10000 })
      .withMessage("Poles array required (1-10000 items)"),
    body("poles.*.id")
      .isString()
      .matches(/^[A-Z0-9_-]{1,50}$/)
      .withMessage("Invalid pole ID format"),
    body("edges")
      .isArray({ min: 0, max: 100000 })
      .withMessage("Edges array required (max 100000)"),
    body("edges.*.from")
      .isString()
      .matches(/^[A-Z0-9_-]{1,50}$/)
      .withMessage("Invalid edge source"),
    body("edges.*.to")
      .isString()
      .matches(/^[A-Z0-9_-]{1,50}$/)
      .withMessage("Invalid edge target"),
  ],

  fileUpload: [
    body("filename")
      .isString()
      .trim()
      .matches(/^[a-zA-Z0-9._-]{1,255}$/)
      .withMessage("Invalid filename"),
  ],
};

/**
 * Middleware para detectar padrões suspeitos de entrada
 */
export const detectSuspiciousInput = (req: any, res: any, next: any) => {
  // Rejeitar payloads muito grandes
  if (JSON.stringify(req.body).length > 50 * 1024 * 1024) {
    logger.warn("Payload exceeds 50MB", { ip: req.ip, path: req.path });
    return res.status(413).json({ error: "Payload too large" });
  }

  // Rejeitar arrays com muitos elementos
  if (req.body.polygon?.length > 1000) {
    logger.warn("Polygon has >1000 points", { ip: req.ip });
    return res.status(400).json({ error: "Polygon too complex" });
  }

  // Verificar para SQL injection patterns em strings (fallback)
  const suspiciousPatterns = ['UNION', 'SELECT', '--', '/*', '*/'];
  const bodyStr = JSON.stringify(req.body);
  if (suspiciousPatterns.some(p => bodyStr.toUpperCase().includes(p))) {
    logger.warn("Potential SQL injection attempt", { ip: req.ip });
    return res.status(400).json({ error: "Invalid input" });
  }

  next();
};
```

---

## 1.3 Secretos em Docker Compose

### Problema ✅ JÁ IMPLEMENTADO CORRETAMENTE
```yaml
# docker-compose.yml
secrets:
  groq_api_key:
    file: ./secrets/groq_api_key.txt  # ✅ Correto
  redis_password:
    file: ./secrets/redis_password.txt # ✅ Correto
```

### ⚠️ Recomendação: Criar arquivo de secrets default

```bash
# Criar secrets/groq_api_key.txt
mkdir -p secrets
echo "sk-test-PLACEHOLDER" > secrets/groq_api_key.txt
echo "test-redis-password" > secrets/redis_password.txt
chmod 600 secrets/*.txt
```

---

## 1.4 CORS Potencialmente Permissivo

### Problema
```typescript
// server/app.ts - Desenvolvimento
if (isProduction === false) {
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin?.startsWith("http://localhost:") || origin?.startsWith("http://127.0.0.1:")) {
      res.header("Access-Control-Allow-Origin", origin);  // ⚠️ Muito permissivo em dev
      res.header("Access-Control-Allow-Credentials", "true");
    }
    next();
  });
}
```

### ✅ SOLUÇÃO: Whitelist Explícita

```typescript
// server/config.ts - IMPROVEMENT
const DEV_ALLOWED_ORIGINS = [
  "http://localhost:3000",     // Vite dev server
  "http://localhost:8080",     // Frontend served
  "http://localhost:3001",     // Backend (self)
  "http://localhost:3002",     // Docker compose mapping
  "http://127.0.0.1:3000",
  "http://127.0.0.1:8080",
  "http://127.0.0.1:3001",
  "http://127.0.0.1:3002",
];

// server/app.ts - IMPROVED
const isProduction = config.NODE_ENV === "production";
const allowedOrigins = isProduction
  ? (config.CORS_ORIGIN?.split(",").map(o => o.trim()) ?? [])
  : DEV_ALLOWED_ORIGINS;

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn("CORS rejected", { origin });
        callback(new Error(`CORS policy: origin ${origin} not allowed`));
      }
    },
    credentials: true,
  }),
);
```

---

## 1.5 Helmet CSP Inadequado para Imagens

### Problema
```typescript
// server/app.ts
contentSecurityPolicy: {
  directives: {
    "img-src": [
      "'self'",
      "data:",
      "blob:",
      "https://*.tile.openstreetmap.org",
      "https://server.arcgisonline.com",
      // ❌ Wildcard em ArcGIS permite qualquer subdomínio
    ],
  },
},
```

### ✅ SOLUÇÃO: Ser Mais Específico

```typescript
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        "img-src": [
          "'self'",
          "data:",
          "blob:",
          "https://tile.openstreetmap.org",      // ✅ Específico
          "https://a.tile.openstreetmap.org",
          "https://b.tile.openstreetmap.org",
          "https://c.tile.openstreetmap.org",
          "https://server.arcgisonline.com",
          "https://services.arcgisonline.com",   // ✅ Específico
          "https://static.arcgisonline.com",
        ],
        "script-src": ["'self'"],  // ⚠️ Remover 'unsafe-inline' em produção
        "connect-src": [
          "'self'",
          "https://overpass-api.de",
          "https://api.github.com",
          config.CORS_ORIGIN ? "https://" + config.CORS_ORIGIN : undefined,
        ].filter(Boolean),
      },
    },
  }),
);
```

---

## 1.6 Logging de Dados Sensíveis

### Problema
```typescript
// Potencial: logs que expõem API keys, passwords
logger.info("User registered", { email, password: "***" });  // ❌ Password não sanitizado
```

### ✅ SOLUÇÃO: Utilitário de Sanitização

```typescript
// server/utils/sanitizer.ts
export const sanitizeForLogging = (obj: any): any => {
  const SENSITIVE_KEYS = [
    'password', 'token', 'apiKey', 'api_key', 'secret',
    'groq_api_key', 'redis_password', 'database_url',
  ];

  if (typeof obj !== 'object' || obj === null) return obj;

  const sanitized = Array.isArray(obj) ? [] : {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.some(k => key.toLowerCase().includes(k))) {
      sanitized[key] = '***REDACTED***';
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeForLogging(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
};

// Uso:
logger.error("API call failed", sanitizeForLogging(response));
```

---

## 1.7 Verificação de Versões de Dependências

### Problema: Pacotes Desatualizados

```json
{
  "dependencies": {
    "express": "^4.19.2",        // 4.x (atual: 4.21.0) ✅
    "react": "^19.2.4",          // 19.x ✅
    "postgres": "^3.4.9",        // 3.x (verificar security patches)
    "express-rate-limit": "^8.2.1" // Verificar últimas vulnerabilidades
  }
}
```

### ✅ AÇÃO: Audit Periódico

```bash
# Verificar vulnerabilidades críticas
npm audit --audit-level=critical

# Atualizar apenas patches de segurança
npm update --save

# Verificar dependências Python
pip-audit -r py_engine/requirements.txt

# Usar tools CI
npm run security:audit
npm run security:python
```

---

## 1.8 Rate Limiting - Análise Positiva

### ✅ Bem Implementado
```typescript
// server/middleware/rateLimiter.ts
- Suporta limite por IP ou User-ID
- Configurável via constantes DB
- Diferentes limites para DXF vs Análise vs Download
- Logs de violação
```

### 🔧 Melhorias Sugeridas

```typescript
// Adicionar cache distribuído (Redis) para rate limiting em múltiplos servidores
export const createRedisRateLimiter = () => {
  const redisClient = new Redis(config.REDIS_HOST);
  return rateLimit({
    store: new RedisStore({
      client: redisClient,
      prefix: "rl:",  // rate limit
    }),
    windowMs: 60 * 1000,
    limit: 100,
  });
};

// Em produção com múltiplas instâncias:
app.use(config.NODE_ENV === "production" ? createRedisRateLimiter() : generalRateLimiter);
```

---

# ⚡ 2. AUDITORIA DE PERFORMANCE E OTIMIZAÇÃO

## 2.1 Health Check com Cache Excessivo

### Problema
```typescript
// server/app.ts
const HEALTH_CACHE_TTL = 10000;  // 10 segundos
// Isso pode mascarar falhas rápidas do banco de dados
```

### ✅ SOLUÇÃO
```typescript
const HEALTH_CACHE_TTL = isProduction ? 10000 : 2000;  // 2s em dev
const DB_CHECK_CACHE_TTL = 5000;  // Verificar sempre estado crítico
```

---

## 2.2 Asyncronização de Ollama Service

### Problema
```typescript
// server/app.ts - health endpoint
app.get("/health", async (_req, res) => {
  // Aguarda estado Ollama (pode bloquear por 2+ segundos)
  const ollamaStatus = await OllamaService.getStatus();
});
```

### ✅ SOLUÇÃO: Fire-and-Forget com Cache

```typescript
// Melhorando conforme já está no código (parcialmente):
let lastOllamaStatus = { runtime: { available: false } };

// Background update (não bloqueia)
OllamaService.getGovernanceStatus()
  .then(status => {
    lastOllamaStatus = status;
  })
  .catch(err => logger.debug("Ollama update failed", err));

// Use cache para health response
const healthData = {
  // ...
  dependencies: {
    ollama: lastOllamaStatus,  // ✅ Não bloqueia
  },
};
```

---

## 2.3 Database Connection Pool - Inicialização Lazy

### Problema
```typescript
// server/app.ts
await initDbClient();  // Bloqueia startup se DB está down

// Melhor: inicializar em background
const server = app.listen(port, async () => {
  // ... já está bem aqui
  await initDbClient().catch(e => logger.error("DB init failed", e));
});
```

### ✅ RECOMENDAÇÃO: Adicionar Circuit Breaker

```typescript
// server/services/dbCircuitBreaker.ts
import CircuitBreaker from "opossum";

const dbBreaker = new CircuitBreaker(
  async () => pingDb(),
  {
    timeout: 5000,
    errorThresholdPercentage: 50,
    resetTimeout: 30000,
  }
);

export const getDbStatus = () => dbBreaker.fallback(() => "disconnected");
```

---

## 2.4 Python Process Timeout Insuficiente

### Problema
```typescript
// server/config.ts
PYTHON_PROCESS_TIMEOUT_MS: z.coerce.number().positive().default(300_000), // 5 min
```

Para DXF complexo em áreas urbanas grandes, 5 min pode ser insuficiente.

### ✅ SOLUÇÃO

```typescript
// server/config.ts
PYTHON_PROCESS_TIMEOUT_MS: z.coerce
  .number()
  .positive()
  .default(600_000),  // 10 min padrão
PYTHON_PROCESS_TIMEOUT_MAX_MS: z.coerce
  .number()
  .positive()
  .default(1_800_000), // Hard limit: 30 min

// Em routes/dxfRoutes.ts, adaptar timeout por tamanho do polígono
const estimateTimeout = (polygonArea: number): number => {
  // Heurística: 0.5 MB por segundo processamento
  const estimatedMs = Math.max(
    300_000,  // Mínimo 5 min
    Math.min(
      config.PYTHON_PROCESS_TIMEOUT_MAX_MS,
      polygonArea * 1000 / 0.5
    )
  );
  return estimatedMs;
};
```

---

## 2.5 Falta de Streaming para Grandes Datasets

### Problema
```typescript
// Supostamente em algumas rotas:
res.json(largeArray);  // ❌ Carrega tudo na memória
```

### ✅ SOLUÇÃO: Implementar Streaming

```typescript
// server/routes/dataRetentionRoutes.ts (exemplo)
app.get("/api/data-retention/export", async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Transfer-Encoding", "chunked");

  res.write("[");
  let first = true;

  for await (const item of db.streamItems()) {
    if (!first) res.write(",");
    res.write(JSON.stringify(item));
    first = false;
  }

  res.write("]");
  res.end();
});
```

---

## 2.6 Cache em Memória vs Redis

### Situação Atual
```typescript
// server/services/cacheService.ts (presumido)
// Provavelmente usa Map<string, T> em memória
```

### ✅ RECOMENDAÇÃO: Usar Redis em Produção

```typescript
// server/config.ts - adicionar
CACHE_BACKEND: z.enum(['memory', 'redis']).default('memory'),
REDIS_HOST: z.string().default('localhost'),
REDIS_PORT: z.coerce.number().default(6379),

// server/services/cacheService.ts - IMPROVED
import Redis from "redis";

export const createCacheService = () => {
  if (config.CACHE_BACKEND === 'redis') {
    const client = Redis.createClient({
      host: config.REDIS_HOST,
      port: config.REDIS_PORT,
      password: config.REDIS_PASSWORD,
    });
    return new RedisCacheService(client);
  }
  return new MemoryCacheService();  // Fallback dev
};
```

---

## 2.7 Query N+1 em Topology

### ⚠️ Potencial Problema
```typescript
// Supostamente em btCalculationRoutes:
const poles = await db.query("SELECT * FROM poles WHERE zone = $1");
for (const pole of poles) {
  const edges = await db.query("SELECT * FROM edges WHERE pole_id = $1", [pole.id]);
  // ❌ N queries adicionais
}
```

### ✅ SOLUÇÃO: Usar JOIN ou Batch Query

```typescript
// Opção 1: Join
const polesWithEdges = await db.query(`
  SELECT p.*, array_agg(e.*) as edges
  FROM poles p
  LEFT JOIN edges e ON e.pole_id = p.id
  WHERE p.zone = $1
  GROUP BY p.id
`, [zone]);

// Opção 2: Batch
const edges = await db.query(
  "SELECT * FROM edges WHERE pole_id = ANY($1)",
  [[...poles.map(p => p.id)]]
);
const edgesByPole = new Map(
  edges.map(e => [e.pole_id, e])
);
```

---

# 🏗️ 3. AUDITORIA DE ARQUITETURA E DESIGN

## 3.1 Roteamento Excessivamente Granular

### Problema: 80+ rotas montadas em app.ts

```typescript
// server/app.ts
app.use("/api/admin", adminRoutes);
app.use("/api/metrics", metricsRoutes);
app.use("/api/encryption-at-rest", encryptionAtRestRoutes);
app.use("/api/identity-lifecycle", identityLifecycleRoutes);
// ... 76 mais

// ❌ Problema: Carrega todos os 80+ routers ao startup
// ❌ Difícil documentar quais rotas existem
// ❌ Sem agrupamento lógico
```

### ✅ SOLUÇÃO: Factory Pattern com Lazy Loading

```typescript
// server/routes/index.ts
type RouteGroup = {
  path: string;
  loader: () => Promise<Router>;
  protected?: boolean;
};

const ROUTE_GROUPS: RouteGroup[] = [
  // Core
  { path: "/api/elevation", loader: () => import("./elevationRoutes.js") },
  { path: "/api/osm", loader: () => import("./osmRoutes.js") },

  // Security & Observability
  {
    path: "/api/metrics",
    loader: () => import("./metricsRoutes.js"),
    protected: true,
  },
  {
    path: "/api/admin",
    loader: () => import("./adminRoutes.js"),
    protected: true,
  },

  // Enterprise (carregadas só em produção com flag)
  ...(config.ENTERPRISE_FEATURES_ENABLED
    ? [
        {
          path: "/api/compliance",
          loader: () => import("./complianceRoutes.js"),
          protected: true,
        },
      ]
    : []),
];

export async function registerRoutes(app: Express) {
  for (const group of ROUTE_GROUPS) {
    try {
      const module = await group.loader();
      const router = module.default || module;
      
      if (group.protected) {
        app.use(group.path, requireAdminToken, router);
      } else {
        app.use(group.path, router);
      }
      
      logger.info(`Route registered: ${group.path}`);
    } catch (err) {
      logger.error(`Failed to load route ${group.path}`, err);
    }
  }
}

// server/app.ts - USAGE
const app = express();
// ... middleware setup
await registerRoutes(app);
```

---

## 3.2 Config com Muitas Derivações

### Problema
```typescript
// server/config.ts
const useSupabaseJobs = raw.USE_SUPABASE_JOBS !== undefined
  ? raw.USE_SUPABASE_JOBS === "true"
  : !!databaseUrl;  // ❌ Lógica implícita

const useFirestore = raw.USE_FIRESTORE !== undefined
  ? raw.USE_FIRESTORE === "true"
  : raw.NODE_ENV === "production" && !useSupabaseJobs;  // ❌ Interdependências
```

### ✅ SOLUÇÃO: Usar Zod Transforms

```typescript
// server/config.ts - IMPROVED
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().optional(),
  USE_FIRESTORE: z.string().optional(),
  USE_CLOUD_TASKS: z.string().optional(),
  // ...
}).transform(raw => {
  // Aplicar lógica de defaults EXPLÍCITA E CENTRALIZADA
  const databaseUrl = normalizeDatabaseUrl(raw.DATABASE_URL, raw.SUPABASE_DB_URL);
  
  const useSupabaseJobs =
    raw.USE_SUPABASE_JOBS !== undefined
      ? raw.USE_SUPABASE_JOBS === "true"
      : !!databaseUrl;

  const useFirestore =
    raw.USE_FIRESTORE !== undefined
      ? raw.USE_FIRESTORE === "true"
      : raw.NODE_ENV === "production" && !useSupabaseJobs;

  // Validações cruzadas
  if (useSupabaseJobs && !databaseUrl) {
    throw new Error(
      "USE_SUPABASE_JOBS=true requires DATABASE_URL or SUPABASE_DB_URL"
    );
  }

  if (useFirestore && !raw.GCP_PROJECT) {
    logger.warn("useFirestore=true but GCP_PROJECT not set");
  }

  return {
    ...raw,
    DATABASE_URL: databaseUrl,
    useSupabaseJobs,
    useFirestore,
    // ... outras derivadas
  };
});
```

---

## 3.3 Duplicação em Python + JS para Validação

### Problema
```typescript
// server/middleware/validation.ts
body("polygon.*.lat").isFloat({ min: -90, max: 90 })

// py_engine/main.py
assert -90 <= lat <= 90, "Invalid latitude"  // ❌ Duplicado

// py_engine/controller.py
if not (3 <= len(poles) <= 10000):  // ❌ Duplicado
  raise ValueError("Invalid poles count")
```

### ✅ SOLUÇÃO: JSON Schema Compartilhado

```yaml
# schemas/dxf-request.json
{
  "type": "object",
  "properties": {
    "polygon": {
      "type": "array",
      "minItems": 3,
      "maxItems": 1000,
      "items": {
        "type": "object",
        "properties": {
          "lat": { "type": "number", "minimum": -90, "maximum": 90 },
          "lon": { "type": "number", "minimum": -180, "maximum": 180 }
        },
        "required": ["lat", "lon"]
      }
    },
    "utm_zone": { "type": "integer", "minimum": 1, "maximum": 60 }
  },
  "required": ["polygon"]
}
```

**Uso em Node.js:**
```typescript
import Ajv from "ajv";
import schema from "../schemas/dxf-request.json";

const ajv = new Ajv();
const validateDxfRequest = ajv.compile(schema);

export const validateDxfRequest = (req: Request, res: Response, next: NextFunction) => {
  if (!validateDxfRequest(req.body)) {
    return res.status(400).json({ errors: validateDxfRequest.errors });
  }
  next();
};
```

**Uso em Python:**
```python
import jsonschema
import json

with open("../schemas/dxf-request.json") as f:
    SCHEMA = json.load(f)

def validate_dxf_request(data):
    try:
        jsonschema.validate(data, SCHEMA)
    except jsonschema.ValidationError as e:
        raise ValueError(f"Validation failed: {e.message}")
```

---

## 3.4 Falta de Versionamento de API

### Problema
```typescript
// Todas as rotas em /api/v1 implícito, sem versioning
app.use("/api/dxf", dxfRoutes);
// Se breaking change, como migrar clientes?
```

### ✅ SOLUÇÃO: API Versioning Explícito

```typescript
// server/routes/v1/index.ts
const routerV1 = Router();
routerV1.use("/dxf", dxfRoutes);
routerV1.use("/analysis", analysisRoutes);
// ... v1 routes

// server/routes/v2/index.ts (future)
const routerV2 = Router();
// ... breaking changes aqui

// server/app.ts
app.use("/api/v1", routerV1);
app.use("/api/v2", routerV2);  // Future

// Deprecation header
app.use((req, res, next) => {
  if (req.path.startsWith("/api/v1")) {
    res.setHeader("Deprecation", "true");
    res.setHeader("Sunset", new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toUTCString());
  }
  next();
});
```

---

# 🐳 4. AUDITORIA DE DEVOPS E CONTAINERIZAÇÃO

## 4.1 Multi-stage Dockerfile - ✅ BEM IMPLEMENTADO

```dockerfile
FROM node:22-bookworm AS builder  # ✅ Correto
# ... build
FROM node:22-bookworm-slim AS runner  # ✅ Slim image
# ... runtime
```

### Melhorias Sugeridas

```dockerfile
# Stage 1: Builder
FROM node:22-bookworm AS builder
WORKDIR /build
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv build-essential \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

COPY package*.json ./
RUN npm ci --prefer-offline --no-audit --omit=dev

COPY . .
RUN npm run build

# Stage 2: Python Dependencies
FROM builder AS python-builder
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r py_engine/requirements.txt

# Stage 3: Runtime (final, minimal)
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=8080 \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Security: install ca-certificates FIRST
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    python3 \
    curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# Create non-root user
RUN useradd -r -u 10000 -m appuser

WORKDIR /app

# Copy artifacts
COPY --from=builder --chown=appuser:appuser /build/dist ./dist
COPY --from=builder --chown=appuser:appuser /build/package*.json ./
COPY --from=builder --chown=appuser:appuser /build/public ./public
COPY --from=python-builder --chown=appuser:appuser /opt/venv /opt/venv
COPY --from=builder --chown=appuser:appuser /build/py_engine ./py_engine
COPY --chown=appuser:appuser docker-entrypoint.sh ./

RUN chmod +x docker-entrypoint.sh && \
    mkdir -p /app/cache /app/logs && \
    chown -R appuser:appuser /app

# Install only production dependencies
RUN npm ci --omit=dev --prefer-offline && \
    npm cache clean --force

# Verify Python
RUN /opt/venv/bin/python3 -c "import osmnx; print('✅ Python OK')"

ENV PATH="/opt/venv/bin:$PATH"
USER appuser

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD curl -fsS http://localhost:8080/health || exit 1

EXPOSE 8080

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/server/index.js"]
```

---

## 4.2 Docker Compose - Melhorias

```yaml
# docker-compose.yml - IMPROVED
version: '3.9'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
      cache_from:
        - sisrua-unified:latest  # Reusar cache
    image: sisrua-unified:dev
    container_name: sisrua-app
    ports:
      - "127.0.0.1:8080:3000"
      - "127.0.0.1:3002:3001"
    environment:
      - NODE_ENV=development
      - PORT=3001
      - PYTHON_COMMAND=python3
      - DOCKER_ENV=true
      - LOG_LEVEL=debug  # ✅ Adicionado
    secrets:
      - groq_api_key
      - redis_password
    volumes:
      - .:/app
      - /app/node_modules
      - dxf-output:/app/public/dxf
      - cache-data:/app/cache
      - logs-data:/app/logs
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s  # ✅ Adicionado
    restart: unless-stopped
    networks:
      - sisrua-network
    depends_on:
      redis:
        condition: service_healthy  # ✅ Esperar Redis
      ollama:
        condition: service_healthy
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G

  redis:
    image: redis:7.4-alpine  # ✅ Atualizado
    container_name: sisrua-redis
    command: sh -c "redis-server --requirepass $$(cat /run/secrets/redis_password) --bind 0.0.0.0"
    secrets:
      - redis_password
    ports:
      - "127.0.0.1:6379:6379"
    volumes:
      - redis-data:/data
    restart: unless-stopped
    networks:
      - sisrua-network
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M

  ollama:
    image: ollama/ollama:0.1.32
    container_name: sisrua-ollama
    environment:
      - OLLAMA_HOST=0.0.0.0:11434
    volumes:
      - ollama-data:/root/.ollama
    networks:
      - sisrua-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:11434/api/tags"]
      interval: 30s
      timeout: 10s
      retries: 5
    deploy:
      resources:
        limits:
          cpus: '4.0'
          memory: 8G
    # GPU support (uncomment se disponível)
    # deploy:
    #   resources:
    #     reservations:
    #       devices:
    #         - driver: nvidia
    #           count: all
    #           capabilities: [gpu]

secrets:
  groq_api_key:
    file: ./secrets/groq_api_key.txt
  redis_password:
    file: ./secrets/redis_password.txt

volumes:
  dxf-output:
  cache-data:
  logs-data:
  redis-data:
  ollama-data:

networks:
  sisrua-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16  # ✅ Subnet explícito
```

---

## 4.3 CI/CD - Adicionar GitHub Actions

```yaml
# .github/workflows/build-and-test.yml
name: Build & Test

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - run: npm ci
      - run: npm run lint
      
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_PASSWORD: postgres
      redis:
        image: redis:7-alpine
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - run: npm ci
      - run: npm run test
      - run: npm run test:e2e --grep @smoke

  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/build-push-action@v5
        with:
          context: .
          push: false
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

---

# 🧪 5. AUDITORIA DE TESTES E CI/CD

## 5.1 Cobertura de Testes - Análise

### Status Atual
- Frontend: Vitest + React Testing Library
- Backend: Jest (TS)
- E2E: Playwright
- **Meta:** 70% cobertura backend, 80% frontend

### ✅ Recomendações

```typescript
// server/tests/fixtures.ts - Adicionar
import { createMocks } from "node-mocks-http";
import { Router } from "express";

export const mockRequest = (overrides = {}) =>
  createMocks({
    headers: {
      "x-request-id": "test-req-123",
      "x-user-id": "test-user",
      ...overrides,
    },
  });

export const mockDb = {
  query: jest.fn(),
  ping: jest.fn().mockResolvedValue(true),
  close: jest.fn(),
};

// tests/setup.ts - Adicionar
beforeEach(() => {
  jest.clearAllMocks();
  process.env.NODE_ENV = "test";
});
```

---

## 5.2 E2E Async Handling

### Problema: Testes E2E podem timeout

```typescript
// e2e/dxf-generation.spec.ts
test("should generate DXF", async ({ page }) => {
  await page.goto("/");
  await page.fill("[data-testid=search]", "São Paulo");
  await page.click("[data-testid=generate-btn]");
  
  // ❌ Não aguarda corretamente o job completar
  await page.waitForTimeout(5000);  // Magic number!
});
```

### ✅ SOLUÇÃO

```typescript
// e2e/dxf-generation.spec.ts - IMPROVED
test("should generate DXF", async ({ page }) => {
  await page.goto("/");
  await page.fill("[data-testid=search]", "São Paulo");
  await page.click("[data-testid=generate-btn]");
  
  // Esperar por elemento com timeout configurável
  const dxfLink = page.locator("[data-testid=dxf-download]");
  await dxfLink.waitFor({ timeout: 60000 });  // 60s max
  
  // Validar resultado
  const href = await dxfLink.getAttribute("href");
  expect(href).toMatch(/\.dxf$/);
  
  // Verificar status no job tracker
  const status = await page.locator("[data-testid=job-status]").textContent();
  expect(status).toBe("completed");
});
```

---

## 5.3 Adicionar Mutation Testing

```bash
# package.json
"test:mutations": "stryker run"

# stryker.conf.mjs
export default {
  checkers: ["typescript"],
  mutate: ["server/**/*.ts", "!server/**/*.test.ts"],
  plugins: ["@stryker-mutator/typescript-checker"],
};
```

---

# 📚 6. AUDITORIA DE DOCUMENTAÇÃO E VERSIONAMENTO

## 6.1 Consolidação de Docs

**Problema:** ~40 arquivos .md duplicados

```
AUDIT_FINAL_REPORT.md
AUDIT_SESSION_6_SUMMARY.md
AUDIT_CHECKLIST_FULL.md
SECURITY_CHECKLIST.md
SECURITY_ANTIVIRUS_GUIDE.md
SECURITY_CODE_QUALITY_AUDIT.md
SECURITY_HARDENING.md
```

### ✅ SOLUÇÃO: Estrutura Clara

```
docs/
  ├── 00-README.md              # Índice único
  ├── 01-ARCHITECTURE.md        # Design
  ├── 02-SETUP.md               # Local + Docker
  ├── 03-DEVELOPMENT.md         # Dev workflow
  ├── 04-TESTING.md             # Testing strategy
  ├── 05-SECURITY.md            # Security audit
  ├── 06-PERFORMANCE.md         # Performance guide
  ├── 07-DEPLOYMENT.md          # Production checklist
  ├── 08-TROUBLESHOOTING.md     # Debug guide
  └── 09-ROADMAP.md             # Feature backlog
```

---

## 6.2 Versionamento Automático - ✅ Já Implementado

```bash
npm run version:update
npm run version:check
```

---

# 📦 7. AUDITORIA DE DEPENDÊNCIAS

## 7.1 Análise de Vulnerabilidades

```bash
# Executar
npm audit --audit-level=critical
npm run security:python
pip-audit -r py_engine/requirements.txt
```

## 7.2 Dependências Desatualizadas

| Package | Atual | Recomendado | Notas |
|---------|-------|-------------|-------|
| react | 19.2.4 | 19.2.4+ | ✅ Atualizado |
| express | 4.19.2 | 4.21.0+ | ⚠️ Verificar patches |
| postgres | 3.4.9 | 3.4.9+ | ⚠️ Verificar patches |
| osmnx | >=1.9.0 | >=1.9.0 | ✅ Atualizado |

### ✅ AÇÃO

```bash
npm update --save
pip install --upgrade -r py_engine/requirements.txt --dry-run
npm outdated  # Verificar todas as versões
```

---

# 📊 PLANO DE AÇÃO CONSOLIDADO

## P0 - CRÍTICO (Executar em 1-2 semanas)

- [ ] 1.1: Implementar middleware `requireAdminToken` para rotas sensíveis
- [ ] 1.2: Expandir validação de entrada com sanitização
- [ ] 1.4: Whitelist CORS explícita em desenvolvimento
- [ ] 1.5: Refinar CSP headers para ser mais específico
- [ ] 1.6: Criar utilitário `sanitizeForLogging`

## P1 - ALTO (2-4 semanas)

- [ ] 2.1: Otimizar cache de health check
- [ ] 2.4: Aumentar timeout padrão de Python para 10min
- [ ] 3.1: Refatorar roteamento com lazy loading
- [ ] 3.2: Usar Zod transforms para config
- [ ] 3.3: Implementar JSON Schema compartilhado
- [ ] 4.1: Melhorar multi-stage Dockerfile
- [ ] 7.2: Atualizar dependências críticas

## P2 - MÉDIO (1-2 meses)

- [ ] 3.4: Adicionar API versioning (v1/v2)
- [ ] 2.6: Migrar para Redis cache em produção
- [ ] 5.1: Aumentar cobertura de testes
- [ ] 5.3: Adicionar mutation testing
- [ ] 6.1: Consolidar documentação

## P3 - BAIXO (Roadmap futuro)

- [ ] 2.5: Implementar streaming para grandes datasets
- [ ] 2.7: Resolver N+1 queries em topology
- [ ] 4.3: Completar CI/CD GitHub Actions

---

# ✅ CHECKLIST DE IMPLEMENTAÇÃO

```bash
# Segurança
[ ] npm audit --audit-level=critical
[ ] bandit -c .bandit -r py_engine/
[ ] pip-audit -r py_engine/requirements.txt
[ ] npm run security:all

# Performance
[ ] npm run test:metrics
[ ] npm run coverage:policy

# Build & Deploy
[ ] npm run build
[ ] npm run docker:build
[ ] npm run docker:dev
[ ] npm test

# Final Validation
[ ] npm run lint
[ ] npm run typecheck:frontend
[ ] npm run typecheck:backend
[ ] npm run test:e2e
```

---

# 📋 RESUMO FINAL

| Aspecto | Status | Crítico | Ação |
|---------|--------|---------|------|
| **Segurança** | ⚠️ Médio | SIM | Implementar auth guard, sanitização |
| **Performance** | 🟡 Bom | NÃO | Otimizar cache, timeouts, query |
| **Arquitetura** | 🟢 Excelente | NÃO | Consolidar rotas, simplificar config |
| **DevOps** | 🟡 Bom | NÃO | Melhorar CI/CD, secrets |
| **Testes** | 🟡 Bom | NÃO | Aumentar cobertura, E2E async |
| **Docs** | 🟢 Bom | NÃO | Consolidar docs redundantes |
| **Deps** | 🟡 Bom | SIM | Atualizar + audit periódico |

O projeto está **bem estruturado** mas requer **ações imediatas** em segurança e validação de entrada.

---

**Próximo passo:** Implementar P0 items e fazer novo audit em 2 semanas.
