-- Table: puestos

CREATE TABLE IF NOT EXISTS puestos (
  id_puesto   SERIAL PRIMARY KEY,
  nombre      VARCHAR(60) NOT NULL,
  descripcion VARCHAR(200),
  plazas      INTEGER NOT NULL DEFAULT 0,
  salario     NUMERIC(10,2) NOT NULL,
  hora_extra  NUMERIC(10,2) NOT NULL,
  id_estado   INTEGER NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: turno

CREATE TABLE IF NOT EXISTS turno (
  id_turno     SERIAL PRIMARY KEY,
  hora_inicio  TIME NOT NULL,
  hora_fin     TIME NOT NULL,
  tolerancia   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: empleado_salario (salary history, one open-ended row per employee at a time)

ALTER TABLE empleados ADD COLUMN IF NOT EXISTS apellido_materno VARCHAR(60);
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS apellido_paterno VARCHAR(60);
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS id_puesto INTEGER REFERENCES puestos(id_puesto);
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS id_turno  INTEGER REFERENCES turno(id_turno);
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS calle             VARCHAR(100);
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS ciudad            VARCHAR(60);
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS colonia           VARCHAR(100);
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS cp                VARCHAR(10);
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS huella            TEXT;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS id_estado         INTEGER NOT NULL DEFAULT 1;


---

CREATE TABLE IF NOT EXISTS registro (
  id_registro   SERIAL PRIMARY KEY,
  id_empleado   INTEGER NOT NULL REFERENCES empleados(empleado_id),
  id_turno      INTEGER REFERENCES turno(id_turno),
  fecha         DATE NOT NULL DEFAULT CURRENT_DATE,
  hora_llegada  TIME NOT NULL DEFAULT CURRENT_TIME,
  hora_salida   TIME,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


---
CREATE TABLE IF NOT EXISTS hora_extra (
  id_hora_extra SERIAL PRIMARY KEY,
  id_empleado   INTEGER NOT NULL REFERENCES empleados(empleado_id),
  fecha         DATE NOT NULL DEFAULT CURRENT_DATE,
  horas         NUMERIC(5,2) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

---

-- Table: salario (salary history, one open-ended row per employee at a time)

CREATE TABLE IF NOT EXISTS salario (
  id_salario    SERIAL PRIMARY KEY,
  id_empleado   INTEGER NOT NULL REFERENCES empleados(empleado_id),
  sueldo        NUMERIC(10,2) NOT NULL,
  fecha_inicio  DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_fin     DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only one open (fecha_fin IS NULL) salary row allowed per employee at a time
CREATE UNIQUE INDEX IF NOT EXISTS uq_salario_actual
  ON salario (id_empleado)
  WHERE fecha_fin IS NULL;

---

-- Table: nomina (monto a pagar a un empleado por periodo, reuniendo sueldo base,
-- horas extra y deducciones en un solo registro)

CREATE TABLE IF NOT EXISTS nomina (
  id_nomina     SERIAL PRIMARY KEY,
  id_empleado   INTEGER NOT NULL REFERENCES empleados(empleado_id),
  fecha_inicio  DATE NOT NULL,
  fecha_fin     DATE NOT NULL,
  sueldo_base   NUMERIC(10,2) NOT NULL,
  horas_extra   NUMERIC(5,2)  NOT NULL DEFAULT 0,
  monto_extra   NUMERIC(10,2) NOT NULL DEFAULT 0,
  deducciones   NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_pagar   NUMERIC(10,2) NOT NULL,
  fecha_pago    DATE,
  metodo_pago   VARCHAR(20),
  referencia_pago VARCHAR(60),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

---

-- Table: catalogo_incidencia (tipos de incidencia: falta, retardo, permiso,
-- incapacidad, vacaciones, etc.)

CREATE TABLE IF NOT EXISTS catalogo_incidencia (
  id_catalogo_incidencia SERIAL PRIMARY KEY,
  descripcion            VARCHAR(60) NOT NULL UNIQUE
);

-- Table: incidencia (reportada a un empleado; fecha_inicio = fecha_fin para
-- incidencias de un solo dia)

CREATE TABLE IF NOT EXISTS incidencia (
  id_incidencia          SERIAL PRIMARY KEY,
  id_empleado            INTEGER NOT NULL REFERENCES empleados(empleado_id),
  id_catalogo_incidencia INTEGER NOT NULL REFERENCES catalogo_incidencia(id_catalogo_incidencia),
  fecha_inicio           DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_fin              DATE,
  observaciones          VARCHAR(300),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

---

-- Reporte: horas de ausencia por empleado/dia, ultimos 60 dias.
-- Compara lo programado (turno) contra lo real (registro) y marca los dias
-- cubiertos por una incidencia (permiso, incapacidad, vacaciones, etc.).
-- No es una tabla — es un reporte calculado, se recalcula solo en cada consulta.
CREATE OR REPLACE VIEW v_horas_ausencia AS
SELECT
  e.empleado_id                                                         AS id_empleado,
  d.fecha,
  t.id_turno,
  ROUND(EXTRACT(EPOCH FROM (t.hora_fin - t.hora_inicio)) / 3600.0, 2)   AS horas_programadas,
  ROUND(COALESCE(EXTRACT(EPOCH FROM (r.hora_salida - r.hora_llegada)) / 3600.0, 0), 2) AS horas_trabajadas,
  ROUND(GREATEST(
    EXTRACT(EPOCH FROM (t.hora_fin - t.hora_inicio)) / 3600.0
      - COALESCE(EXTRACT(EPOCH FROM (r.hora_salida - r.hora_llegada)) / 3600.0, 0),
    0
  ), 2)                                                                  AS horas_ausencia,
  (r.id_registro IS NULL)                                               AS sin_registro,
  ci.descripcion                                                        AS tipo_incidencia
FROM (SELECT generate_series(CURRENT_DATE - INTERVAL '60 days', CURRENT_DATE, INTERVAL '1 day')::date AS fecha) d
CROSS JOIN empleados e
JOIN turno t
  ON t.id_turno = e.id_turno
LEFT JOIN registro r
  ON r.id_empleado = e.empleado_id AND r.fecha = d.fecha
LEFT JOIN incidencia i
  ON i.id_empleado = e.empleado_id
  AND d.fecha BETWEEN i.fecha_inicio AND COALESCE(i.fecha_fin, i.fecha_inicio)
LEFT JOIN catalogo_incidencia ci
  ON ci.id_catalogo_incidencia = i.id_catalogo_incidencia
WHERE e.id_turno IS NOT NULL
  AND e.id_estado = 1;

---

CREATE OR REPLACE VIEW v_puestos AS
  SELECT id_puesto, nombre, descripcion, plazas,salario,hora_extra, id_estado
  FROM puestos
  ORDER BY id_puesto DESC;

CREATE OR REPLACE FUNCTION public.sp_create_puesto(
  p_nombre      VARCHAR,
  p_descripcion VARCHAR,
  p_salario     NUMERIC,
  p_hora_extra  NUMERIC,
  p_plazas      INTEGER DEFAULT 0,
  p_estado      INTEGER DEFAULT 1
)
RETURNS puestos AS $$
DECLARE
  v_puesto puestos;
BEGIN
  INSERT INTO puestos (nombre, descripcion, salario, hora_extra, plazas, id_estado)
  VALUES (p_nombre, p_descripcion, p_salario, p_hora_extra, p_plazas, p_estado)
  RETURNING * INTO v_puesto;

  RETURN v_puesto;
END;
$$ LANGUAGE plpgsql;

--- update puesto record, returning the updated record. If no record is found, returns null.

CREATE OR REPLACE FUNCTION public.sp_update_puesto(
  p_id_puesto    INTEGER,
  p_nombre       VARCHAR,
  p_descripcion  VARCHAR,
  p_salario      NUMERIC,
  p_hora_extra   NUMERIC,
  p_plazas       INTEGER DEFAULT 0,
  p_estado       INTEGER DEFAULT 1
)
RETURNS puestos AS
$$
DECLARE
 v_puesto puestos;
BEGIN
  UPDATE puestos
  SET
      nombre = p_nombre,
      descripcion = p_descripcion,
      salario = p_salario,
      hora_extra = p_hora_extra,
      plazas = p_plazas,
      id_estado = p_estado,
      updated_at = NOW()
  WHERE id_puesto = p_id_puesto
  RETURNING * INTO v_puesto;

  RETURN v_puesto;
END;
$$ LANGUAGE plpgsql;


-- drop puesto record, returning the deleted record. If no record is found, returns null.

CREATE OR REPLACE FUNCTION public.sp_delete_puesto(
  p_id_puesto INTEGER
)
RETURNS puestos AS
$$
DECLARE
  v_puesto puestos;
BEGIN
  DELETE FROM puestos
  WHERE id_puesto = p_id_puesto
  RETURNING * INTO v_puesto;

  RETURN v_puesto;
END;
$$ LANGUAGE plpgsql;


--- funtion of TURNO 

CREATE OR REPLACE FUNCTION public.sp_create_turno(
  
p_id_turno   
p_hora_inicio
p_hora_fin   
p_tolerancia 
p_created_at 
p_updated_at 

RETURNS turno AS $$
DECLARE
  v_turno turno;
BEGIN
  INSERT INTO turno (hora_inicio, hora_fin, tolerancia)
  VALUES (p_hora_inicio, p_hora_fin, p_tolerancia)
  RETURNING * INTO v_turno;

  RETURN v_turno;
END;

)