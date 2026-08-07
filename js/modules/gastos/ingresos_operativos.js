import { CrudFinanciero } from '../../shared/crudFinanciero.js';

const configIngresos = {
    titulo: 'Ingresos Operativos',
    btnNuevoText: 'Registrar Nuevo Ingreso',
    panelHistorialText: 'Historial de Ingresos',
    kpiId: 'kpi-total-ingresos',
    formId: 'form-nuevo-ingreso',
    tbodyId: 'tbody-ingresos',
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
