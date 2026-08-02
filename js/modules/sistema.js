// js/modules/sistema.js
import DB from '../core/db.js';

export const SistemaModule = {
    async init(element) {
        if (!element) return;

        element.innerHTML = `
            <div class="module-container p-4">
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <h2 class="h3 fw-bold text-dark mb-0"><i class="bi bi-gear-fill me-2"></i>Sistema y Mantenimiento</h2>
                </div>

                <div id="sistema-alert" class="alert d-none mb-4 py-2"></div>

                <div class="row g-4">
                    <!-- Backup -->
                    <div class="col-md-6">
                        <div class="card border-0 shadow-sm h-100 border-primary border-start border-4">
                            <div class="card-body p-4">
                                <h5 class="fw-bold"><i class="bi bi-cloud-download text-primary me-2"></i>Exportar Respaldo</h5>
                                <p class="text-muted small">Genera una copia de seguridad completa de todos los datos del sistema (contactos, productos, facturas, caja) en un único archivo JSON.</p>
                                <button id="btn-backup" class="btn btn-outline-primary w-100">
                                    <i class="bi bi-download me-1"></i>Descargar Backup
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Restaurar -->
                    <div class="col-md-6">
                        <div class="card border-0 shadow-sm h-100 border-success border-start border-4">
                            <div class="card-body p-4">
                                <h5 class="fw-bold"><i class="bi bi-cloud-upload text-success me-2"></i>Restaurar Sistema</h5>
                                <p class="text-muted small">Carga un archivo de respaldo (.json) previo. <strong>Atención:</strong> Esto reemplazará toda la información actual por la del respaldo.</p>
                                <input type="file" id="file-restore" class="d-none" accept=".json">
                                <button id="btn-restore-trigger" class="btn btn-outline-success w-100">
                                    <i class="bi bi-upload me-1"></i>Cargar Backup
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Zona Peligrosa -->
                    <div class="col-md-12">
                        <div class="card border-0 shadow-sm border-danger border-start border-4 bg-danger-subtle">
                            <div class="card-body p-4">
                                <h5 class="fw-bold text-danger"><i class="bi bi-exclamation-triangle-fill me-2"></i>Zona Peligrosa: Limpiar Base de Datos</h5>
                                <p class="text-muted small text-dark opacity-75">Elimina definitivamente todos los registros de IndexedDB. El sistema quedará en blanco, listo para una nueva inicialización o importación desde Alegra.</p>
                                <button id="btn-clear-db" class="btn btn-danger">
                                    <i class="bi bi-trash-fill me-1"></i>Vaciar Sistema Completamente
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Modal DOM para confirmaciones (Zero Popups nativos) -->
                <div id="custom-modal" class="position-fixed top-0 start-0 w-100 h-100 d-none align-items-center justify-content-center" style="z-index: 1050; background-color: rgba(0,0,0,0.5);">
                    <div class="bg-white p-4 rounded shadow-lg mx-3" style="max-width: 450px;">
                        <h5 id="modal-title" class="fw-bold text-danger mb-3">Confirmar Acción</h5>
                        <p id="modal-body" class="text-muted mb-4">¿Estás seguro de continuar?</p>
                        <div class="d-flex justify-content-end gap-2">
                            <button id="btn-modal-cancel" class="btn btn-light">Cancelar</button>
                            <button id="btn-modal-confirm" class="btn btn-danger">Confirmar</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const showAlert = (msg, type = 'success') => {
            const alertEl = element.querySelector('#sistema-alert');
            if (!alertEl) return;
            alertEl.className = `alert alert-${type} mb-4 py-2`;
            alertEl.innerHTML = msg;
            alertEl.classList.remove('d-none');
            
            if (window._sistemaAlertTimeout) clearTimeout(window._sistemaAlertTimeout);
            window._sistemaAlertTimeout = setTimeout(() => alertEl.classList.add('d-none'), 5000);
        };

        const STORES = ['contactos', 'productos', 'lotes_fifo', 'cotizaciones', 'facturas', 'transacciones'];

        const clearStore = async (storeName) => {
            const db = await DB.init();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(storeName, 'readwrite');
                const request = tx.objectStore(storeName).clear();
                request.onsuccess = () => resolve();
                request.onerror = (e) => reject(e.target.error);
            });
        };

        const emptyDatabase = async () => {
            for (const store of STORES) {
                await clearStore(store);
            }
        };

        // Modal Logic
        const modal = element.querySelector('#custom-modal');
        const modalTitle = element.querySelector('#modal-title');
        const modalBody = element.querySelector('#modal-body');
        const btnConfirm = element.querySelector('#btn-modal-confirm');
        const btnCancel = element.querySelector('#btn-modal-cancel');
        
        let confirmAction = null;

        const showModal = (title, body, btnClass, action) => {
            modalTitle.textContent = title;
            modalBody.textContent = body;
            btnConfirm.className = `btn ${btnClass}`;
            confirmAction = action;
            modal.classList.remove('d-none');
            modal.classList.add('d-flex');
        };

        const hideModal = () => {
            modal.classList.add('d-none');
            modal.classList.remove('d-flex');
            confirmAction = null;
        };

        btnCancel.addEventListener('click', hideModal);
        btnConfirm.addEventListener('click', async () => {
            if (confirmAction) await confirmAction();
            hideModal();
        });

        // 1. BACKUP
        element.querySelector('#btn-backup')?.addEventListener('click', async () => {
            try {
                const data = {};
                for (const store of STORES) {
                    data[store] = await DB.getAll(store);
                }
                
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `respaldo_contable_${new Date().toISOString().split('T')[0]}.json`;
                a.click();
                URL.revokeObjectURL(url);
                
                showAlert('<i class="bi bi-check-circle me-1"></i>Backup generado y descargado correctamente.', 'success');
            } catch (error) {
                console.error(error);
                showAlert(`Error al generar el backup: ${error.message}`, 'danger');
            }
        });

        // 2. RESTORE
        const fileInput = element.querySelector('#file-restore');
        element.querySelector('#btn-restore-trigger')?.addEventListener('click', () => {
            fileInput.click();
        });

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            showModal(
                'Restaurar Sistema',
                'Al restaurar se eliminarán los datos actuales y se inyectarán los del archivo JSON. ¿Estás absolutamente seguro?',
                'btn-success',
                async () => {
                    const reader = new FileReader();
                    reader.onload = async (ev) => {
                        try {
                            const data = JSON.parse(ev.target.result);
                            
                            // 1. Limpiar base de datos
                            await emptyDatabase();

                            // 2. Inyectar datos
                            for (const store of STORES) {
                                if (data[store] && Array.isArray(data[store])) {
                                    for (const item of data[store]) {
                                        await DB.save(store, item);
                                    }
                                }
                            }
                            
                            showAlert('<i class="bi bi-check-circle me-1"></i>Sistema restaurado con éxito desde el respaldo.', 'success');
                        } catch (error) {
                            console.error(error);
                            showAlert(`Error corrupto o inválido al restaurar: ${error.message}`, 'danger');
                        } finally {
                            fileInput.value = ''; // Reset
                        }
                    };
                    reader.readAsText(file);
                }
            );
        });

        // 3. CLEAR DB
        element.querySelector('#btn-clear-db')?.addEventListener('click', () => {
            showModal(
                'Vaciar Base de Datos',
                'Esta acción es IRREVERSIBLE. Eliminará todas las facturas, clientes, productos y transacciones. ¿Deseas continuar?',
                'btn-danger',
                async () => {
                    try {
                        await emptyDatabase();
                        showAlert('<i class="bi bi-check-circle me-1"></i>Base de datos IndexedDB vaciada correctamente.', 'success');
                    } catch (error) {
                        console.error(error);
                        showAlert(`Error al vaciar DB: ${error.message}`, 'danger');
                    }
                }
            );
        });
    }
};
