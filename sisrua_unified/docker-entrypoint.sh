#!/bin/sh
set -e

# Ensure runtime permissions for volumes and app root
echo "[Entrypoint] Verificando permissões de volumes e root..."
chown appuser:appuser /app
chown -R appuser:appuser /app/public/dxf /app/cache /app/logs
chmod -R 755 /app/public/dxf /app/cache /app/logs

# Drop privileges and start app
echo "[Entrypoint] Iniciando aplicação como appuser..."
exec gosu appuser "$@"
