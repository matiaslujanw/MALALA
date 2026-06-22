import { z } from "zod";

export const insumoSchema = z
  .object({
    nombre: z.string().min(1, "Nombre requerido").transform((s) => s.trim()),
    proveedor_ids: z
      .array(z.string())
      .default([])
      .transform((arr) => arr.filter(Boolean)),
    unidad_medida: z.enum(["ud", "ml", "g", "aplicacion"]),
    tamano_envase: z.coerce.number().positive("Debe ser > 0"),
    precio_envase: z.coerce
      .number()
      .positive("Cargá el precio del envase (mayor a 0)"),
    rinde: z.coerce.number().optional(),
    umbral_stock_bajo: z.coerce.number().nonnegative(),
    activo: z.coerce.boolean().default(true),
    vendible: z.coerce.boolean().default(false),
    precio_venta: z
      .union([z.coerce.number().nonnegative(), z.literal("").transform(() => undefined)])
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.vendible && (data.precio_venta == null || data.precio_venta <= 0)) {
      ctx.addIssue({
        code: "custom",
        path: ["precio_venta"],
        message: "Indicá un precio de venta mayor a 0",
      });
    }
  })
  .transform((data) => ({
    ...data,
    precio_unitario:
      data.tamano_envase > 0 ? data.precio_envase / data.tamano_envase : null,
    precio_venta: data.vendible ? data.precio_venta : undefined,
  }));

export type InsumoInput = z.infer<typeof insumoSchema>;
