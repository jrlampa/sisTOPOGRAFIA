#!/usr/bin/env pwsh
param(
    [switch]$Verbose,
    [switch]$Fix
)

$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'

$ChecksPassed = 0
$ChecksFailed = 0
$ChecksWarning = 0

function Add-CheckResult {
    param(
        [string]$Name,
        [ValidateSet('PASS','FAIL','WARN')]
        [string]$Status,
        [string]$Message = ''
    )

    switch ($Status) {
        'PASS' {
            $script:ChecksPassed++
            Write-Host "[PASS] $Name"
        }
        'FAIL' {
            $script:ChecksFailed++
            Write-Host "[FAIL] $Name" -ForegroundColor Red
        }
        'WARN' {
            $script:ChecksWarning++
            Write-Host "[WARN] $Name" -ForegroundColor Yellow
        }
    }

    if ($Message) {
        Write-Host "       $Message"
    }
}

function Test-CommandExists {
    param([string]$Command)
    return [bool](Get-Command $Command -ErrorAction SilentlyContinue)
}

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

Write-Host ''
Write-Host '========================================'
Write-Host '  SIS RUA Unified - Health Check'
Write-Host '========================================'
Write-Host "Directory: $projectRoot"
Write-Host ''

# Node.js
if (Test-CommandExists 'node') {
    $nodeVersion = node --version 2>$null
    Add-CheckResult -Name 'Node.js' -Status 'PASS' -Message "Version $nodeVersion"
} else {
    Add-CheckResult -Name 'Node.js' -Status 'FAIL' -Message 'Node not found in PATH'
}

# npm
if (Test-CommandExists 'npm') {
    $npmVersion = npm --version 2>$null
    Add-CheckResult -Name 'npm' -Status 'PASS' -Message "Version $npmVersion"
} else {
    Add-CheckResult -Name 'npm' -Status 'FAIL' -Message 'npm not found in PATH'
}

# Python
if (Test-CommandExists 'python') {
    $pyVersion = python --version 2>&1
    Add-CheckResult -Name 'Python' -Status 'PASS' -Message $pyVersion
} elseif (Test-CommandExists 'python3') {
    $pyVersion = python3 --version 2>&1
    Add-CheckResult -Name 'Python' -Status 'PASS' -Message $pyVersion
} else {
    Add-CheckResult -Name 'Python' -Status 'WARN' -Message 'Python not found (required only for py_engine workflows)'
}

# node_modules
if (Test-Path 'node_modules') {
    Add-CheckResult -Name 'node_modules' -Status 'PASS'
} else {
    Add-CheckResult -Name 'node_modules' -Status 'FAIL' -Message 'Run npm install'
}

# .env
if (Test-Path '.env') {
    Add-CheckResult -Name '.env' -Status 'PASS'
} else {
    Add-CheckResult -Name '.env' -Status 'WARN' -Message 'Missing .env (use .env.example as base)'
}

# Required directories
$requiredDirs = @('public/dxf', 'cache', 'logs')
foreach ($dir in $requiredDirs) {
    if (Test-Path $dir) {
        Add-CheckResult -Name "dir:$dir" -Status 'PASS'
    } else {
        if ($Fix) {
            New-Item -ItemType Directory -Force -Path $dir | Out-Null
            Add-CheckResult -Name "dir:$dir" -Status 'PASS' -Message 'Created automatically'
        } else {
            Add-CheckResult -Name "dir:$dir" -Status 'WARN' -Message 'Directory missing'
        }
    }
}

# TypeScript
$tscOutput = npx tsc --noEmit 2>&1
if ($LASTEXITCODE -eq 0) {
    Add-CheckResult -Name 'TypeScript' -Status 'PASS' -Message 'No compile errors'
} else {
    $tsErrors = ($tscOutput | Select-String 'error TS').Count
    Add-CheckResult -Name 'TypeScript' -Status 'WARN' -Message "$tsErrors TS errors detected"
    if ($Verbose) {
        $tscOutput | Select-Object -First 10 | ForEach-Object { Write-Host "       $_" }
    }
}

# Ports
$ports = @(3000, 3001, 4173)
foreach ($port in $ports) {
    $listener = $null
    try {
        $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $port)
        $listener.Start()
        Add-CheckResult -Name "port:$port" -Status 'PASS' -Message 'Available'
    } catch {
        Add-CheckResult -Name "port:$port" -Status 'WARN' -Message 'In use (may be expected if services are running)'
    } finally {
        if ($listener) { $listener.Stop() }
    }
}

Write-Host ''
Write-Host '========================================'
Write-Host '  RESULT'
Write-Host '========================================'
Write-Host "Passed : $ChecksPassed"
Write-Host "Warning: $ChecksWarning"
Write-Host "Failed : $ChecksFailed"
Write-Host ''

if ($ChecksFailed -gt 0) {
    Write-Host '[ERROR] System not ready.' -ForegroundColor Red
    exit 1
}

if ($ChecksWarning -gt 0) {
    Write-Host '[WARN] System functional with warnings.' -ForegroundColor Yellow
    exit 0
}

Write-Host '[SUCCESS] System ready.' -ForegroundColor Green
exit 0
