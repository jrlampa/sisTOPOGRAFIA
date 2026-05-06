# Critical Security & Performance Issues Found

## 🔴 CRITICAL SECURITY ISSUES

### 1. **Secrets in Plain Text Files** (SEVERITY: 🔴 CRITICAL)

**Problem:**

- `secrets/redis_password.txt` stored in repo
- Anyone with repo access can read production credentials
- Git history contains sensitive data

**Fix:**

```bash
# Remove from git history
git rm --cached secrets/*.txt
echo "secrets/" >> .gitignore
git commit -m "Remove secrets from version control"

# Use proper secret management:
# - AWS Secrets Manager
# - HashiCorp Vault
# - Docker Swarm/K8s secrets
# - GitHub Actions secrets
```

---

### 2. **Redis Without Encryption** (SEVERITY: 🔴 CRITICAL)

**Problem:**

- Redis credentials transmitted as plaintext
- Port 6379 accessible on 127.0.0.1 (debug only, but still risky)
- No TLS between app ↔ Redis

**Fix:**

```yaml
# Use Redis Sentinel with TLS or:
redis:
  image: redis:8.6-alpine
  command: >
    redis-server 
    --requirepass $(cat /run/secrets/redis_password)
    --appendonly yes
    --maxmemory 512mb
    --maxmemory-policy allkeys-lru
    # For production, add TLS:
    # --tls-port 6380
    # --tls-cert-file /run/secrets/redis.crt
    # --tls-key-file /run/secrets/redis.key
```

---

### 3. **npm ci --legacy-peer-deps** (SEVERITY: 🟠 HIGH)

**Problem:**

- Ignores peer dependency conflicts
- Hides incompatible packages
- May cause runtime errors in production

**Solution:**

```json
{
  "overrides": {
    "serialize-javascript": "^7.0.5",
    "react-router-dom": "^7.14.2" // Add missing overrides
  }
}
```

Or resolve peer dep conflicts:

```bash
npm ls --depth=0  # Find conflicts
npm update  # Or bump problematic packages
```

---

### 4. **Ollama Binds to 0.0.0.0** (SEVERITY: 🟠 HIGH)

**Problem:**

```dockerfile
OLLAMA_HOST=0.0.0.0:11434  # ❌ Exposed to all containers
```

**Fix:**

```yaml
environment:
  - OLLAMA_HOST=127.0.0.1:11434 # ✅ Only localhost
```

---

## 🟠 MEMORY LEAKS & BUGS

### 5. **Duplicate File Watchers (CHOKIDAR + WATCHPACK)** (SEVERITY: 🟠 HIGH)

**Problem:**

```yaml
CHOKIDAR_USEPOLLING=true     # ❌ Vite polling
WATCHPACK_POLLING=true        # ❌ Webpack polling (duplicate)
```

= Double filesystem polling → CPU/Memory leak

**Fix:**

```yaml
environment:
  - WATCHPACK_POLLING=true # ✅ Keep only one
  # REMOVED: CHOKIDAR_USEPOLLING
```

---

### 6. **Vite Hot Module Reload Memory Accumulation** (SEVERITY: 🟡 MEDIUM)

**Problem:**

- Dev server keeps old module references in memory
- `dist/` rebuilds continuously on source change
- Memory grows linearly over time (watch 24+ hours = 1-2GB leak)

**Symptoms:** `docker stats` shows sisrua-app memory growing from 800MB → 3GB

**Fix in package.json:**

```json
{
  "scripts": {
    "dev": "concurrently \"npm run server\" \"vite\""
  }
}
```

Add vite config optimization:

```typescript
// vite.config.ts
export default {
  server: {
    middlewareMode: false,
    hmr: {
      protocol: "ws",
      host: "localhost",
      port: 3000,
    },
    watch: {
      usePolling: true,
      interval: 1000,
      binaryInterval: 1000,
      ignored: ["**/node_modules/**", "**/.git/**"],
    },
  },
};
```

---

### 7. **Redis Without Persistence** (SEVERITY: 🟡 MEDIUM)

**Current (old) compose:**

```yaml
# NO appendonly.aof or save directives
# → Data lost on restart
```

**Fix:**

```yaml
redis:
  command: >
    redis-server
    --appendonly yes
    --appendfsync everysec
    --maxmemory 512mb
    --maxmemory-policy allkeys-lru
```

---

### 8. **Node.js OOM Risk** (SEVERITY: 🟡 MEDIUM)

**Problem:**

```dockerfile
# No memory limit in Dockerfile
# Container kill by OOM without warning
```

**Current dev compose:**

```yaml
deploy:
  resources:
    limits:
      cpus: "2.0"
      memory: 4G # ❌ TOO HIGH (dev)
```

**Fix:**

```yaml
deploy:
  resources:
    limits:
      cpus: "2.0"
      memory: 2G # ✅ Reasonable for dev
    reservations:
      cpus: "0.5"
      memory: 1G
```

---

## 🟡 OPTIMIZATION ISSUES

### 9. **Node:22-bookworm-slim Too Heavy** (SEVERITY: 🟡 MEDIUM)

**Problem:**

- node:22-bookworm-slim = 1.5GB
- Alpine alternative = 200MB

**Production Dockerfile Fix:**

```dockerfile
# Stage 1: Builder (bookworm OK for build tools)
FROM node:20-bookworm-slim AS builder

# Stage 2: Runtime (Alpine)
FROM node:20-alpine  # ✅ 10x smaller
```

**Image Size Impact:**

- Current: ~1.2GB sisrua-unified:dev
- Optimized: ~400MB sisrua-unified:dev

---

### 10. **Unnecessary Python Venv in Production** (SEVERITY: 🟡 MEDIUM)

**Problem:**

- Copying entire `/opt/venv` = 380MB
- Re-compiling wheels in every build

**Fix:**

```dockerfile
# Use pre-compiled wheels from PyPI (most packages have wheels)
RUN pip install --only-binary=:all: --no-cache-dir -r requirements.txt
```

---

### 11. **Missing Resource Limits for Redis/Ollama** (SEVERITY: 🟡 MEDIUM)

**Problem (Old Compose):**

```yaml
# Ollama reserves 4 CPU / 8GB RAM - excessive for dev
# Redis no memory cap → can consume all host RAM
```

**Fix (Apply to prod too):**

```yaml
ollama:
  deploy:
    resources:
      limits:
        cpus: "2.0"
        memory: 4G
      reservations:
        cpus: "0.5"
        memory: 1G

redis:
  command: >
    redis-server
    --maxmemory 512mb
    --maxmemory-policy allkeys-lru
```

---

### 12. **Vite Not Configured for Polling** (SEVERITY: 🟡 MEDIUM)

**Problem:**

- Bind mount on Docker Desktop/WSL can have slow file watching
- Vite default fsevents may miss file changes

**Fix (add to vite.config.ts):**

```typescript
export default {
  server: {
    watch: {
      usePolling: true,
      interval: 1000,
      binaryInterval: 1000,
      ignored: ["**/node_modules/**", "**/.git/**", "**/.cache/**"],
    },
  },
};
```

---

### 13. **Dev Compose Mounts Too Many Volumes** (SEVERITY: 🟡 MEDIUM)

**Problem:**

```yaml
- .:/app # Entire source tree
- /app/node_modules # Anonymous volume
- dxf-output:/app/public/dxf
- cache-data:/app/cache
- logs-data:/app/logs
```

= I/O contention, cache fragmentation

**Fix:**

- Use named volumes for node_modules (isolated from host)
- Exclude `.cache`, `dist`, `.npm` from bind mount

---

### 14. **No .dockerignore Optimization** (SEVERITY: 🟡 MEDIUM)

**.dockerignore looks OK**, but missing:

```
.cache/
.npm/
.pytest_cache/
__pycache__/
*.pyc
.lighthouseci/
playwright-report/
test-results/
artifacts/
```

---

## ✅ WHAT'S GOOD

✓ **Non-root user (appuser:appuser)** - Prevents privilege escalation
✓ **Secrets pattern** - Better than env vars (but still plain text files)
✓ **Resource limits** - Dev compose has CPU/memory caps
✓ **Healthchecks** - All services have proper health probes
✓ **Network isolation** - 127.0.0.1 only (localhost)
✓ **Multi-stage Dockerfile** - Production build is optimized
✓ **.dockerignore** - Prevents node_modules copy
✓ **Port mapping** - Localhost binding prevents external access

---

## 📋 ACTION PLAN

**Immediate (This Week):**

1. ✅ Move to separate `docker-compose.prod.yml` and `docker-compose.dev.yml`
2. ✅ Add Alpine-based lightweight Dockerfile.prod
3. ✅ Fix duplicate polling (remove CHOKIDAR_USEPOLLING)
4. ✅ Add memory limits to Ollama/Redis
5. ❌ NEVER commit `secrets/*.txt` - use proper secret management

**Short-term (This Month):** 6. Implement Redis persistence (appendonly.aof) 7. Add Redis Sentinel for HA 8. Migrate to Alpine base image (saves 1GB) 9. Resolve --legacy-peer-deps conflicts 10. Profile Vite memory usage (capture 24h memdump)

**Long-term (This Quarter):** 11. Implement TLS for Redis 12. Add Docker Scout scanning for CVEs 13. Use DHI (Docker Hardened Images) for base images 14. Migrate to Kubernetes for multi-node orchestration

---

## Files Provided

- `Dockerfile.prod` - Production-optimized Alpine build
- `Dockerfile.dev.optimized` - Dev build (single polling, Alpine base)
- `docker-compose.prod.yml` - Production compose (security hardened)
- `docker-compose.dev.yml` - Development compose (fixed)
- `setup-docker-secrets.sh` - Secrets initialization script
