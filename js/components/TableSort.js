/**
 * TableSort - Motor reutilizable de ordenamiento y filtrado
 */
const TableSort = (() => {
    const _state = {};

    function _getState(ctx) {
        if (!_state[ctx]) _state[ctx] = { col: null, dir: 'desc', filter: 'todas', q: '', _prevCol: null, _bankId: null };
        return _state[ctx];
    }

    /** Ordena genérico: detecta fecha, número o string */
    function sort(arr, col, dir = 'asc') {
        if (!col) return arr;
        return [...arr].sort((a, b) => {
            let va = a[col] ?? '';
            let vb = b[col] ?? '';
            if (typeof va === 'string' && /^\d{4}-\d{2}/.test(va)) {
                va = new Date(va); vb = new Date(vb);
            } else if (!isNaN(parseFloat(va)) && !isNaN(parseFloat(vb))) {
                va = parseFloat(va); vb = parseFloat(vb);
            } else {
                va = String(va).toLowerCase(); vb = String(vb).toLowerCase();
            }
            if (va < vb) return dir === 'asc' ? -1 : 1;
            if (va > vb) return dir === 'asc' ? 1 : -1;
            return 0;
        });
    }

    function _icon(ctx, col) {
        const s = _getState(ctx);
        if (s.col !== col) return '<i class="bi bi-arrow-down-up ms-1 text-muted" style="font-size:10px;opacity:.5"></i>';
        return s.dir === 'asc'
            ? '<i class="bi bi-sort-up ms-1" style="font-size:11px;color:#4361ee"></i>'
            : '<i class="bi bi-sort-down ms-1" style="font-size:11px;color:#4361ee"></i>';
    }

    function renderSortTh(label, col, ctx, extraClass = '') {
        return `<th class="sortable-th ${extraClass}" style="cursor:pointer;user-select:none" onclick="TableSort.toggle('${ctx}','${col}')">${label}${_icon(ctx, col)}</th>`;
    }

    function toggle(ctx, col) {
        const s = _getState(ctx);
        if (s._prevCol === col) {
            s.dir = s.dir === 'asc' ? 'desc' : 'asc';
        } else {
            s.col = col;
            s._prevCol = col;
            s.dir = 'asc';
        }
        _trigger(ctx);
    }

    function applyFilter(ctx, val) {
        _getState(ctx).filter = val;
        _trigger(ctx);
    }

    function setBankId(bankId) {
        _getState('bancos')._bankId = bankId;
    }

    function _trigger(ctx) {
        const s = _getState(ctx);
        if (ctx === 'ventas')            App.filterVentas(s.q);
        else if (ctx === 'cotizaciones') App.filterCotizaciones(s.q);
        else if (ctx === 'clientes')     App.filterClientes ? App.filterClientes(s.q) : App.navigateTo('clientes');
        else if (ctx === 'cartera')      App.loadCartera(s.filter || 'todas');
        else if (ctx === 'bancos' && s._bankId) App.viewBankMovements(s._bankId);
    }

    function apply(arr, ctx) {
        const s = _getState(ctx);
        return sort(arr, s.col, s.dir);
    }

    function renderFilterBar({ ctx, opts = [], placeholder, searchId, onSearchInput, searchValue = '' }) {
        const s = _getState(ctx);
        const optHtml = opts.map(o =>
            `<option value="${o.value}" ${s.filter === o.value ? 'selected' : ''}>${o.label}</option>`
        ).join('');
        const searchPh = placeholder || 'Buscar...';
        return `
            <div class="input-group input-group-sm" style="width:220px;">
                <span class="input-group-text"><i class="bi bi-search"></i></span>
                <input type="text" id="${searchId}" class="form-control" placeholder="${searchPh}" value="${searchValue}" oninput="${onSearchInput}">
            </div>
            ${opts.length ? `<select class="form-select form-select-sm" style="width:auto;min-width:160px" onchange="TableSort.applyFilter('${ctx}', this.value)">${optHtml}</select>` : ''}
        `;
    }

    return { sort, apply, renderSortTh, renderFilterBar, toggle, applyFilter, setBankId, _getState };
})();
