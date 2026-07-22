import json, codecs
with codecs.open('js/alegra_data.js', 'r', 'utf-8-sig') as f:
    data = f.read().split('window.ALEGRA_SYNC_DATA = ', 1)[1].strip()
    data = data[:-1] if data.endswith(';') else data
    d = json.loads(data)
    print("Keys in d:", list(d.keys()))
    print("Pagos:", len(d.get('pagos', [])))
    print("Bancos:", len(d.get('bancos', [])))
    if len(d.get('bancos', [])) > 0:
        print(d['bancos'])
