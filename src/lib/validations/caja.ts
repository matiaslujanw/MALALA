import { z } from "zod";

/**
 * Denominaciones de billetes ARS que se cuentan en el arqueo.
 * Si necesitamos agregar / quitar denominaciones (p.ej. 20000),
 * se actualiza acá.
 */
export const DENOMINACIONES_ARS = [
  20000, 10000, 2000, 1000, 500, 200, 100, 50, 20, 10,
] as const;

export const billetesSchema = z.record(
  z.string(),
  z.coerce.number().int().nonnegative(),
);

export const cierreCajaSchema = z.object({
  sucursal_id: z.string().min(1),
  fecha: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (YYYY-MM-DD)"),
  saldo_inicial_ef: z.coerce.number().nonnegative().default(0),
  saldo_banco: z.coerce.number().default(0),
  billetes: billetesSchema.default({}),
  // Campos manuales adicionales (cosas que no salen de ingresos/egresos)
  vouchers: z.coerce.number().nonnegative().default(0),
  giftcards: z.coerce.number().nonnegative().default(0),
  autoconsumos: z.coerce.number().nonnegative().default(0),
  cheques: z.coerce.number().nonnegative().default(0),
  aportes: z.coerce.number().nonnegative().default(0),
  ingresos_cc: z.coerce.number().nonnegative().default(0),
  anticipos: z.coerce.number().nonnegative().default(0),
  observacion: z
    .string()
    .optional()
    .transform((s) => (s ?? "").trim() || undefined),
});

export type CierreCajaInput = z.infer<typeof cierreCajaSchema>;
