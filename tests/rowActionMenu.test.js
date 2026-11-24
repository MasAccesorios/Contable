// tests/rowActionMenu.test.js
// Suite de pruebas unitarias para Menús Contextuales Flotantes y Acciones Inteligentes

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { calculateMenuPosition } from '../js/shared/rowActionMenu.js';
import { 
    buildFacturaWhatsAppText, 
    buildCotizacionWhatsAppText, 
    formatMoneyCOP,
    normalizeWhatsAppPhone,
    buildWhatsAppUrl,
    OFICIAL_CUENTAS_BANCARIAS 
} from '../js/shared/cobranzaUtils.js';

describe('Menús de Acciones Inteligentes (3 Puntos) - Facturas & Cotizaciones', () => {

    describe('1. Motor Matemático de Posicionamiento Flotante (Anti-Colisiones)', () => {
        test('debe alinear el borde derecho del menú con el borde derecho del botón', () => {
            const rect = { left: 800, right: 830, top: 200, bottom: 230, width: 30, height: 30 };
            const pos = calculateMenuPosition({
                rect,
                menuWidth: 230,
                menuHeight: 250,
                windowWidth: 1200,
                windowHeight: 800,
                scrollX: 0,
                scrollY: 0
            });

            // left = rect.right - menuWidth = 830 - 230 = 600
            assert.strictEqual(pos.left, 600);
            assert.strictEqual(pos.top, 234); // rect.bottom + 4
            assert.strictEqual(pos.openUpwards, false);
        });

        test('debe abrir hacia arriba cuando el botón está cerca del borde inferior del viewport', () => {
            const rect = { left: 800, right: 830, top: 720, bottom: 750, width: 30, height: 30 };
            const pos = calculateMenuPosition({
                rect,
                menuWidth: 230,
                menuHeight: 250,
                windowWidth: 1200,
                windowHeight: 800, // solo quedan 50px abajo
                scrollX: 0,
                scrollY: 0
            });

            // Como spaceBelow (50px) < menuHeight (250px) y spaceAbove (720px) > 50px, abre hacia arriba
            assert.strictEqual(pos.openUpwards, true);
            // top = rect.top - menuHeight - 4 = 720 - 250 - 4 = 466
            assert.strictEqual(pos.top, 466);
        });

        test('debe clampear a los límites de pantalla cuando el botón está muy a la derecha o muy a la izquierda', () => {
            // Caso extremo derecha: botón en right 1195 en ventana de 1200px
            const rectRight = { left: 1170, right: 1195, top: 100, bottom: 130, width: 25, height: 30 };
            const posRight = calculateMenuPosition({
                rect: rectRight,
                menuWidth: 230,
                windowWidth: 1200,
                windowHeight: 800
            });
            // 1195 - 230 = 965. 965 + 230 = 1195 <= 1200 - 10 (1190), entonces debe limitarse a 1190 - 230 no, sino windowWidth - menuWidth - 10 = 960
            assert.strictEqual(posRight.left, 960);

            // Caso extremo izquierda: botón en right 50
            const rectLeft = { left: 10, right: 40, top: 100, bottom: 130, width: 30, height: 30 };
            const posLeft = calculateMenuPosition({
                rect: rectLeft,
                menuWidth: 230,
                windowWidth: 1200,
                windowHeight: 800
            });
            assert.strictEqual(posLeft.left, 10); // clamp a mínimo 10px
        });

        test('debe tomar en cuenta el desplazamiento de scroll (scrollX y scrollY)', () => {
            const rect = { left: 500, right: 530, top: 300, bottom: 330, width: 30, height: 30 };
            const pos = calculateMenuPosition({
                rect,
                menuWidth: 200,
                scrollX: 50,
                scrollY: 100,
                windowWidth: 1200,
                windowHeight: 800
            });
            assert.strictEqual(pos.left, 530 - 200 + 50); // 380
            assert.strictEqual(pos.top, 330 + 100 + 4);    // 434
        });
    });

    describe('2. Inteligencia de Mensajería WhatsApp para Facturas de Venta', () => {
        test('debe generar mensaje de cobro detallado con medios de pago cuando la factura tiene saldo pendiente', () => {
            const factura = {
                id: 6895,
                numero: 6895,
                total: 49000,
                totalPagado: 0,
                saldoPendiente: 49000,
                vencimiento: '2026-12-16'
            };
            const cliente = {
                id: 10,
                nombre: 'Alberto Arroyo',
                telefono: '3151234567'
            };

            const msg = buildFacturaWhatsAppText(factura, cliente);

            assert.match(msg, /Alberto Arroyo/);
            assert.match(msg, /Factura de Venta No\. 6895/);
            assert.match(msg, /\$ 49\.000/);
            assert.match(msg, /2026-12-16/);
            assert.match(msg, /Bancolombia/);
            assert.match(msg, new RegExp(OFICIAL_CUENTAS_BANCARIAS.bancolombia.numero));
            assert.match(msg, /Nequi \/ DaviPlata/);
            assert.match(msg, new RegExp(OFICIAL_CUENTAS_BANCARIAS.billeteras.numero));
            assert.match(msg, /Llave Bre-B/);
        });

        test('debe generar mensaje de Paz y Salvo cuando la factura está totalmente cobrada (saldo 0)', () => {
            const facturaCobrada = {
                id: 6892,
                numero: 6892,
                total: 125000,
                totalPagado: 125000,
                saldoPendiente: 0
            };
            const cliente = {
                id: 20,
                nombre: 'HELVER IZQUIERDO',
                telefono: '3007654321'
            };

            const msg = buildFacturaWhatsAppText(facturaCobrada, cliente);

            assert.match(msg, /HELVER IZQUIERDO/);
            assert.match(msg, /Factura de Venta No\. 6892/);
            assert.match(msg, /totalmente saldada \(Paz y Salvo\)/);
            // No debe incluir solicitud de abono ni medios de pago porque ya pagó
            assert.doesNotMatch(msg, /Saldo pendiente/);
            assert.doesNotMatch(msg, /Medios de Pago Autorizados/);
        });

        test('debe usar fallback cordial cuando el nombre del cliente no está definido', () => {
            const factura = { id: 999, total: 50000, saldoPendiente: 50000 };
            const msg = buildFacturaWhatsAppText(factura, null);
            assert.match(msg, /Estimado\(a\) cliente/);
        });
    });

    describe('3. Inteligencia de Mensajería WhatsApp para Cotizaciones', () => {
        test('debe estructurar la propuesta comercial con número, monto total y vigencia', () => {
            const cotizacion = {
                id: 1042,
                numero: 1042,
                total: 350000,
                vencimiento: '2026-12-05'
            };
            const cliente = {
                id: 15,
                nombre: 'Tecnología SAS',
                telefono: '3109876543'
            };

            const msg = buildCotizacionWhatsAppText(cotizacion, cliente);

            assert.match(msg, /Tecnología SAS/);
            assert.match(msg, /Cotización No\. 1042/);
            assert.match(msg, /\$ 350\.000/);
            assert.match(msg, /válida hasta 2026-12-05/);
            assert.match(msg, /MAS Accesorios/);
        });

        test('debe construir URL segura de wa.me con número normalizado y texto codificado', () => {
            const phone = '315 851-2091';
            const cleanPhone = normalizeWhatsAppPhone(phone);
            assert.strictEqual(cleanPhone, '573158512091');

            const text = 'Hola Mundo!';
            const url = buildWhatsAppUrl(phone, text);
            assert.strictEqual(url, 'https://wa.me/573158512091?text=Hola%20Mundo!');
        });
    });
});
