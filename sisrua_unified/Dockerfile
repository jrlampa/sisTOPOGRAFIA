# Multi-stage Dockerfile for SIS RUA Unified Application
# Optimized for Production with Security Hardening and Multi-Language Support (Node.js + Python)

# Stage 1: Builder
FROM node:22-bookworm-slim AS builder
WORKDIR /app

# Install Python and build dependencies for native modules
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy package files for layer caching
COPY package*.json ./
RUN npm ci --legacy-peer-deps --prefer-offline --no-audit

# Copy source and build
COPY . .
RUN npm run build

# Compile backend separately to ensure dist/server is populated
RUN npx tsc -p tsconfig.server.json

# Setup Python virtual environment
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --no-cache-dir --upgrade pip
COPY py_engine/requirements.txt ./py_engine/
RUN pip install --no-cache-dir -r py_engine/requirements.txt

# Stage 2: Runner (Production)
FROM node:22-bookworm-slim AS runner
WORKDIR /app

# Security: Set production environment
ENV NODE_ENV=production \
    PORT=8080 \
    DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHON_COMMAND=python3 \
    DOCKER_ENV=true \
    PATH="/opt/venv/bin:$PATH"

# Install runtime dependencies (Python + Security patches)
RUN apt-get update && apt-get upgrade -y && \
    apt-get install -y --no-install-recommends \
        python3 \
        ca-certificates \
        curl \
        gosu \
        && apt-get clean \
        && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# Security: Create non-root user
RUN useradd -m -u 10000 appuser

# Copy production node_modules
COPY package*.json ./
RUN npm ci --legacy-peer-deps --omit=dev --prefer-offline --no-audit && \
    npm cache clean --force

# Copy pre-built Python venv and artifacts
COPY --from=builder /opt/venv /opt/venv
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/py_engine ./py_engine
COPY --from=builder /app/public ./public
COPY docker-entrypoint.sh ./

# Setup runtime directories
RUN mkdir -p /app/public/dxf /app/cache /app/logs && \
    chown -R appuser:appuser /app/public/dxf /app/cache /app/logs && \
    chmod +x /app/docker-entrypoint.sh

# Verify runtime environment - comprehensive dependency check
RUN /opt/venv/bin/python3 << 'EOF'
import sys
try:
    # Geospatial core
    import osmnx, geopandas, shapely, pyproj, rasterio, networkx
    # DXF/CAD
    import ezdxf
    # Data processing
    import numpy, pandas, scipy, matplotlib
    # Database
    import psycopg2
    # Spreadsheets
    import openpyxl
    # HTTP & APIs
    import requests
    # Elevation
    import srtm
    # Validation
    import pydantic
    # Monitoring
    import psutil
    print('✅ ALL Python dependencies verified successfully')
except ImportError as e:
    print(f'❌ CRITICAL: Missing Python dependency: {e}')
    sys.exit(1)
EOF

# ENTRYPOINT will handle permissions as root then drop to appuser
ENTRYPOINT ["/app/docker-entrypoint.sh"]

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD curl -fsS "http://localhost:${PORT}/health" || exit 1

# Start application
CMD ["node", "dist/server/index.js"]
