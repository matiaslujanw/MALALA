-- Impuestos configurables por cuenta bancaria (autogestionables) + trazabilidad.
--   * tipo_mov_bancario: agrega el valor 'impuesto' (cada impuesto retenido es un
--     movimiento propio, egreso, linkeado por ref_id al movimiento que lo generó).
--   * impuesto_base: enum credito | debito | ambos (sobre qué movimientos aplica).
--   * cuenta_impuestos: N impuestos por cuenta (nombre, alícuota %, base, activo).
--
-- Ejemplos típicos (AR): "Débito y crédito" 0.6% base 'ambos';
-- "Ingresos brutos" 2.5% base 'credito'.

-- ALTER TYPE ... ADD VALUE no puede usarse en la misma transacción que lo define,
-- por eso va suelto (fuera del BEGIN/COMMIT de abajo).
ALTER TYPE "tipo_mov_bancario" ADD VALUE IF NOT EXISTS 'impuesto';

BEGIN;

CREATE TYPE "impuesto_base" AS ENUM ('credito', 'debito', 'ambos');

CREATE TABLE "cuenta_impuestos" (
  "id" text PRIMARY KEY NOT NULL,
  "cuenta_id" text NOT NULL REFERENCES "cuentas_bancarias"("id") ON DELETE CASCADE,
  "nombre" text NOT NULL,
  "alicuota_pct" double precision NOT NULL,
  "base" "impuesto_base" NOT NULL,
  "activo" boolean NOT NULL DEFAULT true
);

CREATE INDEX "cuenta_impuestos_cuenta_idx" ON "cuenta_impuestos" ("cuenta_id");

COMMIT;
