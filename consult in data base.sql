


select * from tipo_vidrio
select * from precio_vidrio
select * from  nivel_precio



select * from proceso_partida_pedido



select tipo_vidrio.clave, precio_vidrio.precio_m2, nivel_precio.nombre from tipo_vidrio
    inner join precio_vidrio
        on precio_vidrio.id_tipo_vidrio = tipo_vidrio.id_tipo_vidrio
    inner join nivel_precio on nivel_precio.id_nivel_precio =  precio_vidrio.id_nivel_precio
    order by precio_m2

select * from unidad_cobro
select * from proceso


select * from precio_proceso


 SELECT
    proceso.nombre,
    precio_proceso.precio_unitario,
    unidad_cobro.nombre,
    unidad_cobro.descripcion
FROM proceso
left join  precio_proceso
    ON precio_proceso.id_proceso = proceso.id_proceso
INNER JOIN unidad_cobro
    ON unidad_cobro.id_unidad_cobro = proceso.id_unidad_cobro;

