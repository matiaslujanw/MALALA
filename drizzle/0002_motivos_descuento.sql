-- Fase 3 — Motivos de descuento
-- Aplica:
--   * motivos_descuento: catálogo configurable (publicidad, autoconsumo socios, etc.)
--   * ingresos: agrega descuento_motivo_id (nullable, FK motivos_descuento)
--     para clasificar el descuento de cada venta y poder acumularlo por motivo.

BEGIN;

-- 1) Catálogo de motivos de descuento
CREATE TABLE IF NOT EXISTS "motivos_descuento" (
  "id" text PRIMARY KEY,
  "nombre" text NOT NULL,
  "activo" boolean NOT NULL DEFAULT true
);

-- 2) Asociar motivo al descuento de cada ingreso
ALTER TABLE "ingresos"
  ADD COLUMN "descuento_motivo_id" text REFERENCES "motivos_descuento"("id");

COMMIT;
