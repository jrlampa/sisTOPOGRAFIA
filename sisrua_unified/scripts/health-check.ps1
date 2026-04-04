#!/usr/bin/env pwsh
# SIS RUA Unified - Health Check / Validation Script
# Verifica se o sistema está pronto para uso local

param(
    [switch]$Verbose,
    [switch]$Fix
)

$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"

# Colors
$Green = "`e[32m"
$Red = "`e[31m"
$Yellow = "`e[33m"
$Blue = "`e[34m"
$Reset = "`e[0m"

$ChecksPassed = 0
$ChecksFailed = 0
$ChecksWarning = 0

function Write-Check { param($Name, $Status, $Message = "")
    switch ($Status) {
        "PASS" { 
            Write-Host "$Green[PASS]$Reset $Name" 
            if ($Message) { Write-Host "      $Message" -ForegroundColor Gray }
            $script:ChecksPassed++
        }
        "FAIL" { 
            Write-Host "$Red[FAIL]$Reset $Name" 
            if ($Message) { Write-Host "      $Message" -ForegroundColor Red }
            $script:ChecksFailed++
        }
        "WARN" { 
            Write-Host "$Yellow[WARN]$Reset $Name" 
            if ($Message) { Write-Host "      $Message" -ForegroundColor Yellow }
            $script:ChecksWarning++
        }
    }
}

function Test-Command { param($Command)
    return [bool](Get-Command $Command -ErrorAction SilentlyContinue)
}

# ============================================
# HEADER
# ============================================
Write-Host ""
Write-Host "$Blue========================================$Reset"
Write-Host "$Blue  SIS RUA Unified - Health Check$Reset"
Write-Host "$Blue========================================$Reset"
Write-Host ""

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

Write-Host "Diretório: $projectRoot" -ForegroundColor Gray
Write-Host ""

# ============================================
# CHECKS
# ============================================

# 1. Node.js
Write-Host "Verificando Node.js..." -ForegroundColor Cyan
$nodeVersion = $null
try {
    $nodeVersion = & node --version 2>$null
    if ($nodeVersion) {
        $v = $nodeVersion -replace 'v', ''
        $ver = [Version]$v
        if ($ver.Major -ge 22) {
            Write-Check "Node.js" "PASS" "Versão $v"
        } else {
            Write-Check "Node.js" "WARN" "Versão $v (recomendado: 22+)"
        }
    } else {
        Write-Check "Node.js" "FAIL" "Não encontrado no PATH"
    }
} catch {
    Write-Check "Node.js" "FAIL" "Erro: $_"
}

# 2. Python
Write-Host "`nVerificando Python..." -ForegroundColor Cyan
$pythonFound = $false
foreach ($pyCmd in @("python3", "python")) {
    if (Test-Command $pyCmd) {
        try {
            $pyVersion = & $pyCmd --version 2>&1
            if ($pyVersion -match "Python (\d+\.\d+)") {
                $v = $Matches[1]
                $ver = [Version]$v
                if ($ver.Major -eq 3 -and $ver.Minor -ge 9) {
                    Write-Check "Python ($pyCmd)" "PASS" "Versão $v"
                    $pythonFound = $true
                    break
                } else {
                    Write-Check "Python ($pyCmd)" "WARN" "Versão $v (recomendado: 3.9+)"
                    $pythonFound = $true
                    break
                }
            }
        } catch {
            continue
        }
    }
}
if (-not $pythonFound) {
    Write-Check "Python" "FAIL" "Não encontrado (tente: python3 ou python)"
}

# 3. Dependências Node
Write-Host "`nVerificando dependências Node.js..." -ForegroundColor Cyan
if (Test-Path "node_modules") {
    $pkgCount = (Get-ChildItem node_modules -Directory | Measure-Object).Count
    if ($pkgCount -gt 0) {
        Write-Check "node_modules" "PASS" "$pkgCount pacotes instalados"
    } else {
        Write-Check "node_modules" "FAIL" "Diretório vazio - execute: npm install"
    }
} else {
    Write-Check "node_modules" "FAIL" "Não encontrado - execute: npm install"
}

# 4. Dependências Python
Write-Host "`nVerificando dependências Python..." -ForegroundColor Cyan
$pythonCmd = if (Test-Command "python3") { "python3" } elseif (Test-Command "python") { "python" } else { $null }

if ($pythonCmd) {
    # Check ezdxf
    try {
        $result = & $pythonCmd -c "import ezdxf; print('OK')" 2>&1
        if ($result -eq "OK") {
            Write-Check "ezdxf" "PASS"
        } else {
            Write-Check "ezdxf" "FAIL" "Execute: pip install ezdxf"
        }
    } catch {
        Write-Check "ezdxf" "FAIL" "Não instalado"
    }
    
    # Check osmnx
    try {
        $result = & $pythonCmd -c "import osmnx; print('OK')" 2>&1
        if ($result -eq "OK") {
            Write-Check "osmnx" "PASS"
        } else {
            Write-Check "osmnx" "FAIL" "Execute: pip install osmnx"
        }
    } catch {
        Write-Check "osmnx" "FAIL" "Não instalado"
    }
    
    # Check shapely
    try {
        $result = & $pythonCmd -c "import shapely; print('OK')" 2>&1
        if ($result -eq "OK") {
            Write-Check "shapely" "PASS"
        } else {
            Write-Check "shapely" "FAIL" "Execute: pip install shapely"
        }
    } catch {
        Write-Check "shapely" "FAIL" "Não instalado"
    }
} else {
    Write-Check "Bibliotecas Python" "SKIP" "Python não encontrado"
}

# 5. Arquivos de configuração
Write-Host "`nVerificando arquivos de configuração..." -ForegroundColor Cyan
if (Test-Path ".env") {
    $envContent = Get-Content ".env" -Raw
    if ($envContent -match "OFFLINE_MODE\s*=\s*true") {
        Write-Check ".env (OFFLINE_MODE)" "PASS" "Modo offline ativado"
    } else {
        Write-Check ".env (OFFLINE_MODE)" "WARN" "OFFLINE_MODE não definido"
    }
    
    if ($envContent -match "GROQ_API_KEY") {
        if ($envContent -match "GROQ_API_KEY\s*=\s*gsk_") {
            Write-Check ".env (GROQ)" "PASS" "API key configurada"
        } else {
            Write-Check ".env (GROQ)" "WARN" "API key parece inválida"
        }
    } else {
        Write-Check ".env (GROQ)" "WARN" "GROQ_API_KEY não configurada (opcional)"
    }
} else {
    Write-Check ".env" "WARN" "Arquivo não encontrado - copie de .env.example"
}

# 6. Diretórios necessários
Write-Host "`nVerificando diretórios..." -ForegroundColor Cyan
$requiredDirs = @("public\dxf", "cache", "logs")
foreach ($dir in $requiredDirs) {
    if (Test-Path $dir) {
        Write-Check "$dir" "PASS"
    } else {
        Write-Check "$dir" "WARN" "Diretório não existe (será criado automaticamente)"
        if ($Fix) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
            Write-Host "      Criado: $dir" -ForegroundColor Green
        }
    }
}

# 7. Scripts Python
Write-Host "`nVerificando scripts Python..." -ForegroundColor Cyan
$pyScripts = @(
    @("py_engine\main.py", "Entry point principal"),
    @("py_engine\dxf_generator.py", "Gerador de DXF"),
    @("py_engine\controller.py", "Controller OSM"),
    @("py_engine\create_demo_dxf.py", "Gerador demo")
)
foreach ($script in $pyScripts) {
    $path = $script[0]
    $desc = $script[1]
    if (Test-Path $path) {
        Write-Check "$path" "PASS" $desc
    } else {
        Write-Check "$path" "FAIL" "$desc - ARQUIVO FALTANDO!"
    }
}

# 8. Backend compilável
Write-Host "`nVerificando TypeScript..." -ForegroundColor Cyan
try {
    $tscOutput = & npx tsc --noEmit 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Check "TypeScript" "PASS" "Sem erros de compilação"
    } else {
        $errorCount = ($tscOutput | Select-String "error TS").Count
        Write-Check "TypeScript" "WARN" "$errorCount erros de tipo (não crítico para execução)"
        if ($Verbose) {
            $tscOutput | Select-Object -First 10 | ForEach-Object { Write-Host "      $_" -ForegroundColor Gray }
        }
    }
} catch {
    Write-Check "TypeScript" "WARN" "Não foi possível verificar"
}

# 9. Portas disponíveis
Write-Host "`nVerificando portas..." -ForegroundColor Cyan
$ports = @(3000, 3001, 8080)
foreach ($port in $ports) {
    $listener = $null
    try {
        $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $port)
        $listener.Start()
        $listener.Stop()
        Write-Check "Porta $port" "PASS" "Disponível"
    } catch {
        Write-Check "Porta $port" "WARN" "Possivelmente em uso"
    } finally {
        if ($listener) { $listener.Stop() }
    }
}

# ============================================
# SUMMARY
# ============================================
Write-Host ""
Write-Host "$Blue========================================$Reset"
Write-Host "$Blue  RESULTADO$Reset"
Write-Host "$Blue========================================$Reset"
Write-Host ""

$total = $ChecksPassed + $ChecksFailed + $ChecksWarning
Write-Host "Total de verificações: $total"
Write-Host "  $Green✓ Passaram:$Reset $ChecksPassed"
Write-Host "  $Yellow⚠ Avisos:$Reset $ChecksWarning"
Write-Host "  $Red✗ Falharam:$Reset $ChecksFailed"
Write-Host ""

if ($ChecksFailed -eq 0) {
    if ($ChecksWarning -eq 0) {
        Write-Host "$Green✅ SISTEMA PRONTO!$Reset" -ForegroundColor Green
        Write-Host ""
        Write-Host "Para iniciar:"
        Write-Host "  npm run dev"
        Write-Host ""
        exit 0
    } else {
        Write-Host "$Yellow⚡ SISTEMA FUNCIONAL COM AVISOS$Reset" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "O sistema deve funcionar, mas considere corrigir os avisos."
        Write-Host ""
        exit 0
    }
} else {
    Write-Host "$Red❌ SISTEMA NÃO PRONTO$Reset" -ForegroundColor Red
    Write-Host ""
    Write-Host "Corrija os erros acima antes de iniciar."
    Write-Host ""
    Write-Host "Dica: Execute com -Fix para tentar correções automáticas:"
    Write-Host "  .\scripts\health-check.ps1 -Fix"
    Write-Host ""
    exit 1
}
