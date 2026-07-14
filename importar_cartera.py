import requests
import base64
import json
import time
import os

# ==========================================
# CONFIGURACIÓN DE CREDENCIALES
# ==========================================
EMAIL = "mauricio.izquierdo@hotmail.com"  # El correo con el que entras a Alegra
TOKEN_API = "4be4096858fba53cdc21"  # Tu API Token generado en Alegra

# Codificar credenciales en Base64 para Basic Auth
credentials = f"{EMAIL}:{TOKEN_API}"
encoded_credentials = base64.b64encode(credentials.encode()).decode()

headers = {
    "Authorization": f"Basic {encoded_credentials}",
    "Accept": "application/json"
}

def consultar_alegra(endpoint, params=None):
    """
    Función auxiliar que maneja la paginación automática de Alegra (de 30 en 30)
    con reintentos en caso de límite de solicitudes (Rate Limit/429).
    """
    if params is None:
        params = {}
        
    url = f"https://api.alegra.com/api/v1/{endpoint}"
    todos_los_registros = []
    limite_paginacion = 30
    inicio = 0
    
    while True:
        params['start'] = inicio
        params['limit'] = limite_paginacion
        
        intentos = 0
        datos = []
        while intentos < 5:
            try:
                response = requests.get(url, headers=headers, params=params)
                
                is_rate_limited = False
                body = None
                try:
                    body = response.json()
                    if isinstance(body, dict) and body.get("code") == 429:
                        is_rate_limited = True
                except Exception:
                    pass
                
                if response.status_code == 429 or is_rate_limited:
                    print(f"Limite de solicitudes alcanzado en Alegra (429/Rate Limit) para {endpoint}. Esperando para reintentar...")
                    reset_time = 15
                    try:
                        if body and isinstance(body, dict) and "headers" in body:
                            reset_time = int(body["headers"].get("x-rate-limit-reset", 15))
                    except Exception:
                        pass
                    print(f"Esperando {reset_time} segundos antes del reintento...")
                    time.sleep(reset_time + 1)
                    intentos += 1
                    continue
                
                if response.status_code != 200:
                    print(f"Error al consultar {endpoint}: {response.status_code} - {response.text}")
                    break
                    
                datos = body if body is not None else response.json()
                break
            except Exception as e:
                print(f"Error de red/conexion al consultar {endpoint}: {str(e)}")
                time.sleep(5)
                intentos += 1
        
        if intentos >= 5:
            print(f"Se supero el numero maximo de intentos para el endpoint {endpoint}.")
            break
            
        # Si no hay más registros o la respuesta no es una lista, rompemos el ciclo
        if not datos or not isinstance(datos, list) or len(datos) == 0:
            break
            
        todos_los_registros.extend(datos)
        
        # Si devolvió menos del límite, significa que es la última página
        if len(datos) < limite_paginacion:
            break
            
        inicio += limite_paginacion
        
    return todos_los_registros

# ==========================================
# EXTRACCIÓN DE FACTURAS DE VENTA (CARTERA)
# ==========================================

print("Iniciando descarga de Cuentas por Cobrar (Facturas con saldo pendiente) desde Alegra...")

# Cargar base de datos existente si existe para no borrar clientes, productos, bancos
base_de_datos = {}
if os.path.exists("datos_alegra.json"):
    try:
        with open("datos_alegra.json", "r", encoding="utf-8") as f:
            base_de_datos = json.load(f)
        print("-> Se cargo la base de datos existente 'datos_alegra.json'.")
    except Exception as e:
        print(f"-> No se pudo leer 'datos_alegra.json' ({str(e)}), se creara un archivo nuevo.")
else:
    print("-> No existe 'datos_alegra.json', se creara un archivo nuevo.")

# Descargar facturas de venta
print("-> Descargando Facturas de Venta...")
facturas_crudas = consultar_alegra("invoices")

# Filtrar aquellas con saldo pendiente (balance > 0)
cartera_procesada = []
for inv in facturas_crudas:
    balance = float(inv.get("balance") or 0)
    if balance > 0:
        client = inv.get("client") or {}
        cartera_procesada.append({
            "id_factura": inv.get("id"),
            "numero": inv.get("number"),
            "fecha_emision": inv.get("date"),
            "fecha_vencimiento": inv.get("dueDate"),
            "cliente_id": client.get("id"),
            "cliente_nombre": client.get("name"),
            "total": float(inv.get("total") or 0),
            "saldo": balance,
            "status": inv.get("status")
        })

# ==========================================
# GUARDAR O ACTUALIZAR BASE DE DATOS
# ==========================================

base_de_datos["cuentas_por_cobrar"] = cartera_procesada

with open("datos_alegra.json", "w", encoding="utf-8") as f:
    json.dump(base_de_datos, f, indent=4, ensure_ascii=False)

print(f"\nProceso de Cuentas por Cobrar completado con exito!")
print(f"Total Facturas de Venta analizadas: {len(facturas_crudas)}")
print(f"Total Cuentas por Cobrar con saldo pendiente: {len(cartera_procesada)}")
print("Los datos se han guardado de manera limpia en el archivo 'datos_alegra.json'")
