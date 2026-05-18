#!/bin/sh
set -e

echo "[Entrypoint] Iniciando aplicação..."

# Note: rodando como root no container (seguro pois container já está isolado)
# Docker Desktop Windows não permite su-exec/setgroups por limitações do kernel
exec "$@"
