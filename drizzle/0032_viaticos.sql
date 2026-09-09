-- Viáticos cargados a mano, por empleada y por día.
--
-- CÓMO ERA: el viático salía de empleados.viatico_por_dia (un monto fijo en la
-- ficha, hoy en cero para las 12) multiplicado por una cantidad de días que se
-- tipeaba al liquidar, y que el sistema "sugería" contando las fechas en las que
-- esa empleada tenía alguna venta. O sea: adivinaba la asistencia a partir de si
-- le habían vendido algo, y el monto no podía variar por día.
--
-- CÓMO ES: se carga el viático el día que se da, con su monto. La liquidación
-- suma los del período en vez de multiplicar un fijo por días adivinados.
--
-- `pagado` + `egreso_id`: si la plata se le dio en el momento, la carga genera
-- el egreso contra el rubro Sueldos y queda marcada como pagada. Si no, queda
-- para pagarse junto con la liquidación. Los dos casos existen en el mostrador y
-- la diferencia importa: sin esta distinción, un viático que ya se entregó en
-- efectivo se volvería a pagar en la quincena.
--
-- `liquidacion_id` se completa al liquidar, igual que en anticipos: es lo que
-- impide que un mismo viático entre en dos liquidaciones.
--
-- Único por (empleada, fecha): un viático por día. Si hay que corregir el monto
-- se edita, no se apila otro.

BEGIN;

CREATE TABLE IF NOT EXISTS "viaticos" (
  "id" text PRIMARY KEY,
  "empleado_id" text NOT NULL REFERENCES "empleados"("id") ON DELETE CASCADE,
  "sucursal_id" text NOT NULL REFERENCES "sucursales"("id"),
  "fecha" date NOT NULL,
  "monto" double precision NOT NULL,
  "pagado" boolean NOT NULL DEFAULT false,
  "egreso_id" text REFERENCES "egresos"("id"),
  "liquidacion_id" text REFERENCES "liquidaciones"("id"),
  "observacion" text,
  "usuario_id" uuid NOT NULL REFERENCES "profiles"("user_id"),
  "creado_en" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "viaticos_monto_positivo" CHECK ("monto" > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "viaticos_empleado_fecha_uq"
  ON "viaticos" ("empleado_id", "fecha");

CREATE INDEX IF NOT EXISTS "viaticos_sucursal_fecha_idx"
  ON "viaticos" ("sucursal_id", "fecha");

CREATE INDEX IF NOT EXISTS "viaticos_liquidacion_idx"
  ON "viaticos" ("liquidacion_id");

COMMIT;
