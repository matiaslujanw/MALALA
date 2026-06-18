-- El stock pasa a llevarse en la unidad base del insumo (ml/g/ud), igual que el
-- consumo por receta y la valuación de la pantalla de stock. Hasta ahora las
-- COMPRAS sumaban "cantidad de envases", generando stock incoherente para todo
-- insumo con tamano_envase != 1 (p. ej. comprar 2 envases de 500ml sumaba 2).
--
-- 1) Reexpresa los movimientos de compra históricos a unidad base
--    (cantidad_envases * tamano_envase).
-- 2) Recalcula stock_sucursal como la suma del ledger por (insumo, sucursal).
--
-- IMPORTANTE: correr UNA sola vez. Volver a ejecutarla multiplicaría de nuevo
-- las compras. Tras correrla conviene hacer un recuento físico y ajustar con un
-- "ajuste manual" cualquier diferencia.

BEGIN;

UPDATE movimientos_stock AS m
SET cantidad = m.cantidad * i.tamano_envase
FROM insumos AS i
WHERE m.insumo_id = i.id
  AND m.tipo = 'compra';

UPDATE stock_sucursal AS s
SET cantidad = COALESCE((
  SELECT SUM(m.cantidad)
  FROM movimientos_stock AS m
  WHERE m.insumo_id = s.insumo_id
    AND m.sucursal_id = s.sucursal_id
), 0);

COMMIT;
