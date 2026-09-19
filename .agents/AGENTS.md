# Reglas de Trabajo para Contable

## Trabajo Local
* **Regla:** Todo cambio se trabaja en una rama nueva (`feat/...`, `fix/...`, `chore/...`), nunca directo en `main`.
* **Push:** Se puede hacer `git push` de la rama de trabajo a GitHub libremente, siempre que sea a una rama distinta de `main`. Nunca hacer push directo a `main`.
* **Merge a main:** Solo se hace merge a `main` con autorización explícita del usuario, después de que valide los cambios.
* **Verificación:** Después de cada push, reporta el hash del commit y el resultado exacto de `git log -1`, sin resumir ni interpretar.
* **PROHIBIDO EL USO DEL NAVEGADOR:** NUNCA usar `browser_subagent` ni herramientas de navegador. El usuario realiza y valida personalmente todas las pruebas en navegador y consola.

## Reglas de Negocio y Módulos Financieros
Antes de dar por terminada cualquier tarea sobre bancos, pagos, cartera o inventario:
1. No dupliques campos ni funciones que ya existan en `shared/crud.js` o `core/db.js`.
2. Todo movimiento de dinero (abono, pago, gasto) debe crear un registro en `transacciones` (`movimientos_banco`) con `cuentaId` explícito — nunca editar el saldo del banco directamente.
3. Antes de sincronizar o importar datos, verifica que no exista ya un registro con el mismo `alegra_invoice_id` o id de pago, para evitar duplicados.
4. Al terminar, corre (o describe cómo correr) una validación que sume los movimientos de cada banco y la compare contra el saldo mostrado, y reporta si no cuadra.
5. No crees archivos nuevos tipo `_v2`, `_backup`, `_old`, `_copy` — si hay que reemplazar un archivo, edítalo o bórralo explícitamente, y dilo.

## Estilo de Comunicación y Ahorro de Créditos
* **Ahorro de créditos (MANDATORIO):** Respuestas ultra concisas, directas al grano, sin explicaciones redundantes, sin preámbulos ni conclusiones innecesarias. Ve directo a los datos/código solicitados.

## Memoria Técnica de Correcciones y Rendimiento (2026-09-13)
1. **Scroll Horizontal en iOS / Móviles (Tablas y Grid):**
   - En `.dash-layout`, usar siempre `grid-template-columns: minmax(0, 1fr)` en lugar de `1fr` plano. `1fr` tiene `min-width: auto` implícito y se expande forzado por tablas hijas anchas, rompiendo el ancho de pantalla en móviles.
   - En columnas Bootstrap, `.row > [class*="col-"]` debe tener `min-width: 0` en móvil para habilitar el shrink en Flexbox y permitir que `.table-responsive` active scroll horizontal real.
   - En `.table-responsive`, forzar `overflow-x: scroll`, `-webkit-overflow-scrolling: touch`, `-webkit-transform: translateZ(0)` y `will-change: scroll-position` para momentum táctil en WebKit/iOS Safari.
   - Al tocar CSS en producción, incrementar cache-bust en `index.html` (`css/styles.css?v=...`).

2. **Optimización de Consultas Supabase (Paralelización):**
   - No ejecutar consultas independientes en cascada secuencial (`await` tras `await`). Usar `Promise.all` para lanzar en paralelo roundtrips independientes.
   - `renderDetalle` (`productos.js`): `DB.get('productos')`, `lotes_fifo` y `factura_detalles` corren en paralelo en el paso 1; `contactos` y `pagos_ingresos` en paralelo en el paso 2.
   - `renderForm` (`ventas.js`): `pagos_ingresos` y `notas_credito` en paralelo; luego `DB.getAll('contactos')`, `cliente`, `productos`, `vendedores` y `cuentas_bancarias` en paralelo (eliminando lecturas duplicadas de `contactos`).
