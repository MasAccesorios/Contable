import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { CategoriasData } from '../js/modules/inventario/categorias/categorias.data.js';
import { CategoriasTemplates } from '../js/modules/inventario/categorias/categorias.templates.js';

describe('Módulo Categorías Contables Moderno - TDD Test Suite', () => {

    // ─────────────────────────────────────────────────────────────────────────
    // Mock Datasets
    // ─────────────────────────────────────────────────────────────────────────

    const categoriasMock = [
        { id: 1, nombre: 'Ingresos Operacionales', tipo_flujo: 'in', estado: 'activa', created_at: '2026-08-07T17:43:02Z' },
        { id: 2, nombre: 'Ingresos No Operacionales', tipo_flujo: 'in', estado: 'activa', created_at: '2026-08-07T17:43:02Z' },
        { id: 3, nombre: 'Cuentas por Cobrar (Recaudo)', tipo_flujo: 'in', estado: 'activa', created_at: '2026-08-07T17:43:02Z' },
        { id: 4, nombre: 'Proveedores / Costo de Ventas', tipo_flujo: 'out', estado: 'activa', created_at: '2026-08-07T17:43:02Z' },
        { id: 5, nombre: 'Gastos de Personal (Nómina)', tipo_flujo: 'out', estado: 'activa', created_at: '2026-08-07T17:43:02Z' },
        { id: 6, nombre: 'Arrendamientos', tipo_flujo: 'out', estado: 'activa', created_at: '2026-08-07T17:43:02Z' },
        { id: 7, nombre: 'Servicios Públicos y Tecnología', tipo_flujo: 'out', estado: 'activa', created_at: '2026-08-07T17:43:02Z' },
        { id: 8, nombre: 'Categoría Archivada Antigua', tipo_flujo: 'out', estado: 'inactiva', created_at: '2026-08-07T17:43:02Z' }
    ];

    const conteoMovimientosMock = {
        'Cuentas por Cobrar (Recaudo)': 102,
        'Gastos de Personal (Nómina)': 100,
        'Proveedores / Costo de Ventas': 10,
        'Servicios Públicos y Tecnología': 13,
        'Ingresos Operacionales': 5,
        'Ingresos No Operacionales': 32
    };

    // ─────────────────────────────────────────────────────────────────────────
    // 1. CategoriasData.calcularKpis
    // ─────────────────────────────────────────────────────────────────────────
    describe('1. CategoriasData.calcularKpis', () => {
        it('debe calcular con precisión matemática los KPIs y contadores de pestañas', () => {
            const kpis = CategoriasData.calcularKpis(categoriasMock, conteoMovimientosMock);

            assert.equal(kpis.total, 8, 'Total de categorías debe ser 8');
            assert.equal(kpis.activas, 7, 'Categorías activas deben ser 7');
            assert.equal(kpis.inactivas, 1, 'Categorías inactivas deben ser 1');
            assert.equal(kpis.egresos, 5, 'Categorías de egreso (out) deben ser 5');
            assert.equal(kpis.ingresos, 3, 'Categorías de ingreso (in) deben ser 3');
            assert.equal(kpis.totalMovimientos, 262, 'Total de movimientos asociados debe ser 262');
        });

        it('debe manejar listas vacías o valores corruptos sin lanzar NaN ni colapsar', () => {
            const kpisNull = CategoriasData.calcularKpis(null, null);
            assert.equal(kpisNull.total, 0);
            assert.equal(kpisNull.activas, 0);
            assert.equal(kpisNull.inactivas, 0);
            assert.equal(kpisNull.egresos, 0);
            assert.equal(kpisNull.ingresos, 0);
            assert.equal(kpisNull.totalMovimientos, 0);

            const kpisEmpty = CategoriasData.calcularKpis([], {});
            assert.equal(kpisEmpty.total, 0);
            assert.equal(kpisEmpty.totalMovimientos, 0);
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 2. CategoriasData.filtrarYBuscar
    // ─────────────────────────────────────────────────────────────────────────
    describe('2. CategoriasData.filtrarYBuscar', () => {
        it('debe retornar todas las categorías en tab "todas"', () => {
            const resultado = CategoriasData.filtrarYBuscar(categoriasMock, 'todas', '');
            assert.equal(resultado.length, 8);
        });

        it('debe filtrar exclusivamente categorías de egreso en tab "egresos"', () => {
            const resultado = CategoriasData.filtrarYBuscar(categoriasMock, 'egresos', '');
            assert.equal(resultado.length, 5);
            assert.ok(resultado.every(c => c.tipo_flujo === 'out'));
        });

        it('debe filtrar exclusivamente categorías de ingreso en tab "ingresos"', () => {
            const resultado = CategoriasData.filtrarYBuscar(categoriasMock, 'ingresos', '');
            assert.equal(resultado.length, 3);
            assert.ok(resultado.every(c => c.tipo_flujo === 'in'));
        });

        it('debe filtrar exclusivamente categorías inactivas en tab "inactivas"', () => {
            const resultado = CategoriasData.filtrarYBuscar(categoriasMock, 'inactivas', '');
            assert.equal(resultado.length, 1);
            assert.equal(resultado[0].nombre, 'Categoría Archivada Antigua');
        });

        it('debe buscar en tiempo real insensible a mayúsculas y acentos', () => {
            // "nomina" sin tilde debe coincidir con "Nómina"
            const resultado = CategoriasData.filtrarYBuscar(categoriasMock, 'todas', 'nomina');
            assert.equal(resultado.length, 1);
            assert.equal(resultado[0].nombre, 'Gastos de Personal (Nómina)');

            // "servicios"
            const res2 = CategoriasData.filtrarYBuscar(categoriasMock, 'todas', 'SERVICIOS');
            assert.equal(res2.length, 1);
            assert.equal(res2[0].nombre, 'Servicios Públicos y Tecnología');
        });

        it('debe combinar tab y búsqueda simultáneamente', () => {
            // Buscando "recaudo" en tab "ingresos" -> debe aparecer
            const res1 = CategoriasData.filtrarYBuscar(categoriasMock, 'ingresos', 'recaudo');
            assert.equal(res1.length, 1);
            assert.equal(res1[0].nombre, 'Cuentas por Cobrar (Recaudo)');

            // Buscando "recaudo" en tab "egresos" -> no debe aparecer
            const res2 = CategoriasData.filtrarYBuscar(categoriasMock, 'egresos', 'recaudo');
            assert.equal(res2.length, 0);
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 3. CategoriasData.validarCategoria
    // ─────────────────────────────────────────────────────────────────────────
    describe('3. CategoriasData.validarCategoria', () => {
        it('debe validar exitosamente una categoría con datos correctos', () => {
            const valid = CategoriasData.validarCategoria({
                nombre: 'Publicidad y Marketing Digital',
                tipo_flujo: 'out',
                estado: 'activa'
            }, categoriasMock);

            assert.equal(valid.valido, true);
            assert.equal(valid.categoriaLimpia.nombre, 'Publicidad y Marketing Digital');
            assert.equal(valid.categoriaLimpia.tipo_flujo, 'out');
            assert.equal(valid.categoriaLimpia.estado, 'activa');
        });

        it('debe rechazar nombres vacíos o menores a 2 caracteres', () => {
            const resVacio = CategoriasData.validarCategoria({ nombre: '   ', tipo_flujo: 'out' }, categoriasMock);
            assert.equal(resVacio.valido, false);
            assert.ok(resVacio.error.includes('nombre'));

            const resCorto = CategoriasData.validarCategoria({ nombre: 'A', tipo_flujo: 'out' }, categoriasMock);
            assert.equal(resCorto.valido, false);
        });

        it('debe rechazar nombres duplicados de forma insensible a mayúsculas', () => {
            const resDup = CategoriasData.validarCategoria({
                nombre: 'gastos de personal (nómina)',
                tipo_flujo: 'out'
            }, categoriasMock);

            assert.equal(resDup.valido, false);
            assert.ok(resDup.error.toLowerCase().includes('ya existe'));
        });

        it('debe permitir conservar el mismo nombre si se está editando la misma categoría', () => {
            const resMismo = CategoriasData.validarCategoria({
                nombre: 'Gastos de Personal (Nómina)',
                tipo_flujo: 'out',
                estado: 'inactiva'
            }, categoriasMock, 5); // id 5 es Nómina

            assert.equal(resMismo.valido, true);
        });

        it('debe asignar valores por defecto seguros a tipo_flujo y estado si faltan', () => {
            const resDefault = CategoriasData.validarCategoria({
                nombre: 'Insumos de Cafetería'
            }, categoriasMock);

            assert.equal(resDefault.valido, true);
            assert.equal(resDefault.categoriaLimpia.tipo_flujo, 'out');
            assert.equal(resDefault.categoriaLimpia.estado, 'activa');
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 4. CategoriasData.mapearParaExcel (Blindaje CWE-1236)
    // ─────────────────────────────────────────────────────────────────────────
    describe('4. CategoriasData.mapearParaExcel & Blindaje CWE-1236', () => {
        it('debe mapear correctamente las filas para exportar con conteo de movimientos', () => {
            const filas = CategoriasData.mapearParaExcel(categoriasMock, conteoMovimientosMock);
            assert.equal(filas.length, 8);

            const filaNomina = filas.find(f => f.Nombre.includes('Nómina'));
            assert.ok(filaNomina);
            assert.equal(filaNomina.Flujo, 'Egreso / Gasto');
            assert.equal(filaNomina.Estado, 'Activa');
            assert.equal(filaNomina['Movimientos Asociados'], 100);
        });

        it('debe neutralizar inyección de fórmulas CSV (CWE-1236)', () => {
            const itemMalicioso = [{
                id: 99,
                nombre: '=cmd|"/C calc"!A0',
                tipo_flujo: 'out',
                estado: 'activa'
            }];

            const filas = CategoriasData.mapearParaExcel(itemMalicioso, {});
            assert.ok(filas[0].Nombre.startsWith("'="), 'Debe prefijar con comilla simple');
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 5. CategoriasTemplates Formatters
    // ─────────────────────────────────────────────────────────────────────────
    describe('5. CategoriasTemplates Formatters', () => {
        it('getFlujoBadge debe generar badge semántico según el flujo in/out', () => {
            const badgeIn = CategoriasTemplates.getFlujoBadge('in');
            assert.ok(badgeIn.includes('Ingreso'));
            assert.ok(badgeIn.includes('bi-arrow-down-left') || badgeIn.includes('text-success'));

            const badgeOut = CategoriasTemplates.getFlujoBadge('out');
            assert.ok(badgeOut.includes('Egreso') || badgeOut.includes('Gasto'));
            assert.ok(badgeOut.includes('bi-arrow-up-right') || badgeOut.includes('text-danger'));
        });

        it('getEstadoBadge debe generar badge Activa o Inactiva', () => {
            const badgeActiva = CategoriasTemplates.getEstadoBadge('activa');
            assert.ok(badgeActiva.includes('Activa'));

            const badgeInactiva = CategoriasTemplates.getEstadoBadge('inactiva');
            assert.ok(badgeInactiva.includes('Inactiva'));
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 6. CategoriasTemplates Componentes UI
    // ─────────────────────────────────────────────────────────────────────────
    describe('6. CategoriasTemplates Componentes UI', () => {
        it('renderLayout debe generar Top Bar con badge, 4 payment-kpi-cards, tabs y barra de búsqueda', () => {
            const kpis = CategoriasData.calcularKpis(categoriasMock, conteoMovimientosMock);
            const html = CategoriasTemplates.renderLayout(kpis, 'todas', '');

            assert.ok(html.includes('Categorías Contables'), 'Debe incluir título principal');
            assert.ok(html.includes('payment-kpi-card'), 'Debe contener clases payment-kpi-card');
            assert.ok(html.includes('btn-nueva-categoria'), 'Debe contener botón de nueva categoría');
            assert.ok(html.includes('btn-actualizar-categorias'), 'Debe contener botón de actualizar');
            assert.ok(html.includes('btn-exportar-categorias'), 'Debe contener botón de exportar');
            assert.ok(html.includes('search-categorias'), 'Debe contener input de búsqueda');
            assert.ok(html.includes('payment-tabs-bar'), 'Debe contener barra de tabs');
        });

        it('renderTabla debe renderizar filas con badges semánticos, conteo y menú de 3 puntos con data-id', () => {
            const html = CategoriasTemplates.renderTabla(categoriasMock, conteoMovimientosMock);

            assert.ok(html.includes('Gastos de Personal (Nómina)'));
            assert.ok(html.includes('data-id="5"'));
            assert.ok(html.includes('bi-three-dots-vertical'));
            assert.ok(html.includes('100 movimientos') || html.includes('100'));
        });

        it('renderTabla con lista vacía debe renderizar estado vacío informativo', () => {
            const htmlVacio = CategoriasTemplates.renderTabla([], {});
            assert.ok(htmlVacio.includes('No se encontraron categorías'));
        });

        it('renderModalForm debe renderizar modal para creación y edición', () => {
            const htmlCrear = CategoriasTemplates.renderModalForm(null);
            assert.ok(htmlCrear.includes('Nueva Categoría'));
            assert.ok(htmlCrear.includes('input-cat-nombre'));
            assert.ok(htmlCrear.includes('select-cat-flujo'));
            assert.ok(htmlCrear.includes('select-cat-estado'));

            const htmlEditar = CategoriasTemplates.renderModalForm({ id: 5, nombre: 'Nómina', tipo_flujo: 'out', estado: 'activa' });
            assert.ok(htmlEditar.includes('Editar Categoría'));
            assert.ok(htmlEditar.includes('value="Nómina"'));
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 7. CategoriasTemplates & Blindaje XSS
    // ─────────────────────────────────────────────────────────────────────────
    describe('7. Blindaje de Seguridad XSS', () => {
        it('debe sanitizar XSS en nombres de categorías al renderizar', () => {
            const categoriaXSS = [{
                id: 66,
                nombre: '<script>alert(1)</script>Categoría Hack',
                tipo_flujo: 'out',
                estado: 'activa'
            }];

            const html = CategoriasTemplates.renderTabla(categoriaXSS, {});
            assert.ok(!html.includes('<script>alert(1)</script>'));
            assert.ok(html.includes('&lt;script&gt;') || !html.includes('<script>'));
        });
    });
});
