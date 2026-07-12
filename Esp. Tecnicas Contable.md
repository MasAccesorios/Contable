ESPECIFICACIONES TÉCNICAS  
Sistema Web de Gestión Comercial Simplificado (MVP)  
1\. ALCANCE DEL PROYECTO

Desarrollo de aplicación web para:  
Gestión de clientes  
Gestión de productos  
Registro de ventas  
Control automático de inventario  
Control de cartera  
Control de bancos  
Registro de gastos  
Dashboard financiero básico  
Sistema monousuario o multiusuario básico con roles simples.

2\. ARQUITECTURA DEL SISTEMA  
2.1 Tipo de aplicación  
Web App tradicional (NO SPA compleja)  
Arquitectura MVC  
Acceso vía navegador  
Responsive (adaptable a celular)  
2.2 Stack Tecnológico  
Backend:  
Laravel 11 (PHP 8.3)  
Frontend:  
Blade \+ Bootstrap 5  
JavaScript simple (sin framework pesado)  
Base de datos:  
MySQL 8+  
Servidor:  
Linux (Ubuntu)  
Apache o Nginx  
HTTPS (SSL obligatorio)  
Hosting:  
VPS básico (DigitalOcean / Hostinger / similar)

3\. CONTROL DE USUARIOS  
3.1 Tabla: usuarios  
Campos:  
id (PK)  
nombre  
email  
password (bcrypt)  
rol (admin / vendedor)  
estado (activo/inactivo)  
created\_at  
updated\_at  
3.2 Funcionalidades  
Login  
Logout  
Middleware por rol  
Solo admin puede:  
Crear usuarios  
Ver reportes globales

4\. MÓDULO CLIENTES  
4.1 Tabla: clientes  
Campos:  
id (PK)  
nombre  
documento  
telefono  
cupo\_credito (decimal)  
plazo\_dias (int)  
created\_at  
updated\_at

4.2 Funcionalidades  
Crear cliente  
Editar cliente  
Eliminar lógico (soft delete)  
Ver historial de ventas  
Ver saldo pendiente

5\. MÓDULO PRODUCTOS  
5.1 Tabla: productos  
Campos:  
id (PK)  
codigo  
nombre  
precio\_compra (decimal)  
precio\_venta (decimal)  
stock\_actual (int)  
stock\_minimo (int)  
created\_at  
updated\_at

5.2 Funcionalidades  
CRUD productos  
Ajuste manual de inventario  
Validación: no permitir venta si stock insuficiente  
Alerta visual si stock \< stock\_minimo

6\. MÓDULO VENTAS  
6.1 Tabla: ventas  
Campos:  
id (PK)  
cliente\_id (FK)  
tipo\_venta (contado / credito)  
total (decimal)  
total\_costo (decimal)  
utilidad (decimal calculado)  
fecha  
usuario\_id (FK)

6.2 Tabla: detalle\_ventas  
Campos:  
id (PK)  
venta\_id (FK)

producto\_id (FK)

Cantidad  
precio\_unitario  
costo\_unitario  
subtotal

6.3 Reglas de negocio  
Al registrar venta:  
Descontar stock automáticamente.  
Si tipo \= contado:

Generar movimiento banco ingreso.

Si tipo \= crédito:

Generar registro cartera.

Calcular utilidad automáticamente:  
utilidad \= (precio\_venta \- precio\_compra) × cantidad.

7\. MÓDULO CARTERA (Simplificado)

No se crea tabla compleja independiente.

7.1 Tabla: cartera

Campos:

id

venta\_id (FK)

cliente\_id (FK)

total

saldo

fecha\_vencimiento

estado (vigente / vencida / pagada)

7.2 Funcionalidades

Listado cartera

Filtro por:

Vigentes

Vencidas

Registrar abono:

Reduce saldo

Si saldo \= 0 → estado \= pagada

Calcular automáticamente vencimiento:  
fecha\_venta \+ plazo\_dias

8\. MÓDULO BANCOS  
8.1 Tabla: bancos

Campos:

id

nombre

saldo\_actual

created\_at

updated\_at

8.2 Tabla: movimientos\_banco

Campos:

id

banco\_id (FK)

tipo (ingreso / egreso)

monto

descripcion

referencia\_id (nullable)

fecha

8.3 Reglas

Venta contado → ingreso automático

Gasto → egreso automático

Abono cliente → ingreso automático

Saldo banco se recalcula por sumatoria, no se edita manualmente.

9\. MÓDULO GASTOS  
9.1 Tabla: gastos

Campos:

id

categoria

descripcion

monto

banco\_id (FK)

fecha

created\_at

9.2 Funcionalidades

Registrar gasto

Editar gasto

Eliminar gasto

Generar egreso automático en banco

Sin adjuntos.  
Sin centros de costo.

10\. DASHBOARD

Indicadores requeridos:

Ventas mes actual

Utilidad mes actual

Total cartera

Cartera vencida

Inventario valorizado:  
SUM(stock\_actual × precio\_compra)

Saldo total bancos

Consultas optimizadas con índices en:

fecha

cliente\_id

producto\_id

11\. REPORTES

Exportación Excel (.xlsx)

Reportes mínimos:

Ventas por rango fecha

Utilidad por rango fecha

Cartera por cliente

Inventario actual

Gastos por mes

12\. SEGURIDAD

Hash bcrypt

Middleware autenticación

Validación backend

CSRF protection

Sanitización inputs

Soft deletes

13\. RENDIMIENTO

Paginación en listados

Índices en claves foráneas

Tiempo respuesta \< 800ms promedio

14\. LIMITACIONES DEL MVP

No incluye:

Facturación electrónica

Integración DIAN

Multiempresa

App móvil

Integraciones externas

Contabilidad doble partida

16\. MÓDULO DE INTEGRACIÓN CON ALEGRA  
Objetivo

Permitir que el sistema se alimente automáticamente desde Alegra para importar:

Clientes

Productos

Ventas (facturas)

Pagos realizados

Opcional: Inventario

La aplicación propia funcionará como sistema de análisis, control y gestión avanzada, mientras Alegra seguirá siendo el sistema contable principal.

16.1 Tipo de Integración

Integración vía API REST oficial de Alegra.

Autenticación mediante API Key.

Sin scraping.

Sin automatización por navegador.

16.2 Método de Autenticación

API Key generada desde cuenta de Alegra.

Guardada en tabla configuracion\_integraciones.

Encriptada en base de datos.

Acceso solo para usuario Admin.

16.3 Tabla Nueva: integraciones

Campos:

id (PK)

proveedor (enum: alegra)

api\_key (encriptada)

estado (activo/inactivo)

ultima\_sincronizacion

created\_at

updated\_at

16.4 Sincronización de Datos

La sincronización será:

Manual (botón “Sincronizar ahora”)

Automática programada (cron cada X horas)

Recomendación MVP:  
Sincronización manual para reducir costos iniciales.

16.5 Sincronización de Clientes

Proceso:

Consultar endpoint clientes en Alegra.

Validar si cliente ya existe por:

Documento

Email

Si no existe → crear.

Si existe → actualizar datos básicos.

Campos sincronizados:

Nombre

Documento

Teléfono

Email

Dirección (opcional)

Cupo crédito (si aplica)

No se eliminan clientes automáticamente para evitar pérdida de datos.

16.6 Sincronización de Productos

Proceso:

Consultar productos en Alegra.

Validar por:

Código interno

Crear o actualizar.

Campos sincronizados:

Nombre

Código

Precio venta

Precio compra (si Alegra lo maneja)

Inventario disponible

Si el inventario se controla en Alegra, el sistema propio lo toma como referencia.

16.7 Sincronización de Ventas (Facturas)

Proceso:

Consultar facturas emitidas en Alegra.

Registrar venta local si no existe.

Crear detalle de venta.

Si factura está pagada → marcar como contado.

Si está pendiente → generar cartera.

Campos sincronizados:

Cliente

Fecha

Total

Estado

Productos

Cantidades

Identificación única:  
Se guardará alegra\_invoice\_id en tabla ventas para evitar duplicados.

16.8 Sincronización de Pagos

Consultar pagos aplicados en Alegra.

Aplicar automáticamente a cartera local.

Registrar movimiento en banco correspondiente.

16.9 Reglas de Negocio

Alegra será el sistema maestro.

La app propia no enviará información a Alegra (solo lectura).

No se editarán ventas importadas.

Si una venta se elimina en Alegra, se marcará como anulada en el sistema local.

Control de duplicados obligatorio.

16.10 Manejo de Errores

Log de sincronización

Registro de errores en tabla logs\_integracion

Mensaje claro si falla API

Campos tabla logs:

id

tipo

descripcion\_error

fecha

respuesta\_api

16.11 Seguridad

API key encriptada (Laravel encrypted cast)

Acceso solo admin

No mostrar API en frontend

Protección contra reintentos masivos

