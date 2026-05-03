-- ══════════════════════════════════════════════════════════════════════════
-- Migración: Empresas, precios especiales por cliente y empresa
-- Ejecutar en la base de datos PostgreSQL herraje_consorcio
-- ══════════════════════════════════════════════════════════════════════════

-- ── 1. Columna tipo en proceso (para BARRENO, SAQUE, etc.) ───────────────
ALTER TABLE proceso
  ADD COLUMN IF NOT EXISTS tipo VARCHAR(20);

-- ── 2. Columna piezas en partida_cotizacion ──────────────────────────────
ALTER TABLE partida_cotizacion
  ADD COLUMN IF NOT EXISTS piezas INTEGER NOT NULL DEFAULT 1;

-- ── 3. Tabla empresa ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS empresa (
  id_empresa   SERIAL PRIMARY KEY,
  nombre       VARCHAR(150) NOT NULL,
  razon_social VARCHAR(200),
  rfc          VARCHAR(20),
  telefono     VARCHAR(20),
  correo       VARCHAR(100),
  direccion    TEXT,
  activo       BOOLEAN NOT NULL DEFAULT true,
  creado_en    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 4. Tabla cliente_empresa (un cliente pertenece a una empresa) ─────────
CREATE TABLE IF NOT EXISTS cliente_empresa (
  id_cliente_empresa SERIAL PRIMARY KEY,
  id_cliente         INTEGER NOT NULL REFERENCES cliente(id_cliente) ON DELETE CASCADE,
  id_empresa         INTEGER NOT NULL REFERENCES empresa(id_empresa) ON DELETE CASCADE,
  activo             BOOLEAN NOT NULL DEFAULT true,
  desde              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(id_cliente)
);

-- ── 5. Tabla precio_empresa (precios especiales por empresa) ─────────────
CREATE TABLE IF NOT EXISTS precio_empresa (
  id_precio_empresa SERIAL PRIMARY KEY,
  id_empresa        INTEGER NOT NULL REFERENCES empresa(id_empresa) ON DELETE CASCADE,
  id_tipo_vidrio    INTEGER REFERENCES tipo_vidrio(id_tipo_vidrio) ON DELETE CASCADE,
  id_proceso        INTEGER REFERENCES proceso(id_proceso) ON DELETE CASCADE,
  precio_m2         NUMERIC(10,2) NOT NULL,
  activo            BOOLEAN NOT NULL DEFAULT true,
  actualizado_en    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(id_empresa, id_tipo_vidrio, id_proceso)
);

-- ── 6. Tabla precio_cliente_registrado (precios especiales por cliente) ───
CREATE TABLE IF NOT EXISTS precio_cliente_registrado (
  id_precio_cliente SERIAL PRIMARY KEY,
  id_cliente        INTEGER NOT NULL REFERENCES cliente(id_cliente) ON DELETE CASCADE,
  id_tipo_vidrio    INTEGER REFERENCES tipo_vidrio(id_tipo_vidrio) ON DELETE CASCADE,
  id_proceso        INTEGER REFERENCES proceso(id_proceso) ON DELETE CASCADE,
  precio_m2         NUMERIC(10,2) NOT NULL,
  activo            BOOLEAN NOT NULL DEFAULT true,
  actualizado_en    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(id_cliente, id_tipo_vidrio, id_proceso)
);

-- ── 7. Tabla precio_proceso_especial (precio proceso sin diferenciar espesor)
CREATE TABLE IF NOT EXISTS precio_proceso_especial (
  id_precio_proceso_especial SERIAL PRIMARY KEY,
  id_proceso                 INTEGER NOT NULL REFERENCES proceso(id_proceso) ON DELETE CASCADE,
  id_nivel_precio            INTEGER NOT NULL REFERENCES nivel_precio(id_nivel_precio) ON DELETE CASCADE,
  precio_unitario            NUMERIC(10,2) NOT NULL,
  UNIQUE(id_proceso, id_nivel_precio)
);
