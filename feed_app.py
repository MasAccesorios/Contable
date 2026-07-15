import requests
import base64
import os
import json

target_date = "2026-07-14"

email = 'mauricio.izquierdo@hotmail.com'
api_key = '4be4096858fba53cdc21'
API_URL = 'https://script.google.com/macros/s/AKfycbxrhGrVogJxlZGkVMisyMad-4r-X5eMNl8BtcV2ORNLh4R46KSgYK5fSTrMYe2uozaF/exec'

credentials = f"{email}:{api_key}"
encoded_credentials = base64.b64encode(credentials.encode()).decode()

headers = {
    "Authorization": f"Basic {encoded_credentials}",
    "Accept": "application/json"
}

def sync_alegra_and_feed_app():
    print(f"Sincronizando con Alegra para hoy ({target_date})...")
    
    # 1. Facturas
    inv_res = requests.get(f"https://api.alegra.com/api/v1/invoices?limit=50&order_direction=DESC&date={target_date}", headers=headers)
    invoices = inv_res.json() if inv_res.ok else []
    today_invoices = [inv for inv in invoices if inv.get('date', '').startswith(target_date)]
    
    facturas_alegra = []
    for inv in today_invoices:
        num_limpio = str(inv.get('numberTemplate', {}).get('number', inv.get('id'))).replace('#', '')
        client_name = inv.get('client', {}).get('name', 'Desconocido')
        total = float(inv.get('total') or 0)
        
        doc = {
            "id_alegra": inv.get('id'),
            "numero": num_limpio,
            "fecha_emision": inv.get('date'),
            "fecha_vencimiento": inv.get('dueDate'),
            "cliente_id_alegra": inv.get('client', {}).get('id'),
            "cliente_nombre": client_name,
            "cliente_nit": inv.get('client', {}).get('identification'),
            "estado": inv.get('status'),
            "total": total,
            "saldo": float(inv.get('balance') or 0),
            "abono": total - float(inv.get('balance') or 0),
            "items": inv.get('items', [])
        }
        facturas_alegra.append(doc)

    # 2. Pagos
    pay_res = requests.get(f"https://api.alegra.com/api/v1/payments?limit=50&order_direction=DESC&date={target_date}", headers=headers)
    payments = pay_res.json() if pay_res.ok else []
    today_payments = [pay for pay in payments if pay.get('date', '').startswith(target_date)]
    
    for pay in today_payments:
        for pay_inv in pay.get('invoices', []):
            for f in facturas_alegra:
                if str(f['id_alegra']) == str(pay_inv.get('id')):
                    amount_paid = float(pay_inv.get('amount') or 0)
                    f['abono'] = f.get('abono', 0) + amount_paid
                    f['saldo'] = f['total'] - f['abono']
                    
    # 3. Cotizaciones
    est_res = requests.get(f"https://api.alegra.com/api/v1/estimates?limit=50&order_direction=DESC&date={target_date}", headers=headers)
    estimates = est_res.json() if est_res.ok else []
    today_estimates = [est for est in estimates if est.get('date', '').startswith(target_date)]
    
    cotizaciones_alegra = []
    for est in today_estimates:
        num_limpio = str(est.get('numberTemplate', {}).get('number', est.get('id'))).replace('#', '')
        client_name = est.get('client', {}).get('name', 'Desconocido')
        doc = {
            "id_alegra": est.get('id'),
            "numero": num_limpio,
            "fecha_emision": est.get('date'),
            "validez": est.get('dueDate'),
            "cliente_id_alegra": est.get('client', {}).get('id'),
            "cliente_nombre": client_name,
            "cliente_nit": est.get('client', {}).get('identification'),
            "estado": est.get('status'),
            "total": float(est.get('total') or 0),
            "items": est.get('items', [])
        }
        cotizaciones_alegra.append(doc)

    # Actualizar BD en la nube (Google Sheets que usa db.js)
    print("Enviando facturas a la base de datos de la aplicación...")
    requests.post(API_URL, json={"key": "cg_facturas_alegra", "value": json.dumps(facturas_alegra)})
    
    print("Enviando cotizaciones a la base de datos de la aplicación...")
    requests.post(API_URL, json={"key": "cg_cotizaciones_alegra", "value": json.dumps(cotizaciones_alegra)})
    
    print(f"Completado! {len(facturas_alegra)} facturas y {len(cotizaciones_alegra)} cotizaciones sincronizadas.")

if __name__ == "__main__":
    sync_alegra_and_feed_app()
