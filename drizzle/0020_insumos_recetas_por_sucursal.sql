-- Insumos y recetas pasan a ser POR SUCURSAL.
--
-- Antes: la definición y el precio del insumo, y la receta de cada servicio,
-- eran globales (compartidos entre todas las sucursales) y la visibilidad se
-- resolvía con la tabla puente insumo_sucursal.
--
-- Ahora: cada insumo y cada receta pertenecen a UNA sucursal (columna
-- sucursal_id). La tabla insumo_sucursal queda obsoleta y se elimina.
--
-- NO DESTRUCTIVA: no se borra ninguna venta, egreso ni stock. La columna se
-- agrega nullable, se rellena (backfill) y recién después se pone NOT NULL.
-- Un insumo que estaba habilitado en varias sucursales queda asignado a una
-- sola (la de menor id). Su stock en la otra sucursal no se borra, pero deja de
-- listarse (queda colgado) hasta que se limpie a mano si hace falta.

-- 1) Insumos: columna nullable + FK
ALTER TABLE "insumos"
  ADD COLUMN "sucursal_id" text
  REFERENCES "sucursales"("id") ON DELETE CASCADE;
--> statement-breakpoint

-- 2) Backfill: cada insumo a la sucursal donde estaba habilitado (la menor si
--    estaba en varias), tomando la membresía insumo_sucursal.
UPDATE "insumos" AS i
SET "sucursal_id" = sub.sucursal_id
FROM (
  SELECT "insumo_id", MIN("sucursal_id") AS sucursal_id
  FROM "insumo_sucursal"
  GROUP BY "insumo_id"
) AS sub
WHERE sub."insumo_id" = i."id";
--> statement-breakpoint

-- 3) Fallback: insumos sin ninguna membresía -> primera sucursal.
UPDATE "insumos"
SET "sucursal_id" = (SELECT "id" FROM "sucursales" ORDER BY "id" LIMIT 1)
WHERE "sucursal_id" IS NULL;
--> statement-breakpoint

ALTER TABLE "insumos" ALTER COLUMN "sucursal_id" SET NOT NULL;
--> statement-breakpoint

-- 4) Recetas: columna nullable + FK
ALTER TABLE "recetas"
  ADD COLUMN "sucursal_id" text
  REFERENCES "sucursales"("id") ON DELETE CASCADE;
--> statement-breakpoint

-- 5) Backfill: cada receta hereda la sucursal de su insumo.
UPDATE "recetas" AS r
SET "sucursal_id" = i."sucursal_id"
FROM "insumos" AS i
WHERE i."id" = r."insumo_id";
--> statement-breakpoint

-- 6) Salvaguarda: si quedara alguna receta sin insumo válido (no debería),
--    se elimina para poder aplicar el NOT NULL.
DELETE FROM "recetas" WHERE "sucursal_id" IS NULL;
--> statement-breakpoint

ALTER TABLE "recetas" ALTER COLUMN "sucursal_id" SET NOT NULL;
--> statement-breakpoint

-- 7) La membresía deja de existir: ahora es implícita en insumos.sucursal_id.
DROP TABLE IF EXISTS "insumo_sucursal";
