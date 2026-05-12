# syntax=docker/dockerfile:1.7
# ─────────────────────────────────────────────────────────────────────────────
# SIS RUA Unified — Dockerfile de Produção (Multi-Stage + BuildKit Optimized)
# ─────────────────────────────────────────────────────────────────────────────
# Stages:
#   base-build  – Alpine + ferramentas de compilação nativa (compartilhado)
#   py-deps     – venv Python isolado (invalida apenas ao mudar requirements)
#   node-build  – compilação TS + Vite; prune devDeps ao final
#   runner      – imagem de runtime mínima (sem devDeps, sem build tools)
#
# Benefícios vs versão anterior:
#   • BuildKit cache mounts (apk / pip / npm): rebuilds muito mais rápidos
#   • node_modules copiados do builder (0 npm installs no runner)
#   • su-exec no lugar do gosu (binário 10× menor)
#   • COPY --chown elimina layer de chown separado
#   • Estágio py-deps independente: Python só reconstruído se requirements mudar
#   • Tini como init (PID 1) para graceful shutdown
# ─────────────────────────────────────────────────────────────────────────────

ARG NODE_VERSION=22
ARG ALPINE_VERSION=3.21

# ── Stage 1: ferramentas de compilação nativa ─────────────────────────────────
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS base-build

# Cache APK persistido no host pelo BuildKit (não incluído na camada da imagem)
RUN --mount=type=cache,target=/var/cache/apk,sharing=locked \
    apk add --update-cache \
        python3 \
        python3-dev \
        py3-pip \
        build-base \
        gdal-dev \
        geos-dev \
        proj-dev

# ── Stage 2: dependências Python (invalida só quando requirements.txt muda) ───
FROM base-build AS py-deps

COPY py_engine/requirements.txt /tmp/requirements.txt

RUN python3 -m venv /opt/venv

# Cache pip armazenado no host; wheels não são baixados em rebuilds
RUN --mount=type=cache,target=/root/.cache/pip,sharing=locked \
    /opt/venv/bin/pip install --upgrade pip setuptools wheel && \
    /opt/venv/bin/pip install -r /tmp/requirements.txt

# ── Stage 3: build Node.js + TypeScript ──────────────────────────────────────
FROM base-build AS node-build

WORKDIR /app

# Instalar dependências npm — cache mount evita re-download quando lock não muda
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm ci --legacy-peer-deps --prefer-offline --no-audit

COPY . .

# Build frontend (Vite) e backend (tsc)
RUN npm run build && \
    npx tsc -p tsconfig.server.json

# Remover devDependencies — node_modules resultante vai direto para o runner
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm prune --omit=dev --legacy-peer-deps

# ── Stage 4: runner (imagem final mínima) ─────────────────────────────────────
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS runner

WORKDIR /app

ENV NODE_ENV=production \
    PORT=8080 \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHON_COMMAND=python3 \
    DOCKER_ENV=true \
    PATH="/opt/venv/bin:$PATH"

# Runtime: Python3 (interpetador), su-exec (drop-privilege), curl (healthcheck)
# tini é essencial para colher processos zumbi e repassar sinais (SIGTERM)
RUN --mount=type=cache,target=/var/cache/apk,sharing=locked \
    apk add --update-cache \
        python3 \
        su-exec \
        ca-certificates \
        curl \
        tini

# Usuário não-root com UID fixo (paridade dev ↔ prod)
RUN addgroup -g 10000 appuser && \
    adduser -D -u 10000 -G appuser appuser

# ── Artefatos do build ───────────────────────────────────────────────────────
# Python venv (apenas do estágio py-deps — sem build-base no runner)
COPY --from=py-deps  /opt/venv                /opt/venv

# Código compilado + dependências de produção (já pruned)
COPY --from=node-build --chown=appuser:appuser /app/dist         ./dist
COPY --from=node-build --chown=appuser:appuser /app/node_modules ./node_modules
COPY --from=node-build --chown=appuser:appuser /app/py_engine    ./py_engine
COPY --from=node-build --chown=appuser:appuser /app/public       ./public

COPY --chown=appuser:appuser package.json          ./package.json
COPY --chown=appuser:appuser docker-entrypoint.sh  ./docker-entrypoint.sh

# Diretórios de runtime (volumes montados em produção)
RUN mkdir -p /app/public/dxf /app/cache /app/logs && \
    chown -R appuser:appuser /app/public/dxf /app/cache /app/logs && \
    chmod +x /app/docker-entrypoint.sh

# Verificação de dependências Python (falha o build se pacote estiver faltando)
RUN <<EOF /opt/venv/bin/python3
import sys, importlib.util
required = [
    'osmnx','geopandas','shapely','pyproj','rasterio','networkx',
    'ezdxf','numpy','pandas','scipy','matplotlib',
    'psycopg2','openpyxl','requests','srtm','pydantic','psutil',
]
missing = [m for m in required if importlib.util.find_spec(m) is None]
if missing:
    print(f'CRITICAL: missing Python deps: {missing}')
    sys.exit(1)
print('ALL Python dependencies OK')
EOF

# ENTRYPOINT: ajusta ownership de volumes em runtime e faz exec para appuser
ENTRYPOINT ["/sbin/tini", "--", "/app/docker-entrypoint.sh"]

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD curl -fsS "http://localhost:${PORT}/health" || exit 1

CMD ["node", "dist/server/index.js"]
