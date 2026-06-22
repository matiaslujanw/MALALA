import { z } from "zod";

const ymd = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (YYYY-MM-DD)");

// "Hoy" según el servidor (UTC). Como Argentina va detrás de UTC, este tope
// nunca rechaza el día en curso local; solo bloquea fechas claramente futuras.
function todayYMD(): string {
  return new Date().toISOString().slice(0, 10);
}

export const liquidacionPreviewSchema = z
  .object({
    sucursal_id: z.string().min(1, "Sucursal requerida"),
    empleado_id: z.string().min(1, "Empleado requerido"),
    periodo_desde: ymd,
    periodo_hasta: ymd,
  })
  .refine((v) => v.periodo_hasta >= v.periodo_desde, {
    message: "El periodo es inválido",
    path: ["periodo_hasta"],
  })
  .refine((v) => v.periodo_hasta <= todayYMD(), {
    message: "No se puede liquidar hasta una fecha futura",
    path: ["periodo_hasta"],
  });

export const liquidacionCreateSchema = liquidacionPreviewSchema.extend({
  horas_trabajadas: z.coerce.number().nonnegative().default(0),
  dias_viatico: z.coerce.number().nonnegative().default(0),
});

export const liquidacionPagoSchema = z.object({
  mp_id: z.string().min(1, "Medio de pago requerido"),
  observacion: z
    .string()
    .optional()
    .transform((s) => (s ?? "").trim() || undefined),
});

export type LiquidacionPreviewInput = z.infer<typeof liquidacionPreviewSchema>;
export type LiquidacionCreateInput = z.infer<typeof liquidacionCreateSchema>;
export type LiquidacionPagoInput = z.infer<typeof liquidacionPagoSchema>;
