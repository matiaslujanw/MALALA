-- Índice compuesto para la agenda de turnos: la agenda siempre filtra por
-- sucursal + fecha (vista diaria y rangos semanal/mensual). Evita scans
-- secuenciales de la tabla `turnos` a medida que crece. Aditivo y seguro.

CREATE INDEX IF NOT EXISTS "turnos_sucursal_fecha_idx"
  ON "turnos" ("sucursal_id", "fecha_turno");
