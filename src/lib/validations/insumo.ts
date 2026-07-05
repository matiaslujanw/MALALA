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
    // Bacha (recetas / uso interno) o venta (venta directa al público).
    tipo: z.enum(["bacha", "venta"]).default("bacha"),
    precio_venta: z
      .union([z.coerce.number().nonnegative(), z.literal("").transform(() => undefined)])
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.tipo === "venta" && (data.precio_venta == null || data.precio_venta <= 0)) {
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
    // `vendible` se deriva de `tipo` (columna legacy sincronizada).
    vendible: data.tipo === "venta",
    precio_venta: data.tipo === "venta" ? data.precio_venta : undefined,
  }));

export type InsumoInput = z.infer<typeof insumoSchema>;
