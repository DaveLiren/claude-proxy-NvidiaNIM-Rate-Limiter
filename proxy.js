#!/usr/bin/env node
/**
 * Claude Code → NVIDIA NIM Proxy
 * Traduce peticiones del formato Anthropic Messages API
 * al formato OpenAI-compatible de NVIDIA NIM (integrate.api.nvidia.com/v1)
 */

import http from "http";
import https from "https";
import { URL } from "url";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ── Configuración ─────────────────────────────────────────────────────────────
const PROXY_PORT   = parseInt(process.env.PROXY_PORT   || "8082");
const NVIDIA_KEY   = process.env.NVIDIA_API_KEY || "";
const NVIDIA_BASE  = process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1";

// Modelo fallback si Claude Code no envía uno en el body.
const DEFAULT_MODEL = process.env.NVIDIA_MODEL || "deepseek-ai/deepseek-v4-flash";

if (!NVIDIA_KEY) {
  console.error("❌ Falta NVIDIA_API_KEY. Exporta la variable antes de iniciar.");
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DETECTED_MODELS_PATH = path.join(__dirname, "modelos_detectados.json");

let detectedModels = [];
if (fs.existsSync(DETECTED_MODELS_PATH)) {
  try {
    detectedModels = JSON.parse(fs.readFileSync(DETECTED_MODELS_PATH, "utf8"));
    console.log(`ℹ️ Cargados ${detectedModels.length} modelos dinámicos desde modelos_detectados.json`);
  } catch (err) {
    console.error("❌ Error leyendo modelos_detectados.json:", err.message);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convierte mensajes de Anthropic → OpenAI.
 *  Respeta el campo `model` que Claude Code envía cuando usas `--model <X>`.
 */
function anthropicToOpenAI(anthropicBody) {
  const messages = [];

  // system prompt
  if (anthropicBody.system) {
    const systemText = typeof anthropicBody.system === "string"
      ? anthropicBody.system
      : anthropicBody.system.map(b => b.text || "").join("\n");
    messages.push({ role: "system", content: systemText });
  }

  // mensajes del usuario / asistente
  for (const msg of (anthropicBody.messages || [])) {
    let content = msg.content;
    if (Array.isArray(content)) {
      // bloques de contenido (texto, imagen, tool_result, etc.)
      const parts = [];
      for (const block of content) {
        if (block.type === "text") {
          parts.push({ type: "text", text: block.text });
        } else if (block.type === "tool_result") {
          // Resultado de una herramienta: lo convertimos a texto plano
          const resultText = Array.isArray(block.content)
            ? block.content.map(b => b.text || JSON.stringify(b)).join("\n")
            : String(block.content || "");
          parts.push({ type: "text", text: `[Tool result for ${block.tool_use_id}]:\n${resultText}` });
        } else if (block.type === "tool_use") {
          // Llamada a herramienta iniciada por el asistente — la pasamos como texto
          parts.push({ type: "text", text: `[Tool call: ${block.name}]\n${JSON.stringify(block.input, null, 2)}` });
        }
      }
      content = parts.length === 1 && parts[0].type === "text"
        ? parts[0].text
        : parts;
    }
    messages.push({ role: msg.role, content });
  }

  // Herramientas (tools) → funciones de OpenAI
  const tools = (anthropicBody.tools || []).map(t => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description || "",
      parameters: t.input_schema || {},
    },
  }));

  // Usar el modelo que Claude Code pasa con --model, con DEFAULT_MODEL como fallback.
  const model = anthropicBody.model || DEFAULT_MODEL;

  const openaiBody = {
    model,
    messages,
    max_tokens: anthropicBody.max_tokens || 4096,
    stream: !!anthropicBody.stream,
  };

  if (tools.length > 0) {
    openaiBody.tools = tools;
    openaiBody.tool_choice = "auto";
  }
  if (anthropicBody.temperature !== undefined) {
    openaiBody.temperature = anthropicBody.temperature;
  }

  return openaiBody;
}

/** Convierte respuesta OpenAI → Anthropic (no-streaming) */
function openAIToAnthropic(openaiResp, requestId) {
  const choice = openaiResp.choices?.[0];
  const msg    = choice?.message || {};

  const content = [];

  // DeepSeek R1 usa reasoning_content para el pensamiento y content para la respuesta.
  // Combinamos ambos si están presentes.
  const textParts = [];
  if (msg.reasoning_content) textParts.push(msg.reasoning_content);
  if (msg.content)            textParts.push(msg.content);
  if (textParts.length > 0) {
    content.push({ type: "text", text: textParts.join("\n\n") });
  }

  // tool_calls → tool_use de Anthropic
  if (msg.tool_calls) {
    for (const tc of msg.tool_calls) {
      let toolInput = {};
      try { toolInput = JSON.parse(tc.function.arguments || "{}"); } catch {}
      content.push({
        type: "tool_use",
        id: tc.id,
        name: tc.function.name,
        input: toolInput,
      });
    }
  }

  // Si no hay nada, al menos enviamos texto vacío para no romper Claude Code
  if (content.length === 0) {
    content.push({ type: "text", text: "" });
  }

  return {
    id: `msg_${requestId}`,
    type: "message",
    role: "assistant",
    content,
    model: openaiResp.model || DEFAULT_MODEL,
    stop_reason: choice?.finish_reason === "tool_calls" ? "tool_use" : "end_turn",
    stop_sequence: null,
    usage: {
      input_tokens:  openaiResp.usage?.prompt_tokens || 0,
      output_tokens: openaiResp.usage?.completion_tokens || 0,
    },
  };
}

/** Convierte un chunk SSE de OpenAI → evento SSE de Anthropic */
function convertStreamChunk(chunk, state) {
  if (chunk === "[DONE]") {
    const hasToolCalls = state.activeTools && Object.keys(state.activeTools).length > 0;
    const stopReason = hasToolCalls ? "tool_use" : "end_turn";
    return [
      `data: ${JSON.stringify({ type: "message_delta", delta: { stop_reason: stopReason, stop_sequence: null }, usage: { output_tokens: state.outputTokens } })}\n\n`,
      `data: ${JSON.stringify({ type: "message_stop" })}\n\n`,
    ].join("");
  }

  let parsed;
  try { parsed = JSON.parse(chunk); } catch { return ""; }

  const choice = parsed.choices?.[0];
  if (!choice) return "";

  const delta = choice.delta || {};
  const parts = [];

  // Inicializar mensaje en el primer chunk
  if (!state.started) {
    state.started = true;
    state.outputTokens = 0;
    state.activeTools = {}; // Registro de herramientas activas en esta transmisión
    parts.push(`data: ${JSON.stringify({
      type: "message_start",
      message: { id: `msg_${state.id}`, type: "message", role: "assistant", content: [], model: parsed.model || DEFAULT_MODEL, stop_reason: null, stop_sequence: null, usage: { input_tokens: 0, output_tokens: 0 } }
    })}\n\n`);
    parts.push(`data: ${JSON.stringify({ type: "content_block_start", index: 0, content_block: { type: "text", text: "" } })}\n\n`);
    parts.push(`data: ${JSON.stringify({ type: "ping" })}\n\n`);
  }

  if (delta.content) {
    state.outputTokens += Math.ceil(delta.content.length / 4);
    parts.push(`data: ${JSON.stringify({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: delta.content } })}\n\n`);
  }

  // Procesar llamadas a herramientas en streaming (NIM -> Claude Code)
  if (delta.tool_calls) {
    for (const tc of delta.tool_calls) {
      const toolIdx = tc.index;
      const anthropicIndex = toolIdx + 1; // El texto principal es index 0, las herramientas son 1, 2, etc.

      // Si es el inicio de la llamada
      if (tc.id && tc.function && tc.function.name) {
        state.activeTools[toolIdx] = {
          id: tc.id,
          name: tc.function.name
        };
        parts.push(`data: ${JSON.stringify({
          type: "content_block_start",
          index: anthropicIndex,
          content_block: {
            type: "tool_use",
            id: tc.id,
            name: tc.function.name,
            input: {}
          }
        })}\n\n`);
      }

      // Si vienen fragmentos del JSON de los argumentos
      if (tc.function && tc.function.arguments) {
        parts.push(`data: ${JSON.stringify({
          type: "content_block_delta",
          index: anthropicIndex,
          delta: {
            type: "input_json_delta",
            partial_json: tc.function.arguments
          }
        })}\n\n`);
      }
    }
  }

  if (choice.finish_reason) {
    // Detener bloque de texto
    parts.push(`data: ${JSON.stringify({ type: "content_block_stop", index: 0 })}\n\n`);
    // Detener bloques de herramientas activos
    if (state.activeTools) {
      for (const indexKey of Object.keys(state.activeTools)) {
        const idx = parseInt(indexKey);
        parts.push(`data: ${JSON.stringify({ type: "content_block_stop", index: idx + 1 })}\n\n`);
      }
    }
  }

  return parts.join("");
}

// ── Rate Limiter (RPM & TPM) ─────────────────────────────────────────────
const RATE_LIMIT_RPM   = parseInt(process.env.RATE_LIMIT_RPM   || "35");
const RATE_LIMIT_BURST = parseInt(process.env.RATE_LIMIT_BURST || "5");

class MultiRateLimiter {
  constructor(rpm, burst) {
    this.rpmCapacity = burst;
    this.rpmTokens   = burst;
    this.rpmRefill   = rpm / 60;
    this.lastRefill = Date.now();
  }

  _refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.rpmTokens = Math.min(this.rpmCapacity, this.rpmTokens + elapsed * this.rpmRefill);
    this.lastRefill = now;
  }

  async acquire(reqId) {
    this._refill();

    if (this.rpmTokens >= 1) {
      this.rpmTokens -= 1;
      return Promise.resolve();
    }

    // Calcular espera necesaria
    const waitSeconds = (1 - this.rpmTokens) / this.rpmRefill;
    const waitMs = Math.ceil(waitSeconds * 1000);

    console.log(`[${reqId}] 🚦 Rate limit (RPM): en cola (espera ~${(waitMs/1000).toFixed(1)}s)`);

    return new Promise(resolve => {
      setTimeout(() => {
        this.acquire(reqId).then(resolve);
      }, waitMs);
    });
  }
}

const rateLimiter = new MultiRateLimiter(RATE_LIMIT_RPM, RATE_LIMIT_BURST);

// ── Configuración Avanzada ──────────────────────────────────────────────────
const MAX_RETRIES = 2; // Reintentos por modelo
const TIMEOUT_MS  = 120000; // 120 segundos de timeout (2 minutos) para dar tiempo a modelos de razonamiento (DeepSeek R1) o colas grandes

// Mapeo de modelos de Claude (Anthropic) a NVIDIA NIM — Verificados 2026-06-23
const MODEL_MAP = {
  "claude-3-5-sonnet":          "mistralai/mistral-large-3-675b-instruct-2512",
  "claude-3-5-sonnet-20241022":  "mistralai/mistral-large-3-675b-instruct-2512",
  "claude-3-7-sonnet-20250219":  "mistralai/mistral-large-3-675b-instruct-2512",
  "claude-sonnet-4-6":           "mistralai/mistral-large-3-675b-instruct-2512",
  "claude-3-5-haiku-20241022":   "openai/gpt-oss-20b",
  "claude-3-opus-20240229":      "mistralai/mistral-large-3-675b-instruct-2512",
  "claude-sonnet-4-5-20251001":  "mistralai/mistral-large-3-675b-instruct-2512",
  "claude-haiku-4-5-20251001":   "openai/gpt-oss-20b",
  "claude-opus-4-5-20251001":    "mistralai/mistral-large-3-675b-instruct-2512",
  "deepseek-ai/deepseek-v4-pro": "deepseek-ai/deepseek-v4-flash",
};

// Listas de Fallback (si el modelo mapeado falla) — Verificados 2026-06-23
const FALLBACK_LISTS = {
  coding: [
    "mistralai/mistral-large-3-675b-instruct-2512",
    "deepseek-ai/deepseek-v4-flash",
    "openai/gpt-oss-120b"
  ],
  thinking: [
    "moonshotai/kimi-k2.6",
    "nvidia/llama-3.3-nemotron-super-49b-v1.5",
    "deepseek-ai/deepseek-v4-flash"
  ],
  fast: [
    "deepseek-ai/deepseek-v4-flash",
    "openai/gpt-oss-20b"
  ],
  general: [
    "mistralai/mistral-large-3-675b-instruct-2512",
    "openai/gpt-oss-120b",
    "mistralai/mistral-nemotron"
  ]
};

// ── Helpers de Gestión de Peticiones ─────────────────────────────────────────

/** Determina qué lista de fallback usar según el modelo.
 *  Primero busca el modelo exacto en cada lista; si no está, usa heurísticas. */
function getFallbackList(modelId) {
  if (FALLBACK_LISTS.coding.includes(modelId))   return FALLBACK_LISTS.coding;
  if (FALLBACK_LISTS.thinking.includes(modelId)) return FALLBACK_LISTS.thinking;
  if (FALLBACK_LISTS.general.includes(modelId))  return FALLBACK_LISTS.general;

  // Heurísticas para modelos no listados explícitamente
  const idLower = modelId.toLowerCase();
  if (idLower.includes("coder") || idLower.includes("devstral") || idLower.includes("sonnet")) return FALLBACK_LISTS.coding;
  if (idLower.includes("thinking") || idLower.includes("opus") || idLower.includes("reasoning")) return FALLBACK_LISTS.thinking;
  return FALLBACK_LISTS.general;
}

/** Función principal para realizar la petición a NVIDIA con reintentos y fallback */
async function performNvidiaRequest(openaiBody, res, reqId) {
  const originalModel = openaiBody.model;
  
  // 1. Mapeo inicial
  let targetModel = MODEL_MAP[originalModel] || originalModel;
  if (targetModel.startsWith("claude-")) {
    console.log(`[${reqId}] ⚠️ Modelo Claude no reconocido: ${originalModel}. Usando fallback.`);
    targetModel = getFallbackList(originalModel)[0];
  }

  const fallbackList = getFallbackList(targetModel);
  let currentModelIndex = fallbackList.indexOf(targetModel);
  let lastError = null;

  // Construir orden de modelos: el solicitado primero, luego el resto de fallbacks
  const orderedModels = [];
  if (currentModelIndex === -1) {
    // Si el modelo solicitado no está predefinido en las listas de fallback, se intenta usar él primero,
    // y si falla, se usan los fallbacks como alternativa
    orderedModels.push(targetModel);
    orderedModels.push(...fallbackList);
  } else {
    orderedModels.push(fallbackList[currentModelIndex]);
    for (let i = 0; i < fallbackList.length; i++) {
      if (i !== currentModelIndex) orderedModels.push(fallbackList[i]);
    }
  }

  // Ciclo de modelos de fallback
  for (let m = 0; m < orderedModels.length; m++) {
    const activeModel = orderedModels[m];
    openaiBody.model = activeModel;

    // Ciclo de reintentos por modelo
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        await rateLimiter.acquire(reqId);
        console.log(`[${reqId}] 🔄 Intento ${attempt} con modelo: ${activeModel}`);
        const result = await makeHttpRequest(openaiBody, res, reqId);
        return result; // Éxito
      } catch (err) {
        lastError = err;
        console.error(`[${reqId}] ❌ Error (Intento ${attempt}/${MAX_RETRIES}): ${err.message}`);
        
        // Si es 410 (Gone) = modelo eliminado, saltar inmediatamente al siguiente
        if (err.statusCode === 410) {
          console.log(`[${reqId}] 🗑️ Modelo ${activeModel} ya no existe (410). Saltando...`);
          break;
        }
        
        // Si no es un error de rate limit o red, no reintentar el mismo modelo
        if (err.statusCode && err.statusCode < 429 && err.statusCode !== 408) break; 
        
        // Esperar antes de reintentar (backoff exponencial)
        if (attempt < MAX_RETRIES) {
          const delay = attempt * 3000; // 3s, 6s
          console.log(`[${reqId}] ⏳ Esperando ${delay/1000}s antes de reintentar...`);
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }
    if (m < orderedModels.length - 1) {
      console.log(`[${reqId}] ⏭️ Cambiando a modelo de fallback: ${orderedModels[m+1]}`);
    }
  }

  throw lastError || new Error("Todos los intentos de fallback fallaron.");
}

/** Envoltorio Promise para https.request */
function makeHttpRequest(openaiBody, res, reqId) {
  return new Promise((resolve, reject) => {
    const isStream = !!openaiBody.stream;
    const reqPayload = JSON.stringify(openaiBody);
    const nvidiaUrl = new URL(`${NVIDIA_BASE}/chat/completions`);

    const options = {
      hostname: nvidiaUrl.hostname,
      port: 443,
      path: nvidiaUrl.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${NVIDIA_KEY}`,
        "Content-Length": Buffer.byteLength(reqPayload),
        "User-Agent": "Claude-NIM-Proxy/1.0"
      },
      timeout: TIMEOUT_MS
    };

    const nvidiaReq = https.request(options, nvidiaRes => {
      const status = nvidiaRes.statusCode;
      
      if (status >= 400) {
        let errBody = "";
        nvidiaRes.on("data", c => errBody += c);
        nvidiaRes.on("end", () => {
          const error = new Error(`NVIDIA API Error ${status}`);
          error.statusCode = status;
          error.details = errBody;
          reject(error);
        });
        return;
      }

      if (isStream) {
        if (!res.headersSent) {
          res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
          });
        }
        
        const state = { started: false, id: reqId, outputTokens: 0 };
        let buffer = "";

        nvidiaRes.on("data", chunk => {
          buffer += chunk.toString();
          const lines = buffer.split("\n");
          buffer = lines.pop();

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data:")) continue;
            const data = trimmed.slice(5).trim();
            const converted = convertStreamChunk(data, state);
            if (converted) res.write(converted);
          }
        });

        nvidiaRes.on("end", () => {
          if (buffer.trim().startsWith("data:")) {
            const data = buffer.trim().slice(5).trim();
            const converted = convertStreamChunk(data, state);
            if (converted) res.write(converted);
          }
          
          res.end();
          resolve(true);
        });

      } else {
        let respBody = "";
        nvidiaRes.on("data", c => (respBody += c));
        nvidiaRes.on("end", () => {
          try {
            const openaiResp = JSON.parse(respBody);
            const anthropicResp = openAIToAnthropic(openaiResp, reqId);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(anthropicResp));
            resolve(true);
          } catch (e) {
            reject(new Error("Error parseando respuesta de NVIDIA"));
          }
        });
      }
    });

    nvidiaReq.on("error", err => reject(err));

    nvidiaReq.on("timeout", () => {
      nvidiaReq.destroy();
      reject(new Error("Timeout en la petición a NVIDIA"));
    });

    nvidiaReq.write(reqPayload);
    nvidiaReq.end();
  });
}

// ── Servidor HTTP ─────────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-api-key, anthropic-version");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Logging de la petición
  const reqTime = new Date().toLocaleTimeString();
  console.log(`[${reqTime}] 📨 ${req.method} ${req.url}`);

  // Health checks de Claude Code
  if (req.method === "HEAD" || ((req.url === "/" || req.url === "/v1") && req.method === "GET")) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(req.method === "HEAD" ? "" : JSON.stringify({ status: "ok", proxy: "claude-nvidia" }));
    return;
  }

  // Obtener sólo el pathname
  const reqPath = req.url.split("?")[0];

  // Endpoint /v1/models
  if (reqPath === "/v1/models" && req.method === "GET") {
    const allModels = [
      ...Object.keys(MODEL_MAP),
      ...FALLBACK_LISTS.coding,
      ...FALLBACK_LISTS.thinking,
      ...FALLBACK_LISTS.general,
      ...detectedModels
    ];
    const unique = [...new Set(allModels)];
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      object: "list",
      data: unique.map(id => ({ id, object: "model", created: 1700000000, owned_by: "nvidia" }))
    }));
    return;
  }

  if (reqPath !== "/v1/messages") {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found", path: req.url }));
    return;
  }

  let body = "";
  req.on("data", chunk => (body += chunk));
  req.on("end", async () => {
    let anthropicBody;
    try { anthropicBody = JSON.parse(body); }
    catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid JSON" }));
      return;
    }

    const openaiBody = anthropicToOpenAI(anthropicBody);
    const reqId      = Date.now().toString(36);

    try {
      await performNvidiaRequest(openaiBody, res, reqId);
    } catch (err) {
      console.error(`[${reqId}] 💥 Fallo total: ${err.message}`);
      if (!res.headersSent) {
        res.writeHead(err.statusCode || 502, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message, detail: err.details || null }));
      } else {
        res.end();
      }
    }
  });
});

server.listen(PROXY_PORT, () => {
  console.log(`\n🚀 Proxy activo en http://localhost:${PROXY_PORT}`);
  console.log(`🔗 NVIDIA NIM: ${NVIDIA_BASE}`);
  console.log(`🤖 Modelo fallback: ${DEFAULT_MODEL}`);
  console.log(`🚦 Rate Limiter: ${RATE_LIMIT_RPM} RPM | Burst: ${RATE_LIMIT_BURST}`);
  console.log(`\nPara usar con Claude Code (en OTRA terminal):`);
  console.log(`  $env:ANTHROPIC_BASE_URL = "http://localhost:${PROXY_PORT}"`);
  console.log(`  $env:ANTHROPIC_API_KEY  = "nvapi-xxx"`);
  console.log(`  claude --model deepseek-ai/deepseek-v4-pro`);
  console.log(`  claude --model qwen/qwen3-coder-480b-a35b-instruct`);
  console.log(`  claude --model meta/llama-3.3-70b-instruct`);
  console.log(`  (cualquier modelo de https://integrate.api.nvidia.com/v1/models)\n`);
});
