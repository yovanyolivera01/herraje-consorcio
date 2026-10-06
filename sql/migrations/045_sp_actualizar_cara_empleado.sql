-- Actualiza únicamente el descriptor facial (cara) de un empleado, sin tocar
-- el resto de sus datos. Pensada para un flujo de captura de rostro
-- independiente del formulario completo de edición (p.ej. un botón
-- "Capturar rostro" o un kiosco), que solo tiene a mano el empleado_id y el
-- descriptor nuevo — reutilizar sp_update_empleado obligaría a reenviar
-- todos los demás campos y arriesgaría pisar datos con valores viejos/stale.

CREATE OR REPLACE FUNCTION public.sp_actualizar_cara_empleado(
    p_empleado_id integer,
    p_cara        character varying
)
RETURNS empleados AS
$$
DECLARE
    v_empleado empleados;
BEGIN
    UPDATE empleados
    SET cara = p_cara
    WHERE empleado_id = p_empleado_id
    RETURNING * INTO v_empleado;

    RETURN v_empleado;
END;
$$ LANGUAGE plpgsql;
