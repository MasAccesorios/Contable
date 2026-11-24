import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
    buildEstadoCuentaWhatsAppText,
    normalizeWhatsAppPhone,
    resolveClienteIdFromFactura,
    buildWhatsAppUrl,
    OFICIAL_CUENTAS_BANCARIAS
} from '../js/shared/cobranzaUtils.js';

describe('Unificación de Cobranza & Estado de Cuenta WhatsApp - Test Suite', () => {

    // =========================================================================
    // 1. GENERADOR DE TEXTO ENRIQUECIDO DE ESTADO DE CUENTA
    // =========================================================================
    describe('buildEstadoCuentaWhatsAppText', () => {
        const mockCliente = {
            id: 'cli-001',
            nombre: 'Distribuidora San Juan',
            identificacion: '900123456-7',
            telefono: '3158512091'
        };

        const mockFacturas = [
            {
                id: 'fac-101',
                numero: 'FE-101',
                fecha: '2026-10-01',
                vencimiento: '2026-10-31',
                total: 250000,
                saldo: 150000,
                diasDespachado: 45
            },
            {
                id: 'fac-102',
                numero: 'FE-102',
                fecha: '2026-10-15',
                vencimiento: '2026-11-15',
                total: 300000,
                saldo: 300000,
                diasDespachado: 31
            }
        ];

        it('por defecto debe generar un saludo cordial limpio para acompañar la hoja en blanco sin duplicar detalles', () => {
            const texto = buildEstadoCuentaWhatsAppText({
                cliente: mockCliente,
                facturas: mockFacturas
            });

            // Debe saludar cordialmente usando el nombre del cliente
            assert.match(texto, /Estimado\(a\) \*Distribuidora San Juan\*, cordial saludo\./);
            assert.match(texto, /Quedamos atentos a cualquier inquietud/i);
            assert.match(texto, /confirmación de su pago/i);

            // NO debe incluir la frase eliminada por el usuario
            assert.doesNotMatch(texto, /Le compartimos su cuenta de cobro a la fecha en el formato adjunto/i);
            assert.doesNotMatch(texto, /formato adjunto/i);

            // NO debe duplicar en texto el detalle de facturas ni los medios de pago (que ya van en la hoja en blanco)
            assert.doesNotMatch(texto, /Detalle de Facturas/);
            assert.doesNotMatch(texto, /MEDIOS DE PAGO AUTORIZADOS/);
            assert.doesNotMatch(texto, /Fac #FE-101/);
            assert.doesNotMatch(texto, /Bancolombia/);
        });

        it('debe saludar cordialmente usando el nombre del cliente', () => {
            const texto = buildEstadoCuentaWhatsAppText({
                cliente: mockCliente,
                facturas: mockFacturas
            });

            assert.match(texto, /Estimado\(a\) \*Distribuidora San Juan\*, cordial saludo\./);
        });

        it('debe utilizar fallback cordial si el cliente no tiene nombre o es nulo', () => {
            const texto = buildEstadoCuentaWhatsAppText({
                cliente: { id: 'cli-anon' },
                facturas: mockFacturas
            });

            assert.match(texto, /Estimado\(a\) \*Cliente\*, cordial saludo\./);
        });

        it('cuando detailed: true, debe incluir encabezado oficial, desglose de facturas y medios de pago', () => {
            const fechaCorte = '2026-11-20';
            const texto = buildEstadoCuentaWhatsAppText({
                cliente: mockCliente,
                facturas: mockFacturas,
                fechaCorte,
                detailed: true
            });

            assert.match(texto, /\*ESTADO DE CUENTA - MAS ACCESORIOS\*/);
            assert.match(texto, /Fecha de corte: 2026-11-20/);
            assert.match(texto, /Fac #FE-101/);
            assert.match(texto, /Vence: 2026-10-31/);
            assert.match(texto, /45 días despachado/);
            assert.match(texto, /\$ 150\.000/);
            assert.match(texto, /Saldo Total Pendiente:.*\$ 450\.000/);
            assert.match(texto, /Facturas Pendientes:\* 2/);
            assert.match(texto, /Bancolombia \(Ahorros\):\* 54700050214/);
            assert.match(texto, /Titular: Diego M Izquierdo/);
            assert.match(texto, /Nequi \/ DaviPlata:\* 3158512091/);
            assert.match(texto, /Llave Bre-B \/ Transfiya:\* @izquierdo638/);
            assert.match(texto, /Confirmar Pago:\* Favor enviar su comprobante a este WhatsApp \(3158512091\)/);
        });

        it('debe generar mensaje de Felicitación / Paz y Salvo cuando el cliente no tiene facturas pendientes (0 facturas)', () => {
            const texto = buildEstadoCuentaWhatsAppText({
                cliente: mockCliente,
                facturas: []
            });

            assert.match(texto, /Estimado\(a\) \*Distribuidora San Juan\*, cordial saludo\./);
            assert.match(texto, /al día/i);
            assert.match(texto, /sin saldos pendientes/i);
            assert.match(texto, /agradecemos su puntualidad/i);

            // No debe incluir solicitud de pago ni cuentas de cobro
            assert.doesNotMatch(texto, /Bancolombia/);
            assert.doesNotMatch(texto, /Saldo Total Pendiente/);
        });

        it('debe generar mensaje de Felicitación / Paz y Salvo si todas las facturas tienen saldo $0', () => {
            const facturasCero = [
                { id: 'f1', numero: 'FE-1', saldo: 0 },
                { id: 'f2', numero: 'FE-2', saldo: 0 }
            ];

            const texto = buildEstadoCuentaWhatsAppText({
                cliente: mockCliente,
                facturas: facturasCero
            });

            assert.match(texto, /al día/i);
            assert.match(texto, /sin saldos pendientes/i);
            assert.doesNotMatch(texto, /Bancolombia/);
        });

        it('debe aceptar tanto firma por objeto { cliente, facturas } como posicional (cliente, facturas, options)', () => {
            const textoPosicional = buildEstadoCuentaWhatsAppText(mockCliente, mockFacturas);
            assert.match(textoPosicional, /Estimado\(a\) \*Distribuidora San Juan\*, cordial saludo\./);
            assert.match(textoPosicional, /Quedamos atentos a cualquier inquietud/i);

            const textoPosicionalDetailed = buildEstadoCuentaWhatsAppText(mockCliente, mockFacturas, { detailed: true });
            assert.match(textoPosicionalDetailed, /\*ESTADO DE CUENTA - MAS ACCESORIOS\*/);
            assert.match(textoPosicionalDetailed, /Fac #FE-101/);
            assert.match(textoPosicionalDetailed, /\$ 450\.000/);
        });

        it('debe calcular días despachados dinámicamente si la factura no trae diasDespachado precalculado en modo detailed', () => {
            const hoy = new Date();
            const pad = n => n.toString().padStart(2, '0');
            const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 10);
            const hace10Dias = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
            const facturaSinDias = [
                { id: 'f99', numero: 'FE-99', fecha: hace10Dias, vencimiento: hace10Dias, total: 100000, saldo: 100000 }
            ];

            const texto = buildEstadoCuentaWhatsAppText({
                cliente: mockCliente,
                facturas: facturaSinDias,
                detailed: true
            });

            assert.match(texto, /10 días despachado/);
        });

        it('debe manejar entradas nulas o vacías de manera defensiva sin colapsar', () => {
            const textoNull = buildEstadoCuentaWhatsAppText(null, null);
            assert.ok(typeof textoNull === 'string');
            assert.match(textoNull, /sin saldos pendientes/i);
        });
    });

    // =========================================================================
    // 2. NORMALIZACIÓN DE TELÉFONOS DE WHATSAPP
    // =========================================================================
    describe('normalizeWhatsAppPhone', () => {
        it('debe anteponer el prefijo 57 a un celular colombiano estándar de 10 dígitos', () => {
            assert.strictEqual(normalizeWhatsAppPhone('3158512091'), '573158512091');
            assert.strictEqual(normalizeWhatsAppPhone('3001234567'), '573001234567');
        });

        it('debe conservar el número limpio si ya contiene el prefijo 57 de 12 dígitos', () => {
            assert.strictEqual(normalizeWhatsAppPhone('573158512091'), '573158512091');
        });

        it('debe eliminar caracteres no numéricos como signos +, espacios, paréntesis y guiones', () => {
            assert.strictEqual(normalizeWhatsAppPhone('+57 (315) 851-2091'), '573158512091');
            assert.strictEqual(normalizeWhatsAppPhone('+57 300 123 4567'), '573001234567');
            assert.strictEqual(normalizeWhatsAppPhone('315-851-2091'), '573158512091');
            assert.strictEqual(normalizeWhatsAppPhone('  315 851 2091  '), '573158512091');
        });

        it('debe respetar números internacionales con más de 10 dígitos sin anteponer 57', () => {
            // Ejemplo: USA +1 415 555 2671 -> 11 dígitos
            assert.strictEqual(normalizeWhatsAppPhone('+1 415 555 2671'), '14155552671');
            // Ejemplo: España +34 612 345 678 -> 11 dígitos
            assert.strictEqual(normalizeWhatsAppPhone('+34 612 345 678'), '34612345678');
        });

        it('debe retornar cadena vacía para teléfonos inválidos, nulos, undefined o menores a 7 dígitos', () => {
            assert.strictEqual(normalizeWhatsAppPhone(null), '');
            assert.strictEqual(normalizeWhatsAppPhone(undefined), '');
            assert.strictEqual(normalizeWhatsAppPhone(''), '');
            assert.strictEqual(normalizeWhatsAppPhone('   '), '');
            assert.strictEqual(normalizeWhatsAppPhone('abc'), '');
            assert.strictEqual(normalizeWhatsAppPhone('12345'), ''); // Menos de 7 dígitos
        });
    });

    // =========================================================================
    // 3. RESOLUCIÓN DE CLIENTE ID PARA COBRO POR FACTURA INDIVIDUAL
    // =========================================================================
    describe('resolveClienteIdFromFactura', () => {
        it('debe resolver f.clienteId cuando existe directamente', () => {
            const f = { id: 1, clienteId: 'cli-001', contacto_id: 'cli-002' };
            assert.strictEqual(resolveClienteIdFromFactura(f), 'cli-001');
        });

        it('debe resolver f.contacto_id si clienteId no está presente', () => {
            const f = { id: 2, contacto_id: 'cli-002' };
            assert.strictEqual(resolveClienteIdFromFactura(f), 'cli-002');
        });

        it('debe resolver f.cliente.id cuando cliente viene como objeto anidado', () => {
            const f = { id: 3, cliente: { id: 'cli-003', nombre: 'Juan Perez' } };
            assert.strictEqual(resolveClienteIdFromFactura(f), 'cli-003');
        });

        it('debe resolver f.cliente_id (snake_case alternativo de base de datos)', () => {
            const f = { id: 4, cliente_id: 'cli-004' };
            assert.strictEqual(resolveClienteIdFromFactura(f), 'cli-004');
        });

        it('debe respetar el orden de prioridad estricto (clienteId > contacto_id > cliente.id > cliente_id)', () => {
            const f = {
                id: 5,
                clienteId: 'prioridad-1',
                contacto_id: 'prioridad-2',
                cliente: { id: 'prioridad-3' },
                cliente_id: 'prioridad-4'
            };
            assert.strictEqual(resolveClienteIdFromFactura(f), 'prioridad-1');

            const f2 = {
                id: 6,
                contacto_id: 'prioridad-2',
                cliente: { id: 'prioridad-3' },
                cliente_id: 'prioridad-4'
            };
            assert.strictEqual(resolveClienteIdFromFactura(f2), 'prioridad-2');

            const f3 = {
                id: 7,
                cliente: { id: 'prioridad-3' },
                cliente_id: 'prioridad-4'
            };
            assert.strictEqual(resolveClienteIdFromFactura(f3), 'prioridad-3');
        });

        it('debe normalizar números de id a string consistente', () => {
            const f = { id: 8, clienteId: 1045 };
            assert.strictEqual(resolveClienteIdFromFactura(f), '1045');
        });

        it('debe retornar null si la factura es null, undefined o no contiene referencia de cliente', () => {
            assert.strictEqual(resolveClienteIdFromFactura(null), null);
            assert.strictEqual(resolveClienteIdFromFactura(undefined), null);
            assert.strictEqual(resolveClienteIdFromFactura({}), null);
            assert.strictEqual(resolveClienteIdFromFactura({ id: 9, numero: 'FE-9' }), null);
        });
    });

    // =========================================================================
    // 4. GENERADOR DE URL DE WHATSAPP
    // =========================================================================
    describe('buildWhatsAppUrl', () => {
        it('debe construir una URL wa.me bien formada con teléfono y texto codificado', () => {
            const url = buildWhatsAppUrl('3158512091', 'Hola mundo & feliz día');
            assert.ok(url.startsWith('https://wa.me/573158512091?text='));
            assert.ok(url.includes(encodeURIComponent('Hola mundo & feliz día')));
        });

        it('debe codificar correctamente caracteres especiales, tildes, saltos de línea y emojis', () => {
            const mensaje = "*ESTADO DE CUENTA*\n• Saldo: $ 150.000\n¡Confirmar pago! 💳";
            const url = buildWhatsAppUrl('573158512091', mensaje);
            assert.ok(url.includes(encodeURIComponent(mensaje)));
        });

        it('debe retornar null si el teléfono es inválido o no normalizable', () => {
            assert.strictEqual(buildWhatsAppUrl('', 'Texto'), null);
            assert.strictEqual(buildWhatsAppUrl('123', 'Texto'), null);
            assert.strictEqual(buildWhatsAppUrl(null, 'Texto'), null);
        });
    });

    // =========================================================================
    // 5. CONSTANTES OFICIALES DE COBRANZA
    // =========================================================================
    describe('OFICIAL_CUENTAS_BANCARIAS', () => {
        it('debe exponer las cuentas oficiales inmutables de MAS Accesorios', () => {
            assert.strictEqual(OFICIAL_CUENTAS_BANCARIAS.bancolombia.numero, '54700050214');
            assert.strictEqual(OFICIAL_CUENTAS_BANCARIAS.bancolombia.titular, 'Diego M Izquierdo');
            assert.strictEqual(OFICIAL_CUENTAS_BANCARIAS.billeteras.numero, '3158512091');
            assert.strictEqual(OFICIAL_CUENTAS_BANCARIAS.billeteras.titular, 'Diego M Izquierdo');
            assert.strictEqual(OFICIAL_CUENTAS_BANCARIAS.llaveBreB.llave, '@izquierdo638');
            assert.strictEqual(OFICIAL_CUENTAS_BANCARIAS.telefonoConfirmacion, '3158512091');
        });
    });
});
