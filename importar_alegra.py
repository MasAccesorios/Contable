import requests
import base64
import json
import time

# ==========================================
# CONFIGURACIÓN DE CREDENCIALES
# ==========================================
EMAIL = "mauricio.izquierdo@hotmail.com"
TOKEN_API = "4be4096858fba53cdc21"

credentials = f"{EMAIL}:{TOKEN_API}"
encoded_credentials = base64.b64encode(credentials.encode()).decode()

headers = {
    "Authorization": f"Basic {encoded_credentials}",
    "Accept": "application/json"
}

# ==========================================
# FUNCIÓN PAGINADA CON RATE LIMIT SHIELD
# ==========================================

def consultar_alegra(endpoint, params=None):
    """
    Paginación automática de Alegra (de 30 en 30) con reintentos
    y escudo anti Rate Limit (429).
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
                    reset_time = 15
                    try:
                        if body and isinstance(body, dict) and "headers" in body:
                            reset_time = int(body["headers"].get("x-rate-limit-reset", 15))
                        elif 'x-rate-limit-reset' in response.headers:
                            reset_time = int(response.headers.get('x-rate-limit-reset', 15))
                    except Exception:
                        pass
                    print(f"  [RATE LIMIT] {endpoint} (start={inicio}). Esperando {reset_time}s...")
                    time.sleep(reset_time + 1)
                    intentos += 1
                    continue

                if response.status_code != 200:
                    print(f"  [ERROR] {endpoint} -> HTTP {response.status_code}: {response.text[:200]}")
                    break

                datos = body if body is not None else response.json()
                break

            except Exception as e:
                print(f"  [RED] Error de conexion en {endpoint}: {str(e)}")
                time.sleep(5)
                intentos += 1

        if intentos >= 5:
            print(f"  [FALLO] Superado el maximo de intentos para {endpoint}.")
            break

        if not datos or not isinstance(datos, list) or len(datos) == 0:
            break

        todos_los_registros.extend(datos)

        if len(datos) < limite_paginacion:
            break

        inicio += limite_paginacion

    return todos_los_registros


# ==========================================
# EXTRACCIÓN MASIVA HISTÓRICA - ESPEJO TOTAL
# ==========================================

print("=" * 65)
print(" MIGRACIÓN ESPEJO TOTAL - MAS ACCESORIOS x ALEGRA")
print("=" * 65)

# --- MÓDULO CLIENTES ---
print("\n[1/8] Descargando Clientes...")
clientes_crudos = consultar_alegra("contacts", {"type": "client"})
print(f"      -> {len(clientes_crudos)} clientes descargados.")

# --- MÓDULO PRODUCTOS ---
print("[2/8] Descargando Productos e Inventario...")
productos_crudos = consultar_alegra("items")
print(f"      -> {len(productos_crudos)} productos descargados.")

# --- MÓDULO BANCOS ---
print("[3/8] Descargando Cuentas Bancarias y Cajas...")
cuentas_bancarias_crudas = consultar_alegra("bank-accounts")
print(f"      -> {len(cuentas_bancarias_crudas)} cuentas descargadas.")

# --- MÓDULO MOVIMIENTOS/PAGOS ---
print("[4/8] Descargando Transacciones / Pagos Bancarios...")
movimientos_bancarios_crudos = consultar_alegra("payments")
print(f"      -> {len(movimientos_bancarios_crudos)} movimientos descargados.")

# --- MÓDULO CONCILIACIONES ---
print("[5/8] Descargando Conciliaciones Bancarias...")
conciliaciones_bancarias_crudas = consultar_alegra("conciliations")
print(f"      -> {len(conciliaciones_bancarias_crudas)} conciliaciones descargadas.")

# --- MÓDULO FACTURAS DE VENTA (TODAS, NO SOLO ABIERTAS) ---
print("[6/8] Descargando Facturas de Venta (HISTÓRICO COMPLETO)...")
facturas_crudas = consultar_alegra("invoices")
print(f"      -> {len(facturas_crudas)} facturas descargadas.")

# --- MÓDULO COTIZACIONES ---
print("[7/8] Descargando Cotizaciones / Estimaciones...")
cotizaciones_crudas = consultar_alegra("estimates")
print(f"      -> {len(cotizaciones_crudas)} cotizaciones descargadas.")

# --- MÓDULO VENDEDORES ---
print("[8/8] Descargando Vendedores...")
vendedores_crudos = consultar_alegra("sellers")
print(f"      -> {len(vendedores_crudos)} vendedores descargados.")


# ==========================================
# MAPEADO Y LIMPIEZA DE CAMPOS
# ==========================================

print("\n Procesando y mapeando registros...")

# --- Clientes ---
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
        "barrio": c.get("address", {}).get("description") if c.get("address") else "",
        "codigo_postal": c.get("address", {}).get("zipCode") if c.get("address") else "",
        "regimen_tributario": c.get("taxRegime", "Simplificado"),
        "estado": "Activo" if c.get("status") == "active" else "Inactivo",
        "cupo_credito": float(c.get("creditLimit") or 0),
        "plazo_pago": int(c.get("paymentTerms") or 30),
        "observaciones": c.get("observations") or ""
    })

# --- Productos ---
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
        "ubicacion_bodega": "",
        "estado": "Activo" if p.get("status") == "active" else "Inactivo",
        "observaciones": p.get("description") or ""
    })

# --- Facturas (Histórico Total) ---
facturas_procesadas = []
cartera_procesada = []
for inv in facturas_crudas:
    client = inv.get("client") or {}
    seller = inv.get("seller") or {}
    items_factura = []
    for item in (inv.get("items") or []):
        items_factura.append({
            "id_item_alegra": item.get("id"),
            "nombre": item.get("name"),
            "descripcion": item.get("description", ""),
            "cantidad": float(item.get("quantity") or 0),
            "precio_unitario": float(item.get("price") or 0),
            "descuento": float(item.get("discount") or 0),
            "total": float(item.get("total") or 0),
            "impuesto": [t.get("name") for t in (item.get("tax") or [])]
        })

    taxes_total = float(inv.get("tax") or 0)
    retenciones = [r.get("name") for r in (inv.get("retentions") or [])] if inv.get("retentions") else []

    factura_obj = {
        "id_alegra": inv.get("id"),
        "numero": inv.get("numberTemplate", {}).get("number") or inv.get("number") or inv.get("id"),
        "fecha_emision": inv.get("date"),
        "fecha_vencimiento": inv.get("dueDate"),
        "cliente_id_alegra": client.get("id"),
        "cliente_nombre": client.get("name"),
        "cliente_nit": client.get("identification"),
        "vendedor_id_alegra": seller.get("id"),
        "vendedor_nombre": seller.get("name"),
        "subtotal": float(inv.get("subtotal") or 0),
        "descuento": float(inv.get("discount") or 0),
        "impuesto": taxes_total,
        "retenciones": retenciones,
        "total": float(inv.get("total") or 0),
        "saldo": float(inv.get("balance") or 0),
        "total_pagado": float(inv.get("totalPaid") or 0),
        "estado": inv.get("status"),
        "forma_pago": inv.get("paymentForm"),
        "termino_pago": inv.get("term"),
        "observaciones": inv.get("observations") or "",
        "items": items_factura
    }
    facturas_procesadas.append(factura_obj)

    # Cartera: Solo facturas con saldo pendiente
    if float(inv.get("balance") or 0) > 0:
        cartera_procesada.append({
            "id_factura": inv.get("id"),
            "numero": factura_obj["numero"],
            "fecha_emision": inv.get("date"),
            "fecha_vencimiento": inv.get("dueDate"),
            "cliente_id": client.get("id"),
            "cliente_nombre": client.get("name"),
            "nit_rut": client.get("identification"),
            "total": float(inv.get("total") or 0),
            "saldo": float(inv.get("balance") or 0),
            "status": inv.get("status")
        })

# --- Cotizaciones ---
cotizaciones_procesadas = []
for est in cotizaciones_crudas:
    client = est.get("client") or {}
    seller = est.get("seller") or {}
    items_cot = []
    for item in (est.get("items") or []):
        items_cot.append({
            "id_item_alegra": item.get("id"),
            "nombre": item.get("name"),
            "descripcion": item.get("description", ""),
            "cantidad": float(item.get("quantity") or 0),
            "precio_unitario": float(item.get("price") or 0),
            "descuento": float(item.get("discount") or 0),
            "total": float(item.get("total") or 0),
            "impuesto": [t.get("name") for t in (item.get("tax") or [])]
        })

    cotizaciones_procesadas.append({
        "id_alegra": est.get("id"),
        "numero": est.get("numberTemplate", {}).get("number") or est.get("number") or est.get("id"),
        "fecha_emision": est.get("date"),
        "fecha_vencimiento": est.get("dueDate"),
        "cliente_id_alegra": client.get("id"),
        "cliente_nombre": client.get("name"),
        "cliente_nit": client.get("identification"),
        "vendedor_id_alegra": seller.get("id"),
        "vendedor_nombre": seller.get("name"),
        "subtotal": float(est.get("subtotal") or 0),
        "descuento": float(est.get("discount") or 0),
        "impuesto": float(est.get("tax") or 0),
        "total": float(est.get("total") or 0),
        "estado": est.get("status"),
        "observaciones": est.get("observations") or "",
        "items": items_cot
    })

# --- Vendedores ---
vendedores_procesados = []
for v in vendedores_crudos:
    vendedores_procesados.append({
        "id_alegra": v.get("id"),
        "nombre": v.get("name"),
        "email": v.get("email") or "",
        "identificacion": v.get("identification") or "",
        "estado": "Activo" if v.get("status") == "active" else "Inactivo",
        "observaciones": v.get("observations") or ""
    })


# ==========================================
# CONSOLIDACIÓN FINAL Y GUARDADO
# ==========================================

base_de_datos_final = {
    "clientes": clientes_procesados,
    "productos_y_inventario": productos_procesados,
    "cuentas_bancarias": cuentas_bancarias_crudas,
    "movimientos_bancarios": movimientos_bancarios_crudos,
    "conciliaciones_bancarias": conciliaciones_bancarias_crudas,
    "facturas_venta": facturas_procesadas,
    "cuentas_por_cobrar": cartera_procesada,
    "cotizaciones": cotizaciones_procesadas,
    "vendedores": vendedores_procesados
}

with open("datos_alegra.json", "w", encoding="utf-8") as f:
    json.dump(base_de_datos_final, f, indent=2, ensure_ascii=False)


# ==========================================
# REPORTE DE CONCILIACIÓN FINAL
# ==========================================

print("\n" + "=" * 65)
print(" REPORTE DE CONCILIACIÓN - ESPEJO TOTAL COMPLETADO")
print("=" * 65)
print(f"  Clientes                    : {len(clientes_procesados):>6}")
print(f"  Productos / Inventario      : {len(productos_procesados):>6}")
print(f"  Cuentas Bancarias / Cajas   : {len(cuentas_bancarias_crudas):>6}")
print(f"  Movimientos / Pagos         : {len(movimientos_bancarios_crudos):>6}")
print(f"  Conciliaciones Bancarias    : {len(conciliaciones_bancarias_crudas):>6}")
print(f"  Facturas de Venta (Total)   : {len(facturas_procesadas):>6}")
print(f"  Cuentas por Cobrar (Saldo)  : {len(cartera_procesada):>6}")
print(f"  Cotizaciones / Estimaciones : {len(cotizaciones_procesadas):>6}")
print(f"  Vendedores                  : {len(vendedores_procesados):>6}")
print("=" * 65)
print("  Archivo guardado: datos_alegra.json")
print("=" * 65)
