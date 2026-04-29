import { z } from "zod";

export const clienteSchema = z.object({
  nombre: z.string().min(1, "Nombre requerido").transform((s) => s.trim()),
  telefono: z
    .string()
    .optional()
    .transform((s) => (s ?? "").trim() || undefined),
  observacion: z
    .string()
    .optional()
    .transform((s) => (s ?? "").trim() || undefined),
  activo: z.coerce.boolean().default(true),
});

export type ClienteInput = z.infer<typeof clienteSchema>;
