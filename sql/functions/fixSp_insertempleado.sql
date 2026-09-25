-- activo (boolean) eliminado — id_estado (FK a estatus, 0=INACTIVO/1=ACTIVO)
-- es ahora la única fuente de verdad para saber si un empleado está activo.
DROP FUNCTION IF EXISTS public.sp_agregar_empleado(character varying, character varying, boolean, date, character varying, character varying, integer, integer, character varying, character varying, character varying, character varying, character varying, integer);

-- cara: descriptor facial (128 floats de face-api.js) guardado como texto
-- (JSON..stringify del array), igual que huella. Se agrega antes de las
-- funciones/vista de abajo porque ya la referencian.
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS cara TEXT;

-- La firma anterior de sp_agregar_empleado (sin p_cara) ya no aplica —
-- se quita explícitamente para poder recrearla con el parámetro nuevo.
DROP FUNCTION IF EXISTS public.sp_agregar_empleado(character varying, character varying, date, character varying, character varying, integer, integer, character varying, character varying, character varying, character varying, character varying, integer);

CREATE OR REPLACE FUNCTION public.sp_agregar_empleado(
    p_nombre character varying,
    p_telefono character varying,
    p_fecha_registro date,
    p_apellido_materno character varying,
    p_apellido_paterno character varying,
    p_id_puesto integer,
    p_id_turno integer,
    p_calle character varying,
    p_ciudad character varying,
    p_colonia character varying,
    p_cp character varying,
    p_huella character varying,
    p_cara character varying,
    p_id_estado integer
    )
RETURNS empleados AS
$$
DECLARE
    v_empleados empleados;
BEGIN

    INSERT INTO empleados(
        nombre, telefono, fecha_registro, apellido_materno, apellido_paterno, id_puesto, id_turno, calle, ciudad, colonia, cp, huella, cara, id_estado)
    VALUES (
        p_nombre, p_telefono, p_fecha_registro, p_apellido_materno, p_apellido_paterno, p_id_puesto, p_id_turno, p_calle, p_ciudad, p_colonia, p_cp, p_huella, p_cara, p_id_estado)
    RETURNING * INTO v_empleados;

    RETURN v_empleados;

END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE VIEW v_empleados AS
  SELECT empleado_id, nombre, telefono, fecha_registro, apellido_materno, apellido_paterno, id_puesto, id_turno, calle, ciudad, colonia, cp, huella, cara, id_estado
  FROM empleados
  WHERE id_estado = 1
  ORDER BY empleado_id DESC;


-- Misma razón: la firma anterior de sp_update_empleado (sin p_cara) se
-- quita para poder recrearla con el parámetro nuevo.
DROP FUNCTION IF EXISTS public.sp_update_empleado(integer, character varying, character varying, date, character varying, character varying, integer, integer, character varying, character varying, character varying, character varying, character varying, integer);

CREATE OR REPLACE FUNCTION sp_update_empleado(
    p_empleado_id integer,
    p_nombre character varying,
    p_telefono character varying,
    p_fecha_registro date,
    p_apellido_materno character varying,
    p_apellido_paterno character varying,
    p_id_puesto integer,
    p_id_turno integer,
    p_calle character varying,
    p_ciudad character varying,
    p_colonia character varying,
    p_cp character varying,
    p_huella character varying,
    p_cara character varying,
    p_id_estado integer
    )
RETURNS empleados AS
$$
DECLARE
    v_empleados empleados;
BEGIN

    UPDATE empleados
    SET
        nombre = p_nombre,
        telefono = p_telefono,
        fecha_registro = p_fecha_registro,
        apellido_materno = p_apellido_materno,
        apellido_paterno = p_apellido_paterno,
        id_puesto = p_id_puesto,
        id_turno = p_id_turno,
        calle = p_calle,
        ciudad = p_ciudad,
        colonia = p_colonia,
        cp = p_cp,
        huella = p_huella,
        cara = p_cara,
        id_estado = p_id_estado
    WHERE empleado_id = p_empleado_id
    RETURNING * INTO v_empleados;

    RETURN v_empleados;

END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION public.sp_obtener_empleados()
 RETURNS TABLE(empleado_id integer, nombre character varying, telefono character varying, fecha_registro timestamp without time zone)
 LANGUAGE sql
AS $function$
    SELECT empleado_id, nombre, telefono, fecha_registro
    FROM empleados
    WHERE id_estado = 1
    ORDER BY nombre;
$function$;


-- Ejecutar al final, después de que las funciones/vista de arriba ya no
-- referencian la columna — de lo contrario el DROP falla por dependencias.
ALTER TABLE empleados DROP COLUMN IF EXISTS activo;
