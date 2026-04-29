import { z } from "zod";

export const ajusteManualSchema = z.object({
  insumo_id: z.string().min(1, "Insumo requerido"),
  sucursal_id: z.string().min(1, "Sucursal requerida"),
  cantidad: z.coerce
    .number()
    .refine((n) => n !== 0, "La cantidad no puede ser cero"),
  motivo: z
    .string()
    .min(3, "Motivo requerido")
    .transform((s) => s.trim()),
});

export type AjusteManualInput = z.infer<typeof ajusteManualSchema>;

export const transferenciaSchema = z
  .object({
    insumo_id: z.string().min(1, "Insumo requerido"),
    sucursal_origen_id: z.string().min(1, "Sucursal origen requerida"),
    sucursal_destino_id: z.string().min(1, "Sucursal destino requerida"),
    cantidad: z.coerce.number().positive("Debe ser > 0"),
    motivo: z
      .string()
      .optional()
      .transform((s) => (s ?? "").trim() || undefined),
  })
  .refine((d) => d.sucursal_origen_id !== d.sucursal_destino_id, {
    message: "Origen y destino deben ser distintos",
    path: ["sucursal_destino_id"],
  });

export type TransferenciaInput = z.infer<typeof transferenciaSchema>;
