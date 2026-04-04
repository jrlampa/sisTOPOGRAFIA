#!/usr/bin/env pwsh
# Script de Teste - APIs Brasileiras Integradas
# Testa IBGE, TOPODATA e Geocoding com dados brasileiros

param(
    [switch]$Verbose
)

$ErrorActionPreference = "Continue"

# Colors
$Green = "`e[32m"
$Red = "`e[31m"
$Yellow = "`e[33m"
$Blue = "`e[34m"
$Reset = "`e[0m"

$TestsPassed = 0
$TestsFailed = 0

function Test-Endpoint { 
    param($Name, $Method, $Url, $Body = $null, $ExpectedStatus = 200)
    
    Write-Host "`n$Blue[TEST]$Reset $Name" -NoNewline
    
    try {
        $params = @{
            Uri = $Url
            Method = $Method
            ContentType = "application/json"
            TimeoutSec = 30
        }
        
        if ($Body) {
            $params.Body = $Body
        }
        
        $response = Invoke-RestMethod @params -ErrorAction Stop
        $status = 200  # Success means 200 for Invoke-RestMethod
        
        if ($status -eq $ExpectedStatus) {
            Write-Host " $Green✓ PASS$Reset"
            $script:TestsPassed++
            if ($Verbose) {
                Write-Host "  Response: $($response | ConvertTo-Json -Depth 2)" -ForegroundColor Gray
            }
            return $response
        } else {
            Write-Host " $Red✗ FAIL$Reset (Status: $status, Expected: $ExpectedStatus)"
            $script:TestsFailed++
            return $null
        }
    } catch {
        Write-Host " $Red✗ FAIL$Reset"
        Write-Host "  Error: $_" -ForegroundColor Red
        $script:TestsFailed++
        return $null
    }
}

# ============================================
# HEADER
# ============================================
Write-Host ""
Write-Host "$Blue========================================$Reset"
Write-Host "$Blue  Teste de APIs Brasileiras$Reset"
Write-Host "$Blue  Sis RUA Unified$Reset"
Write-Host "$Blue========================================$Reset"
Write-Host ""

$BaseUrl = "http://localhost:3001"

# Check if server is running
Write-Host "Verificando servidor..." -NoNewline
try {
    $health = Invoke-RestMethod -Uri "$BaseUrl/health" -TimeoutSec 5
    Write-Host " $Green✓ Online$Reset"
    Write-Host "  Environment: $($health.environment)"
    Write-Host "  Python: $($health.python)"
} catch {
    Write-Host " $Red✗ Offline$Reset"
    Write-Host "`nInicie o servidor primeiro: npm run server" -ForegroundColor Yellow
    exit 1
}

# ============================================
# TESTES IBGE
# ============================================
Write-Host "`n$Blue========================================$Reset"
Write-Host "$Blue  TESTES IBGE$Reset"
Write-Host "$Blue========================================$Reset"

# Test 1: Listar estados
Test-Endpoint -Name "IBGE - Listar Estados" `
    -Method GET `
    -Url "$BaseUrl/api/ibge/states"

# Test 2: Municípios de SP
Test-Endpoint -Name "IBGE - Municípios de SP" `
    -Method GET `
    -Url "$BaseUrl/api/ibge/municipios/SP"

# Test 3: Reverse geocoding - São Paulo
$response = Test-Endpoint -Name "IBGE - Reverse Geocoding (São Paulo)" `
    -Method GET `
    -Url "$BaseUrl/api/ibge/location?lat=-23.55052&lng=-46.63331"

if ($response -and $response.municipio) {
    Write-Host "  → Municipio: $($response.municipio), $($response.uf)" -ForegroundColor Cyan
}

# Test 4: Reverse geocoding - Campinas
$response = Test-Endpoint -Name "IBGE - Reverse Geocoding (Campinas)" `
    -Method GET `
    -Url "$BaseUrl/api/ibge/location?lat=-22.9099&lng=-47.0626"

if ($response -and $response.municipio) {
    Write-Host "  → Municipio: $($response.municipio), $($response.uf)" -ForegroundColor Cyan
}

# ============================================
# TESTES GEOCODING COM IBGE
# ============================================
Write-Host "`n$Blue========================================$Reset"
Write-Host "$Blue  TESTES GEOCODING (IBGE Integration)$Reset"
Write-Host "$Blue========================================$Reset"

# Test 5: Busca por município
$testMunicipios = @(
    @{ name = "São Paulo, SP"; expected = "São Paulo" },
    @{ name = "Campinas"; expected = "Campinas" },
    @{ name = "Rio de Janeiro, RJ"; expected = "Rio de Janeiro" }
)

foreach ($mun in $testMunicipios) {
    $body = @{ query = $mun.name } | ConvertTo-Json
    $response = Test-Endpoint -Name "Geocoding - $($mun.name)" `
        -Method POST `
        -Url "$BaseUrl/api/search" `
        -Body $body
    
    if ($response -and $response.label -and $response.label -match $mun.expected) {
        Write-Host "  → Encontrado: $($response.label)" -ForegroundColor Cyan
    }
}

# ============================================
# TESTES ELEVATION
# ============================================
Write-Host "`n$Blue========================================$Reset"
Write-Host "$Blue  TESTES ELEVATION (TOPODATA Integration)$Reset"
Write-Host "$Blue========================================$Reset"

# Test 6: Perfil de elevação no Brasil (deve usar TOPODATA)
$body = @{
    start = @{ lat = -22.9; lng = -47.0 }
    end = @{ lat = -22.95; lng = -47.1 }
    steps = 5
} | ConvertTo-Json

$response = Test-Endpoint -Name "Elevation - São Paulo (TOPODATA)" `
    -Method POST `
    -Url "$BaseUrl/api/elevation/profile" `
    -Body $body

if ($response -and $response.profile) {
    Write-Host "  → Pontos: $($response.profile.Count)" -ForegroundColor Cyan
    Write-Host "  → Elevação inicial: $($response.profile[0].elev)m" -ForegroundColor Cyan
    Write-Host "  → Elevação final: $($response.profile[-1].elev)m" -ForegroundColor Cyan
}

# Test 7: Perfil fora do Brasil (fallback para open-elevation)
$body = @{
    start = @{ lat = 48.8566; lng = 2.3522 }  # Paris
    end = @{ lat = 48.8589; lng = 2.3470 }
    steps = 5
} | ConvertTo-Json

$response = Test-Endpoint -Name "Elevation - Paris (Open-Elevation fallback)" `
    -Method POST `
    -Url "$BaseUrl/api/elevation/profile" `
    -Body $body

# ============================================
# SUMMARY
# ============================================
Write-Host "`n$Blue========================================$Reset"
Write-Host "$Blue  RESULTADO$Reset"
Write-Host "$Blue========================================$Reset"
Write-Host ""

$total = $TestsPassed + $TestsFailed
Write-Host "Total de testes: $total"
Write-Host "  $Green✓ Passaram:$Reset $TestsPassed"
Write-Host "  $Red✗ Falharam:$Reset $TestsFailed"
Write-Host ""

if ($TestsFailed -eq 0) {
    Write-Host "$Green✅ TODOS OS TESTES PASSARAM!$Reset"
    Write-Host "`nAs integrações IBGE e TOPODATA estão funcionando corretamente."
    exit 0
} else {
    Write-Host "$Yellow⚠ ALGUNS TESTES FALHARAM$Reset"
    Write-Host "`nVerifique os logs do servidor para mais detalhes."
    exit 1
}
