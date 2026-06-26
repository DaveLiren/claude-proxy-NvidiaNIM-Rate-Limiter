# Skill: Configuración Asistida de Claude + NVIDIA NIM Proxy

Este archivo proporciona instrucciones paso a paso para que cualquier agente de IA (como Antigravity, Hermes, OpenClaw o Claude Code CLI) guíe y configure automáticamente el entorno del proxy en la computadora del usuario.

---

## 🤖 INSTRUCCIONES PARA EL AGENTE DE IA (SYSTEM INSTRUCTIONS)

Lee y ejecuta minuciosamente las siguientes directivas antes de proceder con el desarrollo o configuración del proyecto:

### 1. Verificación Inicial
- Comprueba si en el directorio raíz del proyecto existe un archivo `.env`.
- Si **no existe**, pero hay un archivo `.env.example`, haz una copia del mismo y nómbrala `.env`. Si no hay plantilla, crea un archivo `.env` vacío.
- También verifica si existe el archivo `proxy-service.bat` en la raíz.

### 2. Detección y Solicitud de la API Key de Nvidia NIM
- Comprueba si la variable `NVIDIA_API_KEY` ya está definida y tiene un valor válido (las claves de Nvidia suelen comenzar con `nvapi-`) en alguno de estos dos archivos:
  - En el archivo `.env` (como `NVIDIA_API_KEY=nvapi-...`)
  - En el archivo `proxy-service.bat` (como `set NVIDIA_API_KEY=nvapi-...`)
- Si no está configurada o contiene un valor genérico/vacío:
  1. Detén cualquier otra tarea inmediatamente.
  2. Pregúntale de forma clara, directa y amable al usuario en el chat:
     > *"Hola, he detectado que falta configurar la API Key de Nvidia NIM para el proxy. ¿Podrías proporcionarme tu `NVIDIA_API_KEY` (comienza con `nvapi-`) para guardarla en la configuración?"*
  3. Espera a que el usuario te provea el token en el chat.
  4. Guarda el token en:
     - El archivo `.env` agregando o actualizando la línea:
       ```env
       NVIDIA_API_KEY=tu_token_aqui
       ```
     - Si existe `proxy-service.bat`, actualiza también la línea correspondiente para reflejar el token:
       ```bat
       set NVIDIA_API_KEY=tu_token_aqui
       ```

### 3. Configuración del Entorno local
- Si el usuario requiere configurar variables adicionales (como el puerto de escucha), sugiérele establecer `PROXY_PORT` (por defecto `9082` en el servicio de Windows o `8082` en la ejecución standalone de Node.js).
- Si el usuario desea configurar Claude Code CLI local para apuntar al proxy, explícale que debe definir las siguientes variables en su terminal de Windows:
  - **PowerShell**:
    ```powershell
    $env:ANTHROPIC_BASE_URL = "http://localhost:9082"
    $env:ANTHROPIC_API_KEY  = "nvapi-xxxx..." # su Nvidia API Key
    ```
  - **CMD / Símbolo del Sistema**:
    ```cmd
    set ANTHROPIC_BASE_URL=http://localhost:9082
    set ANTHROPIC_API_KEY=nvapi-xxxx...
    ```

### 4. Verificación del Funcionamiento
- Una vez guardados los datos, ofrécete a verificar si el proxy o las dependencias están listas:
  - Verifica si `node_modules` existe. Si no, sugiérele o realiza la instalación ejecutando `npm install`.
  - Confírmale al usuario que todo está listo con un mensaje de éxito:
    > *"¡Listo! He configurado tu clave en el entorno. El proxy ya cuenta con las credenciales necesarias para iniciar."*
