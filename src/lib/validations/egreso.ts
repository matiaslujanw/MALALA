import { z } from "zod";

// nullish: tolera `null` (lo que devuelve FormData.get cuando el campo no existe)
// además de undefined/"".
const optStr = z
  .string()
  .nullish()
  .transform((s) => (s && s !== "" ? s : undefined));

export const egresoSchema = z
  .object({
    fecha: z.string().min(1).nullish(),
    sucursal_id: z.string().min(1, "Sucursal requerida"),
    rubro_id: z.string().min(1, "Rubro requerido"),
    insumo_id: optStr,
    proveedor_id: optStr,
    cantidad: z.coerce.number().nonnegative().nullish(),
    valor: z.coerce.number().positive("El monto debe ser > 0"),
    mp_id: z.string().min(1, "Medio de pago requerido"),
    mp1_cuenta_id: optStr,
    mp2_id: optStr,
    valor2: z.coerce.number().nonnegative().nullish(),
    mp2_cuenta_id: optStr,
    observacion: z
      .string()
      .nullish()
      .transform((s) => (s ?? "").trim() || undefined),
    pagado: z
      .union([z.literal("on"), z.literal("true"), z.literal("false"), z.boolean()])
      .nullish()
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
    // Si se eligió un segundo medio de pago, validar el split
    if (data.mp2_id) {
      if (data.mp2_id === data.mp_id) {
        ctx.addIssue({
          code: "custom",
          path: ["mp2_id"],
          message: "El segundo medio debe ser distinto al primero",
        });
      }
      if (!data.valor2 || data.valor2 <= 0) {
        ctx.addIssue({
          code: "custom",
          path: ["valor2"],
          message: "Ingresá cuánto pagás con el segundo medio",
        });
      } else if (data.valor2 >= data.valor) {
        ctx.addIssue({
          code: "custom",
          path: ["valor2"],
          message: "El monto del segundo medio no puede ser mayor o igual al total",
        });
      }
    }
  });

export type EgresoInput = z.infer<typeof egresoSchema>;
