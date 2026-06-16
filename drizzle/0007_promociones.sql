-- Fase 7 — Promociones (combinación de servicios)
-- Una promo es una fila de `servicios` con es_promo=true que combina varios
-- servicios componentes (promocion_items). Reutiliza booking, turnos,
-- servicios_horarios (franja) y la comisión por línea del POS.
--   * servicios: es_promo (flag) + vence_el (vencimiento opcional)
--   * promocion_items: componentes de cada promo
--   * ingreso_lineas: promo_servicio_id para trazabilidad de la venta

BEGIN;

-- 1) Flag y vencimiento en servicios
ALTER TABLE "servicios"
  ADD COLUMN "es_promo" boolean NOT NULL DEFAULT false,
  ADD COLUMN "vence_el" date;

-- 2) Componentes de cada promoción
CREATE TABLE "promocion_items" (
  "id" text PRIMARY KEY,
  "promo_servicio_id" text NOT NULL REFERENCES "servicios"("id") ON DELETE CASCADE,
  "componente_servicio_id" text NOT NULL REFERENCES "servicios"("id") ON DELETE CASCADE,
  "orden" integer NOT NULL DEFAULT 0
);

CREATE INDEX "promocion_items_promo_idx" ON "promocion_items" ("promo_servicio_id");

-- 3) Trazabilidad de la promo en cada línea de venta
ALTER TABLE "ingreso_lineas"
  ADD COLUMN "promo_servicio_id" text REFERENCES "servicios"("id");

COMMIT;
