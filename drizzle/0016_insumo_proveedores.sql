CREATE TABLE "insumo_proveedores" (
  "id" text PRIMARY KEY NOT NULL,
  "insumo_id" text NOT NULL REFERENCES "insumos"("id") ON DELETE CASCADE,
  "proveedor_id" text NOT NULL REFERENCES "proveedores"("id") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX "insumo_proveedor_unique_idx"
  ON "insumo_proveedores" ("insumo_id", "proveedor_id");
--> statement-breakpoint
-- Backfill: cada insumo con proveedor actual pasa a ser una fila del join
INSERT INTO "insumo_proveedores" ("id", "insumo_id", "proveedor_id")
SELECT gen_random_uuid()::text, "id", "proveedor_id"
FROM "insumos"
WHERE "proveedor_id" IS NOT NULL;
--> statement-breakpoint
-- Eliminar la columna vieja (relación 1:N reemplazada por la N:N)
ALTER TABLE "insumos" DROP COLUMN "proveedor_id";
