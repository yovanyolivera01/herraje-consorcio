-- Run this once in your PostgreSQL database
CREATE TABLE IF NOT EXISTS factura_cfdi (
  id_factura       SERIAL PRIMARY KEY,
  id_pedido        INTEGER REFERENCES pedido(id_pedido) ON DELETE SET NULL,
  folio_pedido     VARCHAR(50),
  uuid_cfdi        VARCHAR(40) NOT NULL,
  serie            VARCHAR(10),
  folio_cfdi       VARCHAR(20),
  fecha_emision    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rfc_receptor     VARCHAR(15),
  nombre_receptor  VARCHAR(255),
  total            NUMERIC(12,2),
  status           VARCHAR(20) NOT NULL DEFAULT 'active'
);
