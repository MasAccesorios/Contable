import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { ConfiguracionData } from '../js/modules/configuracion/configuracion.data.js';
import { ConfiguracionTemplates } from '../js/modules/configuracion/configuracion.templates.js';

describe('Módulo Configuración 360° - TDD Test Suite', () => {

    // ─────────────────────────────────────────────────────────────────────────
    // Mock Datasets
    // ─────────────────────────────────────────────────────────────────────────

    const categoriasMock = [
        { id: 1, nombre: 'Ingresos Operacionales', tipo_flujo: 'in', estado: 'activa' },
        { id: 2, nombre: 'Ingresos No Operacionales', tipo_flujo: 'in', estado: 'activa' },
        { id: 3, nombre: 'Cuentas por Cobrar (Recaudo)', tipo_flujo: 'in', estado: 'activa' },
        { id: 4, nombre: 'Proveedores / Costo de Ventas', tipo_flujo: 'out', estado: 'activa' },
        { id: 5, nombre: 'Gastos de Personal (Nómina)', tipo_flujo: 'out', estado: 'activa' },
        { id: 6, nombre: 'Arrendamientos', tipo_flujo: 'out', estado: 'activa' },
        { id: 7, nombre: 'Servicios Públicos y Tecnología', tipo_flujo: 'out', estado: 'activa' },
        { id: 8, nombre: 'Publicidad y Mercadeo', tipo_flujo: 'out', estado: 'activa' },
        { id: 9, nombre: 'Combustible y Transporte', tipo_flujo: 'out', estado: 'activa' },
        { id: 10, nombre: 'Papelería y Suministros', tipo_flujo: 'out', estado: 'activa' },
        { id: 11, nombre: 'Honorarios Profesionales', tipo_flujo: 'out', estado: 'activa' },
        { id: 12, nombre: 'Otros Gastos Antiguos', tipo_flujo: 'out', estado: 'inactiva' }
    ];

    const empresaMock = {
        razonSocial: 'MAS Accesorios',
        titular: 'Diego Izquierdo',
        nit: '79981638-4',
        telefono: '3158512091',
        email: 'contacto@masaccesorios.com',
        ciudad: 'Cali',
        direccion: 'Calle 10 # 5-20',
        regimen: 'Régimen Simplificado',
        terminosCotizacion: 'Vigencia de 15 días. Precios sujetos a cambio.',
        notasFactura: 'Esta factura de venta se asimila a una letra de cambio.'
    };

    // =========================================================================
    // 1. ConfiguracionData.validarNuevoConsecutivo
    // =========================================================================
    describe('1. ConfiguracionData.validarNuevoConsecutivo', () => {

        it('debe aceptar un consecutivo estrictamente superior al máximo en uso', () => {
            const res = ConfiguracionData.validarNuevoConsecutivo(6897, 6896);
            assert.strictEqual(res.valido, true);
            assert.strictEqual(res.numero, 6897);
            assert.strictEqual(res.error, null);
        });

        it('debe rechazar un consecutivo exactamente igual al máximo en uso', () => {
            const res = ConfiguracionData.validarNuevoConsecutivo(6896, 6896);
            assert.strictEqual(res.valido, false);
            assert.ok(res.error.includes('mayor'));
        });

        it('debe rechazar un consecutivo menor al máximo en uso', () => {
            const res = ConfiguracionData.validarNuevoConsecutivo(5000, 6896);
            assert.strictEqual(res.valido, false);
            assert.ok(res.error.includes('mayor'));
        });

        it('debe rechazar valores nulos, vacíos, NaN o menores que 1', () => {
            assert.strictEqual(ConfiguracionData.validarNuevoConsecutivo('', 6896).valido, false);
            assert.strictEqual(ConfiguracionData.validarNuevoConsecutivo(null, 6896).valido, false);
            assert.strictEqual(ConfiguracionData.validarNuevoConsecutivo(undefined, 6896).valido, false);
            assert.strictEqual(ConfiguracionData.validarNuevoConsecutivo('abc', 6896).valido, false);
            assert.strictEqual(ConfiguracionData.validarNuevoConsecutivo(-5, 6896).valido, false);
            assert.strictEqual(ConfiguracionData.validarNuevoConsecutivo(0, 0).valido, false);
        });

        it('debe parsear strings numéricos válidos con espacios en blanco', () => {
            const res = ConfiguracionData.validarNuevoConsecutivo(' 6900 ', 6896);
            assert.strictEqual(res.valido, true);
            assert.strictEqual(res.numero, 6900);
        });

        it('debe rechazar números decimales o de punto flotante (debe ser entero estricto)', () => {
            const res1 = ConfiguracionData.validarNuevoConsecutivo(6897.5, 6896);
            assert.strictEqual(res1.valido, false);

            const res2 = ConfiguracionData.validarNuevoConsecutivo('6897.25', 6896);
            assert.strictEqual(res2.valido, false);
        });

        it('debe rechazar tipos de datos inválidos (booleanos, objetos, arreglos)', () => {
            assert.strictEqual(ConfiguracionData.validarNuevoConsecutivo(true, 10).valido, false);
            assert.strictEqual(ConfiguracionData.validarNuevoConsecutivo(false, 10).valido, false);
            assert.strictEqual(ConfiguracionData.validarNuevoConsecutivo({}, 10).valido, false);
            assert.strictEqual(ConfiguracionData.validarNuevoConsecutivo([15], 10).valido, false);
        });

        it('debe aceptar consecutivo válido cuando el máximo actual en uso es 0 (sistema inicial)', () => {
            const res = ConfiguracionData.validarNuevoConsecutivo(1, 0);
            assert.strictEqual(res.valido, true);
            assert.strictEqual(res.numero, 1);
        });

        it('debe soportar valores grandes dentro de Number.MAX_SAFE_INTEGER', () => {
            const bigVal = 9007199254740990;
            const res = ConfiguracionData.validarNuevoConsecutivo(bigVal, 1000);
            assert.strictEqual(res.valido, true);
            assert.strictEqual(res.numero, bigVal);
        });

        it('debe rechazar strings con formato de fórmulas o inyección (e.g. =1+1 o @SUM)', () => {
            assert.strictEqual(ConfiguracionData.validarNuevoConsecutivo('=1+1', 10).valido, false);
            assert.strictEqual(ConfiguracionData.validarNuevoConsecutivo('@SUM(1,2)', 10).valido, false);
        });
    });

    // =========================================================================
    // 2. ConfiguracionData.calcularKpis
    // =========================================================================
    describe('2. ConfiguracionData.calcularKpis', () => {

        it('debe calcular correctamente los KPIs ejecutivos con datos completos', () => {
            const kpis = ConfiguracionData.calcularKpis({
                proximoFactura: 6897,
                proximoCotizacion: 6897,
                maxActual: 6896,
                categorias: categoriasMock,
                empresa: empresaMock
            });

            assert.strictEqual(kpis.proximoDoc, 6897);
            assert.strictEqual(kpis.proximoFactura, 6897);
            assert.strictEqual(kpis.proximoCotizacion, 6897);
            assert.strictEqual(kpis.maxActual, 6896);
            assert.strictEqual(kpis.totalCategorias, 12);
            assert.strictEqual(kpis.categoriasActivas, 11);
            assert.strictEqual(kpis.categoriasIngreso, 3);
            assert.strictEqual(kpis.categoriasEgreso, 8);
            assert.strictEqual(kpis.perfilCompleto, true);
        });

        it('debe calcular proximoDoc como el mayor entre proximoFactura y proximoCotizacion', () => {
            const kpis = ConfiguracionData.calcularKpis({
                proximoFactura: 7000,
                proximoCotizacion: 6500,
                maxActual: 6499
            });
            assert.strictEqual(kpis.proximoDoc, 7000);

            const kpis2 = ConfiguracionData.calcularKpis({
                proximoFactura: 5000,
                proximoCotizacion: 8200,
                maxActual: 4999
            });
            assert.strictEqual(kpis2.proximoDoc, 8200);
        });

        it('debe determinar correctamente perfilCompleto true sólo cuando tiene razonSocial, nit y telefono', () => {
            const perfilSinTel = { razonSocial: 'MAS', nit: '123', telefono: '' };
            assert.strictEqual(ConfiguracionData.calcularKpis({ empresa: perfilSinTel }).perfilCompleto, false);

            const perfilSinNit = { razonSocial: 'MAS', nit: '', telefono: '315' };
            assert.strictEqual(ConfiguracionData.calcularKpis({ empresa: perfilSinNit }).perfilCompleto, false);

            const perfilSinRazon = { razonSocial: '', nit: '123', telefono: '315' };
            assert.strictEqual(ConfiguracionData.calcularKpis({ empresa: perfilSinRazon }).perfilCompleto, false);

            const perfilOk = { razonSocial: 'MAS Accesorios', nit: '79981638-4', telefono: '3158512091' };
            assert.strictEqual(ConfiguracionData.calcularKpis({ empresa: perfilOk }).perfilCompleto, true);
        });

        it('debe manejar estado vacío, null o indefinido retornando valores seguros sin NaN ni undefined', () => {
            const kpisNull = ConfiguracionData.calcularKpis(null);
            assert.strictEqual(kpisNull.proximoDoc, 1);
            assert.strictEqual(kpisNull.totalCategorias, 0);
            assert.strictEqual(kpisNull.categoriasActivas, 0);
            assert.strictEqual(kpisNull.categoriasIngreso, 0);
            assert.strictEqual(kpisNull.categoriasEgreso, 0);
            assert.strictEqual(kpisNull.perfilCompleto, false);

            const kpisEmpty = ConfiguracionData.calcularKpis({});
            assert.strictEqual(kpisEmpty.proximoDoc, 1);
            assert.strictEqual(kpisEmpty.totalCategorias, 0);
            assert.strictEqual(kpisEmpty.categoriasActivas, 0);
            assert.strictEqual(kpisEmpty.perfilCompleto, false);
        });

        it('debe procesar valores numéricos pasados como strings sin corromper el cálculo', () => {
            const kpis = ConfiguracionData.calcularKpis({
                proximoFactura: '7500',
                proximoCotizacion: '7400',
                maxActual: '7399',
                categorias: categoriasMock
            });
            assert.strictEqual(kpis.proximoFactura, 7500);
            assert.strictEqual(kpis.proximoCotizacion, 7400);
            assert.strictEqual(kpis.maxActual, 7399);
            assert.strictEqual(kpis.proximoDoc, 7500);
        });
    });

    // =========================================================================
    // 3. ConfiguracionData.calcularTabCounts
    // =========================================================================
    describe('3. ConfiguracionData.calcularTabCounts', () => {

        it('debe calcular los tabCounts exactos para pestañas segmentadas', () => {
            const counts = ConfiguracionData.calcularTabCounts(categoriasMock);
            assert.strictEqual(counts.todas, 12);
            assert.strictEqual(counts.egresos, 8); // activas out
            assert.strictEqual(counts.ingresos, 3); // activas in
            assert.strictEqual(counts.inactivas, 1); // inactivas
        });

        it('debe retornar conteos en cero ante arreglos vacíos, null o indefinidos', () => {
            const cEmpty = ConfiguracionData.calcularTabCounts([]);
            assert.strictEqual(cEmpty.todas, 0);
            assert.strictEqual(cEmpty.egresos, 0);
            assert.strictEqual(cEmpty.ingresos, 0);
            assert.strictEqual(cEmpty.inactivas, 0);

            const cNull = ConfiguracionData.calcularTabCounts(null);
            assert.strictEqual(cNull.todas, 0);
            assert.strictEqual(cNull.egresos, 0);

            const cUndef = ConfiguracionData.calcularTabCounts(undefined);
            assert.strictEqual(cUndef.todas, 0);
        });
    });

    // =========================================================================
    // 4. ConfiguracionData.filtrarCategorias
    // =========================================================================
    describe('4. ConfiguracionData.filtrarCategorias', () => {

        it('debe filtrar por pestaña "todas" retornando el dataset completo', () => {
            const res = ConfiguracionData.filtrarCategorias(categoriasMock, { tab: 'todas' });
            assert.strictEqual(res.length, 12);
        });

        it('debe filtrar por pestaña "egresos" mostrando sólo activas out', () => {
            const res = ConfiguracionData.filtrarCategorias(categoriasMock, { tab: 'egresos' });
            assert.strictEqual(res.length, 8);
            assert.ok(res.every(c => c.tipo_flujo === 'out' && c.estado === 'activa'));
        });

        it('debe filtrar por pestaña "ingresos" mostrando sólo activas in', () => {
            const res = ConfiguracionData.filtrarCategorias(categoriasMock, { tab: 'ingresos' });
            assert.strictEqual(res.length, 3);
            assert.ok(res.every(c => c.tipo_flujo === 'in' && c.estado === 'activa'));
        });

        it('debe filtrar por pestaña "inactivas"', () => {
            const res = ConfiguracionData.filtrarCategorias(categoriasMock, { tab: 'inactivas' });
            assert.strictEqual(res.length, 1);
            assert.strictEqual(res[0].id, 12);
            assert.strictEqual(res[0].estado, 'inactiva');
        });

        it('debe buscar en tiempo real insensible a mayúsculas y acentos', () => {
            // Busca 'nomina' con o sin tilde -> 'Gastos de Personal (Nómina)'
            const res1 = ConfiguracionData.filtrarCategorias(categoriasMock, { tab: 'todas', query: 'nomina' });
            assert.strictEqual(res1.length, 1);
            assert.strictEqual(res1[0].nombre, 'Gastos de Personal (Nómina)');

            const res2 = ConfiguracionData.filtrarCategorias(categoriasMock, { tab: 'todas', query: 'NÓMINA' });
            assert.strictEqual(res2.length, 1);

            const res3 = ConfiguracionData.filtrarCategorias(categoriasMock, { tab: 'todas', query: 'publicos' });
            assert.strictEqual(res3.length, 1);
            assert.strictEqual(res3[0].nombre, 'Servicios Públicos y Tecnología');
        });

        it('debe combinar pestaña y query de búsqueda simultáneamente', () => {
            // Tab 'egresos' con query 'ingresos' -> 0 resultados
            const res1 = ConfiguracionData.filtrarCategorias(categoriasMock, { tab: 'egresos', query: 'ingresos' });
            assert.strictEqual(res1.length, 0);

            // Tab 'ingresos' con query 'recaudo' -> 1 resultado
            const res2 = ConfiguracionData.filtrarCategorias(categoriasMock, { tab: 'ingresos', query: 'recaudo' });
            assert.strictEqual(res2.length, 1);
            assert.strictEqual(res2[0].id, 3);
        });

        it('debe retornar arreglo vacío si ninguna categoría coincide con la búsqueda', () => {
            const res = ConfiguracionData.filtrarCategorias(categoriasMock, { tab: 'todas', query: 'inexistente999' });
            assert.strictEqual(res.length, 0);
        });

        it('debe tolerar arreglo de categorías nulo, indefinido o vacío retornando []', () => {
            assert.deepStrictEqual(ConfiguracionData.filtrarCategorias(null, { tab: 'todas' }), []);
            assert.deepStrictEqual(ConfiguracionData.filtrarCategorias(undefined, { tab: 'todas' }), []);
            assert.deepStrictEqual(ConfiguracionData.filtrarCategorias([], { tab: 'todas' }), []);
        });

        it('debe tolerar opciones nulas o vacías aplicando defaults seguros', () => {
            const res1 = ConfiguracionData.filtrarCategorias(categoriasMock, {});
            assert.strictEqual(res1.length, 12);

            const res2 = ConfiguracionData.filtrarCategorias(categoriasMock, null);
            assert.strictEqual(res2.length, 12);
        });

        it('debe ignorar espacios en blanco al inicio o final de la query de búsqueda', () => {
            const res = ConfiguracionData.filtrarCategorias(categoriasMock, { tab: 'todas', query: '   arrendamientos   ' });
            assert.strictEqual(res.length, 1);
            assert.strictEqual(res[0].id, 6);
        });

        it('debe neutralizar búsquedas con caracteres especiales o inyecciones SQL/HTML', () => {
            const res1 = ConfiguracionData.filtrarCategorias(categoriasMock, { tab: 'todas', query: "' OR '1'='1" });
            assert.strictEqual(res1.length, 0);

            const res2 = ConfiguracionData.filtrarCategorias(categoriasMock, { tab: 'todas', query: '<script>' });
            assert.strictEqual(res2.length, 0);
        });
    });

    // =========================================================================
    // 5. ConfiguracionData.validarCategoria
    // =========================================================================
    describe('5. ConfiguracionData.validarCategoria', () => {

        it('debe validar y normalizar una categoría nueva válida', () => {
            const cat = { nombre: 'Seguros y Pólizas', tipo_flujo: 'out' };
            const res = ConfiguracionData.validarCategoria(cat, categoriasMock);
            assert.strictEqual(res.valido, true);
            assert.strictEqual(res.categoriaLimpia.nombre, 'Seguros y Pólizas');
            assert.strictEqual(res.categoriaLimpia.tipo_flujo, 'out');
            assert.strictEqual(res.categoriaLimpia.estado, 'activa');
        });

        it('debe rechazar nombres vacíos o menores a 3 caracteres', () => {
            const res1 = ConfiguracionData.validarCategoria({ nombre: '', tipo_flujo: 'out' }, categoriasMock);
            assert.strictEqual(res1.valido, false);
            assert.ok(res1.error.includes('al menos 3'));

            const res2 = ConfiguracionData.validarCategoria({ nombre: 'AB', tipo_flujo: 'out' }, categoriasMock);
            assert.strictEqual(res2.valido, false);

            const res3 = ConfiguracionData.validarCategoria({ nombre: '   ', tipo_flujo: 'out' }, categoriasMock);
            assert.strictEqual(res3.valido, false);
        });

        it('debe rechazar tipo_flujo inválido distinto a in o out', () => {
            const res1 = ConfiguracionData.validarCategoria({ nombre: 'Nueva Categoria', tipo_flujo: 'otro' }, categoriasMock);
            assert.strictEqual(res1.valido, false);
            assert.ok(res1.error.includes('tipo'));

            const res2 = ConfiguracionData.validarCategoria({ nombre: 'Nueva Categoria', tipo_flujo: '' }, categoriasMock);
            assert.strictEqual(res2.valido, false);
        });

        it('debe rechazar nombres duplicados sin importar mayúsculas o acentos', () => {
            // "arrendamientos" existe como "Arrendamientos"
            const res1 = ConfiguracionData.validarCategoria({ nombre: 'arrendamientos', tipo_flujo: 'out' }, categoriasMock);
            assert.strictEqual(res1.valido, false);
            assert.ok(res1.error.includes('ya existe'));

            // "Publicidad y mercadeo" existe como "Publicidad y Mercadeo"
            const res2 = ConfiguracionData.validarCategoria({ nombre: 'Publicidad y mercadeo', tipo_flujo: 'out' }, categoriasMock);
            assert.strictEqual(res2.valido, false);
        });

        it('debe permitir guardar una categoría existente cuando mantiene su propio nombre (edición)', () => {
            const catExistente = { id: 6, nombre: 'Arrendamientos', tipo_flujo: 'out' };
            const res = ConfiguracionData.validarCategoria(catExistente, categoriasMock);
            assert.strictEqual(res.valido, true, 'No debe colisionar consigo misma al editar');
        });

        it('debe recortar espacios en blanco superfluos en el nombre de la categoría', () => {
            const res = ConfiguracionData.validarCategoria({ nombre: '   Caja Menor Operativa   ', tipo_flujo: 'out' }, categoriasMock);
            assert.strictEqual(res.valido, true);
            assert.strictEqual(res.categoriaLimpia.nombre, 'Caja Menor Operativa');
        });

        it('debe rechazar entradas nulas o vacías', () => {
            assert.strictEqual(ConfiguracionData.validarCategoria(null, categoriasMock).valido, false);
            assert.strictEqual(ConfiguracionData.validarCategoria({}, categoriasMock).valido, false);
        });
    });

    // =========================================================================
    // 6. ConfiguracionData.sanitizarPerfilEmpresa
    // =========================================================================
    describe('6. ConfiguracionData.sanitizarPerfilEmpresa', () => {

        it('debe preservar intactos todos los datos válidos provistos', () => {
            const perfil = ConfiguracionData.sanitizarPerfilEmpresa(empresaMock);
            assert.strictEqual(perfil.razonSocial, 'MAS Accesorios');
            assert.strictEqual(perfil.nit, '79981638-4');
            assert.strictEqual(perfil.telefono, '3158512091');
            assert.strictEqual(perfil.email, 'contacto@masaccesorios.com');
            assert.strictEqual(perfil.ciudad, 'Cali');
            assert.strictEqual(perfil.direccion, 'Calle 10 # 5-20');
        });

        it('debe aplicar fallbacks oficiales cuando se envíen campos vacíos o null', () => {
            const perfil = ConfiguracionData.sanitizarPerfilEmpresa({});
            assert.strictEqual(perfil.razonSocial, 'MAS Accesorios');
            assert.strictEqual(perfil.nit, '79981638-4');
            assert.strictEqual(perfil.titular, 'Diego Izquierdo');
            assert.strictEqual(perfil.telefono, '3158512091');
            assert.ok(perfil.terminosCotizacion.length > 0);
            assert.ok(perfil.notasFactura.length > 0);

            const perfilNull = ConfiguracionData.sanitizarPerfilEmpresa(null);
            assert.strictEqual(perfilNull.razonSocial, 'MAS Accesorios');
        });

        it('debe normalizar y limpiar el teléfono conservando únicamente dígitos legibles', () => {
            const p1 = ConfiguracionData.sanitizarPerfilEmpresa({ telefono: '+57 (315) 851-2091' });
            assert.strictEqual(p1.telefono, '3158512091');

            const p2 = ConfiguracionData.sanitizarPerfilEmpresa({ telefono: '315.851.2091' });
            assert.strictEqual(p2.telefono, '3158512091');

            const p3 = ConfiguracionData.sanitizarPerfilEmpresa({ telefono: '315 851 2091' });
            assert.strictEqual(p3.telefono, '3158512091');
        });

        it('debe normalizar el email eliminando espacios en blanco', () => {
            const perfil = ConfiguracionData.sanitizarPerfilEmpresa({ email: '   contacto@masaccesorios.com   ' });
            assert.strictEqual(perfil.email, 'contacto@masaccesorios.com');
        });
    });

    // =========================================================================
    // 7. ConfiguracionTemplates - Componentes UI & Layout
    // =========================================================================
    describe('7. ConfiguracionTemplates - Componentes UI & Layout', () => {

        it('renderLayout debe renderizar el Top Bar, 4 KPI cards y segmented tabs', () => {
            const html = ConfiguracionTemplates.renderLayout({
                kpis: ConfiguracionData.calcularKpis({
                    proximoFactura: 6897,
                    proximoCotizacion: 6897,
                    maxActual: 6896,
                    categorias: categoriasMock,
                    empresa: empresaMock
                }),
                currentTab: 'consecutivos'
            });

            // Top Bar
            assert.ok(html.includes('Configuración del Sistema'), 'Debe incluir el título del módulo');
            assert.ok(html.includes('Parámetros Operativos 360°'), 'Debe incluir el badge institucional 360°');

            // 4 KPI Cards (.payment-kpi-card)
            assert.ok(html.includes('payment-kpi-card'), 'Debe usar las clases ejecutivas payment-kpi-card');
            assert.ok(html.includes('kpi-proximo-doc'), 'Debe incluir el contenedor de KPI próximo doc');
            assert.ok(html.includes('kpi-categorias-activas'), 'Debe incluir el contenedor de KPI categorías');
            assert.ok(html.includes('kpi-perfil-empresa'), 'Debe incluir el contenedor de KPI perfil empresa');
            assert.ok(html.includes('kpi-tema-sistema'), 'Debe incluir el contenedor de KPI tema visual');

            // Segmented Tabs Bar (.payment-tabs-bar)
            assert.ok(html.includes('payment-tabs-bar'), 'Debe usar payment-tabs-bar');
            assert.ok(html.includes('data-tab="consecutivos"'), 'Debe incluir la pestaña de consecutivos');
            assert.ok(html.includes('data-tab="categorias"'), 'Debe incluir la pestaña de categorías');
            assert.ok(html.includes('data-tab="empresa"'), 'Debe incluir la pestaña de empresa');
            assert.ok(html.includes('data-tab="apariencia"'), 'Debe incluir la pestaña de apariencia');

            // Contenedor Reactivo y Drawer
            assert.ok(html.includes('id="config-tab-content"'), 'Debe incluir contenedor de contenido reactivo');
            assert.ok(html.includes('id="drawer-config-container"'), 'Debe incluir contenedor de modal/drawer');
        });

        it('renderLayout debe tolerar state vacío o indefinido con fallbacks seguros', () => {
            const htmlNull = ConfiguracionTemplates.renderLayout(null);
            assert.ok(htmlNull.includes('Configuración del Sistema'));
            assert.ok(htmlNull.includes('payment-kpi-card'));

            const htmlEmpty = ConfiguracionTemplates.renderLayout({});
            assert.ok(htmlEmpty.includes('Configuración del Sistema'));
        });

        it('renderConsecutivosTab debe mostrar las tarjetas ejecutivas de Facturas y Cotizaciones', () => {
            const html = ConfiguracionTemplates.renderConsecutivosTab({
                proximoFactura: 6897,
                proximoCotizacion: 6897,
                maxActual: 6896
            });

            // Alerta de seguridad y continuidad
            assert.ok(html.includes('Seguridad y Continuidad de Consecutivos'));
            assert.ok(html.includes('#6896'), 'Debe reflejar el máximo actual en uso');

            // Facturas
            assert.ok(html.includes('Próxima Factura'));
            assert.ok(html.includes('F-6897'));
            assert.ok(html.includes('id="input-next-factura"'));

            // Cotizaciones
            assert.ok(html.includes('Próxima Cotización'));
            assert.ok(html.includes('C-6897'));
            assert.ok(html.includes('id="input-next-cotizacion"'));

            // Botones de acción
            assert.ok(html.includes('btn-guardar-consecutivo'));
            assert.ok(html.includes('data-tabla="facturas"'));
            assert.ok(html.includes('data-tabla="cotizaciones"'));
        });

        it('renderConsecutivosTab debe tolerar data nula o vacía con valores por defecto', () => {
            const html = ConfiguracionTemplates.renderConsecutivosTab({});
            assert.ok(html.includes('Próxima Factura'));
            assert.ok(html.includes('Próxima Cotización'));
            assert.ok(html.includes('id="input-next-factura"'));
        });

        it('renderCategoriasTab debe renderizar la tabla fluida con badges de flujo in/out', () => {
            const html = ConfiguracionTemplates.renderCategoriasTab({
                categorias: categoriasMock,
                activeTabFilter: 'todas',
                searchQuery: ''
            });

            // Herramientas y Filtros
            assert.ok(html.includes('Todas (12)'));
            assert.ok(html.includes('Gastos / Egresos (8)'));
            assert.ok(html.includes('Ingresos (3)'));
            assert.ok(html.includes('Inactivas (1)'));
            assert.ok(html.includes('id="input-buscar-categoria"'));
            assert.ok(html.includes('id="btn-nueva-categoria"'));

            // Tabla y Contenidos
            assert.ok(html.includes('Categoría Contable'));
            assert.ok(html.includes('Ingresos Operacionales'));
            assert.ok(html.includes('Proveedores / Costo de Ventas'));
            assert.ok(html.includes('badge'));
            assert.ok(html.includes('btn-toggle-categoria'));
        });

        it('renderCategoriasTab debe renderizar estado vacío amigable cuando no hay categorías', () => {
            const html = ConfiguracionTemplates.renderCategoriasTab({
                categorias: [],
                activeTabFilter: 'todas',
                searchQuery: 'termino_inexistente'
            });

            assert.ok(html.includes('No se encontraron categorías'));
        });

        it('renderEmpresaTab debe renderizar los datos comerciales y de membrete', () => {
            const html = ConfiguracionTemplates.renderEmpresaTab(empresaMock);

            assert.ok(html.includes('MAS Accesorios'));
            assert.ok(html.includes('79981638-4'));
            assert.ok(html.includes('Diego Izquierdo'));
            assert.ok(html.includes('3158512091'));
            assert.ok(html.includes('contacto@masaccesorios.com'));
            assert.ok(html.includes('Cali'));
            assert.ok(html.includes('Calle 10 # 5-20'));
            assert.ok(html.includes('Régimen Simplificado'));
            assert.ok(html.includes('id="btn-guardar-empresa"'));
        });

        it('renderEmpresaTab debe tolerar perfil nulo aplicando valores por defecto institucionales', () => {
            const html = ConfiguracionTemplates.renderEmpresaTab(null);
            assert.ok(html.includes('MAS Accesorios'));
            assert.ok(html.includes('id="btn-guardar-empresa"'));
        });

        it('renderAparienciaTab debe renderizar el selector de temas moderno sin el disclaimer obsoleto', () => {
            const html = ConfiguracionTemplates.renderAparienciaTab('dark-green');

            assert.ok(html.includes('Emerald Dark Ledger'));
            assert.ok(html.includes('Mezcla Azul Corporativo'));
            assert.ok(html.includes('Actual'));
            assert.ok(html.includes('data-theme-value="dark-green"'));
            assert.ok(html.includes('data-theme-value="dark-blue"'));
            assert.ok(html.includes('data-theme-value=""'));

            // Verificar que NO contiene el texto de disclaimer obsoleto
            assert.ok(!html.includes('este es el primer paso de un cambio de diseño más grande'));
        });

        it('renderAparienciaTab debe tolerar tema nulo marcando el tema por defecto', () => {
            const html = ConfiguracionTemplates.renderAparienciaTab(null);
            assert.ok(html.includes('Emerald Dark Ledger'));
            assert.ok(html.includes('theme-option-card'));
        });
    });

    // =========================================================================
    // 8. Blindaje de Seguridad y Auditoría OWASP (Fase 4 ECC)
    // =========================================================================
    describe('8. Blindaje de Seguridad y Auditoría OWASP (Fase 4 ECC)', () => {

        it('1. Prevención estricta de XSS: debe sanitizar payloads en nombres de categorías al renderizar tabla', () => {
            const categoriaMaliciosa = [
                {
                    id: 99,
                    nombre: '<script>alert("xss")</script>Gasto Hacker',
                    tipo_flujo: 'out',
                    estado: 'activa'
                },
                {
                    id: 100,
                    nombre: '<img src=x onerror=alert(1)>Categoria Inyectada',
                    tipo_flujo: 'in',
                    estado: 'activa'
                }
            ];

            const html = ConfiguracionTemplates.renderCategoriasTab({
                categorias: categoriaMaliciosa,
                activeTabFilter: 'todas',
                searchQuery: ''
            });

            // Ningún tag ejecutable sin escapar
            assert.ok(!html.includes('<script>alert("xss")</script>'), 'No debe contener tags de script sin escapar');
            assert.ok(!html.includes('<img src=x onerror=alert(1)>'), 'No debe contener img con onerror sin escapar');

            // Debe contener las entidades HTML seguras
            assert.ok(
                html.includes('&lt;script&gt;') || html.includes('&lt;img'),
                'Debe haber neutralizado los tags con entidades HTML'
            );
        });

        it('2. Prevención de inyección XSS en inputs de empresa: debe escapar comillas y tags HTML en atributos value', () => {
            const perfilAtaque = {
                razonSocial: 'MAS "><script>alert("xss")</script>',
                titular: 'Diego " onload="alert(1)',
                nit: '900123456" onfocus="alert(1)',
                telefono: '3158512091',
                email: 'test@test.com" style="background:red',
                ciudad: 'Cali',
                direccion: 'Calle 10"><img src=x onerror=alert(1)>',
                regimen: 'Simplificado',
                terminosCotizacion: '</textarea><script>alert(1)</script>',
                notasFactura: '</textarea><script>alert(2)</script>'
            };

            const html = ConfiguracionTemplates.renderEmpresaTab(perfilAtaque);

            assert.ok(!html.includes('"><script>alert("xss")</script>'));
            assert.ok(!html.includes('" onload="alert(1)'));
            assert.ok(!html.includes('"><img src=x onerror=alert(1)>'));
            assert.ok(!html.includes('</textarea><script>alert(1)</script>'));
        });

        it('3. Resiliencia contra colapso de UI (DOM DoS): filtrado de 1,000 categorías debe ejecutarse en < 25ms', () => {
            const categoriasMasivas = [];
            for (let i = 1; i <= 1000; i++) {
                categoriasMasivas.push({
                    id: i,
                    nombre: `Categoría Operativa Contable #${i} - Subcuenta de Control`,
                    tipo_flujo: i % 2 === 0 ? 'out' : 'in',
                    estado: i % 10 === 0 ? 'inactiva' : 'activa'
                });
            }

            const t0 = performance.now();
            const filtradas = ConfiguracionData.filtrarCategorias(categoriasMasivas, {
                tab: 'egresos',
                query: 'Subcuenta'
            });
            const duracion = performance.now() - t0;

            assert.ok(filtradas.length > 0);
            assert.ok(duracion < 25, `El filtrado de 1,000 categorías tomó ${duracion.toFixed(2)}ms (esperado < 25ms)`);
        });

        it('4. Integridad de prototipos: objetos con propiedades maliciosas no deben causar prototype pollution', () => {
            const payloadContaminado = JSON.parse('{"__proto__": {"admin": true}, "razonSocial": "Empresa Segura"}');
            const sanitized = ConfiguracionData.sanitizarPerfilEmpresa(payloadContaminado);

            assert.strictEqual(sanitized.razonSocial, 'Empresa Segura');
            assert.strictEqual(Object.prototype.admin, undefined, 'No debe contaminar Object.prototype');
        });

        it('5. Validación defensiva de números en consecutivos: debe rechazar Infinity, -Infinity y valores fuera de límites', () => {
            assert.strictEqual(ConfiguracionData.validarNuevoConsecutivo(Infinity, 100).valido, false);
            assert.strictEqual(ConfiguracionData.validarNuevoConsecutivo(-Infinity, 100).valido, false);
            assert.strictEqual(ConfiguracionData.validarNuevoConsecutivo(NaN, 100).valido, false);
            assert.strictEqual(ConfiguracionData.validarNuevoConsecutivo(1e308, 100).valido, false);
        });
    });

});
