import { z } from "zod";

export const recetaItemSchema = z.object({
  servicio_id: z.string().min(1),
  insumo_id: z.string().min(1, "Insumo requerido"),
  cantidad: z.coerce.number().positive("Cantidad debe ser > 0"),
});

export type RecetaItemInput = z.infer<typeof recetaItemSchema>;
