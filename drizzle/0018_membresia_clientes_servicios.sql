-- Membresía por sucursal (fase 2 y 3): clientes y servicios (servicios cubre
-- también promociones, que son filas de servicios con es_promo=true).
-- Aditivo y no destructivo.

CREATE TABLE IF NOT EXISTS "cliente_sucursal" (
  "id" text PRIMARY KEY NOT NULL,
  "cliente_id" text NOT NULL REFERENCES "clientes"("id") ON DELETE CASCADE,
  "sucursal_id" text NOT NULL REFERENCES "sucursales"("id") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "cliente_sucursal_uq"
  ON "cliente_sucursal" ("cliente_id", "sucursal_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "servicio_sucursal" (
  "id" text PRIMARY KEY NOT NULL,
  "servicio_id" text NOT NULL REFERENCES "servicios"("id") ON DELETE CASCADE,
  "sucursal_id" text NOT NULL REFERENCES "sucursales"("id") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "servicio_sucursal_uq"
  ON "servicio_sucursal" ("servicio_id", "sucursal_id");
