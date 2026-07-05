-- Separar productos de bacha (uso interno / recetas, envases grandes) de los
-- productos de venta (venta directa, envases chicos). Cada insumo es de un solo
-- tipo (excluyente):
--   * insumos: agrega tipo ('bacha' | 'venta', default 'bacha')
--   * los que hoy están marcados vendible pasan a tipo 'venta'
--   * `vendible` queda como columna legacy sincronizada (vendible = tipo='venta')
--
-- Solo recetas consumen tipo='bacha'; solo las ventas ofrecen tipo='venta'.

BEGIN;

CREATE TYPE "insumo_tipo" AS ENUM ('bacha', 'venta');

ALTER TABLE "insumos"
  ADD COLUMN "tipo" "insumo_tipo" NOT NULL DEFAULT 'bacha';

-- Migrar los vendibles actuales a producto de venta.
UPDATE "insumos" SET "tipo" = 'venta' WHERE "vendible" = true;

COMMIT;
