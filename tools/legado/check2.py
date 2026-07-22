import json, codecs
with codecs.open('js/alegra_data.js', 'r', 'utf-8-sig') as f:
    data = f.read().split('window.ALEGRA_SYNC_DATA = ', 1)[1].strip()
    data = data[:-1] if data.endswith(';') else data
    d = json.loads(data)
    facturas = d.get('facturas', [])
    pagadas = [x for x in facturas if float(x.get('abono', 0)) > 0]
    con_banco = [x for x in facturas if x.get('banco_id')]
    print("Facturas pagadas:", len(pagadas))
    print("Facturas con banco_id:", len(con_banco))
