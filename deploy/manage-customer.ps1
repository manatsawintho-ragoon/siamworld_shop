# ================================================================
#  SiamWorld Shop — Customer Management Script
#
#  Usage:
#    .\manage-customer.ps1 -Name "shopname" -Action list
#    .\manage-customer.ps1 -Name "shopname" -Action stop
#    .\manage-customer.ps1 -Name "shopname" -Action start
#    .\manage-customer.ps1 -Name "shopname" -Action restart
#    .\manage-customer.ps1 -Name "shopname" -Action logs
#    .\manage-customer.ps1 -Name "shopname" -Action remove   # WARNING: deletes data
# ================================================================

param(
    [string]$Name = "",
    [ValidateSet("list","start","stop","restart","logs","remove","status")]
    [string]$Action = "list"
)

$DeployDir     = $PSScriptRoot
$CustomersDir  = Join-Path $DeployDir "customers"
$CustomersJson = Join-Path $DeployDir "customers.json"
$ComposeFile   = Join-Path $DeployDir "docker-compose.customer.yml"

function Load-Registry {
    if (Test-Path $CustomersJson) {
        return Get-Content $CustomersJson -Raw | ConvertFrom-Json
    }
    return [PSCustomObject]@{ customers = @() }
}

function Get-Customer([string]$n) {
    $reg = Load-Registry
    return $reg.customers | Where-Object { $_.name -eq $n }
}

# ── LIST ──────────────────────────────────────────────────────
if ($Action -eq "list" -or $Name -eq "") {
    $reg = Load-Registry
    Write-Host ""
    Write-Host "  Deployed Customers" -ForegroundColor Cyan
    Write-Host "  ─────────────────────────────────────────────────" -ForegroundColor DarkGray
    if ($reg.customers.Count -eq 0) {
        Write-Host "  (no customers deployed yet)" -ForegroundColor DarkGray
    } else {
        foreach ($c in $reg.customers) {
            $status = (& docker inspect "sw-$($c.name)-frontend" --format '{{.State.Status}}' 2>$null)
            $statusColor = if ($status -eq "running") { "Green" } else { "Red" }
            Write-Host ("  {0,-20} {1,-35} FE:{2}  BE:{3}  [{4}]" -f $c.name, $c.domain, $c.frontend_port, $c.backend_port, $status) -ForegroundColor $statusColor
        }
    }
    Write-Host ""
    exit 0
}

# ── Resolve customer ──────────────────────────────────────────
$customer = Get-Customer $Name
if (-not $customer) {
    Write-Host "[ERROR] Customer '$Name' not found. Run: .\manage-customer.ps1 -Action list" -ForegroundColor Red
    exit 1
}

$CustomerEnv = Join-Path $CustomersDir "$Name\.env"

# ── ACTIONS ───────────────────────────────────────────────────
switch ($Action) {
    "start" {
        Write-Host "Starting $Name..." -ForegroundColor Yellow
        & docker compose --project-name "sw-$Name" --env-file $CustomerEnv -f $ComposeFile start
    }
    "stop" {
        Write-Host "Stopping $Name..." -ForegroundColor Yellow
        & docker compose --project-name "sw-$Name" --env-file $CustomerEnv -f $ComposeFile stop
    }
    "restart" {
        Write-Host "Restarting $Name..." -ForegroundColor Yellow
        & docker compose --project-name "sw-$Name" --env-file $CustomerEnv -f $ComposeFile restart
    }
    "logs" {
        Write-Host "Logs for $Name (Ctrl+C to exit):" -ForegroundColor Yellow
        & docker compose --project-name "sw-$Name" --env-file $CustomerEnv -f $ComposeFile logs -f --tail=100
    }
    "status" {
        & docker compose --project-name "sw-$Name" --env-file $CustomerEnv -f $ComposeFile ps
    }
    "remove" {
        Write-Host ""
        Write-Host "  WARNING: This will DELETE all data for '$Name' including the database!" -ForegroundColor Red
        $confirm = Read-Host "  Type the customer name to confirm"
        if ($confirm -ne $Name) {
            Write-Host "Cancelled." -ForegroundColor Yellow
            exit 0
        }
        Write-Host "Removing $Name..." -ForegroundColor Red
        & docker compose --project-name "sw-$Name" --env-file $CustomerEnv -f $ComposeFile down -v
        Remove-Item -Path (Join-Path $CustomersDir $Name) -Recurse -Force

        # Update registry
        $reg = Load-Registry
        $updated = $reg.customers | Where-Object { $_.name -ne $Name }
        $reg.customers = @($updated)
        $reg | ConvertTo-Json -Depth 5 | Set-Content $CustomersJson -Encoding UTF8
        Write-Host "Customer '$Name' removed." -ForegroundColor Green
    }
}
