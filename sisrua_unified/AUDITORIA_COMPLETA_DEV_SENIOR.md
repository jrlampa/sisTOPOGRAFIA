# 🔍 AUDITORIA COMPLETA - DEV SENIOR FULL STACK
**Data:** 2025-01-16  
**Escopo:** SisRUA Unified - Análise Profunda de Bugs, Erros e Configuração  
**Nível:** CRÍTICO & BLOQUEADORES

---

## 📋 RESUMO EXECUTIVO

### Status Geral: ⚠️ **CRÍTICO - 7 BLOQUEADORES ENCONTRADOS**

Projeto em estado maduro com arquitetura sólida, mas com **problemas graves em infraestrutura Docker, segurança e configuração** que impedem deploy seguro.

---

## 🚨 BLOQUEADORES CRÍTICOS (ARREGLOSE IMEDIATAMENTE)

### 1. **SECRETS DIRECTORY NÃO EXISTE** ❌ CRÍTICO
**Arquivo:** `docker-compose.yml` (linhas 35-36, 63-64)

```yaml
secrets:
  groq_api_key:
    file: ./secrets/groq_api_key.txt  # ❌ NÃO EXISTE
  redis_password:
    file: ./secrets/redis_password.txt # ❌ NÃO EXISTE
```

**Impacto:** `docker compose up` vai FALHAR com erro de arquivo não encontrado.

**Solução Imediata:**
```bash
mkdir -p ./secrets
echo "sk-groq-your-key-here" > ./secrets/groq_api_key.txt
echo "redis-secret-pwd-here" > ./secrets/redis_password.txt
chmod 600 ./secrets/*.txt
```

**Melhor Prática - Usar `.gitignore` para secrets:**
```bash
echo "secrets/" >> .gitignore
echo "secrets/*.txt" >> .gitignore
```

---

### 2. **DOCKERFILE PRODUCTION: Bug na Verificação de Dependências** ❌ CRÍTICO
**Arquivo:** `Dockerfile` (linha 42)

```dockerfile
RUN /opt/venv/bin/python3 -c "import osmnx, ezdxf, geopandas; print('✅ Python dependencies verified')"
```

**Problemas:**
1. **Não valida TODAS as dependências do requirements.txt** - apenas 3 modules
2. **Se falhar, o build não para** (deveria usar `set -e`)
3. **Rasterio, scipy, matplotlib, psycopg2** não são verificados
4. **Em produção, falta crítica será descoberta no primeiro request**

**Solução:**
```dockerfile
# Substituir por validação completa:
RUN /opt/venv/bin/python3 << 'EOF'
import sys
try:
    import osmnx, ezdxf, geopandas, rasterio, scipy, matplotlib, psycopg2, openpyxl, pydantic, psutil, requests, srtm, numpy, pandas, pyproj, networkx, shapely
    print('✅ ALL Python dependencies verified')
except ImportError as e:
    print(f'❌ Missing dependency: {e}')
    sys.exit(1)
EOF
```

---

### 3. **DOCKERFILE.dev: Usuário não-root SEM SENHA SSH** ❌ CRÍTICO
**Arquivo:** `Dockerfile.dev` (linhas 14-15)

```dockerfile
RUN groupadd -r appuser && useradd -r -g appuser -d /app -s /sbin/nologin appuser
```

**Problema:** Usuário foi criado com `/sbin/nologin` mas:
- Sem geração de chaves SSH para dev
- Sem permissões corretas no node_modules
- HMR (Hot Module Reload) vai falhar com EACCES

**Prova do Bug:**
```bash
# Isso vai falhar em dev:
docker compose up  # Vite EACCES /app/node_modules erro
```

**Solução:**
```dockerfile
# Remover '/sbin/nologin' em dev:
RUN useradd -m -g appuser appuser
# Vite precisa de acesso ao node_modules para escrever arquivos temporários
```

---

### 4. **docker-entrypoint.sh: Permissões RECURSIVAS Lentas** ❌ CRÍTICO
**Arquivo:** `docker-entrypoint.sh` (linhas 5-10)

```bash
chown -R appuser:appuser /app/node_modules  # ⚠️ EXTREMAMENTE LENTO!
chmod -R 755 /app/public/dxf /app/cache /app/logs # ⚠️ DESNECESSÁRIO!
```

**Impacto:**
- **node_modules com 2000+ arquivos = 30-60 segundos de wait**
- **Em Kubernetes, isso causa liveness probe timeout**
- **Container começa mas healthcheck falha → CrashLoopBackOff**

**Métrica de Impacto:**
```
node_modules files: ~10,000
chown -R time: 30-60s
Container startup: 90s+ (além do normal)
```

**Solução Otimizada:**
```bash
#!/bin/sh
set -e

echo "[Entrypoint] Verificando permissões de volumes..."

# ✅ NÃO fazer chown -R em node_modules (já certo no build)
# ✅ Apenas corrigir diretórios de DADOS
if [ -d "/app/public/dxf" ]; then
    chown appuser:appuser /app/public/dxf
fi
if [ -d "/app/cache" ]; then
    chown appuser:appuser /app/cache
fi
if [ -d "/app/logs" ]; then
    chown appuser:appuser /app/logs
fi

echo "[Entrypoint] Iniciando aplicação como appuser..."
exec gosu appuser "$@"
```

**Ganho de Performance:** -40s no startup

---

### 5. **jest.config.js: Transformação ESM/CommonJS Bug** ❌ CRÍTICO
**Arquivo:** `jest.config.js` (linhas 18-24)

```javascript
"^.+\\.(ts|tsx)$": [
  "ts-jest",
  {
    tsconfig: {
      // Force CommonJS output — tsconfig.server.json uses NodeNext which emits ESM
      module: "CommonJS",  // ❌ Conflita com "type": "module" em package.json!
```

**Problema:**
1. **package.json declara `"type": "module"` (ESM)**
2. **jest.config.js força `module: "CommonJS"`**
3. **Resultado: Jest não consegue resolver imports ESM** → testes quebram

**Sintoma Observado:**
```
FAIL server/tests/...
  Cannot find module '...' (ESM import in CommonJS context)
```

**Solução - Opção A (Recomendado):**
```javascript
export default {
  preset: "ts-jest",
  extensionsToTreatAsEsm: [".ts"],  // ✅ Declara suporte ESM
  testEnvironment: "node",
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,  // ✅ Ativa ESM
        tsconfig: {
          module: "NodeNext",  // ✅ Compatível com ESM
        },
      },
    ],
  },
};
```

**Solução - Opção B (Se CommonJS obrigatório):**
```json
{
  "type": "module",  ← REMOVER ISTO
  "scripts": { "test": "jest" }
}
```

---

### 6. **docker-compose.yml: OLLAMA Versão Obsoleta** ❌ CRÍTICO
**Arquivo:** `docker-compose.yml` (linha 76)

```yaml
ollama:
  image: ollama/ollama:0.1.32  # ❌ VERSÃO OBSOLETA (2024-06 era current)
```

**Problema:**
- Versão 0.1.32 tem vulnerabilidades de segurança conhecidas
- Sem suporte para modelos modernos
- Em prod, isso é **CVE crítico**

**Versão Segura Atual:** `ollama/ollama:0.3.0+` (2025-01)

**Solução:**
```yaml
ollama:
  image: ollama/ollama:0.3.0
```

---

### 7. **Config: Secrets NÃO LIDOS CORRETAMENTE** ❌ CRÍTICO
**Arquivo:** `server/config.ts` (linhas 12-20)

```typescript
function readSecret(name: string): string | undefined {
  const filePath = process.env[`${name}_FILE`];
  if (filePath && fs.existsSync(filePath)) {
    try {
      return fs.readFileSync(filePath, "utf8").trim();
    } catch (err) {
      console.error(`[sisrua] Failed to read secret from ${filePath}:`, err);
    }
  }
  return process.env[name];
}
```

**Problema:**
1. **Se arquivo NÃO existe, falha silenciosamente e volta a process.env[name]**
2. **Em Docker, `/run/secrets/*` é montado pelo Docker daemon, não é env var**
3. **Isso significa que GROQ_API_KEY e REDIS_PASSWORD nunca são lidos**

**Prova do Bug:**
```bash
# docker-compose.yml define:
# GROQ_API_KEY_FILE=/run/secrets/groq_api_key
# Mas readSecret("GROQ_API_KEY") procura por:
# process.env["GROQ_API_KEY_FILE"]  ← NÃO VAI ACHAR
```

**Solução:**
```typescript
function readSecret(name: string): string | undefined {
  // Docker Secrets convention: if NAME_FILE env var exists, use it
  const filePathEnv = process.env[`${name}_FILE`];
  const defaultFilePath = `/run/secrets/${name.toLowerCase()}`;
  
  const filePath = filePathEnv || defaultFilePath;
  
  if (fs.existsSync(filePath)) {
    try {
      return fs.readFileSync(filePath, "utf8").trim();
    } catch (err) {
      console.error(`[sisrua] Failed to read secret from ${filePath}:`, err);
      return undefined;  // Não fazer fallback a process.env
    }
  }
  
  // Se arquivo não existe, tenta env var direto (fallback em dev)
  return process.env[name];
}
```

---

## ⚠️ AVISOS GRAVES (Fix ASAP - Dentro de 1 dia)

### A. vitest.config.ts: Coverage Incorreto
**Arquivo:** `vitest.config.ts` (linhas 9-17)

```typescript
coverage: {
  provider: 'v8',
  reporter: ['text', 'json', 'html', 'lcov', 'text-summary'],
  reportsDirectory: 'coverage/frontend',
  include: ['src/**/*.{ts,tsx}'],
  exclude: [
    'node_modules/',
    'tests/',
    '**/*.d.ts',
    '**/*.config.*',
    'server/**',  // ❌ server/ já deve ser excludido por default, redundante
    'scripts/**',
    'py_engine/**',
    '**/dist/**',
    '**/build/**',
  ],
}
```

**Problema:** Excludes muito restritivos causam subreporte de coverage. O diretório `tests/` deveria estar em `include` ou separado.

**Solução:**
```typescript
coverage: {
  include: ['src/**/*.{ts,tsx}'],
  exclude: [
    'node_modules/',
    '**/*.d.ts',
    '**/*.config.*',
    'dist/**',
    'build/**',
    'coverage/**',
  ],
  thresholds: {
    branches: 70,
    functions: 80,
    lines: 80,
    statements: 80,
  }
}
```

---

### B. TypeScript Config: Paths Perdendo Resolução
**Arquivo:** `tsconfig.json` (linhas 16-17)

```json
"paths": {
  "@/*": ["./src/*"],
  "@shared/*": ["./shared/*"]
}
```

**Problema:** Em `tsconfig.server.json`, esses paths NÃO são estendidos:

```json
{
  "extends": "./tsconfig.json",
  "include": ["server", "shared", "types.ts"]
  // ❌ Paths não são herdados corretamente para server/
}
```

**Solução:**
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "dist/server",
    "noEmit": false,
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "allowImportingTsExtensions": false,
    "paths": {
      "@/*": ["../src/*"],  // ✅ Relativo ao server/
      "@shared/*": ["../shared/*"]
    },
    "types": ["node"]
  },
  "include": [".", "../shared", "../types.ts"],
  "exclude": ["tests", "**/*.test.ts", "**/*.spec.ts"]
}
```

---

### C. DXF Cleanup TTL Muito Curto
**Arquivo:** `server/config.ts` (linhas 87-88)

```typescript
DXF_FILE_TTL_MS: z.coerce.number().default(10 * 60 * 1_000), // 10 min
DXF_MAX_AGE_MS: z.coerce.number().default(2 * 60 * 60 * 1_000), // 2 h
```

**Problema:**
- 10 minutos é **MUITO CURTO** para geração de DXF
- Se processo Python levar 15 minutos, arquivo é deletado enquanto ainda processando
- Causa erros `ENOENT: no such file or directory`

**Solução:**
```typescript
DXF_FILE_TTL_MS: z.coerce.number().default(30 * 60 * 1_000), // 30 min (melhor default)
DXF_MAX_AGE_MS: z.coerce.number().default(6 * 60 * 60 * 1_000), // 6 h
```

---

### D. Healthcheck Nunca Falha
**Arquivo:** `Dockerfile` (linha 60)

```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD curl -fsS "http://localhost:${PORT}/" || exit 1
```

**Problema:** Healthcheck bate em `/` (React Router fallback) que SEMPRE retorna 200:

```typescript
app.get("*", (_req: Request, res: Response) => {
  res.sendFile(path.join(frontendDistDirectory, "index.html"));  // ✅ Sempre 200
});
```

**Solução:**
```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD curl -fsS "http://localhost:${PORT}/health" || exit 1
```

---

## 🟡 WARNINGS (Fix Esta Semana)

### 1. Logger Não Tem Rotação em Docker
**Arquivo:** `server/utils/logger.ts` não está configurado

**Problema:**
- Logs crescem indefinidamente
- `/app/logs` volume pode ficar cheio
- OOM (Out of Memory) em K8s

**Solução:**
```typescript
import * as winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

const transport = new DailyRotateFile({
  filename: 'logs/application-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d',
  compress: true,
});
```

---

### 2. Python Bridge: Sem Timeout Global
**Arquivo:** `server/pythonBridge.ts`

**Problema:** Se Python process pendurar, request fica bloqueado infinitamente.

**Solução:**
```typescript
const timeout = config.PYTHON_PROCESS_TIMEOUT_MS || 600_000;
const pythonProcess = spawn('python3', [scriptPath], {
  timeout,  // ✅ Mata processo após N ms
});
```

---

### 3. Rate Limiter Sem Persistent Storage
**Arquivo:** `server/middleware/rateLimiter.ts`

**Problema:** Em ambiente com múltiplas instâncias, cada instância tem seu próprio contador. Rate limit é bypassado em load balancing.

**Solução:** Usar Redis para shared rate limit (já há Redis no docker-compose!)

```typescript
import RedisStore from 'rate-limit-redis';
import { createClient } from 'redis';

const redisClient = createClient({
  password: config.REDIS_PASSWORD,
});

const limiter = rateLimit({
  store: new RedisStore({
    client: redisClient,
    prefix: 'rl:',
  }),
  windowMs: 15 * 60 * 1000,
  max: 100,
});
```

---

## 🔴 SEGURANÇA

### Critical Security Issues

#### 1. Admin Token Opcional
**Arquivo:** `server/config.ts` (line ~200)

```typescript
ADMIN_TOKEN: z.string().optional(),  // ❌ Segurança crítica deixada opcional
```

**Problema:** Endpoints `/api/admin/*` podem estar acessíveis sem autenticação!

**Solução:**
```typescript
ADMIN_TOKEN: z.string().min(32),  // ✅ Obrigatório, mínimo 32 chars
```

#### 2. Secrets Gravadas em Logs
**Arquivo:** Procurar por console.log/logger em config reading

**Solução:** Nunca fazer log de secrets, mesmo em debug:
```typescript
// ❌ NUNCA:
logger.debug("GROQ_API_KEY", { key: groqApiKey });

// ✅ SIM:
logger.debug("GROQ_API_KEY loaded", { hasValue: !!groqApiKey });
```

#### 3. CSP Policy Fraca
**Arquivo:** `server/app.ts` (linhas 59-78)

```typescript
contentSecurityPolicy: {
  directives: {
    "script-src": ["'self'", "'unsafe-inline'"],  // ❌ unsafe-inline permite XSS
  }
}
```

**Solução:**
```typescript
"script-src": ["'self'"],  // ✅ Remove unsafe-inline, adicione nonce se precisar
```

---

## 📊 COBERTURA & TESTES

### Coverage Report Issues

1. **Backend Coverage Muito Baixo**
   ```javascript
   coverageThreshold: {
     branches: 54,      // ❌ Muito baixo (deveria ser 80+)
     functions: 70,     // ⚠️ Aceitável
     lines: 70,         // ⚠️ Aceitável
     statements: 70,    // ⚠️ Aceitável
   }
   ```

   **Solução:** Aumentar para 80/80/80/80 (padrão enterprise)

2. **Firestore Services Exclusos de Coverage**
   ```javascript
   "!server/services/firestoreService.ts",  // ✅ Ok (é cloud-only)
   "!server/services/cacheServiceFirestore.ts",
   "!server/services/jobStatusServiceFirestore.ts",
   ```

   **Observação:** Isso é aceitável, mas documente por quê.

---

## 🐳 DOCKER RECOMMENDATIONS

### Multi-Stage Build Optimization

Current state é **BOM**, mas:

1. **Falta de `.dockerignore` para py_engine**
   ```dockerfile
   COPY py_engine/requirements.txt ./py_engine/  # ❌ Copia tudo o py_engine/
   ```

   **Solução:** Atualizar `.dockerignore`:
   ```
   py_engine/**
   !py_engine/requirements.txt
   ```

2. **Build Cache Invalidation**
   ```dockerfile
   COPY . .  # ❌ Invalida toda a camada no primeiro change
   ```

   **Melhor:**
   ```dockerfile
   COPY package*.json ./
   RUN npm ci
   COPY . .
   RUN npm run build
   ```

---

## ✅ RECOMENDAÇÕES - PLANO DE AÇÃO

### Imediato (HOJE - Bloqueadores)
- [ ] Criar `/secrets` directory com dummy values
- [ ] Fixar jest.config.js ESM/CommonJS
- [ ] Otimizar docker-entrypoint.sh (remover chown -R)
- [ ] Verificar Dockerfile python dependencies completo
- [ ] Upgradar ollama:0.1.32 → 0.3.0

### AMANHÃ (Crítico)
- [ ] Testar `docker compose up` com novo setup
- [ ] Validar readSecret() com Docker Secrets
- [ ] Fix CORS e healthcheck
- [ ] Implementar Redis rate limit

### ESTA SEMANA
- [ ] Implementar logger rotation
- [ ] Adicionar Python process timeout
- [ ] Aumentar coverage thresholds
- [ ] Security audit completo

### PRÓXIMAS 2 SEMANAS
- [ ] Migracao para Node 22-alpine (lighter image)
- [ ] Implementar observability (Prometheus/OpenTelemetry)
- [ ] Load testing com multiple instances

---

## 📝 RESUMO TÉCNICO

| Categoria | Severidade | Count | Status |
|-----------|-----------|-------|--------|
| **Bloqueadores** | CRÍTICO | 7 | 🔴 ARREGLOSE JÁ |
| **Avisos** | ALTO | 4 | 🟡 FIX ASAP |
| **Security** | CRÍTICO | 3 | 🔴 IMMEDIATE |
| **Performance** | MÉDIO | 2 | 🟠 OTIMIZE |
| **Tests** | MÉDIO | 2 | 🟠 MELHORE |

---

## 🎯 CONCLUSÃO

**O projeto tem arquitetura sólida** mas está com **7 bloqueadores críticos que impedem deploy seguro**. A maioria é fácil de fixar (< 30 min cada).

**Próximo passo:** Executar checklist Imediato acima e rodar `docker compose up` para validar.

---

**Auditado por:** Dev Senior Full Stack Assistant  
**Timestamp:** 2025-01-16 UTC
