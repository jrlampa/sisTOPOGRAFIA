# 🚀 ROADMAP DE MELHORIA - 30/60/90 DIAS

**Projeto:** SisRUA Unified  
**Baseline:** 2025-01-16 (após auditoria)  

---

## 🎯 VISÃO GERAL

```
CRÍTICO (Imediato) ────┐
                        ├─→ 30 DIAS (Stabilization)
ALTO (Esta Semana) ────┤
                        ├─→ 60 DIAS (Optimization)
MÉDIO (Próx. Semana) ──┤
                        └─→ 90 DIAS (Enterprise-Ready)
```

---

## 📅 SPRINT 0 - ESTABILIZAÇÃO (0-7 DIAS)

### Day 0-1: Setup Crítico
- [ ] Executar `./setup-secrets.sh`
- [ ] Testar `docker compose up` completo
- [ ] Validar `/health` endpoint
- [ ] Rodar `npm run test:backend` com novo jest.config.js
- [ ] Documentar valores reais em `.env.example`

**Checklist de Validação:**
```bash
./setup-secrets.sh
docker compose build
docker compose up -d
sleep 10
curl http://localhost:3001/health | jq .status
npm run test:backend -- --coverage
```

**Tempo estimado:** 1 hora  
**Owner:** DevOps / Tech Lead  
**Blockers:** Nenhum (tudo automático)

---

### Day 2-3: Security Hardening (Rápido)
- [ ] **FIX:** Admin token obrigatório (server/config.ts)
  ```typescript
  ADMIN_TOKEN: z.string().min(32),  // Antes: optional()
  ```
  **Tempo:** 5 min
  
- [ ] **FIX:** Remover `unsafe-inline` CSP (server/app.ts)
  ```typescript
  "script-src": ["'self'"],  // Antes: ["'self'", "'unsafe-inline'"]
  ```
  **Tempo:** 10 min

- [ ] **AUDIT:** Verificar logger para secrets
  ```bash
  grep -r "GROQ_API_KEY\|REDIS_PASSWORD" server/
  grep -r "logger.*key\|logger.*password" server/
  ```
  **Tempo:** 15 min

**Checklist:**
- [ ] Todas as configVariáveis críticas têm z.string().min(N)
- [ ] Nenhum console.log de secrets
- [ ] CSP policy sem unsafe-*
- [ ] Admin endpoints testados (403 sem token)

**Total Sprint 0:** ~2 horas hands-on

---

## 📅 SPRINT 1 - OBSERVABILIDADE (7-30 DIAS)

### Semana 1: Logger Rotation + Monitoring
- [ ] **IMPLEMENT:** Logger Rotation (Winston)
  ```typescript
  // server/utils/logger.ts
  import DailyRotateFile from 'winston-daily-rotate-file';
  
  new DailyRotateFile({
    filename: 'logs/application-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d',
    compress: true,
  });
  ```
  
  **Tempo:** 1h
  **Benefit:** Disk usage controlado, 14 dias de retenção

- [ ] **IMPLEMENT:** Prometheus Metrics (existem placeholders)
  ```typescript
  // middleware/requestMetrics.ts - implementar collectors
  - request_duration_seconds (histogram)
  - request_total (counter)
  - dxf_generation_time (histogram)
  - python_process_timeout_total (counter)
  ```
  
  **Tempo:** 2h
  **Benefit:** Observabilidade em tempo real

- [ ] **TEST:** Load testing com wrk/k6
  ```bash
  wrk -c 10 -d 30s -t 4 http://localhost:3001/health
  ```
  
  **Tempo:** 1h
  **Benefit:** Baseline de performance

**Deliverable:** Prometheus scrape + Grafana dashboard

---

### Semana 2: Python Process Resilience
- [ ] **FIX:** Timeout global para Python processes
  ```typescript
  spawn('python3', [scriptPath], {
    timeout: config.PYTHON_PROCESS_TIMEOUT_MS,
  });
  ```
  
  **Tempo:** 1h
  **Impact:** Previne hanging requests

- [ ] **FIX:** DXF TTL adjustment (10 min → 30 min)
  ```typescript
  DXF_FILE_TTL_MS: 30 * 60 * 1_000,
  DXF_MAX_AGE_MS: 6 * 60 * 60 * 1_000,
  ```
  
  **Tempo:** 15 min
  **Impact:** Menos erros de arquivo deletado enquanto processando

- [ ] **IMPLEMENT:** Retry logic para Python failures
  ```typescript
  async function executePythonWithRetry(
    script: string,
    options: { maxRetries: 3, backoffMs: 1000 }
  ) {
    // exponential backoff
  }
  ```
  
  **Tempo:** 2h
  **Impact:** Melhor resiliência

---

### Semana 3: Rate Limiting com Redis
- [ ] **IMPLEMENT:** Distributed rate limiter (Redis store)
  ```typescript
  import RedisStore from 'rate-limit-redis';
  
  const limiter = rateLimit({
    store: new RedisStore({
      client: redisClient,
      prefix: 'rl:',
    }),
    windowMs: 15 * 60 * 1000,
    max: 100,
  });
  ```
  
  **Tempo:** 1.5h
  **Impact:** Rate limit consistente em múltiplas instâncias

- [ ] **TEST:** Verificar rate limit em cluster
  ```bash
  docker compose up -d
  docker compose exec app npm run test:backend -- rateLimiter
  ```
  
  **Tempo:** 1h

---

### Semana 4: Cobertura de Testes
- [ ] **INCREASE:** Coverage threshold 70% → 80%
  ```javascript
  // jest.config.js
  coverageThreshold: {
    branches: 80,
    functions: 85,
    lines: 85,
    statements: 85,
  }
  ```
  
  **Tempo:** Dependente (escrever testes)
  **Goal:** 5-10 novos testes para fechar gaps

- [ ] **ADD:** Test para readSecret()
  ```typescript
  describe('readSecret', () => {
    it('should read from /run/secrets/...', () => {
      // Mock file system
      const secret = readSecret("TEST_SECRET");
      expect(secret).toBe("test-value");
    });
  });
  ```
  
  **Tempo:** 1h

**Fim Sprint 1 (30 dias):**
- ✅ Logger com rotação
- ✅ Prometheus metrics
- ✅ Python process timeout
- ✅ Distributed rate limiting
- ✅ Coverage 80%+

---

## 📅 SPRINT 2 - OTIMIZAÇÃO (30-60 DIAS)

### Semana 5-6: Container Optimization
- [ ] **MIGRATE:** Node 22-bookworm → 22-alpine
  ```dockerfile
  # ANTES: 600MB
  FROM node:22-bookworm-slim
  
  # DEPOIS: 200MB
  FROM node:22-alpine
  ```
  
  **Tempo:** 2h (ajustar packages)
  **Benefit:** -400MB image size

- [ ] **ADD:** Multi-stage Python dependencies cache
  ```dockerfile
  # Cache pip packages layer separado
  FROM python:3.12-slim as python-builder
  COPY py_engine/requirements.txt .
  RUN pip install --no-cache-dir -r requirements.txt
  ```
  
  **Tempo:** 1h
  **Benefit:** Rebuild cache hits, -2 min build time

- [ ] **OPTIMIZE:** .dockerignore completeness
  ```
  py_engine/**
  !py_engine/requirements.txt
  e2e/
  coverage/
  playwright-report/
  test-results/
  ```
  
  **Tempo:** 30 min
  **Benefit:** Menor context enviado ao Docker

---

### Semana 7-8: Database Optimization
- [ ] **IMPLEMENT:** Connection pooling (já existe, mas audit)
  ```typescript
  // repositories/index.ts - verify pool settings
  const pool = new Pool({
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });
  ```
  
  **Tempo:** 1h (audit) + 2h (se mudança necessária)

- [ ] **ADD:** Query performance monitoring
  ```typescript
  // Middleware para logar queries > 100ms
  database.on('query', (query) => {
    if (query.duration > 100) {
      logger.warn('Slow query', { duration: query.duration, sql: query.string });
    }
  });
  ```
  
  **Tempo:** 1.5h
  **Benefit:** Identifica N+1 queries

- [ ] **ADD:** Database migration versioning
  ```
  migrations/
  ├── 001_initial_schema.sql
  ├── 002_add_canonical_topology.sql
  ├── 003_add_indices.sql
  └── migrations.json (track applied)
  ```
  
  **Tempo:** 3h
  **Benefit:** Production deployments mais seguros

---

### Semana 9-10: Frontend Performance
- [ ] **ADD:** Bundle analysis
  ```bash
  npm run build -- --analysis
  # Gera visualização de bundle size
  ```
  
  **Tempo:** 1h
  **Goal:** Identificar bloat (lodash, moment.js, etc)

- [ ] **IMPLEMENT:** Code splitting strategy
  ```typescript
  // vite.config.ts
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['react', 'react-dom'],
          'leaflet': ['leaflet', 'react-leaflet'],
          'charts': ['recharts'],
        }
      }
    }
  }
  ```
  
  **Tempo:** 2h
  **Benefit:** Melhor lazy loading, cache busting

---

### Semana 11-12: E2E & Load Testing
- [ ] **ADD:** Performance baseline tests (Lighthouse CI)
  ```bash
  npm run lhci
  # Ci/cd gate: FCP < 3s, LCP < 4.5s
  ```
  
  **Tempo:** 1h (setup) + 1h (tuning)

- [ ] **ADD:** k6 load testing
  ```javascript
  // tests/load.js
  import http from 'k6/http';
  export let options = {
    stages: [
      { duration: '5m', target: 50 },
      { duration: '5m', target: 100 },
      { duration: '5m', target: 0 },
    ],
  };
  ```
  
  **Tempo:** 2h
  **Benchmark Target:** 500+ concurrent users

**Fim Sprint 2 (60 dias):**
- ✅ 400MB image reduction
- ✅ Database monitoring
- ✅ Bundle analysis + code splitting
- ✅ Performance CI gate
- ✅ Load testing (500+ users)

---

## 📅 SPRINT 3 - ENTERPRISE-READY (60-90 DIAS)

### Semana 13-14: Security Hardening
- [ ] **IMPLEMENT:** SBOM (Software Bill of Materials)
  ```bash
  npm sbom --sbom-format cyclonedx --json > sbom.json
  ```
  
  **Tempo:** 1h
  **Benefit:** Compliance requirement

- [ ] **IMPLEMENT:** Secrets rotation policy
  ```bash
  # Automated secrets refresh every 30 days
  SECRETS_ROTATION_INTERVAL_DAYS=30
  ```
  
  **Tempo:** 3h
  **Benefit:** Compliance (SOC2, ISO27001)

- [ ] **AUDIT:** Penetration testing
  ```
  - OWASP Top 10 check
  - SQLi vulnerability scan
  - XSS/CSRF coverage
  ```
  
  **Tempo:** 4-8h (contractor)
  **Benefit:** Security certification

---

### Semana 15-16: Kubernetes Readiness
- [ ] **CREATE:** Deployment manifest
  ```yaml
  apiVersion: apps/v1
  kind: Deployment
  metadata:
    name: sisrua-unified
  spec:
    replicas: 3
    strategy:
      type: RollingUpdate
      rollingUpdate:
        maxSurge: 1
        maxUnavailable: 1
    template:
      spec:
        containers:
        - name: app
          image: sisrua-unified:latest
          livenessProbe:
            httpGet:
              path: /health
              port: 3001
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /health
              port: 3001
            initialDelaySeconds: 10
            periodSeconds: 5
  ```
  
  **Tempo:** 2h
  **Benefit:** Ready for K8s deployment

- [ ] **CREATE:** Helm chart
  ```bash
  helm create sisrua-unified
  # Parameterize environment, replicas, resources
  ```
  
  **Tempo:** 3h
  **Benefit:** GitOps deployment

- [ ] **TEST:** Multi-region failover
  ```
  - Primary region: active
  - Secondary region: standby
  - Automatic DNS failover
  ```
  
  **Tempo:** 4h (setup) + 2h (testing)

---

### Semana 17-18: Documentation & Runbooks
- [ ] **CREATE:** Operational Runbook
  ```
  ## Incident Response
  - Database connection loss → restart pool
  - Python worker timeout → kill process
  - Memory leak → OOM killer threshold
  
  ## Rollback Procedures
  - 1-minute rollback to previous version
  - Data migration rollback (Flyway)
  ```
  
  **Tempo:** 3h
  **Benefit:** Support team ready

- [ ] **CREATE:** Architecture Decision Records (ADRs)
  ```
  # ADR-001: Why ESM over CommonJS
  # ADR-002: Why Redis over in-memory cache
  # ADR-003: Why Docker over native
  ```
  
  **Tempo:** 2h
  **Benefit:** Future maintainability

---

### Semana 19: Final Validation
- [ ] **RUN:** Full test suite
  ```bash
  npm run test:all
  npm run security:all
  npm run coverage:policy:strict
  ```
  
  **Tempo:** 2h

- [ ] **VALIDATE:** Production readiness checklist
  ```
  - [ ] Monitoring in place (Prometheus + Grafana)
  - [ ] Alerting configured (PagerDuty)
  - [ ] Logging centralized (ELK stack)
  - [ ] Backups automated (3-2-1 rule)
  - [ ] Disaster recovery plan documented
  - [ ] SLA defined (99.9% uptime)
  - [ ] Team training completed
  ```
  
  **Tempo:** 1h review

**Fim Sprint 3 (90 dias):**
- ✅ Enterprise-grade security
- ✅ Kubernetes ready
- ✅ Multi-region failover
- ✅ Full operational documentation
- ✅ Production deployment ready

---

## 📊 PROGRESS TRACKING

### 30-Day Checkpoint
```
Complete these 5 items to green-light:
- [ ] docker compose up -d SUCCEEDS (no errors)
- [ ] npm run test:backend PASSES with new jest config
- [ ] Admin token REQUIRED (no fallback)
- [ ] Logger rotation IMPLEMENTED
- [ ] Rate limiter DISTRIBUTED (Redis)

Definition of Done: Zero critical bugs, all tests pass, monitoring in place
```

### 60-Day Checkpoint
```
Complete these 5 items to green-light:
- [ ] Node:22-alpine image SIZE < 250MB
- [ ] Database queries < 100ms (p99)
- [ ] Bundle size < 500KB (gzipped)
- [ ] Lighthouse score >= 90
- [ ] Load test PASSES (500 concurrent)

Definition of Done: Production performance baselines met
```

### 90-Day Checkpoint
```
Complete these 5 items to green-light:
- [ ] Security audit PASSED (no critical findings)
- [ ] Kubernetes manifests TESTED
- [ ] Operational runbook REVIEWED by SRE
- [ ] Team training COMPLETED (on-call rotation)
- [ ] SLA document SIGNED (99.9% uptime)

Definition of Done: Ready for enterprise deployment
```

---

## 💰 ROI ANALYSIS

### Effort vs. Benefit

| Phase | Hours | Benefit | ROI |
|-------|-------|---------|-----|
| Sprint 0 | 2h | Stability, security fix | 10x |
| Sprint 1 | 40h | Observability, resilience | 5x |
| Sprint 2 | 45h | Performance, optimization | 3x |
| Sprint 3 | 40h | Enterprise-ready, compliance | 2x |
| **Total** | **127h** | **Production-ready system** | **5x** |

**Cost Assumption:** 1 Senior Dev (R$ 150/h)
- **Investment:** 127h × R$ 150 = R$ 19,050
- **Benefit:** Zero downtime, enterprise compliance, scalability
- **Payback Period:** 1-2 months (avoided incidents)

---

## 🎯 SUCCESS METRICS

By end of 90 days:

1. **Reliability:** 99.9% uptime (measured)
2. **Performance:** P99 latency < 500ms
3. **Security:** Zero critical CVEs, SOC2 audit pass
4. **Scalability:** 1000+ concurrent users supported
5. **Maintainability:** < 1 hour incident response time

---

## 👥 TEAM ALLOCATION

```
Week 1-2:  DevOps Lead + 1 Backend Dev (40h total)
Week 3-8:  2 Backend Devs + 1 Infra Eng (80h total)
Week 9-14: 1 Backend Dev + 1 QA Eng (40h total)
Week 15+:  SRE + 1 Backend Dev (on-call prep)
```

---

## 📞 ESCALATION PATH

- **P0 (Blocker):** Tech Lead → CTO → Exec
- **P1 (High):** DevOps Lead → Tech Lead
- **P2 (Medium):** Engineer → Tech Lead (weekly)
- **P3 (Low):** Engineer backlog

---

**Document Owner:** Tech Lead  
**Last Updated:** 2025-01-16  
**Next Review:** 2025-02-16

