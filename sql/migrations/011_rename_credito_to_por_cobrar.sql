-- Rename tipo_pago enum value 'CREDITO' to 'POR COBRAR'

-- Rename the enum value (automatically updates all rows in pedido that use it)
ALTER TYPE tipo_pago_t RENAME VALUE 'CREDITO' TO 'POR COBRAR';

-- Update the catalog table
UPDATE tipo_pago SET descripcion = 'POR COBRAR' WHERE descripcion = 'CREDITO';

-- Replace old view with renamed version
DROP VIEW IF EXISTS v_pedidos_credito;

CREATE OR REPLACE VIEW v_pedidos_por_cobrar AS
SELECT
    p.id_pedido,
    p.folio,
    p.fecha_creacion,
    COALESCE(c.nombre, 'Mostrador') AS cliente,
    p.total,
    p.monto_anticipo,
    (p.total - p.monto_anticipo) AS saldo,
    p.estatus,
    CASE WHEN EXISTS (
        SELECT 1 FROM partida_pedido_maquila ppm WHERE ppm.id_pedido = p.id_pedido
    ) THEN 'MAQUILA' ELSE 'VIDRIO' END AS tipo
FROM pedido p
LEFT JOIN cliente c ON c.id_cliente = p.id_cliente
WHERE p.tipo_pago::text = 'POR COBRAR';
