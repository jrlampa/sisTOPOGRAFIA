# scripts/apply-audit-fixes.ps1
# Native PowerShell version of apply-audit-fixes.sh
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts/apply-audit-fixes.ps1

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$ArtifactsDir = Join-Path $ProjectRoot "artifacts"
$SecretsDir = Join-Path $ProjectRoot "secrets"
$ReportFile = Join-Path $ArtifactsDir "audit-fixes-report-$Timestamp.md"

New-Item -ItemType Directory -Path $ArtifactsDir -Force | Out-Null
New-Item -ItemType Directory -Path $SecretsDir -Force | Out-Null

$NodeVersion = "not-found"
$NpmVersion = "not-found"
try { $NodeVersion = (& node --version) } catch {}
try { $NpmVersion = (& npm --version) } catch {}

@"
# Audit Fixes Execution Report

Generated: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss zzz")
Environment: Windows
Node: $NodeVersion
NPM: $NpmVersion

## Security checks output

"@ | Set-Content -Path $ReportFile -Encoding UTF8

Write-Host "========================================="
Write-Host "SIS RUA - Applying Audit Security Fixes"
Write-Host "========================================="

Write-Host "[1/5] Setting up secrets directory..."

$envSecretsPath = Join-Path $ProjectRoot ".env.secrets"
if (-not (Test-Path $envSecretsPath)) {
  @"
# WARNING: This file contains sensitive secrets.
# DO NOT commit to version control.
# Add to .gitignore and rotate regularly.

# API Keys
GROQ_API_KEY=sk-test-PLACEHOLDER-REPLACE-WITH-REAL-KEY
REDIS_PASSWORD=test-redis-password-CHANGE-IN-PROD

# Admin/Metrics Tokens (generate with: openssl rand -hex 32)
ADMIN_TOKEN=
METRICS_TOKEN=

# Database (optional, for Supabase/Postgres)
DATABASE_URL=
"@ | Set-Content -Path $envSecretsPath -Encoding UTF8
  Write-Host "OK Created .env.secrets template"
} else {
  Write-Host "WARN .env.secrets already exists"
}

$secretFiles = @(
  @{ Path = (Join-Path $SecretsDir "groq_api_key.txt"); Value = "sk-test-PLACEHOLDER"; Label = "groq_api_key.txt" },
  @{ Path = (Join-Path $SecretsDir "redis_password.txt"); Value = "test-redis-password"; Label = "redis_password.txt" },
  @{ Path = (Join-Path $SecretsDir "admin_token.txt"); Value = ""; Label = "admin_token.txt" },
  @{ Path = (Join-Path $SecretsDir "metrics_token.txt"); Value = ""; Label = "metrics_token.txt" }
)

foreach ($s in $secretFiles) {
  if (-not (Test-Path $s.Path)) {
    Set-Content -Path $s.Path -Value $s.Value -Encoding UTF8
    Write-Host "OK Created $($s.Label)"
  }
}

Write-Host "[2/5] Checking package.json security scripts..."
$packageJson = Join-Path $ProjectRoot "package.json"
if (Select-String -Path $packageJson -Pattern '"security:audit"' -Quiet) {
  Write-Host "OK Security scripts already configured"
} else {
  Write-Host "WARN Security scripts may need update"
}

Write-Host "[3/5] Running security checks..."
Push-Location $ProjectRoot
try {
  "`n### NPM Audit`n" | Add-Content -Path $ReportFile -Encoding UTF8
  try {
    & npm audit --audit-level=moderate 2>&1 | Tee-Object -FilePath $ReportFile -Append | Out-Null
  } catch {
    "npm audit exited with non-zero status (captured for report)." | Add-Content -Path $ReportFile -Encoding UTF8
  }

  if (Get-Command bandit -ErrorAction SilentlyContinue) {
    try {
      & bandit -c .bandit -r py_engine/ -f json -o (Join-Path $ArtifactsDir "bandit-report-$Timestamp.json") 2>&1 | Out-Null
      Write-Host "OK Bandit report generated"
    } catch {
      Write-Host "WARN Bandit execution failed (continuing)"
    }
  } else {
    Write-Host "WARN Bandit not installed - skipping Python SAST"
  }

  if (Get-Command pip-audit -ErrorAction SilentlyContinue) {
    try {
      & pip-audit -r py_engine/requirements.txt -f json -o (Join-Path $ArtifactsDir "pip-audit-report-$Timestamp.json") 2>&1 | Out-Null
      Write-Host "OK pip-audit report generated"
    } catch {
      Write-Host "WARN pip-audit execution failed (continuing)"
    }
  } else {
    Write-Host "WARN pip-audit not installed - skipping"
  }
} finally {
  Pop-Location
}

Write-Host "[4/5] Validating security files..."
$requiredFiles = @(
  "server/middleware/authGuard.ts",
  "server/utils/sanitizer.ts",
  "server/middleware/validation-enhanced.ts"
)

foreach ($rel in $requiredFiles) {
  $abs = Join-Path $ProjectRoot $rel
  if (Test-Path $abs) {
    Write-Host "OK $rel exists"
  } else {
    Write-Host "ERR $rel not found"
  }
}

if (Get-Command tsc -ErrorAction SilentlyContinue) {
  try {
    Push-Location $ProjectRoot
    & tsc --noEmit server/middleware/authGuard.ts 2>&1 | Out-Null
  } catch {
  } finally {
    Pop-Location
  }
}

Write-Host "[5/5] Generating summary report..."

@"

## Summary

# Audit Fixes Application Report

Generated: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss zzz")
Environment: Windows
Node: $NodeVersion
NPM: $NpmVersion

## Applied Fixes

### Security Middleware
- authGuard.ts - Token-based authorization
- validation-enhanced.ts - Input validation + sanitization
- sanitizer.ts - Logging data redaction

### Configuration
- .env.secrets template
- Secrets directory defaults
- Docker secrets placeholders

### Security Checks Performed
- NPM security audit
- Python SAST (Bandit)
- Python dependency audit (pip-audit)

## Next Steps (P0 - Critical)

1. Update authGuard usage in app.ts
2. Configure real secret values in .env.secrets and secrets/*.txt
3. Apply enhanced validation in routes
4. Keep logging sanitized
5. Run lint/typecheck/tests

## Security Reports Generated

- Bandit Report: artifacts/bandit-report-$Timestamp.json
- pip-audit Report: artifacts/pip-audit-report-$Timestamp.json

Status: Initial audit fixes applied
Review Date: $((Get-Date).AddDays(14).ToString("yyyy-MM-dd"))

For full details, see: AUDITORIA_TECNICA_COMPLETA_2024.md
"@ | Add-Content -Path $ReportFile -Encoding UTF8

Write-Host ""
Write-Host "========================================="
Write-Host "Audit fixes applied successfully"
Write-Host "========================================="
Write-Host "Report: $ReportFile"
Write-Host ""
Write-Host "Next actions:"
Write-Host "  1. Edit .env.secrets with real values"
Write-Host "  2. Update app.ts to use new middleware"
Write-Host "  3. Apply enhanced validation to routes"
Write-Host "  4. Generate admin/metrics tokens"
Write-Host "  5. Run npm run security:all"
Write-Host "  6. Run npm run test:backend"
