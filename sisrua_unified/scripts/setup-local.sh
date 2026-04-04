#!/bin/bash
# SIS RUA Unified - Local Setup Script (Linux/Mac)
# Configura ambiente de desenvolvimento local sem Docker

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Flags
SKIP_NODE=false
SKIP_PYTHON=false
VERBOSE=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-node) SKIP_NODE=true ;;
        --skip-python) SKIP_PYTHON=true ;;
        --verbose) VERBOSE=true ;;
        *) echo "Unknown option: $1" ;;
    esac
    shift
done

log_info() { echo -e "${BLUE}ℹ${NC} $1"; }
log_success() { echo -e "${GREEN}✓${NC} $1"; }
log_error() { echo -e "${RED}✗${NC} $1"; }
log_warn() { echo -e "${YELLOW}⚠${NC} $1"; }

check_command() {
    command -v "$1" >/dev/null 2>&1
}

get_node_version() {
    if check_command node; then
        node --version 2>/dev/null | sed 's/v//'
    else
        echo ""
    fi
}

get_python_version() {
    for cmd in python3 python; do
        if check_command "$cmd"; then
            version=$($cmd --version 2>&1 | grep -oE '[0-9]+\.[0-9]+' | head -1)
            if [ -n "$version" ]; then
                echo "$version"
                return
            fi
        fi
    done
    echo ""
}

version_ge() {
    [ "$(printf '%s\n' "$1" "$2" | sort -V | head -n1)" = "$2" ]
}

# ============================================
# HEADER
# ============================================
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  SIS RUA Unified - Local Setup${NC}"
echo -e "${BLUE}  Modo Enterprise (Sem Docker)${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Get project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

log_info "Diretório do projeto: $PROJECT_ROOT"
echo ""

# ============================================
# CHECK PREREQUISITES
# ============================================
log_info "Verificando pré-requisitos..."

NODE_OK=false
PYTHON_OK=false
NODE_VERSION=""
PYTHON_VERSION=""

# Check Node.js
if [ "$SKIP_NODE" = false ]; then
    NODE_VERSION=$(get_node_version)
    if [ -n "$NODE_VERSION" ]; then
        if version_ge "$NODE_VERSION" "22.0"; then
            log_success "Node.js $NODE_VERSION encontrado"
            NODE_OK=true
        else
            log_warn "Node.js $NODE_VERSION encontrado (recomendado: 22+)"
            NODE_OK=true
        fi
    else
        log_error "Node.js não encontrado"
        echo "  Baixe em: https://nodejs.org/ (recomendado: LTS)"
    fi
else
    NODE_OK=true
fi

# Check Python
if [ "$SKIP_PYTHON" = false ]; then
    PYTHON_VERSION=$(get_python_version)
    if [ -n "$PYTHON_VERSION" ]; then
        if version_ge "$PYTHON_VERSION" "3.9"; then
            log_success "Python $PYTHON_VERSION encontrado"
            PYTHON_OK=true
        else
            log_warn "Python $PYTHON_VERSION encontrado (recomendado: 3.9+)"
            PYTHON_OK=true
        fi
    else
        log_error "Python não encontrado"
        echo "  Baixe em: https://python.org/downloads/"
    fi
else
    PYTHON_OK=true
fi

# Check Git
if check_command git; then
    log_success "Git encontrado"
else
    log_warn "Git não encontrado (opcional)"
fi

# Critical checks
if [ "$NODE_OK" = false ] || [ "$PYTHON_OK" = false ]; then
    echo ""
    log_error "Pré-requisitos críticos não atendidos!"
    echo ""
    echo "Instale os componentes acima e execute novamente."
    exit 1
fi

echo ""
log_success "Todos os pré-requisitos atendidos!"
echo ""

# ============================================
# INSTALL DEPENDENCIES
# ============================================
log_info "Instalando dependências..."
echo ""

# Node.js dependencies
if [ "$SKIP_NODE" = false ]; then
    log_info "Instalando dependências Node.js..."
    if ! npm install; then
        log_error "Falha ao instalar dependências Node.js"
        exit 1
    fi
    log_success "Dependências Node.js instaladas"
fi

echo ""

# Python dependencies
if [ "$SKIP_PYTHON" = false ]; then
    log_info "Instalando dependências Python..."
    
    PYTHON_CMD=""
    if check_command python3; then
        PYTHON_CMD="python3"
    elif check_command python; then
        PYTHON_CMD="python"
    fi
    
    if [ -n "$PYTHON_CMD" ] && [ -f "py_engine/requirements.txt" ]; then
        if ! $PYTHON_CMD -m pip install -r py_engine/requirements.txt; then
            log_error "Falha ao instalar dependências Python"
            exit 1
        fi
        log_success "Dependências Python instaladas"
    else
        log_warn "requirements.txt não encontrado"
    fi
fi

echo ""

# ============================================
# ENVIRONMENT CONFIGURATION
# ============================================
log_info "Configurando ambiente..."

if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        log_success "Arquivo .env criado a partir do exemplo"
        echo "  Edite .env para configurar sua GROQ_API_KEY"
    else
        # Create minimal .env
        cat > .env << 'EOF'
# SIS RUA Unified - Local Development
NODE_ENV=development
PORT=3001
PYTHON_COMMAND=python3
OFFLINE_MODE=true

# GROQ AI (opcional, para busca inteligente)
# GROQ_API_KEY=your-key-here
EOF
        log_success "Arquivo .env criado com configurações padrão"
    fi
else
    log_info "Arquivo .env já existe"
fi

echo ""

# ============================================
# CREATE REQUIRED DIRECTORIES
# ============================================
log_info "Criando diretórios necessários..."

mkdir -p public/dxf cache logs
log_success "Diretórios criados"

echo ""

# ============================================
# VALIDATION
# ============================================
log_info "Validando instalação..."
echo ""

# Test Python
PYTHON_CMD=""
if check_command python3; then
    PYTHON_CMD="python3"
elif check_command python; then
    PYTHON_CMD="python"
fi

if [ -n "$PYTHON_CMD" ]; then
    PY_VERSION=$($PYTHON_CMD --version 2>&1)
    log_success "Python: $PY_VERSION"
    
    # Test if ezdxf and osmnx are available
    if $PYTHON_CMD -c "import ezdxf, osmnx; print('OK')" 2>/dev/null; then
        log_success "Bibliotecas Python (ezdxf, osmnx) instaladas"
    else
        log_warn "Algumas bibliotecas Python não encontradas"
        echo "  Execute: pip install -r py_engine/requirements.txt"
    fi
fi

# Test Node.js
if check_command node; then
    NODE_V=$(node --version)
    NPM_V=$(npm --version)
    log_success "Node.js: $NODE_V, npm: $NPM_V"
fi

echo ""

# ============================================
# COMPLETION
# ============================================
echo -e "${GREEN}========================================${NC}"
log_success "Setup local concluído!"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Para iniciar o desenvolvimento:"
echo ""
echo "  1. npm run dev          - Inicia frontend + backend"
echo "  2. Ou execute separado:"
echo "     npm run server       - Backend apenas (porta 3001)"
echo "     npm run client       - Frontend apenas (porta 3000)"
echo ""
echo "URLs:"
echo "  - Frontend: http://localhost:3000"
echo "  - Backend:  http://localhost:3001"
echo "  - API Docs: http://localhost:3001/api-docs"
echo ""
echo "Para configurar AI search, edite .env e adicione GROQ_API_KEY"
echo "Obtenha uma chave gratuita em: https://console.groq.com/keys"
echo ""
