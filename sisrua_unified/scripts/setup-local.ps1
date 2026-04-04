#!/usr/bin/env pwsh
# SIS RUA Unified - Local Setup Script (Windows)
# Configura ambiente de desenvolvimento local sem Docker

param(
    [switch]$SkipNode,
    [switch]$SkipPython,
    [switch]$Verbose
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "Continue"

# Colors
$Green = "`e[32m"
$Red = "`e[31m"
$Yellow = "`e[33m"
$Blue = "`e[34m"
$Reset = "`e[0m"

function Write-Status { param($Message, $Type = "info")
    switch ($Type) {
        "success" { Write-Host "$Green✓$Reset $Message" }
        "error" { Write-Host "$Red✗$Reset $Message" }
        "warning" { Write-Host "$Yellow⚠$Reset $Message" }
        "info" { Write-Host "$Blueℹ$Reset $Message" }
    }
}

function Test-Command { param($Command)
    return [bool](Get-Command $Command -ErrorAction SilentlyContinue)
}

function Get-NodeVersion {
    try {
        $version = & node --version 2>$null
        return $version -replace 'v', ''
    } catch {
        return $null
    }
}

function Get-PythonVersion {
    try {
        $version = & python --version 2>&1
        if ($version -match "Python (\d+\.\d+)") {
            return $Matches[1]
        }
        # Try python3
        $version = & python3 --version 2>&1
        if ($version -match "Python (\d+\.\d+)") {
            return $Matches[1]
        }
        return $null
    } catch {
        return $null
    }
}

function Test-VersionRequirement { param($Version, $Required)
    try {
        $v = [Version]$Version
        $r = [Version]$Required
        return $v -ge $r
    } catch {
        return $false
    }
}

# ============================================
# HEADER
# ============================================
Write-Host ""
Write-Host "$Blue========================================$Reset"
Write-Host "$Blue  SIS RUA Unified - Local Setup$Reset"
Write-Host "$Blue  Modo Enterprise (Sem Docker)$Reset"
Write-Host "$Blue========================================$Reset"
Write-Host ""

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

Write-Status "Diretório do projeto: $projectRoot" "info"
Write-Host ""

# ============================================
# CHECK PREREQUISITES
# ============================================
Write-Status "Verificando pré-requisitos..." "info"
$checks = @{}

# Node.js
if (-not $SkipNode) {
    $nodeVersion = Get-NodeVersion
    $checks.NodeInstalled = [bool]$nodeVersion
    $checks.NodeVersion = $nodeVersion
    $checks.NodeOk = Test-VersionRequirement $nodeVersion "22.0"
    
    if ($checks.NodeOk) {
        Write-Status "Node.js $nodeVersion encontrado" "success"
    } elseif ($checks.NodeInstalled) {
        Write-Status "Node.js $nodeVersion encontrado (recomendado: 22+)" "warning"
    } else {
        Write-Status "Node.js não encontrado" "error"
        Write-Host "  Baixe em: https://nodejs.org/ (recomendado: LTS)"
    }
}

# Python
if (-not $SkipPython) {
    $pythonVersion = Get-PythonVersion
    $checks.PythonInstalled = [bool]$pythonVersion
    $checks.PythonVersion = $pythonVersion
    $checks.PythonOk = Test-VersionRequirement $pythonVersion "3.9"
    
    if ($checks.PythonOk) {
        Write-Status "Python $pythonVersion encontrado" "success"
    } elseif ($checks.PythonInstalled) {
        Write-Status "Python $pythonVersion encontrado (recomendado: 3.9+)" "warning"
    } else {
        Write-Status "Python não encontrado" "error"
        Write-Host "  Baixe em: https://python.org/downloads/"
    }
}

# Git
$checks.GitOk = Test-Command "git"
if ($checks.GitOk) {
    Write-Status "Git encontrado" "success"
} else {
    Write-Status "Git não encontrado (opcional)" "warning"
}

# Critical checks
$criticalOk = ($SkipNode -or $checks.NodeOk) -and ($SkipPython -or $checks.PythonOk)

if (-not $criticalOk) {
    Write-Host ""
    Write-Status "Pré-requisitos críticos não atendidos!" "error"
    Write-Host ""
    Write-Host "Instale os componentes acima e execute novamente."
    exit 1
}

Write-Host ""
Write-Status "Todos os pré-requisitos atendidos!" "success"
Write-Host ""

# ============================================
# INSTALL DEPENDENCIES
# ============================================
Write-Status "Instalando dependências..." "info"
Write-Host ""

# Node.js dependencies
if (-not $SkipNode) {
    Write-Status "Instalando dependências Node.js..." "info"
    try {
        npm install
        Write-Status "Dependências Node.js instaladas" "success"
    } catch {
        Write-Status "Falha ao instalar dependências Node.js: $_" "error"
        exit 1
    }
}

Write-Host ""

# Python dependencies
if (-not $SkipPython) {
    Write-Status "Instalando dependências Python..." "info"
    
    $pythonCmd = if (Test-Command "python3") { "python3" } else { "python" }
    $reqFile = Join-Path $projectRoot "py_engine\requirements.txt"
    
    if (Test-Path $reqFile) {
        try {
            & $pythonCmd -m pip install -r $reqFile
            Write-Status "Dependências Python instaladas" "success"
        } catch {
            Write-Status "Falha ao instalar dependências Python: $_" "error"
            exit 1
        }
    } else {
        Write-Status "requirements.txt não encontrado" "warning"
    }
}

Write-Host ""

# ============================================
# ENVIRONMENT CONFIGURATION
# ============================================
Write-Status "Configurando ambiente..." "info"

$envFile = Join-Path $projectRoot ".env"
$envExample = Join-Path $projectRoot ".env.example"

if (-not (Test-Path $envFile)) {
    if (Test-Path $envExample) {
        Copy-Item $envExample $envFile
        Write-Status "Arquivo .env criado a partir do exemplo" "success"
        Write-Host "  Edite $envFile para configurar sua GROQ_API_KEY" -ForegroundColor Yellow
    } else {
        # Create minimal .env
        @"
# SIS RUA Unified - Local Development
NODE_ENV=development
PORT=3001
PYTHON_COMMAND=python
OFFLINE_MODE=true

# GROQ AI (opcional, para busca inteligente)
# GROQ_API_KEY=your-key-here
"@ | Out-File -FilePath $envFile -Encoding UTF8
        Write-Status "Arquivo .env criado com configurações padrão" "success"
    }
} else {
    Write-Status "Arquivo .env já existe" "info"
}

Write-Host ""

# ============================================
# CREATE REQUIRED DIRECTORIES
# ============================================
Write-Status "Criando diretórios necessários..." "info"

$dirs = @(
    "public\dxf",
    "cache",
    "logs"
)

foreach ($dir in $dirs) {
    $fullPath = Join-Path $projectRoot $dir
    if (-not (Test-Path $fullPath)) {
        New-Item -ItemType Directory -Path $fullPath -Force | Out-Null
        Write-Status "Criado: $dir" "info"
    }
}

Write-Host ""

# ============================================
# VALIDATION
# ============================================
Write-Status "Validando instalação..." "info"
Write-Host ""

# Test Python bridge
$pythonCmd = if (Test-Command "python3") { "python3" } else { "python" }
try {
    $pyVersion = & $pythonCmd --version 2>&1
    Write-Status "Python: $pyVersion" "success"
    
    # Test if ezdxf and osmnx are available
    $testScript = @"
import sys
try:
    import ezdxf
    import osmnx
    print('OK')
except ImportError as e:
    print(f'MISSING:{e}')
    sys.exit(1)
"@
    $result = & $pythonCmd -c $testScript 2>&1
    if ($result -eq "OK") {
        Write-Status "Bibliotecas Python (ezdxf, osmnx) instaladas" "success"
    } else {
        Write-Status "Algumas bibliotecas Python não encontradas" "warning"
        Write-Host "  Execute: pip install -r py_engine/requirements.txt"
    }
} catch {
    Write-Status "Erro ao verificar Python: $_" "error"
}

# Test Node.js
try {
    $nodeV = & node --version
    $npmV = & npm --version
    Write-Status "Node.js: $nodeV, npm: $npmV" "success"
} catch {
    Write-Status "Erro ao verificar Node.js" "error"
}

Write-Host ""

# ============================================
# COMPLETION
# ============================================
Write-Host "$Green========================================$Reset"
Write-Status "Setup local concluído!" "success"
Write-Host "$Green========================================$Reset"
Write-Host ""
Write-Host "Para iniciar o desenvolvimento:"
Write-Host ""
Write-Host "  1. npm run dev          - Inicia frontend + backend"
Write-Host "  2. Ou execute separado:"
Write-Host "     npm run server       - Backend apenas (porta 3001)"
Write-Host "     npm run client       - Frontend apenas (porta 3000)"
Write-Host ""
Write-Host "URLs:"
Write-Host "  - Frontend: http://localhost:3000"
Write-Host "  - Backend:  http://localhost:3001"
Write-Host "  - API Docs: http://localhost:3001/api-docs"
Write-Host ""
Write-Host "Para configurar AI search, edite .env e adicione GROQ_API_KEY"
Write-Host "Obtenha uma chave gratuita em: https://console.groq.com/keys"
Write-Host ""
