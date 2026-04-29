#!/bin/bash
# 🎯 AUDITORIA CHECKLIST - EXECUTOR VISUAL
# Execute isto após auditoria para validar todos os fixes

set -e

echo "
╔════════════════════════════════════════════════════════════════╗
║  🎯 SisRUA UNIFIED - AUDITORIA COMPLETA CHECKLIST             ║
║  Data: 2025-01-16                                              ║
║  Status: Pronto para validação                                ║
╚════════════════════════════════════════════════════════════════╝
"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counter
PASSED=0
FAILED=0
TOTAL=0

# Helper functions
check_item() {
    local name=$1
    local cmd=$2
    TOTAL=$((TOTAL + 1))
    
    echo -n "[$TOTAL/13] Verificando: $name ... "
    if eval "$cmd" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ PASS${NC}"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}❌ FAIL${NC}"
        FAILED=$((FAILED + 1))
    fi
}

check_file() {
    local file=$1
    TOTAL=$((TOTAL + 1))
    
    echo -n "[$TOTAL/13] Arquivo existe: $file ... "
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅ PASS${NC}"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}❌ FAIL${NC}"
        echo -e "${YELLOW}  💡 Dica: Execute ./setup-secrets.sh primeiro${NC}"
        FAILED=$((FAILED + 1))
    fi
}

# --- SECTION 1: FILES & DIRECTORIES ---
echo ""
echo -e "${BLUE}=== SEÇÃO 1: Arquivos & Diretórios ===${NC}"

check_file "docker-entrypoint.sh"
check_file "jest.config.js"
check_file "Dockerfile"
check_file "Dockerfile.dev"

# --- SECTION 2: DOCKER CONFIGURATION ---
echo ""
echo -e "${BLUE}=== SEÇÃO 2: Docker Configuração ===${NC}"

check_item "docker-compose.yml é válido" "docker compose config > /dev/null 2>&1"
check_item "docker-entrypoint.sh é executável" "test -x docker-entrypoint.sh"

# --- SECTION 3: SOURCE CODE FIXES ---
echo ""
echo -e "${BLUE}=== SEÇÃO 3: Código Corrigido ===${NC}"

check_item "jest.config.js: ESM suportado" "grep -q 'useESM: true' jest.config.js"
check_item "jest.config.js: coverage aumentado" "grep -q 'branches: 70' jest.config.js"
check_item "Dockerfile: Python deps completo" "grep -q 'ALL Python dependencies verified' Dockerfile"
check_item "Dockerfile.dev: usuário correto" "grep -q 'useradd -m -u 1000' Dockerfile.dev"
check_item "docker-compose.yml: ollama 0.3.0" "grep -q 'ollama:0.3' docker-compose.yml"

# --- FINAL REPORT ---
echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  📊 RESULTADO FINAL                                            ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "Total de checks: $TOTAL"
echo -e "Passou: ${GREEN}$PASSED${NC}"
echo -e "Falhou: ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ TODOS OS CHECKS PASSARAM!${NC}"
    echo ""
    echo "Próximos passos:"
    echo "1. ./setup-secrets.sh"
    echo "2. docker compose build"
    echo "3. docker compose up -d"
    echo "4. curl http://localhost:3001/health"
    exit 0
else
    echo -e "${RED}❌ ALGUNS CHECKS FALHARAM${NC}"
    echo ""
    echo "Leia AUDITORIA_COMPLETA_DEV_SENIOR.md para mais detalhes"
    exit 1
fi
