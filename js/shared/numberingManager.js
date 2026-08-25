import DB from '../core/db.js';

/**
 * GESTOR DE NUMERACIÓN Y CONTROL DE DUPLICADOS (MODAL)
 * Maneja la configuración del consecutivo en tiempo real previniendo choques en DB.
 */
export const NumberingManager = {
    async openNumberingModal(tipoDocumento, currentData, onSaveCallback) {
        // Remover si ya existe
        const existing = document.getElementById('numbering-modal');
        if (existing) existing.remove();

        const titulo = tipoDocumento === 'cotizacion' ? 'Cotización' : 'Factura';
        const currentPrefix = currentData.prefijo || '';
        const currentNum = currentData.numero || '';

        const modalHtml = `
            <div id="numbering-modal" class="position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center" style="background: rgba(12, 26, 48, 0.4); z-index: 1050; backdrop-filter: blur(2px);">
                <div class="bg-white p-4 shadow rounded" style="width: 400px; border-radius: 12px; border: 1px solid var(--border-color);">
                    <div class="d-flex justify-content-between align-items-center mb-4">
                        <h5 class="fw-bold mb-0" style="color: var(--text-main);">Configurar numeración</h5>
                        <button class="btn-close" id="btn-close-num" aria-label="Close"></button>
                    </div>
                    
                    <div class="row align-items-center mb-3">
                        <div class="col-4 text-muted" style="font-size: 13px;">Nombre:</div>
                        <div class="col-8 fw-bold" style="font-size: 13px; color: var(--text-main);">${titulo}</div>
                    </div>
                    
                    <div class="row align-items-center mb-3">
                        <div class="col-4 text-muted" style="font-size: 13px;">Prefijo:</div>
                        <div class="col-8">
                            <input type="text" id="num-prefijo" class="form-control form-control-sm text-muted" value="${currentPrefix}">
                        </div>
                    </div>
                    
                    <div class="row align-items-start mb-4">
                        <div class="col-4 text-muted mt-1" style="font-size: 13px;">Siguiente número:</div>
                        <div class="col-8">
                            <input type="number" id="num-siguiente" class="form-control form-control-sm text-muted" value="${currentNum}">
                            <div id="num-error" class="text-danger mt-1" style="font-size: 11px; display: none; line-height: 1.2;"></div>
                        </div>
                    </div>
                    
                    <div class="mb-4 text-center">
                        <a href="#" style="color: #2dbda8; font-size: 13px; text-decoration: none; font-weight: var(--weight-medium);">Gestionar mis numeraciones</a>
                    </div>
                    
                    <div class="d-flex justify-content-end gap-2 mt-2">
                        <button class="btn btn-light border px-4" id="btn-cancel-num" style="font-weight: var(--weight-medium); font-size: 13px; color: var(--text-body);">Cancelar</button>
                        <button class="btn text-white px-4" id="btn-save-num" style="background-color: #2cbfb7; font-weight: var(--weight-medium); font-size: 13px; border-radius: 6px;">Guardar</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const modal = document.getElementById('numbering-modal');
        const btnClose = document.getElementById('btn-close-num');
        const btnCancel = document.getElementById('btn-cancel-num');
        const btnSave = document.getElementById('btn-save-num');
        const inpPrefijo = document.getElementById('num-prefijo');
        const inpSiguiente = document.getElementById('num-siguiente');
        const errDiv = document.getElementById('num-error');

        const closeModal = () => modal.remove();

        btnClose.addEventListener('click', closeModal);
        btnCancel.addEventListener('click', closeModal);

        btnSave.addEventListener('click', async () => {
            const newPrefijo = inpPrefijo.value.trim();
            const newNum = parseInt(inpSiguiente.value.trim());

            inpSiguiente.style.borderColor = 'var(--border-color)';
            errDiv.style.display = 'none';

            if (!newNum) {
                inpSiguiente.style.borderColor = '#ef4444';
                errDiv.textContent = 'El número es requerido.';
                errDiv.style.display = 'block';
                return;
            }

            // Duplication Guard Logic
            const collectionName = tipoDocumento === 'cotizacion' ? 'cotizaciones' : 'facturas';
            const todos = await DB.getAll(collectionName);
            
            const isDuplicate = todos.some(doc => 
                doc.id !== currentData.id && // Excluir actual
                (doc.prefijo || '') === newPrefijo && 
                parseInt(doc.numero) === newNum
            );

            if (isDuplicate) {
                inpSiguiente.style.borderColor = '#ef4444';
                errDiv.textContent = `El número ${newPrefijo}${newNum} ya se encuentra registrado en un documento anterior. Por favor, asigne un consecutivo disponible.`;
                errDiv.style.display = 'block';
                return;
            }

            // Validación superada
            currentData.prefijo = newPrefijo;
            currentData.numero = newNum;
            
            if (onSaveCallback) onSaveCallback(newPrefijo, newNum);
            closeModal();
        });
    }
};
