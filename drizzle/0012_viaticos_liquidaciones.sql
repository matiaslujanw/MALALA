BEGIN;

ALTER TABLE "empleados"
  ADD COLUMN "viatico_por_dia" double precision NOT NULL DEFAULT 0;

ALTER TABLE "liquidaciones"
  ADD COLUMN "viatico_por_dia" double precision NOT NULL DEFAULT 0,
  ADD COLUMN "dias_viatico" double precision NOT NULL DEFAULT 0,
  ADD COLUMN "total_viatico" double precision NOT NULL DEFAULT 0;

COMMIT;
