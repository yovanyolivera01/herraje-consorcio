-- ═══════════════════════════════════════════════════════════════════════
--  Paso 1: permitir pedidos sin cotización previa
-- ═══════════════════════════════════════════════════════════════════════
ALTER TABLE pedido ALTER COLUMN id_cotizacion DROP NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════
--  SP: sp_crear_pedido_directo
--  Crea un pedido directamente sin pasar por cotización.
--  Ejecutar en Supabase → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION sp_crear_pedido_directo(
  p_id_cliente      INT,       -- NULL = mostrador
  p_id_nivel_precio INT,
  p_tipo_pago       TEXT,      -- 'LIQUIDADO' | 'ANTICIPO'
  p_monto_anticipo  NUMERIC,
  p_partidas        JSONB      -- array de partidas con procesos embebidos
)
RETURNS TABLE(out_id_pedido INT, out_folio TEXT, out_mensaje TEXT)
LANGUAGE plpgsql
AS $$
DECLARE
  v_id_pedido  INT;
  v_folio      TEXT;
  v_saldo      NUMERIC;
  v_total      NUMERIC := 0;
  v_partida    JSONB;
  v_proceso    JSONB;
  v_id_partida INT;
BEGIN

  -- Calcular total sumando subtotales de partidas
  FOR v_partida IN SELECT * FROM jsonb_array_elements(p_partidas)
  LOOP
    v_total := v_total + (v_partida->>'subtotal_partida')::NUMERIC;
  END LOOP;

  -- Saldo pendiente
  v_saldo := CASE
    WHEN p_tipo_pago = 'LIQUIDADO' THEN 0
    ELSE v_total - p_monto_anticipo
  END;

  -- Insertar cabecera del pedido (folio temporal)
  INSERT INTO pedido (
    folio,
    fecha_creacion,
    id_cliente,
    id_nivel_precio,
    id_cotizacion,        -- NULL: pedido directo sin cotización
    total,
    tipo_pago,
    monto_anticipo,
    saldo_pendiente,
    estatus
  ) VALUES (
    'PED-00000',
    NOW(),
    p_id_cliente,
    p_id_nivel_precio,
    NULL,
    v_total,
    p_tipo_pago::tipo_pago_t,
    p_monto_anticipo,
    v_saldo,
    (CASE WHEN p_tipo_pago = 'LIQUIDADO' THEN 'ENTREGADO' ELSE 'PENDIENTE' END)::estatus_pedido_t
  )
  RETURNING id_pedido INTO v_id_pedido;

  -- Folio definitivo
  v_folio := 'PED-' || LPAD(v_id_pedido::TEXT, 5, '0');
  UPDATE pedido SET folio = v_folio WHERE id_pedido = v_id_pedido;

  -- Insertar cada partida
  FOR v_partida IN SELECT * FROM jsonb_array_elements(p_partidas)
  LOOP
    INSERT INTO partida_pedido (
      id_pedido,
      id_tipo_vidrio,
      largo_cm,
      ancho_cm,
      cantidad,
      metros_cuadrados,
      precio_m2,
      subtotal_vidrio,
      subtotal_procesos,
      total_partida
    ) VALUES (
      v_id_pedido,
      (v_partida->>'id_tipo_vidrio')::INT,
      (v_partida->>'largo_cm')::NUMERIC,
      (v_partida->>'ancho_cm')::NUMERIC,
      (v_partida->>'piezas')::INT,
      (v_partida->>'metros2')::NUMERIC,
      (v_partida->>'precio_m2_aplicado')::NUMERIC,
      (v_partida->>'subtotal_vidrio')::NUMERIC,
      (v_partida->>'subtotal_procesos')::NUMERIC,
      (v_partida->>'subtotal_partida')::NUMERIC
    )
    RETURNING id_partida_pedido INTO v_id_partida;

    -- Insertar procesos de la partida
    IF jsonb_array_length(COALESCE(v_partida->'procesos', '[]'::JSONB)) > 0 THEN
      FOR v_proceso IN SELECT * FROM jsonb_array_elements(v_partida->'procesos')
      LOOP
        INSERT INTO partida_proceso_pedido (
          id_partida_pedido,
          id_proceso,
          id_unidad_cobro,
          cantidad_unidades,
          precio_unitario,
          subtotal
        ) VALUES (
          v_id_partida,
          (v_proceso->>'id_proceso')::INT,
          (v_proceso->>'id_unidad_cobro')::INT,
          (v_proceso->>'cantidad')::NUMERIC,
          (v_proceso->>'precio_unitario')::NUMERIC,
          (v_proceso->>'subtotal')::NUMERIC
        );
      END LOOP;
    END IF;

  END LOOP;

  RETURN QUERY SELECT v_id_pedido, v_folio, 'OK'::TEXT;

EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT NULL::INT, NULL::TEXT, ('ERROR: ' || SQLERRM)::TEXT;
END;
$$;
