# Manual Técnico - Aplicación Contable MAS Accesorios

## 1. Arquitectura de Datos
*   **Base de datos principal:** Firebase Realtime Database (Reglas de acceso privado: auth != null).
*   **Base de datos local (Caché):** IndexedDB para persistencia sin conexión.
*   **Origen de Datos Histórico:** `js/alegra_data.js` (Cargado en memoria global como `window.ALEGRA_SYNC_DATA`).

## 2. Flujo de Sincronización (Startup Sync)
Al iniciar la aplicación, el orden de carga es el siguiente:
1. `app.js` inicializa la interfaz y verifica la clave de sesión (`fb_secret`).
2. `db.js` descarga el JSON completo desde Firebase.
3. Si Firebase contiene datos válidos, sobrescribe y actualiza IndexedDB.
4. Si existen diferencias de registros locales huérfanos (por ejemplo, creados sin internet), se ejecuta la rutina de consolidación antes de renderizar.

## 3. Guía de Ajustes en Procesos Críticos

### A. Cómo agregar un nuevo campo a una Factura o Movimiento Bancario:
1. Define el campo en el formulario HTML (`index.html`).
2. En `js/pages.js`, dentro de la función recolectora del formulario, añade la propiedad al objeto JSON de la transacción.
3. En `js/db.js`, dentro del método de guardado correspondiente (ej. `registerPagoProveedor`), añade validación de tipo para el nuevo campo para asegurar que no se envíe como `undefined` (lo que causaría rechazo de Firebase).

### B. Cómo depurar problemas de sincronización en caliente:
1. Abre la consola de desarrollo (F12) en la pestaña "Application" -> "IndexedDB".
2. Borra la base de datos local para forzar a la aplicación a descargar un estado limpio desde Firebase.
3. Revisa en la consola de red (Network) que las peticiones HTTP terminen con el parámetro de autenticación correcto `?auth=TU_TOKEN`.
