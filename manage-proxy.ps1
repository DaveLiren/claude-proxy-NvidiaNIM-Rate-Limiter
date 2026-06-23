# ─────────────────────────────────────────────────────────────
# manage-proxy.ps1 — Gestión del proxy Claude ↔ NVIDIA NIM
# ─────────────────────────────────────────────────────────────
# USO:
#   .\manage-proxy.ps1 status    — Ver estado del proxy
#   .\manage-proxy.ps1 start     — Iniciar el proxy
#   .\manage-proxy.ps1 stop      — Detener el proxy
#   .\manage-proxy.ps1 restart   — Reiniciar el proxy
#   .\manage-proxy.ps1 logs      — Ver últimas líneas del log
#   .\manage-proxy.ps1 logs -f   — Seguir logs en tiempo real
#   .\manage-proxy.ps1 model "qwen/qwq-32b"  — Cambiar modelo
# ─────────────────────────────────────────────────────────────

param(
    [Parameter(Position = 0)]
    [ValidateSet("status", "start", "stop", "restart", "logs", "model")]
    [string]$Action = "status",

    [Parameter(Position = 1)]
    [string]$Value = "",

    [switch]$f  # follow logs
)

$TaskName = "ClaudeProxy-NVIDIA-NIM"
$ProxyDir = $PSScriptRoot
$LogFile = Join-Path $ProxyDir "proxy.log"
$WrapperBat = Join-Path $ProxyDir "proxy-service.bat"

function Show-Status {
    $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if (-not $task) {
        Write-Host ""
        Write-Host "  ❌ El proxy no está instalado como servicio." -ForegroundColor Red
        Write-Host "     Ejecuta: .\install-service.ps1" -ForegroundColor Yellow
        Write-Host ""
        return
    }

    $state = $task.State
    $color = switch ($state) {
        "Running" { "Green" }
        "Ready"   { "Yellow" }
        default   { "Red" }
    }

    # Leer modelo actual del .bat
    $currentModel = "desconocido"
    if (Test-Path $WrapperBat) {
        $batContent = Get-Content $WrapperBat -Raw
        if ($batContent -match 'set NVIDIA_MODEL=(.+)') {
            $currentModel = $Matches[1].Trim()
        }
    }

    Write-Host ""
    Write-Host "  ╔══════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "  ║   Claude Code → NVIDIA NIM Proxy        ║" -ForegroundColor Cyan
    Write-Host "  ╚══════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Estado:   $state" -ForegroundColor $color
    Write-Host "  Fallback: $currentModel" -ForegroundColor White
    Write-Host '            (con --model, Claude Code usa el modelo que indiques)' -ForegroundColor DarkGray
    Write-Host "  Puerto:   9082" -ForegroundColor White
    Write-Host "  Log:      $LogFile" -ForegroundColor White
    Write-Host ""

    # Verificar si el puerto está abierto
    $portCheck = Get-NetTCPConnection -LocalPort 9082 -ErrorAction SilentlyContinue
    if ($portCheck) {
        Write-Host "  🟢 Puerto 9082 activo — Proxy escuchando" -ForegroundColor Green
    } else {
        Write-Host "  🔴 Puerto 9082 inactivo" -ForegroundColor Red
    }
    Write-Host ""
}

function Start-Proxy {
    $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if (-not $task) {
        Write-Host "  ❌ El proxy no está instalado. Ejecuta: .\install-service.ps1" -ForegroundColor Red
        return
    }
    if ($task.State -eq "Running") {
        Write-Host "  ℹ️  El proxy ya está corriendo." -ForegroundColor Cyan
        return
    }
    Write-Host "  🚀 Iniciando proxy..." -ForegroundColor Yellow
    Start-ScheduledTask -TaskName $TaskName
    Start-Sleep -Seconds 2
    $task = Get-ScheduledTask -TaskName $TaskName
    if ($task.State -eq "Running") {
        Write-Host "  ✅ Proxy iniciado correctamente." -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  El proxy pudo no haber iniciado. Revisa logs: .\manage-proxy.ps1 logs" -ForegroundColor Yellow
    }
}

function Stop-Proxy {
    $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if (-not $task) {
        Write-Host "  ❌ El proxy no está instalado." -ForegroundColor Red
        return
    }
    Write-Host "  🛑 Deteniendo proxy..." -ForegroundColor Yellow
    Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue

    # También matamos cualquier proceso node huérfano en ese puerto
    $portProcs = Get-NetTCPConnection -LocalPort 9082 -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($procId in $portProcs) {
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    }

    Write-Host "  ✅ Proxy detenido." -ForegroundColor Green
}

function Switch-Model {
    param([string]$NewModel)
    if (-not $NewModel) {
        Write-Host '  ❌ Especifica un modelo. Ejemplo: .\manage-proxy.ps1 model "qwen/qwq-32b"' -ForegroundColor Red
        return
    }

    Write-Host "  🔄 Cambiando modelo a: $NewModel" -ForegroundColor Yellow

    # Actualizar el .bat
    if (Test-Path $WrapperBat) {
        $batContent = Get-Content $WrapperBat -Raw
        $batContent = $batContent -replace 'set NVIDIA_MODEL=.+', "set NVIDIA_MODEL=$NewModel"
        Set-Content -Path $WrapperBat -Value $batContent -Encoding ASCII
    }

    # Actualizar variable de entorno de usuario
    [Environment]::SetEnvironmentVariable("ANTHROPIC_MODEL", $NewModel, "User")

    # Reiniciar
    Stop-Proxy
    Start-Sleep -Seconds 1
    Start-Proxy

    Write-Host "  ✅ Modelo cambiado a: $NewModel" -ForegroundColor Green
    Write-Host "  ℹ️  Cierra y reabre tu terminal para que tome efecto." -ForegroundColor Cyan
}

function Show-Logs {
    if (-not (Test-Path $LogFile)) {
        Write-Host "  ℹ️  No hay archivo de log todavía." -ForegroundColor Cyan
        return
    }

    if ($f) {
        Write-Host "  📋 Siguiendo logs en tiempo real (Ctrl+C para salir)..." -ForegroundColor Yellow
        Write-Host ""
        Get-Content $LogFile -Wait -Tail 30
    } else {
        Write-Host "  📋 Últimas 30 líneas del log:" -ForegroundColor Yellow
        Write-Host ""
        Get-Content $LogFile -Tail 30
    }
}

# ── Ejecutar acción ────────────────────────────────────────────────────────────
switch ($Action) {
    "status"  { Show-Status }
    "start"   { Start-Proxy }
    "stop"    { Stop-Proxy }
    "restart" { Stop-Proxy; Start-Sleep -Seconds 1; Start-Proxy }
    "logs"    { Show-Logs }
    "model"   { Switch-Model -NewModel $Value }
}
