-- Fase 9 — Cuenta corriente habilitada para todos los clientes por defecto
-- Antes el flag arrancaba en false y había que habilitarlo manualmente por
-- cliente. Ahora todos lo tienen habilitado (cada uno decide usarlo o no al
-- cobrar); deshabilitarlo pasa a ser la excepción manual.
-- Se excluye "Consumidor Final" (cliente genérico de mostrador, no fía).

BEGIN;

-- 1) Nuevo default para clientes futuros
ALTER TABLE "clientes"
  ALTER COLUMN "cuenta_corriente_habilitada" SET DEFAULT true;

-- 2) Habilitar en todos los clientes existentes (salvo Consumidor Final)
UPDATE "clientes"
  SET "cuenta_corriente_habilitada" = true
  WHERE "cuenta_corriente_habilitada" = false
    AND "nombre" <> 'Consumidor Final';

COMMIT;
