-- Migración turnos a 4 estados — PASO 1 (correr solo y primero).
--
-- Agrega el valor 'realizado' al enum. En Postgres, un valor nuevo de enum debe
-- estar committeado antes de poder usarse en un UPDATE, por eso este paso va
-- SEPARADO del paso 2 (si corrés ambos juntos falla con 55P04 "unsafe use of
-- new value").
ALTER TYPE turno_estado ADD VALUE IF NOT EXISTS 'realizado';
