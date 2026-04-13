#!/bin/bash
# Git commit script for Sprint 1

cd "C:/Users/jonat/OneDrive - IM3 Brasil/utils/sisTOPOGRAFIA/sisrua_unified"

# Remove lock files
rm -f .git/index.lock
rm -f .git/HEAD.lock
rm -f .git/refs/heads/*.lock

# Kill any hanging git processes
pkill -f git.exe 2>/dev/null || true

# Commit and push
git add -A
git commit -m "feat: Sprint 1 - Arquitetura de Jobs e Seguranca de Borda

- Endpoint /api/tasks/process-dxf com autenticacao OIDC
- Middleware de verificacao de token Cloud Tasks
- CORS restrito por ambiente
- Trust proxy configurado para Cloud Run
- Variaveis de ambiente padronizadas
- Rate limiter especifico para webhooks"

git push origin dev
