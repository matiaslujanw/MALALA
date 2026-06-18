-- Fase 11 — Apertura de caja diaria
-- Al abrir el día se declara cuánta plata hay en cada cuenta (efectivo + bancos).
-- El valor esperado se prellena con el saldo que calcula la app; el declarado es
-- lo que realmente tienen. Si difieren, se registra un movimiento de ajuste por
-- cuenta (ref_tipo = 'apertura') para que el saldo refleje la plata real.
--   * aperturas_caja        : una apertura por sucursal + día (quién, cuándo).
--   * apertura_caja_cuentas  : una fila por cuenta, con esperado y declarado.

BEGIN;

CREATE TABLE "aperturas_caja" (
  "id" text PRIMARY KEY,
  "sucursal_id" text NOT NULL REFERENCES "sucursales"("id"),
  "fecha" text NOT NULL,
  "abierto_por" uuid NOT NULL REFERENCES "profiles"("user_id"),
  "fecha_apertura" timestamptz NOT NULL,
  "observacion" text
);

CREATE TABLE "apertura_caja_cuentas" (
  "id" text PRIMARY KEY,
  "apertura_id" text NOT NULL REFERENCES "aperturas_caja"("id") ON DELETE CASCADE,
  "cuenta_id" text NOT NULL REFERENCES "cuentas_bancarias"("id"),
  "saldo_esperado" double precision NOT NULL,
  "saldo_declarado" double precision NOT NULL
);

-- Una sola apertura por sucursal y día.
CREATE UNIQUE INDEX "aperturas_caja_sucursal_fecha_idx"
  ON "aperturas_caja" ("sucursal_id", "fecha");

CREATE INDEX "apertura_caja_cuentas_apertura_idx"
  ON "apertura_caja_cuentas" ("apertura_id");

COMMIT;
