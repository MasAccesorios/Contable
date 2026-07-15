import codecs
import re

filepath = 'd:/Contable/js/app.js'
with codecs.open(filepath, 'r', 'utf-8', errors='ignore') as f:
    content = f.read()

# For printVenta
# Find: const printWindow = window.open('', '_blank');
venta_repl = '''        const alegraDoc = DB.getAll(DB.KEYS.FACTURAS_ALEGRA).find(a => String(a.numero) === String(sale.numero)) || {};
        const fallbackName = sale.cliente_nombre_alegra || sale.cliente_nombre || alegraDoc.cliente_nombre || 'N/A';
        const fallbackDoc = sale.cliente_nit || sale.cliente_documento || alegraDoc.cliente_nit || '-';
        
        const translateState = (st) => {
            if (!st) return 'BORRADOR';
            const s = String(st).toLowerCase();
            if (s === 'billed' || s === 'pagada' || s === 'closed') return 'FACTURADA';
            if (s === 'open' || s === 'pendiente') return 'PENDIENTE';
            if (s === 'void' || s === 'anulada') return 'ANULADA';
            if (s === 'draft' || s === 'borrador') return 'BORRADOR';
            return st.toUpperCase();
        };
        const printWindow = window.open('', '_blank');'''

content = content.replace("const printWindow = window.open('', '_blank');", venta_repl, 1)

# In printVenta template
content = re.sub(
    r'<p><strong>Nombre:</strong> \$\{client \? client\.nombre : \'N/A\'\}</p>',
    r'<p><strong>Nombre:</strong> </p>',
    content, count=1
)
content = re.sub(
    r'<p><strong>Documento:</strong> \$\{client \? \(client\.documento \|\| \'-\'\) : \'-\'\}</p>',
    r'<p><strong>Documento:</strong> </p>',
    content, count=1
)
content = re.sub(
    r'<span class="estado-badge \$\{sale\.estado\}">\$\{sale\.estado \|\| \'OK\'\}</span>',
    r'<span class="estado-badge "></span>',
    content, count=1
)

# For printCotizacion
# Find: const printWindow = window.open('', '_blank');  (the 2nd one)
cotiz_repl = '''        const alegraDoc = DB.getAll('cg_cotizaciones_alegra').find(a => String(a.numero) === String(c.numero)) || {};
        const fallbackName = c.cliente_nombre_alegra || c.cliente_nombre || alegraDoc.cliente_nombre || (alegraDoc.client ? alegraDoc.client.name : 'N/A');
        const fallbackDoc = c.cliente_nit || c.cliente_documento || alegraDoc.cliente_nit || (alegraDoc.client ? alegraDoc.client.identification : '-');
        
        const translateState = (st) => {
            if (!st) return 'BORRADOR';
            const s = String(st).toLowerCase();
            if (s === 'billed' || s === 'pagada' || s === 'closed') return 'FACTURADA';
            if (s === 'open' || s === 'pendiente') return 'PENDIENTE';
            if (s === 'void' || s === 'anulada') return 'ANULADA';
            if (s === 'draft' || s === 'borrador') return 'BORRADOR';
            if (s === 'accepted') return 'ACEPTADA';
            if (s === 'rejected') return 'RECHAZADA';
            return st.toUpperCase();
        };
        const printWindow = window.open('', '_blank');'''

content = content.replace("const printWindow = window.open('', '_blank');", cotiz_repl, 1)

content = re.sub(
    r'<p><strong>Nombre:</strong> \$\{client \? client\.nombre : \'N/A\'\}</p>',
    r'<p><strong>Nombre:</strong> </p>',
    content, count=1
)
content = re.sub(
    r'<p><strong>Documento:</strong> \$\{client \? \(client\.documento \|\| \'-\'\) : \'-\'\}</p>',
    r'<p><strong>Documento:</strong> </p>',
    content, count=1
)
content = re.sub(
    r'<span class="estado-badge \$\{c\.estado\}">\$\{c\.estado \|\| \'borrador\'\}</span>',
    r'<span class="estado-badge "></span>',
    content, count=1
)

with codecs.open(filepath, 'w', 'utf-8') as f:
    f.write(content)

print("Done")
