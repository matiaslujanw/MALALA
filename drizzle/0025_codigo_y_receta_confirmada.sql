-- Las sucursales trabajan con códigos propios en sus planillas (PEL100 "Corte",
-- INS001 "Aceite Cristalli Liquidi", VPC100 "Bed Head TIGI"). Hasta ahora ese
-- código se perdía al cargar los datos y sólo quedaba escondido dentro del id.
-- Guardarlo en su propia columna permite mostrarlo en las tablas, buscarlo y
-- cruzar el sistema contra las planillas del salón.
--
--   * servicios.codigo: nullable, porque Centro se cargó sin códigos.
--   * insumos.codigo: idem, y cubre también los productos de venta (tipo='venta').
--
-- Las recetas que mandó Yerba Buena vienen en dos estados: confirmadas por las
-- chicas del salón y propuestas a confirmar. Se cargan todas (si no, la mitad de
-- los servicios quedaría con costo $0 y los reportes de margen no servirían),
-- pero marcadas, para poder distinguirlas en pantalla.
--
--   * recetas.confirmada: default true => todas las recetas ya cargadas a mano
--     desde la app siguen valiendo como confirmadas y nada cambia de golpe.
--
-- Los índices únicos sobre los códigos van aparte, DESPUÉS de la carga masiva
-- (ver 0026): si un duplicado hiciera fallar el import a mitad de camino, este
-- runner no tiene transacción real y dejaría filas a medio insertar.

BEGIN;

ALTER TABLE "servicios"
  ADD COLUMN IF NOT EXISTS "codigo" text;

ALTER TABLE "insumos"
  ADD COLUMN IF NOT EXISTS "codigo" text;

ALTER TABLE "recetas"
  ADD COLUMN IF NOT EXISTS "confirmada" boolean NOT NULL DEFAULT true;

COMMIT;
