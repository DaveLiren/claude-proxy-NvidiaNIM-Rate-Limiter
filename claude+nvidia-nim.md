# Claude Code + NVIDIA NIM — Guía de Replicación Completa

> **Propósito**: Esta guía contiene todo lo necesario para que otra IA (o persona) replique este proxy desde cero en cualquier máquina con Windows y Node.js.

---

## ¿Qué hace este proyecto?

Un **proxy Node.js** (`proxy.js`) corre localmente en el puerto `9082` y traduce las peticiones de Claude Code (formato Anthropic Messages API) al formato OpenAI-compatible que acepta la API de NVIDIA NIM (`https://integrate.api.nvidia.com/v1`).

Esto permite usar **modelos gratuitos de NVIDIA** (Mistral, GPT-OSS, Kimi, DeepSeek, Llama, etc.) con Claude Code de forma transparente, sin alterar el CLI original de Anthropic.

---

## Arquitectura

```
claude --model mistralai/mistral-large-3-675b-instruct-2512
    │ (ANTHROPIC_BASE_URL=http://localhost:9082)
    ▼
Proxy Node.js (Puerto 9082)
    │
    ├─ 🔄 Traduce: Anthropic API ⇄ OpenAI API
    ├─ 🗺️ Mapea modelos Claude ⇄ NVIDIA NIM
    ├─ 🚦 Rate Limiter: Token Bucket (35 RPM | 5 Burst)
    ├─ ⏭️ Fallback automático entre modelos en vivo
    │
    ▼
NVIDIA NIM API
https://integrate.api.nvidia.com/v1/chat/completions
    │
    ▼
Modelo de IA en NVIDIA NIM
```

---

## Requisitos

- **Node.js** v18+ ([nodejs.org](https://nodejs.org/))
- **Claude Code** CLI (`npm install -g @anthropic-ai/claude-code`)
- **NVIDIA API Key** gratuita de [build.nvidia.com](https://build.nvidia.com/) (empieza con `nvapi-`)

---

## Estructura de Archivos

| Archivo                 | Propósito                                                                      |
| ----------------------- | ------------------------------------------------------------------------------ |
| `proxy.js`              | Proxy principal (servidor HTTP, traducciones, fallback, rate limiting)          |
| `install-service.ps1`   | Instala el proxy como Tarea Programada de Windows en background                |
| `manage-proxy.ps1`      | PowerShell de administración (iniciar, detener, estado, reiniciar, ver logs) |
| `proxy-service.bat`     | Script de arranque del servicio con las variables de entorno                   |
| `proxy.log`             | Log de peticiones e incidentes en tiempo real                                  |
| `package.json`          | Declaración del módulo ES6 para Node.js                                         |
| `INSTRUCCIONES.md`      | Guía del usuario final en español                                             |
| `claude+nvidia-nim.md`  | **Este archivo** — guía técnica completa                                       |

---

## Características Técnicas del Proxy

### 1. Traducción Anthropic ⇄ OpenAI

El proxy escucha peticiones POST en `/v1/messages` (formato Anthropic) y las traduce a peticiones POST para `/v1/chat/completions` (formato OpenAI). El proxy se encarga de:
- Mensajes de texto, prompts del sistema (`system`).
- Traducción de llamadas a herramientas (`tools` ⇄ `function calling`).
- Streaming mediante Server-Sent Events (SSE).
- Fusión de contenidos de razonamiento (`reasoning_content`) de modelos como DeepSeek R1.

### 2. Mapeo de Modelos Claude ⇄ NVIDIA

Cuando Claude Code envía un modelo estándar de Anthropic (o si ejecutas claude sin parámetros), el proxy lo traduce al mejor modelo de NVIDIA NIM equivalente en el diccionario `MODEL_MAP`:

```javascript
"claude-3-5-sonnet"           ➜ "mistralai/mistral-large-3-675b-instruct-2512"
"claude-3-5-sonnet-20241022"  ➜ "mistralai/mistral-large-3-675b-instruct-2512"
"claude-3-7-sonnet-20250219"  ➜ "mistralai/mistral-large-3-675b-instruct-2512"
"claude-3-5-haiku-20241022"   ➜ "openai/gpt-oss-20b"
"claude-3-opus-20240229"      ➜ "mistralai/mistral-large-3-675b-instruct-2512"
"claude-haiku-4-5-20251001"   ➜ "openai/gpt-oss-20b"
```

*Nota: Si utilizas `claude --model <modelo-directo-nvidia>` en tu terminal, el proxy omitirá el mapeo y lo enviará tal cual a NVIDIA.*

### 3. Sistema de Fallback Inteligente

Si un modelo seleccionado da error de red, timeout o arroja código HTTP 429/408, el proxy rota automáticamente entre la lista de modelos de respaldo según la categoría antes de fallar:

| Categoría | Modelos (en orden de prioridad) |
| :--- | :--- |
| **Coding** | `mistralai/mistral-large-3-675b-instruct-2512`, `deepseek-ai/deepseek-v4-flash`, `openai/gpt-oss-120b` |
| **Thinking** | `moonshotai/kimi-k2.6`, `nvidia/llama-3.3-nemotron-super-49b-v1.5`, `deepseek-ai/deepseek-v4-flash` |
| **Fast** | `deepseek-ai/deepseek-v4-flash`, `openai/gpt-oss-20b` |
| **General** | `mistralai/mistral-large-3-675b-instruct-2512`, `openai/gpt-oss-120b`, `mistralai/mistral-nemotron` |

* Si un modelo responde con error `410` (Gone), el proxy asume que el modelo fue retirado de NVIDIA NIM y lo descarta de la lista de inmediato sin hacer más reintentos.

### 4. Rate Limiter (Token Bucket)

Para cumplir con las restricciones de la API gratuita de NVIDIA NIM:
- **Algoritmo**: Token Bucket implementado localmente.
- **Límites**: 35 RPM (peticiones por minuto) con capacidad de Burst de 5.
- **Evita Errores 429**: Las llamadas que exceden el límite no son rechazadas; se encolan automáticamente en el proxy y se despachan en cuanto se regeneran los tokens en el cubo.

---

## Configuración del Servicio de Windows (Background)

Para ejecutar el proxy sin abrir terminales interactivas molestas, se crea una Tarea Programada que ejecuta la consola de PowerShell de forma oculta:

1. **Powershell Tarea Programada**:
   ```powershell
   $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -Command `"& 'C:\ClaudeProxy\proxy-service.bat'`"" -WorkingDirectory "C:\ClaudeProxy"
   ```
2. **Privilegios Limitados**: Se registra con `RunLevel Limited` para que no requiera permisos de administrador para su ejecución.

---

## Uso Diario y Comandos Útiles

Una vez instalado con `.\install-service.ps1`, el proxy está disponible en el puerto `9082` de forma permanente.

### Iniciar Claude Code en tu Workspace
```powershell
claude
# O seleccionando un modelo específico:
claude --model mistralai/mistral-large-3-675b-instruct-2512
```

### Comandos de Administración y Ciclo de Vida

El proxy se registra como una **Tarea Programada de Windows** con disparador `AtLogOn`. Esto garantiza su comportamiento ante encendidos y apagados del sistema:
*   **Encendido / Reinicio (Lunes por la mañana)**: El proxy se iniciará de forma totalmente automatizada e invisible apenas inicies sesión en Windows. No requiere ejecución de comandos manuales para arrancar.
*   **Apagado del Equipo**: El proxy se detiene de forma limpia junto con el sistema.

Si deseas administrar el ciclo de vida del proxy de manera manual, abre una terminal de PowerShell en `C:\ClaudeProxy` y ejecuta:

```powershell
# Verificar el estado actual (si está activo, escuchando en el puerto y qué modelo de fallback usa)
.\manage-proxy.ps1 status

# Detener el servicio por completo (libera el puerto 9082 y mata el proceso Node.js en background)
.\manage-proxy.ps1 stop

# Iniciar el servicio manualmente si lo habías detenido previamente
.\manage-proxy.ps1 start

# Reiniciar el servicio (útil para aplicar cambios en proxy.js sin reiniciar la PC)
.\manage-proxy.ps1 restart

# Visualizar las últimas líneas del archivo de logs en vivo
.\manage-proxy.ps1 logs
```


---

## Logs de Ejemplo Esperados

En `C:\ClaudeProxy\proxy.log` verás la actividad estructurada:

```
🚀 Proxy activo en http://localhost:9082
🔗 NVIDIA NIM: https://integrate.api.nvidia.com/v1
🤖 Modelo fallback: deepseek-ai/deepseek-v4-flash
🚦 Rate Limiter: 35 RPM | Burst: 5

[08:52:33 a.m.] 📨 POST /v1/messages?beta=true
[mqqtp5aj] 🔄 Intento 1 con modelo: mistralai/mistral-large-3-675b-instruct-2512
[08:52:34 a.m.] 📨 GET /
[08:52:48 a.m.] 📨 POST /v1/messages?beta=true
[mqqtpgyg] 🔄 Intento 1 con modelo: mistralai/mistral-large-3-675b-instruct-2512
[08:53:00 a.m.] 📨 POST /v1/messages?beta=true
[mqqtppu9] 🚦 Rate limit (RPM): en cola (espera ~1.8s)
[mqqtppu9] 🔄 Intento 1 con modelo: mistralai/mistral-large-3-675b-instruct-2512
```

---

## Solución de Problemas (Troubleshooting)

| Síntoma | Causa Probable | Solución |
| :--- | :--- | :--- |
| **`ECONNRESET`** | La red corporativa o NVIDIA cerró la conexión | El proxy reintenta automáticamente. Si el error persiste, el proxy cambiará al siguiente fallback. |
| **`NVIDIA API Error 410`** | NVIDIA dio de baja el modelo | El proxy lo descarta automáticamente en el momento. Debes actualizar `MODEL_MAP` o `FALLBACK_LISTS` en `proxy.js` para retirarlo definitivamente. |
| **Peticiones muy lentas** | Encolamiento por Rate Limit | El Token Bucket está reteniendo peticiones para evitar que NVIDIA te banee. Es un comportamiento esperado para proteger la sesión de Claude Code. |
| **La terminal CMD vacía aparece** | Error en la configuración de la tarea programada | Asegúrate de haber reinstalado el servicio con `install-service.ps1` para que use la directiva `-WindowStyle Hidden` de PowerShell. |
