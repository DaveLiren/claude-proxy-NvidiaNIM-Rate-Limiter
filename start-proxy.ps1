# ─────────────────────────────────────────────────────────────────────────────
# start-proxy.ps1  —  Inicia el proxy Claude Code → NVIDIA NIM
# ─────────────────────────────────────────────────────────────────────────────
# USO:
#   .\start-proxy.ps1
#
# En OTRA terminal, con el proxy ya corriendo:
#   $env:ANTHROPIC_BASE_URL = "http://localhost:9082"
#   $env:ANTHROPIC_API_KEY  = "nvapi-TU_KEY_AQUI"
#   claude --model mistralai/mistral-large-3-675b-instruct-2512
# ─────────────────────────────────────────────────────────────────────────────

# Intentar usar la variable de entorno existente o solicitarla si está vacía
if (-not $env:NVIDIA_API_KEY) {
    Write-Host "⚠️ No se detectó la variable NVIDIA_API_KEY en el entorno." -ForegroundColor Yellow
    $userInput = Read-Host "Por favor, ingresa tu NVIDIA API Key (nvapi-...)"
    if (-not $userInput) {
        Write-Host "❌ Error: Se requiere una API Key para continuar." -ForegroundColor Red
        exit 1
    }
    $env:NVIDIA_API_KEY = $userInput.Trim()
}

$env:NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1"
$env:PROXY_PORT      = "9082"

Write-Host ""
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "  Claude Code → NVIDIA NIM Proxy" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "  Puerto: $env:PROXY_PORT" -ForegroundColor Yellow
Write-Host ""
Write-Host "  En OTRA terminal ejecuta:" -ForegroundColor Green
Write-Host "  `$env:ANTHROPIC_BASE_URL = `"http://localhost:$env:PROXY_PORT`"" -ForegroundColor White
Write-Host "  `$env:ANTHROPIC_API_KEY  = `"nvapi-TU_KEY_AQUI`"" -ForegroundColor White
Write-Host "  claude --model <modelo>" -ForegroundColor White
Write-Host ""
Write-Host "  Ejemplos de modelos recomendados:" -ForegroundColor DarkGray
Write-Host "    mistralai/mistral-large-3-675b-instruct-2512" -ForegroundColor DarkGray
Write-Host "    deepseek-ai/deepseek-v4-flash" -ForegroundColor DarkGray
Write-Host "    openai/gpt-oss-120b" -ForegroundColor DarkGray
Write-Host "    moonshotai/kimi-k2.6" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Presiona Ctrl+C para detener el proxy." -ForegroundColor DarkGray
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

node "$PSScriptRoot\proxy.js"
