-- ================================================================
-- Productos Generales: Inventario + Venta en Herrajes
-- Ejecutar en Supabase SQL Editor DESPUÉS de sprint4_backend_production.sql
-- Es idempotente.
-- ================================================================

-- ── 1. Stock y proveedor en producto_general ─────────────────────

ALTER TABLE producto_general
  ADD COLUMN IF NOT EXISTS existencias  INTEGER NOT NULL DEFAULT 0;

ALTER TABLE producto_general
  ADD COLUMN IF NOT EXISTS proveedor_id INTEGER REFERENCES proveedores(id);

-- ── 2. detalle_venta soporta productos generales ─────────────────
-- Se agrega FK nullable a producto_general.
-- producto_id se vuelve nullable para filas de productos generales.
-- La restricción CHECK asegura que al menos uno esté presente.

ALTER TABLE detalle_venta
  ADD COLUMN IF NOT EXISTS id_producto_general INTEGER
    REFERENCES producto_general(id_producto_general);

ALTER TABLE detalle_venta
  ALTER COLUMN producto_id DROP NOT NULL;

-- Asegura que toda fila tenga al menos un producto referenciado
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'detalle_venta'
      AND constraint_name = 'detalle_venta_producto_check'
  ) THEN
    ALTER TABLE detalle_venta
      ADD CONSTRAINT detalle_venta_producto_check
      CHECK (producto_id IS NOT NULL OR id_producto_general IS NOT NULL);
  END IF;
END $$;

-- ── 3. Permitir NULL en movimientos_inventario para productos generales ──
-- El trigger de detalle_venta inserta en movimientos_inventario con
-- producto_id = NEW.producto_id. Para productos generales ese valor es NULL,
-- lo que viola la restricción NOT NULL original.

ALTER TABLE movimientos_inventario
  ALTER COLUMN producto_id             DROP NOT NULL;

ALTER TABLE movimientos_inventario
  ALTER COLUMN existencias_resultantes DROP NOT NULL;

-- ── 4. RLS para producto_general (por si acaso) ──────────────────

ALTER TABLE producto_general ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_anon" ON producto_general;
CREATE POLICY "allow_all_anon" ON producto_general
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ── Verificar ────────────────────────────────────────────────────
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name IN ('producto_general', 'detalle_venta')
--   AND column_name IN ('existencias', 'id_producto_general', 'producto_id')
-- ORDER BY table_name, column_name;
