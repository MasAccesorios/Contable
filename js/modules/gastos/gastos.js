import { CrudFinanciero } from '../../shared/crudFinanciero.js';

const configGastos = {
    titulo: 'Gastos Operativos',
    btnNuevoText: 'Registrar Nuevo Gasto',
    panelHistorialText: 'Historial de Gastos',
    kpiId: 'kpi-total-gastos',
    formId: 'form-nuevo-gasto',
    tbodyId: 'tbody-gastos',
    colorMonto: 'text-danger',
    prefijoMonto: '-',
    tipoTransaccion: 'egreso',
    tipoFiltroDb: 'out'
};

const moduloCRUD = new CrudFinanciero(configGastos);

export const GastosModule = {
    async init(element) {
        await moduloCRUD.init(element);
    }
};
