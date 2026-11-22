import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { parseCurrencyValue, getClientAvatar, sanitizeForCSV, extractDocumentNumber } from '../js/shared/formatters.js';

describe('Shared Formatters & Security Sanitizers - Test Suite', () => {

    describe('sanitizeForCSV (Prevención CWE-1236 Formula Injection)', () => {
        it('debe anteponer apóstrofe si el valor inicia con "="', () => {
            const input = '=SUM(A1:A10)';
            const output = sanitizeForCSV(input);
            assert.strictEqual(output, "'=SUM(A1:A10)");
        });

        it('debe anteponer apóstrofe si el valor inicia con "+"', () => {
            const input = '+12345';
            const output = sanitizeForCSV(input);
            assert.strictEqual(output, "'+12345");
        });

        it('debe anteponer apóstrofe si el valor inicia con "-"', () => {
            const input = '-cmd|\' /C calc\'!A0';
            const output = sanitizeForCSV(input);
            assert.strictEqual(output, "'-cmd|\' /C calc\'!A0");
        });

        it('debe anteponer apóstrofe si el valor inicia con "@"', () => {
            const input = '@IMPORTDATA("https://malicious.com")';
            const output = sanitizeForCSV(input);
            assert.strictEqual(output, "'@IMPORTDATA(\"\"https://malicious.com\"\")");
        });

        it('debe anteponer apóstrofe si el valor inicia con tabulación o salto de línea', () => {
            const tabInput = '\t=1+1';
            assert.strictEqual(sanitizeForCSV(tabInput), "'\t=1+1");

            const crInput = '\r=2+2';
            assert.strictEqual(sanitizeForCSV(crInput), "'\r=2+2");
        });

        it('debe escapar comillas dobles para compatibilidad RFC 4180', () => {
            const input = 'Texto con "comillas" internas';
            assert.strictEqual(sanitizeForCSV(input), 'Texto con ""comillas"" internas');
        });

        it('debe retornar cadena vacía ante valores nulos o indefinidos', () => {
            assert.strictEqual(sanitizeForCSV(null), '');
            assert.strictEqual(sanitizeForCSV(undefined), '');
        });

        it('no debe alterar cadenas de texto regulares', () => {
            const input = 'Factura de Venta #1024';
            assert.strictEqual(sanitizeForCSV(input), 'Factura de Venta #1024');
        });

        it('debe convertir números y booleanos a string seguro sin prefijo si no son fórmulas', () => {
            assert.strictEqual(sanitizeForCSV(15000), '15000');
            assert.strictEqual(sanitizeForCSV(true), 'true');
        });
    });

    describe('parseCurrencyValue', () => {
        it('debe convertir valores formateados colombianos correctamente a número', () => {
            assert.strictEqual(parseCurrencyValue('1.250.000'), 1250000);
            assert.strictEqual(parseCurrencyValue('1.250.000,50'), 1250000.50);
            assert.strictEqual(parseCurrencyValue('$ 45.000'), 45000);
            assert.strictEqual(parseCurrencyValue(50000), 50000);
        });

        it('debe retornar 0 para valores vacíos o nulos', () => {
            assert.strictEqual(parseCurrencyValue(''), 0);
            assert.strictEqual(parseCurrencyValue(null), 0);
            assert.strictEqual(parseCurrencyValue(undefined), 0);
        });
    });

    describe('getClientAvatar', () => {
        it('debe extraer iniciales mayúsculas de dos palabras', () => {
            const avatar = getClientAvatar('Carlos Mendoza');
            assert.strictEqual(avatar.initials, 'CM');
            assert.ok(avatar.bg);
            assert.ok(avatar.color);
        });

        it('debe retornar "?" y estilo gris para nombres vacíos o genéricos', () => {
            const avatarVacio = getClientAvatar('');
            assert.strictEqual(avatarVacio.initials, '?');

            const avatarGenerico = getClientAvatar('General / Sin tercero');
            assert.strictEqual(avatarGenerico.initials, '?');
        });
    });

    describe('extractDocumentNumber (Reconocimiento Inteligente de Facturas y Cotizaciones)', () => {
        it('debe reconocer números puros y con prefijo de factura/cotización', () => {
            assert.strictEqual(extractDocumentNumber('2167'), 2167);
            assert.strictEqual(extractDocumentNumber('#6882'), 6882);
            assert.strictEqual(extractDocumentNumber('FE-2167'), 2167);
            assert.strictEqual(extractDocumentNumber('FAC-6882'), 6882);
            assert.strictEqual(extractDocumentNumber('COT-45'), 45);
            assert.strictEqual(extractDocumentNumber('Factura #2167'), 2167);
            assert.strictEqual(extractDocumentNumber('cotizacion 12'), 12);
        });

        it('no debe interpretar nombres de productos o referencias compuestas con números como documentos', () => {
            assert.strictEqual(extractDocumentNumber('2 en 1 Wireless Transmiso y Receptor T67'), null);
            assert.strictEqual(extractDocumentNumber('Cable 3 en 1'), null);
            assert.strictEqual(extractDocumentNumber('iPhone 15 128GB'), null);
            assert.strictEqual(extractDocumentNumber('T67'), null);
            assert.strictEqual(extractDocumentNumber('Cargador 20W'), null);
        });
    });
});
