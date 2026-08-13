-- Cancelación de CFDI: tabla propia para el registro/acuse de cada
-- cancelación (motivo, sustitución, acuse de Facturama), separada de
-- factura_cfdi (que solo guarda la emisión). factura_cfdi.status ya
-- existía (default 'active') — se reutiliza para marcar 'cancelled'.

CREATE TABLE IF NOT EXISTS factura_cancelada (
  id_factura_cancelada SERIAL PRIMARY KEY,
  id_factura           INTEGER NOT NULL REFERENCES factura_cfdi(id_factura) ON DELETE CASCADE,
  uuid_cfdi             VARCHAR(40) NOT NULL,
  motivo                VARCHAR(2) NOT NULL,
  uuid_sustitucion      VARCHAR(40),
  status_cancelacion    VARCHAR(20),
  acuse_xml_base64      TEXT,
  fecha_cancelacion     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_factura_cancelada_id_factura ON factura_cancelada(id_factura);

CREATE OR REPLACE FUNCTION public.sp_cancelar_factura(
    p_id_factura        integer,
    p_uuid_cfdi         character varying,
    p_motivo            character varying,
    p_uuid_sustitucion  character varying,
    p_status_cancelacion character varying,
    p_acuse_xml_base64  text,
    OUT p_id_factura_cancelada integer,
    OUT p_mensaje              text
)
 RETURNS record
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF p_id_factura IS NULL OR p_uuid_cfdi IS NULL OR p_uuid_cfdi = '' THEN
        p_id_factura_cancelada := NULL;
        p_mensaje              := 'ERROR: falta id_factura o uuid_cfdi.';
        RETURN;
    END IF;

    INSERT INTO factura_cancelada (
        id_factura, uuid_cfdi, motivo, uuid_sustitucion, status_cancelacion, acuse_xml_base64
    ) VALUES (
        p_id_factura, p_uuid_cfdi, p_motivo, NULLIF(p_uuid_sustitucion, ''), p_status_cancelacion, p_acuse_xml_base64
    ) RETURNING id_factura_cancelada INTO p_id_factura_cancelada;

    UPDATE factura_cfdi SET status = 'cancelled' WHERE id_factura = p_id_factura;

    p_mensaje := 'OK: cancelación registrada correctamente.';

EXCEPTION WHEN OTHERS THEN
    p_id_factura_cancelada := NULL;
    p_mensaje              := 'ERROR: ' || SQLERRM;
END;
$function$;
