import { CrudFinanciero } from '../../shared/crudFinanciero.js';

export const CATEGORIAS_GASTO = ["Arriendo", "Servicios", "Nómina", "Insumos Menores", "Cuentas por Cobrar", "Otros"];

const configGastos = {
    titulo: 'Gastos Operativos',
    btnNuevoText: 'Registrar Nuevo Gasto',
    panelHistorialText: 'Historial de Gastos',
    kpiId: 'kpi-total-gastos',
    formId: 'form-nuevo-gasto',
    tbodyId: 'tbody-gastos',
    categorias: CATEGORIAS_GASTO,
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
