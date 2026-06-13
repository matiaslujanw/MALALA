-- Empleados: sueldo por hora + anticipos
-- Cambios:
--   * empleados.valor_hora: valor por hora del empleado. El antiguo
--     "sueldo_asegurado" (monto fijo) ya no se usa en el cálculo; se le pone
--     DEFAULT 0 para no romper inserts que dejen de setearlo.
--   * liquidaciones: columnas de desglose (horas, sueldo por horas, anticipos,
--     total a pagar). El total a pagar = comisiones + sueldo_horas - anticipos.
--   * anticipos: adelantos de plata al empleado. Cada anticipo genera un egreso
--     (sale de caja) y se descuenta de la liquidación cuando se liquida.
--
-- Migración aditiva (no borra columnas existentes), segura en producción.

BEGIN;

ALTER TABLE "empleados"
  ADD COLUMN IF NOT EXISTS "valor_hora" double precision NOT NULL DEFAULT 0;
ALTER TABLE "empleados"
  ALTER COLUMN "sueldo_asegurado" SET DEFAULT 0;
-- Jornada del empleado: horas por día + días de la semana que trabaja (0=domingo
-- … 6=sábado). Sirve para proponer las horas del período al liquidar (editable).
ALTER TABLE "empleados"
  ADD COLUMN IF NOT EXISTS "horas_por_dia" double precision NOT NULL DEFAULT 0;
ALTER TABLE "empleados"
  ADD COLUMN IF NOT EXISTS "dias_trabajo" jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE "liquidaciones"
  ADD COLUMN IF NOT EXISTS "horas_trabajadas" double precision NOT NULL DEFAULT 0;
ALTER TABLE "liquidaciones"
  ADD COLUMN IF NOT EXISTS "valor_hora" double precision NOT NULL DEFAULT 0;
ALTER TABLE "liquidaciones"
  ADD COLUMN IF NOT EXISTS "sueldo_horas" double precision NOT NULL DEFAULT 0;
ALTER TABLE "liquidaciones"
  ADD COLUMN IF NOT EXISTS "total_anticipos" double precision NOT NULL DEFAULT 0;
ALTER TABLE "liquidaciones"
  ADD COLUMN IF NOT EXISTS "total_pagar" double precision NOT NULL DEFAULT 0;

-- Liquidaciones previas a esta feature: su total a pagar eran solo las comisiones.
UPDATE "liquidaciones"
  SET "total_pagar" = "total_comision"
  WHERE "total_pagar" = 0 AND "total_comision" > 0;

CREATE TABLE IF NOT EXISTS "anticipos" (
  "id" text PRIMARY KEY,
  "empleado_id" text NOT NULL REFERENCES "empleados"("id"),
  "sucursal_id" text NOT NULL REFERENCES "sucursales"("id"),
  "fecha" timestamptz NOT NULL,
  "monto" double precision NOT NULL,
  "mp_id" text REFERENCES "medios_pago"("id"),
  "egreso_id" text REFERENCES "egresos"("id"),
  "liquidacion_id" text REFERENCES "liquidaciones"("id"),
  "observacion" text,
  "usuario_id" uuid NOT NULL REFERENCES "profiles"("user_id"),
  "creado_en" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "anticipos_empleado_liq_idx"
  ON "anticipos" ("empleado_id", "liquidacion_id");
CREATE INDEX IF NOT EXISTS "anticipos_empleado_fecha_idx"
  ON "anticipos" ("empleado_id", "fecha");

COMMIT;
