import { z } from "zod";

export const insumoSchema = z
  .object({
    nombre: z.string().min(1, "Nombre requerido").transform((s) => s.trim()),
    proveedor_id: z
      .string()
      .optional()
      .transform((s) => (s ? s : undefined)),
    unidad_medida: z.enum(["ud", "ml", "g", "aplicacion"]),
    tamano_envase: z.coerce.number().positive("Debe ser > 0"),
    precio_envase: z.coerce.number().nonnegative(),
    rinde: z.coerce.number().optional(),
    umbral_stock_bajo: z.coerce.number().nonnegative(),
    activo: z.coerce.boolean().default(true),
  })
  .transform((data) => ({
    ...data,
    precio_unitario:
      data.tamano_envase > 0 ? data.precio_envase / data.tamano_envase : null,
  }));

export type InsumoInput = z.infer<typeof insumoSchema>;
