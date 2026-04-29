#!/bin/sh
set -e

echo "[Entrypoint] Verificando permissões de volumes..."

# Fix writable directories (não recursivo para performance)
if [ -d "/app/public/dxf" ]; then
    chown appuser:appuser /app/public/dxf
fi

if [ -d "/app/cache" ]; then
    chown appuser:appuser /app/cache
fi

if [ -d "/app/logs" ]; then
    chown appuser:appuser /app/logs
fi

echo "[Entrypoint] Iniciando aplicação..."
exec "$@"
