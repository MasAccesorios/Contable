# Reglas de Trabajo para Contable

## Trabajo Local
* **Regla:** A partir de ahora trabajaremos ÚNICAMENTE en local. Queda PROHIBIDO hacer `git push` o subir cambios de forma automática a GitHub sin autorización explícita del usuario.
* **Comandos obligatorios tras cambios:**
  Solamente hacer commits de respaldo si es estrictamente necesario o si el usuario lo pide. NUNCA hacer push sin permiso.
* **Objetivo:** Mantener el control local para pruebas antes de desplegar.

## Reglas de Negocio y Módulos Financieros
Antes de dar por terminada cualquier tarea sobre bancos, pagos, cartera o inventario:
1. No dupliques campos ni funciones que ya existan en `shared/crud.js` o `core/db.js`.
2. Todo movimiento de dinero (abono, pago, gasto) debe crear un registro en `transacciones` (`movimientos_banco`) con `cuentaId` explícito — nunca editar el saldo del banco directamente.
3. Antes de sincronizar o importar datos, verifica que no exista ya un registro con el mismo `alegra_invoice_id` o id de pago, para evitar duplicados.
4. Al terminar, corre (o describe cómo correr) una validación que sume los movimientos de cada banco y la compare contra el saldo mostrado, y reporta si no cuadra.
5. No crees archivos nuevos tipo `_v2`, `_backup`, `_old`, `_copy` — si hay que reemplazar un archivo, edítalo o bórralo explícitamente, y dilo.
