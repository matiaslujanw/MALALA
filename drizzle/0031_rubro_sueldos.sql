-- Crea el rubro de gasto "Sueldos" en las dos sucursales.
--
-- POR QUÉ: cargar un anticipo a una empleada y pagar una liquidación generan un
-- egreso, y las dos operaciones buscan el rubro por nombre —
-- ilike(rubro, 'Sueldos') en anticipos.ts:138 y liquidaciones.ts:772— y devuelven
-- error si no existe. En producción no existía: hoy NINGUNA de las dos
-- sucursales puede cargar un anticipo ni pagar una liquidación. Los únicos dos
-- rubros cargados son "Limpieza" (Yerba Buena) y "Test" (Centro).
--
-- El rubro es global (rubros_gasto no tiene sucursal_id); la pertenencia vive en
-- rubro_sucursal, así que hace falta una fila por sucursal o el rubro no aparece
-- en el selector de esa sede.
--
-- El id es fijo y legible a propósito: el guard que impide desactivarlo
-- (rubros-gasto.ts) lo reconoce por nombre, pero un id estable hace que este
-- INSERT sea idempotente y que se pueda auditar de dónde salió la fila.
--
-- Idempotente por los NOT EXISTS: correrla dos veces no duplica nada.

BEGIN;

INSERT INTO "rubros_gasto" ("id", "rubro", "subrubro", "activo")
SELECT 'rubro-sueldos', 'Sueldos', NULL, true
WHERE NOT EXISTS (
  SELECT 1 FROM "rubros_gasto" WHERE lower("rubro") = 'sueldos'
);

INSERT INTO "rubro_sucursal" ("id", "rubro_id", "sucursal_id")
SELECT 'rs-sueldos-' || s."id", rg."id", s."id"
FROM "sucursales" s
CROSS JOIN "rubros_gasto" rg
WHERE lower(rg."rubro") = 'sueldos'
  AND NOT EXISTS (
    SELECT 1 FROM "rubro_sucursal" x
    WHERE x."rubro_id" = rg."id" AND x."sucursal_id" = s."id"
  );

COMMIT;
