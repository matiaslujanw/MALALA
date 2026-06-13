import { z } from "zod";

export const anticipoSchema = z.object({
  empleado_id: z.string().min(1, "Empleado requerido"),
  monto: z.coerce.number().positive("El monto debe ser mayor a 0"),
  mp_id: z.string().min(1, "Medio de pago requerido"),
  observacion: z
    .string()
    .optional()
    .transform((s) => (s ?? "").trim() || undefined),
});

export type AnticipoInput = z.infer<typeof anticipoSchema>;
