-- Índices únicos para los códigos de planilla (ver 0025). Van en una migración
-- aparte, después de la carga masiva de Yerba Buena: si un duplicado hubiera
-- hecho fallar el import a mitad de camino, el runner de migraciones no tiene
-- transacción real y habría dejado filas a medio insertar.
--
--   * servicios: el único es GLOBAL y parcial (solo filas con código). No se
--     puede hacer "único por sucursal" porque `servicios` no tiene sucursal_id:
--     la pertenencia vive en la tabla puente servicio_sucursal. Hoy funciona
--     porque Centro se cargó sin códigos; si algún día Centro carga su propia
--     planilla y repite un PEL100, hay que mover el código a servicio_sucursal.
--   * insumos: sí tiene sucursal_id, así que el único es por (sucursal, código)
--     y cada sede puede tener su INS001.
--
-- Además, `recetas` no tenía ninguna restricción que impidiera cargar dos veces
-- el mismo insumo en el mismo servicio: re-correr un script de carga duplicaba
-- las líneas en silencio y el costo se sumaba dos veces.

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS "servicios_codigo_uq"
  ON "servicios" ("codigo")
  WHERE "codigo" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "insumos_sucursal_codigo_uq"
  ON "insumos" ("sucursal_id", "codigo")
  WHERE "codigo" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "recetas_sucursal_servicio_insumo_uq"
  ON "recetas" ("sucursal_id", "servicio_id", "insumo_id");

COMMIT;
