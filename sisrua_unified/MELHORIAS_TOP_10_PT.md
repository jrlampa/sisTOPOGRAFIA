# RECOMENDAÇÕES DE MELHORIA - SISRUA UNIFIED

## 📌 TOP 10 PROBLEMAS E SOLUÇÕES

---

### 1. 🔴 ARQUITETURA: 86 ROTAS DESORGANIZADAS

**Problema:**
```
server/routes/ tem 86 arquivos soltos
Impossível encontrar "qual rota faz DXF?"
Sem organização por domínio de negócio
```

**Solução Proposta:**

```bash
Estrutura ANTES:
server/routes/
  ├─ dxfRoutes.ts
  ├─ btCalculationRoutes.ts
  ├─ complianceRoutes.ts
  └─ (83 mais)

Estrutura DEPOIS (Domain-Driven):
server/domains/
  ├─ geospatial/
  │  ├─ dxf-export/
  │  │  ├─ dxfRoutes.ts          (apenas rotas)
  │  │  ├─ dxfService.ts         (lógica)
  │  │  ├─ dxfRepository.ts      (dados)
  │  │  ├─ dxf.schema.ts         (validação)
  │  │  └─ dxf.types.ts          (tipos)
  │  ├─ osmProcessing/
  │  │ └─ osmService.ts
  │  └─ elevationAnalysis/
  │     └─ elevationService.ts
  │
  ├─ power-network/
  │  ├─ bt-calculation/
  │  │  ├─ btRoutes.ts
  │  │  ├─ btService.ts
  │  │  └─ btRepository.ts
  │  ├─ loss-analysis/
  │  └─ capacity-planning/
  │
  ├─ compliance/
  │  ├─ lgpd/
  │  │  ├─ lgpdRoutes.ts
  │  │  ├─ lgpdService.ts
  │  │  └─ dataRetention.ts
  │  ├─ audit/
  │  │  ├─ auditRoutes.ts
  │  │  └─ auditLog.ts
  │  └─ nbrq/
  │     └─ nbrqValidation.ts
  │
  ├─ governance/
  │  ├─ featureFlags/
  │  ├─ rbac/
  │  └─ secretsManagement/
  │
  └─ shared/
     ├─ validation/
     │  └─ commonValidators.ts
     ├─ logging/
     │  └─ structuredLogger.ts
     ├─ error-handling/
     │  └─ errorHandler.ts
     └─ middleware/
        └─ common.ts
```

**Benefício:**
- ✅ Nova dev encontra código em < 1 minuto (em vez de 20)
- ✅ Times podem trabalhar em domínios independentes
- ✅ Reutilização clara de código (shared/)
- ✅ Deploy seletivo (desativa compliance sem tocar DXF)

**Esforço: 20-30 horas** (migração)

---

### 2. 🔴 OBSERVABILIDADE: NÃO CONSEGUE DEBUGAR EM PRODUÇÃO

**Problema:**
```
Erro em produção: "DXF generation failed"
Você: "Qual request? Qual polygon? Qual Python versão?"
Logs: [stderr]... (perdido no caos)
Resultado: 2 horas procurando por 1 linha de log
```

**Solução: Observabilidade em 3 Camadas**

**Camada 1: Structured Logging (JSON)**
```typescript
// ANTES (ruim):
console.log('DXF generation started');
logger.info('DXF result: ' + JSON.stringify(result));

// DEPOIS (bom):
logger.info({
  timestamp: new Date().toISOString(),
  requestId: 'req-abc123',          // ← Correlation ID
  userId: 'user-456',
  service: 'sisrua-api',
  stage: 'dxf_generation',
  action: 'start',
  polygon_points: 1250,
  utm_zone: 23,
  environment: 'production',
  version: '0.9.0',
});

// ... depois
logger.info({
  requestId: 'req-abc123',
  stage: 'dxf_generation',
  action: 'complete',
  duration_ms: 2345,
  file_size_mb: 1.2,
  status: 'success',
  python_version: '3.11.2',
});
```

**Camada 2: Request Tracing (Correlation ID)**
```typescript
// middleware/correlationId.ts
app.use((req, res, next) => {
  const id = req.headers['x-request-id'] || crypto.randomUUID();
  req.id = id;
  res.setHeader('x-request-id', id);
  
  // Passar para Python
  req.correlationId = id;
  
  next();
});

// Quando chama Python:
execFile('python3', [
  'controller.py',
  `--request-id=${req.correlationId}`,
  `--log-level=DEBUG`
]);
```

**Camada 3: Centralized Logging**
```bash
# Instalar ELK stack ou usar CloudLogging
npm install @google-cloud/logging

// Todos os logs vão para:
// Google Cloud Logging (filtrar por request-id em segundos)

// Query em produção:
// resource.type="cloud_run_revision" AND jsonPayload.requestId="req-abc123"
// Resultado: Todos os logs daquele request em ordem cronológica
```

**Esforço: 16 horas**  
**ROI: CRÍTICO** (sem isso, production = caixa preta)

---

### 3. 🔴 SEGURANÇA: SEM AUDITORIA

**Problema:**
```
Compliance: "Quem acessou dado sensível?"
Você: "Não sabemos, não temos logs de auditoria"
Resultado: Falha em auditoria regulatória
```

**Solução: Auditoria em 3 Camadas**

**Camada 1: Access Logging**
```typescript
// middleware/auditLog.ts
app.use((req, res, next) => {
  res.on('finish', () => {
    auditService.log({
      userId: req.user?.id,
      action: `${req.method} ${req.path}`,
      resource: req.path.split('/')[2],  // ex: 'dxf', 'compliance'
      statusCode: res.statusCode,
      timestamp: new Date(),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      changes: req.body,  // Para POSTs
    });
  });
  next();
});
```

**Camada 2: Data Access Control**
```typescript
// services/auditService.ts
interface AuditEvent {
  userId: string;
  action: 'READ' | 'CREATE' | 'UPDATE' | 'DELETE';
  resource: string;
  resourceId: string;
  oldValue?: any;
  newValue?: any;
  timestamp: Date;
  reason?: string;  // Por que foi acessado?
}

await auditService.log({
  userId: 'user-123',
  action: 'READ',
  resource: 'customer_cpf',
  resourceId: 'cust-456',
  timestamp: new Date(),
});
```

**Camada 3: Retention Policy**
```typescript
// LGPD compliance
const auditRetentionDays = 2555;  // ~7 anos
const personalDataRetentionDays = 365;

// Limpeza automática:
setInterval(async () => {
  const cutoff = new Date(Date.now() - auditRetentionDays * 24 * 60 * 60 * 1000);
  await AuditLog.deleteMany({ timestamp: { $lt: cutoff } });
}, 24 * 60 * 60 * 1000);  // Diariamente
```

**Esforço: 12 horas**  
**ROI: CRÍTICO** (regulamentação + segurança)

---

### 4. 🔴 DADOS: PERDA EM RESTART

**Problema:**
```
Job iniciado: "Gerar DXF 50MB..."
Server reinicia (deploy, crash)
Job status: PERDIDO (em-memória)
Cliente: "Meu job desapareceu!"
```

**Solução: Persistência Automática**

```typescript
// ANTES (em-memória):
private jobs = new Map<string, JobStatus>();

// DEPOIS (Postgres + Redis):
USE_SUPABASE_JOBS=true
DATABASE_URL=postgresql://user:pwd@host/db

// Implementation:
class JobService {
  async createJob(payload) {
    const job = {
      id: crypto.randomUUID(),
      status: 'pending',
      payload,
      createdAt: new Date(),
    };
    
    // Persistir em Postgres
    await db('jobs').insert(job);
    
    // Cache em Redis para recuperação rápida
    await redis.set(`job:${job.id}`, JSON.stringify(job), 'EX', 3600);
    
    // Fila de trabalho
    await jobQueue.add(job);
    
    return job;
  }

  async getJobStatus(jobId) {
    // Tenta Redis primeiro (rápido)
    let job = await redis.get(`job:${jobId}`);
    if (job) return JSON.parse(job);
    
    // Se não, tenta Postgres (persistência)
    job = await db('jobs').where({ id: jobId }).first();
    if (job) {
      await redis.set(`job:${jobId}`, JSON.stringify(job), 'EX', 3600);
    }
    return job;
  }
}
```

**Benefícios:**
- ✅ Jobs sobrevivem a restart
- ✅ Histórico preservado (auditoria)
- ✅ Retry automático em falha
- ✅ Scaling para múltiplas instâncias

**Esforço: 20 horas**

---

### 5. 🟠 TESTES: COBERTURA FALSA

**Problema:**
```
Reportado: "70% coverage"
Realidade: Provavelmente 30% testando fluxo real
Maioria: Testes de mock sem integração
```

**Solução: Testes em Pirâmide Real**

```typescript
// ANTES (cobertura falsa):
describe('DXF Service', () => {
  it('should return DXF', () => {
    const mockPython = jest.mock('python-shell');
    const result = dxfService.generate({});
    expect(result).toBeDefined();  // ✅ Passa, mas não testa nada!
  });
});

// DEPOIS (testes reais):

// Level 1: Unit (80% dos testes)
describe('DXF Service - Unit', () => {
  it('should validate polygon before processing', () => {
    const invalidPolygon = [{ lat: 91 }, { lat: 90 }];  // lat > 90
    expect(() => dxfService.validate(invalidPolygon))
      .toThrow('Invalid latitude');
  });
});

// Level 2: Integration (15% dos testes)
describe('DXF Service - Integration', () => {
  it('should generate valid DXF file', async () => {
    const polygon = [
      { lat: -23.5, lon: -46.6 },
      { lat: -23.5, lon: -46.5 },
      { lat: -23.6, lon: -46.6 },
    ];
    
    // Chama Python REAL (integração)
    const dxf = await dxfService.generate(polygon);
    
    // Verifica arquivo gerado
    expect(fs.existsSync(dxf.filePath)).toBe(true);
    expect(dxf.fileSize).toBeGreaterThan(1000);
  }, 10000);  // Timeout maior
});

// Level 3: E2E (5% dos testes)
describe('DXF API - E2E', () => {
  it('should handle full request workflow', async () => {
    const response = await request(app)
      .post('/api/dxf')
      .send({
        polygon: [ /* ... */ ],
      });
    
    expect(response.status).toBe(200);
    expect(response.body.jobId).toBeDefined();
    
    // Aguardar conclusão
    await new Promise(r => setTimeout(r, 5000));
    
    // Verificar status
    const status = await request(app)
      .get(`/api/jobs/${response.body.jobId}`);
    
    expect(status.body.status).toBe('completed');
    expect(status.body.fileUrl).toBeDefined();
  });
});
```

**Métricas Recomendadas:**
- Unit: > 90% coverage
- Integration: > 50% coverage
- E2E: Todos fluxos críticos

**Esforço: 32 horas**

---

### 6. 🟠 PERFORMANCE: LIMITES DESCONHECIDOS

**Problema:**
```
❓ Quantos pontos aguenta um polígono?
❓ Quantas requisições simultâneas?
❓ Quando fica lento?
Resultado: Cliente tenta 1M pontos → server quebra
```

**Solução: Baselines + Limites**

```typescript
// 1. Definir limites
const LIMITS = {
  MAX_POLYGON_POINTS: 100_000,
  MAX_CONCURRENT_JOBS: 10,
  PYTHON_TIMEOUT_MS: 300_000,  // 5 min
  MAX_MEMORY_MB: 1024,
};

// 2. Validar entrada
router.post('/dxf', (req, res, next) => {
  if (req.body.polygon.length > LIMITS.MAX_POLYGON_POINTS) {
    return res.status(413).json({
      error: 'POLYGON_TOO_LARGE',
      message: `Max ${LIMITS.MAX_POLYGON_POINTS} points, got ${req.body.polygon.length}`,
      suggestion: 'Simplify polygon with Visvalingam-Whyatt algorithm',
    });
  }
  next();
});

// 3. Baseline com k6
// tests/load/dxf-baseline.js
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 10 },   // Warm-up
    { duration: '1m', target: 100 },   // Main load
    { duration: '30s', target: 0 },    // Cool-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<5000', 'p(99)<10000'],  // Alertar se p95 > 5s
    http_req_failed: ['rate<0.1'],      // Alertar se erro > 10%
  },
};

export default function () {
  const res = http.post('http://localhost:3001/api/dxf', {
    polygon: generateRandomPolygon(1000),
  });
  
  check(res, {
    'status ok': r => r.status === 200,
    'time < 5s': r => r.timings.duration < 5000,
  });
}

// Executar:
// k6 run tests/load/dxf-baseline.js --vus 100 --duration 2m
```

**Resultado Esperado:**
```
  ✓ p50: 800ms
  ✓ p95: 2500ms
  ✓ p99: 4200ms
  ✓ Error rate: 0.5%
```

**Esforço: 8 horas**

---

### 7. 🟠 LGPD: COMPLIANCE INCOMPLETA

**Problema:**
```
Lei: "Usuário tem direito ao esquecimento"
Você: "Como deletar dados de um usuário?"
Resposta: "Não temos API para isso"
Resultado: Multa ANPD (R$ 50M+)
```

**Solução: LGPD-First Design**

```typescript
// 1. Direito ao Esquecimento
router.delete('/users/:userId/data', async (req, res) => {
  const userId = req.params.userId;
  
  // Auditoria: quem deletou quando
  await auditLog.record({
    action: 'DELETE_USER_DATA',
    userId: req.user.id,
    targetUserId: userId,
    reason: req.body.reason,
    timestamp: new Date(),
  });
  
  // Deletar dados
  await Promise.all([
    db('jobs').where({ userId }).delete(),
    db('audit_logs').where({ userId }).delete(),
    db('customer_data').where({ userId }).delete(),
  ]);
  
  // Anonymize instead of delete (keep for analytics)
  await db('analytics').where({ userId })
    .update({ userId: 'anonymous-' + crypto.randomBytes(16).toString('hex') });
  
  res.json({ success: true, deletedAt: new Date() });
});

// 2. Consentimento Registrado
interface ConsentAudit {
  userId: string;
  type: 'MARKETING' | 'ANALYTICS' | 'DATA_PROCESSING';
  granted: boolean;
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
  version: string;  // Versão da política que aceitou
}

router.post('/users/:userId/consent', async (req, res) => {
  const { type, granted } = req.body;
  
  await db('consent_audit').insert({
    userId: req.params.userId,
    type,
    granted,
    timestamp: new Date(),
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    version: '1.0',
  });
  
  res.json({ success: true });
});

// 3. Data Portability (exportar em CSV)
router.get('/users/:userId/export', async (req, res) => {
  const userId = req.params.userId;
  
  const data = {
    profile: await db('users').where({ id: userId }).first(),
    jobs: await db('jobs').where({ userId }),
    analytics: await db('analytics').where({ userId }),
  };
  
  const csv = convertToCSV(data);
  
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=user-${userId}-export.csv`);
  res.send(csv);
});

// 4. Retention Policy
setInterval(async () => {
  // Deletar logs após 7 anos (conforme regulação)
  const cutoff = new Date(Date.now() - 7 * 365 * 24 * 60 * 60 * 1000);
  await db('audit_logs').where({ createdAt: { $lt: cutoff } }).delete();
  
  // Anonymize dados antigos (LGPD)
  await db('analytics')
    .where({ createdAt: { $lt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) } })
    .update({ userId: 'anonymous', email: null });
}, 24 * 60 * 60 * 1000);  // Diariamente
```

**Esforço: 24 horas**

---

### 8. 🟡 LOGGING: ESTRUTURADO E RASTREÁVEL

**Problema:**
```
Error em produção
Stack trace é ilegível
Não sabe em qual servidor ocorreu
Não consegue reproduzir
```

**Solução:**

```typescript
// logger.ts
import pino from 'pino';
import { v4 as uuid } from 'uuid';

const logger = pino({
  transport: {
    target: 'pino-pretty',  // dev
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
    },
  },
  base: {
    service: 'sisrua-api',
    environment: process.env.NODE_ENV,
    version: process.env.APP_VERSION,
    region: process.env.GCP_REGION,
    instance_id: process.env.HOSTNAME,
  },
});

// Usar em tudo:
logger.info({
  requestId: req.id,
  stage: 'dxf_generation_start',
  polygon_points: 1000,
  utm_zone: 23,
  timestamp: new Date().toISOString(),
});

// Em Python:
import json
import logging

handler = logging.StreamHandler()
formatter = logging.Formatter('%(message)s')
handler.setFormatter(formatter)

logger = logging.getLogger(__name__)
logger.addHandler(handler)

logger.info(json.dumps({
  "requestId": request_id,
  "stage": "dxf_generation",
  "points": 1000,
  "timestamp": datetime.now().isoformat(),
}))
```

**Esforço: 12 horas**

---

### 9. 🟡 FEATURE FLAGS: DEPLOY SEM DOWNTIME

**Problema:**
```
Quer ativar nova feature para 10% de usuários
Cria branch, testa, faz PR, merge, deploy
Tudo ou nada: 100% dos usuários pegam
Se der ruim: rollback completo
```

**Solução: Feature Flags**

```typescript
// npm install @unleash/proxy-client

const features = {
  DXF_V2_ENGINE: {
    enabled: true,
    rollout: 10,  // 10% dos usuários
  },
  COMPLIANCE_STRICT_MODE: {
    enabled: false,
  },
  LGPD_DATA_DELETION: {
    enabled: true,
    rollout: 100,
  },
};

router.post('/dxf', async (req, res) => {
  const isV2Enabled = featureFlags.isEnabled('DXF_V2_ENGINE', {
    userId: req.user.id,
    environment: 'production',
  });
  
  if (isV2Enabled) {
    // Usar novo motor
    const result = await dxfServiceV2.generate(req.body);
  } else {
    // Usar versão estável
    const result = await dxfService.generate(req.body);
  }
});
```

**Benefícios:**
- ✅ Canary deployments (10% → 50% → 100%)
- ✅ Feature toggle sem restart
- ✅ Rollback instantâneo
- ✅ A/B testing built-in

**Esforço: 20 horas**

---

### 10. 🟡 RUNBOOKS: RESOLUÇÃO RÁPIDA

**Problema:**
```
3AM: Alert "DXF timeout"
On-call entra em pânico
"O que fazer?"
30 minutos depois: Ainda não sabe
```

**Solução: Runbooks Operacionais**

```markdown
# Runbook: DXF Generation Timeout

## Alertas que Acionam
- response_time_p95 > 30s por 5 minutos
- error_rate > 5% por 5 minutos
- queue_length > 1000

## Diagnóstico Rápido (< 5 min)

### Verificar Status do Sistema
```bash
curl http://sisrua-api/health
# Resposta esperada:
# {
#   "status": "healthy",
#   "queue_length": 45,
#   "memory_usage": "512MB",
#   "python_version": "3.11.2"
# }
```

### Se Queue está alta (> 500)
```bash
# 1. Aumentar workers temporariamente
kubectl set env deploy/sisrua-worker \
  DXF_WORKER_CONCURRENCY=8 \
  (em vez de 4)

# 2. Se ainda alto, pode ser job travado
kubectl logs deploy/sisrua-worker --tail=100

# 3. Se job travado, reiniciar worker
kubectl rollout restart deploy/sisrua-worker
```

## Resolução por Cenário

### Cenário A: Memory > 80%
```bash
# 1. Check trending
kubectl top node sisrua-node-1

# 2. Se aumentando: leak de memória
# → Reiniciar pod (graceful)
kubectl rollout restart deploy/sisrua-api

# 3. Se continuar: bug real
# → Escalar: page dev lead
```

### Cenário B: Python Crashes
```bash
# Check logs Python
kubectl logs -l app=sisrua-api | grep "Traceback"

# Common issues:
# - Memory esvaziando OSM (< 100MB)
#   Solução: Limitar MAX_POLYGON_POINTS=50k
# - Timeout em query Overpass
#   Solução: Timeouts mais generosos
```

## Escalação

Se acima não resolver em 15 min:
1. Page on-call (PagerDuty)
2. Notificar tech lead
3. Considerar rollback (git revert último commit)
4. Post-mortem em 48 horas

## Links Úteis
- Grafana: https://monitoring.sisrua.internal
- Logs: https://console.cloud.google.com/logs
- PagerDuty: https://pagerduty.com/incidents
```

**Esforço: 16 horas** (para todos cenários)

---

## PRIORIZAÇÃO FINAL

```
SEMANA 1 (CRÍTICO):
  P1.1: Arquitetura (20h)
  P1.2: Auditoria (12h)
  P1.3: Observabilidade (16h)
  P1.4: Persistência (20h)
  = 68h

SEMANA 2-3 (IMPORTANTE):
  P2.1: LGPD (24h)
  P2.2: Testes (32h)
  P2.3: Performance (8h)
  P2.4: Logging (12h)
  = 76h

MÊS 2+ (FUTURO):
  P3.1: Feature Flags (20h)
  P3.2: Runbooks (16h)
  = 36h

TOTAL: 180 horas = 5-6 semanas (1 dev full-time)
```

---

**Documento criado**: 28/04/2026  
**Versão**: 1.0  
**Para**: Tech Lead + Team Leads

