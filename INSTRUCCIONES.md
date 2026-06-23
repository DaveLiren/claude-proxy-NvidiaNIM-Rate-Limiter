# 🚀 Guía de Claude + NVIDIA NIM (¡Súper Fácil y Rápido!)

Esta guía te ayuda a usar los cerebros más rápidos de **NVIDIA** dentro de **Claude Code** en Windows de manera automática e invisible.

---

## 🦄 ¿Cómo funciona esto? (En palabras simples)
Imagina que Claude habla un idioma y NVIDIA habla otro. Nosotros instalamos un **"Traductor Mágico"** (llamado Proxy) que corre de forma invisible en el puerto `9082` de tu computadora y traduce las peticiones al instante. 

Lo mejor de este traductor es que:
1. **No ocupa pantallas**: Corre en segundo plano de manera 100% invisible.
2. **Es resistente a bloqueos**: Si NVIDIA se satura, el traductor encola las peticiones en lugar de romperse con errores `429`.
3. **Cambia de cerebro automáticamente**: Si un modelo se cae o no responde, el proxy prueba inmediatamente con otros cerebros de respaldo (fallback) sin que se interrumpa tu trabajo.

---

## 🛠️ Instalación / Reinstalación

Si necesitas instalar el servicio por primera vez o reconfigurarlo:
1. Abre **PowerShell como Administrador** (clic derecho en el botón de Inicio -> Terminal / PowerShell como Administrador).
2. Escribe los siguientes comandos:
   ```powershell
   cd C:\ClaudeProxy
   .\install-service.ps1
   ```
3. **¡Listo!** El traductor se ha configurado como una tarea programada de Windows que se enciende sola de forma invisible cada vez que prendas tu PC o inicias sesión.

---

## 🏃 Cómo usarlo todos los días

El traductor corre de forma 100% invisible en background. Para programar, solo abre cualquier terminal (en tu workspace de Visual Studio Code o donde prefieras) y ejecuta:

```bash
claude
```

Por defecto, Claude Code utilizará el modelo de alta capacidad **Mistral Large 3** (el cual responde en ~1.3 segundos).

---

## 🍭 ¿Qué modelos puedo usar con `--model`?

Puedes iniciar Claude Code especificando un cerebro en particular pasando el parámetro `--model`. Aquí tienes los modelos recomendados y verificados:

| Cerebro | Comando | Para qué sirve |
| :--- | :--- | :--- |
| **Súper Cerebro (Defecto)** 🧠 | `claude --model mistralai/mistral-large-3-675b-instruct-2512` | Máxima precisión para programación, lógica y análisis (675 Billones de parámetros). |
| **Rayo (Flash)** ⚡ | `claude --model deepseek-ai/deepseek-v4-flash` | Respuesta ultra veloz al instante (~1s de latencia). |
| **Fórmula 1** 🏎️ | `claude --model openai/gpt-oss-20b` | Un modelo ligero e ideal para preguntas sencillas. |
| **Pensamiento Profundo** 🧐 | `claude --model moonshotai/kimi-k2.6` | Excelente para razonamiento lógico complejo antes de responder. |

> 💡 **Mapeo Inteligente**: También puedes escribir nombres estándar de Claude como `claude-3-5-sonnet` o `claude-3-5-haiku` en la terminal. El proxy los traducirá automáticamente al potente **Mistral Large 3** o al veloz **GPT-OSS 20b** respectivamente.

---

## 🚦 Diagnósticos y Luces (Logs)

Si necesitas ver qué está haciendo el proxy bajo el capó (por ejemplo, ver qué modelo está procesando una consulta en vivo), abre una terminal de PowerShell y escribe:

```powershell
Get-Content -Path "C:\ClaudeProxy\proxy.log" -Wait -Tail 15
```

Verás las siguientes señales:
* **`[xxxxxx] 🔄 Intento 1 con modelo: ...`**: El proxy está enviando tu pregunta a NVIDIA usando ese cerebro.
* **`[xxxxxx] 🚦 Rate limit (RPM): en cola (espera ~3s)`**: NVIDIA está saturada. El proxy pausó la petición unos segundos y la enviará automáticamente en cuanto se libere la cola. ¡No tienes que hacer nada!
* **`[xxxxxx] ⏭️ Cambiando a modelo de fallback: ...`**: El modelo que seleccionaste dio un error o timeout, por lo que el proxy cambió automáticamente al siguiente cerebro de respaldo para que no pierdas tu avance.

---

## 🙋 Preguntas Frecuentes (FAQ)

### 1. Si apago mi computadora el viernes y la enciendo el lunes, ¿tengo que levantar el servidor?
**No, no es necesario hacer nada.** El instalador configura el proxy dentro del Programador de Tareas de Windows para que se ejecute de manera invisible al iniciar sesión (`AtLogOn`). El lunes que regreses a trabajar, el proxy ya estará levantado y escuchando en el puerto `9082` automáticamente desde que inicies sesión. Solo abre tu terminal y ejecuta `claude`.

### 2. ¿Cómo puedo apagar/tumbar el proxy si quiero liberar recursos o el puerto?
Si deseas detener por completo la ejecución en segundo plano (muy recomendado si vas a realizar mantenimiento o si necesitas el puerto `9082`), abre una terminal en la carpeta del proxy y ejecuta:
```powershell
C:\ClaudeProxy\manage-proxy.ps1 stop
```
*Esto detendrá inmediatamente el proceso de Node.js y la tarea programada quedará inactiva.*

### 3. Si lo apagué, ¿cómo lo vuelvo a encender manualmente?
Puedes reactivarlo en cualquier momento sin necesidad de reiniciar la PC. Solo ejecuta en tu terminal:
```powershell
C:\ClaudeProxy\manage-proxy.ps1 start
```

### 4. ¿Cómo lo reinicio si se quedó congelado o no responde?
Si notas lentitud o algún comportamiento extraño, puedes hacer un reinicio rápido:
```powershell
C:\ClaudeProxy\manage-proxy.ps1 restart
```

### 5. ¿Cómo desinstalo el proxy por completo de mi sistema?
Si deseas remover el servicio permanente de tu sistema de forma limpia, abre **PowerShell como Administrador** y ejecuta:
```powershell
Stop-ScheduledTask -TaskName "ClaudeProxy-NVIDIA-NIM" -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName "ClaudeProxy-NVIDIA-NIM" -Confirm:$false -ErrorAction SilentlyContinue
```
*(También puedes eliminar las variables de entorno ANTHROPIC_ de tu Windows si ya no vas a usar el proxy).*

¡Disfruta de tu Claude Code potenciado con la infraestructura gratuita de NVIDIA NIM! 🚀✨
