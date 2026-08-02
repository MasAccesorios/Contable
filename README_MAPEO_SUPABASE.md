# Mapeo de Esquema: Frontend (UI) vs Postgres (Supabase)

Este documento sirve como referencia rápida y estricta para cruzar cómo se nombran las variables en el estado y componentes de Javascript (camelCase) y cómo existen realmente en la base de datos Postgres (snake_case). 

Esto evitará errores de `column does not exist` al escribir sentencias SQL directas o diseñar nuevas vistas.

## 1. Reglas Globales de Mapeo
*   Todos los **IDs** en Javascript son manejados como `String` (para compatibilidad con React/UUID/Firestore legado), pero en Postgres todas las llaves primarias (`id`) y foráneas (`_id`) son `BIGINT`.
*   El campo universal `notas` en el frontend se mapea a `observaciones` en Postgres en casi todas las tablas (excepto en `pagos_ingresos` donde no existe).

## 2. Mapeos Específicos por Tabla

### Tabla: `contactos`
| Campo Frontend (UI) | Campo Real Postgres | Notas Adicionales |
|---------------------|---------------------|-------------------|
| `nit`               | `identificacion`    | Clave principal de identificación fiscal |
| `cupoCredito`       | `cupo_credito`      | |
| `plazosPago`        | `plazos_pago`       | |
| -                   | `estado`            | Por defecto `'active'` (Ojo: no 'activo') |
| -                   | `created_at`        | |

### Tabla: `facturas` y `cotizaciones`
| Campo Frontend (UI) | Campo Real Postgres | Notas Adicionales |
|---------------------|---------------------|-------------------|
| `clienteId`         | `contacto_id`       | Llave foránea hacia la tabla `contactos` |
| `notas`             | `observaciones`     | Texto libre |
| `terminosCondiciones`| -                  | No existe en BD (se asume vacío) |
| `fecha`             | `fecha`             | Formato DATE estricto (no strings vacíos) |
| `vencimiento`       | `vencimiento`       | Formato DATE estricto (no strings vacíos) |

### Tabla: `factura_detalles` y `cotizacion_detalles`
*(En JS se manipulan como el array `detalles` dentro del documento)*
| Campo Frontend (UI) | Campo Real Postgres | Notas Adicionales |
|---------------------|---------------------|-------------------|
| `productoId`        | `producto_id`       | Llave foránea hacia la tabla `productos` |
| `precio`            | `precio_unitario`   | |
| `descuento`         | `descuento_porcentaje` | |
| `cantidad`          | `cantidad`          | |
| `subtotal`          | `subtotal`          | |

### Tabla: `pagos_ingresos` (Alias: `transacciones`, `pagos`)
| Campo Frontend (UI) | Campo Real Postgres | Notas Adicionales |
|---------------------|---------------------|-------------------|
| `referenciaId`      | `factura_id`        | Llave foránea hacia la tabla `facturas` |
| `cuentaId`          | `cuenta_id`         | Llave foránea hacia la tabla `cuentas_bancarias` |
| `tipo`              | `tipo`              | JS envía `'ingreso'` o `'egreso'`, Postgres guarda `'in'` o `'out'` |
| `notas`             | -                   | Se ignora al guardar en BD |

### Tabla: `lotes_fifo`
| Campo Frontend (UI) | Campo Real Postgres | Notas Adicionales |
|---------------------|---------------------|-------------------|
| `productoId`        | `producto_id`       | Llave foránea hacia la tabla `productos` |
| `fechaIngreso`      | `fecha_ingreso`     | |
| `cantidadInicial`   | `cantidad_inicial`  | |
| `cantidadActual`    | `cantidad_actual`   | |
| `costoUnitario`     | `costo_unitario`    | |
