# 🚀 Claude Code ⇄ NVIDIA NIM Proxy

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-blue.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20WSL-lightgrey.svg)]()

Un proxy ligero en **Node.js** que actúa como puente traductor local. Permite ejecutar el CLI oficial de **Claude Code** utilizando la infraestructura gratuita de **NVIDIA NIM** (Mistral, DeepSeek, GPT-OSS, Kimi, Llama, etc.) de forma transparente y sin modificar el binario original de Anthropic.

---

## 🦄 ¿Cómo funciona?

El proxy se ejecuta localmente en tu computadora en el puerto `9082` (o `8082` en modo standalone). 

```
claude --model mistralai/mistral-large-3-675b-instruct-2512
    │ (ANTHROPIC_BASE_URL=http://localhost:9082)
    ▼
Proxy Node.js (Puerto 9082)
    │
    ├─ 🔄 Traduce: Anthropic Messages API ⇄ OpenAI Chat Completions API
    ├─ 🚦 Rate Limiter local: Token Bucket (35 RPM | 5 Burst) para prevenir errores 429
    ├─ ⏭️ Fallback inteligente: Rota modelos automáticamente si la API falla o se satura
    ▼
NVIDIA NIM API
(https://integrate.api.nvidia.com/v1)
```

---

## ⚡ Características Principales

- **Traducción Completa de APIs**: Mapea mensajes del sistema, roles, streaming SSE y llamadas a herramientas (*tool calling* / *function calling*) de manera bidireccional.
- **Rate Limiter Inteligente (Token Bucket)**: En lugar de rechazar peticiones cuando superas el límite de la API gratuita de NVIDIA, el proxy encola las solicitudes localmente y las despacha de manera segura, evitando baneos por HTTP 429.
- **Sistema de Fallback Activo**: Si un modelo se satura, experimenta latencia excesiva o es retirado de NVIDIA NIM, el proxy cambia automáticamente al siguiente mejor modelo de respaldo de la misma categoría en tiempo real.
- **Ejecución Invisible en Background**: Incluye un script instalador para Windows que levanta el proxy de forma oculta como una Tarea Programada (`AtLogOn`), levantándose de forma automatizada al iniciar sesión.

---

## 🤖 Inicialización Asistida por IA (Recomendada)

Si estás utilizando un agente de desarrollo basado en IA (como Antigravity, Hermes, OpenClaw, o Copilot en tu editor):
1. Pídele al agente que lea las instrucciones de integración del proyecto:
   > *"Lee el archivo `SKILL.md` de la raíz del proyecto y configúralo en mi entorno."*
2. El agente se encargará de crear el archivo `.env`, solicitarte tu API Key de NVIDIA de forma interactiva y dejar todo listo para programar.

---

## 🛠️ Configuración Manual

### Requisitos Previos
- **Node.js** v18+ instalado.
- **Claude Code CLI** instalado globalmente (`npm install -g @anthropic-ai/claude-code`).
- Una API Key gratuita de **NVIDIA NIM** obtenida en [build.nvidia.com](https://build.nvidia.com/) (comienza con `nvapi-`).

### Pasos para Windows

1. **Clonar el repositorio**:
   ```powershell
   git clone https://github.com/tu-usuario/ClaudeProxy.git
   cd ClaudeProxy
   ```

2. **Instalar dependencias**:
   ```powershell
   npm install
   ```

3. **Crear archivo de configuración (.env)**:
   Crea un archivo `.env` en la raíz del proyecto y añade tu API Key:
   ```env
   NVIDIA_API_KEY=nvapi-tu-token-aqui
   PROXY_PORT=9082
   NVIDIA_MODEL=deepseek-ai/deepseek-v4-flash
   ```

4. **Instalar el Servicio en Segundo Plano**:
   Abre una terminal de PowerShell **como Administrador** y ejecuta:
   ```powershell
   .\install-service.ps1
   ```
   *Esto configurará la Tarea Programada de Windows para que el proxy corra de forma invisible en segundo plano en cada inicio de sesión.*

---

## 🏃 Cómo usarlo todos los días

El proxy trabaja de manera invisible. Para usar Claude Code con tu backend de NVIDIA NIM:

1. Abre tu terminal de PowerShell o CMD habitual en tu proyecto de desarrollo.
2. Define las variables de entorno para indicarle a Claude que use el proxy local:
   - **PowerShell**:
     ```powershell
     $env:ANTHROPIC_BASE_URL = "http://localhost:9082"
     $env:ANTHROPIC_API_KEY  = "nvapi-tu-token-aqui"
     ```
   - **CMD / Símbolo del Sistema**:
     ```cmd
     set ANTHROPIC_BASE_URL=http://localhost:9082
     set ANTHROPIC_API_KEY=nvapi-tu-token-aqui
     ```
3. Ejecuta Claude Code CLI normalmente:
   ```bash
   claude
   ```

---

## 🚦 Comandos de Administración del Servicio

En cualquier momento puedes controlar el estado del proxy en background ejecutando PowerShell en la carpeta `C:\ClaudeProxy`:

```powershell
# Verificar si el proxy está activo y qué modelos de fallback tiene cargados
.\manage-proxy.ps1 status

# Detener el servicio por completo (libera el puerto 9082)
.\manage-proxy.ps1 stop

# Iniciar el servicio si lo habías detenido previamente
.\manage-proxy.ps1 start

# Reiniciar el proxy (útil al hacer modificaciones en proxy.js)
.\manage-proxy.ps1 restart

# Visualizar el log de peticiones en tiempo real
.\manage-proxy.ps1 logs
```

---

## 🧠 Modelos Recomendados

Puedes forzar a Claude Code a usar un cerebro específico usando el parámetro `--model`:

| Categoría | Modelo Recomendado en NVIDIA NIM | Comando en Claude Code |
| :--- | :--- | :--- |
| **Programación y Lógica** 🧠 | `mistralai/mistral-large-3-675b-instruct-2512` | `claude --model mistralai/mistral-large-3-675b-instruct-2512` |
| **Respuesta Rápida (Flash)** ⚡ | `deepseek-ai/deepseek-v4-flash` | `claude --model deepseek-ai/deepseek-v4-flash` |
| **Razonamiento Profundo** 🧐 | `moonshotai/kimi-k2.6` | `claude --model moonshotai/kimi-k2.6` |

> 💡 **Mapeo Automático**: Si inicias el CLI escribiendo `claude` a secas (o especificas modelos estándar de Anthropic como `claude-3-5-sonnet`), el proxy traducirá automáticamente la consulta para utilizar `mistralai/mistral-large-3-675b-instruct-2512` bajo el capó.

---

## 📝 Licencia

Este proyecto está bajo la Licencia MIT. Consulta el archivo [LICENSE](LICENSE) para más detalles.
