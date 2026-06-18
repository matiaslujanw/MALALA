-- Fase 12 — Arqueo por cuenta al cerrar la caja
-- Al cerrar el día se cuenta cuánta plata quedó realmente en cada cuenta y se
-- compara con lo esperado (lo que la app calcula). La diferencia (faltante o
-- sobrante) se REGISTRA como dato del cierre; NO toca el saldo de la cuenta.
--   * cierre_caja_cuentas : una fila por cuenta, con esperado y contado.

BEGIN;

CREATE TABLE "cierre_caja_cuentas" (
  "id" text PRIMARY KEY,
  "cierre_id" text NOT NULL REFERENCES "cierres_caja"("id") ON DELETE CASCADE,
  "cuenta_id" text NOT NULL REFERENCES "cuentas_bancarias"("id"),
  "saldo_esperado" double precision NOT NULL,
  "saldo_contado" double precision NOT NULL
);

CREATE INDEX "cierre_caja_cuentas_cierre_idx"
  ON "cierre_caja_cuentas" ("cierre_id");

COMMIT;
