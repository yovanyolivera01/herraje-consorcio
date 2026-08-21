-- Table: estatus (generic active/inactive status catalog)

CREATE TABLE IF NOT EXISTS estatus (
  id_estado   INTEGER PRIMARY KEY,
  nombre      VARCHAR(30) NOT NULL UNIQUE,
  descripcion VARCHAR(30) NOT NULL
);

INSERT INTO estatus (id_estado, nombre, descripcion) VALUES
  (0, 'INACTIVO', 'Inactivo'),
  (1, 'ACTIVO', 'Activo')
ON CONFLICT (id_estado) DO NOTHING;

-- puestos.id_estado defaults to 1 (ACTIVO, seeded above) before this FK exists,
-- so the constraint is added here rather than inline in 001_puesto.sql.
ALTER TABLE puestos
  ADD CONSTRAINT fk_puestos_estado FOREIGN KEY (id_estado) REFERENCES estatus(id_estado);
