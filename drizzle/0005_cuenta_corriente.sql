-- Fase CC — Cuenta corriente de clientes
-- Aplica:
--   * clientes.cuenta_corriente_habilitada: flag para habilitar fiado por cliente.
--   * movimientos_cc: detalle de cargos (fiado) y pagos sobre la cuenta corriente.
--     El saldo denormalizado vive en clientes.saldo_cc (ya existente).
--     Convención: monto siempre positivo; tipo "cargo" sube la deuda, "pago" la baja.
--
-- NOTA: esta migración YA fue aplicada manualmente en Supabase. Este archivo queda
-- como constancia versionada del cambio. Los IF NOT EXISTS la hacen idempotente.

BEGIN;

ALTER TABLE "clientes"
  ADD COLUMN IF NOT EXISTS "cuenta_corriente_habilitada" boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "movimientos_cc" (
  "id" text PRIMARY KEY,
  "cliente_id" text NOT NULL REFERENCES "clientes"("id") ON DELETE CASCADE,
  "fecha" timestamptz NOT NULL,
  "tipo" text NOT NULL,
  "monto" double precision NOT NULL,
  "sucursal_id" text REFERENCES "sucursales"("id"),
  "mp_id" text REFERENCES "medios_pago"("id"),
  "ref_tipo" text,
  "ref_id" text,
  "descripcion" text,
  "usuario_id" uuid NOT NULL REFERENCES "profiles"("user_id"),
  "creado_en" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "mov_cc_cliente_fecha_idx" ON "movimientos_cc" ("cliente_id", "fecha");
CREATE INDEX IF NOT EXISTS "mov_cc_ref_idx" ON "movimientos_cc" ("ref_tipo", "ref_id");

-- Medio de pago "CC" (Cuenta corriente) por sucursal: ocupa el slot de medio de
-- pago en la venta para poder fiar. No tiene cuenta bancaria (no impacta caja);
-- la app lo reconoce por el código reservado 'CC'. Idempotente.
INSERT INTO "medios_pago" ("id", "sucursal_id", "codigo", "nombre", "activo", "cuenta_id", "recargo_pct")
SELECT gen_random_uuid()::text, s."id", 'CC', 'Cuenta corriente', true, NULL, 0
FROM "sucursales" s
WHERE NOT EXISTS (
  SELECT 1 FROM "medios_pago" m
  WHERE m."sucursal_id" = s."id" AND m."codigo" = 'CC'
);

COMMIT;
