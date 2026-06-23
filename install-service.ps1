# install-service.ps1 - Instala el proxy como Tarea Programada de Windows
# REQUIERE: Ejecutar como Administrador
# USO:
#   .\install-service.ps1                   (instalar con modelo por defecto)
#   .\install-service.ps1 "qwen/qwq-32b"   (instalar con modelo especifico)
#   .\install-service.ps1 -Uninstall        (desinstalar)

param(
    [string]$Model = "deepseek-ai/deepseek-v4-flash",
    [switch]$Uninstall
)

$TaskName = "ClaudeProxy-NVIDIA-NIM"
$ProxyDir = $PSScriptRoot
$ProxyScript = Join-Path $ProxyDir "proxy.js"
$LogFile = Join-Path $ProxyDir "proxy.log"

# Buscar API Key en el entorno actual o en las variables de usuario del registro de Windows
$NvidiaKey = $env:NVIDIA_API_KEY
if (-not $NvidiaKey) {
    $NvidiaKey = [Environment]::GetEnvironmentVariable("ANTHROPIC_API_KEY", "User")
}
if (-not $NvidiaKey) {
    Write-Host ""
    Write-Host "  🔑 No se detecto una API Key en el entorno." -ForegroundColor Yellow
    $userInput = Read-Host "  Por favor ingresa tu NVIDIA API Key (nvapi-...)"
    if (-not $userInput) {
        Write-Host "  ❌ Error: Es necesaria la clave para continuar con la instalacion." -ForegroundColor Red
        exit 1
    }
    $NvidiaKey = $userInput.Trim()
}

# Verificar que se ejecuta como admin
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host ""
    Write-Host "  ERROR: Este script requiere permisos de Administrador." -ForegroundColor Red
    Write-Host "  Haz clic derecho en PowerShell > Ejecutar como administrador" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

# --- DESINSTALAR ---
if ($Uninstall) {
    Write-Host ""
    Write-Host "  Desinstalando tarea programada..." -ForegroundColor Yellow

    $existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if ($existingTask) {
        Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
        Write-Host "  OK - Tarea programada eliminada." -ForegroundColor Green
    } else {
        Write-Host "  La tarea no existia." -ForegroundColor Cyan
    }

    Write-Host "  Eliminando variables de entorno..." -ForegroundColor Yellow
    [Environment]::SetEnvironmentVariable("ANTHROPIC_BASE_URL", $null, "User")
    [Environment]::SetEnvironmentVariable("ANTHROPIC_API_KEY", $null, "User")
    [Environment]::SetEnvironmentVariable("ANTHROPIC_AUTH_TOKEN", $null, "User")
    [Environment]::SetEnvironmentVariable("ANTHROPIC_MODEL", $null, "User")
    [Environment]::SetEnvironmentVariable("CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY", $null, "User")
    [Environment]::SetEnvironmentVariable("ANTHROPIC_STRIP_BETA_HEADERS", $null, "User")
    Write-Host "  OK - Variables de entorno eliminadas." -ForegroundColor Green
    Write-Host ""
    Write-Host "  Desinstalacion completa." -ForegroundColor Green
    Write-Host ""
    exit 0
}

# --- VERIFICAR NODE.JS ---
$nodePath = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $nodePath) {
    Write-Host ""
    Write-Host "  ERROR: Node.js no esta instalado o no esta en el PATH." -ForegroundColor Red
    Write-Host "  Instalalo desde https://nodejs.org/" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}
Write-Host "  OK - Node.js encontrado: $nodePath" -ForegroundColor Green

# --- ELIMINAR TAREA EXISTENTE ---
$existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existingTask) {
    Write-Host "  Actualizando tarea existente..." -ForegroundColor Yellow
    Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

# --- CREAR SCRIPT WRAPPER (.bat) ---
$wrapperBat = Join-Path $ProxyDir "proxy-service.bat"
$batLines = @(
    "@echo off"
    "REM Proxy Claude Code - NVIDIA NIM (servicio en background)"
    "set NVIDIA_API_KEY=$NvidiaKey"
    "set NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1"
    "set NVIDIA_MODEL=$Model"
    "set PROXY_PORT=9082"
    ""
    "cd /d `"$ProxyDir`""
    "`"$nodePath`" `"$ProxyScript`" >> `"$LogFile`" 2>&1"
)
$batLines | Out-File -FilePath $wrapperBat -Encoding ascii

Write-Host "  OK - Wrapper bat creado: $wrapperBat" -ForegroundColor Green

# --- CREAR LA TAREA PROGRAMADA ---
# Usamos powershell -WindowStyle Hidden para ejecutar el .bat sin ventana visible
# y mantener la tarea en estado "Running" (powershell permanece vivo con node)
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -Command `"& '$wrapperBat'`"" -WorkingDirectory $ProxyDir

$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME

$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit (New-TimeSpan -Days 365)

$taskDesc = "Proxy Claude Code a NVIDIA NIM. Traduce peticiones Anthropic API al formato OpenAI para NVIDIA NIM."

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Description $taskDesc -RunLevel Limited | Out-Null

Write-Host "  OK - Tarea programada creada: $TaskName" -ForegroundColor Green

# --- CONFIGURAR VARIABLES DE ENTORNO PERMANENTES ---
Write-Host "  Configurando variables de entorno permanentes..." -ForegroundColor Yellow
[Environment]::SetEnvironmentVariable("ANTHROPIC_BASE_URL", "http://localhost:9082", "User")
[Environment]::SetEnvironmentVariable("ANTHROPIC_API_KEY", $NvidiaKey, "User")
[Environment]::SetEnvironmentVariable("ANTHROPIC_AUTH_TOKEN", $NvidiaKey, "User")
[Environment]::SetEnvironmentVariable("ANTHROPIC_MODEL", $Model, "User")
[Environment]::SetEnvironmentVariable("CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY", "1", "User")
[Environment]::SetEnvironmentVariable("ANTHROPIC_STRIP_BETA_HEADERS", "1", "User")
Write-Host "  OK - Variables de entorno configuradas para el usuario $env:USERNAME" -ForegroundColor Green

# --- INICIAR EL SERVICIO AHORA ---
Write-Host "  Iniciando el proxy ahora..." -ForegroundColor Yellow
Start-ScheduledTask -TaskName $TaskName
Start-Sleep -Seconds 2

$taskInfo = Get-ScheduledTask -TaskName $TaskName
if ($taskInfo.State -eq "Running") {
    Write-Host "  OK - Proxy corriendo en background!" -ForegroundColor Green
} else {
    Write-Host "  AVISO: El proxy pudo no haber iniciado. Revisa: $LogFile" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "  ================================================" -ForegroundColor Cyan
Write-Host "  INSTALACION COMPLETA" -ForegroundColor Green
Write-Host "  ================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  El proxy arrancara automaticamente cada vez que" -ForegroundColor White
Write-Host "  inicies sesion en Windows. No necesitas terminal." -ForegroundColor White
Write-Host ""
Write-Host "  Para usar Claude Code, abre CUALQUIER terminal y:" -ForegroundColor Yellow
Write-Host "    claude" -ForegroundColor White
Write-Host ""
Write-Host "  Para gestionar el proxy:" -ForegroundColor Yellow
Write-Host "    .\manage-proxy.ps1 status" -ForegroundColor White
Write-Host "    .\manage-proxy.ps1 restart" -ForegroundColor White
Write-Host "    .\manage-proxy.ps1 logs" -ForegroundColor White
Write-Host ""
