-- supabase_schema.sql
-- Generado desde information_schema (proyecto oejeqszwxuucgotvdrmk) el 2026-08-28
-- Reemplaza version anterior desincronizada. Solo estructura (schema-only), sin datos.
-- NOTA: constraints (PK/FK/UNIQUE/CHECK) e indexes no se incluyen aqui;
-- este dump cubre columnas/tipos/defaults/nullability via information_schema.columns.
-- Para DDL completo con constraints, ver Supabase Dashboard > Database > Tables.

CREATE TABLE ajustes_inventario (
    id bigint NOT NULL,
    numero bigint NOT NULL DEFAULT nextval('ajustes_inventario_seq'::regclass),
    fecha date DEFAULT CURRENT_DATE,
    observaciones text,
    detalles jsonb,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE categorias_contables (
    id bigint NOT NULL,
    nombre text NOT NULL,
    tipo_flujo text NOT NULL,
    estado text NOT NULL DEFAULT 'activa',
    created_at timestamptz DEFAULT now()
);

CREATE TABLE comisiones (
    id bigint NOT NULL,
    factura_id bigint NOT NULL,
    vendedor_id bigint NOT NULL,
    monto numeric NOT NULL,
    estado text NOT NULL DEFAULT 'pendiente',
    cuenta_id bigint,
    fecha_pago date,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE conciliaciones (
    id bigint NOT NULL,
    banco_id bigint,
    fecha_desde date NOT NULL,
    fecha_hasta date NOT NULL,
    saldo_bancario numeric(14,2) NOT NULL DEFAULT 0,
    saldo_sistema numeric(14,2) NOT NULL DEFAULT 0,
    diferencia numeric(14,2) NOT NULL DEFAULT 0,
    fecha_guardado timestamptz DEFAULT now(),
    movimientos_conciliados bigint[] DEFAULT '{}'
);

CREATE TABLE contactos (
    id bigint NOT NULL,
    nombre varchar(255) NOT NULL,
    identificacion varchar(100),
    telefono varchar(100),
    email varchar(255),
    tipo varchar(50) DEFAULT 'cliente',
    estado varchar(50) DEFAULT 'active',
    created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
    ciudad varchar(255),
    direccion text,
    regimen varchar(100) DEFAULT 'Regimen Simplificado',
    cupo_credito numeric(15,2) DEFAULT 0,
    plazos_pago integer DEFAULT 0,
    es_cliente boolean DEFAULT true,
    es_proveedor boolean DEFAULT false,
    vendedor_id bigint
);

CREATE TABLE contadores_documentos (
    tabla text NOT NULL,
    siguiente_numero bigint NOT NULL
);

CREATE TABLE cotizacion_detalles (
    id bigint NOT NULL,
    cotizacion_id bigint,
    producto_id bigint,
    cantidad integer NOT NULL DEFAULT 1,
    precio_unitario numeric(15,2) NOT NULL DEFAULT 0,
    descuento_porcentaje numeric(5,2) DEFAULT 0,
    subtotal numeric(15,2) NOT NULL DEFAULT 0,
    descripcion_personalizada text
);

CREATE TABLE cotizaciones (
    id bigint NOT NULL,
    numero bigint NOT NULL,
    fecha date NOT NULL,
    vencimiento date,
    contacto_id bigint,
    total numeric(15,2) DEFAULT 0,
    estado varchar(50) DEFAULT 'draft',
    observaciones text,
    created_at timestamptz DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE cuentas_bancarias (
    id bigint NOT NULL,
    nombre varchar(255) NOT NULL,
    tipo varchar(50) DEFAULT 'cash',
    saldo_inicial numeric(15,2) DEFAULT 0,
    estado varchar(50) DEFAULT 'active',
    created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
    numero_cuenta varchar(100)
);

CREATE TABLE cuentas_cobro (
    id bigint NOT NULL,
    numero integer NOT NULL DEFAULT nextval('cuentas_cobro_numero_seq'::regclass),
    fecha date NOT NULL,
    fecha_vencimiento date,
    cliente_razon_social text NOT NULL,
    cliente_nit text,
    cliente_direccion text,
    cliente_ciudad text,
    cliente_telefono text,
    cliente_email text,
    forma_pago text DEFAULT 'Contado',
    medio_pago text DEFAULT 'Instrumento no definido',
    detalles jsonb NOT NULL DEFAULT '[]',
    subtotal numeric(14,2) DEFAULT 0,
    impuestos numeric(14,2) DEFAULT 0,
    total numeric(14,2) DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE factura_detalles (
    id bigint NOT NULL,
    factura_id bigint,
    producto_id bigint,
    cantidad integer NOT NULL DEFAULT 1,
    precio_unitario numeric(15,2) NOT NULL DEFAULT 0,
    descuento_porcentaje numeric(5,2) DEFAULT 0,
    subtotal numeric(15,2) NOT NULL DEFAULT 0,
    descripcion_personalizada text
);

CREATE TABLE facturas (
    id bigint NOT NULL,
    numero bigint NOT NULL,
    fecha date NOT NULL,
    vencimiento date,
    contacto_id bigint,
    total numeric(15,2) DEFAULT 0,
    estado varchar(50) DEFAULT 'open',
    observaciones text,
    created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
    saldo_original numeric,
    cotizacion_origen_id bigint,
    tipo varchar(20) DEFAULT 'venta',
    total_costo numeric(15,2) DEFAULT 0,
    vendedor_id bigint
);

CREATE TABLE lotes_fifo (
    id bigint NOT NULL,
    producto_id bigint,
    cantidad_inicial numeric(15,4) NOT NULL,
    cantidad_actual numeric(15,4) NOT NULL,
    costo_unitario numeric(15,2) NOT NULL,
    fecha_ingreso date NOT NULL,
    referencia varchar(255),
    created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
    origen_movimiento text
);

CREATE TABLE lotes_fifo_movimientos (
    id bigint NOT NULL DEFAULT nextval('lotes_fifo_movimientos_id_seq'::regclass),
    lote_id bigint,
    producto_id bigint NOT NULL,
    tipo_operacion text NOT NULL,
    cantidad_anterior numeric(15,4),
    cantidad_nueva numeric(15,4),
    diferencia numeric(15,4),
    origen_documento text,
    referencia_lote varchar,
    creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE nanocarbon_factores_corte (
    producto_id bigint NOT NULL,
    metros_por_unidad numeric(10,4) NOT NULL
);

CREATE TABLE nota_credito_detalles (
    id bigint NOT NULL,
    nota_credito_id bigint,
    producto_id bigint,
    cantidad numeric,
    precio_unitario numeric,
    subtotal numeric
);

CREATE TABLE notas_credito (
    id bigint NOT NULL,
    numero bigint,
    factura_id bigint,
    contacto_id bigint,
    fecha date DEFAULT CURRENT_DATE,
    motivo text,
    total numeric,
    estado varchar DEFAULT 'activa',
    observaciones text,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE pagos_ingresos (
    id bigint NOT NULL,
    numero bigint,
    fecha date NOT NULL,
    monto numeric(15,2) NOT NULL,
    cuenta_id bigint,
    contacto_id bigint,
    factura_id bigint,
    tipo varchar(50) DEFAULT 'in',
    estado varchar(50) DEFAULT 'open',
    observaciones text,
    created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
    categoria varchar,
    referencia varchar,
    grupo_pago_id text,
    conciliado_en timestamptz,
    conciliacion_id bigint
);

CREATE TABLE productos (
    id bigint NOT NULL,
    sku varchar(100),
    nombre varchar(255) NOT NULL,
    costo_base numeric(15,2) DEFAULT 0,
    precio_venta numeric(15,2) DEFAULT 0,
    stock_minimo integer DEFAULT 5,
    estado varchar(50) DEFAULT 'active',
    created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
    impuesto numeric DEFAULT 0
);

CREATE TABLE vendedores (
    id bigint NOT NULL,
    nombre text NOT NULL,
    telefono text,
    porcentaje_comision numeric NOT NULL DEFAULT 10,
    estado text NOT NULL DEFAULT 'activo',
    created_at timestamptz NOT NULL DEFAULT now()
);
