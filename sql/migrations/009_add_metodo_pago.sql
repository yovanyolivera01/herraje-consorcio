-- Migration 009: Add metodo_pago column to pedido table
ALTER TABLE pedido
  ADD COLUMN IF NOT EXISTS metodo_pago TEXT
    CHECK (metodo_pago IN ('EFECTIVO', 'TRANSFERENCIA', 'TARJETA'));
