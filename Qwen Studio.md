---
title: "Qwen Studio"
source: "https://chat.qwen.ai/c/d4eee32e-db26-44b0-b1f9-272d9cfb00e5"
author:
published:
created: 2026-06-18
description: "Qwen Studio is an official platform from Qwen that empowers both everyday users and developers with unified access to Qwen’s series of open-source and proprietary models. It offers comprehensive functionality spanning chatbots, image and video understanding, image generation and editing, document processing, tool utilization, voice and video chat, and artifacts."
tags:
  - "clippings"
---
Preparame un PROMT robusto para NotebookLM para que investigue como Ollama hace que claude code no banee que se esten usando otras IA´s o modelos en su entorno.

Como entusiasta de la ciberseguridad, el hacking ético y la IA, te resultará fascinante cómo funciona esto. En realidad, no es un "hack" malicioso para romper la seguridad de Anthropic, sino una **ingeniería inversa de las cabeceras (headers) y telemetría** de la CLI de Claude Code.

Para evitar baneos o bloqueos por parte de Anthropic al usar modelos locales, la comunidad descubrió que Claude Code inyecta un **"header de atribución"** (`x-anthropic-billing-header`) que cambia en cada petición. Esto no solo permite a Anthropic rastrear el uso (y potencialmente banear si detectan anomalías), sino que **destruye la caché KV (KV Cache)** de los modelos locales, haciendo que la inferencia sea hasta un 90% más lenta. Además, Claude Code intenta enviar telemetría a los servidores de Anthropic, lo que causa errores en servidores locales.

Para que **NotebookLM** te extraiga un informe técnico de nivel de ingeniero inverso sobre este mecanismo, he diseñado el siguiente prompt robusto.

Copia y pega esto en el chat de NotebookLM (asegúrate de haber subido primero las fuentes, como la documentación oficial de Ollama, artículos técnicos o issues de GitHub relacionados):

---

### 📋 Prompt para NotebookLM

```
Actúa como un investigador de seguridad en IA, ingeniero inverso y experto en ciberseguridad. Tu tarea es analizar las fuentes proporcionadas (documentación, artículos, issues de GitHub) sobre la integración de Ollama con la herramienta CLI "Claude Code" de Anthropic.OBJETIVO PRINCIPAL:Investigar y explicar en detalle los mecanismos técnicos que utiliza Ollama (y la comunidad) para evadir las restricciones nativas, la telemetría y el rastreo de Anthropic, permitiendo que Claude Code ejecute modelos locales o de código abierto sin ser baneado, bloqueado o detectado por los servidores oficiales.PUNTOS CLAVE DE INVESTIGACIÓN:1. Suplantación y Compatibilidad de API: ¿Cómo implementa Ollama su capa de compatibilidad con la "Anthropic Messages API" para engañar a Claude Code y hacerle creer que se está comunicando con los servidores oficiales de Anthropic?2. Manipulación de Headers y Mecanismos Anti-Baneo: Explica a fondo la función de la variable de entorno \`CLAUDE_CODE_ATTRIBUTION_HEADER=0\`. ¿Cómo deshabilitar este header evita que Anthropic rastree las peticiones (previniendo baneos o flagging) y cómo esto soluciona el problema de invalidación de la caché KV que ralentiza la inferencia local?3. Evasión de Telemetría: Analiza el propósito de la variable \`DISABLE_TELEMETRY=1\`. ¿Cómo evita esto que Claude Code envíe datos de uso, métricas o telemetría a Anthropic, lo cual causaría errores 404 o alertas en instancias locales de Ollama?4. Intercepción de Tráfico: Detalla cómo las variables de entorno (como \`ANTHROPIC_BASE_URL\`) o herramientas proxy (como LiteLLM) interceptan y redirigen las llamadas de la API oficial hacia el servidor local de Ollama.FORMATO DE SALIDA REQUERIDO:- Resumen Ejecutivo: Breve overview del mecanismo de integración y evasión.- Análisis Técnico Profundo: Desglose de la compatibilidad de API, manipulación de headers y evasión de telemetría.- Mecánica "Anti-Baneo": Explicación específica de cómo estas configuraciones evitan que Anthropic detecte el uso de modelos no oficiales y aplique baneos.- Impacto en el Rendimiento: Cómo la evasión del header de atribución afecta la caché KV y la velocidad de inferencia local.- Perspectiva de Hacking Ético: Breve análisis de las implicaciones de seguridad de la suplantación de APIs y la evasión de telemetría en herramientas de IA propietarias.Por favor, basa todas tus conclusiones estrictamente en la información técnica contenida en las fuentes adjuntas, manteniendo un tono profesional y orientado a la ingeniería de software y la ciberseguridad.
```

---

### 💡 Consejos para obtener el mejor resultado en NotebookLM:

Para que este prompt brille, te recomiendo subir como "Fuentes" en NotebookLM los siguientes enlaces o sus versiones en PDF/Texto:

1. **El blog oficial de Ollama sobre compatibilidad con Claude:** `https://ollama.com/blog/claude`
2. **La documentación de compatibilidad de API de Ollama:** `https://docs.ollama.com/api/anthropic-compatibility`
3. **El issue de GitHub sobre la telemetría:** Busca en el repositorio de Ollama o Claude Code el issue que menciona `DISABLE_TELEMETRY=1` para evitar errores 404.
4. **Artículos técnicos sobre el KV Cache:** Cualquier fuente que hable sobre cómo `CLAUDE_CODE_ATTRIBUTION_HEADER=0` arregla la lentitud del 90% en la inferencia local.

De esta manera, NotebookLM cruzará la información de la API, los headers de rastreo y la telemetría, dándote un reporte exacto de cómo se "bypea" el entorno cerrado de Anthropic desde una perspectiva ética y técnica.

necesito el enlace exacto de los puntos 3 y 4 de la lista

¡Excelente pregunta! Como buen entusiasta del hacking ético, sabes que en ingeniería inversa las fuentes primarias (issues de GitHub, PRs y documentación oficial) son la biblia.

En mi respuesta anterior te di ejemplos de lo que debías buscar, pero **sí existen los hilos y documentaciones exactas** donde la comunidad descubrió y documentó estas vulnerabilidades de diseño en la telemetría y el rendimiento de Claude Code.

Aquí tienes los **enlaces exactos y verificables** para que los subas directamente a NotebookLM como fuentes:

### 🔗 Para el Punto 3: Evasión de Telemetría (Errores 404)

Cuando Claude Code intenta enviar telemetría (a Sentry o Statsig) a los servidores de Anthropic, Ollama no sabe cómo responder a esos endpoints locales, generando bucles de errores 404 o cuelgues. Aquí está la evidencia exacta:

1. **[Issue #13949 en ollama/ollama](https://github.com/ollama/ollama/issues/13949?spm=a2ty_o01.29997173.0.0.769a55fbwCcs9A)** : *Título: "Ollama API Compatibility Issue with Claude Code / Anthropic CLI"* Aquí se documenta explícitamente que Ollama no soporta la telemetría de Claude y se recomienda configurar variables de entorno para evitar los errores 404 y los cuelgues del servidor local
	github.com
	.
2. **[Issue #13939 en ollama/ollama](https://github.com/ollama/ollama/issues/13939?spm=a2ty_o01.29997173.0.0.769a55fbwCcs9A)** : *Título: "Timeout Error when running ollama with claude code using qwen3"* En los comentarios de este issue, los desarrolladores confirman que los errores 404 en los logs pueden prevenirse deshabilitando la telemetría de Claude Code mediante `DISABLE_TELEMETRY`
	github.com
	.
3. **[Documentación Oficial de Anthropic - Data Usage](https://code.claude.com/docs/en/data-usage?spm=a2ty_o01.29997173.0.0.769a55fbwCcs9A)** : La propia documentación oficial de Claude Code confirma que para optar por no enviar telemetría (que se conecta a Sentry para registros de errores operativos), se debe establecer la variable de entorno `DISABLE_TELEMETRY`
	code.claude.com
	.

### 🔗 Para el Punto 4: El Header de Atribución y la Destrucción del KV Cache

Este es el "hack" de rendimiento más interesante. Claude Code inyecta un bloque de atribución dinámico (con versión del cliente y huella digital del prompt) en cada petición. Esto cambia el hash del prompt, invalidando el **KV Cache** del modelo local y haciendo que la inferencia sea hasta un 90% más lenta. Aquí están las pruebas técnicas:

1. **[Pull Request #1220 en musistudio/claude-code-router](https://github.com/musistudio/claude-code-router/pull/1220?spm=a2ty_o01.29997173.0.0.769a55fbwCcs9A)** : *Título: "Fix: use CLAUDE\_CODE\_ATTRIBUTION\_HEADER to..."* Un desarrollador descubre que al establecer `CLAUDE_CODE_ATTRIBUTION_HEADER=0` en las variables de entorno, Claude Code deja de enviar este header dinámico y **el prompt cache vuelve a funcionar** en servidores locales
	github.com
	.
2. **[Repositorio vitorallo/claude-code-local](https://github.com/vitorallo/claude-code-local?spm=a2ty_o01.29997173.0.0.769a55fbwCcs9A)** : En el README, el autor explica el problema exacto: *"Claude Code's attribution header changes every request, invalidating the KV cache"* (El header de atribución de Claude Code cambia en cada petición, invalidando la caché KV)
	github.com
	.
3. **[Issue #2025 en farion1231/cc-switch](https://github.com/farion1231/cc-switch/issues/2025?spm=a2ty_o01.29997173.0.0.769a55fbwCcs9A)** : Detalla cómo, desde la versión 2.1.36 de Claude Code, cada petición API incluye un `x-anthropic-billing-header` con valores dinámicos que rompen la caché, y se solicita un toggle para deshabilitarlo
	github.com
	.
4. **[Artículo Técnico: "I Made Claude Code 3× Faster With Local Models..."](https://medium.com/coding-nexus/i-made-claude-code-3-faster-with-local-models-heres-the-one-env-variable-nobody-talks-about-7fd515eabe21?spm=a2ty_o01.29997173.0.0.769a55fbwCcs9A)** : Un artículo en Medium que desglosa cómo la variable `CLAUDE_CODE_ATTRIBUTION_HEADER: "0"` es la clave para recuperar la velocidad de inferencia local
	medium.com
	.
5. **[Documentación Oficial de Anthropic - Environment Variables](https://code.claude.com/docs/en/env-vars?spm=a2ty_o01.29997173.0.0.769a55fbwCcs9A)** : La documentación oficial de Claude Code confirma la existencia de esta variable oculta: *"Set to 0 to omit the attribution block... Disabling it improves prompt caching hit rates when routing through LLM gateways"*
	code.claude.com
	.

### 💡 Cómo usar esto en NotebookLM:

1. Copia todos estos enlaces.
2. En tu notebook de NotebookLM, ve a la sección de **"Fuentes" (Sources)** y pégalos uno por uno (o sube los PDFs si prefieres).
3. NotebookLM indexará los issues de GitHub y los artículos técnicos.
4. Luego, pega el **Prompt Robusto** que te pasé en el mensaje anterior.

Al tener estas fuentes exactas, NotebookLM no alucinará; extraerá los fragmentos de código, los comandos de terminal y las explicaciones técnicas directas de los ingenieros que descubrieron cómo "bypasear" estas restricciones de diseño en Claude Code. ¡Disfruta la investigación!

Think

AI-generated content may not be accurate.