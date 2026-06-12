-- Fase 4 — Disponibilidad por servicio
-- Aplica:
--   * servicios_horarios: franjas (día + rango horario) en que un servicio
--     puede reservarse online. Si un servicio no tiene filas en esta tabla,
--     queda disponible en todo el horario de la sucursal (sin restricción).
--
-- Migración puramente aditiva: crea una tabla nueva vacía. No modifica datos
-- ni columnas existentes, por lo que es segura de aplicar en producción.

BEGIN;

CREATE TABLE IF NOT EXISTS "servicios_horarios" (
  "id" text PRIMARY KEY,
  "servicio_id" text NOT NULL REFERENCES "servicios"("id") ON DELETE CASCADE,
  "dia_semana" integer NOT NULL,
  "apertura" text NOT NULL,
  "cierre" text NOT NULL
);

COMMIT;
