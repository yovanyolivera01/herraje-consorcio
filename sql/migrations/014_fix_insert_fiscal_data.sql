
---In production

DROP FUNCTION IF EXISTS public.sp_crear_cliente(character varying, character varying, character varying, integer);

CREATE OR REPLACE FUNCTION public.sp_crear_cliente
(
    p_nombre character varying,
    p_telefono character varying,
    p_correo character varying,
    p_id_nivel_precio integer,
    p_rfc character varying DEFAULT NULL,
    p_razon_social character varying DEFAULT NULL,
    p_cp_fiscal character(5) DEFAULT NULL,
    p_regimen_fiscal character varying DEFAULT NULL,
    p_uso_cfdi character varying DEFAULT NULL,
    OUT p_id_resultado integer,
    OUT p_mensaje text
)
 RETURNS record
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM nivel_precio
        WHERE id_nivel_precio = p_id_nivel_precio AND activo = TRUE
    ) THEN
        p_id_resultado := 0;
        p_mensaje      := 'El nivel de precio indicado no existe o está inactivo.';
    ELSE
        INSERT INTO cliente (nombre, telefono, correo, id_nivel_precio, rfc, razon_social, cp_fiscal, regimen_fiscal, uso_cfdi)
        VALUES (p_nombre, p_telefono, p_correo, p_id_nivel_precio, p_rfc, p_razon_social, p_cp_fiscal, p_regimen_fiscal, p_uso_cfdi)
        RETURNING id_cliente INTO p_id_resultado;

        p_mensaje := 'Cliente registrado correctamente.';
    END IF;
END;
$function$


DROP FUNCTION IF EXISTS public.sp_actualizar_cliente(integer, character varying, character varying, character varying, integer, boolean);

CREATE OR REPLACE FUNCTION public.sp_actualizar_cliente(
    p_id_cliente integer,
    p_nombre character varying,
    p_telefono character varying,
    p_correo character varying,
    p_id_nivel_precio integer,
    p_activo boolean,
    p_rfc character varying DEFAULT NULL,
    p_razon_social character varying DEFAULT NULL,
    p_cp_fiscal character(5) DEFAULT NULL,
    p_regimen_fiscal character varying DEFAULT NULL,
    p_uso_cfdi character varying DEFAULT NULL,
    OUT p_mensaje text)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM cliente WHERE id_cliente = p_id_cliente) THEN
        p_mensaje := 'Cliente no encontrado.';
    ELSE
        UPDATE cliente
        SET nombre          = p_nombre,
            telefono        = p_telefono,
            correo          = p_correo,
            id_nivel_precio = p_id_nivel_precio,
            activo          = p_activo,
            rfc             = p_rfc,
            razon_social    = p_razon_social,
            cp_fiscal       = p_cp_fiscal,
            regimen_fiscal  = p_regimen_fiscal,
            uso_cfdi        = p_uso_cfdi
        WHERE id_cliente = p_id_cliente;

        p_mensaje := 'Cliente actualizado correctamente.';
    END IF;
END;
$function$