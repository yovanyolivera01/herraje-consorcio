-- Table: anticipos_pedidos
-- Un pedido puede recibir varios anticipos (abonos). Cada fila es un pago.
-- id_cliente es opcional porque hay pedidos sin cliente registrado
-- (venta de mostrador).

CREATE TABLE IF NOT EXISTS anticipos_pedidos (
  id_anticipo     SERIAL PRIMARY KEY,
  id_pedido       INTEGER NOT NULL REFERENCES pedido(id_pedido) ON DELETE CASCADE,
  id_cliente      INTEGER REFERENCES cliente(id_cliente) ON DELETE SET NULL,
  id_metodo_pago  INTEGER NOT NULL REFERENCES metodo_pago(id_metodo_pago),
  monto           NUMERIC(12,2) NOT NULL CHECK (monto > 0),
  fecha_hora      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Folio de transferencia o ultimos digitos de tarjeta, para conciliar con el banco
  referencia      VARCHAR(60),
  observaciones   VARCHAR(300),
  -- 1 = ACTIVO, 0 = CANCELADO. Un anticipo equivocado se cancela, no se borra,
  -- para no perder el historial de dinero recibido.
  id_estado       INTEGER NOT NULL DEFAULT 1 REFERENCES estatus(id_estado),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Si la tabla ya existia (CREATE TABLE IF NOT EXISTS no la modifica), agrega/ajusta columnas
ALTER TABLE anticipos_pedidos ADD COLUMN IF NOT EXISTS referencia VARCHAR(60);
ALTER TABLE anticipos_pedidos ALTER COLUMN observaciones TYPE VARCHAR(300);

CREATE INDEX IF NOT EXISTS ix_anticipos_pedidos_pedido  ON anticipos_pedidos (id_pedido);
CREATE INDEX IF NOT EXISTS ix_anticipos_pedidos_cliente ON anticipos_pedidos (id_cliente);


-- Resumen por pedido: cuanto se ha abonado (solo anticipos activos) y cuanto falta.
CREATE OR REPLACE VIEW v_pedido_anticipos AS
SELECT  
  p.id_pedido,
  p.id_cliente,
  p.total,
  COALESCE(SUM(a.monto), 0)                   AS total_anticipos,
  p.total - COALESCE(SUM(a.monto), 0)         AS saldo,
  COUNT(a.id_anticipo)                        AS num_anticipos,
  MAX(a.fecha_hora)                           AS ultimo_anticipo
FROM pedido p
LEFT JOIN anticipos_pedidos a
  ON a.id_pedido = p.id_pedido
  AND a.id_estado = 1
GROUP BY p.id_pedido, p.id_cliente, p.total;



-- Descuenta un abono del saldo del pedido.
-- Si el saldo llega a 0 y el pedido sigue sin entregar (PENDIENTE o PARCIAL),
-- lo pasa a ANTICIPO_LIQUIDADO (pagado, falta entregar), igual que sp_marcar_anticipo_liquidado.
-- Lanza error si el pedido no existe, esta cancelado o el monto es mayor al saldo.
CREATE OR REPLACE FUNCTION sp_descontar_anticipo_pedido(
  p_id_pedido INTEGER,
  p_monto     NUMERIC(12,2)
) RETURNS NUMERIC AS $$
DECLARE
  v_saldo   NUMERIC(12,2);
  v_estatus VARCHAR(50);
BEGIN
  -- FOR UPDATE bloquea el pedido para que dos abonos al mismo tiempo no descuenten de mas
  SELECT saldo_pendiente, estatus INTO v_saldo, v_estatus
  FROM pedido
  WHERE id_pedido = p_id_pedido
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido % no encontrado', p_id_pedido;
  END IF;
  IF v_estatus = 'CANCELADO' THEN
    RAISE EXCEPTION 'El pedido % esta cancelado', p_id_pedido;
  END IF;
  IF p_monto IS NULL OR p_monto <= 0 THEN
    RAISE EXCEPTION 'El monto debe ser mayor a 0';
  END IF;
  IF p_monto > COALESCE(v_saldo, 0) THEN
    RAISE EXCEPTION 'El monto (%) es mayor al saldo pendiente (%)', p_monto, COALESCE(v_saldo, 0);
  END IF;

  UPDATE pedido
  SET monto_anticipo  = COALESCE(monto_anticipo, 0) + p_monto,
      saldo_pendiente = saldo_pendiente - p_monto,
      estatus = CASE
                  WHEN saldo_pendiente - p_monto = 0 AND estatus IN ('PENDIENTE', 'PARCIAL')
                  THEN 'ANTICIPO_LIQUIDADO'
                  ELSE estatus
                END
  WHERE id_pedido = p_id_pedido
  RETURNING saldo_pendiente INTO v_saldo;

  RETURN v_saldo;  -- saldo que queda
END;
$$ LANGUAGE plpgsql;



CREATE OR REPLACE FUNCTION sp_insert_anticipo_pedido(
  p_id_pedido INTEGER,
  p_id_cliente INTEGER,
  p_id_metodo_pago INTEGER,
  p_monto NUMERIC(12,2),
  p_fecha_hora TIMESTAMPTZ,
  p_referencia VARCHAR(60),
  p_observaciones VARCHAR(300)
) RETURNS INTEGER AS $$
DECLARE
  v_id_anticipo INTEGER;
BEGIN
  -- Primero descuenta (valida y bloquea el pedido); si falla, no se guarda el anticipo
  PERFORM sp_descontar_anticipo_pedido(p_id_pedido, p_monto);


  INSERT INTO anticipos_pedidos (id_pedido, id_cliente, id_metodo_pago, monto, fecha_hora, referencia, observaciones)
  -- Si no mandan fecha, usa la hora actual (un NULL explicito no activa el DEFAULT)
  VALUES (p_id_pedido, p_id_cliente, p_id_metodo_pago, p_monto, COALESCE(p_fecha_hora, NOW()), p_referencia, p_observaciones)
  RETURNING id_anticipo INTO v_id_anticipo;

  RETURN v_id_anticipo;
END;
$$ LANGUAGE plpgsql;


