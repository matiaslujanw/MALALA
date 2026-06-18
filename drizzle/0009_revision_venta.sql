-- Fase 9 — Revisión de la venta
-- Permite marcar una venta como correcta o con error (para auditar si el
-- empleado cometió errores). null = sin revisar, "ok" = correcta, "error" = con error.

BEGIN;

ALTER TABLE "ingresos"
  ADD COLUMN "revision" text,
  ADD COLUMN "revision_nota" text,
  ADD COLUMN "revisado_por" uuid REFERENCES "profiles"("user_id"),
  ADD COLUMN "revisado_en" timestamptz;

COMMIT;
