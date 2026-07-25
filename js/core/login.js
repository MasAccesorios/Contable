import { auth, signInWithEmailAndPassword } from './firebase.js';

export function renderLogin(container) {
    container.innerHTML = `
        <div style="display: flex; justify-content: center; align-items: center; min-height: 80vh;">
            <div class="card shadow-sm" style="width: 100%; max-width: 400px; border-radius: 12px; border: 1px solid #e2e8f0;">
                <div class="card-body p-4">
                    <div class="text-center mb-4">
                        <img src="LogoMas.png" alt="Logo" style="height: 50px;">
                        <h4 class="mt-3 fw-bold" style="color: #0f172a;">Sistema Contable</h4>
                        <p class="text-muted small">Inicia sesión para continuar</p>
                    </div>
                    
                    <form id="login-form">
                        <div class="mb-3">
                            <label class="form-label text-muted small fw-bold">Correo Electrónico</label>
                            <input type="email" id="login-email" class="form-control" placeholder="admin@empresa.com" required>
                        </div>
                        <div class="mb-4">
                            <label class="form-label text-muted small fw-bold">Contraseña</label>
                            <input type="password" id="login-password" class="form-control" required>
                        </div>
                        
                        <div id="login-error" class="alert alert-danger d-none" style="font-size: 13px; padding: 10px;"></div>
                        
                        <button type="submit" id="btn-login" class="btn btn-primary w-100 fw-medium" style="background-color: #3b82f6; border: none; padding: 10px;">
                            Ingresar
                        </button>
                    </form>
                </div>
            </div>
        </div>
    `;

    const form = document.getElementById('login-form');
    const errorDiv = document.getElementById('login-error');
    const btn = document.getElementById('btn-login');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;
        
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Iniciando...';
        btn.disabled = true;
        errorDiv.classList.add('d-none');

        try {
            await signInWithEmailAndPassword(auth, email, password);
            // El éxito dispara onAuthStateChanged automáticamente en app.js
        } catch (error) {
            console.error("Error de login:", error);
            errorDiv.textContent = error.code === 'auth/invalid-credential' 
                ? 'Correo o contraseña incorrectos.' 
                : 'Ocurrió un error al intentar ingresar.';
            errorDiv.classList.remove('d-none');
            btn.innerHTML = 'Ingresar';
            btn.disabled = false;
        }
    });
}
