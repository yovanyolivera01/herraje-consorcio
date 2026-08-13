-- IN PRODUCTION

CREATE OR REPLACE FUNCTION public.sp_insertar_factura_cfdi(
    p_id_pedido       integer,
    p_folio_pedido    character varying,
    p_uuid_cfdi       character varying,
    p_serie           character varying,
    p_folio_cfdi      character varying,
    p_rfc_receptor    character varying,
    p_nombre_receptor character varying,
    p_total           numeric,
    OUT p_id_factura  integer,
    OUT p_mensaje     text
)
 RETURNS record
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF p_uuid_cfdi IS NULL OR p_uuid_cfdi = '' THEN
        p_id_factura := NULL;
        p_mensaje    := 'ERROR: falta el UUID del CFDI.';
        RETURN;
    END IF;

    INSERT INTO factura_cfdi (
        id_pedido, folio_pedido, uuid_cfdi, serie, folio_cfdi,
        rfc_receptor, nombre_receptor, total
    ) VALUES (
        p_id_pedido, p_folio_pedido, p_uuid_cfdi, p_serie, p_folio_cfdi,
        p_rfc_receptor, p_nombre_receptor, p_total
    ) RETURNING id_factura INTO p_id_factura;

    p_mensaje := 'OK: factura registrada correctamente.';

EXCEPTION WHEN OTHERS THEN
    p_id_factura := NULL;
    p_mensaje    := 'ERROR: ' || SQLERRM;
END;
$function$;
