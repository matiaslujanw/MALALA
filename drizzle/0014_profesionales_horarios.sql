-- Disponibilidad semanal por profesional para la reserva publica.
-- Si un profesional no tiene filas en esta tabla para una sucursal, no se
-- aplica restriccion adicional y sigue usando la disponibilidad de la
-- sucursal + servicio.

BEGIN;

CREATE TABLE IF NOT EXISTS "profesionales_horarios" (
  "id" text PRIMARY KEY,
  "empleado_id" text NOT NULL REFERENCES "empleados"("id") ON DELETE CASCADE,
  "sucursal_id" text NOT NULL REFERENCES "sucursales"("id") ON DELETE CASCADE,
  "dia_semana" integer NOT NULL,
  "apertura" text NOT NULL,
  "cierre" text NOT NULL
);

CREATE INDEX IF NOT EXISTS "profesionales_horarios_empleado_sucursal_idx"
  ON "profesionales_horarios" ("empleado_id", "sucursal_id");

COMMIT;
