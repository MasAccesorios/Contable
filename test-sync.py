import requests
import base64
import os
import json

# Configurar la fecha objetivo solicitada
target_date = "2026-07-14"

# 1. Configurar credenciales (Puedes reemplazar los strings o usar variables de entorno)
email = os.environ.get('ALEGRA_EMAIL', 'mauricio.izquierdo@hotmail.com')
api_key = os.environ.get('ALEGRA_API_KEY', '4be4096858fba53cdc21')

credentials = f"{email}:{api_key}"
encoded_credentials = base64.b64encode(credentials.encode()).decode()

headers = {
    "Authorization": f"Basic {encoded_credentials}",
    "Accept": "application/json"
}

# Objeto simulado para guardar los datos en memoria en Python
BaseDeDatosLocal = {
    "facturas": [],
    "cotizaciones": []
}

def sync_alegra_today():
    print(f"\nIniciando sincronización de prueba en Python (Día: {target_date})...")

    try:
        # 1. Sincronizar Facturas
        print("-> Descargando facturas de Alegra...")
        inv_res = requests.get(f"https://api.alegra.com/api/v1/invoices?limit=50&order_direction=DESC&date={target_date}", headers=headers)
        if not inv_res.ok:
            raise Exception(f"Error obteniendo facturas: {inv_res.status_code}")
        
        invoices = inv_res.json()
        today_invoices = [inv for inv in invoices if inv.get('date', '').startswith(target_date)]
        
        for inv in today_invoices:
            num_limpio = str(inv.get('numberTemplate', {}).get('number', inv.get('id'))).replace('#', '')
            client_name = inv.get('client', {}).get('name')
            if not client_name:
                client_name = 'Desconocido'
            total = float(inv.get('total') or 0)
            
            BaseDeDatosLocal["facturas"].append({
                "id_alegra": inv.get('id'),
                "numero": num_limpio,
                "fecha_emision": inv.get('date'),
                "cliente_nombre": client_name,
                "estado": inv.get('status'),
                "total": total,
                "saldo": float(inv.get('balance') or 0),
                "abono": total - float(inv.get('balance') or 0)
            })
        
        print(f"✓ [Éxito] Se procesaron y guardaron en memoria {len(today_invoices)} facturas de venta.")

        # 2. Sincronizar Pagos / Recibos de Caja (Abonos)
        print("-> Descargando pagos/recibos de Alegra...")
        pay_res = requests.get(f"https://api.alegra.com/api/v1/payments?limit=50&order_direction=DESC&date={target_date}", headers=headers)
        if not pay_res.ok:
            raise Exception(f"Error obteniendo pagos: {pay_res.status_code}")
            
        payments = pay_res.json()
        today_payments = [pay for pay in payments if pay.get('date', '').startswith(target_date)]
        
        for pay in today_payments:
            invoices_paid = pay.get('invoices', [])
            for pay_inv in invoices_paid:
                local_factura = next((f for f in BaseDeDatosLocal["facturas"] if str(f["id_alegra"]) == str(pay_inv.get('id'))), None)
                if local_factura:
                    amount_paid = float(pay_inv.get('amount') or 0)
                    local_factura["abono"] = local_factura.get("abono", 0) + amount_paid
                    local_factura["saldo"] = local_factura["total"] - local_factura["abono"]
                    
        print(f"✓ [Éxito] Se procesaron y cruzaron {len(today_payments)} pagos contra las facturas.")

        # 3. Sincronizar Cotizaciones
        print("-> Descargando cotizaciones de Alegra...")
        est_res = requests.get(f"https://api.alegra.com/api/v1/estimates?limit=50&order_direction=DESC&date={target_date}", headers=headers)
        if not est_res.ok:
            raise Exception(f"Error obteniendo cotizaciones: {est_res.status_code}")
            
        estimates = est_res.json()
        today_estimates = [est for est in estimates if est.get('date', '').startswith(target_date)]
        
        for est in today_estimates:
            num_limpio = str(est.get('numberTemplate', {}).get('number', est.get('id'))).replace('#', '')
            client_name = est.get('client', {}).get('name')
            if not client_name:
                client_name = 'Desconocido'
                
            BaseDeDatosLocal["cotizaciones"].append({
                "id_alegra": est.get('id'),
                "numero": num_limpio,
                "fecha_emision": est.get('date'),
                "cliente_nombre": client_name,
                "estado": est.get('status'),
                "total": float(est.get('total') or 0)
            })
            
        print(f"✓ [Éxito] Se procesaron y guardaron en memoria {len(today_estimates)} cotizaciones.")
        
        print("\n================ RESUMEN DE LA PRUEBA ================")
        print(f"- Facturas locales guardadas: {len(BaseDeDatosLocal['facturas'])}")
        print(f"- Cotizaciones locales guardadas: {len(BaseDeDatosLocal['cotizaciones'])}")
        print("Nota: Estos registros han sido mapeados correctamente y están listos para ser persistidos.")
        print("========================================================\n")
        
        # Save to JSON file as a proof
        with open("test_sync_results.json", "w", encoding="utf-8") as f:
            json.dump(BaseDeDatosLocal, f, indent=4, ensure_ascii=False)
        print("Se ha generado el archivo 'test_sync_results.json' con el volcado de los datos.")

    except Exception as e:
        print(f"\n❌ Error durante la sincronización desde Python: {e}")

if __name__ == "__main__":
    sync_alegra_today()
