import { z } from "zod";

export const promocionSchema = z.object({
  nombre: z
    .string()
    .min(1, "Nombre requerido")
    .transform((s) => s.trim()),
  precio_lista: z.coerce.number().nonnegative("Debe ser ≥ 0"),
  precio_efectivo: z.coerce.number().nonnegative("Debe ser ≥ 0"),
  comision_default_pct: z.coerce.number().min(0).max(100, "Máximo 100%"),
  duracion_min: z.coerce
    .number()
    .int()
    .positive("Debe ser mayor a 0")
    .optional(),
  // YYYY-MM-DD; vacío = sin vencimiento.
  vence_el: z
    .string()
    .nullish()
    .transform((s) => (s ? s : undefined))
    .refine((s) => s == null || /^\d{4}-\d{2}-\d{2}$/.test(s), {
      message: "Fecha inválida",
    }),
  activo: z.coerce.boolean().default(true),
  // Servicios que componen la promo (≥2).
  componentes: z
    .array(z.string().min(1))
    .min(2, "Elegí al menos 2 servicios para combinar"),
});

export type PromocionInput = z.infer<typeof promocionSchema>;
