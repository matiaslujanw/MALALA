-- Membresía por sucursal de catálogos compartidos (fase 1): proveedores,
-- rubros de gasto y motivos de descuento. Mismo patrón que insumo_sucursal:
-- la definición sigue siendo global, pero cada sucursal ve/gestiona solo las
-- suyas. Aditivo y no destructivo.

CREATE TABLE IF NOT EXISTS "proveedor_sucursal" (
  "id" text PRIMARY KEY NOT NULL,
  "proveedor_id" text NOT NULL REFERENCES "proveedores"("id") ON DELETE CASCADE,
  "sucursal_id" text NOT NULL REFERENCES "sucursales"("id") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "proveedor_sucursal_uq"
  ON "proveedor_sucursal" ("proveedor_id", "sucursal_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "rubro_sucursal" (
  "id" text PRIMARY KEY NOT NULL,
  "rubro_id" text NOT NULL REFERENCES "rubros_gasto"("id") ON DELETE CASCADE,
  "sucursal_id" text NOT NULL REFERENCES "sucursales"("id") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "rubro_sucursal_uq"
  ON "rubro_sucursal" ("rubro_id", "sucursal_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "motivo_sucursal" (
  "id" text PRIMARY KEY NOT NULL,
  "motivo_id" text NOT NULL REFERENCES "motivos_descuento"("id") ON DELETE CASCADE,
  "sucursal_id" text NOT NULL REFERENCES "sucursales"("id") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "motivo_sucursal_uq"
  ON "motivo_sucursal" ("motivo_id", "sucursal_id");
