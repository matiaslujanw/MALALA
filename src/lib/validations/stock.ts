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
