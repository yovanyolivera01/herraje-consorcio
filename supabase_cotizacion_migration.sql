-- ============================================================
-- Migracion: Sistema de Cotizacion de Vidrio
-- Herraje Consorcio — ejecutar en el SQL Editor de Supabase
-- ============================================================

-- 1. Tonos de vidrio
CREATE TABLE IF NOT EXISTS cot_tono (
  id     SERIAL PRIMARY KEY,
  nombre VARCHAR(50)  NOT NULL,
  activo BOOLEAN DEFAULT true
);

-- 2. Espesores
CREATE TABLE IF NOT EXISTS cot_espesor (
  id        SERIAL PRIMARY KEY,
  valor_mm  DECIMAL(5,2) NOT NULL,
  etiqueta  VARCHAR(20)  NOT NULL,
  activo    BOOLEAN DEFAULT true
);

-- 3. Tipos de vidrio (combinacion tono + espesor)
CREATE TABLE IF NOT EXISTS cot_tipo_vidrio (
  id            SERIAL PRIMARY KEY,
  id_tono       INT REFERENCES cot_tono(id),
  id_espesor    INT REFERENCES cot_espesor(id),
  clave         VARCHAR(30)  NOT NULL,
  descripcion   VARCHAR(100),
  hoja_largo_cm DECIMAL(8,2) NOT NULL,
  hoja_ancho_cm DECIMAL(8,2) NOT NULL,
  activo        BOOLEAN DEFAULT true,
  UNIQUE(id_tono, id_espesor)
);

-- 4. Niveles de precio
CREATE TABLE IF NOT EXISTS cot_nivel_precio (
  id               SERIAL PRIMARY KEY,
  nombre           VARCHAR(50)  NOT NULL,
  descripcion      VARCHAR(100),
  es_hoja_completa BOOLEAN DEFAULT false,
  activo           BOOLEAN DEFAULT true
);

-- 5. Precio por tipo + nivel
CREATE TABLE IF NOT EXISTS cot_precio_vidrio (
  id              SERIAL PRIMARY KEY,
  id_tipo_vidrio  INT REFERENCES cot_tipo_vidrio(id),
  id_nivel_precio INT REFERENCES cot_nivel_precio(id),
  precio_m2       DECIMAL(10,2) NOT NULL,
  UNIQUE(id_tipo_vidrio, id_nivel_precio)
);

-- 6. Unidades de cobro
CREATE TABLE IF NOT EXISTS cot_unidad_cobro (
  id          SERIAL PRIMARY KEY,
  nombre      VARCHAR(20) NOT NULL,
  descripcion VARCHAR(50)
);

-- 7. Procesos adicionales (pulido, biselado, etc.)
CREATE TABLE IF NOT EXISTS cot_proceso (
  id               SERIAL PRIMARY KEY,
  nombre           VARCHAR(100) NOT NULL,
  id_unidad_cobro  INT REFERENCES cot_unidad_cobro(id),
  precio_unitario  DECIMAL(10,2) NOT NULL,
  activo           BOOLEAN DEFAULT true
);

-- 8. Clientes
CREATE TABLE IF NOT EXISTS cot_cliente (
  id               SERIAL PRIMARY KEY,
  nombre           VARCHAR(100) NOT NULL,
  telefono         VARCHAR(20),
  correo           VARCHAR(100),
  id_nivel_precio  INT REFERENCES cot_nivel_precio(id),
  activo           BOOLEAN DEFAULT true,
  fecha_registro   TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Cotizaciones (cabecera)
CREATE TABLE IF NOT EXISTS cot_cotizacion (
  id              SERIAL PRIMARY KEY,
  folio           VARCHAR(20)   NOT NULL UNIQUE,
  id_cliente      INT REFERENCES cot_cliente(id),
  id_nivel_precio INT NOT NULL REFERENCES cot_nivel_precio(id),
  fecha           TIMESTAMPTZ DEFAULT NOW(),
  total           DECIMAL(12,2) DEFAULT 0,
  estatus         TEXT DEFAULT 'BORRADOR' CHECK (estatus IN ('BORRADOR','FINALIZADA','CANCELADA')),
  observaciones   VARCHAR(255)
);

-- 10. Partidas de cotizacion
CREATE TABLE IF NOT EXISTS cot_partida (
  id                  SERIAL PRIMARY KEY,
  id_cotizacion       INT REFERENCES cot_cotizacion(id) ON DELETE CASCADE,
  id_tipo_vidrio      INT REFERENCES cot_tipo_vidrio(id),
  piezas              INT           NOT NULL DEFAULT 1,
  largo_cm            DECIMAL(8,2)  NOT NULL,
  ancho_cm            DECIMAL(8,2)  NOT NULL,
  metros2             DECIMAL(10,4) NOT NULL,
  precio_m2_aplicado  DECIMAL(10,2) NOT NULL,
  subtotal_vidrio     DECIMAL(12,2) NOT NULL,
  subtotal_procesos   DECIMAL(12,2) DEFAULT 0,
  subtotal_partida    DECIMAL(12,2) NOT NULL
);

-- 11. Procesos por partida
CREATE TABLE IF NOT EXISTS cot_partida_proceso (
  id              SERIAL PRIMARY KEY,
  id_partida      INT REFERENCES cot_partida(id) ON DELETE CASCADE,
  id_proceso      INT REFERENCES cot_proceso(id),
  cantidad        DECIMAL(10,4) NOT NULL,
  precio_unitario DECIMAL(10,2) NOT NULL,
  subtotal        DECIMAL(12,2) NOT NULL
);

-- ============================================================
-- Datos iniciales
-- ============================================================

-- Unidades de cobro
INSERT INTO cot_unidad_cobro (nombre, descripcion) VALUES
  ('m2', 'Metro cuadrado'),
  ('ml', 'Metro lineal')
ON CONFLICT DO NOTHING;

-- Niveles de precio
INSERT INTO cot_nivel_precio (nombre, descripcion, es_hoja_completa) VALUES
  ('Publico',       'Precio publico general',       false),
  ('Carpintero',    'Precio carpinteros',            false),
  ('Vidriero',      'Precio vidrieros/mayoreo',      false),
  ('Hoja completa', 'Precio por hoja de fabrica',    true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- Habilitar Row Level Security (opcional pero recomendado)
-- Descomenta las siguientes lineas si usas RLS en tu proyecto:
-- ============================================================
-- ALTER TABLE cot_tono           ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE cot_espesor        ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE cot_tipo_vidrio    ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE cot_nivel_precio   ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE cot_precio_vidrio  ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE cot_unidad_cobro   ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE cot_proceso        ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE cot_cliente        ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE cot_cotizacion     ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE cot_partida        ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE cot_partida_proceso ENABLE ROW LEVEL SECURITY;
--
-- CREATE POLICY "anon_all" ON cot_tono            FOR ALL USING (true);
-- CREATE POLICY "anon_all" ON cot_espesor         FOR ALL USING (true);
-- CREATE POLICY "anon_all" ON cot_tipo_vidrio     FOR ALL USING (true);
-- CREATE POLICY "anon_all" ON cot_nivel_precio    FOR ALL USING (true);
-- CREATE POLICY "anon_all" ON cot_precio_vidrio   FOR ALL USING (true);
-- CREATE POLICY "anon_all" ON cot_unidad_cobro    FOR ALL USING (true);
-- CREATE POLICY "anon_all" ON cot_proceso         FOR ALL USING (true);
-- CREATE POLICY "anon_all" ON cot_cliente         FOR ALL USING (true);
-- CREATE POLICY "anon_all" ON cot_cotizacion      FOR ALL USING (true);
-- CREATE POLICY "anon_all" ON cot_partida         FOR ALL USING (true);
-- CREATE POLICY "anon_all" ON cot_partida_proceso FOR ALL USING (true);
