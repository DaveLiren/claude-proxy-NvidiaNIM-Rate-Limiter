---
title: "Note Taking & Research Assistant Powered by AI"
source: "https://notebooklm.google.com/notebook/e8a77398-bbaf-4bfe-bb73-895fb7fdf47c"
author:
published:
created: 2026-06-18
description: "Use the power of AI for quick summarization and note taking, NotebookLM is your powerful virtual research assistant rooted in information you can trust."
tags:
  - "clippings"
---
[![Logotipo de NotebookLM](https://notebooklm.google.com/_/static/branding/v5/dark_mode/icon.svg)](https://notebooklm.google.com/)

Tags:

Seleccionar todo 

          

info

## Chat

Este artículo anuncia que las versiones recientes de **Ollama** ahora ofrecen **compatibilidad técnica** con la interfaz de programación de **Anthropic**. Gracias a esta integración, los desarrolladores pueden ejecutar la herramienta de programación **Claude Code** utilizando modelos de código abierto alojados de forma local o en la nube. El texto detalla los pasos de **configuración y despliegue** necesarios para vincular ambos sistemas mediante variables de entorno específicas. Asimismo, se sugieren **modelos optimizados** que poseen capacidades avanzadas de razonamiento y longitudes de contexto amplias para un mejor rendimiento. Finalmente, la fuente enumera diversas funciones soportadas, tales como el **procesamiento de imágenes** y la ejecución de herramientas externas, facilitando un flujo de trabajo más flexible y privado.

________

________

Resumen Ejecutivo

La integración de **Claude Code** con **Ollama** se basa en un esquema de **suplantación de API (spoofing)** y **ofuscación de tráfico** 1 2. Mediante la redirección de puntos de enlace (endpoints) y la desactivación de metadatos identificativos, la comunidad ha logrado que una herramienta diseñada exclusivamente para servicios en la nube de Anthropic opere contra motores de inferencia locales 3 4. Este mecanismo no solo permite el uso de modelos de código abierto como **Qwen** o **Gemma**, sino que también neutraliza los sistemas de telemetría y rastreo de Anthropic, protegiendo la privacidad del usuario y optimizando el rendimiento mediante la preservación de la caché de claves y valores (KV cache) 5.

---

Análisis Técnico Profundo

1\. Suplantación y Compatibilidad de API

Ollama implementa una capa de compatibilidad con la **Anthropic Messages API** (`/v1/messages`) que actúa como un "traductor" de protocolos 1 8.

- **Mecanismo de Engaño:** Cuando Claude Code envía una solicitud, espera una estructura JSON específica de Anthropic. Ollama imita este comportamiento soportando campos de solicitud como `messages`, `system`, `tools` y formatos de respuesta que incluyen bloques de `tool_use` y `thinking` 9.

- **Gestión de Credenciales:** Para evitar errores de autenticación, Ollama acepta cualquier clave de API pero no la valida, permitiendo que Claude Code proceda con la ejecución sin conectarse a los servidores oficiales 12. Además, herramientas de la comunidad recomiendan usar **claves dummy** (falsas) y desvincular las claves reales del entorno para evitar filtraciones accidentales hacia el servidor local 2 13.

2\. Manipulación de Headers: El rol de `CLAUDE_CODE_ATTRIBUTION_HEADER`

La variable de entorno `CLAUDE_CODE_ATTRIBUTION_HEADER=0` es crítica para la evasión técnica y el rendimiento 14 15.

- **Función del Header:** Por defecto, Claude Code incluye un bloque de atribución llamado `x-anthropic-billing-header` 5 7. El análisis de ingeniería inversa revela que este no se envía solo como un header HTTP estándar, sino que **se inyecta como un bloque de texto al frente del prompt del sistema** 16.

- **Valores Dinámicos:** Este bloque contiene valores dinámicos como la versión del cliente (`cc_version`) y un fingerprint del prompt (`cch`) que cambian en cada solicitud 5 17. Al establecer la variable en `0`, se omite este bloque, eliminando la firma digital que Anthropic podría usar para rastrear o identificar el origen de la petición 16 18.

3\. Evasión de Telemetría y Errores 404

Claude Code está programado para enviar métricas operativas (latencia, uso, errores) a Anthropic y Sentry 19 20.

- **Supresión de Tráfico No Esencial:** El uso de `DISABLE_TELEMETRY=1` y `DISABLE_ERROR_REPORTING=1` detiene el envío de estos datos 19 21. Esto es vital porque, en instancias locales, Claude Code intenta contactar con endpoints como `/api/event_logging/batch` o `/v1/messages/count_tokens`, los cuales no existen en Ollama y generan **errores 404** que pueden causar inestabilidad, bloqueos o reinicios en el servidor de inferencia 22.

4\. Intercepción y Redirección de Tráfico

La intercepción se logra principalmente mediante la variable `ANTHROPIC_BASE_URL` 2 25.

- **Redirección de Endpoint:** Al configurar esta variable (ej. `http://localhost:11434`), se obliga a Claude Code a dirigir todas sus llamadas de API al servidor local de Ollama en lugar de a `api.anthropic.com` 2 26.

- **Manejo de Subagentes:** Claude Code intenta llamar a modelos específicos como `claude-haiku-4-5` para tareas en segundo plano; los investigadores mitigan esto redirigiendo todas las variables de modelo (`ANTHROPIC_DEFAULT_HAIKU_MODEL`, etc.) hacia el mismo identificador de modelo local en Ollama, evitando que el tráfico escape hacia la nube 2 27.

---

Mecánica "Anti-Baneo"

Estas configuraciones actúan como un escudo defensivo para el usuario:

- **Anonimato de Solicitud:** Al eliminar el header de atribución y el fingerprint, la solicitud pierde los metadatos que podrían identificarla como proveniente de una herramienta propietaria ejecutada fuera de su entorno previsto 5 16.

- **Aislamiento de Red:** La redirección forzada del `BASE_URL` garantiza que ninguna información del prompt o del código local llegue a los servidores de Anthropic 4 13.

- **Prevención de Flagging:** Al desactivar la telemetría, se evita que Anthropic reciba alertas sobre configuraciones "anómalas" (como tiempos de respuesta inusualmente lentos de modelos locales) que podrían marcar una cuenta para revisión o baneo por uso no autorizado de la herramienta CLI 7 19.

---

Impacto en el Rendimiento: Caché KV

La evasión del header de atribución es el factor que más influye en la velocidad 7 28.

- **Invalidación de Caché:** Dado que el bloque de atribución se inyecta al inicio del prompt y cambia constantemente, provoca que la **caché de claves y valores (KV cache)** se invalide en cada turno 5 17. El motor de inferencia se ve obligado a procesar el contexto completo desde cero cada vez, aumentando el tiempo de respuesta de 2 segundos a más de 30 en sesiones largas 6.

- **Optimización Local:** Deshabilitar este header permite que el prefijo del prompt coincida (cache hit), lo que puede hacer que Claude Code funcione hasta **3 veces más rápido** en entornos locales 14.

---

Perspectiva de Hacking Ético

Desde el punto de vista de la ciberseguridad, esta integración representa un ejercicio de **control de soberanía de datos** 4. La suplantación de API y la evasión de telemetría demuestran cómo los usuarios pueden recuperar el control sobre herramientas de software propietario que imponen rastreo obligatorio 19 30. Sin embargo, esta práctica resalta riesgos:

- **Confianza en Proxies:** Al usar intermediarios o versiones modificadas (como forks de `vllm-mlx`), el usuario debe confiar en que estos no inyecten su propia telemetría o vulnerabilidades 31 32.

- **Seguridad del Prompt:** La desactivación de protecciones como el `WebFetch domain safety check` (mediante `skipWebFetchPreflight: true`) otorga mayor libertad pero elimina filtros contra dominios maliciosos mantenidos por el proveedor oficial 33 34.

- **Fugas de Claves:** El riesgo de que una `ANTHROPIC_API_KEY` real sea enviada accidentalmente a un servidor local mal configurado subraya la importancia de sanitizar el entorno de ejecución antes de la integración 2 13.