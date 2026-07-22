import json
import sys

def validar_y_limpiar(input_file, output_file):
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        print(f"Error al leer {input_file}: {e}")
        return

    if 'productos' not in data:
        print("No se encontró la clave 'productos' en el JSON.")
        return

    productos = data['productos']
    
    # Contadores para reporte
    stock_negativo_count = 0
    sku_vacio_count = 0
    precio_invalido_count = 0
    
    peor_stock = 0
    peor_stock_sku = ""

    print(f"--- Iniciando validación de {len(productos)} productos ---")

    for p in productos:
        # Validación 1: Stock negativo
        if p.get('stockActual', 0) < 0:
            stock_negativo_count += 1
            if p['stockActual'] < peor_stock:
                peor_stock = p['stockActual']
                peor_stock_sku = p.get('sku', 'SIN_SKU')

        # Validación 2: SKU vacío
        if not p.get('sku') or str(p.get('sku')).strip() == "":
            sku_vacio_count += 1
            print(f"Alerta: Producto sin SKU -> {p.get('nombre', 'Sin Nombre')} (ID: {p.get('id')})")

        # Validación 3: Precio de venta < Costo base
        if p.get('precioVenta', 0) < p.get('costoBase', 0):
            precio_invalido_count += 1
            print(f"Alerta: Precio venta menor a costo -> {p.get('sku')} | Venta: {p.get('precioVenta')} | Costo: {p.get('costoBase')}")

        # Limpieza: Eliminar campo ubicacion (aprobado por usuario)
        if 'ubicacion' in p:
            del p['ubicacion']
            
    print("\n--- Resultados de Validación ---")
    print(f"Productos con stock negativo: {stock_negativo_count}")
    if stock_negativo_count > 0:
        print(f"Peor caso de stock negativo: {peor_stock} (SKU: {peor_stock_sku})")
    print(f"Productos con SKU vacío: {sku_vacio_count}")
    print(f"Productos con precio venta < costo: {precio_invalido_count}")
    
    # Guardar archivo limpio
    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"\nArchivo limpio guardado exitosamente en: {output_file}")
    except Exception as e:
        print(f"Error al guardar {output_file}: {e}")

if __name__ == "__main__":
    validar_y_limpiar('datos_alegra.json', 'datos_alegra_limpio.json')
