import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
    isAuthError,
    ensureFreshSession,
    executeRpcWithRetry
} from '../js/modules/dashboard.utils.js';

describe('Dashboard Resilience - Auth Race Condition & RPC Retry', () => {

    describe('isAuthError', () => {
        it('debe detectar errores HTTP 401 y códigos PostgREST JWT', () => {
            assert.strictEqual(isAuthError({ status: 401, message: 'Unauthorized' }), true);
            assert.strictEqual(isAuthError({ statusCode: 401 }), true);
            assert.strictEqual(isAuthError({ code: 'PGRST301', message: 'JWT expired' }), true);
            assert.strictEqual(isAuthError({ message: 'Invalid JWT token' }), true);
        });

        it('no debe clasificar errores de red o SQL normales como errores de auth', () => {
            assert.strictEqual(isAuthError(null), false);
            assert.strictEqual(isAuthError({ status: 500, message: 'Internal server error' }), false);
            assert.strictEqual(isAuthError({ code: '42P01', message: 'relation does not exist' }), false);
        });
    });

    describe('ensureFreshSession', () => {
        it('no debe llamar refreshSession si la sesión aún tiene vigencia suficiente', async () => {
            let refreshCalls = 0;
            const futureExp = Math.floor(Date.now() / 1000) + 3600;
            const mockClient = {
                auth: {
                    getSession: async () => ({ data: { session: { expires_at: futureExp } }, error: null }),
                    refreshSession: async () => {
                        refreshCalls++;
                        return { data: { session: { expires_at: futureExp + 3600 } }, error: null };
                    }
                }
            };

            await ensureFreshSession(mockClient, 60);
            assert.strictEqual(refreshCalls, 0);
        });

        it('debe refrescar la sesión una sola vez ante llamadas concurrentes si el token está expirado o por vencer', async () => {
            let refreshCalls = 0;
            const expiredExp = Math.floor(Date.now() / 1000) - 10;
            const mockClient = {
                auth: {
                    getSession: async () => ({ data: { session: { expires_at: expiredExp } }, error: null }),
                    refreshSession: async () => {
                        refreshCalls++;
                        await new Promise(r => setTimeout(r, 20));
                        return { data: { session: { expires_at: expiredExp + 3600 } }, error: null };
                    }
                }
            };

            await Promise.all([
                ensureFreshSession(mockClient, 60),
                ensureFreshSession(mockClient, 60),
                ensureFreshSession(mockClient, 60)
            ]);

            assert.strictEqual(refreshCalls, 1);
        });
    });

    describe('executeRpcWithRetry', () => {
        it('debe reintentar automáticamente 1 vez tras refrescar sesión si el RPC devuelve 401', async () => {
            let rpcAttempts = 0;
            let refreshCalls = 0;
            const mockClient = {
                auth: {
                    refreshSession: async () => {
                        refreshCalls++;
                        return { data: { session: { access_token: 'new-token' } }, error: null };
                    }
                },
                rpc: async (fnName, params) => {
                    rpcAttempts++;
                    if (rpcAttempts === 1) {
                        return { data: null, error: { status: 401, message: 'JWT expired' } };
                    }
                    return { data: { ventas_mes: 8050841, fnName, params }, error: null };
                }
            };

            const result = await executeRpcWithRetry(mockClient, 'get_dashboard_kpis', { p_fecha_inicio: '2026-11-01' });
            assert.strictEqual(rpcAttempts, 2);
            assert.strictEqual(refreshCalls, 1);
            assert.strictEqual(result.ventas_mes, 8050841);
        });

        it('debe deduplicar refreshSession si múltiples RPCs paralelos fallan con 401 simultáneamente', async () => {
            let refreshCalls = 0;
            const attemptsByFn = {};
            const mockClient = {
                auth: {
                    refreshSession: async () => {
                        refreshCalls++;
                        await new Promise(r => setTimeout(r, 20));
                        return { data: { session: { access_token: 'new-token' } }, error: null };
                    }
                },
                rpc: async (fnName) => {
                    attemptsByFn[fnName] = (attemptsByFn[fnName] || 0) + 1;
                    if (attemptsByFn[fnName] === 1) {
                        return { data: null, error: { status: 401, message: 'Unauthorized' } };
                    }
                    return { data: { ok: true, fnName }, error: null };
                }
            };

            const [r1, r2] = await Promise.all([
                executeRpcWithRetry(mockClient, 'get_dashboard_kpis'),
                executeRpcWithRetry(mockClient, 'get_inventario_valorizado')
            ]);

            assert.strictEqual(refreshCalls, 1);
            assert.strictEqual(r1.ok, true);
            assert.strictEqual(r2.ok, true);
        });

        it('debe lanzar error sin reintentar si no es un error de autenticación', async () => {
            let rpcAttempts = 0;
            let refreshCalls = 0;
            const mockClient = {
                auth: {
                    refreshSession: async () => {
                        refreshCalls++;
                        return { data: {}, error: null };
                    }
                },
                rpc: async () => {
                    rpcAttempts++;
                    return { data: null, error: { status: 500, message: 'DB error' } };
                }
            };

            await assert.rejects(
                () => executeRpcWithRetry(mockClient, 'get_dashboard_kpis'),
                { message: 'DB error' }
            );
            assert.strictEqual(rpcAttempts, 1);
            assert.strictEqual(refreshCalls, 0);
        });
    });
});
