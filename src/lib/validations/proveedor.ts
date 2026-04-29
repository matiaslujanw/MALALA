import { z } from "zod";

export const proveedorSchema = z.object({
  nombre: z.string().min(1, "Nombre requerido").transform((s) => s.trim()),
  telefono: z
    .string()
    .optional()
    .transform((s) => (s ?? "").trim() || undefined),
  cuit: z
    .string()
    .optional()
    .transform((s) => (s ?? "").trim() || undefined),
});

export type ProveedorInput = z.infer<typeof proveedorSchema>;
