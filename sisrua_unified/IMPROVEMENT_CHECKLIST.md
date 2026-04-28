# IMPROVEMENT CHECKLIST - ACTIONABLE TASKS

## Phase 1: CRITICAL (2 weeks)

### P1.1: Job Persistence - Supabase/Postgres
- [ ] Create `.env.supabase` template with DATABASE_URL example
- [ ] Enable USE_SUPABASE_JOBS=true in config
- [ ] Test job creation/retrieval with database backend
- [ ] Run `npm run test:backend` → verify coverage doesn't drop
- [ ] Document migration from in-memory to database in ARCHITECTURE.md

**Files to Touch:**
- `server/services/jobStatusService.ts` (already has Supabase variant)
- `server/config.ts` (already configured)
- `.env.example` (add DATABASE_URL)

**Test Command:**
```bash
DATABASE_URL=postgres://... npm run test:backend
```

**Time**: 5-6 hours

---

### P1.2: Global Error Handler & Standardization
- [ ] Create `server/utils/errorHandler.ts` with error taxonomy
- [ ] Define ErrorCode enum (INPUT_INVALID, TIMEOUT, etc.)
- [ ] Wrap all route handlers with try-catch
- [ ] Add error middleware to `server/app.ts`
- [ ] Update existing error throws to use error codes
- [ ] Test error responses return consistent format

**Template:**
```typescript
// server/utils/errorHandler.ts
export enum ErrorCode {
  INPUT_INVALID = 'INPUT_INVALID',
  DXF_GENERATION_TIMEOUT = 'DXF_GENERATION_TIMEOUT',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  // ... more codes
}

export class ApiError extends Error {
  constructor(
    public code: ErrorCode,
    public statusCode: number,
    message: string,
    public context?: Record<string, unknown>
  ) {
    super(message);
  }
}

// In route:
throw new ApiError(
  ErrorCode.INPUT_INVALID,
  400,
  'Polygon must have at least 3 points',
  { provided: poly.length }
);
```

**Test Command:**
```bash
npm run test:backend -- errorHandler.test.ts
```

**Time**: 8-10 hours

---

### P1.3: Request Validation (express-validator)
- [ ] `npm install express-validator`
- [ ] Create `server/middleware/validation.ts`
- [ ] Add validators to POST endpoints (/dxf, /csv, etc.)
- [ ] Test invalid inputs return 400 with field errors
- [ ] Add max body size limits (10MB)

**Template:**
```typescript
// server/middleware/validation.ts
import { body, validationResult } from 'express-validator';

export const validateDxfRequest = [
  body('polygon').isArray().notEmpty(),
  body('polygon.*.lat').isFloat({ min: -90, max: 90 }),
  body('polygon.*.lon').isFloat({ min: -180, max: 180 }),
  body('utm_zone').optional().isInt({ min: 1, max: 60 }),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
];

// Usage:
router.post('/dxf', validateDxfRequest, generateDxf);
```

**Test Command:**
```bash
curl -X POST http://localhost:3001/api/dxf \
  -H "Content-Type: application/json" \
  -d '{"polygon":[{"lat":"invalid"}]}'
# Should return 400 with error array
```

**Time**: 6-8 hours

---

### P1.4: Graceful Shutdown (SIGTERM Handler)
- [ ] Add SIGTERM handler to `server/index.ts`
- [ ] Drain job queue before exit (max 25 seconds)
- [ ] Close database connections
- [ ] Test by sending SIGTERM to running process

**Template:**
```typescript
// server/index.ts
const gracefulShutdown = async () => {
  console.log('[sisrua] SIGTERM received, shutting down gracefully...');
  
  server.close(async () => {
    try {
      // Stop accepting new connections
      console.log('[sisrua] HTTP server closed');
      
      // Drain in-flight jobs (for Cloud Run: max 25s of 30s total)
      if (typeof jobQueue?.drain === 'function') {
        await jobQueue.drain();
        console.log('[sisrua] Job queue drained');
      }
      
      // Close database if applicable
      if (typeof db?.close === 'function') {
        await db.close();
      }
      
      process.exit(0);
    } catch (err) {
      console.error('[sisrua] Error during shutdown:', err);
      process.exit(1);
    }
  });
  
  // Force exit after 25 seconds (Cloud Run timeout is 30s)
  setTimeout(() => {
    console.error('[sisrua] Graceful shutdown timeout, force exiting');
    process.exit(1);
  }, 25_000);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
```

**Test Command:**
```bash
npm run dev &
sleep 2
kill -TERM <PID>
# Should see "SIGTERM received" and clean exit
```

**Time**: 3-4 hours

---

### P1.5: Correlation IDs
- [ ] Create `server/middleware/correlationId.ts`
- [ ] Add middleware to all routes
- [ ] Pass to Python subprocess via --request-id flag
- [ ] Include in all log statements

**Template:**
```typescript
// server/middleware/correlationId.ts
import { randomUUID } from 'crypto';

export const correlationIdMiddleware = (req, res, next) => {
  const id = req.headers['x-request-id'] || randomUUID();
  req.id = id;
  res.setHeader('x-request-id', id);
  res.locals.requestId = id;
  next();
};

// In Python spawn:
execFile('python3', [
  'py_engine/controller.py',
  `--request-id=${req.id}`,
  // ...
]);
```

**Test Command:**
```bash
curl -X POST http://localhost:3001/api/dxf \
  -H "X-Request-ID: test-123"
# Response should include: x-request-id: test-123
```

**Time**: 2-3 hours

---

**Phase 1 Total**: ~24-31 hours (1 developer, 3 weeks at 50%)

---

## Phase 2: IMPORTANT (4 weeks)

### P2.1: Structured Logging

**Frontend:**
- [ ] Add winston to frontend (via Vite plugin or external service)
- [ ] Log important app events (navigation, errors, performance)
- [ ] Send to backend logging endpoint

**Backend:**
- [ ] Verify winston daily-rotate is working
- [ ] Add correlation ID to all log statements
- [ ] Format logs as JSON for parsing

**Python:**
- [ ] `pip install python-json-logger`
- [ ] Configure JSON logging in all modules
- [ ] Include stage, duration, status in every log

**Template (Python):**
```python
# py_engine/utils/logger.py
import logging
import json
from pythonjsonlogger import jsonlogger

logger = logging.getLogger(__name__)
handler = logging.StreamHandler()
formatter = jsonlogger.JsonFormatter()
handler.setFormatter(formatter)
logger.addHandler(handler)
logger.setLevel(logging.INFO)

# Usage:
logger.info(json.dumps({
  'stage': 'dxf_generation',
  'action': 'start',
  'polygon_points': len(polygon),
  'utm_zone': utm_zone
}))
```

**Test Command:**
```bash
npm run server 2>&1 | grep '{"stage"'
```

**Time**: 15-20 hours

---

### P2.2: Database Migrations

- [ ] `npm install knex`
- [ ] Create migration directory: `db/migrations/`
- [ ] Write initial schema migration (job, task, cache tables)
- [ ] Add npm scripts: `migrate:up`, `migrate:down`, `migrate:status`
- [ ] Test migration creates schema correctly

**Template:**
```typescript
// knexfile.ts
export default {
  development: {
    client: 'postgres',
    connection: process.env.DATABASE_URL,
    migrations: { directory: './db/migrations' },
  },
};

// npm scripts in package.json:
"migrate:up": "knex migrate:latest",
"migrate:down": "knex migrate:rollback",
"migrate:status": "knex migrate:status",
```

**First Migration:**
```typescript
// db/migrations/001_init.ts
export async function up(knex) {
  return knex.schema
    .createTable('jobs', (t) => {
      t.uuid('id').primary();
      t.enum('status', ['pending', 'active', 'completed', 'failed']);
      t.jsonb('payload');
      t.timestamps(true, true);
      t.index('status');
      t.index('created_at');
    });
}

export async function down(knex) {
  return knex.schema.dropTable('jobs');
}
```

**Time**: 10-15 hours

---

### P2.3: Post-Deploy Smoke Tests

- [ ] Create `scripts/smoke-test.sh`
- [ ] Check /health endpoint
- [ ] Verify database connectivity
- [ ] Test one DXF generation
- [ ] Add to GitHub Actions workflow

**Template:**
```bash
#!/bin/bash
set -e

ENDPOINT=${1:-http://localhost:8080}
echo "Running smoke tests against $ENDPOINT..."

# Health check
echo "✓ Health check..."
curl -f "$ENDPOINT/health" || exit 1

# API connectivity
echo "✓ API connectivity..."
curl -f "$ENDPOINT/api/jobs" || exit 1

# Sample DXF generation (10-point square)
echo "✓ DXF generation..."
curl -X POST "$ENDPOINT/api/dxf" \
  -H "Content-Type: application/json" \
  -d '{
    "polygon": [
      {"lat": 0, "lon": 0},
      {"lat": 0, "lon": 1},
      {"lat": 1, "lon": 1},
      {"lat": 1, "lon": 0}
    ]
  }' || exit 1

echo "✅ All smoke tests passed"
```

**Add to GitHub Actions:**
```yaml
# .github/workflows/deploy-cloud-run.yml
- name: Run post-deploy smoke tests
  run: |
    bash scripts/smoke-test.sh ${{ env.CLOUD_RUN_URL }}
```

**Time**: 5-8 hours

---

### P2.4: Improve Python Error Handling

- [ ] Wrap main() in try-except
- [ ] Return proper exit codes (0=success, 1=error)
- [ ] Capture and log all exceptions
- [ ] Include error context in stderr

**Template:**
```python
# py_engine/controller.py
import sys
import json

def main():
  try:
    # ... existing logic
    result = generate_dxf(polygon, utm_zone)
    print(json.dumps(result))
    return 0
  except ValueError as e:
    logger.error(json.dumps({
      'error': 'invalid_input',
      'message': str(e),
      'type': type(e).__name__
    }))
    sys.exit(1)
  except TimeoutError as e:
    logger.error(json.dumps({
      'error': 'timeout',
      'message': 'DXF generation exceeded time limit',
    }))
    sys.exit(2)
  except Exception as e:
    logger.error(json.dumps({
      'error': 'internal',
      'message': str(e),
      'type': type(e).__name__,
      'traceback': traceback.format_exc()
    }))
    sys.exit(3)

if __name__ == '__main__':
  sys.exit(main())
```

**Time**: 8-10 hours

---

**Phase 2 Total**: ~51-73 hours (1 developer, 4 weeks at 50%)

---

## Phase 3: QUALITY (6 weeks)

### P3.1: Type Coverage > 95%
- [ ] Run `npm run typecheck:backend`
- [ ] Find all `any` types: `grep -r ": any" server/`
- [ ] Add proper types to each file
- [ ] Add pre-commit hook to prevent new `any`

**High-impact Files (most any types):**
- `server/routes/*.ts` (Express types)
- `server/services/*.ts` (generic service methods)
- `src/App.tsx` (React component props)

**Time**: 20-25 hours

---

### P3.2: Add Contract Testing
- [ ] `npm install --save-dev jest-openapi`
- [ ] Create test file: `server/tests/api-contracts.test.ts`
- [ ] Define expected API schemas in OpenAPI
- [ ] Test requests conform to schema

**Template:**
```typescript
// server/tests/api-contracts.test.ts
import { validateRequestAgainstSchema } from 'jest-openapi';

describe('API Contracts', () => {
  it('POST /dxf response matches schema', async () => {
    const response = await request(app)
      .post('/api/dxf')
      .send({
        polygon: [{ lat: 0, lon: 0 }],
      });
    
    // Validate response against OpenAPI schema
    expect(response).toSatisfyApiContract();
  });
});
```

**Time**: 15-20 hours

---

### P3.3: Load Testing Baseline (k6)
- [ ] `npm install -g k6`
- [ ] Create `tests/load/dxf.js`
- [ ] Define baseline: 100 concurrent requests
- [ ] Record p95, p99 response times
- [ ] Save results to `artifacts/load-test-baseline.json`

**Template:**
```javascript
// tests/load/dxf.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 },   // Ramp up
    { duration: '1m30s', target: 100 }, // Hold
    { duration: '30s', target: 0 },    // Ramp down
  ],
};

export default function () {
  const payload = JSON.stringify({
    polygon: [
      { lat: 0, lon: 0 },
      { lat: 0, lon: 1 },
      { lat: 1, lon: 1 },
      { lat: 1, lon: 0 },
    ],
  });

  const res = http.post(
    'http://localhost:3001/api/dxf',
    payload,
    { headers: { 'Content-Type': 'application/json' } }
  );

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 5s': (r) => r.timings.duration < 5000,
  });

  sleep(1);
}
```

**Run:**
```bash
npm run dev &
sleep 2
k6 run tests/load/dxf.js
```

**Time**: 10-15 hours

---

### P3.4: Accessibility Audit (WCAG 2.1 AA)
- [ ] Run full a11y test: `npm run test:a11y`
- [ ] Use WAVE browser extension
- [ ] Check color contrast (4.5:1 for normal text)
- [ ] Verify keyboard navigation
- [ ] Test with screen reader

**Automated Checks:**
```bash
npm install --save-dev axe-playwright

# Run in test:
npx playwright test e2e/a11y-full.spec.ts
```

**Manual Checks Needed:**
- [ ] Zoom to 200% → no overflow
- [ ] Tab through entire app → all interactive elements reachable
- [ ] Test with NVDA/JAWS screen reader
- [ ] Verify link text is descriptive

**Time**: 20-30 hours

---

**Phase 3 Total**: ~65-90 hours (split 2 devs, 6 weeks)

---

## QUICK WINS (Do These Today)

### 1. Add .env.example (5 min)
```bash
cp .env .env.example
# Remove secrets, commit
git add .env.example && git commit -m "Add env template"
```

### 2. Add npm script for docker:redis (5 min)
```json
"docker:redis": "docker compose up redis --profile with-redis"
```

### 3. Add REDIS_PASSWORD to docker-compose.yml (10 min)
✅ Already done in hardening

### 4. Add simple healthcheck endpoint (15 min)
```typescript
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});
```

### 5. Document all environment variables (20 min)
Create `docs/ENVIRONMENT_VARIABLES.md` with each var explained

**Total Quick Wins**: ~50 min

---

## METRICS TO TRACK

After each phase, measure:

```typescript
// Code Quality
- Type coverage: npx tsc --noEmit 2>&1 | grep error | wc -l
- Test coverage: npm run test:all -- --coverage
- Lint warnings: npm run lint 2>&1 | grep warning | wc -l

// Performance
- Build time: time npm run build
- Docker image size: docker images sisrua-unified
- DXF generation p95: npm run test:load (see k6 output)

// Reliability
- Uptime: (hours_up / hours_total) * 100
- Error rate: errors / total_requests
- Job success rate: completed / (pending + completed + failed)

// Developer Experience
- Onboarding time: new dev → first build (should be < 30 min)
- Deployment time: git push → live (should be < 5 min)
- Debug time: first production issue → resolution (target: < 15 min)
```

---

## SUCCESS CRITERIA

| Metric | Target | Status |
|--------|--------|--------|
| Zero data loss on restart | 100% | 🟡 Pending |
| Error response consistency | 100% | 🔴 0% |
| Request validation coverage | 100% | 🔴 ~30% |
| Graceful shutdown | < 25s | 🔴 No |
| Correlation ID tracking | 100% | 🔴 No |
| Job persistence | 100% | 🔴 In-memory only |
| Type coverage | > 95% | 🟠 ~90% |
| Test coverage | > 80% | 🟢 ~85% |
| Accessibility (WCAG AA) | 100% | 🟠 Partial |
| Production uptime | > 99.5% | 🟡 Not yet deployed |

---

## DEPENDENCIES & BLOCKERS

**Critical Path:**
```
Job Persistence (P1.2)
    ↓
Error Handler (P1.3)
    ↓
Production Ready ✅
```

**Blocking Production:**
- Database connectivity (TEST: npm test:backend -- jobStatus)
- Error responses (TEST: curl -X POST http://localhost:3001/api/dxf -d '{}')
- Graceful shutdown (TEST: send SIGTERM, verify clean exit)

---

## SIGN-OFF

**Tech Lead Review**: [ ] Approved  
**QA Sign-off**: [ ] Approved  
**Product Owner**: [ ] Approved  

**Next Milestone**: All Phase 1 tasks complete → production deployment readiness check

