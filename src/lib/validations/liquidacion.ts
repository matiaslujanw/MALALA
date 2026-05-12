import { z } from "zod";

const ymd = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (YYYY-MM-DD)");

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
  });

export const liquidacionCreateSchema = liquidacionPreviewSchema;

export const liquidacionPagoSchema = z.object({
  mp_id: z.string().min(1, "Medio de pago requerido"),
  observacion: z
    .string()
    .optional()
    .transform((s) => (s ?? "").trim() || undefined),
});

export type LiquidacionPreviewInput = z.infer<typeof liquidacionPreviewSchema>;
export type LiquidacionPagoInput = z.infer<typeof liquidacionPagoSchema>;
