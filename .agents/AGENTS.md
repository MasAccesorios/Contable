# Reglas de Trabajo para Contable

## Trabajo Local
* **Regla:** Todo cambio se trabaja en una rama nueva (`feat/...`, `fix/...`, `chore/...`), nunca directo en `main`.
* **Push:** Se puede hacer `git push` de la rama de trabajo a GitHub libremente, siempre que sea a una rama distinta de `main`. Nunca hacer push directo a `main`.
* **Merge a main:** Solo se hace merge a `main` con autorización explícita del usuario, después de que valide los cambios.
* **Verificación:** Después de cada push, reporta el hash del commit y el resultado exacto de `git log -1`, sin resumir ni interpretar.

## Reglas de Negocio y Módulos Financieros
Antes de dar por terminada cualquier tarea sobre bancos, pagos, cartera o inventario:
1. No dupliques campos ni funciones que ya existan en `shared/crud.js` o `core/db.js`.
2. Todo movimiento de dinero (abono, pago, gasto) debe crear un registro en `transacciones` (`movimientos_banco`) con `cuentaId` explícito — nunca editar el saldo del banco directamente.
3. Antes de sincronizar o importar datos, verifica que no exista ya un registro con el mismo `alegra_invoice_id` o id de pago, para evitar duplicados.
4. Al terminar, corre (o describe cómo correr) una validación que sume los movimientos de cada banco y la compare contra el saldo mostrado, y reporta si no cuadra.
5. No crees archivos nuevos tipo `_v2`, `_backup`, `_old`, `_copy` — si hay que reemplazar un archivo, edítalo o bórralo explícitamente, y dilo.
6. **Esquema de Contactos (created_at vs fechaCreacion):** La tabla `contactos` en Supabase genera automáticamente la fecha de creación con `created_at timestamptz DEFAULT CURRENT_TIMESTAMP`. Nunca enviar `fechaCreacion` ni campos que no existan en la tabla Postgres.
7. **Soft-delete de Contactos (estado='inactive'):** La acción "Eliminar" en contactos es un soft-delete (`estado: 'inactive'`). Toda consulta, selector o buscador (`globalSearch`, `combobox`, etc.) que liste contactos para flujos activos debe excluir contactos inactivos con `.neq('estado', 'inactive')` o `estado != 'inactive'`.
8. **Estado en Cuentas Bancarias ('active' vs 'activo'):** En la tabla `cuentas_bancarias` el valor por defecto es `'active'` (inglés). En el frontend, al filtrar cuentas activas usar siempre `c.estado === 'active' || c.estado === 'activo'` para garantizar compatibilidad total.
9. **Título Canónico de Pantalla (.page-title):** En encabezados de módulo o vista principal, usar siempre `<h1 class="page-title">` o `<h2 class="page-title">` (definido en `css/styles.css` con tipografía responsiva). No usar clases tipo `h3 fw-bold mb-1` ni estilos inline de color para títulos de pantalla.
10. **Contenedor Único de Tablas (.dash-table-container):** El estándar del proyecto para grillas y listados es `.dash-table-container`. No usar `ds-table-container` ni añadir clases redundantes `ds-table-header` a los `<thead>`.
11. **Ordenamiento en Conciliación Bancaria:** El listado de movimientos de extracto en conciliación se ordena siempre por `fecha` descendente (los más recientes primero) para facilitar la verificación y auditoría.

