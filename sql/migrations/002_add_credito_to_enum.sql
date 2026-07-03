-- Migration 002: Add CREDITO value to tipo_pago_t enum
-- Run on: herraje_consorcio (production) and herraje_desarrollo (local)

ALTER TYPE tipo_pago_t ADD VALUE IF NOT EXISTS 'CREDITO';
