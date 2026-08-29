# Manual Técnico - Aplicación Contable MAS Accesorios

> **Nota:** Este documento es la ÚNICA fuente de verdad para la arquitectura de la aplicación. Cualquier diseño previo ha sido descartado en favor de esta arquitectura basada en Vanilla JS + Supabase + PostgreSQL.

## 1. Arquitectura de Datos
*   **Base de datos principal:** PostgreSQL alojada en Supabase (Reglas de acceso mediante RLS).
*   **Base de datos local (Caché):** Conexión directa a Supabase.

## 2. Flujo de Sincronización (Startup Sync)
Al iniciar la aplicación, el orden de carga es el siguiente:
1. `app.js` inicializa la interfaz y verifica la sesión actual en Supabase.
2. `db.js` realiza las consultas iniciales a PostgreSQL.
3. Los datos en memoria reflejan el estado real de la base de datos sin usar migraciones de datos legados.

## 3. Guía de Ajustes en Procesos Críticos

### A. Cómo agregar un nuevo campo a una Factura o Movimiento Bancario:
1. Define el campo en el formulario HTML (`index.html`).
2. En `js/pages.js`, dentro de la función recolectora del formulario, añade la propiedad al objeto JSON de la transacción.
3. En `js/db.js`, dentro del método de guardado correspondiente (ej. `registerPagoProveedor`), añade validación de tipo para el nuevo campo para asegurar que los datos coincidan con el esquema de PostgreSQL.

### B. Cómo depurar problemas de sincronización en caliente:
1. Revisa en la consola de red (Network) que las peticiones a la API REST de Supabase devuelvan respuestas HTTP exitosas.
2. Verifica en el panel de control de Supabase que las políticas RLS permitan la operación solicitada.
