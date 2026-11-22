import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { extractDocumentNumber } from '../js/shared/formatters.js';

describe('GlobalSearch - Detección Inteligente de Documentos vs Productos', () => {

    describe('extractDocumentNumber (Reconocimiento estricto de números de factura/cotización)', () => {
        it('debe reconocer números puros como documento', () => {
            assert.strictEqual(extractDocumentNumber('2167'), 2167);
            assert.strictEqual(extractDocumentNumber('6882'), 6882);
            assert.strictEqual(extractDocumentNumber(' 1042 '), 1042);
        });

        it('debe reconocer números con prefijo # o espacios', () => {
            assert.strictEqual(extractDocumentNumber('#2167'), 2167);
            assert.strictEqual(extractDocumentNumber('# 6882'), 6882);
        });

        it('debe reconocer prefijos formales como FE-, FAC-, COT-', () => {
            assert.strictEqual(extractDocumentNumber('FE-2167'), 2167);
            assert.strictEqual(extractDocumentNumber('FAC-6882'), 6882);
            assert.strictEqual(extractDocumentNumber('COT-45'), 45);
            assert.strictEqual(extractDocumentNumber('fe_100'), 100);
        });

        it('debe reconocer búsquedas expresadas con palabras clave (Factura, Fac, Cotización)', () => {
            assert.strictEqual(extractDocumentNumber('Factura #2167'), 2167);
            assert.strictEqual(extractDocumentNumber('factura 6882'), 6882);
            assert.strictEqual(extractDocumentNumber('fac 2167'), 2167);
            assert.strictEqual(extractDocumentNumber('fac. 2167'), 2167);
            assert.strictEqual(extractDocumentNumber('Cotización #12'), 12);
            assert.strictEqual(extractDocumentNumber('cotizacion 45'), 45);
            assert.strictEqual(extractDocumentNumber('cot. 99'), 99);
        });

        it('NUNCA debe interpretar nombres de productos o referencias con números como documento', () => {
            // El caso reportado por el usuario:
            assert.strictEqual(extractDocumentNumber('2 en 1 Wireless Transmiso y Receptor T67'), null);
            assert.strictEqual(extractDocumentNumber('2.1 en wireless transmisión transmisor y receptor T67'), null);
            
            // Otros casos reales de catálogo:
            assert.strictEqual(extractDocumentNumber('Cable USB 3 en 1'), null);
            assert.strictEqual(extractDocumentNumber('Adaptador 4 en 1 tipo C'), null);
            assert.strictEqual(extractDocumentNumber('iPhone 11 64GB'), null);
            assert.strictEqual(extractDocumentNumber('Cargador 20W rápido'), null);
            assert.strictEqual(extractDocumentNumber('T67'), null);
            assert.strictEqual(extractDocumentNumber('Memoria Micro SD 128GB'), null);
            assert.strictEqual(extractDocumentNumber('Alberto Arroyo'), null);
            assert.strictEqual(extractDocumentNumber(''), null);
            assert.strictEqual(extractDocumentNumber(null), null);
            assert.strictEqual(extractDocumentNumber(undefined), null);
        });
    });
});
