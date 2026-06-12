-- Fase 4 — Recargo por medio de pago + banco en transferencias
-- Aplica:
--   * medios_pago: agrega recargo_pct (double, default 0) → recargo automático
--     al cobrar con ese medio (ej. tarjeta de crédito).
--   * ingresos: agrega mp1_cuenta_id / mp2_cuenta_id (nullable, FK cuentas_bancarias)
--     para registrar a qué banco entró cada transferencia (Macro / Galicia / etc.).

BEGIN;

-- 1) Recargo configurable por medio de pago
ALTER TABLE "medios_pago"
  ADD COLUMN "recargo_pct" double precision NOT NULL DEFAULT 0;

-- 2) Banco destino elegido por cada medio de pago de la venta (transferencias)
ALTER TABLE "ingresos"
  ADD COLUMN "mp1_cuenta_id" text REFERENCES "cuentas_bancarias"("id"),
  ADD COLUMN "mp2_cuenta_id" text REFERENCES "cuentas_bancarias"("id");

COMMIT;
