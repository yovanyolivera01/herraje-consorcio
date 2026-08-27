-- Table: puestos

CREATE TABLE IF NOT EXISTS puestos (
  id_puesto   SERIAL PRIMARY KEY,
  nombre      VARCHAR(20) NOT NULL,
  descripcion VARCHAR(20),
  plazas      INTEGER NOT NULL DEFAULT 0,
  salario     INTEGER NOT NULL,
  hora_extra  Integer not null,
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

CREATE OR REPLACE VIEW v_puestos AS
  SELECT id_puesto, nombre, descripcion, plazas, id_estado
  FROM puestos
  ORDER BY id_puesto DESC;

CREATE OR REPLACE FUNCTION public.sp_create_puesto(
  p_nombre      VARCHAR,
  p_descripcion VARCHAR,
  p_plazas      INTEGER DEFAULT 0,
  p_estado      INTEGER DEFAULT 1
)
RETURNS puestos AS $$
DECLARE
  v_puesto puestos;
BEGIN
  INSERT INTO puestos (nombre, descripcion, plazas, id_estado)
  VALUES (p_nombre, p_descripcion, p_plazas, p_estado)
  RETURNING * INTO v_puesto;

  RETURN v_puesto;
END;
$$ LANGUAGE plpgsql;
