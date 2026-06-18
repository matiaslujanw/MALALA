-- Fase 10 — Pago de gastos con uno o más medios + elección de cuenta
-- Hasta ahora un gasto/compra se pagaba con un único medio (mp_id) y la cuenta
-- se derivaba sola del medio. Ahora, igual que en una venta, se puede pagar con
-- un segundo medio y elegir a qué cuenta de banco impacta cada parte.
--   * mp1_cuenta_id : cuenta elegida para el medio 1 (override de la default).
--   * mp2_id        : segundo medio de pago (opcional).
--   * valor2        : monto pagado con el medio 2 (el medio 1 cubre valor - valor2).
--   * mp2_cuenta_id : cuenta elegida para el medio 2.
-- Todo nullable: los gastos existentes (un solo medio) siguen funcionando igual.

BEGIN;

ALTER TABLE "egresos"
  ADD COLUMN "mp1_cuenta_id" text REFERENCES "cuentas_bancarias"("id"),
  ADD COLUMN "mp2_id" text REFERENCES "medios_pago"("id"),
  ADD COLUMN "valor2" double precision,
  ADD COLUMN "mp2_cuenta_id" text REFERENCES "cuentas_bancarias"("id");

COMMIT;
