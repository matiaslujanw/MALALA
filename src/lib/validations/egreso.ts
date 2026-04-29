import { z } from "zod";

const optStr = z
  .string()
  .optional()
  .transform((s) => (s && s !== "" ? s : undefined));

export const egresoSchema = z
  .object({
    fecha: z.string().min(1).optional(),
    sucursal_id: z.string().min(1, "Sucursal requerida"),
    rubro_id: z.string().min(1, "Rubro requerido"),
    insumo_id: optStr,
    proveedor_id: optStr,
    cantidad: z.coerce.number().nonnegative().optional(),
    valor: z.coerce.number().positive("El monto debe ser > 0"),
    mp_id: z.string().min(1, "Medio de pago requerido"),
    observacion: z
      .string()
      .optional()
      .transform((s) => (s ?? "").trim() || undefined),
    pagado: z
      .union([z.literal("on"), z.literal("true"), z.literal("false"), z.boolean()])
      .optional()
      .transform((v) => v === true || v === "on" || v === "true"),
  })
  .superRefine((data, ctx) => {
    // Si se vinculó un insumo, exigir cantidad > 0
    if (data.insumo_id && (!data.cantidad || data.cantidad <= 0)) {
      ctx.addIssue({
        code: "custom",
        path: ["cantidad"],
        message: "Ingresá la cantidad de insumo recibido",
      });
    }
  });

export type EgresoInput = z.infer<typeof egresoSchema>;
