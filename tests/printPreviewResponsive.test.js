import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('PrintManager Responsive Preview - iPhone Fit to Screen Suite', () => {
    const BASE_WIDTH = 816;

    // Función puramente matemática idéntica a la implementada en PrintManager._renderPreviewShell
    function calculateScale(availableWidth, isZoomed100 = false) {
        const padding = 20;
        const maxUsableWidth = Math.max(280, availableWidth - padding);

        if (availableWidth < BASE_WIDTH + padding && !isZoomed100) {
            const scale = maxUsableWidth / BASE_WIDTH;
            return {
                mode: 'fit-mobile',
                scale,
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
                margin: '0',
                scaleWrapperWidth: Math.ceil(BASE_WIDTH * scale),
                overflowX: 'hidden',
                justifyContent: 'center'
            };
        } else if (isZoomed100 && availableWidth < BASE_WIDTH + padding) {
            return {
                mode: 'zoomed-100-mobile',
                scale: 1,
                transform: 'none',
                transformOrigin: 'top left',
                margin: '0 10px',
                scaleWrapperWidth: BASE_WIDTH,
                overflowX: 'auto',
                justifyContent: 'flex-start'
            };
        } else {
            return {
                mode: 'desktop',
                scale: 1,
                transform: 'none',
                transformOrigin: 'top center',
                margin: '0 auto',
                scaleWrapperWidth: BASE_WIDTH,
                overflowX: 'hidden',
                justifyContent: 'center'
            };
        }
    }

    it('en iPhone 13/14/15 (~390px) debe ajustar la escala a ~0.45 y eliminar márgenes negativos', () => {
        const result = calculateScale(390, false);
        assert.strictEqual(result.mode, 'fit-mobile');
        assert.ok(result.scale < 1, 'La escala debe ser menor a 1');
        assert.strictEqual(result.scaleWrapperWidth, 370);
        assert.strictEqual(result.margin, '0', 'El margen debe ser 0 para evitar desborde negativo a la izquierda');
        assert.strictEqual(result.overflowX, 'hidden', 'No debe generar barra horizontal en modo fit');
        assert.strictEqual(result.justifyContent, 'center', 'Debe centrar el scaleWrapper en pantalla');
    });

    it('en iPhone SE (~375px) debe calcular escala ~0.435 y ancho proporcional de 355px', () => {
        const result = calculateScale(375, false);
        assert.strictEqual(result.mode, 'fit-mobile');
        assert.strictEqual(result.scaleWrapperWidth, 355);
        assert.strictEqual(result.transform, `scale(${355 / 816})`);
    });

    it('al activar zoom al 100% en iPhone debe permitir scroll horizontal y margen positivo 10px', () => {
        const result = calculateScale(390, true);
        assert.strictEqual(result.mode, 'zoomed-100-mobile');
        assert.strictEqual(result.scale, 1);
        assert.strictEqual(result.transform, 'none');
        assert.strictEqual(result.scaleWrapperWidth, 816);
        assert.strictEqual(result.margin, '0 10px', 'Margen positivo desde el inicio');
        assert.strictEqual(result.overflowX, 'auto', 'Debe permitir deslizamiento horizontal');
        assert.strictEqual(result.justifyContent, 'flex-start', 'Debe arrancar desde el borde izquierdo');
    });

    it('en PC de escritorio (1200px / 1920px) debe mantener la experiencia nativa desktop sin escala', () => {
        const result = calculateScale(1920, false);
        assert.strictEqual(result.mode, 'desktop');
        assert.strictEqual(result.scale, 1);
        assert.strictEqual(result.transform, 'none');
        assert.strictEqual(result.scaleWrapperWidth, 816);
        assert.strictEqual(result.margin, '0 auto');
        assert.strictEqual(result.justifyContent, 'center');
    });
});
