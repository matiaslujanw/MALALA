import { z } from "zod";

export const medioPagoSchema = z.object({
  codigo: z
    .string()
    .min(1, "Código requerido")
    .max(8)
    .transform((s) => s.trim().toUpperCase()),
  nombre: z.string().min(1, "Nombre requerido").transform((s) => s.trim()),
  activo: z.coerce.boolean().default(true),
});

export type MedioPagoInput = z.infer<typeof medioPagoSchema>;
