import { z } from "zod";

export const lineaSchema = z.object({
  servicio_id: z.string().min(1, "Servicio requerido"),
  empleado_id: z.string().min(1, "Empleado requerido"),
  precio_efectivo: z.coerce.number().nonnegative(),
  comision_pct: z.coerce.number().min(0).max(100),
});

export type LineaInput = z.infer<typeof lineaSchema>;

export const ingresoSchema = z
  .object({
    sucursal_id: z.string().min(1),
    cliente_id: z
      .string()
      .optional()
      .transform((s) => (s ? s : undefined)),
    lineas: z.array(lineaSchema).min(1, "Agregá al menos una línea"),
    descuento_tipo: z.enum(["pct", "monto"]),
    descuento_valor: z.coerce.number().nonnegative().default(0),
    mp1_id: z.string().min(1, "Medio de pago requerido"),
    valor1: z.coerce.number().nonnegative(),
    mp2_id: z
      .string()
      .optional()
      .transform((s) => (s ? s : undefined)),
    valor2: z.coerce.number().optional(),
    observacion: z
      .string()
      .optional()
      .transform((s) => (s ?? "").trim() || undefined),
  })
  .superRefine((data, ctx) => {
    const subtotal = data.lineas.reduce(
      (acc, l) => acc + l.precio_efectivo,
      0,
    );
    const descMonto =
      data.descuento_tipo === "pct"
        ? subtotal * (data.descuento_valor / 100)
        : data.descuento_valor;
    const total = subtotal - descMonto;

    const pagado = data.valor1 + (data.valor2 ?? 0);
    if (Math.abs(pagado - total) > 0.01) {
      ctx.addIssue({
        code: "custom",
        path: ["valor1"],
        message: `La suma de pagos (${pagado.toFixed(2)}) no coincide con el total (${total.toFixed(2)})`,
      });
    }
    if (data.descuento_tipo === "monto" && data.descuento_valor > subtotal) {
      ctx.addIssue({
        code: "custom",
        path: ["descuento_valor"],
        message: "El descuento no puede ser mayor al subtotal",
      });
    }
    if (data.descuento_tipo === "pct" && data.descuento_valor > 100) {
      ctx.addIssue({
        code: "custom",
        path: ["descuento_valor"],
        message: "El porcentaje no puede ser mayor a 100",
      });
    }
  });

export type IngresoInput = z.infer<typeof ingresoSchema>;
