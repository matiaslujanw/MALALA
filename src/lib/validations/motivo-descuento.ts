import { z } from "zod";

export const motivoDescuentoSchema = z.object({
  nombre: z
    .string()
    .min(1, "Nombre requerido")
    .transform((s) => s.trim()),
  activo: z.coerce.boolean().default(true),
});

export type MotivoDescuentoInput = z.infer<typeof motivoDescuentoSchema>;
