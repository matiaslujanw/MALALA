-- Migración turnos a 4 estados — PASO 2 (correr DESPUÉS del paso 1).
--
-- Migra los datos existentes al modelo nuevo:
--   confirmado / en_curso  -> pendiente
--   completado             -> realizado
UPDATE turnos SET estado = 'pendiente' WHERE estado IN ('confirmado', 'en_curso');
UPDATE turnos SET estado = 'realizado' WHERE estado = 'completado';
