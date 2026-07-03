
create or replace view v_pedidos_credito as
Select
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
    from pedido p
    left join cliente c on c.id_cliente = p.id_cliente
    where p.tipo_pago = 'CREDITO'
