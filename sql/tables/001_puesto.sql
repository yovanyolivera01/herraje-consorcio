-- Table: puestos

CREATE TABLE IF NOT EXISTS puestos (
  id_puesto   SERIAL PRIMARY KEY,
  nombre      VARCHAR(20) NOT NULL,
  descripcion VARCHAR(20),
  plazas      INTEGER NOT NULL DEFAULT 0,
  id_estado   INTEGER NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- Table: empleado_salario (salary history, one open-ended row per employee at a time)

CREATE TABLE IF NOT EXISTS empleado_salario (
  id_empleado_salario SERIAL PRIMARY KEY,
  empleado_id   INTEGER NOT NULL REFERENCES empleados(empleado_id),
  sueldo        NUMERIC(10,2) NOT NULL,
  fecha_inicio  DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_fin     DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only one open (fecha_fin IS NULL) salary row allowed per employee at a time
CREATE UNIQUE INDEX IF NOT EXISTS uq_empleado_salario_actual
  ON empleado_salario (empleado_id)
  WHERE fecha_fin IS NULL;

CREATE OR REPLACE VIEW v_puestos AS
  SELECT id_puesto, nombre, descripcion, plazas, id_estado
  FROM puestos
  ORDER BY id_puesto DESC;

CREATE OR REPLACE FUNCTION  public.sp_create_puesto 
(

    p_nombre CHARACTER varying,
    p_descripcion CHARACTER varying,
    p_plazas  CHARACTER(2) varying default 0,
    p_estado CHARACTER (2) varying default 1,


)
