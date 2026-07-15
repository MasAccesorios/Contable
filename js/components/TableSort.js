/**
 * TableSort - Motor reutilizable de ordenamiento y filtrado
 * Refactorizado: Usa delegación de eventos globales para ordenar el DOM en vivo
 */
const TableSort = (() => {
    const _state = {};

    function _getState(ctx) {
        if (!_state[ctx]) _state[ctx] = { filter: 'todas', q: '', _bankId: null };
        return _state[ctx];
    }

    // Delegación global de eventos para ordenar
    document.addEventListener('click', e => {
        const th = e.target.closest('.sortable-th');
        if (!th) return;

        const table = th.closest('table');
        if (!table) return;

        const tbody = table.querySelector('tbody');
        if (!tbody) return;

        const trHeader = th.closest('tr');
        const thIndex = Array.from(trHeader.children).indexOf(th);

        let isAsc = th.getAttribute('data-dir') !== 'asc';

        // Reset icon en todos los headers de esta tabla
        table.querySelectorAll('.sortable-th').forEach(header => {
            if (header !== th) {
                header.removeAttribute('data-dir');
                const icon = header.querySelector('i.bi');
                if (icon) {
                    icon.className = 'bi bi-arrow-down-up ms-1 text-muted';
                    icon.style.opacity = '.5';
                    icon.style.color = '';
                }
            }
        });

        // Set icon en el header clickeado
        th.setAttribute('data-dir', isAsc ? 'asc' : 'desc');
        const icon = th.querySelector('i.bi');
        if (icon) {
            icon.className = isAsc ? 'bi bi-sort-up ms-1' : 'bi bi-sort-down ms-1';
            icon.style.opacity = '1';
            icon.style.color = '#4361ee';
        }

        const rows = Array.from(tbody.querySelectorAll('tr'));
        // Ignorar si la tabla solo tiene un mensaje de "Sin datos"
        if (rows.length <= 1 && (rows.length === 0 || rows[0].querySelector('td[colspan]'))) return;

        rows.sort((a, b) => {
            let valA = a.children[thIndex]?.textContent.trim() || '';
            let valB = b.children[thIndex]?.textContent.trim() || '';

            // Limpieza de moneda/números
            let numAStr = valA.replace(/[^0-9.-]+/g,"");
            let numBStr = valB.replace(/[^0-9.-]+/g,"");
            
            // Detección especial para formato COP "$ 1.000.000"
            // En es-CO el punto es separador de miles, quitémoslo
            if (valA.includes('$')) numAStr = valA.replace(/[^0-9-]+/g,"");
            if (valB.includes('$')) numBStr = valB.replace(/[^0-9-]+/g,"");

            let numA = parseFloat(numAStr);
            let numB = parseFloat(numBStr);

            let isNumA = !isNaN(numA) && /\d/.test(valA);
            let isNumB = !isNaN(numB) && /\d/.test(valB);

            // Fechas YYYY-MM-DD
            let isDateA = /^\d{4}-\d{2}-\d{2}/.test(valA);
            let isDateB = /^\d{4}-\d{2}-\d{2}/.test(valB);

            if (isDateA && isDateB) {
                let dateA = new Date(valA).getTime();
                let dateB = new Date(valB).getTime();
                return isAsc ? dateA - dateB : dateB - dateA;
            } else if (isNumA && isNumB && (!isNaN(numA) && !isNaN(numB))) {
                return isAsc ? numA - numB : numB - numA;
            } else {
                return isAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }
        });

        // Reinsertar las filas ordenadas en el DOM
        rows.forEach(row => tbody.appendChild(row));
    });

    function renderSortTh(label, col, ctx, extraClass = '') {
        // Se elimina el onclick en línea. La delegación global lo maneja.
        return `<th class="sortable-th ${extraClass}" style="cursor:pointer;user-select:none" title="Clic para ordenar">${label}<i class="bi bi-arrow-down-up ms-1 text-muted" style="font-size:10px;opacity:.5"></i></th>`;
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
        // Legacy stub: Ya no ordenamos los datos JS base para renderizado, 
        // el usuario puede ordenar el DOM vivo en cualquier momento.
        return arr;
    }

    function toggle(ctx, col) {
        // Legacy stub: El click se maneja globalmente ahora.
    }

    function sort(arr, col, dir) {
        return arr;
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
