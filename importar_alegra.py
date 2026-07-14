import requests
import base64
import json
import time

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
# EXTRACCIÓN MASIVA HISTÓRICA (MIGRACIÓN ESPEJO)
# ==========================================

print("Iniciando MIGRACION ESPEJO de datos historicos desde Alegra...")

# 1. Descargar Clientes
print("-> Descargando Clientes...")
clientes_crudos = consultar_alegra("contacts", {"type": "client"})

# 2. Descargar Productos
print("-> Descargando Productos e Inventarios...")
productos_crudos = consultar_alegra("items")

# 3. Descargar Cuentas Bancarias
print("-> Descargando Cuentas Bancarias y Cajas...")
cuentas_bancarias_crudas = consultar_alegra("bank-accounts")

# 4. Descargar Movimientos Bancarios (Transacciones)
print("-> Descargando Transacciones y Pagos bancarios (Movimientos)...")
movimientos_bancarios_crudos = consultar_alegra("payments")

# 5. Descargar Conciliaciones Bancarias
print("-> Descargando Conciliaciones Bancarias...")
conciliaciones_bancarias_crudas = consultar_alegra("conciliations")

# 6. Descargar Facturas de Venta (Cartera)
print("-> Descargando Facturas de Venta...")
facturas_crudas = consultar_alegra("invoices")


# ==========================================
# LIMPIEZA Y MAPEADO DE CAMPOS CRÍTICOS
# ==========================================

# Limpiar estructura de clientes
clientes_procesados = []
for c in clientes_crudos:
    clientes_procesados.append({
        "id_alegra": c.get("id"),
        "nombre": c.get("name"),
        "nit_rut": c.get("identification"),
        "tipo_documento": c.get("identificationType", "NIT"),
        "email": c.get("email"),
        "telefono": c.get("phoneprimary") or c.get("mobile"),
        "direccion": c.get("address", {}).get("address") if c.get("address") else "",
        "ciudad": c.get("address", {}).get("city") if c.get("address") else "",
        "departamento": c.get("address", {}).get("department") if c.get("address") else "",
        "pais": c.get("address", {}).get("country", "Colombia") if c.get("address") else "Colombia",
        "barrio": c.get("address", {}).get("description") if c.get("address") else "", # Alegra usa description como barrio/detalles
        "codigo_postal": c.get("address", {}).get("zipCode") if c.get("address") else "",
        "regimen_tributario": c.get("taxRegime", "Simplificado"),
        "estado": "Activo" if c.get("status") == "active" else "Inactivo",
        "cupo_credito": float(c.get("creditLimit") or 0),
        "plazo_pago": int(c.get("paymentTerms") or 30),
        "observaciones": c.get("observations") or ""
    })

# Limpiar estructura de productos
productos_procesados = []
for p in productos_crudos:
    inventario_info = p.get("inventory") or {}
    es_inventariable = (p.get("type") != "service") and (p.get("inventory") is not None)
    
    productos_procesados.append({
        "id_alegra": p.get("id"),
        "nombre": p.get("name"),
        "referencia_sku": p.get("reference"),
        "precio_venta": p.get("price", [{}])[0].get("price") if p.get("price") else 0,
        "es_inventariable": es_inventariable,
        "stock_actual": inventario_info.get("availableQuantity", 0) if es_inventariable else "No aplica",
        "costo_unitario": inventario_info.get("unitCost", 0) if es_inventariable else 0,
        "categoria": p.get("category", {}).get("name") if p.get("category") else "",
        "unidad_medida": inventario_info.get("unit", "Unidad"),
        "ubicacion_bodega": "", # Mapeo manual posterior
        "estado": "Activo" if p.get("status") == "active" else "Inactivo",
        "observaciones": p.get("description") or ""
    })

# Filtrar cartera de clientes con saldo pendiente
cartera_procesada = []
for inv in facturas_crudas:
    balance = float(inv.get("balance") or 0)
    if balance > 0:
        client = inv.get("client") or {}
        cartera_procesada.append({
            "id_factura": inv.get("id"),
            "numero": inv.get("numberTemplate", {}).get("number") or inv.get("number") or inv.get("id"),
            "fecha_emision": inv.get("date"),
            "fecha_vencimiento": inv.get("dueDate"),
            "cliente_id": client.get("id"),
            "cliente_nombre": client.get("name"),
            "nit_rut": client.get("identification"),
            "total": float(inv.get("total") or 0),
            "saldo": balance,
            "status": inv.get("status")
        })

# Estructura unificada para alimentar el software local
base_de_datos_final = {
    "clientes": clientes_procesados,
    "productos_y_inventario": productos_procesados,
    "cuentas_bancarias": cuentas_bancarias_crudas,
    "movimientos_bancarios": movimientos_bancarios_crudos,
    "conciliaciones_bancarias": conciliaciones_bancarias_crudas,
    "cuentas_por_cobrar": cartera_procesada
}

# Guardar en un archivo JSON local
with open("datos_alegra.json", "w", encoding="utf-8") as f:
    json.dump(base_de_datos_final, f, indent=4, ensure_ascii=False)

print(f"\n¡Proceso de Extracción Espejo Completado con éxito!")
print(f"Total Clientes importados: {len(clientes_procesados)}")
print(f"Total Productos importados: {len(productos_procesados)}")
print(f"Total Cuentas Bancarias importadas: {len(cuentas_bancarias_crudas)}")
print(f"Total Movimientos Bancarios importados: {len(movimientos_bancarios_crudos)}")
print(f"Total Conciliaciones Bancarias importadas: {len(conciliaciones_bancarias_crudas)}")
print(f"Total Cuentas por Cobrar (Facturas abiertas) importadas: {len(cartera_procesada)}")
print("Los datos se han guardado de manera limpia en el archivo 'datos_alegra.json'")
