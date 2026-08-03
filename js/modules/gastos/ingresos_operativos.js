import { CrudFinanciero } from '../../shared/crudFinanciero.js';

const CATEGORIAS_INGRESO = ["Ventas de Mostrador", "Servicios Adicionales", "Intereses", "Otros Ingresos"];

const configIngresos = {
    titulo: 'Ingresos Operativos',
    btnNuevoText: 'Registrar Nuevo Ingreso',
    panelHistorialText: 'Historial de Ingresos',
    kpiId: 'kpi-total-ingresos',
    formId: 'form-nuevo-ingreso',
    tbodyId: 'tbody-ingresos',
    categorias: CATEGORIAS_INGRESO,
    colorMonto: 'text-success',
    prefijoMonto: '+',
    tipoTransaccion: 'ingreso',
    tipoFiltroDb: 'in'
};

const moduloCRUD = new CrudFinanciero(configIngresos);

export const IngresosOperativosModule = {
    async init(element) {
        await moduloCRUD.init(element);
    }
};
