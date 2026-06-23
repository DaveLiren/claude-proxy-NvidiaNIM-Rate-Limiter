import zipfile
import xml.etree.ElementTree as ET
import os
import re
import json

xlsx_path = r"C:\ClaudeProxy\modelos_ai_organizados.xlsx"
json_path = r"C:\ClaudeProxy\modelos_detectados.json"

# Filtro para identificar posibles identificadores de modelos
def is_likely_model(text):
    text = text.strip()
    if not text:
        return False
    if " " in text:
        return False
    
    # Formato común: proveedor/nombre-modelo
    if "/" in text:
        parts = text.split("/")
        if len(parts) == 2 and parts[0] and parts[1]:
            # Solo permitir caracteres válidos de nombres de modelos
            if re.match(r"^[a-zA-Z0-9_-]+$", parts[0]) and re.match(r"^[a-zA-Z0-9._-]+$", parts[1]):
                return True
                
    # Formato alternativo sin barra (ej: llama-3-8b-instruct)
    if "-" in text and any(c.isdigit() for c in text):
        if re.match(r"^[a-zA-Z0-9._-]+$", text):
            # Ignorar palabras muy cortas o comunes
            if len(text) > 5 and not text.lower().startswith("sheet"):
                return True
                
    return False

models = []

if os.path.exists(xlsx_path):
    try:
        with zipfile.ZipFile(xlsx_path, 'r') as zip_ref:
            try:
                # Leer las cadenas de texto del libro de Excel
                shared_strings = zip_ref.read('xl/sharedStrings.xml')
                root = ET.fromstring(shared_strings)
                ns = {'ns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
                
                # Extraer textos de los nodos <t>
                texts = [elem.text for elem in root.findall('.//ns:t', ns)]
                for t in texts:
                    if t:
                        t_clean = t.strip()
                        if is_likely_model(t_clean):
                            models.append(t_clean)
            except KeyError:
                print("⚠️ No se encontró sharedStrings.xml en el archivo Excel.")
    except Exception as e:
        print(f"❌ Error al procesar el archivo zip/xlsx: {e}")
else:
    print(f"❌ Archivo no encontrado en: {xlsx_path}")

# Eliminar duplicados manteniendo el orden original
unique_models = []
for m in models:
    if m not in unique_models:
        unique_models.append(m)

# Escribir a JSON
try:
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(unique_models, f, indent=2)
    print(f"✅ Éxito: Se extrajeron {len(unique_models)} modelos y se guardaron en {json_path}")
    print("\nModelos detectados:")
    for m in unique_models:
        print(f" - {m}")
except Exception as e:
    print(f"❌ Error al escribir el JSON: {e}")
