# PLANO DE AÇÃO - PRÓXIMAS 2 SEMANAS

**Objetivo**: Preparar projeto para produção  
**Tempo**: 14 dias (2 sprints de 1 semana cada)  
**Equipe**: Mínimo 2 devs (backend + 1 suporte)

---

## SEMANA 1: FOUNDATION (Crítico)

### DIA 1-2: ARQUITETURA (16h)

#### Tarefa 1.1: Criar Estrutura de Domínios
```bash
# Criar estrutura
mkdir -p server/domains/{geospatial,power-network,compliance,governance,shared}

# Geoespacial
mkdir -p server/domains/geospatial/{dxf-export,osm-processing,elevation-analysis}

# Power Network
mkdir -p server/domains/power-network/{bt-calculation,loss-analysis,capacity-planning}

# Compliance
mkdir -p server/domains/compliance/{lgpd,audit,nbrq}

# Governance
mkdir -p server/domains/governance/{feature-flags,rbac,secrets}

# Shared
mkdir -p server/domains/shared/{validation,logging,error-handling,middleware}
```

#### Tarefa 1.2: Mover DXF para novo local
```bash
# Mover rotas
cp server/routes/dxfRoutes.ts server/domains/geospatial/dxf-export/routes.ts

# Criar arquivo de serviço (se não existir)
touch server/domains/geospatial/dxf-export/dxfService.ts
touch server/domains/geospatial/dxf-export/dxfRepository.ts
touch server/domains/geospatial/dxf-export/dxf.schema.ts
touch server/domains/geospatial/dxf-export/dxf.types.ts

# Index.ts que agrupa tudo
touch server/domains/geospatial/dxf-export/index.ts
```

#### Tarefa 1.3: Index de Rotas Centralizado
```typescript
// server/domains/index.ts (novo)
import { Router } from 'express';
import dxfRouter from './geospatial/dxf-export/routes';
import btRouter from './power-network/bt-calculation/routes';
import lgpdRouter from './compliance/lgpd/routes';
// ... mais

export function registerDomainRoutes(app: Router) {
  app.use('/api/dxf', dxfRouter);
  app.use('/api/bt', btRouter);
  app.use('/api/compliance/lgpd', lgpdRouter);
  // ...
}

// server/app.ts (atualizar)
import { registerDomainRoutes } from './domains';
registerDomainRoutes(app);
```

**✅ Resultado**: 86 rotas agora organizadas, fácil navegação

---

### DIA 3-4: AUDITORIA (12h)

#### Tarefa 2.1: Criar Serviço de Auditoria
```typescript
// server/domains/compliance/audit/auditService.ts
import { db } from '@/server/core/database';

interface AuditEvent {
  id?: string;
  userId: string;
  action: 'READ' | 'CREATE' | 'UPDATE' | 'DELETE';
  resource: string;        // ex: 'dxf', 'customer_data'
  resourceId: string;
  oldValue?: any;
  newValue?: any;
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
  result: 'success' | 'failure';
  reason?: string;         // Por que fez esta ação?
}

export class AuditService {
  async log(event: AuditEvent) {
    return db('audit_logs').insert({
      ...event,
      timestamp: new Date(),
    });
  }

  async getUserActions(userId: string, hours: number = 24) {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return db('audit_logs')
      .where({ userId })
      .andWhere('timestamp', '>', cutoff)
      .orderBy('timestamp', 'desc');
  }

  async getResourceAccess(resource: string, resourceId: string) {
    return db('audit_logs')
      .where({ resource, resourceId })
      .orderBy('timestamp', 'desc')
      .limit(100);
  }
}

export const auditService = new AuditService();
```

#### Tarefa 2.2: Middleware de Auditoria
```typescript
// server/domains/shared/middleware/audit.ts
import { auditService } from '../compliance/audit/auditService';

export const auditMiddleware = async (req, res, next) => {
  // Capturar momento de início
  const startTime = Date.now();
  
  // Modificar res.json para capturar resposta
  const originalJson = res.json;
  res.json = function(data) {
    // Log após resposta
    auditService.log({
      userId: req.user?.id || 'anonymous',
      action: mapMethodToAction(req.method),
      resource: req.path.split('/')[2],  // ex: 'dxf'
      resourceId: req.params.id || req.body?.id || 'N/A',
      timestamp: new Date(),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      result: res.statusCode >= 400 ? 'failure' : 'success',
      newValue: req.method !== 'GET' ? data : undefined,
    });
    
    return originalJson.call(this, data);
  };
  
  next();
};

function mapMethodToAction(method: string) {
  const mapping = {
    'GET': 'READ',
    'POST': 'CREATE',
    'PUT': 'UPDATE',
    'PATCH': 'UPDATE',
    'DELETE': 'DELETE',
  };
  return mapping[method] || 'READ';
}

// Registrar no app
import { auditMiddleware } from './domains/shared/middleware/audit';
app.use('/api', auditMiddleware);
```

**✅ Resultado**: Todos acessos de dados auditados, 7 anos de retenção

---

### DIA 5: OBSERVABILIDADE - CORRELATION ID (8h)

#### Tarefa 3.1: Middleware Correlation ID
```typescript
// server/domains/shared/middleware/correlationId.ts
import { v4 as uuid } from 'uuid';

export const correlationIdMiddleware = (req, res, next) => {
  // Se cliente envia X-Request-ID, usar; senão gerar
  const requestId = req.headers['x-request-id'] || uuid();
  
  req.id = requestId;
  res.setHeader('X-Request-ID', requestId);
  
  // Adicionar ao contexto global para acesso em qualquer lugar
  res.locals.requestId = requestId;
  
  next();
};

// Registrar no app (PRIMEIRO middleware)
app.use(correlationIdMiddleware);
```

#### Tarefa 3.2: Logger com Correlation ID
```typescript
// server/domains/shared/logging/logger.ts
import winston from 'winston';
import { v4 as uuid } from 'uuid';

const logger = winston.createLogger({
  defaultMeta: { service: 'sisrua-api' },
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  ),
  transports: [
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: winston.format.json(),
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: winston.format.json(),
    }),
    new winston.transports.DailyRotateFile({
      filename: 'logs/%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      format: winston.format.json(),
    }),
  ],
});

// Helper para incluir correlation ID
export function createLogger(req?: any) {
  return {
    info: (msg: string, meta?: any) => {
      logger.info(msg, {
        requestId: req?.id,
        ...meta,
      });
    },
    error: (msg: string, meta?: any) => {
      logger.error(msg, {
        requestId: req?.id,
        ...meta,
      });
    },
    warn: (msg: string, meta?: any) => {
      logger.warn(msg, {
        requestId: req?.id,
        ...meta,
      });
    },
  };
}

// Usar em rotas
router.post('/dxf', async (req, res, next) => {
  const log = createLogger(req);
  
  log.info('DXF generation started', {
    polygon_points: req.body.polygon.length,
    utm_zone: req.body.utm_zone,
  });
  
  try {
    const result = await dxfService.generate(req.body);
    log.info('DXF generation completed', {
      file_size: result.fileSize,
      duration_ms: Date.now() - start,
    });
  } catch (err) {
    log.error('DXF generation failed', {
      error: err.message,
      stack: err.stack,
    });
    next(err);
  }
});
```

**✅ Resultado**: Request rastreável ponta a ponta

---

### DIA 6-7: PERSISTÊNCIA (20h)

#### Tarefa 4.1: Criar Migrations
```bash
# Instalar
npm install knex

# Criar arquivo de config
touch knexfile.ts

# Criar pasta
mkdir -p db/migrations

# Gerar primeira migration
npx knex migrate:make init_jobs_table
```

#### Tarefa 4.2: Escrever Migrations
```typescript
// db/migrations/20240428_init_jobs_table.ts
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('jobs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.enum('status', ['pending', 'active', 'completed', 'failed'])
      .defaultTo('pending')
      .index();
    table.jsonb('payload');
    table.text('result').nullable();
    table.text('error').nullable();
    table.integer('attempts').defaultTo(0);
    table.timestamps(true, true);
    
    // Índices para query performance
    table.index('status');
    table.index('created_at');
    table.index(['status', 'created_at']);
  });

  // Tabela de audit
  await knex.schema.createTable('audit_logs', (table) => {
    table.increments('id').primary();
    table.uuid('user_id');
    table.enum('action', ['READ', 'CREATE', 'UPDATE', 'DELETE']);
    table.string('resource');
    table.string('resource_id');
    table.jsonb('old_value').nullable();
    table.jsonb('new_value').nullable();
    table.string('ip_address');
    table.text('user_agent');
    table.timestamps(true, true);
    
    table.index(['user_id', 'created_at']);
    table.index('created_at');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('audit_logs');
  await knex.schema.dropTable('jobs');
}
```

#### Tarefa 4.3: Atualizar jobService
```typescript
// server/domains/shared/services/jobService.ts
import { db } from '@/server/core/database';

class JobService {
  async createJob(payload: any) {
    const job = {
      id: crypto.randomUUID(),
      status: 'pending',
      payload,
      created_at: new Date(),
    };
    
    // Persistir
    await db('jobs').insert(job);
    
    // Cache rápido
    await redis.setex(
      `job:${job.id}`,
      3600,
      JSON.stringify(job)
    );
    
    return job;
  }

  async getJob(jobId: string) {
    // Tenta cache primeiro
    let job = await redis.get(`job:${jobId}`);
    if (job) return JSON.parse(job);
    
    // Se não, tenta banco
    job = await db('jobs').where({ id: jobId }).first();
    if (job) {
      await redis.setex(`job:${jobId}`, 3600, JSON.stringify(job));
    }
    
    return job;
  }

  async updateJobStatus(jobId: string, status: string, result?: any) {
    await db('jobs')
      .where({ id: jobId })
      .update({
        status,
        result: result ? JSON.stringify(result) : null,
        updated_at: new Date(),
      });
    
    // Invalidar cache
    await redis.del(`job:${jobId}`);
  }
}

export const jobService = new JobService();
```

#### Tarefa 4.4: Env e Scripts
```bash
# .env
DATABASE_URL=postgresql://user:password@localhost/sisrua
USE_SUPABASE_JOBS=true

# package.json scripts
"migrate:up": "knex migrate:latest",
"migrate:down": "knex migrate:rollback",
"migrate:status": "knex migrate:status",
"migrate:make": "knex migrate:make",

# Executar before deploy
npm run migrate:status  # Verificar
npm run migrate:up      # Aplicar
```

**✅ Resultado**: Jobs persistem em Postgres, histórico preservado

---

## SEMANA 2: SOLIDIFICAÇÃO

### DIA 8-9: TESTES CONTRATO (16h)

```typescript
// server/tests/api-contracts.test.ts
import request from 'supertest';
import { app } from '@/server/app';

describe('API Contracts', () => {
  describe('POST /api/dxf', () => {
    it('should accept valid DXF request', async () => {
      const res = await request(app)
        .post('/api/dxf')
        .send({
          polygon: [
            { lat: -23.5, lon: -46.6 },
            { lat: -23.5, lon: -46.5 },
            { lat: -23.6, lon: -46.6 },
          ],
          utm_zone: 23,
        });
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('jobId');
      expect(res.body).toHaveProperty('fileUrl');
    });

    it('should reject invalid polygon', async () => {
      const res = await request(app)
        .post('/api/dxf')
        .send({
          polygon: [{ lat: 91 }],  // lat > 90
        });
      
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error.code).toBe('INVALID_COORDINATES');
    });
  });

  describe('GET /api/jobs/:id', () => {
    it('should return job status', async () => {
      const res = await request(app)
        .get('/api/jobs/job-123');
      
      expect([200, 404]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body).toHaveProperty('status');
        expect(['pending', 'active', 'completed', 'failed']).toContain(res.body.status);
      }
    });
  });
});
```

**✅ Resultado**: API contrato validado, regressão detectada automaticamente

---

### DIA 10-11: LOAD BASELINE (8h)

```javascript
// tests/load/dxf-baseline.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '2m', target: 100 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    'http_req_duration': ['p(95)<5000', 'p(99)<10000'],
    'http_req_failed': ['rate<0.1'],
  },
};

export default function () {
  const dxf = {
    polygon: [
      { lat: -23.5, lon: -46.6 },
      { lat: -23.5, lon: -46.5 },
      { lat: -23.6, lon: -46.6 },
      { lat: -23.6, lon: -46.6 },
    ],
  };

  const res = http.post('http://localhost:3001/api/dxf', JSON.stringify(dxf), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 5s': (r) => r.timings.duration < 5000,
  });

  sleep(1);
}
```

```bash
# Executar (depois de npm run dev)
npm install -g k6
k6 run tests/load/dxf-baseline.js

# Resultado será salvo em artifacts/load-baseline.json
```

**✅ Resultado**: Baseline de performance estabelecido (p95, p99, error rate)

---

### DIA 12-14: INTEGRAÇÕES (28h)

#### A. Python Error Handling
```python
# py_engine/controller.py
import sys
import json
import traceback

def main():
    try:
        # ... lógica
        print(json.dumps({
            'status': 'success',
            'result': { /* ... */ },
            'duration_ms': elapsed
        }))
        return 0
    except ValueError as e:
        sys.stderr.write(json.dumps({
            'status': 'error',
            'code': 'INVALID_INPUT',
            'message': str(e),
            'type': 'ValueError'
        }))
        return 1
    except TimeoutError:
        sys.stderr.write(json.dumps({
            'status': 'error',
            'code': 'TIMEOUT',
            'message': 'DXF generation exceeded time limit'
        }))
        return 2
    except Exception as e:
        sys.stderr.write(json.dumps({
            'status': 'error',
            'code': 'INTERNAL_ERROR',
            'message': str(e),
            'traceback': traceback.format_exc()
        }))
        return 3

if __name__ == '__main__':
    sys.exit(main())
```

#### B. Error Handler Global
```typescript
// server/domains/shared/middleware/errorHandler.ts
enum ErrorCode {
  INPUT_INVALID = 'INPUT_INVALID',
  POLYGON_TOO_LARGE = 'POLYGON_TOO_LARGE',
  DXF_GENERATION_TIMEOUT = 'DXF_GENERATION_TIMEOUT',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const code = err.code || ErrorCode.INTERNAL_ERROR;
  
  const response = {
    success: false,
    error: {
      code,
      message: err.message,
      requestId: req.id,
      timestamp: new Date().toISOString(),
    },
  };
  
  // Adicionar sugestão se possível
  if (code === ErrorCode.POLYGON_TOO_LARGE) {
    response.error.suggestion = 'Use Visvalingam-Whyatt algorithm to simplify';
  }
  
  res.status(statusCode).json(response);
});
```

#### C. Graceful Shutdown
```typescript
// server/index.ts
const gracefulShutdown = async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  
  server.close(async () => {
    try {
      // Drain queue (max 25 sec of 30 sec total)
      if (jobQueue?.drain) {
        await jobQueue.drain();
      }
      
      // Close database
      if (db?.destroy) {
        await db.destroy();
      }
      
      logger.info('Shutdown complete');
      process.exit(0);
    } catch (err) {
      logger.error('Shutdown error', { error: err });
      process.exit(1);
    }
  });
  
  // Force exit after 25s
  setTimeout(() => {
    logger.error('Graceful shutdown timeout');
    process.exit(1);
  }, 25_000);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
```

**✅ Resultado**: Production-ready, pode lidar com crashes gracefully

---

## CHECKLIST DE VALIDAÇÃO

```
Antes de ir para produção:

✅ Arquitetura reorganizada (1.1-1.3)
✅ Auditoria em place (2.1-2.2)
✅ Correlation IDs funcionando (3.1-3.2)
✅ Jobs persistindo em DB (4.1-4.4)
✅ Testes passando (semana 2)
✅ Load baseline documentado
✅ Runbook escrito
✅ On-call setup completo
✅ Backup/DR testado
✅ Monitoring + alertas configurados

Deploy seguro quando ✅ todos
```

---

**Próxima Reunião**: Sexta-feira (Semana 1), revisão do P1  
**Reunião de Go/No-Go**: Sexta-feira (Semana 2), validar tudo antes de prod

