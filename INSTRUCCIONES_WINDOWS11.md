# ⚠️ Archivo Depreciado / Obsoleto

Este archivo (`INSTRUCCIONES_WINDOWS11.md`) contiene instrucciones obsoletas que hacían uso de **LiteLLM** en el puerto `4000`. 

La infraestructura actual del proyecto ha sido migrada a un **Proxy nativo en Node.js** que corre en el puerto `9082`.

Por favor, utiliza las siguientes guías actualizadas:

1. **Guía de Usuario Diario (Modo Servicio y Modo Manual)**:
   * 👉 [INSTRUCCIONES.md](file:///c:/ClaudeProxy/INSTRUCCIONES.md)
2. **Guía Técnica de Replicación y Arquitectura del Proxy**:
   * 👉 [claude+nvidia-nim.md](file:///c:/ClaudeProxy/claude+nvidia-nim.md)

---
*Nota: Si tienes tareas programadas antiguas creadas bajo el nombre `NvidiaNimLiteLLMProxy`, puedes detenerlas y eliminarlas desde PowerShell como Administrador ejecutando:*
```powershell
Stop-ScheduledTask -TaskName "NvidiaNimLiteLLMProxy" -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName "NvidiaNimLiteLLMProxy" -Confirm:$false -ErrorAction SilentlyContinue
```
