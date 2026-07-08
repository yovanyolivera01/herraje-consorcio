-- Migration 006: Add tipo_pedido column to pedido table
-- Safe to run multiple times (IF NOT EXISTS / DO NOTHING).

ALTER TABLE pedido
  ADD COLUMN IF NOT EXISTS tipo_pedido TEXT NOT NULL DEFAULT 'VIDRIO'
    CHECK (tipo_pedido IN ('VIDRIO','MAQUILA'));

-- Fix 1: tipo_pedido incorrecto en pedidos existentes de maquila
UPDATE pedido p
SET tipo_pedido = 'MAQUILA'
FROM cotizacion c
WHERE c.id_cotizacion   = p.id_cotizacion
  AND c.tipo_cotizacion = 'MAQUILA'
  AND p.tipo_pedido     = 'VIDRIO';

-- Fix 2: quitar id_cotizacion de pedidos MAQUILA que ya tienen snapshot
-- en partida_pedido_maquila (cotizacion fue solo intermediaria).
-- Solo afecta pedidos donde partida_pedido_maquila tiene filas (datos copiados).
UPDATE pedido p
SET id_cotizacion = NULL
WHERE p.tipo_pedido = 'MAQUILA'
  AND p.id_cotizacion IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM partida_pedido_maquila WHERE id_pedido = p.id_pedido
  );
