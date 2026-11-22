import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { extractDocumentNumber, highlightMatches, toSpanishSearchVariants } from '../js/shared/formatters.js';

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

    describe('highlightMatches (Seguridad XSS y Resaltado Inteligente)', () => {
        it('debe devolver texto escapado si query es nulo, indefinido o vacío', () => {
            assert.strictEqual(highlightMatches('<b>Hola</b>', ''), '&lt;b&gt;Hola&lt;/b&gt;');
            assert.strictEqual(highlightMatches('Prueba', null), 'Prueba');
            assert.strictEqual(highlightMatches('Prueba', undefined), 'Prueba');
            assert.strictEqual(highlightMatches('', 'bateria'), '');
            assert.strictEqual(highlightMatches(null, 'bateria'), '');
        });

        it('debe resaltar coincidencia simple con <mark class="gs-highlight">', () => {
            const res = highlightMatches('Batería Litio', 'bateria');
            assert.ok(res.includes('<mark class="gs-highlight">Batería</mark>'));
        });

        it('debe ser tolerante a tildes y diacríticos en ambas direcciones', () => {
            // Usuario busca sin tilde, texto tiene tilde
            const res1 = highlightMatches('Cotización #45', 'cotizacion');
            assert.ok(res1.includes('<mark class="gs-highlight">Cotización</mark>'));

            // Usuario busca con tilde, texto no tiene tilde
            const res2 = highlightMatches('Lampara LED', 'lámpara');
            assert.ok(res2.includes('<mark class="gs-highlight">Lampara</mark>'));

            // Variante con diéresis o ñ
            const res3 = highlightMatches('Pingüino Mini', 'pinguino');
            assert.ok(res3.includes('<mark class="gs-highlight">Pingüino</mark>'));
        });

        it('debe resaltar múltiples palabras clave independientes', () => {
            const res = highlightMatches('Cable 3 en 1 Carga Rápida USB-C', 'cable rapida');
            assert.ok(res.includes('<mark class="gs-highlight">Cable</mark>'));
            assert.ok(res.includes('<mark class="gs-highlight">Rápida</mark>'));
        });

        it('NUNCA debe permitir ejecución de XSS en text o query', () => {
            const maliciousText = '<script>alert("xss")</script>';
            const res = highlightMatches(maliciousText, 'alert');
            assert.ok(!res.includes('<script>'));
            assert.ok(res.includes('&lt;script&gt;'));
            assert.ok(res.includes('<mark class="gs-highlight">alert</mark>'));

            const maliciousQuery = '<img src=x onerror=alert(1)>';
            const resQuery = highlightMatches('Prueba con imagen', maliciousQuery);
            assert.ok(!resQuery.includes('<img'));
        });

        it('debe tolerar caracteres especiales de regex en la query sin colapsar', () => {
            const text = 'Cable C++ (Tipo C) [100%]';
            assert.doesNotThrow(() => {
                const res = highlightMatches(text, 'C++ (Tipo');
                assert.ok(res.includes('<mark class="gs-highlight">'));
            });
        });
    });

    describe('toSpanishSearchVariants (Comodines SQL tolerantes a tildes)', () => {
        it('debe sanitizar caracteres que rompen sintaxis PostgREST .or()', () => {
            const { safeQuery } = toSpanishSearchVariants('cliente, (test) "fe"\\');
            assert.strictEqual(safeQuery, 'cliente test fe');
        });

        it('debe generar comodín SQL cuando la palabra contiene acentos', () => {
            const { wildcardQuery } = toSpanishSearchVariants('batería');
            assert.strictEqual(wildcardQuery, 'bater_a');
        });

        it('debe generar variante para palabras clave comunes sin acento', () => {
            const { wildcardQuery } = toSpanishSearchVariants('cotizacion');
            assert.strictEqual(wildcardQuery, 'cotizaci_n');
        });

        it('debe manejar términos vacíos o nulos sin lanzar errores', () => {
            const res1 = toSpanishSearchVariants('');
            assert.strictEqual(res1.safeQuery, '');
            assert.strictEqual(res1.wildcardQuery, '');

            const res2 = toSpanishSearchVariants(null);
            assert.strictEqual(res2.safeQuery, '');
            assert.strictEqual(res2.wildcardQuery, '');
        });

        it('debe ser determinista e idempotente en múltiples llamadas consecutivas (sin fugas de lastIndex)', () => {
            for (let i = 0; i < 5; i++) {
                assert.strictEqual(toSpanishSearchVariants('batería').wildcardQuery, 'bater_a');
                assert.strictEqual(toSpanishSearchVariants('cotizacion').wildcardQuery, 'cotizaci_n');
                assert.strictEqual(toSpanishSearchVariants('camara').wildcardQuery, 'c_mara');
            }
        });
    });
});
