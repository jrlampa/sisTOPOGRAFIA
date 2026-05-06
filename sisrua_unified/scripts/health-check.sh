#!/bin/bash
# SIS RUA Unified - Health Check / Validation Script
# Verifica se o sistema está pronto para uso local

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
CHECKS_PASSED=0
CHECKS_FAILED=0
CHECKS_WARNING=0

# Flags
VERBOSE=false
FIX=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --verbose) VERBOSE=true ;;
        --fix) FIX=true ;;
        *) echo "Unknown option: $1" ;;
    esac
    shift
done

log_info() { echo -e "${BLUE}ℹ${NC} $1"; }
log_success() { echo -e "${GREEN}✓${NC} $1"; }
log_error() { echo -e "${RED}✗${NC} $1"; }
log_warn() { echo -e "${YELLOW}⚠${NC} $1"; }

check_pass() {
    log_success "$1"
    ((CHECKS_PASSED++))
}

check_fail() {
    log_error "$1"
    ((CHECKS_FAILED++))
}

check_warn() {
    log_warn "$1"
    ((CHECKS_WARNING++))
}

check_command() {
    command -v "$1" >/dev/null 2>&1
}

# ============================================
# HEADER
# ============================================
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  SIS RUA Unified - Health Check${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

echo "Diretório: $PROJECT_ROOT"
echo ""

# ============================================
# CHECKS
# ============================================

# 1. Node.js
log_info "Verificando Node.js..."
if check_command node; then
    NODE_VERSION=$(node --version | sed 's/v//')
    MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)
    if [[ $MAJOR -ge 22 ]]; then
        check_pass "Node.js $NODE_VERSION"
    else
        check_warn "Node.js $NODE_VERSION (recomendado: 22+)"
    fi
else
    check_fail "Node.js não encontrado no PATH"
fi

# 2. Python
log_info ""
log_info "Verificando Python..."
PYTHON_FOUND=false
for py_cmd in python3 python; do
    if check_command "$py_cmd"; then
        PY_VERSION=$($py_cmd --version 2>&1 | grep -oE '[0-9]+\.[0-9]+' | head -1)
        if [[ -n "$PY_VERSION" ]]; then
            MAJOR=$(echo "$PY_VERSION" | cut -d. -f1)
            MINOR=$(echo "$PY_VERSION" | cut -d. -f2)
            if [[ $MAJOR -eq 3 && $MINOR -ge 9 ]]; then
                check_pass "Python ($py_cmd) $PY_VERSION"
            else
                check_warn "Python ($py_cmd) $PY_VERSION (recomendado: 3.9+)"
            fi
            PYTHON_FOUND=true
            PYTHON_CMD="$py_cmd"
            break
        fi
    fi
done

if [[ "$PYTHON_FOUND" = false ]]; then
    check_fail "Python não encontrado (tente: python3 ou python)"
fi

# 3. Dependências Node
log_info ""
log_info "Verificando dependências Node.js..."
if [[ -d "node_modules" ]]; then
    PKG_COUNT=$(find node_modules -maxdepth 1 -type d | wc -l)
    if [[ $PKG_COUNT -gt 0 ]]; then
        check_pass "node_modules ($PKG_COUNT pacotes)"
    else
        check_fail "node_modules vazio - execute: npm install"
    fi
else
    check_fail "node_modules não encontrado - execute: npm install"
fi

# 4. Dependências Python
log_info ""
log_info "Verificando dependências Python..."
if [[ "$PYTHON_FOUND" = true ]]; then
    # Check ezdxf
    if $PYTHON_CMD -c "import ezdxf" 2>/dev/null; then
        check_pass "ezdxf"
    else
        check_fail "ezdxf - Execute: pip install ezdxf"
    fi
    
    # Check osmnx
    if $PYTHON_CMD -c "import osmnx" 2>/dev/null; then
        check_pass "osmnx"
    else
        check_fail "osmnx - Execute: pip install osmnx"
    fi
    
    # Check shapely
    if $PYTHON_CMD -c "import shapely" 2>/dev/null; then
        check_pass "shapely"
    else
        check_fail "shapely - Execute: pip install shapely"
    fi
else
    check_warn "Bibliotecas Python - Python não encontrado"
fi

# 5. Arquivos de configuração
log_info ""
log_info "Verificando arquivos de configuração..."
if [[ -f ".env" ]]; then
    if grep -q "OFFLINE_MODE\s*=\s*true" ".env" 2>/dev/null; then
        check_pass ".env (OFFLINE_MODE ativado)"
    else
        check_warn ".env (OFFLINE_MODE não definido)"
    fi
else
    check_warn ".env não encontrado - copie de .env.example"
fi

# 6. Diretórios necessários
log_info ""
log_info "Verificando diretórios..."
for dir in public/dxf cache logs; do
    if [[ -d "$dir" ]]; then
        check_pass "$dir"
    else
        check_warn "$dir - será criado automaticamente"
        if [[ "$FIX" = true ]]; then
            mkdir -p "$dir"
            echo "  Criado: $dir"
        fi
    fi
done

# 7. Scripts Python
log_info ""
log_info "Verificando scripts Python..."
for script_info in "py_engine/main.py:Entry point" "py_engine/dxf_generator.py:Gerador DXF" "py_engine/controller.py:Controller" "py_engine/create_demo_dxf.py:Gerador demo"; do
    IFS=':' read -r script desc <<< "$script_info"
    if [[ -f "$script" ]]; then
        check_pass "$script ($desc)"
    else
        check_fail "$script - ARQUIVO FALTANDO!"
    fi
done

# 8. Portas disponíveis
log_info ""
log_info "Verificando portas..."
for port in 3000 3001 8080; do
    if ! nc -z localhost $port 2>/dev/null; then
        check_pass "Porta $port (disponível)"
    else
        check_warn "Porta $port (possivelmente em uso)"
    fi
done

# ============================================
# SUMMARY
# ============================================
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  RESULTADO${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

TOTAL=$((CHECKS_PASSED + CHECKS_FAILED + CHECKS_WARNING))
echo "Total de verificações: $TOTAL"
echo "  ${GREEN}✓ Passaram:${NC} $CHECKS_PASSED"
echo "  ${YELLOW}⚠ Avisos:${NC} $CHECKS_WARNING"
echo "  ${RED}✗ Falharam:${NC} $CHECKS_FAILED"
echo ""

if [[ $CHECKS_FAILED -eq 0 ]]; then
    if [[ $CHECKS_WARNING -eq 0 ]]; then
        echo -e "${GREEN}✅ SISTEMA PRONTO!${NC}"
        echo ""
        echo "Para iniciar:"
        echo "  npm run dev"
        echo ""
        exit 0
    else
        echo -e "${YELLOW}⚡ SISTEMA FUNCIONAL COM AVISOS${NC}"
        echo ""
        echo "O sistema deve funcionar, mas considere corrigir os avisos."
        echo ""
        exit 0
    fi
else
    echo -e "${RED}❌ SISTEMA NÃO PRONTO${NC}"
    echo ""
    echo "Corrija os erros acima antes de iniciar."
    echo ""
    echo "Dica: Execute com --fix para tentar correções automáticas:"
    echo "  ./scripts/health-check.sh --fix"
    echo ""
    exit 1
fi
