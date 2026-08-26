-- Medio de pago "GIFT" (Gift card) por sucursal.
--
-- Ocupa el slot de medio de pago en la venta para poder canjear una gift card,
-- igual que 'CC' lo ocupa para fiar. La app lo reconoce por el código reservado
-- 'GIFT' (ver esGift en src/lib/data/ingresos.ts).
--
-- cuenta_id VA EN NULL Y ES A PROPÓSITO: en el canje no entra plata. Ya entró
-- cuando se vendió la tarjeta, semanas antes. Si apuntara a una cuenta, cada
-- canje sumaría al saldo un dinero que no está en ningún lado y el arqueo daría
-- sobrante. El código de createIngreso saltea el tramo GIFT antes de llegar a
-- resolver la cuenta, así que tampoco dispara el aviso de "medio sin cuenta".
--
-- recargo 0: canjear no tiene costo financiero.
--
-- Idempotente: el NOT EXISTS deja correrla de nuevo sin duplicar.

BEGIN;

INSERT INTO "medios_pago" ("id", "sucursal_id", "codigo", "nombre", "activo", "cuenta_id", "recargo_pct")
SELECT gen_random_uuid()::text, s."id", 'GIFT', 'Gift card', true, NULL, 0
FROM "sucursales" s
WHERE NOT EXISTS (
  SELECT 1 FROM "medios_pago" m
  WHERE m."sucursal_id" = s."id" AND m."codigo" = 'GIFT'
);

COMMIT;
