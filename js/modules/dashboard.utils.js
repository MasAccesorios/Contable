// js/modules/dashboard.utils.js
// Utilidades de resiliencia para el Dashboard: prevención de race conditions de JWT y reintento automático ante 401.

const _pendingRefreshes = new WeakMap();

/**
 * Determina si un error de Supabase/PostgREST corresponde a un fallo de autenticación o JWT expirado.
 */
export function isAuthError(err) {
    if (!err) return false;
    if (err.status === 401 || err.statusCode === 401) return true;
    const code = String(err.code || '').toUpperCase();
    if (code === 'PGRST301' || code === 'PGRST302' || code === '401') return true;
    const msg = String(err.message || err.error_description || '').toLowerCase();
    return msg.includes('jwt') || msg.includes('unauthorized') || msg.includes('invalid claim') || msg.includes('401');
}

/**
 * Ejecuta refreshSession deduplicado por cliente para evitar múltiples rotaciones simultáneas de refresh_token.
 */
function deduplicatedRefresh(supabaseClient) {
    if (!supabaseClient?.auth?.refreshSession) return Promise.resolve(null);
    const existing = _pendingRefreshes.get(supabaseClient);
    if (existing) return existing;

    const promise = Promise.resolve()
        .then(() => supabaseClient.auth.refreshSession())
        .catch(() => null)
        .finally(() => {
            _pendingRefreshes.delete(supabaseClient);
        });

    _pendingRefreshes.set(supabaseClient, promise);
    return promise;
}

/**
 * Garantiza que la sesión activa tenga vigencia suficiente antes de disparar consultas paralelas.
 */
export async function ensureFreshSession(supabaseClient, thresholdSeconds = 60) {
    if (!supabaseClient?.auth?.getSession) return null;
    const { data } = await supabaseClient.auth.getSession();
    const session = data?.session;
    if (!session) return null;

    const expiresAtMs = (session.expires_at || 0) * 1000;
    if (expiresAtMs > 0 && expiresAtMs - Date.now() < thresholdSeconds * 1000) {
        const refreshed = await deduplicatedRefresh(supabaseClient);
        return refreshed?.data?.session || session;
    }
    return session;
}

/**
 * Ejecuta una función RPC de Supabase con reintento automático único tras refrescar sesión si falla por 401/JWT.
 */
export async function executeRpcWithRetry(supabaseClient, fnName, params = {}) {
    const first = await supabaseClient.rpc(fnName, params);
    if (!first?.error) {
        return first?.data;
    }

    if (!isAuthError(first.error)) {
        throw first.error;
    }

    await deduplicatedRefresh(supabaseClient);
    const second = await supabaseClient.rpc(fnName, params);
    if (second?.error) {
        throw second.error;
    }
    return second?.data;
}
