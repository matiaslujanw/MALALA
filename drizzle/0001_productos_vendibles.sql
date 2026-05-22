-- Fase 2 — Productos vendibles dentro de stock
-- Aplica:
--   * insumos: agrega vendible (bool, default false) y precio_venta (nullable)
--   * ingreso_lineas: servicio_id pasa a NULL permitido + agrega insumo_id (FK insumos)
--                     con check: exactamente uno de servicio_id / insumo_id

BEGIN;

-- 1) Extensiones a insumos
ALTER TABLE "insumos"
  ADD COLUMN "vendible" boolean NOT NULL DEFAULT false,
  ADD COLUMN "precio_venta" double precision;

-- 2) ingreso_lineas: relajar NOT NULL y agregar insumo_id
ALTER TABLE "ingreso_lineas"
  ALTER COLUMN "servicio_id" DROP NOT NULL,
  ADD COLUMN "insumo_id" text REFERENCES "insumos"("id");

-- 3) Garantizar que cada línea sea o servicio o producto (exactamente uno)
ALTER TABLE "ingreso_lineas"
  ADD CONSTRAINT "ingreso_lineas_tipo_chk"
    CHECK (
      ("servicio_id" IS NOT NULL AND "insumo_id" IS NULL)
      OR
      ("servicio_id" IS NULL AND "insumo_id" IS NOT NULL)
    );

COMMIT;
