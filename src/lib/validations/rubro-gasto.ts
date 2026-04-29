import { z } from "zod";

export const rubroGastoSchema = z.object({
  rubro: z.string().min(1, "Rubro requerido").transform((s) => s.trim()),
  subrubro: z
    .string()
    .optional()
    .transform((s) => (s ?? "").trim() || undefined),
  activo: z.coerce.boolean().default(true),
});

export type RubroGastoInput = z.infer<typeof rubroGastoSchema>;
