# ================================================================
#  SiamWorld Shop — New Customer Deployment Script
#  Windows Server 2022 / PowerShell 5.1+
#
#  Usage:
#    .\new-customer.ps1 -Name "shopname" -Domain "shopname.yourdomain.com"
#
#  Example:
#    .\new-customer.ps1 -Name "craftworld" -Domain "craftworld.siamsite.com"
# ================================================================

param(
    [Parameter(Mandatory=$true, HelpMessage="Customer short name (lowercase, no spaces)")]
    [string]$Name,

    [Parameter(Mandatory=$true, HelpMessage="Customer domain e.g. shopname.siamsite.com")]
    [string]$Domain
)

# ── Validate input ──────────────────────────────────────────────
if ($Name -notmatch '^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$') {
    Write-Host "[ERROR] Name must be 3-30 lowercase letters, numbers, hyphens only. No leading/trailing hyphens." -ForegroundColor Red
    exit 1
}

# ── Paths ──────────────────────────────────────────────────────
$DeployDir    = $PSScriptRoot
$SourceRoot   = Split-Path -Parent $DeployDir
$CustomersDir = Join-Path $DeployDir "customers"
$CustomerDir  = Join-Path $CustomersDir $Name
$CustomerEnv  = Join-Path $CustomerDir ".env"
$CustomersJson = Join-Path $DeployDir "customers.json"
$ComposeFile  = Join-Path $DeployDir "docker-compose.customer.yml"

# ── Load registry ──────────────────────────────────────────────
if (Test-Path $CustomersJson) {
    $registry = Get-Content $CustomersJson -Raw | ConvertFrom-Json
} else {
    $registry = [PSCustomObject]@{
        next_frontend_port = 3001
        next_backend_port  = 4001
        customers          = @()
    }
}

# Check duplicate
$existing = $registry.customers | Where-Object { $_.name -eq $Name }
if ($existing) {
    Write-Host "[ERROR] Customer '$Name' already exists on port $($existing.frontend_port)." -ForegroundColor Red
    Write-Host "Use: docker compose --project-name sw-$Name restart" -ForegroundColor Yellow
    exit 1
}

# ── Assign ports ───────────────────────────────────────────────
$frontendPort = [int]$registry.next_frontend_port
$backendPort  = [int]$registry.next_backend_port

# ── Generate secrets ───────────────────────────────────────────
function New-Secret([int]$Len = 48, [bool]$AlphaOnly = $false) {
    if ($AlphaOnly) {
        $pool = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    } else {
        $pool = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#%^&*'
    }
    return -join ((1..$Len) | ForEach-Object { $pool[(Get-Random -Maximum $pool.Length)] })
}

$mysqlPassword  = New-Secret 28 $true
$jwtSecret      = New-Secret 52
$encryptionKey  = New-Secret 52

# ── Create customer directory ──────────────────────────────────
New-Item -ItemType Directory -Path $CustomerDir -Force | Out-Null

# ── Write .env ─────────────────────────────────────────────────
$envContent = @"
# ================================================
#  Customer : $Name
#  Domain   : $Domain
#  Created  : $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
#  Ports    : Frontend=$frontendPort  Backend=$backendPort
# ================================================

# MySQL (internal — not exposed to internet)
MYSQL_HOST=mysql
MYSQL_PORT=3306
MYSQL_USER=siamworld
MYSQL_PASSWORD=$mysqlPassword
MYSQL_DATABASE=siamworld

# Redis (internal)
REDIS_HOST=redis
REDIS_PORT=6379

# Security — DO NOT SHARE
JWT_SECRET=$jwtSecret
JWT_EXPIRES_IN=24h
ENCRYPTION_KEY=$encryptionKey

# API URLs (baked into frontend build)
NEXT_PUBLIC_API_URL=https://$Domain/api
NEXT_PUBLIC_WS_URL=wss://$Domain

# Backend
BACKEND_PORT=$backendPort
NODE_ENV=production
CORS_ORIGIN=https://$Domain

# Frontend
FRONTEND_PORT=$frontendPort

# Rate limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=300

# EasySlip — customer fills in Admin Panel > ตั้งค่า > ระบบเติมเงิน
EASYSLIP_API_KEY=

# Docker compose vars
SOURCE_ROOT=$($SourceRoot -replace '\\','/')
CUSTOMER_ENV_FILE=$($CustomerEnv -replace '\\','/')
"@

$envContent | Set-Content $CustomerEnv -Encoding UTF8

# ── Print what we're doing ─────────────────────────────────────
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Deploying customer: $Name" -ForegroundColor Cyan
Write-Host "  Domain   : $Domain" -ForegroundColor Cyan
Write-Host "  Frontend : port $frontendPort" -ForegroundColor Cyan
Write-Host "  Backend  : port $backendPort" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "[1/2] Building & starting Docker containers..." -ForegroundColor Yellow
Write-Host "      (First build takes 3-5 minutes — cached after that)" -ForegroundColor Gray
Write-Host ""

# ── Run Docker Compose ─────────────────────────────────────────
$env:SOURCE_ROOT       = $SourceRoot -replace '\\','/'
$env:CUSTOMER_ENV_FILE = $CustomerEnv -replace '\\','/'

& docker compose `
    --project-name "sw-$Name" `
    --env-file $CustomerEnv `
    -f $ComposeFile `
    up -d --build 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "[ERROR] Docker Compose failed. Check messages above." -ForegroundColor Red
    exit 1
}

# ── Update registry ────────────────────────────────────────────
$record = [PSCustomObject]@{
    name           = $Name
    domain         = $Domain
    frontend_port  = $frontendPort
    backend_port   = $backendPort
    created        = (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
    status         = "running"
}

$updatedCustomers = @($registry.customers) + $record
$updatedRegistry = [PSCustomObject]@{
    next_frontend_port = $frontendPort + 1
    next_backend_port  = $backendPort  + 1
    customers          = $updatedCustomers
}
$updatedRegistry | ConvertTo-Json -Depth 5 | Set-Content $CustomersJson -Encoding UTF8

# ── Print instructions ─────────────────────────────────────────
Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  SUCCESS! '$Name' is running" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "[2/2] Add to Nginx Proxy Manager (http://localhost:81):" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Add Proxy Host:" -ForegroundColor White
Write-Host "    Domain Names  : $Domain"
Write-Host "    Forward Host  : host.docker.internal"
Write-Host "    Forward Port  : $frontendPort"
Write-Host "    Enable SSL    : Yes (Let's Encrypt)"
Write-Host "    Force SSL     : Yes"
Write-Host ""
Write-Host "  In the 'Advanced' tab, paste this:" -ForegroundColor White
Write-Host ""
Write-Host @"
location /api/ {
    proxy_pass http://host.docker.internal:$backendPort/api/;
    proxy_http_version 1.1;
    proxy_set_header Host `$host;
    proxy_set_header X-Real-IP `$remote_addr;
    proxy_set_header X-Forwarded-Proto `$scheme;
}
location /socket.io/ {
    proxy_pass http://host.docker.internal:$backendPort/socket.io/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade `$http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host `$host;
}
"@ -ForegroundColor Cyan
Write-Host ""
Write-Host "  Customer Setup URL:" -ForegroundColor Yellow
Write-Host "    https://$Domain/admin/setup" -ForegroundColor White
Write-Host ""
Write-Host "  Credentials saved at: deploy\customers\$Name\.env" -ForegroundColor Gray
Write-Host ""
